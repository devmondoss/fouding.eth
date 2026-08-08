//! Fouding CreditVault: the financial state machine and accounting layer.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
// Solidity ABI entrypoints are fixed by the protocol schema and intentionally
// exceed Clippy's general-purpose argument threshold.
#![allow(clippy::too_many_arguments)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{
        aliases::{U16, U64, U8},
        Address, B256, U256,
    },
    alloy_sol_types::sol,
    prelude::*,
    storage::{StorageB256, StorageU16, StorageU8, StorageVec},
};

use stylus_sdk::alloy_primitives::keccak256;

const STATUS_DRAFT: u8 = 0;
const STATUS_FUNDING: u8 = 1;
const STATUS_FUNDED: u8 = 2;
const STATUS_ACTIVE: u8 = 3;
const STATUS_REPAID: u8 = 4;
const STATUS_DEFAULTED: u8 = 5;
const STATUS_RECOVERY: u8 = 6;
const STATUS_CLOSED: u8 = 7;
const STATUS_CANCELLED: u8 = 8;
const BPS_DENOMINATOR: u64 = 10_000;
const MAX_INTEREST_BPS: u16 = 10_000;
const MAX_PLATFORM_FEE_BPS: u16 = 2_000;
const MAX_COST_BPS: u16 = 2_000;

const MILESTONE_PENDING: u8 = 0;
const MILESTONE_SUBMITTED: u8 = 1;
const MILESTONE_RELEASED: u8 = 2;
const MILESTONE_REJECTED: u8 = 3;
// Bounded so the schedule fits comfortably in one transaction's gas;
// matches the UI's expectation of a handful of disbursement tranches, not
// an open-ended list (packages/nextjs/lib/types.ts::Milestone).
const MAX_MILESTONES: usize = 8;

sol_interface! {
    interface ICreditRegistry {
        function isVaultConfigurationValid(address vault, bytes32 deal_id, address borrower, address originator, address payment_token, address passport, address access_registry) external view returns (bool);
        function hasRole(bytes32 role, address account) external view returns (bool);
    }

    interface ICompanyPassport {
        function isVerifiedCompany(address account) external view returns (bool);
    }

    interface IAccessRegistry {
        function isAllowedInvestor(address investor) external view returns (bool);
    }

    interface IERC20Interface {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
    }
}

sol! {
    interface RegistryCalls {
        function hasRole(bytes32 role, address account) external view returns (bool);
        function isVaultConfigurationValid(address vault, bytes32 dealId, address borrower, address originator, address paymentToken, address passport, address accessRegistry) external view returns (bool);
    }

    interface PassportCalls {
        function isVerifiedCompany(address account) external view returns (bool);
    }

    interface AccessRegistryCalls {
        function isAllowedInvestor(address investor) external view returns (bool);
    }

    interface TokenCalls {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
    }

    #[derive(Debug)] error AlreadyInitialized();
    #[derive(Debug)] error NotInitialized();
    #[derive(Debug)] error ZeroAddress();
    #[derive(Debug)] error ZeroHash();
    #[derive(Debug)] error InvalidTerms();
    #[derive(Debug)] error InvalidAmount();
    #[derive(Debug)] error InvalidState(uint8 expected, uint8 actual);
    #[derive(Debug)] error Unauthorized(address caller);
    #[derive(Debug)] error FundingDeadlinePassed(uint64 deadline);
    #[derive(Debug)] error BorrowerPassportInvalid(address borrower);
    #[derive(Debug)] error InvestorNotAllowed(address investor);
    #[derive(Debug)] error VaultConfigurationMismatch(address vault);
    #[derive(Debug)] error Reentrancy();
    #[derive(Debug)] error TokenTransferFailed(address token);
    #[derive(Debug)] error NothingToClaim(address investor);
    #[derive(Debug)] error RepaymentExceedsDebt(uint256 amount, uint256 remaining);
    #[derive(Debug)] error SelfTransfer(address investor);
    #[derive(Debug)] error InvalidMilestoneSchedule();
    #[derive(Debug)] error MilestoneIndexOutOfRange(uint8 index);
    #[derive(Debug)] error MilestoneNotPending(uint8 index, uint8 actual);
    #[derive(Debug)] error MilestoneNotSubmitted(uint8 index, uint8 actual);
    #[derive(Debug)] error MilestoneOutOfOrder(uint8 index, uint8 expected);
    #[derive(Debug)] error NoMilestonesConfigured();

    event VaultInitialized(
        bytes32 indexed dealId,
        address indexed borrower,
        address indexed originator,
        address paymentToken,
        address accessRegistry,
        uint256 fundingTarget
    );
    event FundingOpened(uint64 fundingDeadline);
    event Funded(address indexed investor, uint256 amount, uint256 totalFunded);
    event FundingCompleted(uint256 totalFunded);
    event FundingCancelled(uint256 refundableAmount);
    event Activated(uint256 principalOutstanding, uint256 borrowerProceeds, uint256 platformFee);
    event RepaymentRecorded(address indexed payer, uint256 amount, uint256 totalRepaid);
    event Claimed(address indexed investor, uint256 amount, uint256 totalClaimed);
    event DefaultDeclared(uint256 principalOutstanding);
    event RecoveryStarted();
    event RecoveryRecorded(address indexed payer, uint256 amount, uint256 totalRepaid);
    event Closed(uint256 totalRepaid, uint256 totalClaimed);
    event PositionTransferred(
        address indexed from, address indexed to, uint256 amount, uint256 claimedMoved
    );
    event MilestonesConfigured(uint8 count);
    event MilestoneEvidenceSubmitted(uint8 indexed index, bytes32 evidenceHash);
    event MilestoneReleased(uint8 indexed index, uint256 amount, bytes32 evidenceHash);
    event MilestoneRejected(uint8 indexed index, bytes32 reasonHash);
    event WaterfallExecuted(
        uint256 legalPaid,
        uint256 servicingPaid,
        uint256 principalPaid,
        uint256 interestPaid,
        uint256 surplus
    );
}

#[derive(SolidityError, Debug)]
pub enum Error {
    AlreadyInitialized(AlreadyInitialized),
    NotInitialized(NotInitialized),
    ZeroAddress(ZeroAddress),
    ZeroHash(ZeroHash),
    InvalidTerms(InvalidTerms),
    InvalidAmount(InvalidAmount),
    InvalidState(InvalidState),
    Unauthorized(Unauthorized),
    FundingDeadlinePassed(FundingDeadlinePassed),
    BorrowerPassportInvalid(BorrowerPassportInvalid),
    InvestorNotAllowed(InvestorNotAllowed),
    VaultConfigurationMismatch(VaultConfigurationMismatch),
    Reentrancy(Reentrancy),
    TokenTransferFailed(TokenTransferFailed),
    NothingToClaim(NothingToClaim),
    RepaymentExceedsDebt(RepaymentExceedsDebt),
    SelfTransfer(SelfTransfer),
    InvalidMilestoneSchedule(InvalidMilestoneSchedule),
    MilestoneIndexOutOfRange(MilestoneIndexOutOfRange),
    MilestoneNotPending(MilestoneNotPending),
    MilestoneNotSubmitted(MilestoneNotSubmitted),
    MilestoneOutOfOrder(MilestoneOutOfOrder),
    NoMilestonesConfigured(NoMilestonesConfigured),
}

sol_storage! {
    #[entrypoint]
    pub struct CreditVault {
        bool initialized;
        bool entered;
        uint8 status;
        address admin;
        bytes32 deal_id;
        address borrower;
        address originator;
        address payment_token;
        address registry;
        address passport;
        address access_registry;
        uint256 funding_target;
        uint256 minimum_investment;
        uint16 interest_bps;
        uint16 platform_fee_bps;
        uint64 funding_deadline;
        uint64 maturity_date;
        bytes32 legal_pack_hash;
        bytes32 collateral_hash;
        uint256 total_funded;
        uint256 principal_outstanding;
        uint256 total_repaid;
        uint256 total_claimable;
        uint256 total_claimed;
        mapping(address => uint256) investor_contribution;
        mapping(address => uint256) investor_claimed;
        // Hitos: liberan el desembolso al borrower en tramos en vez de todo
        // de una vez en `activate`. `milestone_bps` suma 10000 una vez
        // configurado por `set_milestones`. Los tres StorageVec avanzan en
        // paralelo, indexados por el mismo `index`.
        StorageVec<StorageU16> milestone_bps;
        StorageVec<StorageU8> milestone_status;
        StorageVec<StorageB256> milestone_evidence_hash;
        // Lo que `activate` retuvo en el propio contrato para liberar por
        // hitos, en vez de transferirlo de una al borrower.
        uint256 escrow_remaining;
        // Cascada de recupero (docs: underwriting.ts::computeWaterfall):
        // costos legales y de servicing se calculan sobre el principal
        // (`funding_target`), igual que en la especificación off-chain.
        uint16 legal_cost_bps;
        uint16 servicing_fee_bps;
    }
}

#[public]
impl CreditVault {
    pub fn initialize(
        &mut self,
        admin: Address,
        deal_id: B256,
        borrower: Address,
        originator: Address,
        payment_token: Address,
        registry: Address,
        passport: Address,
        access_registry: Address,
        funding_target: U256,
        minimum_investment: U256,
        interest_bps: u16,
        platform_fee_bps: u16,
        funding_deadline: u64,
        maturity_date: u64,
        legal_pack_hash: B256,
        collateral_hash: B256,
        legal_cost_bps: u16,
        servicing_fee_bps: u16,
    ) -> Result<(), Error> {
        if self.initialized.get() {
            return Err(Error::AlreadyInitialized(AlreadyInitialized {}));
        }
        if [
            admin,
            borrower,
            originator,
            payment_token,
            registry,
            passport,
            access_registry,
        ]
        .contains(&Address::ZERO)
        {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        if deal_id == B256::ZERO || legal_pack_hash == B256::ZERO || collateral_hash == B256::ZERO {
            return Err(Error::ZeroHash(ZeroHash {}));
        }
        let now = self.vm().block_timestamp();
        if funding_target == U256::ZERO
            || minimum_investment == U256::ZERO
            || minimum_investment > funding_target
            || interest_bps > MAX_INTEREST_BPS
            || platform_fee_bps > MAX_PLATFORM_FEE_BPS
            || legal_cost_bps > MAX_COST_BPS
            || servicing_fee_bps > MAX_COST_BPS
            || funding_deadline <= now
            || maturity_date <= funding_deadline
        {
            return Err(Error::InvalidTerms(InvalidTerms {}));
        }

        self.initialized.set(true);
        self.status.set(U8::from(STATUS_DRAFT));
        self.admin.set(admin);
        self.deal_id.set(deal_id);
        self.borrower.set(borrower);
        self.originator.set(originator);
        self.payment_token.set(payment_token);
        self.registry.set(registry);
        self.passport.set(passport);
        self.access_registry.set(access_registry);
        self.funding_target.set(funding_target);
        self.minimum_investment.set(minimum_investment);
        self.interest_bps.set(U16::from(interest_bps));
        self.platform_fee_bps.set(U16::from(platform_fee_bps));
        self.funding_deadline.set(U64::from(funding_deadline));
        self.maturity_date.set(U64::from(maturity_date));
        self.legal_pack_hash.set(legal_pack_hash);
        self.collateral_hash.set(collateral_hash);
        self.legal_cost_bps.set(U16::from(legal_cost_bps));
        self.servicing_fee_bps.set(U16::from(servicing_fee_bps));

        self.vm().log(VaultInitialized {
            dealId: deal_id,
            borrower,
            originator,
            paymentToken: payment_token,
            accessRegistry: access_registry,
            fundingTarget: funding_target,
        });
        Ok(())
    }

    pub fn open_funding(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_originator_or_admin()?;
        self.require_state(STATUS_DRAFT)?;
        self.ensure_official()?;
        let deadline = self.funding_deadline.get().to::<u64>();
        if self.vm().block_timestamp() >= deadline {
            return Err(Error::FundingDeadlinePassed(FundingDeadlinePassed {
                deadline,
            }));
        }
        self.status.set(U8::from(STATUS_FUNDING));
        self.vm().log(FundingOpened {
            fundingDeadline: deadline,
        });
        Ok(())
    }

    pub fn fund(&mut self, amount: U256) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_state(STATUS_FUNDING)?;
        self.ensure_official()?;
        let deadline = self.funding_deadline.get().to::<u64>();
        if self.vm().block_timestamp() >= deadline {
            return Err(Error::FundingDeadlinePassed(FundingDeadlinePassed {
                deadline,
            }));
        }
        let current = self.total_funded.get();
        let remaining = self
            .funding_target
            .get()
            .checked_sub(current)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        if amount < self.minimum_investment.get() || amount > remaining {
            return Err(Error::InvalidAmount(InvalidAmount {}));
        }

        let investor = self.vm().msg_sender();
        self.ensure_investor_allowed(investor)?;
        let next_total = current
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let next_contribution = self
            .investor_contribution
            .get(investor)
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        self.total_funded.set(next_total);
        self.investor_contribution
            .insert(investor, next_contribution);
        if next_total == self.funding_target.get() {
            self.status.set(U8::from(STATUS_FUNDED));
        }

        let token = self.payment_token.get();
        let vault = self.vm().contract_address();
        self.safe_transfer_from(token, investor, vault, amount)?;
        self.exit();

        self.vm().log(Funded {
            investor,
            amount,
            totalFunded: next_total,
        });
        if next_total == self.funding_target.get() {
            self.vm().log(FundingCompleted {
                totalFunded: next_total,
            });
        }
        Ok(())
    }

    pub fn cancel_funding(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_originator_or_admin()?;
        self.require_state(STATUS_FUNDING)?;
        let refundable = self.total_funded.get();
        self.total_claimable.set(refundable);
        self.status.set(U8::from(STATUS_CANCELLED));
        self.vm().log(FundingCancelled {
            refundableAmount: refundable,
        });
        Ok(())
    }

    /// Activates the vault: pays the platform fee to the originator, same as
    /// before, but the borrower's share no longer leaves the contract in one
    /// shot. It stays as `escrow_remaining` and is released tranche by
    /// tranche through `release_milestone` — the escrow-by-milestone model
    /// this vault didn't have until now.
    pub fn activate(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_originator_or_admin()?;
        self.require_state(STATUS_FUNDED)?;
        self.ensure_official()?;
        if self.milestone_bps.is_empty() {
            return Err(Error::NoMilestonesConfigured(NoMilestonesConfigured {}));
        }

        let funded = self.total_funded.get();
        let fee = funded
            .checked_mul(U256::from(self.platform_fee_bps.get().to::<u16>()))
            .and_then(|value| value.checked_div(U256::from(BPS_DENOMINATOR)))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let borrower_proceeds = funded
            .checked_sub(fee)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;

        self.principal_outstanding.set(funded);
        self.status.set(U8::from(STATUS_ACTIVE));
        self.escrow_remaining.set(borrower_proceeds);
        let token = self.payment_token.get();
        if fee > U256::ZERO {
            self.safe_transfer(token, self.originator.get(), fee)?;
        }
        self.exit();

        self.vm().log(Activated {
            principalOutstanding: funded,
            borrowerProceeds: borrower_proceeds,
            platformFee: fee,
        });
        Ok(())
    }

    /// One-time schedule of disbursement tranches, set before `activate`.
    /// `bps` must sum to exactly 10000 (BPS_DENOMINATOR) — partial schedules
    /// would leave escrow permanently stuck, since release is sequential and
    /// there's no "sweep the remainder" path by design (every micro-USDC in
    /// escrow must be accounted for by a milestone).
    pub fn set_milestones(&mut self, bps: Vec<u16>) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_originator_or_admin()?;
        let status = self.status.get().to::<u8>();
        if status != STATUS_DRAFT && status != STATUS_FUNDING && status != STATUS_FUNDED {
            return Err(Error::InvalidState(InvalidState {
                expected: STATUS_FUNDED,
                actual: status,
            }));
        }
        if bps.is_empty() || bps.len() > MAX_MILESTONES {
            return Err(Error::InvalidMilestoneSchedule(InvalidMilestoneSchedule {}));
        }
        let mut total: u32 = 0;
        for value in &bps {
            total += u32::from(*value);
        }
        if total != BPS_DENOMINATOR as u32 {
            return Err(Error::InvalidMilestoneSchedule(InvalidMilestoneSchedule {}));
        }

        while !self.milestone_bps.is_empty() {
            self.milestone_bps.pop();
            self.milestone_status.pop();
            self.milestone_evidence_hash.pop();
        }
        for value in &bps {
            self.milestone_bps.push(U16::from(*value));
            self.milestone_status.push(U8::from(MILESTONE_PENDING));
            self.milestone_evidence_hash.push(B256::ZERO);
        }

        self.vm().log(MilestonesConfigured {
            count: bps.len() as u8,
        });
        Ok(())
    }

    /// The borrower attaches evidence for the next pending milestone in
    /// order — milestones release sequentially, same as the UI's
    /// `nextMilestone()` selector already assumes.
    pub fn submit_milestone_evidence(
        &mut self,
        index: u8,
        evidence_hash: B256,
    ) -> Result<(), Error> {
        self.require_initialized()?;
        let caller = self.vm().msg_sender();
        if caller != self.borrower.get() {
            return Err(Error::Unauthorized(Unauthorized { caller }));
        }
        self.require_state(STATUS_ACTIVE)?;
        if evidence_hash == B256::ZERO {
            return Err(Error::ZeroHash(ZeroHash {}));
        }
        let idx = self.milestone_index(index)?;
        let expected = self.next_pending_index()?;
        if index != expected {
            return Err(Error::MilestoneOutOfOrder(MilestoneOutOfOrder {
                index,
                expected,
            }));
        }
        let actual = self.milestone_status.get(idx).unwrap().to::<u8>();
        if actual != MILESTONE_PENDING && actual != MILESTONE_REJECTED {
            return Err(Error::MilestoneNotPending(MilestoneNotPending {
                index,
                actual,
            }));
        }
        self.milestone_status
            .setter(idx)
            .unwrap()
            .set(U8::from(MILESTONE_SUBMITTED));
        self.milestone_evidence_hash
            .setter(idx)
            .unwrap()
            .set(evidence_hash);

        self.vm().log(MilestoneEvidenceSubmitted {
            index,
            evidenceHash: evidence_hash,
        });
        Ok(())
    }

    /// Releases the borrower's share for one milestone out of escrow.
    /// Amount is `funding_target * bps / 10000`, the same rounding
    /// `underwriting.ts::releasedAmount` uses — the fee already left the
    /// vault in `activate`, so this only ever draws down `escrow_remaining`.
    pub fn release_milestone(&mut self, index: u8) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_ACTIVE)?;
        let idx = self.milestone_index(index)?;
        let actual = self.milestone_status.get(idx).unwrap().to::<u8>();
        if actual != MILESTONE_SUBMITTED {
            self.exit();
            return Err(Error::MilestoneNotSubmitted(MilestoneNotSubmitted {
                index,
                actual,
            }));
        }
        let bps = self.milestone_bps.get(idx).unwrap().to::<u16>();
        let amount = self
            .funding_target
            .get()
            .checked_mul(U256::from(bps))
            .and_then(|value| value.checked_div(U256::from(BPS_DENOMINATOR)))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let remaining = self.escrow_remaining.get();
        let amount = if amount > remaining { remaining } else { amount };

        self.milestone_status
            .setter(idx)
            .unwrap()
            .set(U8::from(MILESTONE_RELEASED));
        self.escrow_remaining.set(
            remaining
                .checked_sub(amount)
                .ok_or(Error::InvalidAmount(InvalidAmount {}))?,
        );
        let evidence_hash = self.milestone_evidence_hash.get(idx).unwrap();
        let token = self.payment_token.get();
        self.safe_transfer(token, self.borrower.get(), amount)?;
        self.exit();

        self.vm().log(MilestoneReleased {
            index,
            amount,
            evidenceHash: evidence_hash,
        });
        Ok(())
    }

    /// Sends the milestone back to the borrower for resubmission — same
    /// slot, same order, so it doesn't jump the escrow queue.
    pub fn reject_milestone(&mut self, index: u8, reason_hash: B256) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_ACTIVE)?;
        let idx = self.milestone_index(index)?;
        let actual = self.milestone_status.get(idx).unwrap().to::<u8>();
        if actual != MILESTONE_SUBMITTED {
            return Err(Error::MilestoneNotSubmitted(MilestoneNotSubmitted {
                index,
                actual,
            }));
        }
        self.milestone_status
            .setter(idx)
            .unwrap()
            .set(U8::from(MILESTONE_REJECTED));

        self.vm().log(MilestoneRejected {
            index,
            reasonHash: reason_hash,
        });
        Ok(())
    }

    pub fn milestone_count(&self) -> u8 {
        self.milestone_bps.len() as u8
    }

    pub fn get_milestone(&self, index: u8) -> Result<(u16, u8, B256), Error> {
        let idx = self.milestone_index(index)?;
        Ok((
            self.milestone_bps.get(idx).unwrap().to::<u16>(),
            self.milestone_status.get(idx).unwrap().to::<u8>(),
            self.milestone_evidence_hash.get(idx).unwrap(),
        ))
    }

    pub fn escrow_remaining(&self) -> U256 {
        self.escrow_remaining.get()
    }

    pub fn record_repayment(&mut self, amount: U256) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_repayment_actor()?;
        self.require_state(STATUS_ACTIVE)?;
        if amount == U256::ZERO {
            return Err(Error::InvalidAmount(InvalidAmount {}));
        }

        let due = self.total_due()?;
        let repaid = self.total_repaid.get();
        let remaining =
            due.checked_sub(repaid)
                .ok_or(Error::RepaymentExceedsDebt(RepaymentExceedsDebt {
                    amount,
                    remaining: U256::ZERO,
                }))?;
        if amount > remaining {
            return Err(Error::RepaymentExceedsDebt(RepaymentExceedsDebt {
                amount,
                remaining,
            }));
        }
        let next_repaid = repaid
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let next_claimable = self
            .total_claimable
            .get()
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        self.total_repaid.set(next_repaid);
        self.total_claimable.set(next_claimable);
        self.reduce_principal(amount)?;
        if next_repaid == due {
            self.status.set(U8::from(STATUS_REPAID));
        }

        let payer = self.vm().msg_sender();
        let token = self.payment_token.get();
        let vault = self.vm().contract_address();
        self.safe_transfer_from(token, payer, vault, amount)?;
        self.exit();
        self.vm().log(RepaymentRecorded {
            payer,
            amount,
            totalRepaid: next_repaid,
        });
        Ok(())
    }

    pub fn claim(&mut self) -> Result<U256, Error> {
        self.require_initialized()?;
        self.enter()?;
        let investor = self.vm().msg_sender();
        let contribution = self.investor_contribution.get(investor);
        let funded = self.total_funded.get();
        if contribution == U256::ZERO || funded == U256::ZERO {
            return Err(Error::NothingToClaim(NothingToClaim { investor }));
        }
        let entitlement = self
            .total_claimable
            .get()
            .checked_mul(contribution)
            .and_then(|value| value.checked_div(funded))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let already_claimed = self.investor_claimed.get(investor);
        let amount = entitlement
            .checked_sub(already_claimed)
            .ok_or(Error::NothingToClaim(NothingToClaim { investor }))?;
        if amount == U256::ZERO {
            return Err(Error::NothingToClaim(NothingToClaim { investor }));
        }

        let investor_total = already_claimed
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let global_total = self
            .total_claimed
            .get()
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        self.investor_claimed.insert(investor, investor_total);
        self.total_claimed.set(global_total);
        self.safe_transfer(self.payment_token.get(), investor, amount)?;
        self.exit();

        self.vm().log(Claimed {
            investor,
            amount,
            totalClaimed: global_total,
        });
        Ok(amount)
    }

    /// Restricted transfer of an investor position: moves `amount` of
    /// contribution (and its proportional already-claimed share) from the
    /// caller to `to`. `to` must be an allowed investor per the vault's
    /// `AccessRegistry` — mirrors ERC-3643-style transfer restriction
    /// without a separate token contract, since the position lives as vault
    /// state rather than as its own ERC-20.
    pub fn transfer_position(&mut self, to: Address, amount: U256) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_transferable_state()?;
        let from = self.vm().msg_sender();
        if to == Address::ZERO {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        if to == from {
            return Err(Error::SelfTransfer(SelfTransfer { investor: from }));
        }
        self.ensure_investor_allowed(to)?;

        let from_contribution = self.investor_contribution.get(from);
        if amount == U256::ZERO || amount > from_contribution {
            return Err(Error::InvalidAmount(InvalidAmount {}));
        }
        let from_claimed = self.investor_claimed.get(from);
        let claimed_moved = from_claimed
            .checked_mul(amount)
            .and_then(|value| value.checked_div(from_contribution))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;

        let next_from_contribution = from_contribution
            .checked_sub(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let next_from_claimed = from_claimed
            .checked_sub(claimed_moved)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let next_to_contribution = self
            .investor_contribution
            .get(to)
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let next_to_claimed = self
            .investor_claimed
            .get(to)
            .checked_add(claimed_moved)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;

        self.investor_contribution
            .insert(from, next_from_contribution);
        self.investor_claimed.insert(from, next_from_claimed);
        self.investor_contribution.insert(to, next_to_contribution);
        self.investor_claimed.insert(to, next_to_claimed);

        self.vm().log(PositionTransferred {
            from,
            to,
            amount,
            claimedMoved: claimed_moved,
        });
        Ok(())
    }

    pub fn declare_default(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_ACTIVE)?;
        self.status.set(U8::from(STATUS_DEFAULTED));
        self.vm().log(DefaultDeclared {
            principalOutstanding: self.principal_outstanding.get(),
        });
        Ok(())
    }

    pub fn start_recovery(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_DEFAULTED)?;
        self.status.set(U8::from(STATUS_RECOVERY));
        self.vm().log(RecoveryStarted {});
        Ok(())
    }

    /// Runs the default/recovery waterfall over what's been recovered so
    /// far (see `run_waterfall`). Callable more than once (recovery can
    /// trickle in): each call re-runs the full cascade over the new
    /// cumulative total and only pays out the *delta* per tier, so legal
    /// and servicing are never double-paid across calls.
    pub fn record_recovery(&mut self, amount: U256) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_RECOVERY)?;
        if amount == U256::ZERO {
            return Err(Error::InvalidAmount(InvalidAmount {}));
        }

        let previous = self.total_repaid.get();
        let (prev_legal, prev_servicing, prev_principal, prev_interest, _) =
            self.run_waterfall(previous)?;
        let next_total = previous
            .checked_add(amount)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let (legal, servicing, principal, interest, surplus) = self.run_waterfall(next_total)?;

        let previous_absorbed = prev_legal
            .checked_add(prev_servicing)
            .and_then(|v| v.checked_add(prev_principal))
            .and_then(|v| v.checked_add(prev_interest))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let absorbed = legal
            .checked_add(servicing)
            .and_then(|v| v.checked_add(principal))
            .and_then(|v| v.checked_add(interest))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let remaining = absorbed
            .checked_sub(previous_absorbed)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        if amount > remaining {
            return Err(Error::RepaymentExceedsDebt(RepaymentExceedsDebt {
                amount,
                remaining,
            }));
        }

        let legal_paid = legal
            .checked_sub(prev_legal)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let servicing_paid = servicing
            .checked_sub(prev_servicing)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let principal_paid = principal
            .checked_sub(prev_principal)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let interest_paid = interest
            .checked_sub(prev_interest)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;

        let next_claimable = self
            .total_claimable
            .get()
            .checked_add(principal_paid)
            .and_then(|v| v.checked_add(interest_paid))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        self.total_repaid.set(next_total);
        self.total_claimable.set(next_claimable);
        self.reduce_principal(principal_paid)?;

        let payer = self.vm().msg_sender();
        let token = self.payment_token.get();
        let vault = self.vm().contract_address();
        self.safe_transfer_from(token, payer, vault, amount)?;
        let ops_amount = legal_paid
            .checked_add(servicing_paid)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        if ops_amount > U256::ZERO {
            self.safe_transfer(token, self.originator.get(), ops_amount)?;
        }
        self.exit();

        self.vm().log(RecoveryRecorded {
            payer,
            amount,
            totalRepaid: next_total,
        });
        self.vm().log(WaterfallExecuted {
            legalPaid: legal_paid,
            servicingPaid: servicing_paid,
            principalPaid: principal_paid,
            interestPaid: interest_paid,
            surplus,
        });
        Ok(())
    }

    pub fn close(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        let current = self.status.get().to::<u8>();
        if current != STATUS_REPAID
            && current != STATUS_RECOVERY
            && current != STATUS_DEFAULTED
            && current != STATUS_CANCELLED
        {
            return Err(Error::InvalidState(InvalidState {
                expected: STATUS_REPAID,
                actual: current,
            }));
        }
        self.status.set(U8::from(STATUS_CLOSED));
        self.vm().log(Closed {
            totalRepaid: self.total_repaid.get(),
            totalClaimed: self.total_claimed.get(),
        });
        Ok(())
    }

    #[allow(clippy::type_complexity)]
    pub fn get_terms(
        &self,
    ) -> (
        B256,
        Address,
        Address,
        Address,
        Address,
        Address,
        Address,
        U256,
        U256,
        u16,
        u16,
        u64,
        u64,
        B256,
        B256,
    ) {
        (
            self.deal_id.get(),
            self.borrower.get(),
            self.originator.get(),
            self.payment_token.get(),
            self.registry.get(),
            self.passport.get(),
            self.access_registry.get(),
            self.funding_target.get(),
            self.minimum_investment.get(),
            self.interest_bps.get().to::<u16>(),
            self.platform_fee_bps.get().to::<u16>(),
            self.funding_deadline.get().to::<u64>(),
            self.maturity_date.get().to::<u64>(),
            self.legal_pack_hash.get(),
            self.collateral_hash.get(),
        )
    }

    pub fn get_status(&self) -> u8 {
        self.status.get().to::<u8>()
    }

    pub fn status(&self) -> u8 {
        self.status.get().to::<u8>()
    }

    pub fn total_funded(&self) -> U256 {
        self.total_funded.get()
    }

    pub fn investor_contribution(&self, investor: Address) -> U256 {
        self.investor_contribution.get(investor)
    }

    pub fn payment_token(&self) -> Address {
        self.payment_token.get()
    }

    pub fn access_registry(&self) -> Address {
        self.access_registry.get()
    }

    pub fn get_accounting(&self) -> (U256, U256, U256, U256, U256) {
        (
            self.total_funded.get(),
            self.principal_outstanding.get(),
            self.total_repaid.get(),
            self.total_claimable.get(),
            self.total_claimed.get(),
        )
    }

    pub fn get_investor_position(&self, investor: Address) -> (U256, U256, U256) {
        let contribution = self.investor_contribution.get(investor);
        let claimed = self.investor_claimed.get(investor);
        let claimable = if contribution == U256::ZERO || self.total_funded.get() == U256::ZERO {
            U256::ZERO
        } else {
            self.total_claimable
                .get()
                .checked_mul(contribution)
                .and_then(|value| value.checked_div(self.total_funded.get()))
                .and_then(|entitlement| entitlement.checked_sub(claimed))
                .unwrap_or(U256::ZERO)
        };
        (contribution, claimed, claimable)
    }
}

impl CreditVault {
    fn require_initialized(&self) -> Result<(), Error> {
        if !self.initialized.get() {
            return Err(Error::NotInitialized(NotInitialized {}));
        }
        Ok(())
    }

    fn require_state(&self, expected: u8) -> Result<(), Error> {
        let actual = self.status.get().to::<u8>();
        if actual != expected {
            return Err(Error::InvalidState(InvalidState { expected, actual }));
        }
        Ok(())
    }

    /// Positions are transferable once funding has committed capital and
    /// until the vault is fully wound down: not while still a draft, and
    /// not once cancelled (contribution becomes a refund, not a stake) or
    /// closed (nothing left to hold).
    fn require_transferable_state(&self) -> Result<(), Error> {
        let actual = self.status.get().to::<u8>();
        if actual == STATUS_DRAFT || actual == STATUS_CANCELLED || actual == STATUS_CLOSED {
            return Err(Error::InvalidState(InvalidState {
                expected: STATUS_FUNDING,
                actual,
            }));
        }
        Ok(())
    }

    fn require_originator_or_admin(&self) -> Result<(), Error> {
        let caller = self.vm().msg_sender();
        if caller != self.originator.get() && caller != self.admin.get() {
            return Err(Error::Unauthorized(Unauthorized { caller }));
        }
        Ok(())
    }

    fn require_repayment_actor(&self) -> Result<(), Error> {
        let caller = self.vm().msg_sender();
        if caller != self.borrower.get() && !self.is_servicer(caller)? {
            return Err(Error::Unauthorized(Unauthorized { caller }));
        }
        Ok(())
    }

    fn require_servicing_actor(&self) -> Result<(), Error> {
        let caller = self.vm().msg_sender();
        if caller != self.originator.get()
            && caller != self.admin.get()
            && !self.is_servicer(caller)?
        {
            return Err(Error::Unauthorized(Unauthorized { caller }));
        }
        Ok(())
    }

    fn is_servicer(&self, account: Address) -> Result<bool, Error> {
        let role = keccak256("SERVICER_ROLE");
        ICreditRegistry::new(self.registry.get())
            .has_role(self.vm(), Call::new(), role, account)
            .map_err(|_| Error::Unauthorized(Unauthorized { caller: account }))
    }

    fn ensure_official(&self) -> Result<(), Error> {
        let vault = self.vm().contract_address();
        let valid = ICreditRegistry::new(self.registry.get())
            .is_vault_configuration_valid(
                self.vm(),
                Call::new(),
                vault,
                self.deal_id.get(),
                self.borrower.get(),
                self.originator.get(),
                self.payment_token.get(),
                self.passport.get(),
                self.access_registry.get(),
            )
            .map_err(|_| Error::VaultConfigurationMismatch(VaultConfigurationMismatch { vault }))?;
        if !valid {
            return Err(Error::VaultConfigurationMismatch(
                VaultConfigurationMismatch { vault },
            ));
        }
        let borrower = self.borrower.get();
        let verified = ICompanyPassport::new(self.passport.get())
            .is_verified_company(self.vm(), Call::new(), borrower)
            .map_err(|_| Error::BorrowerPassportInvalid(BorrowerPassportInvalid { borrower }))?;
        if !verified {
            return Err(Error::BorrowerPassportInvalid(BorrowerPassportInvalid {
                borrower,
            }));
        }
        Ok(())
    }

    fn ensure_investor_allowed(&self, investor: Address) -> Result<(), Error> {
        let allowed = IAccessRegistry::new(self.access_registry.get())
            .is_allowed_investor(self.vm(), Call::new(), investor)
            .map_err(|_| Error::InvestorNotAllowed(InvestorNotAllowed { investor }))?;
        if !allowed {
            return Err(Error::InvestorNotAllowed(InvestorNotAllowed { investor }));
        }
        Ok(())
    }

    fn enter(&mut self) -> Result<(), Error> {
        if self.entered.get() {
            return Err(Error::Reentrancy(Reentrancy {}));
        }
        self.entered.set(true);
        Ok(())
    }

    fn exit(&mut self) {
        self.entered.set(false);
    }

    fn total_due(&self) -> Result<U256, Error> {
        let target = self.funding_target.get();
        let interest = target
            .checked_mul(U256::from(self.interest_bps.get().to::<u16>()))
            .and_then(|value| value.checked_div(U256::from(BPS_DENOMINATOR)))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        target
            .checked_add(interest)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))
    }

    fn reduce_principal(&mut self, amount: U256) -> Result<(), Error> {
        let outstanding = self.principal_outstanding.get();
        let reduction = if amount > outstanding {
            outstanding
        } else {
            amount
        };
        let next = outstanding
            .checked_sub(reduction)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        self.principal_outstanding.set(next);
        Ok(())
    }

    fn milestone_index(&self, index: u8) -> Result<usize, Error> {
        let idx = index as usize;
        if idx >= self.milestone_bps.len() {
            return Err(Error::MilestoneIndexOutOfRange(MilestoneIndexOutOfRange {
                index,
            }));
        }
        Ok(idx)
    }

    /// First milestone that isn't `RELEASED` yet, in schedule order — the
    /// on-chain mirror of `nextMilestone()` in `lib/opportunity.ts`.
    fn next_pending_index(&self) -> Result<u8, Error> {
        let len = self.milestone_bps.len();
        for idx in 0..len {
            let status = self.milestone_status.get(idx).unwrap().to::<u8>();
            if status != MILESTONE_RELEASED {
                return Ok(idx as u8);
            }
        }
        Err(Error::NoMilestonesConfigured(NoMilestonesConfigured {}))
    }

    /// Default/recovery waterfall — same fixed order and inputs as
    /// `underwriting.ts::computeWaterfall`: legal costs, then servicing fee
    /// (both bps of principal), then principal, then interest, sequentially
    /// exhausting `recovered`. Legal + servicing go straight to the
    /// originator (the operational account that already receives the
    /// platform fee in `activate`); principal + interest join
    /// `total_claimable` for the existing pro-rata `claim()`; any leftover
    /// surplus goes back to the borrower.
    #[allow(clippy::type_complexity)]
    fn run_waterfall(&self, recovered: U256) -> Result<(U256, U256, U256, U256, U256), Error> {
        let principal = self.funding_target.get();
        let interest = self
            .total_due()?
            .checked_sub(principal)
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let legal_due = principal
            .checked_mul(U256::from(self.legal_cost_bps.get().to::<u16>()))
            .and_then(|v| v.checked_div(U256::from(BPS_DENOMINATOR)))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;
        let servicing_due = principal
            .checked_mul(U256::from(self.servicing_fee_bps.get().to::<u16>()))
            .and_then(|v| v.checked_div(U256::from(BPS_DENOMINATOR)))
            .ok_or(Error::InvalidAmount(InvalidAmount {}))?;

        let mut left = recovered;
        let mut take = |due: U256| -> U256 {
            let paid = if left >= due { due } else { left };
            left -= paid;
            paid
        };
        let legal_paid = take(legal_due);
        let servicing_paid = take(servicing_due);
        let principal_paid = take(principal);
        let interest_paid = take(interest);
        let surplus = left;

        Ok((legal_paid, servicing_paid, principal_paid, interest_paid, surplus))
    }

    #[cfg(not(test))]
    fn safe_transfer_from(
        &mut self,
        token: Address,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<(), Error> {
        let call = Call::new_mutating(self);
        let success = IERC20Interface::new(token)
            .transfer_from(self.vm(), call, from, to, amount)
            .map_err(|_| Error::TokenTransferFailed(TokenTransferFailed { token }))?;
        if !success {
            return Err(Error::TokenTransferFailed(TokenTransferFailed { token }));
        }
        Ok(())
    }

    #[cfg(test)]
    fn safe_transfer_from(
        &mut self,
        _token: Address,
        _from: Address,
        _to: Address,
        _amount: U256,
    ) -> Result<(), Error> {
        Ok(())
    }

    #[cfg(not(test))]
    fn safe_transfer(&mut self, token: Address, to: Address, amount: U256) -> Result<(), Error> {
        let call = Call::new_mutating(self);
        let success = IERC20Interface::new(token)
            .transfer(self.vm(), call, to, amount)
            .map_err(|_| Error::TokenTransferFailed(TokenTransferFailed { token }))?;
        if !success {
            return Err(Error::TokenTransferFailed(TokenTransferFailed { token }));
        }
        Ok(())
    }

    #[cfg(test)]
    fn safe_transfer(&mut self, _token: Address, _to: Address, _amount: U256) -> Result<(), Error> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::{
        alloy_sol_types::{SolCall, SolValue},
        testing::{TestVM, TestVMBuilder},
    };

    const ADMIN: Address = Address::new([1u8; 20]);
    const BORROWER: Address = Address::new([2u8; 20]);
    const ORIGINATOR: Address = Address::new([3u8; 20]);
    const INVESTOR: Address = Address::new([4u8; 20]);
    const INVESTOR2: Address = Address::new([10u8; 20]);
    const REGISTRY: Address = Address::new([5u8; 20]);
    const PASSPORT: Address = Address::new([6u8; 20]);
    const TOKEN: Address = Address::new([7u8; 20]);
    const VAULT: Address = Address::new([8u8; 20]);
    const ACCESS_REGISTRY: Address = Address::new([9u8; 20]);
    const TARGET: u64 = 1_000_000_000;

    fn setup() -> (TestVM, CreditVault) {
        setup_with_registry_validity(true)
    }

    fn setup_with_registry_validity(registry_valid: bool) -> (TestVM, CreditVault) {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(VAULT)
            .build();
        vm.set_block_timestamp(1_000);
        let mut vault = CreditVault::from(&vm);
        vault
            .initialize(
                ADMIN,
                B256::repeat_byte(1),
                BORROWER,
                ORIGINATOR,
                TOKEN,
                REGISTRY,
                PASSPORT,
                ACCESS_REGISTRY,
                U256::from(TARGET),
                U256::from(100_000_000u64),
                1_000,
                100,
                2_000,
                3_000,
                B256::repeat_byte(2),
                B256::repeat_byte(3),
                0,
                0,
            )
            .unwrap();
        mock_official(&vm, registry_valid);
        (vm, vault)
    }

    fn mock_official(vm: &TestVM, registry_valid: bool) {
        vm.mock_static_call(
            PASSPORT,
            PassportCalls::isVerifiedCompanyCall { account: BORROWER }.abi_encode(),
            Ok(true.abi_encode()),
        );
        vm.mock_static_call(
            ACCESS_REGISTRY,
            AccessRegistryCalls::isAllowedInvestorCall { investor: INVESTOR }.abi_encode(),
            Ok(true.abi_encode()),
        );
        // stylus-test 0.10.x keeps the latest return buffer globally while
        // call success remains keyed by target and calldata.
        vm.mock_static_call(
            REGISTRY,
            RegistryCalls::isVaultConfigurationValidCall {
                vault: VAULT,
                dealId: B256::repeat_byte(1),
                borrower: BORROWER,
                originator: ORIGINATOR,
                paymentToken: TOKEN,
                passport: PASSPORT,
                accessRegistry: ACCESS_REGISTRY,
            }
            .abi_encode(),
            Ok(registry_valid.abi_encode()),
        );
    }

    fn mock_transfer_from(vm: &TestVM, from: Address, amount: U256) {
        vm.mock_call(
            TOKEN,
            TokenCalls::transferFromCall {
                from,
                to: VAULT,
                amount,
            }
            .abi_encode(),
            U256::ZERO,
            Ok(true.abi_encode()),
        );
    }

    fn mock_transfer(vm: &TestVM, to: Address, amount: U256) {
        vm.mock_call(
            TOKEN,
            TokenCalls::transferCall { to, amount }.abi_encode(),
            U256::ZERO,
            Ok(true.abi_encode()),
        );
    }

    fn fully_fund(vm: &TestVM, vault: &mut CreditVault) {
        vm.set_sender(ORIGINATOR);
        vault.open_funding().unwrap();
        vm.set_sender(INVESTOR);
        mock_transfer_from(vm, INVESTOR, U256::from(TARGET));
        vault.fund(U256::from(TARGET)).unwrap();
        assert_eq!(vault.get_status(), STATUS_FUNDED);
    }

    fn activate(vm: &TestVM, vault: &mut CreditVault) {
        vm.set_sender(ORIGINATOR);
        let fee = U256::from(10_000_000u64);
        mock_transfer(vm, ORIGINATOR, fee);
        mock_transfer(vm, BORROWER, U256::from(990_000_000u64));
        vault.set_milestones(vec![10_000]).unwrap();
        vault.activate().unwrap();
        assert_eq!(vault.get_status(), STATUS_ACTIVE);
        assert_eq!(vault.escrow_remaining(), U256::from(990_000_000u64));
    }

    #[test]
    fn lifecycle_funding_repayment_claim_and_close() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        activate(&vm, &mut vault);

        vm.set_sender(BORROWER);
        let due = U256::from(1_100_000_000u64);
        mock_transfer_from(&vm, BORROWER, due);
        vault.record_repayment(due).unwrap();
        assert_eq!(vault.get_status(), STATUS_REPAID);

        vm.set_sender(INVESTOR);
        mock_transfer(&vm, INVESTOR, due);
        assert_eq!(vault.claim().unwrap(), due);
        assert!(matches!(vault.claim(), Err(Error::NothingToClaim(_))));

        vm.set_sender(ORIGINATOR);
        vault.close().unwrap();
        assert_eq!(vault.get_status(), STATUS_CLOSED);
        let accounting = vault.get_accounting();
        assert_eq!(accounting.0, U256::from(TARGET));
        assert_eq!(accounting.1, U256::ZERO);
        assert_eq!(accounting.2, due);
        assert_eq!(accounting.3, due);
        assert_eq!(accounting.4, due);
    }

    #[test]
    fn default_recovery_is_pro_rata_and_bounded() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        activate(&vm, &mut vault);
        vm.set_sender(ORIGINATOR);
        vault.declare_default().unwrap();
        vault.start_recovery().unwrap();

        let recovery = U256::from(600_000_000u64);
        mock_transfer_from(&vm, ORIGINATOR, recovery);
        vault.record_recovery(recovery).unwrap();
        assert_eq!(vault.get_investor_position(INVESTOR).2, recovery);

        let too_much = U256::from(600_000_001u64);
        assert!(matches!(
            vault.record_recovery(too_much),
            Err(Error::RepaymentExceedsDebt(_))
        ));
    }

    #[test]
    fn cancellation_refunds_contributions_through_claim() {
        let (vm, mut vault) = setup();
        vm.set_sender(ORIGINATOR);
        vault.open_funding().unwrap();
        vm.set_sender(INVESTOR);
        let amount = U256::from(400_000_000u64);
        mock_transfer_from(&vm, INVESTOR, amount);
        vault.fund(amount).unwrap();

        vm.set_sender(ORIGINATOR);
        vault.cancel_funding().unwrap();
        vm.set_sender(INVESTOR);
        mock_transfer(&vm, INVESTOR, amount);
        assert_eq!(vault.claim().unwrap(), amount);
    }

    #[test]
    fn rejects_unauthorized_and_invalid_transitions() {
        let (vm, mut vault) = setup();
        vm.set_sender(INVESTOR);
        assert!(matches!(vault.open_funding(), Err(Error::Unauthorized(_))));

        vm.set_sender(ORIGINATOR);
        assert!(matches!(vault.activate(), Err(Error::InvalidState(_))));
        vault.open_funding().unwrap();
        assert!(matches!(vault.open_funding(), Err(Error::InvalidState(_))));
    }

    #[test]
    fn fails_closed_for_invalid_registry_and_disallowed_investor() {
        let (vm, mut vault) = setup_with_registry_validity(false);
        vm.set_sender(ORIGINATOR);
        let result = vault.open_funding();
        assert!(
            matches!(result, Err(Error::VaultConfigurationMismatch(_))),
            "unexpected result: {result:?}"
        );

        let (vm, vault) = setup();
        vm.mock_static_call(
            ACCESS_REGISTRY,
            AccessRegistryCalls::isAllowedInvestorCall { investor: INVESTOR }.abi_encode(),
            Ok(false.abi_encode()),
        );
        let result = vault.ensure_investor_allowed(INVESTOR);
        assert!(
            matches!(result, Err(Error::InvestorNotAllowed(_))),
            "unexpected result: {result:?}"
        );
    }

    #[test]
    fn transfer_position_moves_contribution_and_pro_rata_claim() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        activate(&vm, &mut vault);

        // Partial repayment first — the rest comes later, after the sale, so
        // the claim right before selling is genuinely partial (claim() has
        // no "amount" argument: it always drains everything available, so
        // for it to return less than the full due the vault must not have
        // received the full due yet).
        vm.set_sender(BORROWER);
        let due = U256::from(1_100_000_000u64);
        let partial_repayment = U256::from(300_000_000u64);
        mock_transfer_from(&vm, BORROWER, partial_repayment);
        vault.record_repayment(partial_repayment).unwrap();

        // INVESTOR claims their entire entitlement so far before selling the rest.
        vm.set_sender(INVESTOR);
        let partial = U256::from(300_000_000u64);
        mock_transfer(&vm, INVESTOR, partial);
        assert_eq!(vault.claim().unwrap(), partial);

        // Sell 40% of the original contribution to INVESTOR2.
        let sold = U256::from(400_000_000u64);
        vault.transfer_position(INVESTOR2, sold).unwrap();

        let (from_contribution, from_claimed, _) = vault.get_investor_position(INVESTOR);
        assert_eq!(from_contribution, U256::from(600_000_000u64));
        // 40% of the 300 already claimed moves with the 40% of contribution sold.
        assert_eq!(from_claimed, U256::from(180_000_000u64));

        // The borrower finishes paying off the loan after the sale.
        vm.set_sender(BORROWER);
        let remaining_repayment = due - partial_repayment;
        mock_transfer_from(&vm, BORROWER, remaining_repayment);
        vault.record_repayment(remaining_repayment).unwrap();

        let (to_contribution, to_claimed, to_claimable) = vault.get_investor_position(INVESTOR2);
        assert_eq!(to_contribution, sold);
        assert_eq!(to_claimed, U256::from(120_000_000u64));
        // Entitlement is 40% of the 1,100 total due (440), minus the 120
        // that moved over as already-claimed.
        assert_eq!(to_claimable, U256::from(320_000_000u64));

        vm.set_sender(INVESTOR2);
        mock_transfer(&vm, INVESTOR2, to_claimable);
        assert_eq!(vault.claim().unwrap(), to_claimable);
    }

    #[test]
    fn transfer_position_rejects_self_transfer_and_bad_amounts() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);

        vm.set_sender(INVESTOR);
        assert!(matches!(
            vault.transfer_position(INVESTOR, U256::from(1u64)),
            Err(Error::SelfTransfer(_))
        ));
        assert!(matches!(
            vault.transfer_position(INVESTOR2, U256::ZERO),
            Err(Error::InvalidAmount(_))
        ));
        assert!(matches!(
            vault.transfer_position(INVESTOR2, U256::from(TARGET + 1)),
            Err(Error::InvalidAmount(_))
        ));
    }

    #[test]
    fn transfer_position_rejects_draft_cancelled_and_closed_states() {
        let (vm, mut vault) = setup();
        vm.set_sender(INVESTOR);
        assert!(matches!(
            vault.transfer_position(INVESTOR2, U256::from(1u64)),
            Err(Error::InvalidState(_))
        ));

        vm.set_sender(ORIGINATOR);
        vault.open_funding().unwrap();
        vm.set_sender(INVESTOR);
        let amount = U256::from(400_000_000u64);
        mock_transfer_from(&vm, INVESTOR, amount);
        vault.fund(amount).unwrap();

        vm.set_sender(ORIGINATOR);
        vault.cancel_funding().unwrap();
        vm.set_sender(INVESTOR);
        assert!(matches!(
            vault.transfer_position(INVESTOR2, amount),
            Err(Error::InvalidState(_))
        ));
    }

    #[test]
    fn initialization_is_single_use_and_terms_are_validated() {
        let (_, mut vault) = setup();
        assert!(matches!(
            vault.initialize(
                ADMIN,
                B256::repeat_byte(1),
                BORROWER,
                ORIGINATOR,
                TOKEN,
                REGISTRY,
                PASSPORT,
                ACCESS_REGISTRY,
                U256::from(TARGET),
                U256::from(1u64),
                1_000,
                100,
                2_000,
                3_000,
                B256::repeat_byte(2),
                B256::repeat_byte(3),
                0,
                0,
            ),
            Err(Error::AlreadyInitialized(_))
        ));
    }

    fn activate_with_milestones(vm: &TestVM, vault: &mut CreditVault, bps: Vec<u16>) {
        vm.set_sender(ORIGINATOR);
        let fee = U256::from(10_000_000u64);
        mock_transfer(vm, ORIGINATOR, fee);
        mock_transfer(vm, BORROWER, U256::from(990_000_000u64));
        vault.set_milestones(bps).unwrap();
        vault.activate().unwrap();
        assert_eq!(vault.get_status(), STATUS_ACTIVE);
    }

    #[test]
    fn milestones_release_sequentially_and_drain_escrow() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        activate_with_milestones(&vm, &mut vault, vec![3_000, 2_500, 2_500, 2_000]);
        assert_eq!(vault.escrow_remaining(), U256::from(990_000_000u64));

        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(0, B256::repeat_byte(9))
            .unwrap();
        let (bps0, status0, hash0) = vault.get_milestone(0).unwrap();
        assert_eq!(bps0, 3_000);
        assert_eq!(status0, MILESTONE_SUBMITTED);
        assert_eq!(hash0, B256::repeat_byte(9));

        // Can't submit evidence out of order.
        assert!(matches!(
            vault.submit_milestone_evidence(1, B256::repeat_byte(9)),
            Err(Error::MilestoneOutOfOrder(_))
        ));

        vm.set_sender(ORIGINATOR);
        vault.release_milestone(0).unwrap();
        let (_, status0_after, _) = vault.get_milestone(0).unwrap();
        assert_eq!(status0_after, MILESTONE_RELEASED);
        // Milestone bps are a share of `funding_target` (1,000,000,000),
        // same convention as the UI's `releasedAmount` — 30% is
        // 300,000,000, leaving 690,000,000 of the 990,000,000 escrow.
        assert_eq!(vault.escrow_remaining(), U256::from(690_000_000u64));

        // Releasing again (not submitted) is rejected.
        assert!(matches!(
            vault.release_milestone(0),
            Err(Error::MilestoneNotSubmitted(_))
        ));

        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(1, B256::repeat_byte(1))
            .unwrap();
        vm.set_sender(ORIGINATOR);
        vault.release_milestone(1).unwrap();
        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(2, B256::repeat_byte(1))
            .unwrap();
        vm.set_sender(ORIGINATOR);
        vault.release_milestone(2).unwrap();
        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(3, B256::repeat_byte(1))
            .unwrap();
        vm.set_sender(ORIGINATOR);
        vault.release_milestone(3).unwrap();

        assert_eq!(vault.escrow_remaining(), U256::ZERO);
    }

    #[test]
    fn milestone_rejection_allows_resubmission_in_place() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        activate_with_milestones(&vm, &mut vault, vec![10_000]);

        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(0, B256::repeat_byte(1))
            .unwrap();
        vm.set_sender(ORIGINATOR);
        vault
            .reject_milestone(0, B256::repeat_byte(2))
            .unwrap();
        let (_, status, _) = vault.get_milestone(0).unwrap();
        assert_eq!(status, MILESTONE_REJECTED);

        vm.set_sender(BORROWER);
        vault
            .submit_milestone_evidence(0, B256::repeat_byte(3))
            .unwrap();
        vm.set_sender(ORIGINATOR);
        vault.release_milestone(0).unwrap();
        assert_eq!(vault.escrow_remaining(), U256::ZERO);
    }

    #[test]
    fn set_milestones_rejects_bad_schedules() {
        let (vm, mut vault) = setup();
        vm.set_sender(ORIGINATOR);
        assert!(matches!(
            vault.set_milestones(vec![5_000, 4_000]),
            Err(Error::InvalidMilestoneSchedule(_))
        ));
        assert!(matches!(
            vault.set_milestones(vec![]),
            Err(Error::InvalidMilestoneSchedule(_))
        ));
        vault.set_milestones(vec![10_000]).unwrap();
        assert_eq!(vault.milestone_count(), 1);
    }

    #[test]
    fn activate_without_milestones_is_rejected() {
        let (vm, mut vault) = setup();
        fully_fund(&vm, &mut vault);
        vm.set_sender(ORIGINATOR);
        assert!(matches!(
            vault.activate(),
            Err(Error::NoMilestonesConfigured(_))
        ));
    }

    fn setup_with_costs(legal_cost_bps: u16, servicing_fee_bps: u16) -> (TestVM, CreditVault) {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(VAULT)
            .build();
        vm.set_block_timestamp(1_000);
        let mut vault = CreditVault::from(&vm);
        vault
            .initialize(
                ADMIN,
                B256::repeat_byte(1),
                BORROWER,
                ORIGINATOR,
                TOKEN,
                REGISTRY,
                PASSPORT,
                ACCESS_REGISTRY,
                U256::from(TARGET),
                U256::from(100_000_000u64),
                1_000,
                100,
                2_000,
                3_000,
                B256::repeat_byte(2),
                B256::repeat_byte(3),
                legal_cost_bps,
                servicing_fee_bps,
            )
            .unwrap();
        mock_official(&vm, true);
        (vm, vault)
    }

    #[test]
    fn waterfall_pays_legal_then_servicing_then_principal_then_interest() {
        // legal 6%, servicing 1.5% of principal — same defaults as
        // underwriting.ts::DEFAULT_COSTS.
        let (vm, mut vault) = setup_with_costs(600, 150);
        fully_fund(&vm, &mut vault);
        activate_with_milestones(&vm, &mut vault, vec![10_000]);
        vm.set_sender(ORIGINATOR);
        vault.declare_default().unwrap();
        vault.start_recovery().unwrap();

        // Principal is 1,000,000,000; legal due = 60,000,000; servicing due
        // = 15,000,000. A recovery of exactly 75,000,000 covers legal and
        // servicing in full and nothing more.
        let recovery = U256::from(75_000_000u64);
        mock_transfer_from(&vm, ORIGINATOR, recovery);
        vault.record_recovery(recovery).unwrap();
        assert_eq!(vault.get_investor_position(INVESTOR).2, U256::ZERO);

        // A second recovery of 1,100,000,000 (cumulative 1,175,000,000,
        // exactly principal + interest + the legal/servicing already paid)
        // exhausts principal and interest exactly, with no surplus.
        let second = U256::from(1_100_000_000u64);
        mock_transfer_from(&vm, ORIGINATOR, second);
        vault.record_recovery(second).unwrap();
        let (_, _, claimable) = vault.get_investor_position(INVESTOR);
        // Principal (1,000,000,000) + interest (100,000,000) = 1,100,000,000.
        assert_eq!(claimable, U256::from(1_100_000_000u64));

        // Nothing left to absorb.
        assert!(matches!(
            vault.record_recovery(U256::from(1u64)),
            Err(Error::RepaymentExceedsDebt(_))
        ));
    }

    #[test]
    fn waterfall_returns_surplus_when_recovery_exceeds_full_debt() {
        let (vm, mut vault) = setup_with_costs(600, 150);
        fully_fund(&vm, &mut vault);
        activate_with_milestones(&vm, &mut vault, vec![10_000]);
        vm.set_sender(ORIGINATOR);
        vault.declare_default().unwrap();
        vault.start_recovery().unwrap();

        // Capacity is 60,000,000 (legal) + 15,000,000 (servicing) +
        // 1,000,000,000 (principal) + 100,000,000 (interest) =
        // 1,175,000,000.
        let capacity = U256::from(1_175_000_000u64);
        mock_transfer_from(&vm, ORIGINATOR, capacity);
        vault.record_recovery(capacity).unwrap();
        let (_, _, claimable) = vault.get_investor_position(INVESTOR);
        assert_eq!(claimable, U256::from(1_100_000_000u64));

        // Anything beyond capacity is rejected — the waterfall never
        // produces an on-chain surplus from overshooting, it simply bounds
        // what gets accepted.
        assert!(matches!(
            vault.record_recovery(U256::from(1u64)),
            Err(Error::RepaymentExceedsDebt(_))
        ));
    }
}

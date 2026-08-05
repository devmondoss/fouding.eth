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
    stylus_core::log,
};

#[cfg(not(test))]
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

sol_interface! {
    interface ICreditRegistry {
        function isVaultRegistered(address vault) external view returns (bool);
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
        function isVaultRegistered(address vault) external view returns (bool);
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
    #[derive(Debug)] error VaultNotRegistered(address vault);
    #[derive(Debug)] error BorrowerPassportInvalid(address borrower);
    #[derive(Debug)] error InvestorNotAllowed(address investor);
    #[derive(Debug)] error VaultConfigurationMismatch(address vault);
    #[derive(Debug)] error Reentrancy();
    #[derive(Debug)] error TokenTransferFailed(address token);
    #[derive(Debug)] error NothingToClaim(address investor);
    #[derive(Debug)] error RepaymentExceedsDebt(uint256 amount, uint256 remaining);

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
    VaultNotRegistered(VaultNotRegistered),
    BorrowerPassportInvalid(BorrowerPassportInvalid),
    InvestorNotAllowed(InvestorNotAllowed),
    VaultConfigurationMismatch(VaultConfigurationMismatch),
    Reentrancy(Reentrancy),
    TokenTransferFailed(TokenTransferFailed),
    NothingToClaim(NothingToClaim),
    RepaymentExceedsDebt(RepaymentExceedsDebt),
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

        log(
            self.vm(),
            VaultInitialized {
                dealId: deal_id,
                borrower,
                originator,
                paymentToken: payment_token,
                accessRegistry: access_registry,
                fundingTarget: funding_target,
            },
        );
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
        log(
            self.vm(),
            FundingOpened {
                fundingDeadline: deadline,
            },
        );
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

        log(
            self.vm(),
            Funded {
                investor,
                amount,
                totalFunded: next_total,
            },
        );
        if next_total == self.funding_target.get() {
            log(
                self.vm(),
                FundingCompleted {
                    totalFunded: next_total,
                },
            );
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
        log(
            self.vm(),
            FundingCancelled {
                refundableAmount: refundable,
            },
        );
        Ok(())
    }

    pub fn activate(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_originator_or_admin()?;
        self.require_state(STATUS_FUNDED)?;
        self.ensure_official()?;

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
        let token = self.payment_token.get();
        if fee > U256::ZERO {
            self.safe_transfer(token, self.originator.get(), fee)?;
        }
        self.safe_transfer(token, self.borrower.get(), borrower_proceeds)?;
        self.exit();

        log(
            self.vm(),
            Activated {
                principalOutstanding: funded,
                borrowerProceeds: borrower_proceeds,
                platformFee: fee,
            },
        );
        Ok(())
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
        log(
            self.vm(),
            RepaymentRecorded {
                payer,
                amount,
                totalRepaid: next_repaid,
            },
        );
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

        log(
            self.vm(),
            Claimed {
                investor,
                amount,
                totalClaimed: global_total,
            },
        );
        Ok(amount)
    }

    pub fn declare_default(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_ACTIVE)?;
        self.status.set(U8::from(STATUS_DEFAULTED));
        log(
            self.vm(),
            DefaultDeclared {
                principalOutstanding: self.principal_outstanding.get(),
            },
        );
        Ok(())
    }

    pub fn start_recovery(&mut self) -> Result<(), Error> {
        self.require_initialized()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_DEFAULTED)?;
        self.status.set(U8::from(STATUS_RECOVERY));
        log(self.vm(), RecoveryStarted {});
        Ok(())
    }

    pub fn record_recovery(&mut self, amount: U256) -> Result<(), Error> {
        self.require_initialized()?;
        self.enter()?;
        self.require_servicing_actor()?;
        self.require_state(STATUS_RECOVERY)?;
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

        let payer = self.vm().msg_sender();
        self.safe_transfer_from(
            self.payment_token.get(),
            payer,
            self.vm().contract_address(),
            amount,
        )?;
        self.exit();
        log(
            self.vm(),
            RecoveryRecorded {
                payer,
                amount,
                totalRepaid: next_repaid,
            },
        );
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
        log(
            self.vm(),
            Closed {
                totalRepaid: self.total_repaid.get(),
                totalClaimed: self.total_claimed.get(),
            },
        );
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

    #[cfg(not(test))]
    fn is_servicer(&self, account: Address) -> Result<bool, Error> {
        let role = keccak256("SERVICER_ROLE");
        ICreditRegistry::new(self.registry.get())
            .has_role(self, role, account)
            .map_err(|_| Error::Unauthorized(Unauthorized { caller: account }))
    }

    #[cfg(test)]
    fn is_servicer(&self, _account: Address) -> Result<bool, Error> {
        Ok(false)
    }

    #[cfg(not(test))]
    fn ensure_official(&self) -> Result<(), Error> {
        let vault = self.vm().contract_address();
        let valid = ICreditRegistry::new(self.registry.get())
            .is_vault_configuration_valid(
                self,
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
            .is_verified_company(self, borrower)
            .map_err(|_| Error::BorrowerPassportInvalid(BorrowerPassportInvalid { borrower }))?;
        if !verified {
            return Err(Error::BorrowerPassportInvalid(BorrowerPassportInvalid {
                borrower,
            }));
        }
        Ok(())
    }

    #[cfg(test)]
    fn ensure_official(&self) -> Result<(), Error> {
        Ok(())
    }

    #[cfg(not(test))]
    fn ensure_investor_allowed(&self, investor: Address) -> Result<(), Error> {
        let allowed = IAccessRegistry::new(self.access_registry.get())
            .is_allowed_investor(self, investor)
            .map_err(|_| Error::InvestorNotAllowed(InvestorNotAllowed { investor }))?;
        if !allowed {
            return Err(Error::InvestorNotAllowed(InvestorNotAllowed { investor }));
        }
        Ok(())
    }

    #[cfg(test)]
    fn ensure_investor_allowed(&self, _investor: Address) -> Result<(), Error> {
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

    #[cfg(not(test))]
    fn safe_transfer_from(
        &mut self,
        token: Address,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<(), Error> {
        let success = IERC20Interface::new(token)
            .transfer_from(&mut *self, from, to, amount)
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
        let success = IERC20Interface::new(token)
            .transfer(&mut *self, to, amount)
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
    const REGISTRY: Address = Address::new([5u8; 20]);
    const PASSPORT: Address = Address::new([6u8; 20]);
    const TOKEN: Address = Address::new([7u8; 20]);
    const VAULT: Address = Address::new([8u8; 20]);
    const ACCESS_REGISTRY: Address = Address::new([9u8; 20]);
    const TARGET: u64 = 1_000_000_000;

    fn setup() -> (TestVM, CreditVault) {
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
            )
            .unwrap();
        mock_official(&vm);
        (vm, vault)
    }

    fn mock_official(vm: &TestVM) {
        vm.mock_static_call(
            REGISTRY,
            RegistryCalls::isVaultRegisteredCall { vault: VAULT }.abi_encode(),
            Ok(true.abi_encode()),
        );
        vm.mock_static_call(
            PASSPORT,
            PassportCalls::isVerifiedCompanyCall { account: BORROWER }.abi_encode(),
            Ok(true.abi_encode()),
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
            Ok(true.abi_encode()),
        );
    }

    fn mock_transfer(vm: &TestVM, to: Address, amount: U256) {
        vm.mock_call(
            TOKEN,
            TokenCalls::transferCall { to, amount }.abi_encode(),
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
        vault.activate().unwrap();
        assert_eq!(vault.get_status(), STATUS_ACTIVE);
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
            ),
            Err(Error::AlreadyInitialized(_))
        ));
    }
}

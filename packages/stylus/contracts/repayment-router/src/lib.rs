//! Fouding RepaymentRouter: the validated repayment entrypoint.
//!
//! Receives Circle USDC repayments from borrowers or authorized servicers,
//! validates them against an approved CreditVault, prevents duplicate
//! repayment references and routes the funds into the vault while emitting
//! an auditable servicing trail.
//!
//! The router is a distinct Stylus contract. It complements CreditVault
//! accounting and never re-accounts a repayment on its own: the canonical
//! books always live in the vault. The platform fee is an origination fee
//! charged by `CreditVault::activate` (see `platform_fee_bps`); this router
//! does not charge anything and must never double-charge a repayment.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

use stylus_sdk::{
    alloy_primitives::{keccak256, Address, B256, U256},
    alloy_sol_types::{sol, SolCall},
    prelude::*,
};

sol_interface! {
    interface IERC20Router {
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function approve(address spender, uint256 amount) external returns (bool);
    }

    interface IVaultRepayment {
        function payment_token() external view returns (address);
        function record_repayment(uint256 amount) external;
    }
}

// Calldata types for TestVM mocks (sol_interface does not expose *Call types).
sol! {
    interface RouterTokenCalls {
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function approve(address spender, uint256 amount) external returns (bool);
    }

    interface RouterVaultCalls {
        function payment_token() external view returns (address);
        function record_repayment(uint256 amount) external;
    }
}

sol! {
    #[derive(Debug)] error AlreadyInitialized();
    #[derive(Debug)] error NotInitialized();
    #[derive(Debug)] error ZeroAddress();
    #[derive(Debug)] error ZeroAmount();
    #[derive(Debug)] error Unauthorized(address caller);
    #[derive(Debug)] error UnsupportedToken(address token);
    #[derive(Debug)] error VaultNotApproved(address vault);
    #[derive(Debug)] error RepaymentAlreadyProcessed(bytes32 repaymentId);
    #[derive(Debug)] error InvalidRepaymentBreakdown();
    #[derive(Debug)] error TransferFailed(address token);
    #[derive(Debug)] error VaultCallFailed(address vault);
    #[derive(Debug)] error Reentrancy();

    event RepaymentProcessed(
        bytes32 indexed repaymentId,
        address indexed vault,
        address indexed payer,
        uint256 amount,
        uint256 principal,
        uint256 interest,
        uint64 timestamp
    );
}

#[derive(SolidityError, Debug)]
pub enum Error {
    AlreadyInitialized(AlreadyInitialized),
    NotInitialized(NotInitialized),
    ZeroAddress(ZeroAddress),
    ZeroAmount(ZeroAmount),
    Unauthorized(Unauthorized),
    UnsupportedToken(UnsupportedToken),
    VaultNotApproved(VaultNotApproved),
    RepaymentAlreadyProcessed(RepaymentAlreadyProcessed),
    InvalidRepaymentBreakdown(InvalidRepaymentBreakdown),
    TransferFailed(TransferFailed),
    VaultCallFailed(VaultCallFailed),
    Reentrancy(Reentrancy),
}

sol_storage! {
    #[entrypoint]
    pub struct RepaymentRouter {
        bool initialized;
        bool entered;
        address token;
        address admin;
        mapping(address => bool) approved_vaults;
        // Keyed by keccak256(vault, repayment_id) so one id namespace cannot
        // collide across different vaults.
        mapping(bytes32 => bool) processed;
    }
}

#[public]
impl RepaymentRouter {
    /// One-time configuration. The caller becomes the admin.
    pub fn initialize(&mut self, token: Address) -> Result<(), Error> {
        if self.initialized.get() {
            return Err(Error::AlreadyInitialized(AlreadyInitialized {}));
        }
        if token == Address::ZERO {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        self.initialized.set(true);
        self.token.set(token);
        self.admin.set(self.vm().msg_sender());
        Ok(())
    }

    pub fn set_admin(&mut self, new_admin: Address) -> Result<(), Error> {
        self.require_admin()?;
        if new_admin == Address::ZERO {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        self.admin.set(new_admin);
        Ok(())
    }

    /// Approve or remove a vault the router is allowed to route repayments to.
    pub fn set_vault_approved(&mut self, vault: Address, approved: bool) -> Result<(), Error> {
        self.require_admin()?;
        if vault == Address::ZERO {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        self.approved_vaults.insert(vault, approved);
        Ok(())
    }

    /// Route a validated repayment into an approved CreditVault.
    ///
    /// The caller pays `amount` in the router's canonical token. The router
    /// briefly intermediates custody because CreditVault pulls repayments
    /// from its immediate caller (`msg.sender`); the vault performs the
    /// canonical accounting and emits its own `RepaymentRecorded` event.
    ///
    /// `principal` and `interest` are the payer's breakdown of the payment;
    /// their sum must equal `amount`. The router does not reinterpret the
    /// vault's internal accounting (which is total-due based).
    pub fn record_repayment(
        &mut self,
        vault: Address,
        repayment_id: B256,
        amount: U256,
        principal: U256,
        interest: U256,
    ) -> Result<(), Error> {
        if !self.initialized.get() {
            return Err(Error::NotInitialized(NotInitialized {}));
        }
        self.enter()?;
        if vault == Address::ZERO {
            return Err(Error::ZeroAddress(ZeroAddress {}));
        }
        if !self.approved_vaults.get(vault) {
            return Err(Error::VaultNotApproved(VaultNotApproved { vault }));
        }
        let key = repayment_key(vault, repayment_id);
        if self.processed.get(key) {
            return Err(Error::RepaymentAlreadyProcessed(
                RepaymentAlreadyProcessed { repaymentId: repayment_id },
            ));
        }
        if amount == U256::ZERO {
            return Err(Error::ZeroAmount(ZeroAmount {}));
        }
        let breakdown = principal
            .checked_add(interest)
            .ok_or(Error::InvalidRepaymentBreakdown(InvalidRepaymentBreakdown {}))?;
        if breakdown != amount {
            return Err(Error::InvalidRepaymentBreakdown(
                InvalidRepaymentBreakdown {},
            ));
        }

        let token = self.token.get();
        let vault_token = IVaultRepayment::new(vault)
            .payment_token(self.vm(), Call::new())
            .map_err(|_| Error::VaultCallFailed(VaultCallFailed { vault }))?;
        if vault_token != token {
            return Err(Error::UnsupportedToken(UnsupportedToken {
                token: vault_token,
            }));
        }

        let payer = self.vm().msg_sender();

        // The reentrancy guard (`self.enter`) blocks re-entry during the
        // external calls below, so the duplicate-reference key can safely be
        // committed only after those calls succeed. If any external call
        // fails the function returns an error and the runtime reverts the
        // whole transaction, leaving the key unset.
        self.safe_transfer_from(token, payer, self.vm().contract_address(), amount)?;
        self.safe_approve(token, vault, amount)?;

        let calldata = RouterVaultCalls::record_repaymentCall { amount }.abi_encode();
        unsafe {
            RawCall::new(self.vm())
                .skip_return_data()
                .call(vault, &calldata)
                .map_err(|_| Error::VaultCallFailed(VaultCallFailed { vault }))?;
        }

        self.processed.insert(key, true);

        self.exit();
        self.vm().log(RepaymentProcessed {
            repaymentId: repayment_id,
            vault,
            payer,
            amount,
            principal,
            interest,
            timestamp: self.vm().block_timestamp(),
        });
        Ok(())
    }

    pub fn token(&self) -> Address {
        self.token.get()
    }

    pub fn admin(&self) -> Address {
        self.admin.get()
    }

    pub fn is_vault_approved(&self, vault: Address) -> bool {
        self.approved_vaults.get(vault)
    }

    pub fn is_repayment_processed(&self, vault: Address, repayment_id: B256) -> bool {
        self.processed.get(repayment_key(vault, repayment_id))
    }
}

impl RepaymentRouter {
    fn require_admin(&self) -> Result<(), Error> {
        if !self.initialized.get() {
            return Err(Error::NotInitialized(NotInitialized {}));
        }
        let caller = self.vm().msg_sender();
        if caller != self.admin.get() {
            return Err(Error::Unauthorized(Unauthorized { caller }));
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

    fn safe_transfer_from(
        &mut self,
        token: Address,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<(), Error> {
        let call = Call::new_mutating(self);
        let success = IERC20Router::new(token)
            .transfer_from(self.vm(), call, from, to, amount)
            .map_err(|_| Error::TransferFailed(TransferFailed { token }))?;
        if !success {
            return Err(Error::TransferFailed(TransferFailed { token }));
        }
        Ok(())
    }

    fn safe_approve(&mut self, token: Address, spender: Address, amount: U256) -> Result<(), Error> {
        let call = Call::new_mutating(self);
        let success = IERC20Router::new(token)
            .approve(self.vm(), call, spender, amount)
            .map_err(|_| Error::TransferFailed(TransferFailed { token }))?;
        if !success {
            return Err(Error::TransferFailed(TransferFailed { token }));
        }
        Ok(())
    }
}

fn repayment_key(vault: Address, repayment_id: B256) -> B256 {
    let mut bytes = [0u8; 52];
    bytes[..20].copy_from_slice(vault.as_slice());
    bytes[20..].copy_from_slice(repayment_id.as_slice());
    keccak256(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::{
        alloy_sol_types::{SolCall, SolValue},
        testing::{TestVM, TestVMBuilder},
    };

    const ADMIN: Address = Address::new([1u8; 20]);
    const PAYER: Address = Address::new([2u8; 20]);
    const VAULT: Address = Address::new([3u8; 20]);
    const OTHER_VAULT: Address = Address::new([4u8; 20]);
    // Address 0x...01 encodes to a 32-byte word whose value is also `true`
    // for bool decodes. stylus-test 0.10.x keeps a single global return
    // buffer (the last mock registered) that every mocked call reads, so all
    // mocks in one flow must return the same bytes; this token satisfies
    // address (payment_token) and bool (transferFrom/approve) reads at once.
    const TOKEN: Address = Address::new([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
    const WRONG_TOKEN: Address = Address::new([6u8; 20]);
    const ROUTER: Address = Address::new([7u8; 20]);

    fn setup() -> (TestVM, RepaymentRouter) {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(ROUTER)
            .build();
        vm.set_block_timestamp(1_000);
        let mut router = RepaymentRouter::from(&vm);
        router.initialize(TOKEN).unwrap();
        router.set_vault_approved(VAULT, true).unwrap();
        (vm, router)
    }

    fn mock_vault_token(vm: &TestVM, token: Address) {
        vm.mock_static_call(
            VAULT,
            RouterVaultCalls::payment_tokenCall {}.abi_encode(),
            Ok(token.abi_encode()),
        );
    }

    fn mock_transfer_from(vm: &TestVM, amount: U256) {
        vm.mock_call(
            TOKEN,
            RouterTokenCalls::transferFromCall {
                from: PAYER,
                to: ROUTER,
                amount,
            }
            .abi_encode(),
            U256::ZERO,
            Ok(true.abi_encode()),
        );
    }

    fn mock_transfer_from_failure(vm: &TestVM, amount: U256) {
        vm.mock_call(
            TOKEN,
            RouterTokenCalls::transferFromCall {
                from: PAYER,
                to: ROUTER,
                amount,
            }
            .abi_encode(),
            U256::ZERO,
            Err(vec![]),
        );
    }

    fn mock_approve(vm: &TestVM, amount: U256) {
        vm.mock_call(
            TOKEN,
            RouterTokenCalls::approveCall {
                spender: VAULT,
                amount,
            }
            .abi_encode(),
            U256::ZERO,
            Ok(true.abi_encode()),
        );
    }

    fn mock_vault_repayment(vm: &TestVM, amount: U256, result: Result<Vec<u8>, Vec<u8>>) {
        vm.mock_call(
            VAULT,
            RouterVaultCalls::record_repaymentCall { amount }.abi_encode(),
            U256::ZERO,
            result,
        );
    }

    fn happy_path_mocks(vm: &TestVM, amount: U256) {
        mock_vault_repayment(vm, amount, Ok(vec![]));
        mock_transfer_from(vm, amount);
        mock_approve(vm, amount);
        mock_vault_token(vm, TOKEN);
    }

    #[test]
    fn initialization_sets_token_and_admin() {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(ROUTER)
            .build();
        let mut router = RepaymentRouter::from(&vm);
        router.initialize(TOKEN).unwrap();
        assert_eq!(router.token(), TOKEN);
        assert_eq!(router.admin(), ADMIN);
    }

    #[test]
    fn double_initialization_is_rejected() {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(ROUTER)
            .build();
        let mut router = RepaymentRouter::from(&vm);
        router.initialize(TOKEN).unwrap();
        assert!(matches!(
            router.initialize(TOKEN),
            Err(Error::AlreadyInitialized(_))
        ));
    }

    #[test]
    fn zero_address_token_is_rejected() {
        let vm = TestVMBuilder::new()
            .sender(ADMIN)
            .contract_address(ROUTER)
            .build();
        let mut router = RepaymentRouter::from(&vm);
        assert!(matches!(
            router.initialize(Address::ZERO),
            Err(Error::ZeroAddress(_))
        ));
    }

    #[test]
    fn approved_vault_accepted_unapproved_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        happy_path_mocks(&vm, U256::from(100u64));
        let ok = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            U256::from(100u64),
            U256::from(100u64),
            U256::from(0u64),
        );
        assert!(ok.is_ok(), "approved vault should be accepted: {ok:?}");
    }

    #[test]
    fn unapproved_vault_is_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        let result = router.record_repayment(
            OTHER_VAULT,
            B256::repeat_byte(9),
            U256::from(100u64),
            U256::from(100u64),
            U256::from(0u64),
        );
        assert!(matches!(
            result,
            Err(Error::VaultNotApproved(_))
        ));
    }

    #[test]
    fn valid_repayment_is_routed_and_recorded() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        let amount = U256::from(500_000_000u64);
        happy_path_mocks(&vm, amount);
        router
            .record_repayment(
                VAULT,
                B256::repeat_byte(9),
                amount,
                U256::from(400_000_000u64),
                U256::from(100_000_000u64),
            )
            .unwrap();
        assert!(router.is_repayment_processed(VAULT, B256::repeat_byte(9)));
        assert!(!router.is_repayment_processed(OTHER_VAULT, B256::repeat_byte(9)));
    }

    #[test]
    fn zero_amount_is_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        mock_vault_token(&vm, TOKEN);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            U256::ZERO,
            U256::ZERO,
            U256::ZERO,
        );
        assert!(matches!(result, Err(Error::ZeroAmount(_))));
    }

    #[test]
    fn duplicate_repayment_id_is_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        let amount = U256::from(100u64);
        happy_path_mocks(&vm, amount);
        router
            .record_repayment(
                VAULT,
                B256::repeat_byte(9),
                amount,
                amount,
                U256::ZERO,
            )
            .unwrap();
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            amount,
            amount,
            U256::ZERO,
        );
        assert!(matches!(
            result,
            Err(Error::RepaymentAlreadyProcessed(_))
        ));
    }

    #[test]
    fn invalid_breakdown_is_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        mock_vault_token(&vm, TOKEN);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            U256::from(100u64),
            U256::from(90u64),
            U256::from(90u64),
        );
        assert!(matches!(
            result,
            Err(Error::InvalidRepaymentBreakdown(_))
        ));
    }

    #[test]
    fn mismatched_vault_token_is_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        mock_vault_token(&vm, WRONG_TOKEN);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            U256::from(100u64),
            U256::from(100u64),
            U256::from(0u64),
        );
        assert!(matches!(result, Err(Error::UnsupportedToken(_))));
    }

    #[test]
    fn transfer_failure_rolls_back_and_does_not_mark_processed() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        let amount = U256::from(100u64);
        mock_transfer_from_failure(&vm, amount);
        mock_vault_token(&vm, TOKEN);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            amount,
            amount,
            U256::ZERO,
        );
        assert!(matches!(result, Err(Error::TransferFailed(_))));
        assert!(!router.is_repayment_processed(VAULT, B256::repeat_byte(9)));
    }

    #[test]
    fn vault_call_failure_rolls_back_atomically() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        let amount = U256::from(100u64);
        mock_vault_repayment(&vm, amount, Err(vec![]));
        mock_transfer_from(&vm, amount);
        mock_approve(&vm, amount);
        mock_vault_token(&vm, TOKEN);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            amount,
            amount,
            U256::ZERO,
        );
        assert!(matches!(result, Err(Error::VaultCallFailed(_))));
        assert!(!router.is_repayment_processed(VAULT, B256::repeat_byte(9)));
    }

    #[test]
    fn unauthorized_admin_changes_are_rejected() {
        let (vm, mut router) = setup();
        vm.set_sender(PAYER);
        assert!(matches!(
            router.set_vault_approved(OTHER_VAULT, true),
            Err(Error::Unauthorized(_))
        ));
        assert!(matches!(
            router.set_admin(PAYER),
            Err(Error::Unauthorized(_))
        ));
    }

    #[test]
    fn repayment_after_uninitialized_is_rejected() {
        let vm = TestVMBuilder::new()
            .sender(PAYER)
            .contract_address(ROUTER)
            .build();
        let mut router = RepaymentRouter::from(&vm);
        let result = router.record_repayment(
            VAULT,
            B256::repeat_byte(9),
            U256::from(100u64),
            U256::from(100u64),
            U256::from(0u64),
        );
        assert!(matches!(result, Err(Error::NotInitialized(_))));
    }
}

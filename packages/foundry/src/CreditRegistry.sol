// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ICompanyPassport } from "./interfaces/ICompanyPassport.sol";

/// @title CreditRegistry
/// @notice Source of truth for official Fouding vaults and their immutable deal identity.
contract CreditRegistry is AccessControl, Pausable {
    bytes32 public constant ORIGINATOR_ROLE = keccak256("ORIGINATOR_ROLE");
    bytes32 public constant UNDERWRITER_ROLE = keccak256("UNDERWRITER_ROLE");
    bytes32 public constant SERVICER_ROLE = keccak256("SERVICER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct VaultRecord {
        address passport;
        address accessRegistry;
        address paymentToken;
        address borrower;
        address originator;
        bytes32 dealId;
        uint64 createdAt;
        bool active;
    }

    error ZeroAddress();
    error ZeroDealId();
    error PassportNotConfigured();
    error AccessRegistryNotConfigured();
    error PaymentTokenNotAuthorized(address token);
    error BorrowerNotVerified(address borrower);
    error VaultAlreadyRegistered(address vault);
    error DealAlreadyRegistered(bytes32 dealId);
    error VaultNotRegistered(address vault);

    event PassportContractUpdated(address indexed previousPassport, address indexed newPassport);
    event AccessRegistryContractUpdated(
        address indexed previousRegistry, address indexed newRegistry
    );
    event PaymentTokenAuthorizationUpdated(address indexed token, bool authorized);
    event VaultRegistered(
        address indexed vault,
        bytes32 indexed dealId,
        address indexed borrower,
        address originator,
        address paymentToken,
        address passport,
        address accessRegistry
    );
    event VaultDeactivated(address indexed vault, bytes32 indexed dealId);

    address public passportContract;
    address public accessRegistryContract;
    mapping(address token => bool authorized) public authorizedPaymentTokens;
    mapping(address vault => VaultRecord record) private _vaults;
    mapping(bytes32 dealId => address vault) public vaultByDealId;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORIGINATOR_ROLE, admin);
        _grantRole(UNDERWRITER_ROLE, admin);
        _grantRole(SERVICER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function setPassportContract(address passport) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (passport == address(0)) revert ZeroAddress();
        address previous = passportContract;
        passportContract = passport;
        emit PassportContractUpdated(previous, passport);
    }

    function setAccessRegistryContract(address accessRegistry)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (accessRegistry == address(0)) revert ZeroAddress();
        address previous = accessRegistryContract;
        accessRegistryContract = accessRegistry;
        emit AccessRegistryContractUpdated(previous, accessRegistry);
    }

    function setPaymentToken(address token, bool authorized) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        authorizedPaymentTokens[token] = authorized;
        emit PaymentTokenAuthorizationUpdated(token, authorized);
    }

    function registerVault(
        address vault,
        address borrower,
        address originator,
        address paymentToken,
        bytes32 dealId
    ) external onlyRole(ORIGINATOR_ROLE) whenNotPaused {
        if (
            vault == address(0) || borrower == address(0) || originator == address(0)
                || paymentToken == address(0)
        ) revert ZeroAddress();
        if (dealId == bytes32(0)) revert ZeroDealId();
        if (passportContract == address(0)) revert PassportNotConfigured();
        if (accessRegistryContract == address(0)) revert AccessRegistryNotConfigured();
        if (!authorizedPaymentTokens[paymentToken]) {
            revert PaymentTokenNotAuthorized(paymentToken);
        }
        if (!ICompanyPassport(passportContract).isVerifiedCompany(borrower)) {
            revert BorrowerNotVerified(borrower);
        }
        if (_vaults[vault].createdAt != 0) revert VaultAlreadyRegistered(vault);
        if (vaultByDealId[dealId] != address(0)) revert DealAlreadyRegistered(dealId);

        _vaults[vault] = VaultRecord({
            passport: passportContract,
            accessRegistry: accessRegistryContract,
            paymentToken: paymentToken,
            borrower: borrower,
            originator: originator,
            dealId: dealId,
            createdAt: uint64(block.timestamp),
            active: true
        });
        vaultByDealId[dealId] = vault;
        emit VaultRegistered(
            vault,
            dealId,
            borrower,
            originator,
            paymentToken,
            passportContract,
            accessRegistryContract
        );
    }

    function deactivateVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        VaultRecord storage record = _vaults[vault];
        if (record.createdAt == 0) revert VaultNotRegistered(vault);
        if (!record.active) revert VaultNotRegistered(vault);
        record.active = false;
        emit VaultDeactivated(vault, record.dealId);
    }

    function getVault(address vault) external view returns (VaultRecord memory) {
        VaultRecord memory record = _vaults[vault];
        if (record.createdAt == 0) revert VaultNotRegistered(vault);
        return record;
    }

    function isVaultRegistered(address vault) external view returns (bool) {
        return _vaults[vault].active;
    }

    function isVaultConfigurationValid(
        address vault,
        bytes32 dealId,
        address borrower,
        address originator,
        address paymentToken,
        address passport,
        address accessRegistry
    ) external view returns (bool) {
        VaultRecord storage record = _vaults[vault];
        return record.active && record.dealId == dealId && record.borrower == borrower
            && record.originator == originator && record.paymentToken == paymentToken
            && record.passport == passport && record.accessRegistry == accessRegistry;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}

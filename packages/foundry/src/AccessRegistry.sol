// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IAccessRegistry } from "./interfaces/IAccessRegistry.sol";

/// @title AccessRegistry
/// @notice Permissioned investor waitlist. Stores hashes only; KYC/PII remains offchain.
contract AccessRegistry is AccessControl, Pausable, IAccessRegistry {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum AccessStatus {
        None,
        Pending,
        Approved,
        Rejected,
        Revoked
    }

    struct AccessRecord {
        bytes32 applicationHash;
        AccessStatus status;
        uint64 requestedAt;
        uint64 updatedAt;
    }

    error ZeroAddress();
    error ZeroHash();
    error InvalidAccessState(address investor, AccessStatus expected, AccessStatus actual);
    error ActiveAccessRequest(address investor, AccessStatus status);

    event AccessRequested(address indexed investor, bytes32 indexed applicationHash);
    event AccessApproved(address indexed investor, address indexed complianceOfficer);
    event AccessRejected(address indexed investor, address indexed complianceOfficer);
    event AccessRevoked(address indexed investor, address indexed complianceOfficer);

    mapping(address investor => AccessRecord record) private _records;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function requestAccess(bytes32 applicationHash) external whenNotPaused {
        if (applicationHash == bytes32(0)) revert ZeroHash();
        AccessRecord storage record = _records[msg.sender];
        if (record.status == AccessStatus.Pending || record.status == AccessStatus.Approved) {
            revert ActiveAccessRequest(msg.sender, record.status);
        }
        uint64 nowTimestamp = uint64(block.timestamp);
        record.applicationHash = applicationHash;
        record.status = AccessStatus.Pending;
        record.requestedAt = nowTimestamp;
        record.updatedAt = nowTimestamp;
        emit AccessRequested(msg.sender, applicationHash);
    }

    function approveAccess(address investor) external onlyRole(COMPLIANCE_ROLE) whenNotPaused {
        _transition(investor, AccessStatus.Pending, AccessStatus.Approved);
        emit AccessApproved(investor, msg.sender);
    }

    function rejectAccess(address investor) external onlyRole(COMPLIANCE_ROLE) whenNotPaused {
        _transition(investor, AccessStatus.Pending, AccessStatus.Rejected);
        emit AccessRejected(investor, msg.sender);
    }

    function revokeAccess(address investor) external onlyRole(COMPLIANCE_ROLE) {
        _transition(investor, AccessStatus.Approved, AccessStatus.Revoked);
        emit AccessRevoked(investor, msg.sender);
    }

    function isAllowedInvestor(address investor) external view returns (bool) {
        return !paused() && _records[investor].status == AccessStatus.Approved;
    }

    function getAccessRecord(address investor) external view returns (AccessRecord memory) {
        return _records[investor];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _transition(address investor, AccessStatus expected, AccessStatus next) internal {
        if (investor == address(0)) revert ZeroAddress();
        AccessStatus current = _records[investor].status;
        if (current != expected) revert InvalidAccessState(investor, expected, current);
        _records[investor].status = next;
        _records[investor].updatedAt = uint64(block.timestamp);
    }
}

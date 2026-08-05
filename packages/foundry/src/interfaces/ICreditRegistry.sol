// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ICreditRegistry {
    function isVaultRegistered(address vault) external view returns (bool);
    function isVaultConfigurationValid(
        address vault,
        bytes32 dealId,
        address borrower,
        address originator,
        address paymentToken,
        address passport,
        address accessRegistry
    ) external view returns (bool);
    function hasRole(bytes32 role, address account) external view returns (bool);
}

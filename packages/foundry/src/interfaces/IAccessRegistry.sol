// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAccessRegistry {
    function isAllowedInvestor(address investor) external view returns (bool);
}

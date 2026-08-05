// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface ICompanyPassport {
    function isVerifiedCompany(address account) external view returns (bool);
}

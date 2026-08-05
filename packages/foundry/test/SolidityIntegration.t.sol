// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { CompanyPassportSBT } from "../src/CompanyPassportSBT.sol";
import { CreditRegistry } from "../src/CreditRegistry.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { TestBase } from "./TestBase.sol";
import { AccessRegistry } from "../src/AccessRegistry.sol";

contract SolidityIntegrationTest is TestBase {
    function testPassportGatesOfficialVaultRegistration() public {
        address borrower = makeAddr("borrower");
        address vault = makeAddr("stylus-vault");
        bytes32 dealId = keccak256("fouding-deal");

        CompanyPassportSBT passport = new CompanyPassportSBT(address(this));
        CreditRegistry registry = new CreditRegistry(address(this));
        MockUSDC token = new MockUSDC(address(this));
        AccessRegistry accessRegistry = new AccessRegistry(address(this));
        registry.setPassportContract(address(passport));
        registry.setAccessRegistryContract(address(accessRegistry));
        registry.setPaymentToken(address(token), true);

        vm.expectRevert(
            abi.encodeWithSelector(CreditRegistry.BorrowerNotVerified.selector, borrower)
        );
        registry.registerVault(vault, borrower, address(this), address(token), dealId);

        passport.issuePassport(
            borrower,
            keccak256("company"),
            keccak256("legal-pack"),
            keccak256("metadata"),
            uint64(block.timestamp + 365 days),
            2
        );
        registry.registerVault(vault, borrower, address(this), address(token), dealId);
        assertTrue(registry.isVaultRegistered(vault));
    }
}

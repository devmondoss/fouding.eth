// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { CompanyPassportSBT } from "../src/CompanyPassportSBT.sol";
import { CreditRegistry } from "../src/CreditRegistry.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { AccessRegistry } from "../src/AccessRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract CreditRegistryTest is TestBase {
    CompanyPassportSBT internal passport;
    CreditRegistry internal registry;
    MockUSDC internal token;
    AccessRegistry internal accessRegistry;
    address internal originator = makeAddr("originator");
    address internal borrower = makeAddr("borrower");
    address internal vault = makeAddr("vault");
    bytes32 internal constant DEAL_ID = keccak256("deal-1");

    function setUp() public {
        passport = new CompanyPassportSBT(address(this));
        registry = new CreditRegistry(address(this));
        token = new MockUSDC(address(this));
        accessRegistry = new AccessRegistry(address(this));
        registry.grantRole(registry.ORIGINATOR_ROLE(), originator);
        registry.setPassportContract(address(passport));
        registry.setAccessRegistryContract(address(accessRegistry));
        registry.setPaymentToken(address(token), true);
        passport.issuePassport(
            borrower,
            keccak256("borrower-company"),
            keccak256("legal"),
            keccak256("metadata"),
            uint64(block.timestamp + 365 days),
            2
        );
    }

    function testRegisterAndDeactivateVault() public {
        vm.prank(originator);
        registry.registerVault(vault, borrower, originator, address(token), DEAL_ID);

        assertTrue(registry.isVaultRegistered(vault));
        assertEq(registry.vaultByDealId(DEAL_ID), vault);
        CreditRegistry.VaultRecord memory record = registry.getVault(vault);
        assertEq(record.borrower, borrower);
        assertEq(record.originator, originator);
        assertEq(record.paymentToken, address(token));
        assertEq(record.passport, address(passport));
        assertEq(record.accessRegistry, address(accessRegistry));
        assertTrue(
            registry.isVaultConfigurationValid(
                vault,
                DEAL_ID,
                borrower,
                originator,
                address(token),
                address(passport),
                address(accessRegistry)
            )
        );

        registry.deactivateVault(vault);
        assertFalse(registry.isVaultRegistered(vault));
    }

    function testRejectsUnverifiedBorrower() public {
        address unverified = makeAddr("unverified");
        vm.prank(originator);
        vm.expectRevert(
            abi.encodeWithSelector(CreditRegistry.BorrowerNotVerified.selector, unverified)
        );
        registry.registerVault(vault, unverified, originator, address(token), DEAL_ID);
    }

    function testRejectsDuplicateDealAndVault() public {
        vm.prank(originator);
        registry.registerVault(vault, borrower, originator, address(token), DEAL_ID);

        vm.prank(originator);
        vm.expectRevert(
            abi.encodeWithSelector(CreditRegistry.VaultAlreadyRegistered.selector, vault)
        );
        registry.registerVault(vault, borrower, originator, address(token), keccak256("deal-2"));

        vm.prank(originator);
        vm.expectRevert(
            abi.encodeWithSelector(CreditRegistry.DealAlreadyRegistered.selector, DEAL_ID)
        );
        registry.registerVault(makeAddr("vault-2"), borrower, originator, address(token), DEAL_ID);
    }

    function testPauseAndRoleChecks() public {
        registry.pause();
        vm.prank(originator);
        vm.expectRevert();
        registry.registerVault(vault, borrower, originator, address(token), DEAL_ID);
        registry.unpause();

        vm.prank(makeAddr("outsider"));
        vm.expectRevert();
        registry.registerVault(vault, borrower, originator, address(token), DEAL_ID);
    }

    function testRejectsUnauthorizedPaymentToken() public {
        address otherToken = makeAddr("other-token");
        vm.prank(originator);
        vm.expectRevert(
            abi.encodeWithSelector(CreditRegistry.PaymentTokenNotAuthorized.selector, otherToken)
        );
        registry.registerVault(vault, borrower, originator, otherToken, DEAL_ID);
    }
}

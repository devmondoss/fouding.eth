// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessRegistry } from "../src/AccessRegistry.sol";
import { TestBase } from "./TestBase.sol";

contract AccessRegistryTest is TestBase {
    AccessRegistry internal registry;
    address internal compliance = makeAddr("compliance");
    address internal investor = makeAddr("investor");
    bytes32 internal constant APPLICATION_HASH = keccak256("private-kyc-record");

    function setUp() public {
        registry = new AccessRegistry(address(this));
        registry.grantRole(registry.COMPLIANCE_ROLE(), compliance);
    }

    function testRequestApproveAndRevoke() public {
        vm.prank(investor);
        registry.requestAccess(APPLICATION_HASH);
        assertFalse(registry.isAllowedInvestor(investor));

        vm.prank(compliance);
        registry.approveAccess(investor);
        assertTrue(registry.isAllowedInvestor(investor));

        vm.prank(compliance);
        registry.revokeAccess(investor);
        assertFalse(registry.isAllowedInvestor(investor));
    }

    function testRejectThenReapply() public {
        vm.prank(investor);
        registry.requestAccess(APPLICATION_HASH);
        vm.prank(compliance);
        registry.rejectAccess(investor);

        vm.prank(investor);
        registry.requestAccess(keccak256("updated-private-kyc-record"));
        AccessRegistry.AccessRecord memory record = registry.getAccessRecord(investor);
        assertEq(uint8(record.status), uint8(AccessRegistry.AccessStatus.Pending));
    }

    function testUnauthorizedApprovalAndInvalidTransitionsRevert() public {
        vm.prank(investor);
        vm.expectRevert();
        registry.approveAccess(investor);

        vm.prank(compliance);
        vm.expectRevert();
        registry.approveAccess(investor);

        vm.prank(investor);
        registry.requestAccess(APPLICATION_HASH);
        vm.prank(investor);
        vm.expectRevert();
        registry.requestAccess(APPLICATION_HASH);
    }

    function testPauseBlocksRequestsAndApproval() public {
        registry.pause();
        vm.prank(investor);
        vm.expectRevert();
        registry.requestAccess(APPLICATION_HASH);
        registry.unpause();

        vm.prank(investor);
        registry.requestAccess(APPLICATION_HASH);
        registry.pause();
        vm.prank(compliance);
        vm.expectRevert();
        registry.approveAccess(investor);
    }

    function testPauseSuspendsPreviouslyApprovedAccess() public {
        vm.prank(investor);
        registry.requestAccess(APPLICATION_HASH);
        vm.prank(compliance);
        registry.approveAccess(investor);
        assertTrue(registry.isAllowedInvestor(investor));

        registry.pause();
        assertFalse(registry.isAllowedInvestor(investor));
        registry.unpause();
        assertTrue(registry.isAllowedInvestor(investor));
    }

    function testZeroHashReverts() public {
        vm.prank(investor);
        vm.expectRevert(AccessRegistry.ZeroHash.selector);
        registry.requestAccess(bytes32(0));
    }
}

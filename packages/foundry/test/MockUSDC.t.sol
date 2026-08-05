// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MockUSDC } from "../src/MockUSDC.sol";
import { TestBase } from "./TestBase.sol";

contract MockUSDCTest is TestBase {
    MockUSDC internal token;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal spender = makeAddr("spender");

    function setUp() public {
        token = new MockUSDC(address(this));
        token.mint(alice, 1_000e6);
    }

    function testSixDecimalsAndControlledMint() public view {
        assertEq(token.decimals(), 6);
        assertEq(token.name(), "Fouding Mock USDC");
        assertEq(token.balanceOf(alice), 1_000e6);
    }

    function testApproveAllowanceAndTransferFrom() public {
        vm.prank(alice);
        token.approve(spender, 250e6);
        assertEq(token.allowance(alice, spender), 250e6);

        vm.prank(spender);
        assertTrue(token.transferFrom(alice, bob, 100e6));
        assertEq(token.balanceOf(bob), 100e6);
        assertEq(token.allowance(alice, spender), 150e6);
    }

    function testFaucetIsLimitedToOneClaim() public {
        vm.prank(bob);
        token.faucet();
        assertEq(token.balanceOf(bob), token.FAUCET_AMOUNT());

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetAlreadyClaimed.selector, bob));
        token.faucet();
    }

    function testUnauthorizedMintReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 1e6);
    }
}

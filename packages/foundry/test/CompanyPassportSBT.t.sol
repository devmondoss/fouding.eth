// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { CompanyPassportSBT, IERC5192 } from "../src/CompanyPassportSBT.sol";
import { TestBase } from "./TestBase.sol";

contract CompanyPassportSBTTest is TestBase {
    CompanyPassportSBT internal passport;
    address internal issuer = makeAddr("issuer");
    address internal verifier = makeAddr("verifier");
    address internal revoker = makeAddr("revoker");
    address internal company = makeAddr("company");
    address internal rotatedWallet = makeAddr("rotatedWallet");
    bytes32 internal constant COMPANY_ID = keccak256("company-1");
    bytes32 internal constant LEGAL_HASH = keccak256("legal-pack");
    bytes32 internal constant METADATA_HASH = keccak256("public-metadata");

    function setUp() public {
        passport = new CompanyPassportSBT(address(this));
        passport.grantRole(passport.ISSUER_ROLE(), issuer);
        passport.grantRole(passport.VERIFIER_ROLE(), verifier);
        passport.grantRole(passport.REVOKER_ROLE(), revoker);
    }

    function _issue() internal returns (uint256) {
        vm.prank(issuer);
        return passport.issuePassport(
            company, COMPANY_ID, LEGAL_HASH, METADATA_HASH, uint64(block.timestamp + 365 days), 2
        );
    }

    function testIssueAndReadCredential() public {
        uint256 tokenId = _issue();
        assertEq(passport.passportOf(company), tokenId);
        assertTrue(passport.isVerifiedCompany(company));
        assertTrue(passport.locked(tokenId));
        assertTrue(passport.supportsInterface(type(IERC5192).interfaceId));

        CompanyPassportSBT.Credential memory credential = passport.credentialOf(tokenId);
        assertEq(credential.companyId, COMPANY_ID);
        assertEq(credential.legalPackHash, LEGAL_HASH);
        assertEq(uint8(credential.status), uint8(CompanyPassportSBT.Status.Verified));
    }

    function testSoulboundOperationsRevert() public {
        uint256 tokenId = _issue();
        vm.startPrank(company);
        vm.expectRevert(CompanyPassportSBT.Soulbound.selector);
        passport.approve(rotatedWallet, tokenId);
        vm.expectRevert(CompanyPassportSBT.Soulbound.selector);
        passport.setApprovalForAll(rotatedWallet, true);
        vm.expectRevert(CompanyPassportSBT.Soulbound.selector);
        passport.transferFrom(company, rotatedWallet, tokenId);
        vm.expectRevert(CompanyPassportSBT.Soulbound.selector);
        passport.safeTransferFrom(company, rotatedWallet, tokenId);
        vm.stopPrank();
    }

    function testDuplicateWalletAndCompanyRevert() public {
        uint256 tokenId = _issue();
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CompanyPassportSBT.ActivePassportForWallet.selector, company, tokenId
            )
        );
        passport.issuePassport(
            company,
            keccak256("other"),
            LEGAL_HASH,
            METADATA_HASH,
            uint64(block.timestamp + 1 days),
            1
        );

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(
                CompanyPassportSBT.ActivePassportForCompany.selector, COMPANY_ID, tokenId
            )
        );
        passport.issuePassport(
            rotatedWallet,
            COMPANY_ID,
            LEGAL_HASH,
            METADATA_HASH,
            uint64(block.timestamp + 1 days),
            1
        );
    }

    function testSuspendReinstateRevokeAuthorization() public {
        uint256 tokenId = _issue();
        vm.prank(verifier);
        passport.suspendPassport(tokenId);
        assertFalse(passport.isVerifiedCompany(company));

        vm.prank(verifier);
        passport.reinstatePassport(tokenId);
        assertTrue(passport.isVerifiedCompany(company));

        vm.prank(revoker);
        passport.revokePassport(tokenId);
        assertFalse(passport.isVerifiedCompany(company));
        assertEq(passport.passportOf(company), 0);
    }

    function testUnauthorizedRolesRevert() public {
        vm.prank(company);
        vm.expectRevert();
        passport.issuePassport(
            company, COMPANY_ID, LEGAL_HASH, METADATA_HASH, uint64(block.timestamp + 1 days), 1
        );

        uint256 tokenId = _issue();
        vm.prank(company);
        vm.expectRevert();
        passport.suspendPassport(tokenId);
        vm.prank(company);
        vm.expectRevert();
        passport.revokePassport(tokenId);
    }

    function testExpiredPassportCanBeReissued() public {
        uint256 tokenId = _issue();
        vm.warp(block.timestamp + 366 days);
        assertFalse(passport.isVerifiedCompany(company));
        assertEq(passport.passportOf(company), 0);
        assertEq(
            uint8(passport.credentialOf(tokenId).status), uint8(CompanyPassportSBT.Status.Expired)
        );

        vm.prank(issuer);
        uint256 replacement = passport.issuePassport(
            company, COMPANY_ID, LEGAL_HASH, METADATA_HASH, uint64(block.timestamp + 365 days), 2
        );
        assertGt(replacement, tokenId);
        assertTrue(passport.isVerifiedCompany(company));
    }

    function testRotateWalletBurnsAndReissues() public {
        uint256 tokenId = _issue();
        vm.prank(issuer);
        uint256 newTokenId = passport.rotateWallet(tokenId, rotatedWallet);

        vm.expectRevert();
        passport.ownerOf(tokenId);
        assertEq(passport.ownerOf(newTokenId), rotatedWallet);
        assertEq(passport.passportOf(company), 0);
        assertEq(passport.passportOf(rotatedWallet), newTokenId);
        assertTrue(passport.isVerifiedCompany(rotatedWallet));
    }
}

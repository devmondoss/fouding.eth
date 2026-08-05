// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice Minimal ERC-5192 interface for a permanently locked ERC-721 credential.
interface IERC5192 is IERC165 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @title CompanyPassportSBT
/// @notice Non-transferable company credential. PII and private documents never enter storage.
contract CompanyPassportSBT is ERC721, AccessControl, IERC5192 {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    enum Status {
        Verified,
        Suspended,
        Revoked,
        Expired
    }

    struct Credential {
        bytes32 companyId;
        bytes32 legalPackHash;
        bytes32 metadataHash;
        Status status;
        uint64 issuedAt;
        uint64 expiresAt;
        uint64 updatedAt;
        uint8 riskTier;
    }

    error ZeroAddress();
    error ZeroHash();
    error InvalidExpiration(uint64 expiresAt);
    error InvalidRiskTier(uint8 riskTier);
    error ActivePassportForWallet(address wallet, uint256 tokenId);
    error ActivePassportForCompany(bytes32 companyId, uint256 tokenId);
    error PassportNotActive(uint256 tokenId);
    error PassportNotSuspended(uint256 tokenId);
    error Soulbound();

    event PassportIssued(
        uint256 indexed tokenId,
        address indexed wallet,
        bytes32 indexed companyId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    );
    event CredentialUpdated(
        uint256 indexed tokenId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    );
    event PassportSuspended(uint256 indexed tokenId, address indexed verifier);
    event PassportReinstated(uint256 indexed tokenId, address indexed verifier);
    event PassportRevoked(uint256 indexed tokenId, address indexed revoker);
    event PassportExpired(uint256 indexed tokenId);
    event WalletRotated(
        uint256 indexed previousTokenId,
        uint256 indexed newTokenId,
        address indexed previousWallet,
        address newWallet
    );

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => Credential credential) private _credentials;
    mapping(address wallet => uint256 tokenId) private _activePassportByWallet;
    mapping(bytes32 companyId => uint256 tokenId) private _activePassportByCompany;

    constructor(address admin) ERC721("Fouding Company Passport", "FCP") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
    }

    function issuePassport(
        address wallet,
        bytes32 companyId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    ) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        _validateCredentialInput(
            wallet, companyId, legalPackHash, metadataHash, expiresAt, riskTier
        );
        _releaseExpiredWallet(wallet);
        _releaseExpiredCompany(companyId);

        uint256 walletToken = _activePassportByWallet[wallet];
        if (walletToken != 0) revert ActivePassportForWallet(wallet, walletToken);
        uint256 companyToken = _activePassportByCompany[companyId];
        if (companyToken != 0) revert ActivePassportForCompany(companyId, companyToken);

        tokenId = _issue(wallet, companyId, legalPackHash, metadataHash, expiresAt, riskTier);
    }

    function updateCredential(
        uint256 tokenId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    ) external onlyRole(VERIFIER_ROLE) {
        _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (!_isActiveStatus(credential.status)) revert PassportNotActive(tokenId);
        _validateMutableCredential(legalPackHash, metadataHash, expiresAt, riskTier);

        credential.legalPackHash = legalPackHash;
        credential.metadataHash = metadataHash;
        credential.expiresAt = expiresAt;
        credential.updatedAt = uint64(block.timestamp);
        credential.riskTier = riskTier;
        emit CredentialUpdated(tokenId, legalPackHash, metadataHash, expiresAt, riskTier);
    }

    function suspendPassport(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (credential.status != Status.Verified || _isStorageExpired(credential)) {
            revert PassportNotActive(tokenId);
        }
        credential.status = Status.Suspended;
        credential.updatedAt = uint64(block.timestamp);
        emit PassportSuspended(tokenId, msg.sender);
    }

    function reinstatePassport(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (credential.status != Status.Suspended) revert PassportNotSuspended(tokenId);
        if (_isStorageExpired(credential)) {
            _expire(tokenId);
            revert PassportNotActive(tokenId);
        }
        credential.status = Status.Verified;
        credential.updatedAt = uint64(block.timestamp);
        emit PassportReinstated(tokenId, msg.sender);
    }

    function revokePassport(uint256 tokenId) external onlyRole(REVOKER_ROLE) {
        address wallet = _requireOwned(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (!_isActiveStatus(credential.status)) revert PassportNotActive(tokenId);

        credential.status = Status.Revoked;
        credential.updatedAt = uint64(block.timestamp);
        _clearActiveMappings(wallet, credential.companyId, tokenId);
        emit PassportRevoked(tokenId, msg.sender);
    }

    /// @notice Burns the previous SBT and reissues the current credential to a new wallet.
    function rotateWallet(uint256 tokenId, address newWallet)
        external
        onlyRole(ISSUER_ROLE)
        returns (uint256 newTokenId)
    {
        address previousWallet = _requireOwned(tokenId);
        if (newWallet == address(0)) revert ZeroAddress();
        Credential memory previous = _credentials[tokenId];
        if (!_isActiveStatus(previous.status) || _isMemoryExpired(previous)) {
            revert PassportNotActive(tokenId);
        }

        _releaseExpiredWallet(newWallet);
        uint256 existing = _activePassportByWallet[newWallet];
        if (existing != 0) revert ActivePassportForWallet(newWallet, existing);

        _clearActiveMappings(previousWallet, previous.companyId, tokenId);
        _burn(tokenId);
        previous.status = Status.Revoked;
        previous.updatedAt = uint64(block.timestamp);
        _credentials[tokenId] = previous;

        newTokenId = _issue(
            newWallet,
            previous.companyId,
            previous.legalPackHash,
            previous.metadataHash,
            previous.expiresAt,
            previous.riskTier
        );
        emit WalletRotated(tokenId, newTokenId, previousWallet, newWallet);
    }

    function passportOf(address wallet) external view returns (uint256) {
        uint256 tokenId = _activePassportByWallet[wallet];
        if (tokenId == 0) return 0;
        Credential storage credential = _credentials[tokenId];
        return _isActiveStatus(credential.status) && !_isStorageExpired(credential) ? tokenId : 0;
    }

    function credentialOf(uint256 tokenId) external view returns (Credential memory credential) {
        _requireOwned(tokenId);
        credential = _credentials[tokenId];
        if (_isActiveStatus(credential.status) && _isMemoryExpired(credential)) {
            credential.status = Status.Expired;
        }
    }

    function isVerifiedCompany(address wallet) external view returns (bool) {
        uint256 tokenId = _activePassportByWallet[wallet];
        if (tokenId == 0) return false;
        Credential storage credential = _credentials[tokenId];
        return credential.status == Status.Verified && !_isStorageExpired(credential);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) public pure override {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function _issue(
        address wallet,
        bytes32 companyId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    ) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        uint64 nowTimestamp = uint64(block.timestamp);
        _credentials[tokenId] = Credential({
            companyId: companyId,
            legalPackHash: legalPackHash,
            metadataHash: metadataHash,
            status: Status.Verified,
            issuedAt: nowTimestamp,
            expiresAt: expiresAt,
            updatedAt: nowTimestamp,
            riskTier: riskTier
        });
        _activePassportByWallet[wallet] = tokenId;
        _activePassportByCompany[companyId] = tokenId;
        _safeMint(wallet, tokenId);
        emit Locked(tokenId);
        emit PassportIssued(
            tokenId, wallet, companyId, legalPackHash, metadataHash, expiresAt, riskTier
        );
    }

    function _validateCredentialInput(
        address wallet,
        bytes32 companyId,
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    ) internal view {
        if (wallet == address(0)) revert ZeroAddress();
        if (companyId == bytes32(0)) revert ZeroHash();
        _validateMutableCredential(legalPackHash, metadataHash, expiresAt, riskTier);
    }

    function _validateMutableCredential(
        bytes32 legalPackHash,
        bytes32 metadataHash,
        uint64 expiresAt,
        uint8 riskTier
    ) internal view {
        if (legalPackHash == bytes32(0) || metadataHash == bytes32(0)) {
            revert ZeroHash();
        }
        if (expiresAt <= block.timestamp) revert InvalidExpiration(expiresAt);
        if (riskTier == 0 || riskTier > 5) revert InvalidRiskTier(riskTier);
    }

    function _releaseExpiredWallet(address wallet) internal {
        uint256 tokenId = _activePassportByWallet[wallet];
        if (tokenId != 0 && _isStorageExpired(_credentials[tokenId])) _expire(tokenId);
    }

    function _releaseExpiredCompany(bytes32 companyId) internal {
        uint256 tokenId = _activePassportByCompany[companyId];
        if (tokenId != 0 && _isStorageExpired(_credentials[tokenId])) _expire(tokenId);
    }

    function _expire(uint256 tokenId) internal {
        address wallet = _ownerOf(tokenId);
        Credential storage credential = _credentials[tokenId];
        if (!_isActiveStatus(credential.status) || !_isStorageExpired(credential)) return;
        credential.status = Status.Expired;
        credential.updatedAt = uint64(block.timestamp);
        _clearActiveMappings(wallet, credential.companyId, tokenId);
        emit PassportExpired(tokenId);
    }

    function _clearActiveMappings(address wallet, bytes32 companyId, uint256 tokenId) internal {
        if (_activePassportByWallet[wallet] == tokenId) delete _activePassportByWallet[wallet];
        if (_activePassportByCompany[companyId] == tokenId) {
            delete _activePassportByCompany[companyId];
        }
    }

    function _isStorageExpired(Credential storage credential) internal view returns (bool) {
        return block.timestamp >= credential.expiresAt;
    }

    function _isMemoryExpired(Credential memory credential) internal view returns (bool) {
        return block.timestamp >= credential.expiresAt;
    }

    function _isActiveStatus(Status status) internal pure returns (bool) {
        return status == Status.Verified || status == Status.Suspended;
    }
}

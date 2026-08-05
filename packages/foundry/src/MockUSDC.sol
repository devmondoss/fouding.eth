// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Development-only token. This is not Circle USDC and must never be presented as such.
contract MockUSDC is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 6;

    error ZeroAddress();
    error FaucetAlreadyClaimed(address account);

    mapping(address account => bool claimed) public faucetClaimed;

    constructor(address admin) ERC20("Fouding Mock USDC", "mUSDC") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    function faucet() external {
        if (faucetClaimed[msg.sender]) revert FaucetAlreadyClaimed(msg.sender);
        faucetClaimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}

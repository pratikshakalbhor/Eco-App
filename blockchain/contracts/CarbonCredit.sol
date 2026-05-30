// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Carbon Credit Token (ERC20)
contract CarbonCredit is ERC20, Ownable {
    constructor() ERC20("CarbonCreditToken", "CCT") Ownable(msg.sender) {}  // <-- Fix: Pass `msg.sender` to Ownable

    /// @notice Mint new tokens (only admin)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens (used when redeemed)
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
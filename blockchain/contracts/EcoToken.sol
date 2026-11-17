// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EcoToken
/// @notice ERC-20 carbon credit.
///
/// @dev Unit convention: **1 token (18 decimals) = 1 carbon credit = 1000 kg
///      CO2e**. One credit therefore represents one tonne of CO2e, which is
///      the unit the Go backend uses (`CARBON_KG_PER_CREDIT`, default 1000).
///
///      The freeze is user-level: when a planter's tree is confirmed cut, the
///      whole account is frozen and none of its credits can be transferred or
///      burned until every open replantation debt of that wallet is cleared.
contract EcoToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FREEZER_ROLE = keccak256("FREEZER_ROLE");

    /// @notice Kilograms of CO2e represented by one credit (one token).
    uint256 public constant KG_PER_CREDIT = 1000;

    /// @notice True when all transfers and burns are halted.
    bool public paused;

    /// @notice Accounts whose credits cannot be moved or burned.
    mapping(address => bool) public frozen;

    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event Frozen(address indexed account);
    event Unfrozen(address indexed account);

    constructor() ERC20("EcoChain Carbon Credit", "ECC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The deployer starts as the minter so the token is usable on its
        // own. The deployment script moves MINTER_ROLE to the EcoChainTree
        // contract and revokes it from the deployer, so in production only
        // the tree contract can mint.
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// @notice Mint credits to `to`.
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "EcoToken: mint to the zero address");
        require(amount > 0, "EcoToken: mint amount must be positive");
        _mint(to, amount);
    }

    /// @notice Burn the caller's own credits, permanently retiring them.
    function burn(uint256 amount) public {
        require(amount > 0, "EcoToken: burn amount must be positive");
        _burn(msg.sender, amount);
    }

    /// @notice Burn credits from `account` using the caller's allowance.
    /// @dev The burn is refused while `account` is frozen or the token is
    ///      paused, exactly like a transfer out of that account.
    function burnFrom(address account, uint256 amount) public {
        require(amount > 0, "EcoToken: burn amount must be positive");

        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "EcoToken: burn amount exceeds allowance");
        if (currentAllowance != type(uint256).max) {
            _approve(account, msg.sender, currentAllowance - amount);
        }

        _burn(account, amount);
    }

    /// @notice Halt all transfers and burns.
    function pause() public onlyRole(PAUSER_ROLE) {
        require(!paused, "EcoToken: already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Resume transfers and burns.
    function unpause() public onlyRole(PAUSER_ROLE) {
        require(paused, "EcoToken: not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Freeze or unfreeze an account.
    /// @dev A frozen account cannot transfer its credits, cannot receive
    ///      credits, and cannot burn them. It can still be *minted* to, so
    ///      that credits earned while frozen are not lost — they simply
    ///      cannot be moved until the freeze is lifted.
    function freeze(address account, bool shouldFreeze) public onlyRole(FREEZER_ROLE) {
        require(account != address(0), "EcoToken: cannot freeze the zero address");
        if (frozen[account] == shouldFreeze) {
            // Idempotent: confirming a second cut for the same planter must
            // not revert just because the account is already frozen.
            return;
        }

        frozen[account] = shouldFreeze;
        if (shouldFreeze) {
            emit Frozen(account);
        } else {
            emit Unfrozen(account);
        }
    }

    /// @notice Whether an account is frozen.
    function isFrozen(address account) external view returns (bool) {
        return frozen[account];
    }

    /// @dev The single state-transition hook of the ERC-20.
    ///
    ///      Mints are always allowed — `from == address(0)` — so that a
    ///      frozen planter can still be credited. Transfers (from != 0,
    ///      to != 0) and burns (from != 0, to == 0) are both blocked while
    ///      the token is paused or the sending account is frozen.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            require(!paused, "EcoToken: token transfers are paused");
            require(!frozen[from], "EcoToken: sender account is frozen");
        }
        if (to != address(0) && from != address(0)) {
            require(!frozen[to], "EcoToken: recipient account is frozen");
        }
        super._update(from, to, value);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IEcoToken
/// @notice The subset of the EcoToken ERC-20 used by EcoChainTree and the
///         ReplantationRegistry.
interface IEcoToken {
    function mint(address to, uint256 amount) external;

    function burn(uint256 amount) external;

    /// @notice Freeze or unfreeze an account. A frozen account cannot
    ///         transfer or burn its credits.
    function freeze(address account, bool shouldFreeze) external;

    function balanceOf(address account) external view returns (uint256);

    function frozen(address account) external view returns (bool);
}

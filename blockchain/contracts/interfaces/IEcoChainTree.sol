// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IEcoChainTree
/// @notice The read-only view of the tree registry that the
///         ReplantationRegistry needs in order to validate a replantation.
interface IEcoChainTree {
    /// @notice The wallet that planted (and owns) the tree.
    function treePlanter(uint256 tokenId) external view returns (address);

    /// @notice Whether the tree is in the VERIFIED state.
    function isTreeVerified(uint256 tokenId) external view returns (bool);
}

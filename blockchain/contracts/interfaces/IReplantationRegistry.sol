// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReplantationRegistry
/// @notice The subset of the ReplantationRegistry used by EcoChainTree.
interface IReplantationRegistry {
    function createDebt(
        uint256 originalTokenId,
        address debtor,
        uint16 replacementsNeeded
    ) external returns (uint256);

    function linkReplacement(uint256 debtId, uint256 replacementTokenId) external;

    function clearDebt(uint256 debtId, string calldata certificateURI) external;

    /// @notice The debt created for a given cut tree, or 0 when there is none.
    function debtIdForOriginalToken(uint256 originalTokenId) external view returns (uint256);

    /// @notice Whether enough replacement trees have been linked to clear the debt.
    function isDebtFulfilled(uint256 debtId) external view returns (bool);
}

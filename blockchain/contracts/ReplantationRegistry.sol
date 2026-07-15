// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ReplantationRegistry
/// @notice On-chain registry linking cut tree NFTs to their replacement trees.
/// @dev Provides immutable proof of replantation obligations and their clearance.
contract ReplantationRegistry is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct DebtRecord {
        uint256 originalTokenId;   // EcoChainTree token ID of the cut tree
        address debtor;            // Wallet that owes replantation
        uint16  replacementsNeeded;
        uint16  replacementsFulfilled;
        bool    cleared;
        uint256 createdAt;
        uint256 clearedAt;
        string  certificateURI;   // IPFS URI to the restoration certificate
    }

    struct ReplacementLink {
        uint256 debtId;
        uint256 replacementTokenId; // New EcoChainTree token ID
        uint256 linkedAt;
    }

    uint256 private _debtCounter;

    mapping(uint256 => DebtRecord)               public debts;
    mapping(uint256 => ReplacementLink[])        public debtReplacements;
    mapping(address => uint256[])                public userDebts;
    mapping(uint256 => uint256)                  public tokenToDebt; // replacement token → debt ID

    event DebtCreated(uint256 indexed debtId, uint256 indexed originalTokenId, address debtor, uint16 replacementsNeeded);
    event ReplacementLinked(uint256 indexed debtId, uint256 indexed replacementTokenId, uint16 fulfilled);
    event DebtCleared(uint256 indexed debtId, address debtor, string certificateURI);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RECORDER_ROLE, msg.sender);
    }

    /// @notice Create a new replantation debt record when a tree is confirmed cut
    function createDebt(
        uint256 originalTokenId,
        address debtor,
        uint16 replacementsNeeded
    ) external onlyRole(RECORDER_ROLE) returns (uint256) {
        require(replacementsNeeded > 0, "Registry: at least 1 replacement required");
        require(debtor != address(0), "Registry: invalid debtor");

        _debtCounter++;
        uint256 debtId = _debtCounter;

        debts[debtId] = DebtRecord({
            originalTokenId:       originalTokenId,
            debtor:                debtor,
            replacementsNeeded:    replacementsNeeded,
            replacementsFulfilled: 0,
            cleared:               false,
            createdAt:             block.timestamp,
            clearedAt:             0,
            certificateURI:        ""
        });

        userDebts[debtor].push(debtId);

        emit DebtCreated(debtId, originalTokenId, debtor, replacementsNeeded);
        return debtId;
    }

    /// @notice Link a replacement tree token to a debt
    function linkReplacement(uint256 debtId, uint256 replacementTokenId)
        external onlyRole(RECORDER_ROLE)
    {
        DebtRecord storage debt = debts[debtId];
        require(debt.createdAt > 0, "Registry: debt does not exist");
        require(!debt.cleared, "Registry: debt already cleared");
        require(tokenToDebt[replacementTokenId] == 0, "Registry: token already linked");

        debtReplacements[debtId].push(ReplacementLink({
            debtId:             debtId,
            replacementTokenId: replacementTokenId,
            linkedAt:           block.timestamp
        }));

        debt.replacementsFulfilled++;
        tokenToDebt[replacementTokenId] = debtId;

        emit ReplacementLinked(debtId, replacementTokenId, debt.replacementsFulfilled);

        // Auto-clear if all replacements fulfilled
        if (debt.replacementsFulfilled >= debt.replacementsNeeded) {
            debt.cleared   = true;
            debt.clearedAt = block.timestamp;
            emit DebtCleared(debtId, debt.debtor, "");
        }
    }

    /// @notice Clear a debt and attach restoration certificate
    function clearDebt(uint256 debtId, string memory certificateURI)
        external onlyRole(RECORDER_ROLE)
    {
        DebtRecord storage debt = debts[debtId];
        require(debt.createdAt > 0, "Registry: debt does not exist");
        require(!debt.cleared, "Registry: already cleared");

        debt.cleared        = true;
        debt.clearedAt      = block.timestamp;
        debt.certificateURI = certificateURI;

        emit DebtCleared(debtId, debt.debtor, certificateURI);
    }

    /// @notice Get all debt IDs for a wallet
    function getUserDebts(address user) external view returns (uint256[] memory) {
        return userDebts[user];
    }

    /// @notice Get all replacement links for a debt
    function getReplacements(uint256 debtId) external view returns (ReplacementLink[] memory) {
        return debtReplacements[debtId];
    }

    function totalDebts() external view returns (uint256) {
        return _debtCounter;
    }
}

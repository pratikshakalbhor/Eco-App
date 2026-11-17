// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEcoToken.sol";
import "./interfaces/IEcoChainTree.sol";
import "./interfaces/IReplantationRegistry.sol";

/// @title ReplantationRegistry
/// @notice On-chain registry linking cut tree NFTs to their replacement trees.
/// @dev Records replantation obligations and their clearance. The state is
///      mutable by design (debts are created, linked and cleared); the event
///      log is the durable, append-only history of those changes.
///
///      The registry trusts exactly one caller: the EcoChainTree contract.
///      There is no role that can create, link or clear a debt — a role
///      holder could otherwise clear a debt without planting anything.
///      Every mutation is therefore performed by EcoChainTree, which validates
///      the underlying tree state first.
contract ReplantationRegistry is AccessControl, ReentrancyGuard, IReplantationRegistry {
    struct DebtRecord {
        uint256 originalTokenId; // EcoChainTree token ID of the cut tree
        address debtor; // Wallet that owes replantation
        uint16 replacementsNeeded;
        uint16 replacementsFulfilled;
        bool cleared;
        uint256 createdAt;
        uint256 clearedAt;
        string certificateURI; // IPFS URI to the restoration certificate
    }

    struct ReplacementLink {
        uint256 debtId;
        uint256 replacementTokenId; // New EcoChainTree token ID
        uint256 linkedAt;
    }

    uint256 private _debtCounter;

    mapping(uint256 => DebtRecord) public debts;
    mapping(uint256 => ReplacementLink[]) public debtReplacements;
    mapping(address => uint256[]) public userDebts;
    mapping(uint256 => uint256) public tokenToDebt; // replacement token -> debt ID
    mapping(uint256 => uint256) public debtIdForOriginalToken; // cut token -> debt ID
    mapping(address => uint256) public openDebtCount; // debtor -> number of open debts

    /// @notice The EcoChainTree contract — the only trusted caller.
    address public treeRegistry;
    /// @notice The EcoToken contract, used to lift the credit freeze.
    address public ecoToken;
    bool private treeRegistrySet;
    bool private ecoTokenSet;

    event DebtCreated(
        uint256 indexed debtId,
        uint256 indexed originalTokenId,
        address debtor,
        uint16 replacementsNeeded
    );
    event ReplacementLinked(
        uint256 indexed debtId,
        uint256 indexed replacementTokenId,
        uint16 fulfilled
    );
    event DebtCleared(uint256 indexed debtId, address debtor, string certificateURI);
    event DebtOpenCountChanged(address indexed debtor, uint256 openCount);
    event TreeRegistrySet(address indexed treeRegistry);
    event EcoTokenSet(address indexed ecoToken);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ── One-time configuration ─────────────────────────────────────────────

    /// @notice Set the tree contract. Callable once, by an admin.
    function setTreeRegistry(address tree) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!treeRegistrySet, "Registry: tree registry already set");
        require(tree != address(0) && tree.code.length > 0, "Registry: invalid tree registry");

        treeRegistry = tree;
        treeRegistrySet = true;
        emit TreeRegistrySet(tree);
    }

    /// @notice Set the EcoToken contract. Callable once, by an admin.
    function setEcoToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!ecoTokenSet, "Registry: eco token already set");
        require(token != address(0) && token.code.length > 0, "Registry: invalid eco token");

        ecoToken = token;
        ecoTokenSet = true;
        emit EcoTokenSet(token);
    }

    modifier onlyTreeRegistry() {
        require(
            treeRegistrySet && msg.sender == treeRegistry,
            "Registry: caller is not the tree registry"
        );
        _;
    }

    // ── Debt lifecycle ─────────────────────────────────────────────────────

    /// @inheritdoc IReplantationRegistry
    function createDebt(
        uint256 originalTokenId,
        address debtor,
        uint16 replacementsNeeded
    ) external onlyTreeRegistry nonReentrant returns (uint256) {
        // The backend's formula is max(3, ceil(ageYears / 2)), so the floor
        // of 3 is the smallest value it can ever produce.
        require(replacementsNeeded >= 3, "Registry: at least 3 replacements required");
        require(debtor != address(0), "Registry: invalid debtor");
        require(
            debtIdForOriginalToken[originalTokenId] == 0,
            "Registry: debt already exists for this tree"
        );

        // The debtor must be the planter of the tree that was cut. The tree
        // contract is the source of truth for who that is.
        address planter = IEcoChainTree(treeRegistry).treePlanter(originalTokenId);
        require(debtor == planter, "Registry: debtor is not the tree planter");

        _debtCounter++;
        uint256 debtId = _debtCounter;

        debts[debtId] = DebtRecord({
            originalTokenId: originalTokenId,
            debtor: debtor,
            replacementsNeeded: replacementsNeeded,
            replacementsFulfilled: 0,
            cleared: false,
            createdAt: block.timestamp,
            clearedAt: 0,
            certificateURI: ""
        });

        userDebts[debtor].push(debtId);
        debtIdForOriginalToken[originalTokenId] = debtId;
        openDebtCount[debtor] += 1;

        emit DebtCreated(debtId, originalTokenId, debtor, replacementsNeeded);
        emit DebtOpenCountChanged(debtor, openDebtCount[debtor]);

        return debtId;
    }

    /// @inheritdoc IReplantationRegistry
    function linkReplacement(uint256 debtId, uint256 replacementTokenId)
        external
        onlyTreeRegistry
        nonReentrant
    {
        DebtRecord storage debt = debts[debtId];
        require(debt.createdAt > 0, "Registry: debt does not exist");
        require(!debt.cleared, "Registry: debt already cleared");
        require(tokenToDebt[replacementTokenId] == 0, "Registry: token already linked");

        // The replacement must be a verified tree owned by the debtor.
        require(
            IEcoChainTree(treeRegistry).isTreeVerified(replacementTokenId),
            "Registry: replacement must be VERIFIED"
        );
        require(
            IEcoChainTree(treeRegistry).treePlanter(replacementTokenId) == debt.debtor,
            "Registry: replacement is not owned by the debtor"
        );

        debtReplacements[debtId].push(
            ReplacementLink({
                debtId: debtId,
                replacementTokenId: replacementTokenId,
                linkedAt: block.timestamp
            })
        );

        debt.replacementsFulfilled++;
        tokenToDebt[replacementTokenId] = debtId;

        emit ReplacementLinked(debtId, replacementTokenId, debt.replacementsFulfilled);
    }

    /// @inheritdoc IReplantationRegistry
    function clearDebt(uint256 debtId, string memory certificateURI)
        external
        onlyTreeRegistry
        nonReentrant
    {
        DebtRecord storage debt = debts[debtId];
        require(debt.createdAt > 0, "Registry: debt does not exist");
        require(!debt.cleared, "Registry: already cleared");
        require(
            debt.replacementsFulfilled >= debt.replacementsNeeded,
            "Registry: replacements not fulfilled"
        );

        debt.cleared = true;
        debt.clearedAt = block.timestamp;
        debt.certificateURI = certificateURI;

        openDebtCount[debt.debtor] -= 1;
        emit DebtOpenCountChanged(debt.debtor, openDebtCount[debt.debtor]);

        // The account-level credit freeze is lifted only when the debtor has
        // no open debt left.
        if (openDebtCount[debt.debtor] == 0 && ecoTokenSet) {
            IEcoToken(ecoToken).freeze(debt.debtor, false);
        }

        emit DebtCleared(debtId, debt.debtor, certificateURI);
    }

    /// @inheritdoc IReplantationRegistry
    function isDebtFulfilled(uint256 debtId) external view returns (bool) {
        DebtRecord storage debt = debts[debtId];
        require(debt.createdAt > 0, "Registry: debt does not exist");
        return debt.replacementsFulfilled >= debt.replacementsNeeded;
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /// @notice Get all debt IDs for a wallet.
    function getUserDebts(address user) external view returns (uint256[] memory) {
        return userDebts[user];
    }

    /// @notice Get all replacement links for a debt.
    function getReplacements(uint256 debtId)
        external
        view
        returns (ReplacementLink[] memory)
    {
        return debtReplacements[debtId];
    }

    function totalDebts() external view returns (uint256) {
        return _debtCounter;
    }
}

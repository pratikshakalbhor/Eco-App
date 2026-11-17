// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEcoToken.sol";
import "./interfaces/IReplantationRegistry.sol";
import "./interfaces/IEcoChainTree.sol";

/// @title EcoChainTree
/// @notice ERC-721 NFT representing a registered biological tree asset.
/// @dev Tracks on-chain lifecycle states, verification records and IPFS CIDs,
///      and is the single source of truth for cut state. TreeCuttingReport
///      has been removed.
///
/// Credit accounting mirrors the Go backend exactly
/// (services/carbon_service.go, services/environmental_service.go):
///   rate   = carbonScorePerYear / 100        (kg CO2 per year)
///   age    = max((now - plantedAt) / year, 0.1)   (years)
///   kg     = rate * age
///   credit = round(kg / 1000 * 10000) / 10000   (1 credit = 1000 kg = 1 tonne CO2e)
///   amount = credit * 1e18                      (1 token = 1 credit)
contract EcoChainTree is ERC721URIStorage, AccessControl, ReentrancyGuard, IEcoChainTree {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ── Credit accounting constants (fixed point, 1e18) ─────────────────────
    uint256 private constant ONE = 1e18;
    uint256 private constant SECONDS_PER_YEAR = 31536000;
    uint256 private constant MIN_TREE_AGE_YEARS = 0.1e18;
    uint256 private constant DEFAULT_ABSORPTION_RATE = 18.5e18; // kg CO2 per year
    uint256 private constant CREDIT_DECIMALS = 1e14; // 4 decimal places
    uint256 private constant KG_PER_CREDIT = 1000; // 1 credit = 1 tonne of CO2e

    enum TreeStatus {
        REGISTERED, // 0 – NFT minted, pending verification
        VERIFIED, // 1 – Verifier approved, carbon credits active
        CUT_REPORTED, // 2 – Cut reported, credits frozen
        CUT_CONFIRMED, // 3 – Cut confirmed, replantation debt created
        REPLANTED, // 4 – part of a replantation, or compensated by one
        REJECTED // 5 – Rejected by verifier
    }

    struct TreeData {
        TreeStatus status;
        uint256 carbonScore; // kg CO2 per year * 100
        address planter;
        string ipfsHash;
        uint256 registeredAt;
        uint256 verifiedAt;
    }

    uint256 private _tokenIds;

    mapping(uint256 => TreeData) public trees;
    mapping(string => bool) public ipfsHashUsed;
    mapping(uint256 => uint256) public replacesTokenId; // replacement NFT -> original cut token ID
    mapping(uint256 => uint256) public replacedByTokenId; // original cut token ID -> replacement NFT

    /// @notice Total number of tree NFTs minted (equals _tokenIds).
    function totalSupply() public view returns (uint256) {
        return _tokenIds;
    }

    /// @notice The EcoToken contract this tree mints its credits with.
    address public ecoToken;
    /// @notice The ReplantationRegistry contract.
    address public registry;
    bool private ecoTokenSet;
    bool private registrySet;

    event TreeRegistered(uint256 indexed tokenId, address indexed planter, string ipfsHash);
    event TreeVerified(uint256 indexed tokenId, address indexed verifier, uint256 carbonScore);
    event TreeCutReported(uint256 indexed tokenId, address indexed reporter);
    event TreeCutConfirmed(uint256 indexed tokenId, address indexed verifier);
    event TreeReplanted(uint256 indexed tokenId, uint256 indexed originalTokenId);
    event TreeStatusUpdated(uint256 indexed tokenId, TreeStatus newStatus);
    event CreditsMinted(uint256 indexed tokenId, address indexed planter, uint256 amount);
    event EcoTokenSet(address indexed token);
    event RegistrySet(address indexed registry);

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ── Custom errors (cheaper bytecode than revert strings) ────────────────

    error EcoChain_TokenDoesNotExist();
    error EcoChain_TreeNotRegistered();
    error EcoChain_TreeNotVerified();
    error EcoChain_TreeNotCutReported();
    error EcoChain_TreeNotCutConfirmed();
    error EcoChain_CarbonScoreMustBePositive();
    error EcoChain_ZeroCreditAmount();
    error EcoChain_EcoTokenNotConfigured();
    error EcoChain_RegistryNotConfigured();
    error EcoChain_AtLeast3ReplacementsRequired();
    error EcoChain_ReplacementsOutOfRange();
    error EcoChain_DebtExistsForTree();
    error EcoChain_IPFSHashAlreadyRegistered();
    error EcoChain_DebtorIsNotPlanter();
    error EcoChain_NoDebtForTree();
    error EcoChain_ReplacerMustBeVerified();
    error EcoChain_ReplanterMismatch();
    error EcoChain_InvalidEcoToken();
    error EcoChain_InvalidRegistry();
    error EcoChain_EcoTokenAlreadySet();
    error EcoChain_RegistryAlreadySet();

    constructor() ERC721("EcoChain Tree", "ECOTREE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    // ── One-time configuration ─────────────────────────────────────────────

    /// @notice Set the EcoToken contract. Callable once, by an admin.
    function setEcoToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (ecoTokenSet) revert EcoChain_EcoTokenAlreadySet();
        if (token == address(0) || token.code.length == 0) revert EcoChain_InvalidEcoToken();

        ecoToken = token;
        ecoTokenSet = true;
        emit EcoTokenSet(token);
    }

    /// @notice Set the ReplantationRegistry contract. Callable once, by an admin.
    function setRegistry(address registry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (registrySet) revert EcoChain_RegistryAlreadySet();
        if (registry_ == address(0) || registry_.code.length == 0) revert EcoChain_InvalidRegistry();

        registry = registry_;
        registrySet = true;
        emit RegistrySet(registry_);
    }

    // ── Tree lifecycle ─────────────────────────────────────────────────────

    /// @notice Mint a new Tree NFT upon registration. Permissionless: any
    ///         wallet can register its own tree (planter = msg.sender).
    function registerTree(
        string memory ipfsHash,
        string memory metadataURI
    ) external returns (uint256) {
        if (ipfsHashUsed[ipfsHash]) revert EcoChain_IPFSHashAlreadyRegistered();

        _tokenIds++;
        uint256 tokenId = _tokenIds;
        address planter = msg.sender;

        _safeMint(planter, tokenId);
        _setTokenURI(tokenId, metadataURI);

        trees[tokenId] = TreeData({
            status: TreeStatus.REGISTERED,
            carbonScore: 0,
            planter: planter,
            ipfsHash: ipfsHash,
            registeredAt: block.timestamp,
            verifiedAt: 0
        });

        ipfsHashUsed[ipfsHash] = true;

        emit TreeRegistered(tokenId, planter, ipfsHash);
        return tokenId;
    }

    /// @notice Verify a tree and mint its carbon credits to the planter.
    /// @param tokenId The tree to verify.
    /// @param carbonScorePerYear The annual absorption rate in kg CO2 per year
    ///        **scaled by 100** (18.5 kg/yr is passed as 1850).
    /// @param plantedAt The unix timestamp at which the tree was planted. The
    ///        tree's age is derived from it, exactly as the backend derives it
    ///        from `trees.planted_at`.
    function verifyTree(
        uint256 tokenId,
        uint256 carbonScorePerYear,
        uint256 plantedAt
    ) external onlyRole(VERIFIER_ROLE) nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (trees[tokenId].status != TreeStatus.REGISTERED) revert EcoChain_TreeNotRegistered();
        if (carbonScorePerYear == 0) revert EcoChain_CarbonScoreMustBePositive();
        if (!ecoTokenSet) revert EcoChain_EcoTokenNotConfigured();

        uint256 amount = creditsForTree(carbonScorePerYear, plantedAt);
        if (amount == 0) revert EcoChain_ZeroCreditAmount();

        trees[tokenId].status = TreeStatus.VERIFIED;
        trees[tokenId].carbonScore = carbonScorePerYear;
        trees[tokenId].verifiedAt = block.timestamp;

        // Mint the credits to the planter in the same call, so that a
        // verified tree and its credits can never diverge.
        IEcoToken(ecoToken).mint(trees[tokenId].planter, amount);

        emit TreeVerified(tokenId, msg.sender, carbonScorePerYear);
        emit TreeStatusUpdated(tokenId, TreeStatus.VERIFIED);
        emit CreditsMinted(tokenId, trees[tokenId].planter, amount);
    }

    /// @notice Report a tree as cut.
    function reportCut(uint256 tokenId) external onlyRole(VERIFIER_ROLE) nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (trees[tokenId].status != TreeStatus.VERIFIED) revert EcoChain_TreeNotVerified();

        trees[tokenId].status = TreeStatus.CUT_REPORTED;

        emit TreeCutReported(tokenId, msg.sender);
        emit TreeStatusUpdated(tokenId, TreeStatus.CUT_REPORTED);
    }

    /// @notice Confirm a tree cut: create the replantation debt and freeze
    ///         the planter's credits.
    /// @param replacementsNeeded The number of replacement trees the planter
    ///        must plant. The backend computes this with
    ///        max(3, ceil(ageYears / 2)); the tree's age is not on-chain, so
    ///        the verifier supplies it and the contract enforces the floor of
    ///        3 that the formula guarantees.
    function confirmCut(uint256 tokenId, uint256 replacementsNeeded)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
    {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (trees[tokenId].status != TreeStatus.CUT_REPORTED) revert EcoChain_TreeNotCutReported();
        if (replacementsNeeded < 3) revert EcoChain_AtLeast3ReplacementsRequired();
        if (replacementsNeeded > type(uint16).max) revert EcoChain_ReplacementsOutOfRange();
        if (!registrySet) revert EcoChain_RegistryNotConfigured();
        if (!ecoTokenSet) revert EcoChain_EcoTokenNotConfigured();

        address planter = trees[tokenId].planter;

        // Register the debt first (it validates and reverts without touching
        // this contract's state), then flip the tree status and freeze the
        // planter's credits.
        uint256 debtId = IReplantationRegistry(registry).createDebt(
            tokenId,
            planter,
            uint16(replacementsNeeded)
        );
        require(debtId != 0, "EcoChain: debt creation failed");

        trees[tokenId].status = TreeStatus.CUT_CONFIRMED;

        // The freeze is account-level: none of the planter's credits can be
        // moved or burned until every one of their debts is cleared.
        IEcoToken(ecoToken).freeze(planter, true);

        emit TreeCutConfirmed(tokenId, msg.sender);
        emit TreeStatusUpdated(tokenId, TreeStatus.CUT_CONFIRMED);
    }

    /// @notice Mark a replacement tree as REPLANTED and link it to the debt.
    /// @param replacementTokenId The newly planted replacement tree.
    /// @param originalTokenId The cut tree being compensated.
    function markReplanted(uint256 replacementTokenId, uint256 originalTokenId)
        external
        onlyRole(VERIFIER_ROLE)
        nonReentrant
    {
        if (_ownerOf(replacementTokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (_ownerOf(originalTokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (
            trees[originalTokenId].status != TreeStatus.CUT_CONFIRMED &&
            trees[originalTokenId].status != TreeStatus.REPLANTED
        ) revert EcoChain_TreeNotCutConfirmed();
        if (trees[replacementTokenId].status != TreeStatus.VERIFIED) revert EcoChain_ReplacerMustBeVerified();
        if (trees[replacementTokenId].planter != trees[originalTokenId].planter)
            revert EcoChain_ReplanterMismatch();
        if (!registrySet) revert EcoChain_RegistryNotConfigured();

        uint256 debtId = IReplantationRegistry(registry).debtIdForOriginalToken(originalTokenId);
        if (debtId == 0) revert EcoChain_NoDebtForTree();

        // Link the replacement while it is still VERIFIED — the registry
        // requires that.
        IReplantationRegistry(registry).linkReplacement(debtId, replacementTokenId);

        trees[replacementTokenId].status = TreeStatus.REPLANTED;
        replacesTokenId[replacementTokenId] = originalTokenId;

        trees[originalTokenId].status = TreeStatus.REPLANTED;
        replacedByTokenId[originalTokenId] = replacementTokenId;

        // Clear the debt once every replacement has been planted. The debt
        // itself refuses to clear before that point.
        if (IReplantationRegistry(registry).isDebtFulfilled(debtId)) {
            IReplantationRegistry(registry).clearDebt(debtId, "");
        }

        emit TreeReplanted(replacementTokenId, originalTokenId);
        emit TreeStatusUpdated(replacementTokenId, TreeStatus.REPLANTED);
        emit TreeStatusUpdated(originalTokenId, TreeStatus.REPLANTED);
    }

    /// @notice Reject a tree registration.
    function rejectTree(uint256 tokenId) external onlyRole(VERIFIER_ROLE) nonReentrant {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        if (trees[tokenId].status != TreeStatus.REGISTERED) revert EcoChain_TreeNotRegistered();

        trees[tokenId].status = TreeStatus.REJECTED;

        emit TreeStatusUpdated(tokenId, TreeStatus.REJECTED);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    /// @notice Get on-chain details of a tree.
    function getTreeDetails(uint256 tokenId) external view returns (TreeData memory) {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        return trees[tokenId];
    }

    /// @inheritdoc IEcoChainTree
    function treePlanter(uint256 tokenId) external view returns (address) {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        return trees[tokenId].planter;
    }

    /// @inheritdoc IEcoChainTree
    function isTreeVerified(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) revert EcoChain_TokenDoesNotExist();
        return trees[tokenId].status == TreeStatus.VERIFIED;
    }

    /// @notice The number of carbon credits minted for a tree.
    /// @dev Mirrors `services.CreditsForTree` in the Go backend exactly;
    /// see the contract-level comment for the formula.
    function creditsForTree(uint256 carbonScorePerYear, uint256 plantedAt)
        public
        view
        returns (uint256)
    {
        // rate in 1e18 fixed point
        uint256 rateScaled = (carbonScorePerYear * ONE) / 100;
        if (rateScaled == 0) {
            rateScaled = DEFAULT_ABSORPTION_RATE;
        }

        // age in 1e18 fixed point, floored at MinTreeAgeYears
        uint256 elapsed = block.timestamp > plantedAt ? block.timestamp - plantedAt : 0;
        uint256 ageScaled = (elapsed * ONE) / SECONDS_PER_YEAR;
        if (ageScaled < MIN_TREE_AGE_YEARS) {
            ageScaled = MIN_TREE_AGE_YEARS;
        }

        // kg of CO2 sequestered, then credits (1 credit = 1000 kg).
        // kgScaled is already scaled by 1e18, so dividing by KG_PER_CREDIT
        // yields the credit amount in the same 1e18 fixed point.
        uint256 kgScaled = (rateScaled * ageScaled) / ONE;
        uint256 creditsScaled = kgScaled / KG_PER_CREDIT;

        // Round to four decimal places, matching math.Round(x*10000)/10000.
        uint256 units = (creditsScaled + CREDIT_DECIMALS / 2) / CREDIT_DECIMALS;
        return units * CREDIT_DECIMALS;
    }
}

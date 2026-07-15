// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title EcoChainTree
/// @notice ERC-721 NFT representing a registered biological tree asset.
/// @dev Tracks on-chain lifecycle states, verification records, and IPFS CIDs.
contract EcoChainTree is ERC721URIStorage, AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");

    uint256 private _tokenIds;

    enum TreeStatus {
        REGISTERED,     // 0 – NFT minted, pending verification
        VERIFIED,       // 1 – Verifier approved, carbon credits active
        CUT_REPORTED,   // 2 – Cut reported, credits frozen
        CUT_CONFIRMED,  // 3 – Cut confirmed, environmental debt created
        REPLANTED,      // 4 – Replacement tree planted and verified
        REJECTED        // 5 – Rejected by verifier
    }

    struct TreeData {
        TreeStatus status;
        uint256 carbonScore; // kg CO2 per year * 100
        address planter;
        string ipfsHash;
        uint256 registeredAt;
        uint256 verifiedAt;
    }

    mapping(uint256 => TreeData) public trees;
    mapping(string => bool) public ipfsHashUsed;
    mapping(uint256 => uint256) public replacesTokenId; // replacement NFT -> original cut token ID

    event TreeRegistered(uint256 indexed tokenId, address indexed planter, string ipfsHash);
    event TreeVerified(uint256 indexed tokenId, address indexed verifier, uint256 carbonScore);
    event TreeCutReported(uint256 indexed tokenId, address indexed reporter);
    event TreeCutConfirmed(uint256 indexed tokenId, address indexed verifier);
    event TreeReplanted(uint256 indexed tokenId, uint256 indexed originalTokenId);
    event TreeStatusUpdated(uint256 indexed tokenId, TreeStatus newStatus);

    constructor() ERC721("EcoChain Tree", "ECOTREE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// @notice Mint a new Tree NFT upon registration
    function registerTree(
        address planter,
        string memory ipfsHash,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(!ipfsHashUsed[ipfsHash], "EcoChain: IPFS hash already registered");

        _tokenIds++;
        uint256 tokenId = _tokenIds;

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

    /// @notice Verify a tree and associate its carbon score
    function verifyTree(uint256 tokenId, uint256 carbonScorePerYear)
        external onlyRole(VERIFIER_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "EcoChain: token does not exist");
        require(trees[tokenId].status == TreeStatus.REGISTERED, "EcoChain: tree must be in REGISTERED state");

        trees[tokenId].status = TreeStatus.VERIFIED;
        trees[tokenId].carbonScore = carbonScorePerYear;
        trees[tokenId].verifiedAt = block.timestamp;

        emit TreeVerified(tokenId, msg.sender, carbonScorePerYear);
        emit TreeStatusUpdated(tokenId, TreeStatus.VERIFIED);
    }

    /// @notice Report tree as cut
    function reportCut(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "EcoChain: token does not exist");
        trees[tokenId].status = TreeStatus.CUT_REPORTED;
        emit TreeCutReported(tokenId, msg.sender);
        emit TreeStatusUpdated(tokenId, TreeStatus.CUT_REPORTED);
    }

    /// @notice Confirm tree cut
    function confirmCut(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "EcoChain: token does not exist");
        require(trees[tokenId].status == TreeStatus.CUT_REPORTED, "EcoChain: must be in CUT_REPORTED");

        trees[tokenId].status = TreeStatus.CUT_CONFIRMED;

        emit TreeCutConfirmed(tokenId, msg.sender);
        emit TreeStatusUpdated(tokenId, TreeStatus.CUT_CONFIRMED);
    }

    /// @notice Mark a replacement tree as REPLANTED and link to original
    function markReplanted(uint256 newTokenId, uint256 originalTokenId)
        external onlyRole(VERIFIER_ROLE)
    {
        require(_ownerOf(newTokenId) != address(0), "EcoChain: new token does not exist");
        require(trees[newTokenId].status == TreeStatus.VERIFIED, "EcoChain: replacement must be VERIFIED");

        trees[newTokenId].status = TreeStatus.REPLANTED;
        replacesTokenId[newTokenId] = originalTokenId;

        emit TreeReplanted(newTokenId, originalTokenId);
        emit TreeStatusUpdated(newTokenId, TreeStatus.REPLANTED);
    }

    /// @notice Reject a tree registration
    function rejectTree(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "EcoChain: token does not exist");
        trees[tokenId].status = TreeStatus.REJECTED;
        emit TreeStatusUpdated(tokenId, TreeStatus.REJECTED);
    }

    /// @notice Get on-chain details of a tree
    function getTreeDetails(uint256 tokenId) external view returns (TreeData memory) {
        require(_ownerOf(tokenId) != address(0), "EcoChain: token does not exist");
        return trees[tokenId];
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIds;
    }

    function supportsInterface(bytes4 interfaceId)
        public view virtual override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

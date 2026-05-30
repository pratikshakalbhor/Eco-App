// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EcoChainTree is ERC721URIStorage, AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    uint256 private _nextTokenId;

    struct TreeInfo {
        string ipfsHash;
        uint256 plantedAt;
        bool verified;
        address planter;
    }

    mapping(uint256 => TreeInfo) public trees;
    mapping(string => bool) public hashExists;

    event TreeRegistered(uint256 indexed tokenId, address indexed planter, string ipfsHash);
    event TreeVerified(uint256 indexed tokenId, address indexed verifier);

    constructor() ERC721("EcoChainTree", "ECT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function registerTree(address planter, string memory ipfsHash, string memory metadataURI) public returns (uint256) {
        require(!hashExists[ipfsHash], "Tree image hash already registered");
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(planter, tokenId);
        _setTokenURI(tokenId, metadataURI);

        trees[tokenId] = TreeInfo({
            ipfsHash: ipfsHash,
            plantedAt: block.timestamp,
            verified: false,
            planter: planter
        });

        hashExists[ipfsHash] = true;
        emit TreeRegistered(tokenId, planter, ipfsHash);
        return tokenId;
    }

    function verifyTree(uint256 tokenId) public onlyRole(VERIFIER_ROLE) {
        require(_ownerOf(tokenId) != address(0), "Tree does not exist");
        require(!trees[tokenId].verified, "Tree already verified");

        trees[tokenId].verified = true;
        emit TreeVerified(tokenId, msg.sender);
    }

    function getTreeDetails(uint256 tokenId) public view returns (TreeInfo memory) {
        return trees[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

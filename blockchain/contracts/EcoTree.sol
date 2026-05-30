// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EcoTree is ERC721, Ownable {
    uint256 public nextTokenId;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => TreeData) public treeDetails;

    struct TreeData {
        string species;
        string location;
        string photoURI;
        uint256 plantedDate;
        bool verified;
        uint256 carbonCredits;
    }

    event TreePlanted(address indexed owner, uint256 tokenId, string species);
    event TreeVerified(uint256 tokenId, uint256 credits);

    constructor() ERC721("EcoTreeNFT", "ETREE") Ownable(msg.sender) {}

    function plantTree(
        string memory species,
        string memory location,
        string memory photoURI,
        string memory _tokenURI
    ) external returns (uint256) {
        require(bytes(species).length > 0, "Species cannot be empty");
        require(bytes(location).length > 0, "Location cannot be empty");

        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);
        _tokenURIs[tokenId] = _tokenURI;

        treeDetails[tokenId] = TreeData({
            species: species,
            location: location,
            photoURI: photoURI,
            plantedDate: block.timestamp,
            verified: false,
            carbonCredits: 0
        });

        emit TreePlanted(msg.sender, tokenId, species);
        return tokenId;
    }

    function verifyTree(uint256 tokenId, uint256 carbonCredits) external onlyOwner {
        require(tokenId < nextTokenId, "Token does not exist");
        require(!treeDetails[tokenId].verified, "Tree already verified");

        treeDetails[tokenId].verified = true;
        treeDetails[tokenId].carbonCredits = carbonCredits;

        emit TreeVerified(tokenId, carbonCredits);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < nextTokenId, "Token does not exist");
        return _tokenURIs[tokenId];
    }

    function getTreeDetails(uint256 tokenId) external view returns (TreeData memory) {
        require(tokenId < nextTokenId, "Token does not exist");
        return treeDetails[tokenId];
    }
}
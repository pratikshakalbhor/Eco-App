// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract TreeCuttingReport is AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    struct Report {
        uint256 tokenId;
        string reason;
        uint256 timestamp;
        address reporter;
    }

    mapping(uint256 => Report) public reports;

    event TreeCutReported(uint256 indexed tokenId, string reason);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function reportCutting(uint256 tokenId, string memory reason) public onlyRole(REPORTER_ROLE) {
        reports[tokenId] = Report(tokenId, reason, block.timestamp, msg.sender);
        emit TreeCutReported(tokenId, reason);
    }
}
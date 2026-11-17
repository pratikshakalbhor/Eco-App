const { ethers } = require("hardhat");
const { deployAndWire } = require("../../scripts/deployCore");

/**
 * Test fixture that deploys and wires the contracts exactly as production
 * does.
 *
 * It calls the very same `deployAndWire` helper the deployment script uses,
 * so the role layout under test is identical to the deployed one. In
 * particular:
 *
 *   - the deployer holds NO admin role after the fixture runs;
 *   - the EcoToken MINTER_ROLE belongs to the EcoChainTree contract only, so
 *     the tests cannot mint directly and must go through `verifyTree`;
 *   - the registry has no role that could create, link or clear a debt.
 *
 * The signer layout:
 *   0 deployer  1 admin  2 verifier  3 pauser  4 freezer
 *   5 planter   6 other  7 debtor
 */
async function deployFixture() {
    const signers = await ethers.getSigners();

    const [deployer, admin, verifier, pauser, freezer, planter, other, debtor] = signers;

    const deployed = await deployAndWire({
        admin: admin.address,
        verifier: verifier.address,
        pauser: pauser.address,
        freezer: freezer.address,
    });

    return {
        ...deployed,
        deployerSigner: deployer,
        adminSigner: admin,
        verifierSigner: verifier,
        pauserSigner: pauser,
        freezerSigner: freezer,
        planterSigner: planter,
        otherSigner: other,
        debtorSigner: debtor,
    };
}

/**
 * The most recent block timestamp seen by the node.
 */
async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

/**
 * Registers a tree for `planter` and verifies it, minting credits.
 *
 * @param {object} ctx         the fixture context
 * @param {object} planter     the signer that will own the tree
 * @param {string} ipfsHash    a unique IPFS hash for the tree
 * @param {object} options     { carbonScorePerYear, plantedAt }
 * @returns the token id of the verified tree.
 */
async function registerAndVerify(ctx, planter, ipfsHash, options = {}) {
    const { carbonScorePerYear = 1850, plantedAt = undefined } = options;

    const planted = plantedAt ?? (await latestTimestamp());

    await (
        await ctx.ecoChainTree
            .connect(planter)
            .registerTree(ipfsHash, `ipfs://${ipfsHash}`)
    ).wait();

    const tokenId = await ctx.ecoChainTree.totalSupply();

    await (
        await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(tokenId, carbonScorePerYear, planted)
    ).wait();

    return tokenId;
}

module.exports = { deployFixture, registerAndVerify, latestTimestamp };

const { ethers } = require("hardhat");

/**
 * Deploys the EcoChain contracts and wires the roles.
 *
 * This function is the single source of truth for the deployment wiring. It is
 * used by BOTH `scripts/deploy.js` (production) and `test/fixtures/deploy.js`
 * (the test-suite), so the tests exercise exactly the role layout that is
 * deployed — no hidden role grants in a `beforeEach` that production does not
 * perform.
 *
 * Role layout produced here:
 *
 *   EcoToken
 *     DEFAULT_ADMIN_ROLE -> admin
 *     MINTER_ROLE        -> EcoChainTree   (the deployer is revoked)
 *     PAUSER_ROLE        -> pauser
 *     FREEZER_ROLE       -> EcoChainTree, ReplantationRegistry, freezer
 *
 *   EcoChainTree
 *     DEFAULT_ADMIN_ROLE -> admin
 *     VERIFIER_ROLE      -> verifier
 *     (no MINTER_ROLE: registerTree is permissionless)
 *
 *   ReplantationRegistry
 *     DEFAULT_ADMIN_ROLE -> admin
 *     (no other role: it trusts only the EcoChainTree contract)
 *
 * The deployer steps down from every role it handed over, so in production
 * the deployer key holds nothing.
 *
 * @param {object} options
 * @param {string} [options.admin]    Address that receives DEFAULT_ADMIN_ROLE.
 *                                    A multisig address is supported.
 * @param {string} [options.verifier] Address that receives VERIFIER_ROLE.
 * @param {string} [options.pauser]   Address that receives PAUSER_ROLE.
 * @param {string} [options.freezer]  Address that receives FREEZER_ROLE.
 */
async function deployAndWire(options = {}) {
    const [deployer] = await ethers.getSigners();

    const admin = options.admin || deployer.address;
    const verifier = options.verifier || deployer.address;
    const pauser = options.pauser || admin;
    const freezer = options.freezer || admin;

    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

    // ── Deploy ─────────────────────────────────────────────────────────────
    const EcoToken = await ethers.getContractFactory("EcoToken");
    const ecoToken = await EcoToken.deploy();
    await ecoToken.waitForDeployment();

    const ReplantationRegistry = await ethers.getContractFactory("ReplantationRegistry");
    const registry = await ReplantationRegistry.deploy();
    await registry.waitForDeployment();

    const EcoChainTree = await ethers.getContractFactory("EcoChainTree");
    const ecoChainTree = await EcoChainTree.deploy();
    await ecoChainTree.waitForDeployment();

    const ecoTokenAddress = await ecoToken.getAddress();
    const registryAddress = await registry.getAddress();
    const ecoChainTreeAddress = await ecoChainTree.getAddress();

    // ── One-time configuration ─────────────────────────────────────────────
    // The deployer still holds DEFAULT_ADMIN_ROLE at this point.
    await (await registry.setTreeRegistry(ecoChainTreeAddress)).wait();
    await (await registry.setEcoToken(ecoTokenAddress)).wait();
    await (await ecoChainTree.setEcoToken(ecoTokenAddress)).wait();
    await (await ecoChainTree.setRegistry(registryAddress)).wait();

    // ── Roles: grant everything first ─────────────────────────────────────
    const tokenMinterRole = await ecoToken.MINTER_ROLE();
    const tokenPauserRole = await ecoToken.PAUSER_ROLE();
    const tokenFreezerRole = await ecoToken.FREEZER_ROLE();
    const treeVerifierRole = await ecoChainTree.VERIFIER_ROLE();

    // EcoToken: only the tree contract may mint credits.
    await (await ecoToken.grantRole(tokenMinterRole, ecoChainTreeAddress)).wait();

    // EcoToken: the tree contract freezes a planter on a confirmed cut and
    // the registry lifts the freeze when the debt is cleared.
    await (await ecoToken.grantRole(tokenFreezerRole, ecoChainTreeAddress)).wait();
    await (await ecoToken.grantRole(tokenFreezerRole, registryAddress)).wait();
    await (await ecoToken.grantRole(tokenFreezerRole, freezer)).wait();

    await (await ecoToken.grantRole(tokenPauserRole, pauser)).wait();

    // EcoChainTree: verification only. registerTree is permissionless.
    await (await ecoChainTree.grantRole(treeVerifierRole, verifier)).wait();

    // Admin hand-over. A multisig can be used here: it receives the role
    // directly from the deployer and does not need to sign anything.
    for (const contract of [ecoToken, ecoChainTree, registry]) {
        await (await contract.grantRole(DEFAULT_ADMIN_ROLE, admin)).wait();
    }

    // ── Roles: then step the deployer down ─────────────────────────────────
    await (await ecoToken.revokeRole(tokenMinterRole, deployer.address)).wait();

    if (pauser !== deployer.address) {
        await (await ecoToken.revokeRole(tokenPauserRole, deployer.address)).wait();
    }
    if (freezer !== deployer.address) {
        await (await ecoToken.revokeRole(tokenFreezerRole, deployer.address)).wait();
    }
    if (verifier !== deployer.address) {
        await (await ecoChainTree.revokeRole(treeVerifierRole, deployer.address)).wait();
    }
    if (admin !== deployer.address) {
        for (const contract of [ecoToken, ecoChainTree, registry]) {
            await (await contract.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();
        }
    }

    return {
        deployer,
        admin,
        verifier,
        pauser,
        freezer,
        ecoToken,
        registry,
        ecoChainTree,
        addresses: {
            ecoToken: ecoTokenAddress,
            ecoChainTree: ecoChainTreeAddress,
            reparationRegistry: registryAddress,
        },
    };
}

module.exports = { deployAndWire };

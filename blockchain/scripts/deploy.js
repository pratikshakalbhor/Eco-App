const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { deployAndWire } = require("./deployCore");

/**
 * Deploys the EcoChain contracts to the selected network.
 *
 * Role addresses are read from the environment so that the privileged keys
 * are not the deployer's:
 *
 *   ADMIN     receives DEFAULT_ADMIN_ROLE on all three contracts.
 *             A multisig (Gnosis Safe) address is supported — it receives
 *             the role directly from the deployer and does not have to sign
 *             anything during deployment.
 *   VERIFIER  receives VERIFIER_ROLE and MINTER_ROLE on EcoChainTree.
 *   PAUSER    receives PAUSER_ROLE on EcoToken (defaults to ADMIN).
 *   FREEZER   receives FREEZER_ROLE on EcoToken (defaults to ADMIN).
 *
 * The deployer steps down from every role it hands over.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network sepolia
 */
async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId.toString();

    console.log(`\nDeploying EcoChain contracts to "${network.name}" (chainId ${chainId})`);

    const deployer = (await ethers.getSigners())[0];
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

    const admin = process.env.ADMIN || deployer.address;
    const verifier = process.env.VERIFIER || deployer.address;
    const pauser = process.env.PAUSER || admin;
    const freezer = process.env.FREEZER || admin;

    console.log(`ADMIN:    ${admin}`);
    console.log(`VERIFIER: ${verifier}`);
    console.log(`PAUSER:   ${pauser}`);
    console.log(`FREEZER:  ${freezer}`);

    const result = await deployAndWire({ admin, verifier, pauser, freezer });
    const { ecoToken, registry, ecoChainTree, addresses } = result;

    console.log("\nDeployed contracts:");
    console.log(`  EcoToken            ${addresses.ecoToken}`);
    console.log(`  EcoChainTree        ${addresses.ecoChainTree}`);
    console.log(`  ReplantationRegistry ${addresses.replantationRegistry}`);

    // ── Record the deployment ──────────────────────────────────────────────
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    fs.mkdirSync(deploymentsDir, { recursive: true });

    const record = {
        network: network.name,
        chainId,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        roles: { admin, verifier, pauser, freezer },
        contracts: {
            EcoToken: addresses.ecoToken,
            EcoChainTree: addresses.ecoChainTree,
            ReplantationRegistry: addresses.replantationRegistry,
        },
    };

    const recordPath = path.join(deploymentsDir, `${network.name}.json`);
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`\nDeployment recorded in ${path.relative(process.cwd(), recordPath)}`);

    // ── Ready-to-paste environment blocks ─────────────────────────────────
    const treeClientEnv = [
        "# TreeClient/.env",
        `VITE_API_URL=http://localhost:8080`,
        "",
        "# Deployed contract addresses",
        `VITE_ECO_TOKEN=${addresses.ecoToken}`,
        `VITE_ECO_CHAIN_TREE=${addresses.ecoChainTree}`,
        `VITE_REPLANTATION_REGISTRY=${addresses.replantationRegistry}`,
        "",
        "# Sepolia network",
        `VITE_CHAIN_ID=${chainId}`,
        `VITE_RPC_URL=${process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com"}`,
        `VITE_EXPLORER_URL=${process.env.VITE_EXPLORER_URL || "https://sepolia.etherscan.io"}`,
    ].join("\n");

    const backendEnv = [
        "# Backend/api-server/.env",
        `DB_HOST=${process.env.DB_HOST || "your-supabase-db-host"}`,
        `DB_USER=${process.env.DB_USER || "postgres"}`,
        `DB_PASSWORD=${process.env.DB_PASSWORD || "your-password"}`,
        `DB_NAME=${process.env.DB_NAME || "postgres"}`,
        `DB_PORT=${process.env.DB_PORT || "6543"}`,
        `DB_SSLMODE=${process.env.DB_SSLMODE || "require"}`,
        "",
        "JWT_SECRET=replace-with-a-long-random-secret",
        "",
        "PINATA_JWT=replace-with-your-pinata-jwt",
        "PINATA_API_KEY=replace-with-your-pinata-api-key",
        "PINATA_SECRET_KEY=replace-with-your-pinata-secret-key",
        "",
        `CORS_ORIGINS=${process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000"}`,
        "",
        "PORT=8080",
        "",
        "# Blockchain verification",
        `RPC_URL=${process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com"}`,
        `ECO_CHAIN_TREE=${addresses.ecoChainTree}`,
        `ECO_TOKEN=${addresses.ecoToken}`,
        "",
        "# Wallet that receives marketplace payments (the frontend reads it from",
        "# GET /api/marketplace/payment-config, so it does not need its own copy)",
        "PLATFORM_WALLET=",
        "ETH_INR_RATE=320000",
        "",
        "CARBON_KG_PER_CREDIT=1000",
    ].join("\n");

    console.log("\n" + "=".repeat(70));
    console.log("READY TO PASTE — TreeClient/.env");
    console.log("=".repeat(70));
    console.log(treeClientEnv);
    console.log("\n" + "=".repeat(70));
    console.log("READY TO PASTE — Backend/api-server/.env");
    console.log("=".repeat(70));
    console.log(backendEnv);
    console.log("=".repeat(70) + "\n");

    // Sanity check that the wiring took effect.
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const adminHasRole = await ecoToken.hasRole(DEFAULT_ADMIN_ROLE, admin);
    const treeCanMint = await ecoToken.hasRole(await ecoToken.MINTER_ROLE(), addresses.ecoChainTree);
    const deployerCanMint = await ecoToken.hasRole(await ecoToken.MINTER_ROLE(), deployer.address);
    console.log("Wiring check:");
    console.log(`  admin holds DEFAULT_ADMIN_ROLE:        ${adminHasRole}`);
    console.log(`  EcoChainTree holds EcoToken MINTER_ROLE: ${treeCanMint}`);
    console.log(`  deployer still holds MINTER_ROLE:       ${deployerCanMint}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

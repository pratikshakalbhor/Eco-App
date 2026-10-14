const { ethers } = require("hardhat");

async function main() {
  console.log("Starting EcoChain contract deployment...");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying with account:", deployerAddress);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployerAddress)), "ETH");

  const gasOverride = {
    gasLimit: 3000000,
  };

  // 1. Deploy EcoToken (primary Carbon Credit ERC-20)
  console.log("\n[1/4] Deploying EcoToken (Carbon Credit ERC-20)...");
  const EcoToken = await ethers.getContractFactory("EcoToken");
  const ecoToken = await EcoToken.deploy(gasOverride);
  await ecoToken.waitForDeployment();
  const ecoTokenAddr = await ecoToken.getAddress();
  console.log(`  ✅ EcoToken deployed: ${ecoTokenAddr}`);

  // 2. Deploy EcoChainTree (primary Tree NFT ERC-721)
  console.log("\n[2/4] Deploying EcoChainTree (Tree NFT ERC-721)...");
  const EcoChainTree = await ethers.getContractFactory("EcoChainTree");
  const ecoChainTree = await EcoChainTree.deploy(gasOverride);
  await ecoChainTree.waitForDeployment();
  const ecoChainTreeAddr = await ecoChainTree.getAddress();
  console.log(`  ✅ EcoChainTree deployed: ${ecoChainTreeAddr}`);

  // 3. Deploy TreeCuttingReport
  console.log("\n[3/4] Deploying TreeCuttingReport...");
  const TreeCuttingReport = await ethers.getContractFactory("TreeCuttingReport");
  const treeCuttingReport = await TreeCuttingReport.deploy(gasOverride);
  await treeCuttingReport.waitForDeployment();
  const treeCuttingReportAddr = await treeCuttingReport.getAddress();
  console.log(`  ✅ TreeCuttingReport deployed: ${treeCuttingReportAddr}`);

  // 4. Deploy ReplantationRegistry
  console.log("\n[4/4] Deploying ReplantationRegistry...");
  const ReplantationRegistry = await ethers.getContractFactory("ReplantationRegistry");
  const replantationRegistry = await ReplantationRegistry.deploy(gasOverride);
  await replantationRegistry.waitForDeployment();
  const replantationRegistryAddr = await replantationRegistry.getAddress();
  console.log(`  ✅ ReplantationRegistry deployed: ${replantationRegistryAddr}`);

  // Grant roles
  console.log("\nConfiguring roles...");
  
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  const RECORDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RECORDER_ROLE"));
  const REPORTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REPORTER_ROLE"));

  // Check and grant MINTER_ROLE on EcoToken to EcoChainTree contract
  console.log("Granting MINTER_ROLE on EcoToken to EcoChainTree...");
  const tx1 = await ecoToken.grantRole(MINTER_ROLE, ecoChainTreeAddr, gasOverride);
  await tx1.wait();
  console.log("  ✅ EcoChainTree can now mint EcoToken carbon credits");

  // Grant MINTER_ROLE on EcoChainTree to deployer
  console.log("Granting MINTER_ROLE on EcoChainTree to deployer...");
  const tx2 = await ecoChainTree.grantRole(MINTER_ROLE, deployerAddress, gasOverride);
  await tx2.wait();
  console.log("  ✅ Deployer can now mint trees on-chain");

  // Grant VERIFIER_ROLE on EcoChainTree to deployer
  console.log("Granting VERIFIER_ROLE on EcoChainTree to deployer...");
  const tx3 = await ecoChainTree.grantRole(VERIFIER_ROLE, deployerAddress, gasOverride);
  await tx3.wait();
  console.log("  ✅ Deployer has VERIFIER_ROLE on EcoChainTree");

  // Grant RECORDER_ROLE on ReplantationRegistry to deployer
  console.log("Granting RECORDER_ROLE on ReplantationRegistry to deployer...");
  const tx4 = await replantationRegistry.grantRole(RECORDER_ROLE, deployerAddress, gasOverride);
  await tx4.wait();
  console.log("  ✅ Deployer has RECORDER_ROLE on ReplantationRegistry");

  // Grant REPORTER_ROLE on TreeCuttingReport to deployer
  console.log("Granting REPORTER_ROLE on TreeCuttingReport to deployer...");
  const tx5 = await treeCuttingReport.grantRole(REPORTER_ROLE, deployerAddress, gasOverride);
  await tx5.wait();
  console.log("  ✅ Deployer has REPORTER_ROLE on TreeCuttingReport");

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`EcoToken (Carbon Credits ERC-20):     ${ecoTokenAddr}`);
  console.log(`EcoChainTree (Tree NFT ERC-721):       ${ecoChainTreeAddr}`);
  console.log(`TreeCuttingReport:                     ${treeCuttingReportAddr}`);
  console.log(`ReplantationRegistry:                  ${replantationRegistryAddr}`);
  console.log("=".repeat(60));
  console.log("\nAdd these to your .env File:");
  console.log(`VITE_ECO_TOKEN=${ecoTokenAddr}`);
  console.log(`VITE_ECO_CHAIN_TREE=${ecoChainTreeAddr}`);
  console.log(`VITE_TREE_CUTTING_REPORT=${treeCuttingReportAddr}`);
  console.log(`VITE_REPLANTATION_REGISTRY=${replantationRegistryAddr}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

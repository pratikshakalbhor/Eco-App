const { ethers } = require("hardhat");

async function main() {
  console.log("Starting full EcoChain deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", await deployer.getAddress());

  // 1. Deploy EcoToken
  console.log("Deploying EcoToken...");
  const EcoToken = await ethers.getContractFactory("EcoToken");
  const ecoToken = await EcoToken.deploy();
  await ecoToken.waitForDeployment();
  console.log(`EcoToken deployed to: ${await ecoToken.getAddress()}`);

  // 2. Deploy CarbonCredit
  console.log("Deploying CarbonCredit...");
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const carbonCredit = await CarbonCredit.deploy();
  await carbonCredit.waitForDeployment();
  console.log(`CarbonCredit deployed to: ${await carbonCredit.getAddress()}`);

  // 3. Deploy EcoTree
  console.log("Deploying EcoTree...");
  const EcoTree = await ethers.getContractFactory("EcoTree");
  const ecoTree = await EcoTree.deploy();
  await ecoTree.waitForDeployment();
  console.log(`EcoTree deployed to: ${await ecoTree.getAddress()}`);

  // 4. Deploy TreeCuttingReport
  console.log("Deploying TreeCuttingReport...");
  const TreeCuttingReport = await ethers.getContractFactory("TreeCuttingReport");
  const treeCuttingReport = await TreeCuttingReport.deploy();
  await treeCuttingReport.waitForDeployment();
  console.log(`TreeCuttingReport deployed to: ${await treeCuttingReport.getAddress()}`);

  // 5. Deploy EcoChainTree
  console.log("Deploying EcoChainTree...");
  const EcoChainTree = await ethers.getContractFactory("EcoChainTree");
  const ecoChainTree = await EcoChainTree.deploy();
  await ecoChainTree.waitForDeployment();
  console.log(`EcoChainTree deployed to: ${await ecoChainTree.getAddress()}`);

  console.log("\n--------------------------------------------------");
  console.log("Deployment Summary:");
  console.log(`EcoToken: ${await ecoToken.getAddress()}`);
  console.log(`CarbonCredit: ${await carbonCredit.getAddress()}`);
  console.log(`EcoTree: ${await ecoTree.getAddress()}`);
  console.log(`TreeCuttingReport: ${await treeCuttingReport.getAddress()}`);
  console.log(`EcoChainTree: ${await ecoChainTree.getAddress()}`);
  console.log("--------------------------------------------------\n");

  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

const hre = require("hardhat");

async function main() {
  const EcoTree = await hre.ethers.getContractFactory("EcoTree");
  const ecoTree = await EcoTree.deploy();

  await ecoTree.deployed();
  console.log(" EcoTree deployed to:", ecoTree.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

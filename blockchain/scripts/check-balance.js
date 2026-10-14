const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("-----------------------------------------");
  console.log(`ADDR: ${deployer.address}`);
  console.log(`BAL:  ${ethers.formatEther(balance)} ETH`);
  console.log("-----------------------------------------");
  if (balance === 0n) {
    console.log("ALARM: BALANCE IS ZERO!");
  } else {
    console.log("SUCCESS: YOU HAVE ETHER!");
  }
}

main().catch(console.error);

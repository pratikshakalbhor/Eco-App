const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xa838cf6bB183f1D41CeFe39b65B90124a19AB214";
  const targetAddress = "0x22b94a9953db57760ef54f010ba304a79bfabed2";
  
  const EcoChainTree = await ethers.getContractAt("EcoChainTree", contractAddress);
  
  const VERIFIER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VERIFIER_ROLE"));
  
  console.log(`Granting VERIFIER_ROLE to ${targetAddress} on contract ${contractAddress}...`);
  
  const tx = await EcoChainTree.grantRole(VERIFIER_ROLE, targetAddress);
  await tx.wait();
  
  console.log("Role granted successfully!");
  
  const hasRole = await EcoChainTree.hasRole(VERIFIER_ROLE, targetAddress);
  console.log(`Address ${targetAddress} has VERIFIER_ROLE: ${hasRole}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

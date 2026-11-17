const { ethers } = require("hardhat");

/**
 * Grants one AccessControl role on one deployed EcoChain contract.
 *
 * Everything is supplied through the environment so the script can be used for
 * any contract/role without editing source (the previous version hardcoded a
 * contract address and a grantee, which made it easy to grant a role on the
 * wrong deployment).
 *
 * Usage (the signer must hold that contract's DEFAULT_ADMIN_ROLE):
 *
 *   CONTRACT_ADDRESS=0x... \
 *   CONTRACT=EcoChainTree \
 *   GRANTEE=0x... \
 *   ROLE=VERIFIER_ROLE \
 *   npx hardhat run scripts/grant-role.js --network sepolia
 *
 * CONTRACT is the artifact name and defaults to EcoChainTree. ROLE names are
 * the public constants on the contract:
 *   EcoChainTree: VERIFIER_ROLE
 *   EcoToken:     MINTER_ROLE, PAUSER_ROLE, FREEZER_ROLE
 *   Any contract: DEFAULT_ADMIN_ROLE
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const contractName = process.env.CONTRACT || "EcoChainTree";
  const targetAddress = process.env.GRANTEE;
  const roleName = process.env.ROLE || "VERIFIER_ROLE";

  if (!contractAddress || !ethers.isAddress(contractAddress)) {
    throw new Error("CONTRACT_ADDRESS must be set to a deployed contract address");
  }
  if (!targetAddress || !ethers.isAddress(targetAddress)) {
    throw new Error("GRANTEE must be set to the wallet that should receive the role");
  }
  if (!/^[A-Z_]+$/.test(roleName)) {
    throw new Error(`ROLE "${roleName}" is not an AccessControl role constant`);
  }

  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt(contractName, contractAddress);

  let role;
  try {
    role = await contract[roleName]();
  } catch {
    throw new Error(`${roleName} is not exposed by the ${contractName} at ${contractAddress}`);
  }

  console.log(`Contract: ${contractName} at ${contractAddress}`);
  console.log(`Role:     ${roleName} (${role})`);
  console.log(`Grantee:  ${targetAddress}`);
  console.log(`Signer:   ${signer.address}`);

  const tx = await contract.grantRole(role, targetAddress);
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();

  const hasRole = await contract.hasRole(role, targetAddress);
  console.log(`${targetAddress} has ${roleName}: ${hasRole}`);
  if (!hasRole) {
    throw new Error("role grant did not take effect");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

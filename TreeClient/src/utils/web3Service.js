import { ethers } from "ethers";
import EcoChainTreeABI from "../contracts/EcoChainTree.json";
import EcoTokenABI from "../contracts/EcoToken.json";
import ReplantationRegistryABI from "../contracts/ReplantationRegistry.json";
import { describeChainError, formatEcoBalance } from "./chainErrors";

/**
 * Run a contract write and rethrow failures as readable messages.
 * Permission errors from the contracts are shown as permission errors, never
 * as gas problems.
 */
const withFriendlyErrors = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`${label} failed: ${describeChainError(error)}`);
  }
};


// ─── Contract Addresses from Environment ────────────────────────────────────
// One variable per deployed contract. These are the verified deployments from
// blockchain/scripts/deploy.js (verified live via eth_getCode on Sepolia).
const CONTRACT_ADDRESSES = {
  ecoToken: import.meta.env.VITE_ECO_TOKEN,
  ecoChainTree: import.meta.env.VITE_ECO_CHAIN_TREE,
  replantationRegistry: import.meta.env.VITE_REPLANTATION_REGISTRY,
};

// ─── Sepolia Network Config ─────────────────────────────────────────────────
const SEPOLIA_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "11155111");
const SEPOLIA_CHAIN_HEX = `0x${SEPOLIA_CHAIN_ID.toString(16)}`;

// ─── Provider Detection ─────────────────────────────────────────────────────
const waitForEthereum = () => {
  return new Promise((resolve) => {
    if (window.ethereum) {
      resolve(window.ethereum);
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.ethereum) {
          clearInterval(interval);
          resolve(window.ethereum);
        } else if (attempts > 10) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    }
  });
};

/**
 * Get the MetaMask-compatible provider, handling multi-provider wallets.
 */
const getMetaMaskProvider = () => {
  if (!window.ethereum) return null;
  if (window.ethereum.providers) {
    return window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum.providers[0];
  }
  return window.ethereum;
};

// ─── Network Validation ─────────────────────────────────────────────────────

/**
 * Check if user is on Sepolia network.
 * @returns {Promise<boolean>}
 */
export const isSepoliaNetwork = async () => {
  const provider = getMetaMaskProvider();
  if (!provider) return false;
  try {
    const chainId = await provider.request({ method: "eth_chainId" });
    return parseInt(chainId, 16) === SEPOLIA_CHAIN_ID;
  } catch {
    return false;
  }
};

/**
 * Prompt user to switch to Sepolia. Returns true if switch succeeded.
 */
export const switchToSepolia = async () => {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("MetaMask is not detected.");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_HEX }],
    });
    return true;
  } catch (switchError) {
    // 4902 = chain not added — try to add it
    if (switchError.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_HEX,
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [import.meta.env.VITE_RPC_URL || "https://rpc.sepolia.org"],
            blockExplorerUrls: [import.meta.env.VITE_EXPLORER_URL || "https://sepolia.etherscan.io"],
          },
        ],
      });
      return true;
    }
    throw switchError;
  }
};

/**
 * Ensure the user is on Sepolia before proceeding. Throws if they reject.
 */
export const ensureSepolia = async () => {
  const onSepolia = await isSepoliaNetwork();
  if (!onSepolia) {
    await switchToSepolia();
  }
};

// ─── Wallet Connection ──────────────────────────────────────────────────────

/**
 * Connect MetaMask wallet. Returns { address, signer, provider }.
 */
export const connectWallet = async () => {
  console.log("Checking for window.ethereum...");
  const eth = await waitForEthereum();

  if (!eth) {
    console.error("window.ethereum is undefined");
    throw new Error("MetaMask is not detected. Please install the extension.");
  }

  try {
    const provider = getMetaMaskProvider();

    // Ensure Sepolia network before connecting
    await ensureSepolia();

    console.log("Requesting accounts...");
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    console.log("Accounts received:", accounts);

    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    return { address: accounts[0], signer, provider: ethersProvider };
  } catch (error) {
    console.error("Wallet connection error:", error);
    if (error.code === 4001) {
      throw new Error("Connection request was rejected. Please connect your wallet.");
    }
    throw error;
  }
};

/**
 * Sign a message using the connected wallet.
 */
export const signMessage = async (message) => {
  const provider = getMetaMaskProvider();
  if (!provider) return null;
  const ethersProvider = new ethers.BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  return signer.signMessage(message);
};

// ─── Contract Instances ─────────────────────────────────────────────────────

/**
 * Get a contract instance connected to the signer.
 * @param {"ecoToken"|"ecoChainTree"|"replantationRegistry"} contractName
 * @param {ethers.Signer} signer
 */
export const getContract = (contractName, signer) => {
  const abiMap = {
    ecoToken: EcoTokenABI.abi,
    ecoChainTree: EcoChainTreeABI.abi,
    replantationRegistry: ReplantationRegistryABI.abi,
  };

  const address = CONTRACT_ADDRESSES[contractName];
  const abi = abiMap[contractName];

  if (!address) throw new Error(`Contract address not configured for: ${contractName}`);
  if (!abi) throw new Error(`ABI not found for: ${contractName}`);

  return new ethers.Contract(address, abi, signer);
};

/**
 * Get a read-only contract (no signer needed).
 */
export const getReadOnlyContract = async (contractName) => {
  const provider = getMetaMaskProvider();
  if (!provider) throw new Error("MetaMask not detected");
  const ethersProvider = new ethers.BrowserProvider(provider);
  return getContract(contractName, ethersProvider);
};

// ─── EcoChainTree Operations ────────────────────────────────────────────────
// registerTree is permissionless: planter = msg.sender automatically.

/**
 * Register a tree on the EcoChainTree contract.
 * @param {string} ipfsHash - IPFS hash of tree metadata/photo
 * @param {string} metadataURI - metadata URI
 * @returns {{ receipt, tokenId: string }}
 */
export const registerTreeOnChain = async (ipfsHash, metadataURI) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  return withFriendlyErrors("Tree registration", async () => {
    const tx = await contract.registerTree(ipfsHash, metadataURI);
    const receipt = await tx.wait();

    // Extract tokenId from TreeRegistered event
    const event = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsedLog) => parsedLog && parsedLog.name === "TreeRegistered");

    return {
      receipt,
      tokenId: event ? event.args.tokenId.toString() : null,
      txHash: receipt.hash,
    };
  });
};

/**
 * Verify a tree on-chain (EcoChainTree — verifier role required).
 * @param {string|number} tokenId - tree NFT token id
 * @param {number} carbonScorePerYear - absorption rate in kg CO2/year, scaled by 100
 * @param {number} plantedAt - unix timestamp when tree was planted
 * @returns {{ receipt, txHash }}
 */
export const verifyTreeOnChain = async (tokenId, carbonScorePerYear = 1850, plantedAt) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  return withFriendlyErrors("Tree verification", async () => {
    const tx = await contract.verifyTree(tokenId, carbonScorePerYear, plantedAt);
    const receipt = await tx.wait();
    return { receipt, txHash: receipt.hash };
  });
};

/**
 * Report a tree as cut on-chain (EcoChainTree — verifier role required).
 * Must run before confirmCut, which only accepts a tree in CUT_REPORTED.
 * @param {string|number} tokenId
 * @returns {{ receipt, txHash }}
 */
export const reportTreeCutOnChain = async (tokenId) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  return withFriendlyErrors("Cut report", async () => {
    const tx = await contract.reportCut(tokenId);
    const receipt = await tx.wait();
    return { receipt, txHash: receipt.hash };
  });
};

/**
 * Confirm a tree cut on-chain (EcoChainTree — verifier role required).
 * Creates replantation debt and freezes the planter's credits.
 * @param {string|number} tokenId - tree NFT token id
 * @param {number} replacementsNeeded - max(3, ceil(ageYears/2))
 * @returns {{ receipt, txHash }}
 */
export const confirmTreeCutOnChain = async (tokenId, replacementsNeeded = 3) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  return withFriendlyErrors("Cut confirmation", async () => {
    const tx = await contract.confirmCut(tokenId, replacementsNeeded);
    const receipt = await tx.wait();
    return { receipt, txHash: receipt.hash };
  });
};

/**
 * Register a verified replacement tree against the original tree's open debt
 * (EcoChainTree.markReplanted — verifier role required). The EcoChainTree
 * contract is the only account the ReplantationRegistry trusts, so this is
 * the only on-chain replant path.
 * @param {string|number} replacementTokenId - verified replacement tree token id
 * @param {string|number} originalTokenId - token id of the tree that was cut
 * @returns {{ receipt, txHash }}
 */
export const markReplantedOnChain = async (replacementTokenId, originalTokenId) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  return withFriendlyErrors("Linking the replacement tree", async () => {
    const tx = await contract.markReplanted(replacementTokenId, originalTokenId);
    const receipt = await tx.wait();
    return { receipt, txHash: receipt.hash };
  });
};

/**
 * Burn credits on-chain (EcoToken.burn), permanently retiring them.
 *
 * The returned transaction hash must be posted to /api/credits/burn, where the
 * backend decodes the ERC-20 Transfer-to-zero event and records the retirement.
 * @param {string|number} amount - credits to burn (18-decimal token units)
 * @returns {{ receipt, txHash }}
 */
export const burnCreditsOnChain = async (amount) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoToken", signer);
  const parsed = ethers.parseUnits(String(amount), 18);
  if (parsed <= 0n) throw new Error("Burn amount must be greater than zero");

  return withFriendlyErrors("Credit burn", async () => {
    const tx = await contract.burn(parsed);
    const receipt = await tx.wait();
    return { receipt, txHash: receipt.hash };
  });
};

/**
 * Get on-chain tree details by tokenId.
 */
export const getTreeDetailsOnChain = async (tokenId) => {
  const contract = await getReadOnlyContract("ecoChainTree");
  return contract.getTreeDetails(tokenId);
};

// ─── EcoToken (ERC-20) Operations ───────────────────────────────────────────

/**
 * Get ECO token balance for an address (18 decimals, display string).
 */
export const getEcoTokenBalance = async (address) => {
  const contract = await getReadOnlyContract("ecoToken");
  const balance = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  return ethers.formatUnits(balance, decimals);
};

/**
 * Get the raw on-chain ECO balance (bigint, 18 decimals).
 */
export const getEcoTokenBalanceRaw = async (address) => {
  const contract = await getReadOnlyContract("ecoToken");
  return contract.balanceOf(address);
};

/**
 * Check if an account is frozen (cannot transfer or burn credits).
 * Mirrors EcoToken.isFrozen / the public `frozen` mapping.
 */
export const isEcoTokenFrozen = async (address) => {
  const contract = await getReadOnlyContract("ecoToken");
  try {
    return await contract.isFrozen(address);
  } catch {
    return contract.frozen(address);
  }
};

/**
 * Find the on-chain debt ID for a given user wallet and original tree token ID.
 */
export const findDebtIdForOriginalTree = async (userAddress, originalTokenId) => {
  const contract = await getReadOnlyContract("replantationRegistry");
  const debtIds = await contract.getUserDebts(userAddress);
  for (const debtId of debtIds) {
    const debt = await contract.debts(debtId);
    if (debt.originalTokenId.toString() === originalTokenId.toString()) {
      return debtId.toString();
    }
  }
  return null;
};

// ─── Utility Exports ────────────────────────────────────────────────────────

export { CONTRACT_ADDRESSES, SEPOLIA_CHAIN_ID, formatEcoBalance };
export { describeChainError, formatTokenAmount } from "./chainErrors";

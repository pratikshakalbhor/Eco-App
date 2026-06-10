import { ethers } from "ethers";
import EcoChainTreeABI from "../contracts/EcoChainTree.json";
import EcoTokenABI from "../contracts/EcoToken.json";
import CarbonCreditABI from "../contracts/CarbonCredit.json";
import EcoTreeABI from "../contracts/EcoTree.json";
import TreeCuttingReportABI from "../contracts/TreeCuttingReport.json";

// ─── Contract Addresses from Environment ────────────────────────────────────
const CONTRACT_ADDRESSES = {
  ecoToken: import.meta.env.VITE_ECO_TOKEN,
  carbonCredit: import.meta.env.VITE_CARBON_CREDIT,
  ecoTree: import.meta.env.VITE_ECO_TREE,
  treeCuttingReport: import.meta.env.VITE_TREE_CUTTING_REPORT,
  ecoChainTree: import.meta.env.VITE_ECO_CHAIN_TREE,
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
 * @param {"ecoToken"|"carbonCredit"|"ecoTree"|"treeCuttingReport"|"ecoChainTree"} contractName
 * @param {ethers.Signer} signer
 */
export const getContract = (contractName, signer) => {
  const abiMap = {
    ecoToken: EcoTokenABI.abi,
    carbonCredit: CarbonCreditABI.abi,
    ecoTree: EcoTreeABI.abi,
    treeCuttingReport: TreeCuttingReportABI.abi,
    ecoChainTree: EcoChainTreeABI.abi,
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

/**
 * Register a tree on the EcoChainTree contract.
 * @returns {{ receipt, tokenId: string }}
 */
export const registerTreeOnChain = async (planterAddress, ipfsHash, metadataURI) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  const tx = await contract.registerTree(planterAddress, ipfsHash, metadataURI);
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
};

/**
 * Verify a tree on-chain (EcoChainTree — verifier role required).
 */
export const verifyTreeOnChain = async (tokenId) => {
  const { signer } = await connectWallet();
  const contract = getContract("ecoChainTree", signer);

  const tx = await contract.verifyTree(tokenId);
  const receipt = await tx.wait();
  return { receipt, txHash: receipt.hash };
};

/**
 * Get on-chain tree details by tokenId.
 */
export const getTreeDetailsOnChain = async (tokenId) => {
  const contract = await getReadOnlyContract("ecoChainTree");
  return contract.getTreeDetails(tokenId);
};

// ─── TreeCuttingReport Operations ───────────────────────────────────────────

/**
 * Report a tree cutting on-chain.
 */
export const reportTreeCutting = async (tokenId, reason) => {
  const { signer } = await connectWallet();
  const contract = getContract("treeCuttingReport", signer);

  const tx = await contract.reportCutting(tokenId, reason);
  const receipt = await tx.wait();
  return { receipt, txHash: receipt.hash };
};

// ─── EcoToken (ERC-20) Operations ───────────────────────────────────────────

/**
 * Get ECO token balance for an address.
 */
export const getEcoTokenBalance = async (address) => {
  const contract = await getReadOnlyContract("ecoToken");
  const balance = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  return ethers.formatUnits(balance, decimals);
};

// ─── CarbonCredit (ERC-20) Operations ───────────────────────────────────────

/**
 * Get Carbon Credit token balance for an address.
 */
export const getCarbonCreditBalance = async (address) => {
  const contract = await getReadOnlyContract("carbonCredit");
  const balance = await contract.balanceOf(address);
  const decimals = await contract.decimals();
  return ethers.formatUnits(balance, decimals);
};

// ─── EcoTree (NFT) Operations ───────────────────────────────────────────────

/**
 * Get EcoTree NFT balance for an address.
 */
export const getEcoTreeBalance = async (address) => {
  const contract = await getReadOnlyContract("ecoTree");
  return (await contract.balanceOf(address)).toString();
};

// ─── Utility Exports ────────────────────────────────────────────────────────

export { CONTRACT_ADDRESSES, SEPOLIA_CHAIN_ID };

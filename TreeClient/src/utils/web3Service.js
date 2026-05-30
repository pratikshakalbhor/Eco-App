import { ethers } from "ethers";
import EcoChainTreeABI from "../contracts/EcoChainTree.json";

const ECO_TREE_CONTRACT_ADDRESS = import.meta.env.VITE_ECO_TREE_CONTRACT_ADDRESS;

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

export const connectWallet = async () => {
  console.log("Checking for window.ethereum...");
  const eth = await waitForEthereum();
  
  if (eth) {
    try {
      // Handle multiple providers (e.g. Coinbase + MetaMask)
      let provider = window.ethereum;
      if (window.ethereum.providers) {
        provider = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum.providers[0];
      }

      console.log("Requesting accounts...");
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      console.log("Accounts received:", accounts);

      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      return { address: accounts[0], signer };
    } catch (error) {
      console.error("Wallet connection error:", error);
      if (error.code === 4001) {
        throw new Error("Connection request was rejected. Please connect your wallet.");
      }
      throw error;
    }
  } else {
    console.error("window.ethereum is undefined");
    throw new Error("MetaMask is not detected. Please install the extension.");
  }
};

export const signMessage = async (message) => {
  if (!window.ethereum) return null;
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const signature = await signer.signMessage(message);
  return signature;
};

export const registerTreeOnChain = async (planterAddress, ipfsHash, metadataURI) => {
  const { signer } = await connectWallet();
  const contract = new ethers.Contract(ECO_TREE_CONTRACT_ADDRESS, EcoChainTreeABI.abi, signer);
  
  const tx = await contract.registerTree(planterAddress, ipfsHash, metadataURI);
  const receipt = await tx.wait();

  // Extract tokenId from TreeRegistered event
  const event = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch (e) {
        return null;
      }
    })
    .find((parsedLog) => parsedLog && parsedLog.name === "TreeRegistered");

  return {
    receipt,
    tokenId: event ? event.args.tokenId.toString() : null
  };
};

export const verifyTreeOnChain = async (tokenId) => {
  const { signer } = await connectWallet();
  const contract = new ethers.Contract(ECO_TREE_CONTRACT_ADDRESS, EcoChainTreeABI.abi, signer);
  
  const tx = await contract.verifyTree(tokenId);
  const receipt = await tx.wait();
  return receipt;
};

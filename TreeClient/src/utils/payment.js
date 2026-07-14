import { ethers } from 'ethers';

const COINGECKO_API = "https://api.coingecko.com/api/v3";

export async function fetchEthInrRate() {
    try {
        const response = await fetch(`${COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=inr`);
        const data = await response.json();
        return data.ethereum.inr;
    } catch (error) {
        console.error("Error fetching ETH/INR rate:", error);
        // Fallback rate if API fails (approximate)
        return 320000; 
    }
}

export async function payWithMetaMask(toAddress, inrAmount) {
    if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install it to continue.");
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const rate = await fetchEthInrRate();
        const ethAmount = (inrAmount / rate).toFixed(18);
        const weiAmount = ethers.parseEther(ethAmount);

        // Platform wallet - usually from env
        const platformWallet = import.meta.env.VITE_PLATFORM_WALLET || "0x0000000000000000000000000000000000000000";

        const tx = await signer.sendTransaction({
            to: platformWallet,
            value: weiAmount,
        });

        // Wait for 1 confirmation
        const receipt = await tx.wait(1);

        return {
            txHash: receipt.hash,
            ethAmount: ethAmount,
            ethRate: rate,
            inrAmount: inrAmount
        };
    } catch (error) {
        console.error("MetaMask payment error:", error);
        throw error;
    }
}

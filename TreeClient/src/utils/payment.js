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

    // Resolve the recipient from the caller, falling back to the configured
    // platform wallet. There is intentionally NO zero-address fallback: an
    // unset/invalid recipient must abort the payment rather than burn funds.
    const recipient = toAddress || import.meta.env.VITE_PLATFORM_WALLET;
    if (!recipient) {
        throw new Error("Payment recipient is not configured. Set VITE_PLATFORM_WALLET or pass a recipient address.");
    }
    if (!ethers.isAddress(recipient)) {
        throw new Error(`Invalid payment recipient address: ${recipient}`);
    }
    if (recipient === ethers.ZeroAddress) {
        throw new Error("Refusing to send a payment to the zero address. Configure a valid platform wallet.");
    }

    // Validate the amount before touching the chain.
    const numericAmount = Number(inrAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid payment amount.");
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const rate = await fetchEthInrRate();
        if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error("Unable to determine a valid ETH/INR exchange rate.");
        }

        // Convert via a fixed-precision decimal string, then parse into an exact
        // integer wei value. parseEther never uses floating point internally.
        const ethAmount = (numericAmount / rate).toFixed(18);
        const weiAmount = ethers.parseEther(ethAmount);
        if (weiAmount <= 0n) {
            throw new Error("Payment amount is too small after conversion.");
        }

        const tx = await signer.sendTransaction({
            to: recipient,
            value: weiAmount,
        });

        // Wait for 1 confirmation
        const receipt = await tx.wait(1);

        return {
            txHash: receipt.hash,
            ethAmount: ethAmount,
            ethRate: rate,
            inrAmount: numericAmount
        };
    } catch (error) {
        console.error("MetaMask payment error:", error);
        throw error;
    }
}

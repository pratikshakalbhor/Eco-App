import { ethers } from 'ethers';
import axios from 'axios';
import API_URL from './config.js';

/**
 * fetchPaymentConfig returns the marketplace payment configuration published
 * by the backend (GET /api/marketplace/payment-config).
 *
 * The backend is the single source of truth for both the ETH/INR rate and the
 * wallet that must receive the payment: it verifies the on-chain transfer
 * against its own rate, so a client that prices the purchase with a
 * different rate would have its payment rejected as underpaid.
 *
 * This fails closed. There is no fallback exchange rate and no fallback
 * recipient: if the configuration cannot be obtained the purchase is aborted
 * rather than sending funds to an address the backend will refuse to credit.
 */
export async function fetchPaymentConfig() {
    const token = localStorage.getItem('eco_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    let data;
    try {
        const response = await axios.get(`${API_URL}/api/marketplace/payment-config`, { headers });
        data = response && response.data;
    } catch (error) {
        console.error('Failed to load the marketplace payment configuration:', error);
        throw new Error(
            'Could not load the marketplace payment configuration from the server. Please reconnect your wallet and try again.'
        );
    }

    if (!data || data.configured !== true) {
        throw new Error(
            (data && data.error) || 'Marketplace payments are not configured on the server.'
        );
    }

    if (!data.platform_wallet) {
        throw new Error('The server did not return a platform wallet to pay.');
    }
    if (!ethers.isAddress(data.platform_wallet)) {
        throw new Error(`The server returned an invalid platform wallet: ${data.platform_wallet}`);
    }
    if (data.platform_wallet === ethers.ZeroAddress) {
        throw new Error('The server returned the zero address as the platform wallet.');
    }

    const ethInrRate = Number(data.eth_inr_rate);
    if (!Number.isFinite(ethInrRate) || ethInrRate <= 0) {
        throw new Error('The server returned an invalid ETH/INR rate.');
    }

    const platformFeePercent = Number(data.platform_fee_percent);

    return {
        platformWallet: data.platform_wallet,
        ethInrRate,
        platformFeePercent: Number.isFinite(platformFeePercent) ? platformFeePercent : 0,
    };
}

/**
 * payWithMetaMask sends a native ETH payment to `recipient` for an INR
 * amount, priced with the server-supplied ETH/INR rate.
 *
 * @param {object} options
 * @param {string} options.recipient  the wallet that must receive the funds
 * @param {number} options.inrAmount  the amount to pay, in rupees
 * @param {number} options.ethInrRate  the server-supplied ETH/INR rate
 */
export async function payWithMetaMask({ recipient, inrAmount, ethInrRate }) {
    if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install it to continue.');
    }

    // There is intentionally NO environment-variable fallback for the
    // recipient: it must come from the server's payment configuration, or
    // the funds would be sent to an address the backend refuses to credit.
    if (!recipient) {
        throw new Error('Payment recipient is not configured.');
    }
    if (!ethers.isAddress(recipient)) {
        throw new Error(`Invalid payment recipient address: ${recipient}`);
    }
    if (recipient === ethers.ZeroAddress) {
        throw new Error('Refusing to send a payment to the zero address. Configure a valid platform wallet.');
    }

    const numericAmount = Number(inrAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Invalid payment amount.');
    }

    const rate = Number(ethInrRate);
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Invalid ETH/INR rate.');
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        // Convert via a fixed-precision decimal string, then parse into an
        // exact integer wei value. parseEther never uses floating point
        // internally.
        const ethAmount = (numericAmount / rate).toFixed(18);
        const weiAmount = ethers.parseEther(ethAmount);
        if (weiAmount <= 0n) {
            throw new Error('Payment amount is too small after conversion.');
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
            inrAmount: numericAmount,
        };
    } catch (error) {
        console.error('MetaMask payment error:', error);
        throw error;
    }
}

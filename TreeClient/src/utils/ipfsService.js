import axios from 'axios';
import API_URL from "../utils/config.js";

export const uploadToIPFS = async (file) => {
    const url = `${API_URL}/api/media/upload`;
    
    let data = new FormData();
    data.append('file', file);

    const token = localStorage.getItem('eco_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await axios.post(url, data, { headers });
        
        return {
            hash: response.data.ipfs_hash,
            url: response.data.url
        };
    } catch (error) {
        console.error("Error uploading to IPFS via Backend:", error);
        throw error;
    }
};

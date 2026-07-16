import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

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

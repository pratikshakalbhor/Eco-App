import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { connectWallet, signMessage } from '../utils/web3Service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async () => {
    try {
      // 1. Connect Wallet
      const wallet = await connectWallet();
      if (!wallet) {
        throw new Error("No wallet connected. Please ensure MetaMask is installed and unlocked.");
      }

      // 2. Get Nonce from Backend
      const { data: { nonce } } = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/nonce?address=${wallet.address}`);

      // 3. Sign Nonce
      const message = `EcoChain Auth Nonce: ${nonce}`;
      const signature = await signMessage(message);

      // 4. Verify on Backend
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/verify`, {
        address: wallet.address,
        signature
      });

      // 5. Store Token and User
      localStorage.setItem('eco_token', data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('eco_token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('eco_token');
    if (token) {
      try {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/me`);
        setUser(data);
      } catch (err) {
        logout();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

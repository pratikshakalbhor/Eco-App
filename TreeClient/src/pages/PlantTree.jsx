import React, { useState } from "react";
import { TreePine, Upload, Loader2, CheckCircle, MapPin, Calendar, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { uploadToIPFS } from "../utils/ipfsService";
import { connectWallet, registerTreeOnChain } from "../utils/web3Service";
import axios from "axios";

export default function PlantTree() {
  const [formData, setFormData] = useState({
    species: "",
    location: "GPS Captured",
    latitude: 0,
    longitude: 0,
    photo_url: "",
    ipfs_hash: "",
  });

  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Capture GPS
  const captureLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
      });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadToIPFS(file);
      setFormData({ ...formData, photo_url: result.url, ipfs_hash: result.hash });
    } catch (error) {
      alert("Failed to upload to IPFS");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const wallet = await connectWallet();
      if (!wallet) return;

      // 1. Register on Blockchain first
      const metadataURI = `ipfs://${formData.ipfs_hash}`;
      const blockchainResult = await registerTreeOnChain(
        wallet.address,
        formData.ipfs_hash,
        metadataURI
      );

      if (!blockchainResult.tokenId) {
        throw new Error("Blockchain registration failed: No TokenID returned");
      }

      // 2. Save in backend with the TokenID
      const payload = {
        ...formData,
        blockchain_token_id: blockchainResult.tokenId,
        wallet_address: wallet.address
      };

      await axios.post(`${import.meta.env.VITE_API_URL}/api/trees`, payload);
      setSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Registration failed: " + (error.reason || error.message));
    } finally {
      setUploading(false);
    }
  };

  // Success message screen
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-green-800">Tree Planted Successfully!</h2>
          <p className="text-gray-600 mt-2">Your tree has been registered.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-2xl rounded-3xl p-8 border border-gray-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4">
            <TreePine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Plant a Tree</h1>
          <p className="text-gray-600">Register your tree and contribute to sustainability</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tree ID */}
          <div>
            <Label>Tree ID</Label>
            <Input value={formData.tree_id} disabled className="mt-2 bg-gray-100" />
          </div>

          {/* Tree Species */}
          <div>
            <Label>Tree Species *</Label>
            <Select
              value={formData.species}
              onValueChange={(value) => setFormData({ ...formData, species: value })}
            >
              <SelectTrigger className="mt-2 h-12">
                <SelectValue placeholder="Select species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mango">Mango</SelectItem>
                <SelectItem value="neem">Neem</SelectItem>
                <SelectItem value="oak">Oak</SelectItem>
                <SelectItem value="bamboo">Bamboo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Location *
            </Label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Pune, Maharashtra"
              className="mt-2 h-12"
              required
            />
          </div>

          {/* Date */}
          <div>
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Planted Date *
            </Label>
            <Input
              type="date"
              value={formData.planted_date}
              onChange={(e) => setFormData({ ...formData, planted_date: e.target.value })}
              className="mt-2 h-12"
              required
            />
          </div>

          {/* Photo Upload */}
          <div>
            <Label>Tree Photo</Label>
            {formData.photo_url ? (
              <div className="relative mt-3">
                <img
                  src={formData.photo_url}
                  alt="Tree"
                  className="w-full h-64 object-cover rounded-xl border"
                />
                <Button
                  type="button"
                  className="absolute top-3 right-3 bg-red-500 hover:bg-red-600"
                  onClick={() => setFormData({ ...formData, photo_url: "" })}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center mt-3 hover:border-green-500 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  id="treePhoto"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <label htmlFor="treePhoto" className="cursor-pointer block">
                  {uploading ? (
                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mx-auto mb-3" />
                  ) : (
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  )}
                  <p className="text-gray-600 font-medium">
                    {uploading ? "Uploading..." : "Click to upload tree photo"}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                </label>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-md"
            disabled={!formData.species || !formData.location}
          >
            <TreePine className="w-5 h-5 mr-2" />
            Save Tree
          </Button>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, CheckCircle, Clock, Filter } from "lucide-react";
import L from "leaflet";

// Custom map icons for tree status
const verifiedIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/190/190411.png",
  iconSize: [30, 30],
});

const pendingIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2991/2991108.png",
  iconSize: [30, 30],
});

const rejectedIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/463/463612.png",
  iconSize: [30, 30],
});

const MapPage = () => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const trees = [
    {
      id: 1,
      name: "Neem",
      location: "Mumbai, Maharashtra",
      lat: 19.076,
      lng: 72.8777,
      status: "verified",
    },
    {
      id: 2,
      name: "Banyan",
      location: "New Delhi",
      lat: 28.6139,
      lng: 77.209,
      status: "pending",
    },
    {
      id: 3,
      name: "Mango",
      location: "Bengaluru, Karnataka",
      lat: 12.9716,
      lng: 77.5946,
      status: "verified",
    },
  ];

  const filteredTrees = trees.filter((tree) => {
    return (
      (filter === "all" || tree.status === filter) &&
      tree.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  const total = trees.length;
  const verified = trees.filter((t) => t.status === "verified").length;
  const pending = trees.filter((t) => t.status === "pending").length;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 lg:w-1/4 bg-white p-6 border-r overflow-y-auto">
        <h1 className="text-2xl font-bold text-green-700 mb-4">
          Tree Location Map
        </h1>
        <p className="text-gray-600 mb-6">
          Explore all planted trees across India
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-green-50 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-green-700">{total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-emerald-600">{verified}</p>
            <p className="text-sm text-gray-500">Verified</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-xl text-center">
            <p className="text-xl font-bold text-yellow-600">{pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search trees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        {/* Filter */}
        <div className="relative mb-6">
          <Filter className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value="all">All Trees</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* Tree List */}
        <div className="space-y-3">
          {filteredTrees.map((tree) => (
            <div
              key={tree.id}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    {tree.name}
                  </h3>
                  <p className="text-sm text-gray-500">{tree.location}</p>
                </div>
                {tree.status === "verified" && (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    verified
                  </span>
                )}
                {tree.status === "pending" && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                    pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map Section */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]} // Centered on India
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {filteredTrees.map((tree) => (
            <Marker
              key={tree.id}
              position={[tree.lat, tree.lng]}
              icon={
                tree.status === "verified"
                  ? verifiedIcon
                  : tree.status === "pending"
                  ? pendingIcon
                  : rejectedIcon
              }
            >
              <Popup>
                <strong>{tree.name}</strong>
                <br />
                {tree.location}
                <br />
                Status: {tree.status}
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg p-4 text-sm">
          <p className="font-semibold text-gray-700 mb-2">Legend</p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              Verified Trees
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              Pending Verification
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              Rejected
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPage;


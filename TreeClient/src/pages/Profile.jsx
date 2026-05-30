import React from "react";
import { Award, Shield, Leaf } from "lucide-react";

// Custom Tree Icon (optional)
const TreePine = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 2L4 8l8 6 8-6-8-6zm0 0v20"
    />
  </svg>
);

const Profile = () => {
  // Example data — you can replace these with real blockchain or API values
  const user = {
    name: "",
    email: "",
    wallet: " ",
    role: "",
    joinDate: "",
  };

  const stats = {
    treesPlanted: 3,
    verifiedTrees: 2,
    carbonOffset: 509,
    nftsOwned: 1,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-green-700">
            My Profile
          </h1>
          <p className="text-gray-600">
            View your eco-achievements and impact details
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="w-40 h-40 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg">
                <span className="text-7xl font-bold text-white">P</span>
              </div>

              <h2 className="text-3xl font-bold mb-2 text-gray-800">
                {user.name}
              </h2>
              <p className="text-gray-600 mb-4">{user.email}</p>

              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold mb-6">
                <Leaf className="w-4 h-4" />
                {user.role}
              </div>

              <div className="bg-green-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Wallet</p>
                <p className="font-mono text-sm text-gray-800">
                  {user.wallet}
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Member Since</p>
                <p className="font-semibold text-gray-800">
                  {user.joinDate}
                </p>
              </div>

              <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Profile
              </button>
            </div>
          </div>

          {/* Right Side Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Impact Stats */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                <Award className="w-8 h-8 text-green-600" />
                Your Impact
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-2xl p-6 text-center">
                  <TreePine className="w-10 h-10 text-green-600 mx-auto mb-3" />
                  <p className="text-5xl font-bold text-green-600 mb-1">
                    {stats.treesPlanted}
                  </p>
                  <p className="text-sm text-gray-600">Trees Planted</p>
                </div>

                <div className="bg-blue-50 rounded-2xl p-6 text-center">
                  <Shield className="w-10 h-10 text-blue-600 mx-auto mb-3" />
                  <p className="text-5xl font-bold text-blue-600 mb-1">
                    {stats.verifiedTrees}
                  </p>
                  <p className="text-sm text-gray-600">Verified</p>
                </div>

                <div className="bg-green-50 rounded-2xl p-6 text-center">
                  <Leaf className="w-10 h-10 text-green-600 mx-auto mb-3" />
                  <p className="text-5xl font-bold text-green-600 mb-1">
                    {stats.carbonOffset}
                  </p>
                  <p className="text-sm text-gray-600">
                    kg CO₂ Offset
                  </p>
                </div>

                <div className="bg-purple-50 rounded-2xl p-6 text-center">
                  <Award className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                  <p className="text-5xl font-bold text-purple-600 mb-1">
                    {stats.nftsOwned}
                  </p>
                  <p className="text-sm text-gray-600">NFTs Owned</p>
                </div>
              </div>
            </div>

            {/* Environmental Certificate */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-gray-800">
                Environmental Impact Certificate
              </h3>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8">
                <div className="text-center mb-8">
                  <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
                    <Award className="w-16 h-16 text-green-600" />
                  </div>
                  <h4 className="text-3xl font-bold text-gray-900 mb-2">
                    Certificate of Environmental Conservation
                  </h4>
                  <p className="text-gray-700 text-lg">
                    Recognizing your contribution to a greener India
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center py-3 border-b border-green-200">
                    <span className="text-gray-700 font-medium">
                      Trees Planted:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {stats.treesPlanted}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-green-200">
                    <span className="text-gray-700 font-medium">
                      Carbon Credits:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      12 credits
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-green-200">
                    <span className="text-gray-700 font-medium">
                      CO₂ Offset:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {(stats.carbonOffset / 1000).toFixed(1)} tons
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-green-200">
                    <span className="text-gray-700 font-medium">
                      Verified Trees:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {stats.verifiedTrees}
                    </span>
                  </div>
                </div>

                <button className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition-all">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;


# EcoChain 🌿

EcoChain is a Web3-native decentralized system for tree plantation lifecycle management, carbon offsetting, and carbon credit marketplace transactions. It utilizes Ethereum Sepolia smart contracts, a powerful Go API server, and a fully interactive React frontend to provide biological integrity verification and transparent carbon accountability.

---

## 🚀 Key Features

* **Web3 Wallet Authentication**: Secure, EIP-191 personal sign-based MetaMask authentication flow.
* **Tree Registration & Tracking**: Register newly planted trees with geolocation coordinates, photos (with Pinata IPFS integration), nicknames, and species categories.
* **Verifier Audit Hub**: Restricted route for authorized Verifiers or Admins to verify tree growth, mint NFTs/credentials, and automatically distribute carbon credit rewards.
* **Active Marketplace**: List earned carbon credits for sale, purchase credits from other planters utilizing Sepolia Ethereum transactions, and transparently view transaction ledgers.
* **Environmental Accountability**: 
  * Report tree-cut events verified by GPS proximity checking.
  * Automatic calculation of ecological lost parameters (CO2 & Oxygen kg) upon cut confirmation.
  * Automatic trigger of **Replantation Debts** requiring debtor to plant replacement trees to restore ecological integrity and unlock locked assets.
* **Dynamic Interactive Analytics**: Beautiful charts, real-time registry status, and sustainability progress tracking.

---

## 🛠️ Tech Stack & Directory Structure

```
Eco-App/
├── TreeClient/                # React (Vite) Frontend Application
│   ├── src/
│   │   ├── pages/             # Dashboard, Verification Queue, Marketplace, etc.
│   │   ├── hooks/             # useAuth, context, etc.
│   │   └── utils/             # web3Service, IPFS interface scripts
│   └── public/                # Static assets & fallbacks
├── Backend/
│   └── api-server/            # Go REST API Server
│       ├── controllers/       # Route handling for all modules
│       ├── models/            # Database schema GORM models
│       ├── middleware/        # JWT Authentication & Role authorization
│       ├── config/            # DB configuration (Supabase PostgreSQL / SQLite fallback)
│       └── main.go            # Entry point file
└── blockchain/                # Smart Contracts & Hardhat environment
```

* **Frontend**: React (Vite), Framer Motion (animations), Recharts (data visualizations), Axios (HTTP Client), Lucide (Icons).
* **Backend**: Go (Gin Web Framework), GORM (Object Relational Mapper), JSON Web Token (JWT session management).
* **Database**: Supabase PostgreSQL with local SQLite (`ecochain.db`) fallback support for offline development.
* **Smart Contracts**: Solidity & Hardhat toolchain deployed to Sepolia testnet ecosystem.

---

## 🏁 Getting Started

### Prerequisites
* Go (1.20+)
* Node.js (v18+)
* MetaMask Extension loaded in your browser with Sepolia Testnet configuration.

### 1. Setting up Backend Environment Variables
Create `.env` file inside `Backend/api-server/`:
```env
DB_HOST=your-supabase-db-host
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=postgres
DB_PORT=6543
DB_SSLMODE=require

JWT_SECRET=YourSuperSecureJWTSecretPhraseHere

PINATA_JWT=your_pinata_jwt_token_here
PINATA_API_KEY=your_api_key_here
PINATA_SECRET_KEY=your_secret_key_here
```

### 2. Run the Backend API Server
```bash
cd Backend/api-server
go run main.go
```
The server will bind and start listening on `http://localhost:8080`.

### 3. Run the Frontend Client Application
Create `.env` file under `TreeClient/`:
```env
VITE_API_URL=http://localhost:8080
```

Install packages and boot client in dev mode:
```bash
cd TreeClient
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🤝 Administrative & Verifier Actions

**Promote a wallet to admin/verifier:**
The database manages authentication roles (`user`, `verifier`, `admin`). To promote a registered wallet address to admin/verifier role using database scripts, run:
```bash
cd Backend/api-server
go run scripts/promote_user/main.go
```

*(Note: If you have already logged in, you must log out and log back in to renew your JWT signature token with the newly assigned admin/verifier privileges).*

---

## 📜 Smart Contracts

Smart contract definitions are kept compiled inside the client directory:
* ABI artifacts: `TreeClient/src/contracts/EcoChainTree.json`
* Core contract connection scripts are maintained under `TreeClient/src/utils/web3Service.js`.

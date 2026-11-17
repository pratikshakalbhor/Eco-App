require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// The gas reporter is loaded only when asked for, so ordinary test runs stay
// fast and do not write a report file.
const reportGas = process.env.REPORT_GAS === "true";
if (reportGas) {
  require("hardhat-gas-reporter");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  gasReporter: {
    enabled: reportGas,
    currency: "USD",
    // When GAS_REPORT_FILE is set the report is also written to disk (no ANSI
    // colours) so CI can archive it as a build artifact.
    outputFile: process.env.GAS_REPORT_FILE || undefined,
    noColors: Boolean(process.env.GAS_REPORT_FILE),
    excludeContracts: [],
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

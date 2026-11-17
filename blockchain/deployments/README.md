# Deployment records

`npx hardhat run scripts/deploy.js --network <network>` writes one JSON file per
network here:

```
blockchain/deployments/localhost.json
blockchain/deployments/sepolia.json
```

The files contain addresses and role recipients, **never private keys**. They
are gitignored (`blockchain/deployments/*.json`) because they are
network-specific; this README is committed so the format and the explorer links
are documented.

## Format

```json
{
  "network": "sepolia",
  "chainId": "11155111",
  "deployedAt": "2026-01-01T00:00:00.000Z",
  "deployer": "0x...",
  "roles": {
    "admin": "0x...",
    "verifier": "0x...",
    "pauser": "0x...",
    "freezer": "0x..."
  },
  "contracts": {
    "EcoToken": "0x...",
    "EcoChainTree": "0x...",
    "ReplantationRegistry": "0x..."
  }
}
```

Use the values from `contracts` for:

* Backend `.env`: `ECO_TOKEN`, `ECO_CHAIN_TREE`.
* Frontend `.env`: `VITE_ECO_TOKEN`, `VITE_ECO_CHAIN_TREE`,
  `VITE_REPLANTATION_REGISTRY`.

## Sepolia placeholders

Replace the zero addresses with the values from your own
`deployments/sepolia.json`. These are the links a reviewer should be given:

| Contract | Address | Explorer |
| --- | --- | --- |
| `EcoToken` (ERC-20 credits) | `0x0000000000000000000000000000000000000000` | https://sepolia.etherscan.io/address/0x0000000000000000000000000000000000000000 |
| `EcoChainTree` (ERC-721 trees) | `0x0000000000000000000000000000000000000000` | https://sepolia.etherscan.io/address/0x0000000000000000000000000000000000000000 |
| `ReplantationRegistry` | `0x0000000000000000000000000000000000000000` | https://sepolia.etherscan.io/address/0x0000000000000000000000000000000000000000 |

Example transaction links once the demo has run:

* `registerTree`: https://sepolia.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000
* `verifyTree`: https://sepolia.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000
* `confirmCut`: https://sepolia.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000
* `markReplanted` / debt cleared: https://sepolia.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000
* `EcoToken.burn`: https://sepolia.etherscan.io/tx/0x0000000000000000000000000000000000000000000000000000000000000000

Do not publish a link until the transaction is confirmed and the address in the
record matches the deployed bytecode.

## Optional source verification

The three contracts take no constructor arguments:

```bash
cd blockchain
npx hardhat verify --network sepolia <EcoToken address>
npx hardhat verify --network sepolia <EcoChainTree address>
npx hardhat verify --network sepolia <ReplantationRegistry address>
```

Verification is optional for the demo, but it makes the explorer show the source
and the read/write methods instead of raw bytecode.

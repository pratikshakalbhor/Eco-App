# Demo script

An end-to-end demo on a local Hardhat node. It takes about 15 minutes. The same
flow works on Sepolia; only the network, RPC URL and explorer URL change.

The demo proves the accountability path: a tree is registered, verified and
credited; a cut is reported and confirmed; the planter's credits are frozen and
a debt is created; three replacement trees clear the debt and lift the freeze; a
credit is then retired (burned).

> The marketplace step deliberately shows the known off-chain settlement delta:
> ETH moves to the platform wallet, the database moves credits, and `EcoToken`
> balances do **not** change.

Commands use POSIX environment syntax. In PowerShell, set variables with
`$env:NAME="value"` before running the command.

## 0. Prerequisites

* Go 1.22+, Node 20+ (Node 22 recommended), and MetaMask.
* Two or three wallets (Hardhat accounts are fine for a local demo).
* Terminal A: node; Terminal B: deploy/scripts; Terminal C: backend; Terminal D:
  frontend. All commands assume the repo root.

## 1. Start a local chain

```bash
cd blockchain
npx hardhat node
```

Keep it running. It prints 20 accounts and private keys; the demo uses:

| Role | Account | Address |
| --- | --- | --- |
| Planter | #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Verifier | #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Buyer | #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |

Import the private keys into MetaMask and add the network:

* RPC URL: `http://127.0.0.1:8545`
* Chain ID: `31337`
* Currency: ETH

## 2. Deploy and wire roles

In Terminal B:

```bash
cd blockchain
VERIFIER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
npx hardhat run scripts/deploy.js --network localhost
```

The deployer (account #0) becomes `ADMIN`; `VERIFIER_ROLE` goes to account #1;
the deployer revokes its own roles. The script writes
`blockchain/deployments/localhost.json` and prints ready-to-paste env blocks.

Copy the printed values into:

* `Backend/api-server/.env`: `RPC_URL=http://127.0.0.1:8545`,
  `ECO_CHAIN_TREE=...`, `ECO_TOKEN=...`, `JWT_SECRET=<random>`,
  `PLATFORM_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (any account
  the buyer will pay), `ETH_INR_RATE=320000`.
* `TreeClient/.env`: `VITE_API_URL=http://localhost:8080`, the three contract
  addresses, `VITE_CHAIN_ID=31337`, `VITE_RPC_URL=http://127.0.0.1:8545`, and
  `VITE_EXPLORER_URL=https://sepolia.etherscan.io` (kept as the default; links
  to local transaction hashes will not resolve, but the hashes are still shown
  in the UI).

Leave the `DB_*` variables empty: the backend will fail to reach Postgres and
fall back to `Backend/api-server/ecochain.db` (SQLite).

## 3. Start backend and frontend

Terminal C:

```bash
cd Backend/api-server
go run main.go
```

Expected: `EcoChain Backend running on http://0.0.0.0:8080`.

Terminal D:

```bash
cd TreeClient
npm install
npm run dev
```

Open `http://localhost:5173`.

## 4. Login as both wallets (creates the user rows)

1. Connect MetaMask with account #0 (planter). Sign the nonce. This creates the
   planter user.
2. Disconnect / switch MetaMask to account #1 (verifier) and sign in. This
   creates the verifier user.
3. Stop the backend (Ctrl+C) so the SQLite file is not locked, then promote the
   verifier in the database:

   ```bash
   cd Backend/api-server
   go run scripts/promote_user/main.go 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 verifier
   ```

4. Restart the backend. Log out and log in again as account #1: the JWT issued
   before promotion still carries the old role.

The on-chain role was already granted by the deploy script. If you need to grant
it separately (for example on Sepolia):

```bash
cd blockchain
CONTRACT=EcoChainTree \
CONTRACT_ADDRESS=<EcoChainTree address> \
GRANTEE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
ROLE=VERIFIER_ROLE \
npx hardhat run scripts/grant-role.js --network localhost
```

Both roles are required. A database role without the on-chain role produces a
reverted verification transaction; an on-chain role without the database role
produces `403` from the API.

## 5. Register a tree (planter)

1. As account #0, open **Plant Tree**.
2. Species: any (e.g. Neem). Set the planting date to at least ~6 weeks ago so
   the tree is old enough to earn non-zero credits (the age floor is 0.1 years,
   but a more realistic age makes the number easier to read).
3. Use your current coordinates (for example `28.6139`, `77.2090`). The same
   coordinates are needed later for the cut report.
4. Upload a photo (optional) and submit. MetaMask asks for `registerTree`; the
   NFT is minted immediately with status `REGISTERED`.
5. Confirm the tree appears under **My Trees** with status `PENDING_VERIFICATION`.

**Screenshot:** the MetaMask confirmation (contract `EcoChainTree`, method
`registerTree`), and the tree card with its token id.

## 6. Verify the tree (verifier)

1. Log in as account #1 (verifier).
2. Open **Verification Queue**.
3. Verify the pending tree. The UI sends `verifyTree(tokenId, carbonScore×100,
   plantedAt)` and then posts the transaction hash to the API.
4. Expected: the tree becomes `VERIFIED`, the planter's credit balance equals
   `rate(kg/yr) × age(yr) / 1000`, and the API stores the amount decoded from
   `CreditsMinted`.

**Screenshot:** the verification success state and the planter's **Carbon
Credits** page showing the issued credits (and the transaction hash).

## 7. Marketplace purchase (optional, shows the off-chain delta)

1. As the planter, open **Marketplace** and list 0.10 credits at any price.
2. Log in as account #2 (buyer) and buy 0.05 credits.
3. MetaMask sends native ETH to `PLATFORM_WALLET`. The API verifies recipient,
   sender, minimum amount, success and hash uniqueness, then moves credits in
   the database.
4. Check the buyer's `EcoToken` balance in MetaMask (or the API): it does **not**
   increase. This is the documented off-chain settlement delta, not a failed
   purchase. `scripts/reconcile` labels it.

**Screenshot:** the purchase confirmation and the marketplace transaction row;
optionally the buyer's unchanged token balance.

## 8. Report and confirm a cut

1. Log in as account #0 (planter), open the verified tree, choose **Report
   Cut**, enter the same coordinates used at registration (within 100 m), a
   reason and optional evidence.
2. Expected: tree status becomes `CUT_REPORTED`; its off-chain credits become
   non-tradeable and active listings are cancelled.
3. Log in as account #1 (verifier), open **Verification Queue → Cut Reports**,
   and confirm the cut. The UI sends `confirmCut(tokenId,
   max(3, ceil(age/2)))`, then posts the hash.
4. Expected: status `CUT_CONFIRMED`; a debt for 3 replacements exists; the
   planter's `EcoToken` account is frozen (`isFrozen = true`).

**Screenshot:** the cut report form with coordinates, the confirmed cut, the
debt card (`3 required`), and MetaMask/console showing `frozen = true`.

## 9. Replant and clear the debt

1. As the planter, open **Replantation**, click **Plant replacement** on the
   debt. This opens **Plant Tree** with `is_replacement=true` and the debt id.
2. Register three trees (any species, current date is fine) and have the
   verifier verify each one.
3. Back on **Replantation**, link each replacement to the debt. The UI calls
   `markReplanted(replacementTokenId, originalTokenId)` and then
   `POST /api/debt/:id/link-tree`.
4. The third link satisfies the debt: the registry clears it and unfreezes the
   planter because `openDebtCount` reaches zero.
5. Expected: the debt card shows **Completed**; the planter's credits are
   tradeable again and `isFrozen = false`.

**Screenshot:** the debt progress (0/3 → 3/3), the completed certificate, and
the unfrozen balance.

## 10. Retire credits (burn)

1. As the planter, open **Carbon Credits → Offset emissions**.
2. Enter an amount and click **Burn & Retire Credits**. The UI calls
   `EcoToken.burn(amount)` from the wallet, then posts the hash.
3. With `RPC_URL` set, the API decodes `Transfer(from = wallet, to = 0x0,
   amount)` from the configured `EcoToken` and records the retirement. Without
   `RPC_URL`, the hash is recorded unverified (development only).
4. Expected: the balance decreases; the retirement appears in the credit
   history; the transaction is visible on the explorer.

**Screenshot:** the MetaMask burn confirmation and the “Offsetting confirmed”
panel with the transaction link.

## 11. What to capture for a write-up

| # | Screenshot | Why it matters |
| --- | --- | --- |
| 1 | `registerTree` wallet confirmation + minted token id | Shows the NFT identity is created by the planter |
| 2 | Verification queue + planter credit balance | Shows credits come from the chain event |
| 3 | Marketplace purchase + unchanged token balance | Makes the off-chain settlement delta visible |
| 4 | Cut report coordinates + confirmed cut | Shows the GPS gate and verifier confirmation |
| 5 | Debt card at 0/3 and completed at 3/3 | Shows the replantation obligation and clearance |
| 6 | Frozen → unfrozen balance | Shows the account-level freeze is real |
| 7 | Burn confirmation + credit history | Shows retirement is an on-chain burn, not a database flag |

## Troubleshooting

* **MetaMask shows the wrong network.** The app prompts to switch/add using the
  `VITE_CHAIN_*` values. After changing `.env`, restart Vite.
* **`403` from verification.** The database role is not `verifier`/`admin`, or
  the JWT predates the promotion. Re-login.
* **`verifyTree` reverts.** The wallet lacks `VERIFIER_ROLE`, the tree is not
  `REGISTERED`, the token id is wrong, or the tree was registered in the API but
  the on-chain registration actually failed.
* **Cut report rejected with distance.** The submitted coordinates are more than
  100 m from the registered coordinates. Use the same pair.
* **`confirmCut` reverts.** The tree is not `CUT_REPORTED`, or the signer is not
  a verifier, or the replacement count passed is below 3.
* **Purchase fails with “payment sender mismatch”.** The transaction was sent
  from a different wallet than the logged-in one. Contract wallets are not
  supported by sender recovery.
* **SQLite “database is locked”.** Stop the backend before running
  `promote_user`, then restart it.

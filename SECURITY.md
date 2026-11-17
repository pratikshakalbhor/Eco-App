# Security

This document is the threat model for the EcoChain testnet prototype. It
describes the assets worth attacking, who can attack them, where the trust
boundaries are, what the code currently does about each abuse case, and what
risk remains after those controls.

**Scope note.** EcoChain has not been audited. It runs on Sepolia (or a local
Hardhat node) and must not be used to represent real, retired carbon offsets.
The known limitations in §6 are part of the design, not oversights.

## 1. Assets

| Asset | Why an attacker wants it |
| --- | --- |
| `EcoToken` credits | Transferable value inside the system; can be sold for ETH in the marketplace |
| Marketplace ETH payments | Real testnet ETH sent to the platform wallet |
| Tree registry integrity | Fake trees or fake verifications let an attacker mint credits from nothing |
| Debt/freeze state | Clearing a debt without replanting removes the economic consequence of a cut |
| Verifier and admin keys | Full control over verification, freezes, pausing and role grants |
| User sessions | A stolen JWT acts as the wallet owner on API endpoints |
| Pinata credentials | Abuse of the project's IPFS quota, or replacement of tree evidence |

## 2. Actors and trust boundaries

| Actor | Trust level | Capability |
| --- | --- | --- |
| Planter / buyer | Untrusted | Registers trees, lists/buys credits, reports cuts, burns credits |
| Verifier | Trusted for content, auditable | Verifies trees, confirms cuts, marks replantings; holds `VERIFIER_ROLE` |
| Admin | Highly trusted | DB role `admin`, contract `DEFAULT_ADMIN_ROLE`; grants roles |
| Deployer | Trusted during deployment only | Deploys and wires roles, then revokes its own roles |
| Backend | Trusted for the database, not for chain state | Verifies receipts, writes the ledger, settles marketplace purchases |
| RPC provider | Trusted for availability, not correctness | Supplies receipts and event logs |
| Observer / attacker | Untrusted | Can call any public contract function and any API endpoint |

Boundaries that matter:

1. **Browser → API.** The API trusts the JWT, not the request body. Amounts,
   prices, winners and chain outcomes are recomputed or re-read server-side.
2. **Browser → chain.** The user's wallet signs. The backend cannot move a
   user's tokens or mint credits on a user's behalf.
3. **API → chain.** The API trusts a receipt only if the expected contract
   emitted the expected event with the expected indexed values, in a successful
   transaction.
4. **API → database.** Chain-derived values are written only after verification;
   the database never decides that a cut happened.
5. **Verifier → truth.** This is the weakest boundary. A verifier can attest to
   facts that are not independently observable on-chain (see §4.2).

## 3. HTTP and authentication controls

* Login is EIP-191 `personal_sign` over `EcoChain Auth Nonce: <nonce>`.
  Nonces are single-use and expire; a successful login consumes the nonce, so a
  captured signature cannot be replayed.
* JWTs are signed with `JWT_SECRET`. When it is unset, authenticated middleware
  refuses requests instead of falling back to a default secret, and the login
  controller logs a warning. Use a long random value (`openssl rand -hex 64`).
* Roles are checked server-side (`user`, `verifier`, `admin`) and on-chain
  (`VERIFIER_ROLE`, `MINTER_ROLE`, `PAUSER_ROLE`, `FREEZER_ROLE`).
* Auth endpoints are rate-limited (20/min per IP for nonce, 10/min for verify);
  normal protected traffic is limited to 120/min, marketplace to 60/min, media
  upload to 20/min. Limits are in-memory and per process, so they do not survive
  a restart and are not shared across replicas.
* CORS uses an explicit allowlist (`CORS_ORIGINS`); wildcard origins are not
  accepted for authenticated requests.
* Pinata credentials are server-side only. The browser uploads through
  `POST /api/media/upload`; `VITE_*` variables never contain the JWT or API key.

## 4. Abuse cases and controls

### 4.1 Dust-payment purchase

**Attack.** Buy credits while paying almost nothing, or point at someone else's
payment.

**Controls.**

* The client never supplies the price used for verification. The API computes
  `minWei` from the listing price in the database and the server-side
  `ETH_INR_RATE` (`services/payment_service.go`).
* `VerifyNativePayment` checks: transaction status is 1, recipient is exactly
  `PLATFORM_WALLET`, the recovered sender is exactly the authenticated buyer,
  and `tx.Value() >= minWei`. The rate is validated against a sane band and the
  endpoint fails closed when the rate is missing or out of range.
* The transaction hash is unique (`marketplace_transactions.tx_hash`), so one
  payment cannot settle two purchases.
* The listing row is locked and re-validated inside the database transaction, so
  two concurrent buyers cannot both buy the last credits.

**Residual risk.** `ETH_INR_RATE` is operator-supplied and static; if ETH moves
or the rate is stale, the "correct" price is wrong in one direction. The
platform wallet is a single address; its key compromise is covered in §4.6.
Contract-wallet buyers (Safe, smart accounts) are not supported by the sender
recovery because `types.Sender` assumes an ECDSA signature.

### 4.2 Verifier collusion or a malicious verifier

**Attack.** A verifier verifies a nonexistent tree, inflates the annual
absorption rate, backdates `plantedAt`, or confirms a cut for a tree that is
still standing (freezing an innocent account).

**Controls.**

* Verification, cut confirmation and replanting all require `VERIFIER_ROLE` on
  `EcoChainTree`; there is no permissionless path to mint credits.
* `verifyTree` requires the token to exist and be `REGISTERED`; it mints the
  amount computed by the contract from `carbonScorePerYear` and `plantedAt`.
* The backend records the transaction hash, verifier id and activity log, so a
  verifier's actions are attributable after the fact.
* Cut confirmation requires a matching debt and freeze in the same successful
  transaction; a bare `TreeCutConfirmed` event is rejected by the API.
* `ReplacementsNeeded` is computed by the backend as
  `max(3, ceil(ageYears / 2))`; the contract rejects anything below 3, so a
  verifier cannot make a debt trivially cheap by passing 1.

**Residual risk — high.** A verifier can still invent a tree and choose any
positive annual absorption rate and any past planting date, and the contract
will mint the resulting credits. There is no independent auditor, no cap on
`carbonScorePerYear`, no multi-verifier quorum, and no challenge window. The API
role and the on-chain role are both required, which limits accidental misuse,
not a determined verifier. Production use requires an independent verification
process, rate bounds per species, and a multisig or quorum for `VERIFIER_ROLE`.

### 4.3 GPS spoofing

**Attack.** Report a cut (or register a tree) at coordinates the attacker is not
physically near.

**Controls.**

* `ReportCut` computes the Haversine distance between the submitted coordinates
  and the registered tree and rejects reports beyond 100 m.
* The registered coordinates must exist; a tree with zero coordinates cannot be
  used to pass the check.
* Evidence images are uploaded through the backend and the report is reviewed by
  a verifier before the cut is confirmed; a cut report alone only freezes the
  tree's off-chain credits.

**Residual risk — high.** Coordinates are self-declared. The API checks that the
number is close to the tree, not that the device is there; a browser extension,
emulator or direct API call can submit any pair of numbers. There is no
proof-of-location, no signed device attestation and no EXIF/GPS cross-check. The
100 m rule stops casual mistakes, not a determined attacker. Treat a confirmed
cut as a social/verifier process, not a cryptographic fact.

### 4.4 Spam registration and storage abuse

**Attack.** Register many trees to flood the map, exhaust IPFS quota, or create
noise that hides real activity.

**Controls.**

* Registration requires a JWT (wallet login), so every tree is attributable to a
  wallet.
* The on-chain `registerTree` is permissionless but costs gas; the NFT is minted
  to the caller.
* The IPFS hash must be unique on-chain (`ipfsHashUsed`), which prevents the same
  evidence from backing multiple trees.
* `POST /api/media/upload` is rate-limited per IP and only accessible to
  authenticated users; Pinata credentials stay server-side.
* Protected routes are rate-limited per IP.

**Residual risk.** A sybil can create many wallets and pay testnet gas; the only
real cost is gas and the operator's IPFS quota. There is no per-wallet tree cap,
no proof-of-humanity and no image moderation. Rate limiting is per process and
does not stop a distributed attacker. The map will show whatever is registered.

### 4.5 Replayed or forged transaction hash

**Attack.** Reuse a successful transaction to obtain a second state change, or
fabricate a hash that was never mined.

**Controls.**

* `VerifyTree` decodes `CreditsMinted` and requires the event's `tokenId` to
  match the tree's on-chain token and the event's `planter` to match the tree
  owner. The stored amount comes from the event, not from the request.
* `ConfirmCut` requires `TreeCutConfirmed`, a `DebtCreated` for the same tree and
  the debtor address, and `Frozen(debtor)` in one receipt.
* Credit issuance is unique by transaction hash, so a replayed hash hits the
  unique index and returns 409.
* Marketplace payments are unique by transaction hash.
* Burn hashes are recorded in `carbon_credits` with a unique transaction hash and
  the decoded event must come from the configured `EcoToken` address, be a
  `Transfer` to `0x0`, and be sent from the authenticated wallet for the exact
  requested amount.
* The decoders filter by the configured contract address. Burn decoding fails
  closed when `ECO_TOKEN` is unset or invalid. Tree decoding filters by
  `ECO_CHAIN_TREE` **when it is set**; leaving it unset means any contract whose
  logs match the expected topics is accepted, so it must be configured on any
  shared deployment.

**Residual risk.** Receipts are only as trustworthy as the RPC endpoint: a
malicious or compromised RPC provider could feed a forged receipt. The backend
does not verify block confirmations beyond "included with status 1", so a
reorganization could in principle orphan a recorded transaction. On Sepolia this
is acceptable; a production deployment should run its own node or use multiple
providers and wait for finality.

### 4.6 Key compromise

**Attack.** Steal the deployer, admin, verifier, pauser, freezer or platform
wallet key, or the backend's JWT secret.

**Controls.**

* `scripts/deployCore.js` hands `DEFAULT_ADMIN_ROLE` to `ADMIN` and then revokes
  every role from the deployer.
* `EcoToken.MINTER_ROLE` belongs to the `EcoChainTree` contract, not to a human
  key, so no EOA can mint credits directly.
* `ReplantationRegistry` has no role that can clear a debt; only the tree
  contract can, which prevents a role holder from clearing a debt without
  replanting.
* The backend holds no user keys. The write-side signer in
  `services/blockchain_service.go` is only used where an operator explicitly
  configures it.
* `.env` files are gitignored; the example file contains placeholders only.

**Residual risk.**

* `ADMIN` defaults to the deployer if `ADMIN` is not set; only a multisig (or a
  dedicated admin key) removes the single point of failure. `DEFAULT_ADMIN_ROLE`
  can grant `VERIFIER_ROLE`, `PAUSER_ROLE` and `FREEZER_ROLE`, so admin
  compromise is total control.
* A verifier key compromise mints arbitrary credits up to the rate/date the
  attacker chooses (see §4.2). A freezer key compromise can freeze arbitrary
  accounts (denial of service). A pauser key compromise can halt all transfers.
* There is no timelock, no two-step role transfer and no on-chain monitoring.
* JWT secret compromise lets an attacker impersonate users on the API (but not
  move their tokens, which need wallet signatures). Rotate `JWT_SECRET` and
  restart to invalidate all sessions.

### 4.7 Double counting across the two stores

**Attack.** Exploit the gap between the database ledger and the on-chain balance:
buy credits off-chain and spend the same tokens on-chain, or verify the same
tree twice.

**Controls.**

* The `carbon_credits` ledger has a unique transaction hash per issuance and a
  `(tree_id, type)` uniqueness constraint (except `burned` rows).
* A tree has one on-chain token id, unique in the database.
* A cut tree's off-chain credits are marked non-tradeable and its listings are
  cancelled; confirmation freezes the whole wallet on-chain.
* `scripts/reconcile` compares `EcoToken.balanceOf(wallet)` with the off-chain
  ledger and prints `MISMATCH` when the difference is not the known
  marketplace delta.

**Residual risk — this is the known marketplace delta.** A marketplace purchase
moves credits only in the database. The buyer's token balance does not increase
and the seller's does not decrease, so a buyer can hold fewer tokens than the
ledger claims and a seller can still spend tokens that were sold. The reconcile
tool labels this difference rather than hiding it. Until settlement is on-chain,
marketplace credits and on-chain tokens are **not** interchangeable claims, and
the marketplace must not be advertised as trustless or fully on-chain.

## 5. Operational security checklist

* Use a dedicated deploy key with testnet ETH only; never reuse a mainnet key.
* Set `ADMIN` to a multisig before deploying to a shared network; do not leave
  `DEFAULT_ADMIN_ROLE` on the deployer.
* Keep `VERIFIER`, `PAUSER` and `FREEZER` on separate keys from `ADMIN`.
* Generate `JWT_SECRET` with `openssl rand -hex 64`; never reuse the example.
* Keep `PINATA_*` server-side and rotate the JWT if it leaks.
* Configure `RPC_URL`, `ECO_CHAIN_TREE` and `ECO_TOKEN`; do not run production
  verification without them. Leaving `ECO_CHAIN_TREE` unset disables the
  emitter-address filter for tree events. Without `RPC_URL`, burn hashes are
  recorded unverified.
* Set `CORS_ORIGINS` to the real frontend origins; never use `*`.
* Back up the database, but remember it is not the source of truth for credits.
* Run `scripts/reconcile` after marketplace activity and investigate every
  `MISMATCH`.

## 6. Known limitations

1. **Single verifier trust.** One `VERIFIER_ROLE` key can verify any tree with any
   absorption rate and any past planting date. The contract enforces only that
   the score is positive and that the tree is `REGISTERED`. No quorum, no
   challenge period, no independent auditor.
2. **Static `ETH_INR_RATE`.** The marketplace minimum payment is derived from an
   operator-supplied constant. It does not follow the market and must be updated
   by hand; a stale value misprices purchases in one direction.
3. **Self-declared GPS.** The 100 m cut-report geofence checks submitted
   coordinates against stored coordinates. It is not proof that the reporter was
   physically present, and the coordinates themselves are not verified when the
   tree is registered.
4. **Marketplace settlement is off-chain.** Buying credits updates the database
   only; `EcoToken` balances do not move. This is a known accounting delta, not
   a bug that reconcile hides. There is no escrow, no atomic swap and no
   on-chain dispute resolution.
5. **Tree metadata is off-chain.** Species, photos, notes and precise GPS live in
   the database and IPFS; only the IPFS hash, planter, status and carbon score
   are on-chain. Deleting or unpinning the IPFS object does not change the
   chain, but it does make the evidence unavailable.
6. **Admin is a single point of failure.** No timelock, no two-step transfer, no
   on-chain monitoring or alerting.
7. **Rate limiting is per process and in-memory.** It is not a defence against a
   distributed attacker and resets on restart.
8. **No audit, no formal verification.** The contracts and backend have not been
   audited. The Slither job in CI is a non-blocking report, not a guarantee.
9. **Testnet only.** Nothing here establishes a legal claim to a real carbon
   offset; retiring an `EcoToken` does not retire a credit in any external
   registry.

## 7. Reporting a vulnerability

Do not open a public issue with exploit details. Open a private GitHub security
advisory on the repository (Security → Advisories → Report a vulnerability) or
contact the maintainers directly. Include the affected component, a minimal
reproduction, and the impact you believe it has. There is no paid bug bounty.

# Gas report

Measured with `hardhat-gas-reporter` on the local Hardhat network, Solidity
0.8.20, optimizer enabled with 200 runs, block limit 60,000,000 gas. Values are
gas units reported as **average** per call unless a range is shown; the "max"
column matters because the most expensive path includes the debt/freeze work.

Reproduce:

```bash
cd blockchain
REPORT_GAS=true GAS_REPORT_FILE=gas-report.txt npx hardhat test
```

CI runs the same command and uploads `blockchain/gas-report.txt` as the
`contracts-gas-report` artifact; it does not publish a gas value to the job
summary. A high gas number is informational, not a failing condition.

## Lifecycle methods

| Contract | Method | Min | Max | Avg | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| `EcoChainTree` | `registerTree` | 181,510 | 215,926 | 196,921 | Mints the ERC-721, stores IPFS hash and metadata URI |
| `EcoChainTree` | `verifyTree` | 126,625 | 160,830 | 141,002 | Mints `EcoToken` credits to the planter in the same call |
| `EcoChainTree` | `reportCut` | — | — | 36,959 | Status change only; no token movement |
| `EcoChainTree` | `confirmCut` | 198,915 | 271,626 | 246,751 | Max path: `ReplantationRegistry.createDebt` + `EcoToken.freeze(planter)` |
| `EcoChainTree` | `markReplanted` | 198,109 | 238,054 | 222,573 | Max path: link + auto-`clearDebt` (last replacement) |
| `EcoChainTree` | `rejectTree` | — | — | 52,504 | Status change only |

## Credit token methods

| Contract | Method | Min | Max | Avg | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| `EcoToken` | `transfer` | 41,144 | 58,316 | 48,545 | Blocked while the sender or recipient is frozen, or the token is paused |
| `EcoToken` | `burn` | 38,398 | 38,422 | 38,408 | Caller's own credits; blocked while frozen/paused |
| `EcoToken` | `burnFrom` | — | — | 41,592 | Allowance burn |
| `EcoToken` | `freeze` | 26,153 | 48,064 | 41,322 | Idempotent; first freeze costs the storage write |
| `EcoToken` | `approve` | — | — | 46,379 | |
| `EcoToken` | `pause` / `unpause` | — | — | 47,036 / 25,149 | Pause is global, not per account |

## Role and configuration methods

| Contract | Method | Avg | Notes |
| --- | --- | ---: | --- |
| `EcoChainTree` | `grantRole` | 51,389 | Deployment wiring and later verifier grants |
| `EcoChainTree` | `revokeRole` | 28,365 | Deployer stepping down |
| `EcoChainTree` | `setEcoToken` | 72,503 | One-time configuration |
| `EcoChainTree` | `setRegistry` | 32,232 | One-time configuration |
| `EcoToken` | `grantRole` / `revokeRole` | 51,435 / 28,801 | |
| `ReplantationRegistry` | `setTreeRegistry` | 72,411 | One-time configuration |
| `ReplantationRegistry` | `setEcoToken` | 33,294 | One-time configuration |

## Deployment cost

| Contract | Gas |
| --- | ---: |
| `EcoChainTree` | 2,739,072 |
| `ReplantationRegistry` | 1,678,383 |
| `EcoToken` | 1,249,076 |

Deployment is ~5.67M gas plus the one-time configuration calls and up to ~15
role grants/revokes. The exact figure depends on the addresses and calldata.

## Interpretation

* `confirmCut` is the most expensive lifecycle action because it writes a debt
  record, updates the debt index, flips the tree status and freezes the account.
* `markReplanted` is close behind when it clears the debt, because clearing
  writes `clearedAt`, the certificate URI, decrements `openDebtCount` and calls
  `EcoToken.freeze(..., false)`.
* Minting credits inside `verifyTree` keeps verification atomic: there is no
  window in which a tree is `VERIFIED` but its credits were not minted.
* These numbers are for the prototype and include test-suite call patterns; they
  are not a production capacity plan.

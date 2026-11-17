/**
 * Human-readable mapping for on-chain reverts.
 *
 * The contracts signal most failures as custom errors (EcoChain_*) and the
 * ERC-20 uses OpenZeppelin errors plus a few require strings. Raw ethers
 * messages are unreadable ("execution reverted (unknown custom error)") and
 * tend to be mis-reported by UIs as "out of gas". Nothing in here is ever
 * reported as a gas problem: only INSUFFICIENT_FUNDS is about the network fee.
 */

export const CUSTOM_ERROR_MESSAGES = {
  // EcoChainTree
  EcoChain_TokenDoesNotExist: "That tree token does not exist on-chain.",
  EcoChain_TreeNotRegistered: "That tree is not in the REGISTERED state.",
  EcoChain_TreeNotVerified: "That tree has not been verified on-chain yet.",
  EcoChain_TreeNotCutReported: "No cut has been reported for that tree.",
  EcoChain_TreeNotCutConfirmed: "That tree's cut has not been confirmed yet.",
  EcoChain_CarbonScoreMustBePositive: "The carbon score must be greater than zero.",
  EcoChain_ZeroCreditAmount: "That tree would mint zero credits; a longer growth period is required.",
  EcoChain_EcoTokenNotConfigured: "The EcoToken contract is not wired into the tree contract.",
  EcoChain_RegistryNotConfigured: "The replantation registry is not wired into the tree contract.",
  EcoChain_AtLeast3ReplacementsRequired: "A confirmed cut requires at least 3 replacement trees.",
  EcoChain_ReplacementsOutOfRange: "The number of replacements is outside the allowed range.",
  EcoChain_DebtExistsForTree: "A replantation debt already exists for that tree.",
  EcoChain_IPFSHashAlreadyRegistered:
    "This tree's IPFS hash has already been registered on-chain. Each tree can only be registered once.",
  EcoChain_DebtorIsNotPlanter: "Only the tree's planter can act on its replantation debt.",
  EcoChain_NoDebtForTree: "There is no replantation debt for that tree.",
  EcoChain_ReplacerMustBeVerified: "The replacement tree must be verified before it can be linked.",
  EcoChain_ReplanterMismatch: "The replacement tree must be owned by the debtor.",
  EcoChain_InvalidEcoToken: "That address is not a valid EcoToken contract.",
  EcoChain_InvalidRegistry: "That address is not a valid ReplantationRegistry contract.",
  EcoChain_EcoTokenAlreadySet: "The EcoToken address has already been set and cannot change.",
  EcoChain_RegistryAlreadySet: "The registry address has already been set and cannot change.",

  // ReplantationRegistry
  Registry_NotTreeRegistry: "Only the EcoChainTree contract can change replantation debts.",

  // OpenZeppelin
  AccessControlUnauthorizedAccount:
    "Your wallet is not allowed to do this on-chain: it is missing the required role (for example the verifier role).",
  AccessControlBadConfirmation: "That role change was not confirmed by the expected account.",
  ERC20InsufficientBalance: "Your on-chain credit balance is too low for this transaction.",
  ERC20InsufficientAllowance: "This contract is not approved to spend that many of your credits.",
  ERC20InvalidSender: "The sender address is not valid for a credit transfer.",
  ERC20InvalidReceiver: "The recipient address is not valid for a credit transfer.",
  OwnableUnauthorizedAccount: "Your wallet is not the owner of this contract.",
  EnforcedPause: "Credit transfers are paused by the platform right now.",
  ExpectedPause: "Credit transfers are not paused right now.",
};

export const REVERT_STRING_MESSAGES = {
  "EcoToken: mint to the zero address": "Cannot mint credits to the zero address.",
  "EcoToken: mint amount must be positive": "The mint amount must be greater than zero.",
  "EcoToken: burn amount must be positive": "The burn amount must be greater than zero.",
  "EcoToken: burn amount exceeds allowance": "The approved credit allowance is too low for this burn.",
  "EcoToken: already paused": "Credit transfers are already paused.",
  "EcoToken: not paused": "Credit transfers are not paused.",
  "EcoToken: cannot freeze the zero address": "Cannot freeze the zero address.",
  "EcoToken: token transfers are paused": "Credit transfers are paused by the platform right now.",
  "EcoToken: sender account is frozen":
    "Your wallet is frozen while open replantation debts remain, so its credits cannot be transferred or burned.",
  "EcoToken: recipient account is frozen": "The recipient wallet is frozen, so credits cannot be sent to it.",
};

/** Ethers-level failures that are not contract reverts. */
const ETHERS_CODE_MESSAGES = {
  ACTION_REJECTED: "You rejected the request in your wallet.",
  INSUFFICIENT_FUNDS: "Your wallet does not have enough ETH to pay the network fee for this transaction.",
  NETWORK_ERROR: "Could not reach the network. Check your connection and the configured RPC endpoint.",
  TIMEOUT: "The network request timed out. Please try again.",
};

function messageFromCandidates(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;

    const text = String(candidate);

    for (const [revertString, friendly] of Object.entries(REVERT_STRING_MESSAGES)) {
      if (text.includes(revertString)) return friendly;
    }

    for (const [errorName, friendly] of Object.entries(CUSTOM_ERROR_MESSAGES)) {
      if (text.includes(errorName)) return friendly;
    }
  }
  return null;
}

/**
 * Turn an ethers/contract error into one readable sentence.
 *
 * @param {unknown} error
 * @param {string} [fallback] used when nothing can be recognised
 * @returns {string}
 */
export function describeChainError(error, fallback = "The on-chain transaction failed.") {
  if (!error) return fallback;

  const coded = error.code && ETHERS_CODE_MESSAGES[error.code];
  if (coded) return coded;

  const directName =
    error.revert?.name || error.info?.error?.name || error.errorName || error.data?.name;
  if (directName && CUSTOM_ERROR_MESSAGES[directName]) {
    return CUSTOM_ERROR_MESSAGES[directName];
  }

  const matched = messageFromCandidates([
    error.shortMessage,
    error.reason,
    error.message,
    error.info?.error?.message,
    error.info?.error?.data?.message,
    error.error?.message,
  ]);
  if (matched) return matched;

  // A revert with a custom error we do not know about still should not be
  // described as a gas problem.
  if (typeof error.message === "string" && /revert/i.test(error.message)) {
    return `${fallback} The contract rejected the call.`;
  }

  return error.shortMessage || error.reason || error.message || fallback;
}

/**
 * Format an integer amount with the given decimals for display.
 * Pure string maths so it is safe for values larger than Number.MAX_SAFE_INTEGER.
 *
 * @param {bigint|string|number} value raw token units
 * @param {object} [options]
 * @param {number} [options.decimals=18]
 * @param {number} [options.maxFractionDigits=6] trailing zeros are trimmed
 * @returns {string}
 */
export function formatTokenAmount(value, options = {}) {
  const { decimals = 18, maxFractionDigits = 6 } = options;

  let raw;
  try {
    raw = BigInt(value ?? 0);
  } catch {
    return "0";
  }

  const negative = raw < 0n;
  if (negative) raw = -raw;

  const base = 10n ** BigInt(decimals);
  const whole = raw / base;

  let fraction = (raw % base).toString().padStart(decimals, "0");
  if (maxFractionDigits >= 0 && fraction.length > maxFractionDigits) {
    fraction = fraction.slice(0, maxFractionDigits);
  }
  fraction = fraction.replace(/0+$/, "");

  const body = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${body}` : body;
}

/** Format a raw 18-decimal EcoToken balance for display. */
export function formatEcoBalance(value) {
  return formatTokenAmount(value, { decimals: 18, maxFractionDigits: 6 });
}

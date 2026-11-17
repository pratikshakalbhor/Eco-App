import { describe, it, expect } from "vitest";
import {
  describeChainError,
  formatEcoBalance,
  formatTokenAmount,
  CUSTOM_ERROR_MESSAGES,
} from "../chainErrors";

/**
 * These tests pin the two behaviours the UI depends on:
 *   1. contract reverts get a readable reason, and permission failures are
 *      never reported as gas problems;
 *   2. raw 18-decimal token units are formatted without float rounding.
 */
describe("describeChainError", () => {
  it("maps a known EcoChainTree custom error by name", () => {
    const error = { revert: { name: "EcoChain_IPFSHashAlreadyRegistered" } };
    expect(describeChainError(error)).toBe(
      CUSTOM_ERROR_MESSAGES.EcoChain_IPFSHashAlreadyRegistered
    );
  });

  it("extracts a custom error name from an ethers message", () => {
    const error = new Error(
      'execution reverted: custom error EcoChain_AtLeast3ReplacementsRequired()'
    );
    expect(describeChainError(error)).toMatch(/at least 3 replacement trees/i);
  });

  it("reports a missing role as a permission problem, not a gas problem", () => {
    const error = new Error(
      'execution reverted: custom error AccessControlUnauthorizedAccount("0xabc", "0xdef")'
    );
    const message = describeChainError(error);
    expect(message).toMatch(/not allowed|missing the required role/i);
    expect(message).not.toMatch(/gas/i);
  });

  it("reports a frozen sender as a freeze, not a gas problem", () => {
    const error = new Error(
      "execution reverted: EcoToken: sender account is frozen"
    );
    const message = describeChainError(error);
    expect(message).toMatch(/frozen/i);
    expect(message).not.toMatch(/gas/i);
  });

  it("keeps the wallet-rejected message", () => {
    expect(describeChainError({ code: "ACTION_REJECTED" })).toMatch(/rejected/i);
  });

  it("only mentions gas for insufficient funds", () => {
    expect(describeChainError({ code: "INSUFFICIENT_FUNDS" })).toMatch(/network fee/i);
    expect(describeChainError(new Error("some unknown revert"))).not.toMatch(/out of gas/i);
  });

  it("falls back for an unknown error", () => {
    expect(describeChainError(new Error("boom"))).toBe("boom");
  });
});

describe("formatTokenAmount / formatEcoBalance", () => {
  it("formats 1e18 wei as 1 ECO", () => {
    expect(formatEcoBalance(10n ** 18n)).toBe("1");
  });

  it("formats a fractional balance without float rounding", () => {
    // 1.234567890123456789 ECO → trimmed to 6 decimals
    expect(formatEcoBalance(1234567890123456789n)).toBe("1.234567");
  });

  it("formats sub-credit amounts and zero", () => {
    expect(formatEcoBalance(0n)).toBe("0");
    expect(formatEcoBalance(500000000000000000n)).toBe("0.5");
    expect(formatEcoBalance(1n)).toBe("0");
  });

  it("handles values above Number.MAX_SAFE_INTEGER", () => {
    expect(formatEcoBalance(123456789012345678901234567890n)).toBe(
      "123456789012.345678"
    );
  });

  it("supports other decimal counts", () => {
    expect(formatTokenAmount(12345n, { decimals: 6 })).toBe("0.012345");
    expect(formatTokenAmount("2500000", { decimals: 6 })).toBe("2.5");
  });

  it("returns 0 for garbage input", () => {
    expect(formatTokenAmount("not-a-number")).toBe("0");
  });
});

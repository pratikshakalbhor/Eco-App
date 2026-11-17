import { describe, it, expect, vi, afterEach } from "vitest";

const ADDRESSES = {
  VITE_ECO_TOKEN: "0x1111111111111111111111111111111111111111",
  VITE_ECO_CHAIN_TREE: "0x2222222222222222222222222222222222222222",
  VITE_REPLANTATION_REGISTRY: "0x3333333333333333333333333333333333333333",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("web3Service contract configuration", () => {
  it("refuses to build a contract without a configured address", async () => {
    vi.stubEnv("VITE_ECO_TOKEN", "");
    vi.resetModules();
    const { getContract } = await import("../web3Service.js");

    expect(() => getContract("ecoToken", null)).toThrow(/not configured/);
  });

  it("registers all three live contracts when configured", async () => {
    for (const [key, value] of Object.entries(ADDRESSES)) vi.stubEnv(key, value);
    vi.resetModules();
    const { getContract, CONTRACT_ADDRESSES } = await import("../web3Service.js");

    expect(Object.keys(CONTRACT_ADDRESSES).sort()).toEqual([
      "ecoChainTree",
      "ecoToken",
      "replantationRegistry",
    ]);

    for (const name of Object.keys(CONTRACT_ADDRESSES)) {
      const contract = getContract(name, null);
      expect(contract.target.toLowerCase()).toBe(CONTRACT_ADDRESSES[name].toLowerCase());
    }
  });

  it("exposes the current EcoChainTree ABI signatures only", async () => {
    vi.stubEnv("VITE_ECO_CHAIN_TREE", ADDRESSES.VITE_ECO_CHAIN_TREE);
    vi.resetModules();
    const { getContract } = await import("../web3Service.js");
    const contract = getContract("ecoChainTree", null);

    // Permissionless registration: planter is msg.sender, so the only args
    // are the IPFS hash and the metadata URI.
    const register = contract.interface.getFunction("registerTree");
    expect(register.inputs.map((i) => i.name)).toEqual(["ipfsHash", "metadataURI"]);

    const verify = contract.interface.getFunction("verifyTree");
    expect(verify.inputs.map((i) => i.name)).toEqual([
      "tokenId",
      "carbonScorePerYear",
      "plantedAt",
    ]);

    const confirmCut = contract.interface.getFunction("confirmCut");
    expect(confirmCut.inputs.map((i) => i.name)).toEqual([
      "tokenId",
      "replacementsNeeded",
    ]);

    expect(contract.interface.getFunction("markReplanted").inputs.map((i) => i.name)).toEqual([
      "replacementTokenId",
      "originalTokenId",
    ]);

    // Removed legacy aliases must not come back.
    expect(contract.interface.getFunction("registerTree").inputs.length).toBe(2);
  });

  it("exposes the frozen-state getter used by the balance badge", async () => {
    vi.stubEnv("VITE_ECO_TOKEN", ADDRESSES.VITE_ECO_TOKEN);
    vi.resetModules();
    const { getContract } = await import("../web3Service.js");
    const contract = getContract("ecoToken", null);

    expect(contract.interface.getFunction("isFrozen")).toBeTruthy();
    expect(contract.interface.getFunction("balanceOf")).toBeTruthy();
    expect(contract.interface.getFunction("decimals")).toBeTruthy();
  });
});

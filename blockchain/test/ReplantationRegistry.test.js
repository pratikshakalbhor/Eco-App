const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReplantationRegistry", function () {
  let registry;
  let owner, recorder, debtor, other;

  const CERT_URI = "ipfs://QmCertificate123";

  beforeEach(async function () {
    [owner, recorder, debtor, other] = await ethers.getSigners();
    const ReplantationRegistry = await ethers.getContractFactory("ReplantationRegistry");
    registry = await ReplantationRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should set deployer as RECORDER_ROLE", async function () {
      const RECORDER_ROLE = await registry.RECORDER_ROLE();
      expect(await registry.hasRole(RECORDER_ROLE, owner.address)).to.be.true;
    });

    it("should start with 0 total debts", async function () {
      expect(await registry.totalDebts()).to.equal(0);
    });
  });

  describe("createDebt", function () {
    it("should create a new debt record", async function () {
      await registry.createDebt(1, debtor.address, 3);
      expect(await registry.totalDebts()).to.equal(1);

      const debt = await registry.debts(1);
      expect(debt.originalTokenId).to.equal(1);
      expect(debt.debtor).to.equal(debtor.address);
      expect(debt.replacementsNeeded).to.equal(3);
      expect(debt.replacementsFulfilled).to.equal(0);
      expect(debt.cleared).to.be.false;
      expect(debt.createdAt).to.be.gt(0);
    });

    it("should emit DebtCreated event", async function () {
      await expect(registry.createDebt(1, debtor.address, 3))
        .to.emit(registry, "DebtCreated")
        .withArgs(1, 1, debtor.address, 3);
    });

    it("should add debt to user's debt list", async function () {
      await registry.createDebt(1, debtor.address, 3);
      const userDebts = await registry.getUserDebts(debtor.address);
      expect(userDebts.length).to.equal(1);
      expect(userDebts[0]).to.equal(1);
    });

    it("should increment debt IDs sequentially", async function () {
      await registry.createDebt(1, debtor.address, 2);
      await registry.createDebt(2, debtor.address, 1);
      expect(await registry.totalDebts()).to.equal(2);
    });

    it("should revert with 0 replacements", async function () {
      await expect(
        registry.createDebt(1, debtor.address, 0)
      ).to.be.revertedWith("Registry: at least 1 replacement required");
    });

    it("should revert with zero address debtor", async function () {
      await expect(
        registry.createDebt(1, ethers.ZeroAddress, 3)
      ).to.be.revertedWith("Registry: invalid debtor");
    });

    it("should revert if caller lacks RECORDER_ROLE", async function () {
      await expect(
        registry.connect(other).createDebt(1, debtor.address, 3)
      ).to.be.reverted;
    });
  });

  describe("linkReplacement", function () {
    beforeEach(async function () {
      await registry.createDebt(1, debtor.address, 2);
    });

    it("should link a replacement tree to a debt", async function () {
      await registry.linkReplacement(1, 10);
      const debt = await registry.debts(1);
      expect(debt.replacementsFulfilled).to.equal(1);
    });

    it("should store replacement link data", async function () {
      await registry.linkReplacement(1, 10);
      const links = await registry.getReplacements(1);
      expect(links.length).to.equal(1);
      expect(links[0].debtId).to.equal(1);
      expect(links[0].replacementTokenId).to.equal(10);
      expect(links[0].linkedAt).to.be.gt(0);
    });

    it("should map replacement token to debt", async function () {
      await registry.linkReplacement(1, 10);
      expect(await registry.tokenToDebt(10)).to.equal(1);
    });

    it("should emit ReplacementLinked event", async function () {
      await expect(registry.linkReplacement(1, 10))
        .to.emit(registry, "ReplacementLinked")
        .withArgs(1, 10, 1);
    });

    it("should auto-clear debt when all replacements fulfilled", async function () {
      await registry.linkReplacement(1, 10);
      await expect(registry.linkReplacement(1, 11))
        .to.emit(registry, "DebtCleared");

      const debt = await registry.debts(1);
      expect(debt.cleared).to.be.true;
      expect(debt.clearedAt).to.be.gt(0);
    });

    it("should revert if debt does not exist", async function () {
      await expect(
        registry.linkReplacement(999, 10)
      ).to.be.revertedWith("Registry: debt does not exist");
    });

    it("should revert if debt already cleared", async function () {
      await registry.linkReplacement(1, 10);
      await registry.linkReplacement(1, 11);
      await expect(
        registry.linkReplacement(1, 12)
      ).to.be.revertedWith("Registry: debt already cleared");
    });

    it("should revert if token already linked to another debt", async function () {
      await registry.createDebt(2, debtor.address, 1);
      await registry.linkReplacement(1, 10);
      await expect(
        registry.linkReplacement(2, 10)
      ).to.be.revertedWith("Registry: token already linked");
    });
  });

  describe("clearDebt", function () {
    beforeEach(async function () {
      await registry.createDebt(1, debtor.address, 3);
    });

    it("should clear a debt with certificate URI", async function () {
      await registry.clearDebt(1, CERT_URI);
      const debt = await registry.debts(1);
      expect(debt.cleared).to.be.true;
      expect(debt.clearedAt).to.be.gt(0);
      expect(debt.certificateURI).to.equal(CERT_URI);
    });

    it("should emit DebtCleared event", async function () {
      await expect(registry.clearDebt(1, CERT_URI))
        .to.emit(registry, "DebtCleared")
        .withArgs(1, debtor.address, CERT_URI);
    });

    it("should revert if debt does not exist", async function () {
      await expect(
        registry.clearDebt(999, CERT_URI)
      ).to.be.revertedWith("Registry: debt does not exist");
    });

    it("should revert if debt already cleared", async function () {
      await registry.clearDebt(1, CERT_URI);
      await expect(
        registry.clearDebt(1, CERT_URI)
      ).to.be.revertedWith("Registry: already cleared");
    });
  });

  describe("getUserDebts", function () {
    it("should return empty array for user with no debts", async function () {
      const debts = await registry.getUserDebts(other.address);
      expect(debts.length).to.equal(0);
    });

    it("should return all debt IDs for a user", async function () {
      await registry.createDebt(1, debtor.address, 2);
      await registry.createDebt(2, debtor.address, 1);
      const debts = await registry.getUserDebts(debtor.address);
      expect(debts.length).to.equal(2);
    });
  });

  describe("getReplacements", function () {
    it("should return empty array for debt with no replacements", async function () {
      await registry.createDebt(1, debtor.address, 2);
      const replacements = await registry.getReplacements(1);
      expect(replacements.length).to.equal(0);
    });

    it("should return all replacement links", async function () {
      await registry.createDebt(1, debtor.address, 3);
      await registry.linkReplacement(1, 10);
      await registry.linkReplacement(1, 11);
      const replacements = await registry.getReplacements(1);
      expect(replacements.length).to.equal(2);
    });
  });
});

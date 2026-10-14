const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcoToken", function () {
  let ecoToken;
  let owner, minter, other;

  const MINT_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, minter, other] = await ethers.getSigners();
    const EcoToken = await ethers.getContractFactory("EcoToken");
    ecoToken = await EcoToken.deploy();
    await ecoToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should have correct name and symbol", async function () {
      expect(await ecoToken.name()).to.equal("EcoChain Carbon Credit");
      expect(await ecoToken.symbol()).to.equal("ECC");
    });

    it("should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await ecoToken.DEFAULT_ADMIN_ROLE();
      expect(await ecoToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should start with 0 total supply", async function () {
      expect(await ecoToken.totalSupply()).to.equal(0);
    });
  });

  describe("mint", function () {
    beforeEach(async function () {
      const MINTER_ROLE = await ecoToken.MINTER_ROLE();
      await ecoToken.grantRole(MINTER_ROLE, owner.address);
    });

    it("should mint tokens to specified address", async function () {
      await ecoToken.mint(minter.address, MINT_AMOUNT);
      expect(await ecoToken.balanceOf(minter.address)).to.equal(MINT_AMOUNT);
    });

    it("should increase total supply", async function () {
      await ecoToken.mint(minter.address, MINT_AMOUNT);
      expect(await ecoToken.totalSupply()).to.equal(MINT_AMOUNT);
    });

    it("should allow multiple mints", async function () {
      await ecoToken.mint(minter.address, MINT_AMOUNT);
      await ecoToken.mint(minter.address, MINT_AMOUNT);
      expect(await ecoToken.balanceOf(minter.address)).to.equal(MINT_AMOUNT * 2n);
    });

    it("should revert if caller lacks MINTER_ROLE", async function () {
      await expect(
        ecoToken.connect(other).mint(other.address, MINT_AMOUNT)
      ).to.be.reverted;
    });
  });

  describe("grantRole", function () {
    it("should allow admin to grant MINTER_ROLE", async function () {
      const MINTER_ROLE = await ecoToken.MINTER_ROLE();
      await ecoToken.grantRole(MINTER_ROLE, minter.address);
      expect(await ecoToken.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("should allow newly granted minter to mint", async function () {
      const MINTER_ROLE = await ecoToken.MINTER_ROLE();
      await ecoToken.grantRole(MINTER_ROLE, minter.address);
      await ecoToken.connect(minter).mint(other.address, MINT_AMOUNT);
      expect(await ecoToken.balanceOf(other.address)).to.equal(MINT_AMOUNT);
    });
  });
});

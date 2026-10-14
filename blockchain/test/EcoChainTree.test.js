const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcoChainTree", function () {
  let ecoChainTree;
  let owner, verifier, minter, planter, other;

  const IPFS_HASH = "QmTest123abc";
  const METADATA_URI = "ipfs://QmMetadata123";

  beforeEach(async function () {
    [owner, verifier, minter, planter, other] = await ethers.getSigners();
    const EcoChainTree = await ethers.getContractFactory("EcoChainTree");
    ecoChainTree = await EcoChainTree.deploy();
    await ecoChainTree.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await ecoChainTree.DEFAULT_ADMIN_ROLE();
      expect(await ecoChainTree.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should set deployer as VERIFIER_ROLE", async function () {
      const VERIFIER_ROLE = await ecoChainTree.VERIFIER_ROLE();
      expect(await ecoChainTree.hasRole(VERIFIER_ROLE, owner.address)).to.be.true;
    });

    it("should set deployer as MINTER_ROLE", async function () {
      const MINTER_ROLE = await ecoChainTree.MINTER_ROLE();
      expect(await ecoChainTree.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("should have name 'EcoChain Tree' and symbol 'ECOTREE'", async function () {
      expect(await ecoChainTree.name()).to.equal("EcoChain Tree");
      expect(await ecoChainTree.symbol()).to.equal("ECOTREE");
    });

    it("should start with totalSupply of 0", async function () {
      expect(await ecoChainTree.totalSupply()).to.equal(0);
    });
  });

  describe("registerTree", function () {
    it("should mint a new tree NFT", async function () {
      const tx = await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      await tx.wait();

      expect(await ecoChainTree.totalSupply()).to.equal(1);
      expect(await ecoChainTree.ownerOf(1)).to.equal(planter.address);
    });

    it("should set correct tree data", async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);

      const tree = await ecoChainTree.trees(1);
      expect(tree.status).to.equal(0); // REGISTERED
      expect(tree.carbonScore).to.equal(0);
      expect(tree.planter).to.equal(planter.address);
      expect(tree.ipfsHash).to.equal(IPFS_HASH);
      expect(tree.registeredAt).to.be.gt(0);
      expect(tree.verifiedAt).to.equal(0);
    });

    it("should mark IPFS hash as used", async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      expect(await ecoChainTree.ipfsHashUsed(IPFS_HASH)).to.be.true;
    });

    it("should emit TreeRegistered event", async function () {
      await expect(ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI))
        .to.emit(ecoChainTree, "TreeRegistered")
        .withArgs(1, planter.address, IPFS_HASH);
    });

    it("should reject duplicate IPFS hash", async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      await expect(
        ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI)
      ).to.be.revertedWith("EcoChain: IPFS hash already registered");
    });

    it("should increment token IDs sequentially", async function () {
      await ecoChainTree.registerTree(planter.address, "hash1", "uri1");
      await ecoChainTree.registerTree(planter.address, "hash2", "uri2");

      expect(await ecoChainTree.totalSupply()).to.equal(2);
      expect(await ecoChainTree.ownerOf(1)).to.equal(planter.address);
      expect(await ecoChainTree.ownerOf(2)).to.equal(planter.address);
    });

    it("should revert if caller lacks MINTER_ROLE", async function () {
      await expect(
        ecoChainTree.connect(other).registerTree(planter.address, IPFS_HASH, METADATA_URI)
      ).to.be.reverted;
    });
  });

  describe("verifyTree", function () {
    beforeEach(async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
    });

    it("should set tree status to VERIFIED", async function () {
      await ecoChainTree.verifyTree(1, 5000);
      const tree = await ecoChainTree.trees(1);
      expect(tree.status).to.equal(1); // VERIFIED
      expect(tree.carbonScore).to.equal(5000);
      expect(tree.verifiedAt).to.be.gt(0);
    });

    it("should emit TreeVerified and TreeStatusUpdated events", async function () {
      await expect(ecoChainTree.verifyTree(1, 5000))
        .to.emit(ecoChainTree, "TreeVerified")
        .withArgs(1, owner.address, 5000)
        .to.emit(ecoChainTree, "TreeStatusUpdated")
        .withArgs(1, 1);
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.verifyTree(999, 5000))
        .to.be.revertedWith("EcoChain: token does not exist");
    });

    it("should revert if tree not in REGISTERED state", async function () {
      await ecoChainTree.verifyTree(1, 5000);
      await expect(ecoChainTree.verifyTree(1, 5000))
        .to.be.revertedWith("EcoChain: tree must be in REGISTERED state");
    });

    it("should revert if caller lacks VERIFIER_ROLE", async function () {
      await expect(
        ecoChainTree.connect(other).verifyTree(1, 5000)
      ).to.be.reverted;
    });
  });

  describe("reportCut", function () {
    beforeEach(async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
    });

    it("should set tree status to CUT_REPORTED", async function () {
      await ecoChainTree.reportCut(1);
      const tree = await ecoChainTree.trees(1);
      expect(tree.status).to.equal(2); // CUT_REPORTED
    });

    it("should emit TreeCutReported event", async function () {
      await expect(ecoChainTree.reportCut(1))
        .to.emit(ecoChainTree, "TreeCutReported")
        .withArgs(1, owner.address);
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.reportCut(999))
        .to.be.revertedWith("EcoChain: token does not exist");
    });
  });

  describe("confirmCut", function () {
    beforeEach(async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      await ecoChainTree.reportCut(1);
    });

    it("should set tree status to CUT_CONFIRMED", async function () {
      await ecoChainTree.confirmCut(1);
      const tree = await ecoChainTree.trees(1);
      expect(tree.status).to.equal(3); // CUT_CONFIRMED
    });

    it("should emit TreeCutConfirmed and TreeStatusUpdated events", async function () {
      await expect(ecoChainTree.confirmCut(1))
        .to.emit(ecoChainTree, "TreeCutConfirmed")
        .withArgs(1, owner.address)
        .to.emit(ecoChainTree, "TreeStatusUpdated")
        .withArgs(1, 3);
    });

    it("should revert if tree not in CUT_REPORTED state", async function () {
      await ecoChainTree.confirmCut(1);
      await expect(ecoChainTree.confirmCut(1))
        .to.be.revertedWith("EcoChain: must be in CUT_REPORTED");
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.confirmCut(999))
        .to.be.revertedWith("EcoChain: token does not exist");
    });
  });

  describe("markReplanted", function () {
    let newTokenId;
    beforeEach(async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      await ecoChainTree.registerTree(planter.address, "hash2", "uri2");
      await ecoChainTree.verifyTree(2, 3000);
      newTokenId = 2;
    });

    it("should set replacement tree status to REPLANTED", async function () {
      await ecoChainTree.markReplanted(newTokenId, 1);
      const tree = await ecoChainTree.trees(newTokenId);
      expect(tree.status).to.equal(4); // REPLANTED
    });

    it("should link replacement to original token", async function () {
      await ecoChainTree.markReplanted(newTokenId, 1);
      expect(await ecoChainTree.replacesTokenId(newTokenId)).to.equal(1);
    });

    it("should emit TreeReplanted event", async function () {
      await expect(ecoChainTree.markReplanted(newTokenId, 1))
        .to.emit(ecoChainTree, "TreeReplanted")
        .withArgs(newTokenId, 1);
    });

    it("should revert if replacement tree not VERIFIED", async function () {
      await ecoChainTree.registerTree(planter.address, "hash3", "uri3");
      await expect(ecoChainTree.markReplanted(3, 1))
        .to.be.revertedWith("EcoChain: replacement must be VERIFIED");
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.markReplanted(999, 1))
        .to.be.revertedWith("EcoChain: new token does not exist");
    });
  });

  describe("rejectTree", function () {
    beforeEach(async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
    });

    it("should set tree status to REJECTED", async function () {
      await ecoChainTree.rejectTree(1);
      const tree = await ecoChainTree.trees(1);
      expect(tree.status).to.equal(5); // REJECTED
    });

    it("should emit TreeStatusUpdated event", async function () {
      await expect(ecoChainTree.rejectTree(1))
        .to.emit(ecoChainTree, "TreeStatusUpdated")
        .withArgs(1, 5);
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.rejectTree(999))
        .to.be.revertedWith("EcoChain: token does not exist");
    });
  });

  describe("getTreeDetails", function () {
    it("should return full tree data", async function () {
      await ecoChainTree.registerTree(planter.address, IPFS_HASH, METADATA_URI);
      const details = await ecoChainTree.getTreeDetails(1);

      expect(details.status).to.equal(0);
      expect(details.carbonScore).to.equal(0);
      expect(details.planter).to.equal(planter.address);
      expect(details.ipfsHash).to.equal(IPFS_HASH);
    });

    it("should revert for non-existent token", async function () {
      await expect(ecoChainTree.getTreeDetails(999))
        .to.be.revertedWith("EcoChain: token does not exist");
    });
  });

  describe("supportsInterface", function () {
    it("should support ERC721 interface", async function () {
      const ERC721InterfaceId = "0x80ac58cd";
      expect(await ecoChainTree.supportsInterface(ERC721InterfaceId)).to.be.true;
    });

    it("should support AccessControl interface", async function () {
      const AccessControlInterfaceId = "0x7965db0b";
      expect(await ecoChainTree.supportsInterface(AccessControlInterfaceId)).to.be.true;
    });
  });
});

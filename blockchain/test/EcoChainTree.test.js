const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture, latestTimestamp } = require("./fixtures/deploy");

describe("EcoChainTree", function () {
    let ctx;

    beforeEach(async function () {
        ctx = await deployFixture();
    });

    describe("Deployment and configuration", function () {
        it("should have name 'EcoChain Tree' and symbol 'ECOTREE'", async function () {
            expect(await ctx.ecoChainTree.name()).to.equal("EcoChain Tree");
            expect(await ctx.ecoChainTree.symbol()).to.equal("ECOTREE");
            expect(await ctx.ecoChainTree.totalSupply()).to.equal(0);
        });

        it("should point at the EcoToken and the ReplantationRegistry", async function () {
            expect(await ctx.ecoChainTree.ecoToken()).to.equal(await ctx.ecoToken.getAddress());
            expect(await ctx.ecoChainTree.registry()).to.equal(await ctx.registry.getAddress());
        });

        it("should revert when the eco token is set twice", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.adminSigner).setEcoToken(await ctx.ecoToken.getAddress())
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_EcoTokenAlreadySet");
        });

        it("should revert when the registry is set twice", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.adminSigner).setRegistry(await ctx.registry.getAddress())
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_RegistryAlreadySet");
        });

        it("should revert when a non-admin sets the eco token", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.otherSigner).setEcoToken(await ctx.ecoToken.getAddress())
            ).to.be.reverted;
        });

        it("should not let the deployer hold DEFAULT_ADMIN_ROLE after deployment", async function () {
            const adminRole = await ctx.ecoChainTree.DEFAULT_ADMIN_ROLE();
            expect(await ctx.ecoChainTree.hasRole(adminRole, ctx.deployerSigner.address)).to.be.false;
            expect(await ctx.ecoChainTree.hasRole(adminRole, ctx.adminSigner.address)).to.be.true;
        });
    });

    describe("registerTree", function () {
        it("should mint a new tree NFT to the planter", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmTest123", "ipfs://QmMeta")
            ).wait();

            expect(await ctx.ecoChainTree.totalSupply()).to.equal(1);
            expect(await ctx.ecoChainTree.ownerOf(1)).to.equal(ctx.planterSigner.address);
        });

        it("should set the correct tree data", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmTest123", "ipfs://QmMeta")
            ).wait();

            const tree = await ctx.ecoChainTree.trees(1);
            expect(tree.status).to.equal(0); // REGISTERED
            expect(tree.carbonScore).to.equal(0);
            expect(tree.planter).to.equal(ctx.planterSigner.address);
            expect(tree.ipfsHash).to.equal("QmTest123");
            expect(tree.registeredAt).to.be.gt(0);
            expect(tree.verifiedAt).to.equal(0);
        });

        it("should mark the IPFS hash as used and reject a duplicate", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmTest123", "ipfs://QmMeta")
            ).wait();
            expect(await ctx.ecoChainTree.ipfsHashUsed("QmTest123")).to.be.true;

            await expect(
                ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmTest123", "ipfs://QmMeta")
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_IPFSHashAlreadyRegistered");
        });

        it("should emit TreeRegistered", async function () {
            await expect(
                ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmTest123", "ipfs://QmMeta")
            )
                .to.emit(ctx.ecoChainTree, "TreeRegistered")
                .withArgs(1, ctx.planterSigner.address, "QmTest123");
        });

        it("should let any wallet register a tree for itself (permissionless)", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.otherSigner)
                    .registerTree("QmOther1", "ipfs://QmMeta")
            ).wait();

            expect(await ctx.ecoChainTree.totalSupply()).to.equal(1n);
            expect(await ctx.ecoChainTree.ownerOf(1)).to.equal(ctx.otherSigner.address);

            const data = await ctx.ecoChainTree.trees(1);
            expect(data.planter).to.equal(ctx.otherSigner.address);
            expect(data.status).to.equal(0n); // REGISTERED
        });

        it("should not grant MINTER_ROLE to anyone", async function () {
            // MINTER_ROLE was removed with permissionless registration: the
            // role constant must no longer exist on the contract.
            expect(ctx.ecoChainTree.MINTER_ROLE).to.be.undefined;
        });
    });

    describe("verifyTree", function () {
        it("should mint exactly the expected number of credits to the planter", async function () {
            const plantedAt = (await latestTimestamp()) - 3 * 365 * 24 * 3600;

            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree("QmVerify1", "ipfs://QmMeta")
            ).wait();

            const expected = await ctx.ecoChainTree.creditsForTree(1850, plantedAt);
            expect(expected).to.be.gt(0n);

            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, plantedAt)
            ).wait();

            expect(await ctx.ecoToken.balanceOf(ctx.planterSigner.address)).to.equal(expected);
            expect(await ctx.ecoToken.totalSupply()).to.equal(expected);
        });

        it("should set the tree status to VERIFIED and record the carbon score", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify2", "ipfs://QmMeta")
            ).wait();

            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())).wait();

            const tree = await ctx.ecoChainTree.trees(1);
            expect(tree.status).to.equal(1); // VERIFIED
            expect(tree.carbonScore).to.equal(1850);
            expect(tree.verifiedAt).to.be.gt(0);
        });

        it("should emit TreeVerified, TreeStatusUpdated and CreditsMinted", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify3", "ipfs://QmMeta")
            ).wait();

            const expected = await ctx.ecoChainTree.creditsForTree(1850, await latestTimestamp());

            await expect(ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, await latestTimestamp()))
                .to.emit(ctx.ecoChainTree, "TreeVerified")
                .withArgs(1, ctx.verifierSigner.address, 1850)
                .and.to.emit(ctx.ecoChainTree, "TreeStatusUpdated")
                .withArgs(1, 1)
                .and.to.emit(ctx.ecoChainTree, "CreditsMinted")
                .withArgs(1, ctx.planterSigner.address, expected);
        });

        it("should revert when verifying twice", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify4", "ipfs://QmMeta")
            ).wait();

            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotRegistered");
        });

        it("should not mint a second time when verifying twice", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify5", "ipfs://QmMeta")
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())).wait();

            const supply = await ctx.ecoToken.totalSupply();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())
            ).to.be.reverted;

            expect(await ctx.ecoToken.totalSupply()).to.equal(supply);
        });

        it("should revert for a non-existent token", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(999, 1850, latestTimestamp())
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TokenDoesNotExist");
        });

        it("should revert when the carbon score is zero", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify6", "ipfs://QmMeta")
            ).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 0, latestTimestamp())
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_CarbonScoreMustBePositive");
        });

        it("should revert if the caller lacks VERIFIER_ROLE", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmVerify7", "ipfs://QmMeta")
            ).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.otherSigner).verifyTree(1, 1850, latestTimestamp())
            ).to.be.reverted;
        });
    });

    describe("reportCut", function () {
        beforeEach(async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmCut1", "ipfs://QmMeta")
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())).wait();
        });

        it("should set the tree status to CUT_REPORTED", async function () {
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(1)).wait();
            expect((await ctx.ecoChainTree.trees(1)).status).to.equal(2); // CUT_REPORTED
        });

        it("should revert on a tree that is not VERIFIED", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmCut2", "ipfs://QmMeta")
            ).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(2)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotVerified");
        });

        it("should revert for a non-existent token", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(999)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TokenDoesNotExist");
        });
    });

    describe("confirmCut", function () {
        beforeEach(async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmConfirm1", "ipfs://QmMeta")
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(1)).wait();
        });

        it("should set the tree status to CUT_CONFIRMED", async function () {
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 3)).wait();
            expect((await ctx.ecoChainTree.trees(1)).status).to.equal(3); // CUT_CONFIRMED
        });

        it("should create the replantation debt for the planter", async function () {
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 4)).wait();

            const debtId = await ctx.registry.debtIdForOriginalToken(1);
            expect(debtId).to.equal(1);

            const debt = await ctx.registry.debts(1);
            expect(debt.originalTokenId).to.equal(1);
            expect(debt.debtor).to.equal(ctx.planterSigner.address);
            expect(debt.replacementsNeeded).to.equal(4);
            expect(debt.cleared).to.be.false;
            expect(await ctx.registry.openDebtCount(ctx.planterSigner.address)).to.equal(1);
        });

        it("should freeze the planter's credits", async function () {
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 3)).wait();

            expect(await ctx.ecoToken.isFrozen(ctx.planterSigner.address)).to.be.true;

            await expect(
                ctx.ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, ethers.parseEther("1"))
            ).to.be.revertedWith("EcoToken: sender account is frozen");
        });

        it("should revert when fewer than 3 replacements are required", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 2)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_AtLeast3ReplacementsRequired");
        });

        it("should revert if the tree is not CUT_REPORTED", async function () {
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 3)).wait();
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 3)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotCutReported");
        });

        it("should revert if the caller lacks VERIFIER_ROLE", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.otherSigner).confirmCut(1, 3)
            ).to.be.reverted;
        });
    });

    describe("markReplanted", function () {
        let originalId;
        let replacementId;

        beforeEach(async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReplant1", "ipfs://QmMeta")
            ).wait();
            originalId = 1;
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(originalId, 1850, latestTimestamp())).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(originalId)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(originalId, 3)).wait();

            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReplant2", "ipfs://QmMeta")
            ).wait();
            replacementId = 2;
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(replacementId, 1850, latestTimestamp())).wait();
        });

        it("should mark the replacement and the original as REPLANTED", async function () {
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalId)
            ).wait();

            expect((await ctx.ecoChainTree.trees(replacementId)).status).to.equal(4); // REPLANTED
            expect((await ctx.ecoChainTree.trees(originalId)).status).to.equal(4); // REPLANTED
        });

        it("should link the replacement to the original in both directions", async function () {
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalId)
            ).wait();

            expect(await ctx.ecoChainTree.replacesTokenId(replacementId)).to.equal(originalId);
            expect(await ctx.ecoChainTree.replacedByTokenId(originalId)).to.equal(replacementId);
        });

        it("should link the replacement into the debt", async function () {
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalId)
            ).wait();

            const debtId = await ctx.registry.debtIdForOriginalToken(originalId);
            const debt = await ctx.registry.debts(debtId);
            expect(debt.replacementsFulfilled).to.equal(1);
            expect(await ctx.registry.tokenToDebt(replacementId)).to.equal(debtId);
        });

        it("should revert when the original is not CUT_CONFIRMED", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReplant3", "ipfs://QmMeta")
            ).wait();
            const otherId = await ctx.ecoChainTree.totalSupply();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, otherId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotCutConfirmed");
        });

        it("should revert when the replacement is not VERIFIED", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReplant4", "ipfs://QmMeta")
            ).wait();
            const unverifiedId = await ctx.ecoChainTree.totalSupply();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(unverifiedId, originalId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_ReplacerMustBeVerified");
        });

        it("should revert when the replacement belongs to somebody else", async function () {
            const foreignId = await (
                await ctx.ecoChainTree
                    .connect(ctx.otherSigner)
                    .registerTree("QmReplant5", "ipfs://QmMeta")
            ).wait();
            const foreignTokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(foreignTokenId, 1850, latestTimestamp())
            ).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(foreignTokenId, originalId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_ReplanterMismatch");
        });
    });

    describe("rejectTree", function () {
        it("should set the tree status to REJECTED", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReject1", "ipfs://QmMeta")
            ).wait();

            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).rejectTree(1)).wait();
            expect((await ctx.ecoChainTree.trees(1)).status).to.equal(5); // REJECTED
        });

        it("should revert on a CUT_CONFIRMED tree", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmReject2", "ipfs://QmMeta")
            ).wait();
            const id = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(id, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(id)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(id, 3)).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).rejectTree(id)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotRegistered");
        });

        it("should revert for a non-existent token", async function () {
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).rejectTree(999)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TokenDoesNotExist");
        });
    });

    describe("views", function () {
        it("should return the full tree data", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmView1", "ipfs://QmMeta")
            ).wait();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, latestTimestamp())
            ).wait();

            const details = await ctx.ecoChainTree.getTreeDetails(1);
            expect(details.status).to.equal(1);
            expect(details.planter).to.equal(ctx.planterSigner.address);
            expect(details.ipfsHash).to.equal("QmView1");
        });

        it("should expose the planter and the verified flag", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.planterSigner).registerTree( "QmView2", "ipfs://QmMeta")
            ).wait();

            expect(await ctx.ecoChainTree.treePlanter(1)).to.equal(ctx.planterSigner.address);
            expect(await ctx.ecoChainTree.isTreeVerified(1)).to.be.false; // not yet verified
        });

        it("should support the ERC721 and AccessControl interfaces", async function () {
            expect(await ctx.ecoChainTree.supportsInterface("0x80ac58cd")).to.be.true;
            expect(await ctx.ecoChainTree.supportsInterface("0x7965db0b")).to.be.true;
        });
    });
});

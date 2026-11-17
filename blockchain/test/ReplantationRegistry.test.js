const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture, latestTimestamp } = require("./fixtures/deploy");

describe("ReplantationRegistry", function () {
    let ctx;

    beforeEach(async function () {
        ctx = await deployFixture();
    });

    describe("Deployment and configuration", function () {
        it("should start with 0 debts", async function () {
            expect(await ctx.registry.totalDebts()).to.equal(0);
        });

        it("should hold DEFAULT_ADMIN_ROLE on the admin only", async function () {
            const adminRole = await ctx.registry.DEFAULT_ADMIN_ROLE();
            expect(await ctx.registry.hasRole(adminRole, ctx.adminSigner.address)).to.be.true;
            expect(await ctx.registry.hasRole(adminRole, ctx.deployerSigner.address)).to.be.false;
        });

        it("should let only the tree registry call its mutation functions", async function () {
            await expect(
                ctx.registry.connect(ctx.verifierSigner).createDebt(1, ctx.debtorSigner.address, 3)
            ).to.be.revertedWith("Registry: caller is not the tree registry");
            await expect(
                ctx.registry.connect(ctx.verifierSigner).clearDebt(1, "ipfs://cert")
            ).to.be.revertedWith("Registry: caller is not the tree registry");
        });

        it("should reject setting the tree registry twice", async function () {
            await expect(
                ctx.registry.connect(ctx.adminSigner).setTreeRegistry(await ctx.ecoChainTree.getAddress())
            ).to.be.revertedWith("Registry: tree registry already set");
        });
    });

    describe("createDebt through the tree contract", function () {
        async function confirmCutFor(debtor, replacementsNeeded, ipfsTag) {
            await (
                await ctx.ecoChainTree
                    .connect(debtor)
                    .registerTree(ipfsTag, `ipfs://${ipfsTag}`)
            ).wait();
            const tokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(tokenId, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(tokenId)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(tokenId, replacementsNeeded)).wait();
            return tokenId;
        }

        it("should create a debt for the tree planter", async function () {
            const tokenId = await confirmCutFor(ctx.debtorSigner, 4, "QmRegDebt1");

            const debtId = await ctx.registry.debtIdForOriginalToken(tokenId);
            expect(debtId).to.equal(1);

            const debt = await ctx.registry.debts(debtId);
            expect(debt.originalTokenId).to.equal(tokenId);
            expect(debt.debtor).to.equal(ctx.debtorSigner.address);
            expect(debt.replacementsNeeded).to.equal(4);
            expect(debt.replacementsFulfilled).to.equal(0);
            expect(debt.cleared).to.be.false;
            expect(debt.createdAt).to.be.gt(0);

            expect(await ctx.registry.totalDebts()).to.equal(1);
            expect((await ctx.registry.getUserDebts(ctx.debtorSigner.address)).length).to.equal(1);
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(1);
        });

        it("should require replacementsNeeded >= 3", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.verifierSigner)
                    .registerTree("QmRegDebt2", "ipfs://QmMeta")
            ).wait();
            const tokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(tokenId, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(tokenId)).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(tokenId, 2)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_AtLeast3ReplacementsRequired");
        });

        it("should not create a second debt for the same tree", async function () {
            const tokenId = await confirmCutFor(ctx.debtorSigner, 4, "QmRegDebt3");

            // The tree is already CUT_CONFIRMED; confirmCut reverts rather
            // than creating a duplicate debt.
            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(tokenId, 4)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_TreeNotCutReported");

            expect(await ctx.registry.totalDebts()).to.equal(1);
        });
    });

    describe("linkReplacement", function () {
        let originalTokenId;

        beforeEach(async function () {
            // Register + verify + report + confirm cut → creates debt 1.
            // The debtor registers the tree themselves: registerTree is
            // permissionless and the planter is msg.sender.
            await (
                await ctx.ecoChainTree
                    .connect(ctx.debtorSigner)
                    .registerTree("QmLink1", "ipfs://QmMeta")
            ).wait();
            originalTokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(originalTokenId, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(originalTokenId)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(originalTokenId, 3)).wait();
        });

        async function plantVerifiedTree(owner, ipfsTag) {
            await (
                await ctx.ecoChainTree
                    .connect(owner)
                    .registerTree(ipfsTag, `ipfs://${ipfsTag}`)
            ).wait();
            const tokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(tokenId, 1850, latestTimestamp())
            ).wait();
            return tokenId;
        }

        it("should link a replacement owned by the debtor and verified", async function () {
            const replacementId = await plantVerifiedTree(ctx.debtorSigner, "QmLink2");

            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalTokenId)
            ).wait();

            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);
            const debt = await ctx.registry.debts(debtId);
            expect(debt.replacementsFulfilled).to.equal(1);
            expect(await ctx.registry.tokenToDebt(replacementId)).to.equal(debtId);
            expect((await ctx.registry.getReplacements(debtId)).length).to.equal(1);
        });

        it("should auto-clear the debt when all replacements are fulfilled", async function () {
            const replacementsNeeded = 3;
            for (let i = 1; i <= replacementsNeeded; i++) {
                const replacementId = await plantVerifiedTree(ctx.debtorSigner, `QmLink${i + 10}`);
                await (
                    await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalTokenId)
                ).wait();
            }

            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);
            const debt = await ctx.registry.debts(debtId);
            expect(debt.cleared).to.be.true;
            expect(debt.clearedAt).to.be.gt(0);
            expect(debt.replacementsFulfilled).to.equal(replacementsNeeded);
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(0);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.false;
        });

        it("should not auto-clear until all replacements are fulfilled", async function () {
            const replacementId = await plantVerifiedTree(ctx.debtorSigner, "QmLink13");

            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalTokenId)
            ).wait();

            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);
            expect((await ctx.registry.debts(debtId)).cleared).to.be.false;
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(1);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.true;
        });

        it("should reject a replacement not owned by the debtor", async function () {
            const foreignId = await plantVerifiedTree(ctx.otherSigner, "QmLink14");

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(foreignId, originalTokenId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_ReplanterMismatch");
        });

        it("should reject a replacement that is not VERIFIED", async function () {
            await (
                await ctx.ecoChainTree
                    .connect(ctx.verifierSigner)
                    .registerTree("QmLink15", "ipfs://QmMeta")
            ).wait();
            const unverifiedId = await ctx.ecoChainTree.totalSupply();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(unverifiedId, originalTokenId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_ReplacerMustBeVerified");
        });

        it("should reject a replacement token already linked to another debt", async function () {
            // One replacement tree...
            const replacementId = await plantVerifiedTree(ctx.debtorSigner, "QmLink16");

            // ...used for this debt.
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalTokenId)
            ).wait();

            // ...and a second debt for another tree owned by the same debtor.
            await (
                await ctx.ecoChainTree
                    .connect(ctx.debtorSigner)
                    .registerTree("QmLink17", "ipfs://QmMeta")
            ).wait();
            const secondTokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(secondTokenId, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(secondTokenId)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(secondTokenId, 3)).wait();

            await expect(
                ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, secondTokenId)
            ).to.be.revertedWithCustomError(ctx.ecoChainTree, "EcoChain_ReplacerMustBeVerified");
        });
    });

    describe("clearDebt", function () {
        async function confirmCutFor(debtor, replacementsNeeded, ipfsTag) {
            await (
                await ctx.ecoChainTree
                    .connect(debtor)
                    .registerTree(ipfsTag, `ipfs://${ipfsTag}`)
            ).wait();
            const tokenId = await ctx.ecoChainTree.totalSupply();
            await (
                await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(tokenId, 1850, latestTimestamp())
            ).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(tokenId)).wait();
            await (await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(tokenId, replacementsNeeded)).wait();
            return tokenId;
        }

        async function linkReplacements(originalTokenId, count, tagPrefix = "QmClear") {
            for (let i = 1; i <= count; i++) {
                await (
                    await ctx.ecoChainTree
                        .connect(ctx.debtorSigner)
                        .registerTree(`${tagPrefix}${i}`, `ipfs://${tagPrefix}${i}`)
                ).wait();
                const replacementId = await ctx.ecoChainTree.totalSupply();
                await (
                    await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(replacementId, 1850, latestTimestamp())
                ).wait();
                await (
                    await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replacementId, originalTokenId)
                ).wait();
            }
        }

        it("should not clear when replacements are insufficient", async function () {
            const originalTokenId = await confirmCutFor(ctx.debtorSigner, 5, "QmClearNeed5");

            await linkReplacements(originalTokenId, 2);

            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);
            const debt = await ctx.registry.debts(debtId);
            expect(debt.cleared).to.be.false;
            expect(debt.replacementsFulfilled).to.equal(2);
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(1);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.true;
        });

        it("should not clear when no replacements have been linked", async function () {
            const originalTokenId = await confirmCutFor(ctx.debtorSigner, 3, "QmClearZero");

            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);
            const debt = await ctx.registry.debts(debtId);
            expect(debt.cleared).to.be.false;
            expect(debt.replacementsFulfilled).to.equal(0);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.true;
        });

        it("should lift the freeze only when openDebtCount reaches 0", async function () {
            // Debt 1
            const originalTokenId1 = await confirmCutFor(ctx.debtorSigner, 3, "QmClearMulti1");
            // Debt 2
            const originalTokenId2 = await confirmCutFor(ctx.debtorSigner, 3, "QmClearMulti2");

            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(2);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.true;

            // Clear debt 1 fully.
            await linkReplacements(originalTokenId1, 3, "QmClearA");
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(1);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.true;

            // Clear debt 2 fully — now unfreeze.
            await linkReplacements(originalTokenId2, 3, "QmClearB");
            expect(await ctx.registry.openDebtCount(ctx.debtorSigner.address)).to.equal(0);
            expect(await ctx.ecoToken.isFrozen(ctx.debtorSigner.address)).to.be.false;
        });

        it("should only be callable by the tree registry", async function () {
            const originalTokenId = await confirmCutFor(ctx.debtorSigner, 3, "QmClearOnlyTree");
            const debtId = await ctx.registry.debtIdForOriginalToken(originalTokenId);

            await expect(
                ctx.registry.connect(ctx.verifierSigner).clearDebt(debtId, "ipfs://cert")
            ).to.be.revertedWith("Registry: caller is not the tree registry");
        });
    });
});

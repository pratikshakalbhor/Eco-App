const { ethers } = require("hardhat");
const { deployFixture } = require("./fixtures/deploy");

describe("Gas benchmarks", function () {
    let ctx;

    beforeEach(async function () {
        ctx = await deployFixture();
    });

    it("prints gas usage for registerTree, verifyTree, confirmCut, markReplanted and clearDebt", async function () {
        const TABLE_WIDTH = 122;
        const row = (a, b) => `${a.padEnd(30)} ${b.padEnd(90)}`;

        console.log();
        console.log("EcoChain contract gas benchmarks (local hardhat network)");
        console.log("=".repeat(TABLE_WIDTH));
        console.log(row("function", "gas used"));
        console.log("-".repeat(TABLE_WIDTH));

        // registerTree
        const regTx = await (
            await ctx.ecoChainTree
                .connect(ctx.planterSigner)
                .registerTree("gas-reg-1", "ipfs://gas-reg-1")
        ).wait();
        const regGas = regTx.gasUsed.toString();
        console.log(row("registerTree", regGas));

        // verifyTree
        const plantedAt = (await ethers.provider.getBlock("latest")).timestamp;
        const verifyTx = await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(1, 1850, plantedAt)
        ).wait();
        const verifyGas = verifyTx.gasUsed.toString();
        console.log(row("verifyTree (with mint)", verifyGas));

        // reportCut
        const reportTx = await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).reportCut(1)
        ).wait();
        const reportGas = reportTx.gasUsed.toString();
        console.log(row("reportCut", reportGas));

        // confirmCut
        const confirmTx = await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).confirmCut(1, 3)
        ).wait();
        const confirmGas = confirmTx.gasUsed.toString();
        console.log(row("confirmCut (debt + freeze)", confirmGas));

        // plant and verify replacement tree
        await (
            await ctx.ecoChainTree
                .connect(ctx.planterSigner)
                .registerTree("gas-repl-1", "ipfs://gas-repl-1")
        ).wait();
        const replTokenId = await ctx.ecoChainTree.totalSupply();
        await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(replTokenId, 1850, plantedAt)
        ).wait();

        // markReplanted (links into debt)
        const markTx = await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replTokenId, 1)
        ).wait();
        const markGas = markTx.gasUsed.toString();
        console.log(row("markReplanted", markGas));

        // clearDebt (debt with 3 replacements needed → need 2 more)
        await (
            await ctx.ecoChainTree
                .connect(ctx.planterSigner)
                .registerTree("gas-repl-2", "ipfs://gas-repl-2")
        ).wait();
        const replTokenId2 = await ctx.ecoChainTree.totalSupply();
        await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(replTokenId2, 1850, plantedAt)
        ).wait();
        await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replTokenId2, 1)
        ).wait();
        await (
            await ctx.ecoChainTree
                .connect(ctx.planterSigner)
                .registerTree("gas-repl-3", "ipfs://gas-repl-3")
        ).wait();
        const replTokenId3 = await ctx.ecoChainTree.totalSupply();
        await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).verifyTree(replTokenId3, 1850, plantedAt)
        ).wait();

        const clearTx = await (
            await ctx.ecoChainTree.connect(ctx.verifierSigner).markReplanted(replTokenId3, 1)
        ).wait();
        const clearGas = clearTx.gasUsed.toString();
        console.log(row("clearDebt (via markReplanted)", clearGas));

        console.log("-".repeat(TABLE_WIDTH));
        console.log(row("notes", "gas values are illustrative local-hardhat runs"));
        console.log();
    });
});

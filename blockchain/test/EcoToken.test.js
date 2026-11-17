const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture, registerAndVerify } = require("./fixtures/deploy");

const ONE = 10n ** 18n;

describe("EcoToken", function () {
    let ctx;

    beforeEach(async function () {
        ctx = await deployFixture();
    });

    describe("Deployment and role layout", function () {
        it("should have the correct name, symbol and decimals", async function () {
            expect(await ctx.ecoToken.name()).to.equal("EcoChain Carbon Credit");
            expect(await ctx.ecoToken.symbol()).to.equal("ECC");
            expect(await ctx.ecoToken.decimals()).to.equal(18);
            expect(await ctx.ecoToken.totalSupply()).to.equal(0);
        });

        it("should give MINTER_ROLE to the tree contract and not to the deployer", async function () {
            const minter = await ctx.ecoToken.MINTER_ROLE();
            expect(await ctx.ecoToken.hasRole(minter, await ctx.ecoChainTree.getAddress())).to.be.true;
            expect(await ctx.ecoToken.hasRole(minter, ctx.deployerSigner.address)).to.be.false;
            expect(await ctx.ecoToken.hasRole(minter, ctx.adminSigner.address)).to.be.false;
        });

        it("should give DEFAULT_ADMIN_ROLE to the admin and not to the deployer", async function () {
            const admin = await ctx.ecoToken.DEFAULT_ADMIN_ROLE();
            expect(await ctx.ecoToken.hasRole(admin, ctx.adminSigner.address)).to.be.true;
            expect(await ctx.ecoToken.hasRole(admin, ctx.deployerSigner.address)).to.be.false;
        });

        it("should give FREEZER_ROLE to the tree contract and the registry", async function () {
            const freezer = await ctx.ecoToken.FREEZER_ROLE();
            expect(await ctx.ecoToken.hasRole(freezer, await ctx.ecoChainTree.getAddress())).to.be.true;
            expect(await ctx.ecoToken.hasRole(freezer, await ctx.registry.getAddress())).to.be.true;
        });

        it("should give PAUSER_ROLE to the pauser", async function () {
            const pauser = await ctx.ecoToken.PAUSER_ROLE();
            expect(await ctx.ecoToken.hasRole(pauser, ctx.pauserSigner.address)).to.be.true;
            expect(await ctx.ecoToken.hasRole(pauser, ctx.deployerSigner.address)).to.be.false;
        });
    });

    describe("mint", function () {
        it("should mint through the tree contract when a tree is verified", async function () {
            await registerAndVerify(ctx, ctx.planterSigner, "hash-mint-1");

            const balance = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            expect(balance).to.be.gt(0n);
            expect(await ctx.ecoToken.totalSupply()).to.equal(balance);
        });

        it("should revert if the caller lacks MINTER_ROLE", async function () {
            await expect(
                ctx.ecoToken.connect(ctx.otherSigner).mint(ctx.otherSigner.address, ONE)
            ).to.be.reverted;
        });

        it("should revert if the deployer tries to mint directly", async function () {
            await expect(
                ctx.ecoToken.connect(ctx.deployerSigner).mint(ctx.deployerSigner.address, ONE)
            ).to.be.reverted;
        });
    });

    describe("burn", function () {
        beforeEach(async function () {
            await registerAndVerify(ctx, ctx.planterSigner, "hash-burn-1");
        });

        it("should reduce the total supply and the holder balance", async function () {
            const before = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            const supplyBefore = await ctx.ecoToken.totalSupply();

            await (await ctx.ecoToken.connect(ctx.planterSigner).burn(before / 2n)).wait();

            expect(await ctx.ecoToken.balanceOf(ctx.planterSigner.address)).to.equal(before / 2n);
            expect(await ctx.ecoToken.totalSupply()).to.equal(supplyBefore - before / 2n);
        });

        it("should revert when burning more than the balance", async function () {
            const balance = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            await expect(
                ctx.ecoToken.connect(ctx.planterSigner).burn(balance + 1n)
            ).to.be.reverted;
        });

        it("should burnFrom using the allowance", async function () {
            const balance = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            const amount = balance / 4n;

            await (
                await ctx.ecoToken
                    .connect(ctx.planterSigner)
                    .approve(ctx.otherSigner.address, amount)
            ).wait();

            await (await ctx.ecoToken.connect(ctx.otherSigner).burnFrom(ctx.planterSigner.address, amount)).wait();

            expect(await ctx.ecoToken.balanceOf(ctx.planterSigner.address)).to.equal(balance - amount);
            expect(await ctx.ecoToken.allowance(ctx.planterSigner.address, ctx.otherSigner.address)).to.equal(0n);
        });

        it("should revert when burnFrom exceeds the allowance", async function () {
            const balance = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            await expect(
                ctx.ecoToken.connect(ctx.otherSigner).burnFrom(ctx.planterSigner.address, balance)
            ).to.be.revertedWith(/EcoToken: burn amount exceeds allowance/);
        });
    });

    describe("freeze", function () {
        beforeEach(async function () {
            await registerAndVerify(ctx, ctx.planterSigner, "hash-freeze-1");
        });

        it("should emit Frozen and Unfrozen", async function () {
            await expect(
                ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)
            )
                .to.emit(ctx.ecoToken, "Frozen")
                .withArgs(ctx.planterSigner.address);

            await expect(
                ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, false)
            )
                .to.emit(ctx.ecoToken, "Unfrozen")
                .withArgs(ctx.planterSigner.address);
        });

        it("should prevent a frozen account from transferring", async function () {
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)).wait();

            await expect(
                ctx.ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, ONE)
            ).to.be.revertedWith("EcoToken: sender account is frozen");
        });

        it("should prevent a frozen account from burning", async function () {
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)).wait();

            await expect(
                ctx.ecoToken.connect(ctx.planterSigner).burn(ONE)
            ).to.be.revertedWith("EcoToken: sender account is frozen");
        });

        it("should prevent a frozen account from receiving a transfer", async function () {
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)).wait();

            await expect(
                ctx.ecoToken.connect(ctx.otherSigner).transfer(ctx.planterSigner.address, ONE)
            ).to.be.revertedWith("EcoToken: recipient account is frozen");
        });

        it("should restore transfers once unfrozen", async function () {
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)).wait();
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, false)).wait();

            const before = await ctx.ecoToken.balanceOf(ctx.otherSigner.address);
            const all = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            await (await ctx.ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, all)).wait();
            expect(await ctx.ecoToken.balanceOf(ctx.otherSigner.address)).to.equal(before + all);
        });

        it("should still allow minting to a frozen account", async function () {
            await (await ctx.ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)).wait();

            const before = await ctx.ecoToken.balanceOf(ctx.planterSigner.address);
            await registerAndVerify(ctx, ctx.planterSigner, "hash-freeze-2");

            expect(await ctx.ecoToken.balanceOf(ctx.planterSigner.address)).to.be.gt(before);
        });

        it("should revert if the caller lacks FREEZER_ROLE", async function () {
            await expect(
                ctx.ecoToken.connect(ctx.otherSigner).freeze(ctx.otherSigner.address, true)
            ).to.be.reverted;
        });
    });

    describe("pause", function () {
        beforeEach(async function () {
            await registerAndVerify(ctx, ctx.planterSigner, "hash-pause-1");
        });

        it("should emit Paused and Unpaused", async function () {
            await expect(ctx.ecoToken.connect(ctx.pauserSigner).pause())
                .to.emit(ctx.ecoToken, "Paused")
                .withArgs(ctx.pauserSigner.address);
            await expect(ctx.ecoToken.connect(ctx.pauserSigner).unpause())
                .to.emit(ctx.ecoToken, "Unpaused")
                .withArgs(ctx.pauserSigner.address);
        });

        it("should block transfers and burns while paused", async function () {
            await (await ctx.ecoToken.connect(ctx.pauserSigner).pause()).wait();

            await expect(
                ctx.ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, ONE)
            ).to.be.revertedWith("EcoToken: token transfers are paused");
            await expect(ctx.ecoToken.connect(ctx.planterSigner).burn(ONE)).to.be.revertedWith(
                "EcoToken: token transfers are paused"
            );
        });

        it("should still allow minting while paused", async function () {
            await (await ctx.ecoToken.connect(ctx.pauserSigner).pause()).wait();

            const before = await ctx.ecoToken.totalSupply();
            await registerAndVerify(ctx, ctx.planterSigner, "hash-pause-2");
            expect(await ctx.ecoToken.totalSupply()).to.be.gt(before);
        });

        it("should revert if the caller lacks PAUSER_ROLE", async function () {
            await expect(ctx.ecoToken.connect(ctx.otherSigner).pause()).to.be.reverted;
        });
    });
});

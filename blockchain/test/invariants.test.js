const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployFixture, registerAndVerify, latestTimestamp } = require("./fixtures/deploy");

/**
 * Property tests over pseudo-random operation sequences.
 *
 * The PRNG is seeded so a failure is always reproducible: the seed and the
 * iteration number are printed, and setting INVARIANT_SEED replays the run.
 *
 * These are invariants, not example-based tests: each one must hold after
 * *every* operation, not just at the end.
 */

/** mulberry32: tiny deterministic PRNG, returns a float in [0, 1). */
function makeRng(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = Number(process.env.INVARIANT_SEED || 1337);
const ITERATIONS = Number(process.env.INVARIANT_ITERATIONS || 40);
const ONE_YEAR = 365 * 24 * 60 * 60;

async function totalBalanceOf(token, actors) {
    let sum = 0n;
    for (const actor of actors) {
        sum += await token.balanceOf(actor.address);
    }
    return sum;
}

describe("Invariants (seeded property tests)", function () {
    this.timeout(180000);

    describe("EcoToken supply", function () {
        it("totalSupply always equals the sum of all balances after random register/verify/transfer/burn/freeze sequences", async function () {
            const ctx = await deployFixture();
            const { ecoToken, ecoChainTree } = ctx;
            const rng = makeRng(SEED);
            const actors = [ctx.planterSigner, ctx.otherSigner, ctx.debtorSigner];

            const randomActor = () => actors[Math.floor(rng() * actors.length)];
            const randomAmount = async (balance) => {
                if (balance === 0n) return 0n;
                // Keep at least 1 wei sometimes, send everything sometimes.
                const fraction = BigInt(Math.floor(rng() * 1e6) + 1);
                const amount = (balance * fraction) / 1_000_000n;
                return amount === 0n ? 1n : amount;
            };

            for (let i = 0; i < ITERATIONS; i++) {
                const action = rng();
                const context = `seed=${SEED} iteration=${i}`;

                if (action < 0.35) {
                    // Mint through the only path that can mint in production:
                    // register a tree and have the verifier verify it.
                    await registerAndVerify(
                        ctx,
                        randomActor(),
                        `QmSupply${SEED}-${i}`,
                        { plantedAt: (await latestTimestamp()) - ONE_YEAR }
                    );
                } else if (action < 0.65) {
                    const sender = randomActor();
                    const recipient = randomActor();
                    const balance = await ecoToken.balanceOf(sender.address);
                    const amount = await randomAmount(balance);
                    if (amount > 0n && sender.address !== recipient.address) {
                        if (await ecoToken.frozen(sender.address)) {
                            await expect(
                                ecoToken.connect(sender).transfer(recipient.address, amount)
                            ).to.be.revertedWith("EcoToken: sender account is frozen");
                        } else if (await ecoToken.frozen(recipient.address)) {
                            await expect(
                                ecoToken.connect(sender).transfer(recipient.address, amount)
                            ).to.be.revertedWith("EcoToken: recipient account is frozen");
                        } else {
                            await (await ecoToken.connect(sender).transfer(recipient.address, amount)).wait();
                        }
                    }
                } else if (action < 0.85) {
                    const sender = randomActor();
                    const balance = await ecoToken.balanceOf(sender.address);
                    const amount = await randomAmount(balance);
                    if (amount > 0n) {
                        if (await ecoToken.frozen(sender.address)) {
                            await expect(
                                ecoToken.connect(sender).burn(amount)
                            ).to.be.revertedWith("EcoToken: sender account is frozen");
                        } else {
                            await (await ecoToken.connect(sender).burn(amount)).wait();
                        }
                    }
                } else {
                    const actor = randomActor();
                    const shouldFreeze = !(await ecoToken.frozen(actor.address));
                    await (
                        await ecoToken.connect(ctx.freezerSigner).freeze(actor.address, shouldFreeze)
                    ).wait();

                    if (shouldFreeze) {
                        // A frozen account must not lose a single wei.
                        const before = await ecoToken.balanceOf(actor.address);
                        const other = actors.find((a) => a.address !== actor.address);
                        await expect(
                            ecoToken.connect(actor).transfer(other.address, 1n)
                        ).to.be.revertedWith("EcoToken: sender account is frozen");
                        await expect(ecoToken.connect(actor).burn(1n)).to.be.revertedWith(
                            "EcoToken: sender account is frozen"
                        );
                        expect(await ecoToken.balanceOf(actor.address), context).to.equal(before);
                    }
                }

                // The invariant: every credit that exists is held by someone.
                expect(await totalBalanceOf(ecoToken, actors), context).to.equal(
                    await ecoToken.totalSupply()
                );
                // The tree contract never holds credits.
                expect(await ecoToken.balanceOf(await ecoChainTree.getAddress())).to.equal(0n);
            }
        });

        it("a frozen account cannot transfer in, transfer out or burn", async function () {
            const ctx = await deployFixture();
            const { ecoToken } = ctx;

            await registerAndVerify(ctx, ctx.planterSigner, "QmFrozenPlanter", {
                plantedAt: (await latestTimestamp()) - ONE_YEAR,
            });
            await (
                await ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, true)
            ).wait();

            const balance = await ecoToken.balanceOf(ctx.planterSigner.address);
            expect(balance).to.be.gt(0);

            // Outbound transfer and burn are refused.
            await expect(
                ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, 1n)
            ).to.be.revertedWith("EcoToken: sender account is frozen");
            await expect(ecoToken.connect(ctx.planterSigner).burn(1n)).to.be.revertedWith(
                "EcoToken: sender account is frozen"
            );

            // Inbound transfers are refused too.
            await registerAndVerify(ctx, ctx.otherSigner, "QmFrozenOther", {
                plantedAt: (await latestTimestamp()) - ONE_YEAR,
            });
            await expect(
                ecoToken.connect(ctx.otherSigner).transfer(ctx.planterSigner.address, 1n)
            ).to.be.revertedWith("EcoToken: recipient account is frozen");

            expect(await ecoToken.balanceOf(ctx.planterSigner.address)).to.equal(balance);

            // Unfreezing restores movement without changing the balance.
            await (await ecoToken.connect(ctx.freezerSigner).freeze(ctx.planterSigner.address, false)).wait();
            await (await ecoToken.connect(ctx.planterSigner).transfer(ctx.otherSigner.address, 1n)).wait();
            expect(await ecoToken.balanceOf(ctx.planterSigner.address)).to.equal(balance - 1n);
        });
    });

    describe("ReplantationRegistry debts", function () {
        it("every cleared debt has replacementsFulfilled >= replacementsNeeded, and the freeze tracks openDebtCount", async function () {
            const ctx = await deployFixture();
            const { registry, ecoToken, ecoChainTree } = ctx;
            const rng = makeRng(SEED + 1);
            const debtor = ctx.debtorSigner;
            const plantedAt = (await latestTimestamp()) - ONE_YEAR;

            for (let i = 0; i < 12; i++) {
                const context = `seed=${SEED + 1} iteration=${i}`;

                // Cut a tree of the debtor: this creates a debt and freezes
                // the account.
                const cutId = await registerAndVerify(ctx, debtor, `QmDebtCut${SEED}-${i}`, {
                    plantedAt,
                });
                await (await ecoChainTree.connect(ctx.verifierSigner).reportCut(cutId)).wait();
                const needed = 3 + (i % 3);
                await (
                    await ecoChainTree.connect(ctx.verifierSigner).confirmCut(cutId, needed)
                ).wait();

                const debtId = await registry.debtIdForOriginalToken(cutId);
                expect(debtId).to.not.equal(0n, context);
                expect(await ecoToken.frozen(debtor.address), context).to.be.true;

                // Plant between 0 and `needed` replacements. Reaching
                // `needed` clears the debt inside markReplanted.
                const toPlant = Math.floor(rng() * (needed + 1));
                for (let r = 0; r < toPlant; r++) {
                    const replacementId = await registerAndVerify(
                        ctx,
                        debtor,
                        `QmDebtRepl${SEED}-${i}-${r}`,
                        { plantedAt }
                    );
                    await (
                        await ecoChainTree
                            .connect(ctx.verifierSigner)
                            .markReplanted(replacementId, cutId)
                    ).wait();
                }

                // Invariants over *all* debts, after every cut.
                const totalDebts = Number(await registry.totalDebts());
                let openDebts = 0;
                for (let d = 1; d <= totalDebts; d++) {
                    const debt = await registry.debts(d);
                    const fulfilled = Number(debt.replacementsFulfilled);
                    const required = Number(debt.replacementsNeeded);
                    if (debt.cleared) {
                        expect(fulfilled, `${context} debt ${d}`).to.be.gte(required);
                        expect(debt.clearedAt).to.be.gt(0);
                    } else {
                        expect(fulfilled, `${context} debt ${d}`).to.be.lt(required);
                        openDebts += 1;
                    }
                }

                expect(Number(await registry.openDebtCount(debtor.address)), context).to.equal(
                    openDebts
                );
                expect(await ecoToken.frozen(debtor.address), context).to.equal(openDebts > 0);
            }
        });
    });
});

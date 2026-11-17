/**
 * Local end-to-end proof of the anti-double-counting design.
 *
 * Run against a local Hardhat node:
 *
 *   # terminal 1
 *   npx hardhat node
 *   # terminal 2
 *   npx hardhat run scripts/e2e-local.js --network localhost
 *
 * The script deploys the full deployment through `deployCore` (the same
 * wiring production uses), then exercises the real user journey:
 *
 *   register (normal wallet) -> verify (verifier) -> report cut -> confirm
 *   cut -> credits frozen -> 3 replacement trees -> unfrozen -> transfer again
 *
 * Every assertion prints PASS/FAIL and the process exits non-zero when any
 * assertion fails.
 */

const { ethers } = require("hardhat");
const { deployAndWire } = require("./deployCore");

const YEAR = 365 * 24 * 60 * 60;

let failures = 0;

function check(name, condition, detail = "") {
    if (condition) {
        console.log(`PASS  ${name}`);
    } else {
        failures++;
        console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    }
}

async function expectRevert(name, fn, pattern) {
    try {
        await fn();
        check(name, false, "transaction did not revert");
    } catch (error) {
        const text = [
            error?.shortMessage,
            error?.reason,
            error?.message,
            error?.info?.error?.message,
        ]
            .filter(Boolean)
            .join(" | ");
        check(name, pattern.test(text), `reverted with: ${text}`);
    }
}

async function main() {
    const network = await ethers.provider.getNetwork();
    console.log(`\nEcoChain local end-to-end (chainId ${network.chainId})\n`);

    const signers = await ethers.getSigners();
    const [, admin, verifier, pauser, freezer, planter, recipient, stranger] = signers;

    if (!planter || !recipient) {
        throw new Error("the local node must expose at least 7 funded accounts");
    }

    // ── Deploy exactly like production ────────────────────────────────────
    const ctx = await deployAndWire({
        admin: admin.address,
        verifier: verifier.address,
        pauser: pauser.address,
        freezer: freezer.address,
    });

    const { ecoToken, ecoChainTree, registry } = ctx;
    console.log(`EcoToken        ${await ecoToken.getAddress()}`);
    console.log(`EcoChainTree    ${await ecoChainTree.getAddress()}`);
    console.log(`Registry        ${await registry.getAddress()}\n`);

    check(
        "deployer keeps no MINTER_ROLE",
        !(await ecoToken.hasRole(await ecoToken.MINTER_ROLE(), ctx.deployer.address))
    );

    // ── 1. Permissionless registration from an ordinary wallet ─────────────
    const plantedAt = (await latestTimestamp()) - 3 * YEAR;
    await (
        await ecoChainTree.connect(planter).registerTree("QmE2eTree1", "ipfs://QmE2eTree1")
    ).wait();
    const tokenId = await ecoChainTree.totalSupply();

    check("planter (non-deployer) can register a tree", tokenId === 1n);
    check("registered tree is owned by the planter", (await ecoChainTree.ownerOf(tokenId)) === planter.address);

    // ── 2. Verification mints exactly the on-chain formula amount ──────────
    const expected = await ecoChainTree.creditsForTree(1850, plantedAt);
    check("creditsForTree is positive", expected > 0n, `got ${expected}`);

    const verifyTx = await (
        await ecoChainTree.connect(verifier).verifyTree(tokenId, 1850, plantedAt)
    ).wait();
    const minted = findEvent(ecoChainTree, verifyTx, "CreditsMinted");
    check("verification emitted CreditsMinted", Boolean(minted));
    check(
        "CreditsMinted tokenId is the tree",
        minted && minted.args.tokenId === tokenId,
        minted ? `got ${minted.args.tokenId}` : ""
    );
    check(
        "CreditsMinted planter is the planter",
        minted && minted.args.planter === planter.address,
        minted ? `got ${minted.args.planter}` : ""
    );
    check(
        "CreditsMinted amount equals creditsForTree",
        minted && minted.args.amount === expected,
        minted ? `got ${minted.args.amount}, expected ${expected}` : ""
    );

    check("EcoToken.totalSupply() > 0", (await ecoToken.totalSupply()) === expected);
    check(
        "planter balance equals the minted amount",
        (await ecoToken.balanceOf(planter.address)) === expected,
        `got ${await ecoToken.balanceOf(planter.address)}`
    );
    check(
        "verifier received no credits",
        (await ecoToken.balanceOf(verifier.address)) === 0n
    );

    // Transfers work before the cut.
    await (await ecoToken.connect(planter).transfer(recipient.address, 1n)).wait();
    check(
        "credits transfer before any cut",
        (await ecoToken.balanceOf(recipient.address)) === 1n
    );

    // ── 3. Cut: report then confirm ───────────────────────────────────────
    await (await ecoChainTree.connect(verifier).reportCut(tokenId)).wait();
    const confirmTx = await (await ecoChainTree.connect(verifier).confirmCut(tokenId, 3)).wait();

    check(
        "cut confirmation emitted TreeCutConfirmed",
        Boolean(findEvent(ecoChainTree, confirmTx, "TreeCutConfirmed"))
    );
    check(
        "confirmed cut created an on-chain debt",
        (await registry.debtIdForOriginalToken(tokenId)) !== 0n
    );
    check("planter is frozen after the confirmed cut", await ecoToken.isFrozen(planter.address));

    await expectRevert(
        "frozen planter cannot transfer credits",
        () => ecoToken.connect(planter).transfer(stranger.address, 1n),
        /frozen/i
    );
    await expectRevert(
        "frozen planter cannot burn credits",
        () => ecoToken.connect(planter).burn(1n),
        /frozen/i
    );

    // ── 4. Three replacement trees clear the debt and unfreeze ────────────
    const replacements = 3;
    for (let i = 1; i <= replacements; i++) {
        await (
            await ecoChainTree.connect(planter).registerTree(`QmReplacement${i}`, `ipfs://QmReplacement${i}`)
        ).wait();
        const replacementId = await ecoChainTree.totalSupply();
        await (
            await ecoChainTree.connect(verifier).verifyTree(replacementId, 1850, plantedAt)
        ).wait();
        await (
            await ecoChainTree.connect(verifier).markReplanted(replacementId, tokenId)
        ).wait();
    }

    const debtId = await registry.debtIdForOriginalToken(tokenId);
    const debt = await registry.debts(debtId);
    check("debt is cleared after 3 replacement trees", debt.cleared === true);
    check("planter is unfrozen after the debt clears", !(await ecoToken.isFrozen(planter.address)));

    await (await ecoToken.connect(planter).transfer(stranger.address, 1n)).wait();
    check(
        "transfer works again after unfreezing",
        (await ecoToken.balanceOf(stranger.address)) === 1n
    );

    // The budget is exhausted by now; the planter should hold the rest.
    const remaining = await ecoToken.balanceOf(planter.address);
    await (await ecoToken.connect(planter).transfer(stranger.address, remaining)).wait();
    check(
        "planter can move the whole remaining balance",
        (await ecoToken.balanceOf(planter.address)) === 0n
    );

    console.log(`\n${failures === 0 ? "ALL ASSERTIONS PASSED" : `${failures} ASSERTION(S) FAILED`}\n`);
    if (failures > 0) process.exitCode = 1;
}

function findEvent(contract, receipt, name) {
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contract.target.toLowerCase()) continue;
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === name) return parsed;
        } catch {
            // not an event of this contract
        }
    }
    return null;
}

async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

main().catch((error) => {
    console.error("\nE2E ABORTED:", error);
    process.exitCode = 1;
});

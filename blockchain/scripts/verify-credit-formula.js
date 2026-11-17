// Cross-checks the Solidity credit formula against the Go backend formula
// (Backend/api-server/services/carbon_service.go).
//
//   kg     = rate * age
//   credit = round(kg / 1000 * 10000) / 10000
//   amount = credit * 1e18
//
// Run with: node scripts/verify-credit-formula.js
const { ethers } = require("hardhat");

function goCreditsForTree(rateKgPerYear, ageYears) {
    const KG_PER_CREDIT = 1000;
    if (rateKgPerYear <= 0) rateKgPerYear = 18.5;
    const kg = rateKgPerYear * ageYears;
    // Go's math.Round rounds half away from zero; all values here are positive.
    const rounded = Math.round((kg / KG_PER_CREDIT) * 10000);
    return rounded / 10000;
}

async function main() {
    const EcoChainTree = await ethers.getContractFactory("EcoChainTree");
    const tree = await EcoChainTree.deploy();
    await tree.waitForDeployment();

    const now = Math.floor(Date.now() / 1000);
    const cases = [
        { rate: 1850, ageYears: 0.1, label: "18.5 kg/yr, age 0.1 (floor)" },
        { rate: 1850, ageYears: 1, label: "18.5 kg/yr, age 1" },
        { rate: 1850, ageYears: 3, label: "18.5 kg/yr, age 3" },
        { rate: 1850, ageYears: 7.5, label: "18.5 kg/yr, age 7.5" },
        { rate: 3500, ageYears: 2.25, label: "35 kg/yr, age 2.25" },
        { rate: 2100, ageYears: 12, label: "21 kg/yr, age 12" },
        { rate: 1600, ageYears: 0.5, label: "16 kg/yr, age 0.5" },
        { rate: 2600, ageYears: 20.5, label: "26 kg/yr, age 20.5" },
    ];

    let failures = 0;
    console.log(
        `${"case".padEnd(34)} ${"go credits".padEnd(16)} ${"solidity credits".padEnd(18)} match`
    );
    console.log("-".repeat(90));

    for (const c of cases) {
        const plantedAt = now - Math.round(c.ageYears * 365 * 24 * 3600);
        const solidityAmount = await tree.creditsForTree(c.rate, plantedAt);
        const solidityCredits = Number(solidityAmount) / 1e18;

        const goCredits = goCreditsForTree(c.rate / 100, c.ageYears);

        // The contract's age is derived from the block timestamp, which is a
        // little later than `now`, so allow a tiny drift.
        const match = Math.abs(solidityCredits - goCredits) <= 0.0002;
        if (!match) failures += 1;

        console.log(
            `${c.label.padEnd(34)} ${goCredits.toFixed(6).padEnd(16)} ${solidityCredits
                .toFixed(6)
                .padEnd(18)} ${match ? "YES" : "NO  <-- MISMATCH"}`
        );
    }

    console.log("-".repeat(90));
    if (failures > 0) {
        console.log(`FAILED: ${failures} mismatch(es)`);
        process.exit(1);
    }
    console.log("All cases match the Go backend formula.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

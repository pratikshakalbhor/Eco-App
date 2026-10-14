const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TreeCuttingReport", function () {
  let treeCuttingReport;
  let owner, reporter, other;

  beforeEach(async function () {
    [owner, reporter, other] = await ethers.getSigners();
    const TreeCuttingReport = await ethers.getContractFactory("TreeCuttingReport");
    treeCuttingReport = await TreeCuttingReport.deploy();
    await treeCuttingReport.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set deployer as DEFAULT_ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await treeCuttingReport.DEFAULT_ADMIN_ROLE();
      expect(await treeCuttingReport.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe("reportCutting", function () {
    beforeEach(async function () {
      const REPORTER_ROLE = await treeCuttingReport.REPORTER_ROLE();
      await treeCuttingReport.grantRole(REPORTER_ROLE, owner.address);
    });

    it("should store a cutting report", async function () {
      await treeCuttingReport.reportCutting(1, "Illegal logging");
      const report = await treeCuttingReport.reports(1);

      expect(report.tokenId).to.equal(1);
      expect(report.reason).to.equal("Illegal logging");
      expect(report.timestamp).to.be.gt(0);
      expect(report.reporter).to.equal(owner.address);
    });

    it("should emit TreeCutReported event", async function () {
      await expect(treeCuttingReport.reportCutting(1, "Deforestation"))
        .to.emit(treeCuttingReport, "TreeCutReported")
        .withArgs(1, "Deforestation");
    });

    it("should overwrite existing report for same token", async function () {
      await treeCuttingReport.reportCutting(1, "First report");
      await treeCuttingReport.reportCutting(1, "Second report");
      const report = await treeCuttingReport.reports(1);
      expect(report.reason).to.equal("Second report");
    });

    it("should revert if caller lacks REPORTER_ROLE", async function () {
      await expect(
        treeCuttingReport.connect(other).reportCutting(1, "test")
      ).to.be.reverted;
    });

    it("should allow granting REPORTER_ROLE", async function () {
      const REPORTER_ROLE = await treeCuttingReport.REPORTER_ROLE();
      await treeCuttingReport.grantRole(REPORTER_ROLE, reporter.address);
      await treeCuttingReport.connect(reporter).reportCutting(1, "Report from granted reporter");
      const report = await treeCuttingReport.reports(1);
      expect(report.reporter).to.equal(reporter.address);
    });
  });
});

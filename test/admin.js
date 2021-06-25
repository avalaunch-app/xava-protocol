const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Admin", function() {

  let Admin;
  let deployer, alice, bob;
  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
  });

  context("Setup", async function() {
    it("Should setup the admin contract correctly", async function() {
      let admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(3);

      expect(await Admin.isAdmin(deployer.address)).to.be.true;
      expect(await Admin.isAdmin(alice.address)).to.be.true;
      expect(await Admin.isAdmin(bob.address)).to.be.true;
      expect(await Admin.isAdmin(ZERO_ADDRESS)).to.be.false;
    });

    it("Should allow removal a middle admin using an admin address", async function() {
      let admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(3);

      await Admin.removeAdmin(admins[1]);

      admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(2);

      expect(await Admin.isAdmin(deployer.address)).to.be.true;
      expect(await Admin.isAdmin(alice.address)).to.be.false;
      expect(await Admin.isAdmin(bob.address)).to.be.true;
      expect(await Admin.isAdmin(ZERO_ADDRESS)).to.be.false;
    });

    it("Should not allow a non-admin to removal an admin", async function() {
      await Admin.removeAdmin(deployer.address);
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(alice.address)).to.be.true;

      await expect(Admin.removeAdmin(alice.address)).to.be.revertedWith("revert not admin");
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(alice.address)).to.be.true;
    });

  });

});

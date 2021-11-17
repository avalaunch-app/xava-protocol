const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Admin", function() {

  let Admin;
  let deployer, alice, bob, cedric;
  let ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function() {
    const accounts = await ethers.getSigners();
    deployer = accounts[0];
    alice = accounts[1];
    bob = accounts[2];
    cedric = accounts[3];

    const AdminFactory = await ethers.getContractFactory("Admin");
    Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
  });

  context("Setup", async function() {
    it("Should setup the admin contract correctly", async function() {
      // Given
      let admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(3);

      // Then
      expect(await Admin.isAdmin(deployer.address)).to.be.true;
      expect(await Admin.isAdmin(alice.address)).to.be.true;
      expect(await Admin.isAdmin(bob.address)).to.be.true;
      expect(await Admin.isAdmin(ZERO_ADDRESS)).to.be.false;
    });
  });

  context("Remove admins", async function() {
    it("Should allow removal a middle admin using an admin address", async function() {
      // Given
      let admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(3);

      // When
      await Admin.removeAdmin(admins[1]);

      // Then
      admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(2);

      expect(await Admin.isAdmin(deployer.address)).to.be.true;
      expect(await Admin.isAdmin(alice.address)).to.be.false;
      expect(await Admin.isAdmin(bob.address)).to.be.true;
      expect(await Admin.isAdmin(ZERO_ADDRESS)).to.be.false;
    });

    it("Should not allow a non-admin to removal an admin", async function() {
      // Given
      expect(await Admin.isAdmin(deployer.address)).to.be.true;

      await Admin.removeAdmin(deployer.address);
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(alice.address)).to.be.true;

      // Then
      await expect(Admin.removeAdmin(alice.address)).to.be.revertedWith('Only admin can call.');
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(alice.address)).to.be.true;
    });

    it("Should not allow removing an admin twice", async function() {
      // Given
      expect(await Admin.isAdmin(alice.address)).to.be.true;
      await Admin.removeAdmin(alice.address);
      expect(await Admin.isAdmin(alice.address)).to.be.false;

      // Then
      await expect(Admin.removeAdmin(alice.address  )).to.be.reverted;
    });
  });

  context("Add admins", async function() {
    it("Should allow adding an admin", async function() {
      // Given
      let admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(3);
      expect(await Admin.isAdmin(cedric.address)).to.be.false;

      // When
      await Admin.addAdmin(cedric.address);

      // Then
      admins = await Admin.getAllAdmins();
      expect(admins.length).to.eq(4);
      expect(await Admin.isAdmin(cedric.address)).to.be.true;
    });

    it("Should not allow a non-admin to add an admin", async function() {
      // Given
      expect(await Admin.isAdmin(deployer.address)).to.be.true;

      await Admin.removeAdmin(deployer.address);
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(cedric.address)).to.be.false;

      // Then
      await expect(Admin.addAdmin(cedric.address)).to.be.revertedWith('Only admin can call.');
      expect(await Admin.isAdmin(deployer.address)).to.be.false;
      expect(await Admin.isAdmin(cedric.address)).to.be.false;
    });

    it("Should not allow adding the zero address as an admin", async function() {
      // Given
      expect(await Admin.isAdmin(ZERO_ADDRESS)).to.be.false;

      // Then
      await expect(Admin.addAdmin(ZERO_ADDRESS)).to.be.revertedWith("[RBAC] : Admin must be != than 0x0 address");
    });

    it("Should not allow adding an admin twice", async function() {
      // Given
      expect(await Admin.isAdmin(cedric.address)).to.be.false;
      await Admin.addAdmin(cedric.address);
      expect(await Admin.isAdmin(cedric.address)).to.be.true;

      // Then
      await expect(Admin.addAdmin(cedric.address)).to.be.revertedWith("[RBAC] : Admin already exists.");
    });
  });
});

const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Badge Factory", () => {

    let Admin;
    let deployer, alice, bob, charlie;
    let badgeFactory;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const CONTRACT_URI = "https://api.avalaunch.app/badge_nfts/metadata"
    const URI = "https://api.avalaunch.app/badge_nfts/metadata?id={id}"
    const NEW_URI = "https://api.avalaunch.io/new_badge_nfts/metadata?id={id}"

    const BADGE_IDS = [1, 2, 3];
    const BADGE_MULTIPLIERS = [15, 30, 70];
    const BADGE_TRADEABILITIES = [true, false, true];

    describe("Main Functions", () => {

        beforeEach(async () => {
            const accounts = await ethers.getSigners();
            deployer = accounts[0];
            alice = accounts[1];
            bob = accounts[2];
            charlie = accounts[3];

            const AdminFactory = await ethers.getContractFactory("Admin");
            Admin = await AdminFactory.deploy([deployer.address, alice.address, bob.address]);
            await Admin.deployed();

            const factory = await ethers.getContractFactory("AvalaunchBadgeFactory");
            badgeFactory = await factory.deploy();
            await badgeFactory.deployed();

            await badgeFactory.initialize(Admin.address, URI, CONTRACT_URI);
        });

        describe("Pausing", () => {
            it("Should pause", async () => {
                await badgeFactory.pause();
                expect(await badgeFactory.paused()).to.equal(true);
            });

            it("Should unpause", async () => {
                await badgeFactory.pause();
                expect(await badgeFactory.paused()).to.equal(true);
                await badgeFactory.unpause();
                expect(await badgeFactory.paused()).to.equal(false);
            });
        });

        describe("Setters", () => {
            it("Should set new uri", async () => {
               await badgeFactory.setNewUri(NEW_URI);
               expect(await badgeFactory.uri(0)).to.equal(NEW_URI);
            });

            it("Should set new contract uri", async () => {
                await badgeFactory.setNewContractUri(NEW_URI);
                expect(await badgeFactory.getContractURI()).to.equal(NEW_URI);
            });
        });

        describe("Badge Actions", () => {
            describe("Creation", () => {
                it("Should create badges", async () => {
                    await expect(badgeFactory.createBadges(
                        BADGE_IDS,
                        BADGE_MULTIPLIERS,
                        BADGE_TRADEABILITIES
                    )).to.emit(badgeFactory, "BadgeCreated");

                    expect(await badgeFactory.getLastCreatedBadgeId()).to.equal(3);
                    expect(await badgeFactory.getBadgeMultiplier(BADGE_IDS[0])).to.equal(BADGE_MULTIPLIERS[0]);
                    expect(await badgeFactory.getBadgeMultiplier(BADGE_IDS[1])).to.equal(BADGE_MULTIPLIERS[1]);
                    expect(await badgeFactory.getBadgeMultiplier(BADGE_IDS[2])).to.equal(BADGE_MULTIPLIERS[2]);
                });
            });

            describe("Minting", () => {
                beforeEach(async () => {
                    await badgeFactory.createBadges(
                        BADGE_IDS,
                        BADGE_MULTIPLIERS,
                        BADGE_TRADEABILITIES
                    );
                });

                it("Should mint badges", async () => {
                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[0])).to.equal(0);
                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[1])).to.equal(0);
                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[2])).to.equal(0);

                    await badgeFactory.mintBadges(
                        BADGE_IDS,
                        [alice.address, bob.address, charlie.address]
                    );

                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[0])).to.equal(1);
                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[1])).to.equal(1);
                    expect(await badgeFactory.getBadgeSupply(BADGE_IDS[2])).to.equal(1);
                });
            });

            describe("Transfer", () => {
               beforeEach(async () => {
                   await badgeFactory.createBadges(
                       BADGE_IDS,
                       BADGE_MULTIPLIERS,
                       BADGE_TRADEABILITIES
                   );

                   await badgeFactory.mintBadges(
                       BADGE_IDS,
                       [alice.address, bob.address, charlie.address]
                   );
               });

               it("Should transfer a tradeable badge", async () => {
                   expect(await badgeFactory.balanceOf(bob.address, BADGE_IDS[0])).to.equal(0);
                   expect(await badgeFactory.balanceOf(alice.address, BADGE_IDS[0])).to.equal(1);
                   await badgeFactory.connect(alice).setApprovalForAll(bob.address, true);
                   await badgeFactory.connect(bob).safeTransferFrom(
                       alice.address,
                       bob.address,
                       BADGE_IDS[0],
                       1,
                       "0x"
                   );
                   expect(await badgeFactory.balanceOf(bob.address, BADGE_IDS[0])).to.equal(1);
                   expect(await badgeFactory.balanceOf(alice.address, BADGE_IDS[0])).to.equal(0);
               });

               it("Should not transfer a non-tradeable badge", async () => {
                   expect(await badgeFactory.balanceOf(bob.address, BADGE_IDS[1])).to.equal(1);
                   expect(await badgeFactory.balanceOf(alice.address, BADGE_IDS[1])).to.equal(0);
                   await badgeFactory.connect(bob).setApprovalForAll(alice.address, true);
                   await expect(badgeFactory.connect(alice).safeTransferFrom(
                       bob.address,
                       alice.address,
                       BADGE_IDS[1],
                       1,
                       "0x"
                   )).to.be.revertedWith("Badge not tradeable.");
               });

               it("Should not transfer a badge when paused", async () => {
                   await badgeFactory.pause();
                   expect(await badgeFactory.paused()).to.equal(true);

                   expect(await badgeFactory.balanceOf(bob.address, BADGE_IDS[0])).to.equal(0);
                   expect(await badgeFactory.balanceOf(alice.address, BADGE_IDS[0])).to.equal(1);

                   await badgeFactory.connect(alice).setApprovalForAll(bob.address, true);
                   await expect(badgeFactory.connect(bob).safeTransferFrom(
                       alice.address,
                       bob.address,
                       BADGE_IDS[0],
                       1,
                       "0x"
                   )).to.be.revertedWith("ERC1155Pausable: token transfer while paused");
               });
            });
        });
    });
});

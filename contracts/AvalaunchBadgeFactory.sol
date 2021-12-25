//"SPDX-License-Identifier: UNLICENSED"
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155PausableUpgradeable.sol";
import "./interfaces/IAdmin.sol";

contract AvalaunchBadgeFactory is ERC1155PausableUpgradeable {

	// Admin contract
	IAdmin public admin;

	// Contract level uri
	string private contractURI;
	// Store id of latest badge created
	uint256 public lastCreatedBadgeId;
	// Mapping badge id to tradeability
	mapping (uint256 => bool) private badgeIdToTradeability;
	// Mapping badge id to multiplier
	mapping (uint256 => uint8) private badgeIdToMultiplier;
	// Mapping badge id to minted supply
	mapping (uint256 => uint256) private badgeIdToMintedSupply;

	// Events
	event BadgeCreated(
		uint256 badgeId,
		uint8 multiplier,
		bool tradeability
	);

	event BadgeMint(
		uint256 badgeId,
		address receiver
	);

	// Restricting calls only to sale admin
	modifier onlyAdmin() {
		require(
			admin.isAdmin(msg.sender),
			"Only admin can call this function."
		);
		_;
	}

	function initialize(
		address _admin,
		string memory _uri,
		string memory _contractURI
	)
	public
	initializer
	{
		__ERC1155_init(_uri);

		require(_admin != address(0), "Admin cannot be zero address.");
		admin = IAdmin(_admin);

		contractURI = _contractURI;
	}

	/// @notice 	Function to pause the nft transfer related ops
	function pause()
	public
	onlyAdmin
	{
		_pause();
	}

	/// @notice 	Function to unpause the nft transfer related ops
	function unpause()
	public
	onlyAdmin
	{
		_unpause();
	}

	/// @notice 	Uri setter
	function setNewUri(
		string memory _newUri
	)
	public
	onlyAdmin
	{
		_setURI(_newUri);
	}

	/// @notice 	Contract level uri setter
	function setNewContractUri(
		string memory _contractURI
	)
	public
	onlyAdmin
	{
		contractURI = _contractURI;
	}

	/// @notice 	Function to create badges
	/// @dev		Necessary for minting
	function createBadges(
		uint256[] memory badgeIds,
		uint8[] memory multipliers,
		bool[] memory tradeability,
		uint256 startIndex,
		uint256 endIndex
	)
	external
	onlyAdmin
	{
		// Validate input
		require(badgeIds.length == tradeability.length, "Array size mismatch.");
		require(startIndex <= endIndex, "Invalid index range.");

		// Create badges
		for(uint256 i = startIndex; i < endIndex; i++) {
			// Require that new badge has proper id
			require(badgeIds[i] == lastCreatedBadgeId.add(1), "Invalid badge id.");

			// Set badge params
			badgeIdToTradeability[badgeIds[i]] = tradeability[i];
			badgeIdToMultiplier[badgeIds[i]] = multipliers[i];
			lastCreatedBadgeId = badgeIds[i];

			emit BadgeCreated(badgeIds[i], multipliers[i], tradeability[i]);
		}
	}

	/// @notice 	Function to mint badges to users
	function mintBadges(
		uint256[] calldata badgeIds,
		address[] calldata receivers
	)
	external
	onlyAdmin
	{
		// Require that array lengths match
		require(badgeIds.length == receivers.length, "Array length mismatch.");

		for(uint i = 0; i < badgeIds.length; i++) {
			// Require that badge has been created
			require(badgeIds[i] <= lastCreatedBadgeId, "Badge must be created before mitning.");

			// Mint badge NFT to user
			_mint(receivers[i], badgeIds[i], 1, "0x0");
			emit BadgeMint(badgeIds[i], receivers[i]);

			// Increase total minted supply
			badgeIdToMintedSupply[badgeIds[i]] = badgeIdToMintedSupply[badgeIds[i]].add(1);
		}
	}

	/// @notice 	Contract level uri getter
	function getContractURI()
	public
	view
	returns
	(string memory)
	{
		return contractURI;
	}

	/// @notice 	Badge total supply getter
	function getBadgeSupply(
		uint badgeId
	)
	external
	view
	returns (uint256)
	{
		return badgeIdToMintedSupply[badgeId];
	}

	/// @notice 	Badge multiplier getter
	function getBadgeMultiplier(
		uint badgeId
	)
	external
	view
	returns (uint256)
	{
		return badgeIdToMultiplier[badgeId];
	}

	function _beforeTokenTransfer(
		address operator,
		address from,
		address to,
		uint256[] memory ids,
		uint256[] memory amounts,
		bytes memory data
	)
	internal
	override
	{
		super._beforeTokenTransfer(operator, from, to, ids, amounts, data);

		// Require that badges are tradeable prior to transfer
		if(from != address(0)) {
			for(uint i = 0; i < ids.length; i++) {
				require(badgeIdToTradeability[ids[i]], "Badge not tradeable.");
			}
		}
	}
}

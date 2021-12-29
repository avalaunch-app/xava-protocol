pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "../interfaces/IAdmin.sol";
import "../math/SafeMath.sol";

contract AirdropSale {

	using ECDSA for bytes32;
	using SafeMath for *;

	IAdmin public admin;
	address[] public airdropTokens;
	mapping(address => uint256) public tokenToTotalWithdrawn;

	mapping (address => bool) public wasClaimed;

	event TokensAirdropped(address beneficiary, address token, uint256 amount);
	event SentAVAX(address beneficiary, uint256 amount);

	// Constructor, initial setup
	constructor(address[] memory _airdropTokens, address _admin) public {
		require(_admin != address(0));
		admin = IAdmin(_admin);

		for(uint i = 0; i < _airdropTokens.length; i++) {
			require(_airdropTokens[i] != address(0));
			airdropTokens.push(_airdropTokens[i]);
		}
	}

	// Function to withdraw tokens.
	function withdrawTokens(bytes memory signature, uint256[] memory amounts) public {
		// Allow only direct call
		require(msg.sender == tx.origin, "Require that message sender is tx-origin.");
		// Require that array sizes are matching
		require(airdropTokens.length == amounts.length, "Array size mismatch.");

		// Get beneficiary address
		address beneficiary = msg.sender;
		// Use first token amount for generating signature
		uint256 amountAVAX = amounts[0];

		// Validate signature
		require(checkSignature(signature, beneficiary, amountAVAX), "Not eligible to claim tokens!");
		// Require that user didn't claim already
		require(!wasClaimed[beneficiary], "Already claimed!");
		// Mark that user claimed
		wasClaimed[msg.sender] = true;

		// Go through all of the airdrop tokens
		for(uint i = 1; i < amounts.length; i++) {
			if(amounts[i] > 0) {
				// Perform transfer
				bool status = IERC20(airdropTokens[i.sub(1)]).transfer(beneficiary, amounts[i]);
				// Require that transfer was successful
				require(status, "Token transfer status is false.");
				// Increase token's withdrawn amount
				tokenToTotalWithdrawn[airdropTokens[i.sub(1)]] = tokenToTotalWithdrawn[airdropTokens[i.sub(1)]].add(amounts[i]);
				// Trigger event that token is sent
				emit TokensAirdropped(beneficiary,airdropTokens[i.sub(1)], amounts[i]);
			}
		}

		// Transfer AVAX to user
		safeTransferAVAX(beneficiary, amountAVAX);
		// Trigger event that AVAX is sent.
		emit SentAVAX(beneficiary, amountAVAX);
	}

	// Get who signed the message based on the params
	function getSigner(bytes memory signature, address beneficiary, uint256 amount) public view returns (address) {
		bytes32 hash = keccak256(abi.encodePacked(beneficiary, amount, address(this)));
		bytes32 messageHash = hash.toEthSignedMessageHash();
		return messageHash.recover(signature);
	}

	// Check that signature is valid, and is signed by Admin wallets
	function checkSignature(bytes memory signature, address beneficiary, uint256 amount) public view returns (bool) {
		return admin.isAdmin(getSigner(signature, beneficiary, amount));
	}

	// Safe transfer AVAX to users
	function safeTransferAVAX(address to, uint256 value) internal {
		// Safely transfer AVAX to address
		(bool success, ) = to.call{value: value}(new bytes(0));
		// Require that transfer was successful.
		require(success, "AVAX transfer failed.");
	}

	receive() external payable {}
}

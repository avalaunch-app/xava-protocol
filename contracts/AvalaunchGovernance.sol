//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AvalaunchGovernance is AccessControl {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // enumerable set containing roles
    EnumerableSet.Bytes32Set private __roles;

    // admin roles
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant SALE_ADMIN_ROLE = keccak256('SALE_ADMIN');
    bytes32 public constant STAKE_ADMIN_ROLE = keccak256('STAKE_ADMIN');

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, _msgSender()), "Only admin can setup roles.");
        _;
    }

    constructor(
        address _leadAdmin,
        address _saleAdmin,
        address _stakeAdmin
    ) public {
        // setup initial roles
        __roles.add(ADMIN_ROLE);
        _setupRole(ADMIN_ROLE, _leadAdmin);

        __roles.add(SALE_ADMIN_ROLE);
        _setupRole(SALE_ADMIN_ROLE, _saleAdmin);

        __roles.add(STAKE_ADMIN_ROLE);
        _setupRole(STAKE_ADMIN_ROLE, _stakeAdmin);
    }

    // role granting function with existance check
    function grantRole(bytes32 role, address account) public override onlyAdmin {
        require(__roles.contains(role), "Role does not exist.");
        super.grantRole(role, account);
    }

    // setup a new role with an initial account
    function setupRole(bytes32 role, address account) external onlyAdmin {
        require(!__roles.contains(role), "Role already exists.");
        _setupRole(role, account);
        __roles.add(role);
    }

    // remove already existing role
    function removeRole(bytes32 role) external onlyAdmin {
        require(__roles.contains(role), "Role does not exist.");
        __roles.remove(role);
    }

    // structure wide role check for permission granting
    function hasExistingRole(string memory role, address account) external view returns (bool){
        bytes32 _role;

        assembly {
            _role := mload(add(role, 32))
        }

        require(__roles.contains(_role), "Role does not exist.");
        return hasRole(_role, account);
    }

    // retrieve all administrative roles
    function retrieveRoles() external view returns (bytes32 [] memory) {
        uint256 len = __roles.length();
        bytes32 [] memory __rolesArr = new bytes32[](len);

        for(uint256 i = 0; i < len; i++) {
            __rolesArr[i] = __roles.at(i);
        }

        return __rolesArr;
    }
}

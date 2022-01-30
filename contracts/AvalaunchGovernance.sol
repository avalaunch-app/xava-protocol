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

    // setup a new role with an initial account
    function setupRole(bytes32 role, address account) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Only admin can setup roles.");
        require(!__roles.contains(role), "Role already exists.");
        _setupRole(role, account);
        __roles.add(role);
    }

    // view if '_address' is 'SALE_ADMIN_ROLE' member
    function hasAdminRole(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // view if '_address' is 'SALE_ADMIN_ROLE' member
    function hasSaleAdminRole(address account) external view returns (bool) {
        return hasRole(SALE_ADMIN_ROLE, account);
    }

    // view if '_address' is 'STAKE_ADMIN_ROLE' member
    function hasStakeAdminRole(address account) external view returns (bool) {
        return hasRole(STAKE_ADMIN_ROLE, account);
    }

    // view if '_address' is a member of any relevant role
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account) || hasRole(SALE_ADMIN_ROLE, account) || hasRole(STAKE_ADMIN_ROLE, account);
    }

    // retrieve all administrative roles
    function retrieveRoles() external view returns (bytes32 [] memory) {
        uint256 len = __roles.length();
        bytes32 [] memory __rolesArr = new bytes32[](len);

        for(uint256 i = 0; i < __roles.length(); i++) {
            __rolesArr[i] = __roles.at(i);
        }

        return __rolesArr;
    }
}

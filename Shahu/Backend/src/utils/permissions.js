const canManageUsers = user => ['admin', 'staff'].includes(user?.role?.name || user?.role);

module.exports = { canManageUsers };

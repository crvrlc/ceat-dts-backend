const prisma = require('../config/prisma');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      select: {
        id: true,
        name: true,
        email: true,
        photo: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin/Staff)
exports.getUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        name: true,
        email: true,
        photo: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user role and position
// @route   PATCH /api/users/:id/role
// @access  Private (Admin only)
exports.updateUserRole = async (req, res) => {
  try {
    const { role, position } = req.body;

    if (!['student', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent removing the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot remove the last admin. Assign another admin first.'
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: {
        role,
        position: role === 'student' ? null : (position || null)
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true
      }
    });

    res.status(200).json({ success: true, message: 'User updated successfully', user: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle user active status
// @route   PATCH /api/users/:id/status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: !user.isActive }
    });

    res.status(200).json({
      success: true,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      user: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin' });
      }
    }

    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });

    // Sync whitelist state if staff/admin
    if (user.role === 'staff' || user.role === 'admin') {
      await prisma.staffRegistration.updateMany({
        where: { email: user.email },
        data: { isUsed: false, usedAt: null }
      });
    } else if (user.role === 'student') {
      await prisma.studentRegistration.updateMany({
        where: { email: user.email },
        data: { isUsed: false, usedAt: null }
      });
    }

    res.status(200).json({ success: true, message: 'User deleted and registration state synced' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        message: 'Cannot delete this staff member because they have existing assignments. Please remove their assignments first.' 
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private (Staff/Admin)
exports.getUsersByRole = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: req.params.role,  isActive: true },
      select: { id: true, name: true, email: true, position: true },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get staff and admin users
// @route   GET /api/users/staff-and-admin
// @access  Private (Admin only)
exports.getStaffAndAdmin = async (req, res) => {
  try {
    const { showAll } = req.query;
    
    const users = await prisma.user.findMany({
      where: { 
        role: { in: ['staff', 'admin'] },
        // Only filter by isActive if showAll is not true
        ...(showAll !== 'true' && { isActive: true })
      },
      select: {
        id: true,
        name: true,
        email: true,
        photo: true,
        role: true,
        position: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('getStaffAndAdmin error:', error.message);
    res.status(500).json({ message: error.message });
  }
};
const express = require('express');
const {
  getAllUsers,
  getUser,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getUsersByRole,
  getStaffAndAdmin
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Staff/Admin accessible
router.get('/role/:role', authorize('staff', 'admin'), getUsersByRole);
router.get('/staff-and-admin', authorize('staff', 'admin'), getStaffAndAdmin);

// Admin only
router.get('/', authorize('admin'), getAllUsers);
router.get('/:id', authorize('admin'), getUser);
router.patch('/:id/role', authorize('admin'), updateUserRole);
router.patch('/:id/status', authorize('admin'), toggleUserStatus);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
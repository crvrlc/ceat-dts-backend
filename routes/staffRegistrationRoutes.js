const express = require('express');
const {
  registerStaffEmail,
  getStaffRegistrations,
  deleteStaffRegistration
} = require('../controllers/staffRegistrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require admin
router.use(protect);
router.use(authorize('admin'));

router.post('/', registerStaffEmail);
router.get('/', getStaffRegistrations);
router.delete('/:id', deleteStaffRegistration);

module.exports = router;
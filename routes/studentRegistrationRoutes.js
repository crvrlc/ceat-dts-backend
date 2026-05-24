const express = require('express');
const {
  getStudentRegistrations,
  addStudentRegistration,
  bulkAddStudentRegistrations,
  deleteStudentRegistration
} = require('../controllers/studentRegistrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require login and staff/admin role
router.use(protect);
router.use(authorize('staff', 'admin'));

router.get('/', getStudentRegistrations);
router.post('/', addStudentRegistration);
router.post('/bulk', bulkAddStudentRegistrations);
router.delete('/:id', deleteStudentRegistration);

module.exports = router;
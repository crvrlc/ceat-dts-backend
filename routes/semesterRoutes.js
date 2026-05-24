const express = require('express');
const {
  createSemester,
  getSemesters,
  getCurrentSemester,
  getSemester,
  updateSemester,
  deleteSemester,
  setCurrentSemester
} = require('../controllers/semesterController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/current', getCurrentSemester);
router.get('/', getSemesters);
router.get('/:id', getSemester);

// Admin only
router.post('/', authorize('admin'), createSemester);
router.put('/:id', authorize('admin'), updateSemester);
router.patch('/:id/set-current', authorize('admin'), setCurrentSemester);
router.delete('/:id', authorize('admin'), deleteSemester);

module.exports = router;
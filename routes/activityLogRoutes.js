const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('staff', 'admin'), getActivityLogs);

module.exports = router;
const express = require('express');
const {
  getOverview,
  getDocumentsPerMonth,
  getDocumentTypeStats,
  getStatusDistribution,
  getTopDocumentTypes,
  getProcessingTimes,
  getStaffPerformance,
  getMonthlyTrend,
  getSubmissionMethods,
  getReleaseMethods,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require staff or admin
router.use(protect);
router.use(authorize('staff', 'admin'));

// ── Core reports (used by frontend) ─────────────────────────────────────────
router.get('/overview',            getOverview);
router.get('/monthly-trend',       getMonthlyTrend);       // NEW: submitted vs completed per month
router.get('/document-types',      getDocumentTypeStats);
router.get('/staff-performance',   getStaffPerformance);
router.get('/submission-methods',  getSubmissionMethods);  // NEW: Online vs In-Person submissions
router.get('/release-methods',     getReleaseMethods);     // NEW: Online vs In-Person releases

// ── Kept for backwards compatibility ────────────────────────────────────────
router.get('/per-month',           getDocumentsPerMonth);
router.get('/status-distribution', getStatusDistribution);
router.get('/top-document-types',  getTopDocumentTypes);
router.get('/processing-times',    getProcessingTimes);

module.exports = router;
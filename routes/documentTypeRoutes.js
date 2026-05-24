const express = require('express');
const {
  createDocumentType,
  getDocumentTypes,
  getDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getDocumentTypeStaff,
  setDocumentTypeStaff,
  removeDocumentTypeStaff
} = require('../controllers/documentTypeController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getDocumentTypes);
router.get('/:id', getDocumentType);

// Admin only
router.post('/', authorize('admin'), createDocumentType);
router.put('/:id', authorize('admin'), updateDocumentType);
router.delete('/:id', authorize('admin'), deleteDocumentType);

// Default staff assignment per document type
router.get('/:id/staff', authorize('admin'), getDocumentTypeStaff);
router.post('/:id/staff', authorize('admin'), setDocumentTypeStaff);
router.delete('/:id/staff/:staffId', authorize('admin'), removeDocumentTypeStaff);

module.exports = router;
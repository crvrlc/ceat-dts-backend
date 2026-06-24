const express = require('express');
const {
  submitDocument,
  getDocuments,
  getDocument,
  getDocumentStats,
  trackDocument,
  assignDocument,
  updateDocumentStatus,
  receiveDocument,
  deleteDocument,
  submitRevision
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const prisma = require('../config/prisma');

const router = express.Router();

// Public route - track document
router.get('/track/:trackingCode', trackDocument);

// Student routes
router.post('/', protect, authorize('student'), upload.single('file'), submitDocument);
router.get('/stats', protect, authorize('student'), getDocumentStats);
router.patch('/:id/revise', protect, authorize('student'), upload.single('file'), submitRevision);

// All authenticated users
router.get('/', protect, getDocuments);
router.get('/:id', protect, getDocument);

// Staff/Admin routes
router.patch('/:id/assign', protect, authorize('staff', 'admin'), assignDocument);
router.patch('/:id/status', protect, authorize('staff', 'admin'), upload.single('file'), updateDocumentStatus);
router.patch('/:id/receive', protect, authorize('staff', 'admin'), receiveDocument);


// Email notification
router.post('/:id/notify', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const { sendDocumentUpdateEmail } = require('../services/emailService');
    const { status, remark } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        student: { select: { name: true, email: true } },
        documentType: { select: { name: true, code: true } }
      }
    });

    if (!document) return res.status(404).json({ message: 'Document not found' });
    if (!document.student?.email) return res.status(400).json({ message: 'Student email not found' });

    await sendDocumentUpdateEmail({
      studentName: document.student.name,
      studentEmail: document.student.email,
      trackingCode: document.trackingCode,
      status: status || document.status,
      releaseMethod: document.releaseMethod,
      remark: remark || ''
    });

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});

// Delete - students can delete their own if Submitted, admin can delete any
router.delete('/:id', protect, deleteDocument);

module.exports = router;
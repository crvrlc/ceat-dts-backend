const prisma = require('../config/prisma');
const { cloudinary } = require('../config/cloudinary');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const generateTrackingCode = async (semesterId, documentTypeId) => {
  const [semester, documentType] = await Promise.all([
    prisma.semester.findUnique({ where: { id: semesterId } }),
    prisma.documentType.findUnique({ where: { id: documentTypeId } })
  ]);

  if (!semester || !documentType) throw new Error('Invalid semester or document type');

  const sequence = await prisma.documentTypeSequence.upsert({
    where: { semesterId_documentTypeId: { semesterId, documentTypeId } },
    update: { lastSequence: { increment: 1 } },
    create: { semesterId, documentTypeId, lastSequence: 1 }
  });

  const number = String(sequence.lastSequence).padStart(3, '0');
  return `${semester.code}-${documentType.code}-${number}`;
};

const getDefaultStaff = async (documentTypeId) => {
  const assignment = await prisma.documentTypeStaffAssignment.findFirst({
    where: { documentTypeId, staff: { isActive: true } }
  });
  return assignment?.staffId || null;
};

const logActivity = async (documentId, performedById, action, fromStatus = null, toStatus = null, remarks = null) => {
  await prisma.activityLog.create({
    data: { documentId, performedById, action, fromStatus, toStatus, remarks }
  });
};

// ─────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────

exports.submitDocument = async (req, res) => {
  try {
    const { documentTypeId, submissionMethod, releaseMethod, notes, originalFileName } = req.body;
    const docTypeId = parseInt(documentTypeId);

    if (submissionMethod === 'online' && !req.file) {
      return res.status(400).json({ message: 'Please upload a file for online submission' });
    }

    const documentType = await prisma.documentType.findUnique({ where: { id: docTypeId } });
    if (!documentType) return res.status(404).json({ message: 'Document type not found' });
    if (!documentType.isActive) return res.status(400).json({ message: 'This document type is not currently available' });

    const semester = await prisma.semester.findFirst({ where: { isCurrent: true } });
    if (!semester) return res.status(400).json({ message: 'No active semester found. Please contact the administrator.' });

    const trackingCode = await generateTrackingCode(semester.id, docTypeId);

    const assignedStaffId = submissionMethod === 'online'
      ? await getDefaultStaff(docTypeId)
      : null;

    const studentFileUrl = req.file ? req.file.path : null;

    const document = await prisma.document.create({
      data: {
        trackingCode,
        semesterId: semester.id,
        documentTypeId: docTypeId,
        studentId: req.user.id,
        assignedStaffId,
        submissionMethod,
        releaseMethod,
        notes: notes || null,
        studentFileUrl,
        originalFileName: originalFileName || null,
      },
      include: {
        documentType: { select: { name: true, code: true } },
        semester: { select: { name: true, code: true, schoolYear: true } },
        student: { select: { name: true, email: true } },
        assignedStaff: { select: { name: true, email: true } }
      }
    });

    await logActivity(
      document.id,
      req.user.id,
      submissionMethod === 'online' ? 'Document submitted online' : 'Document submitted — awaiting physical drop-off',
      null,
      'submitted'
    );

    res.status(201).json({
      success: true,
      message: 'Document submitted successfully',
      trackingCode: document.trackingCode,
      document
    });
  } catch (error) {
    console.error('submitDocument error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const {
      status, documentTypeId, submissionMethod, releaseMethod,
      trackingCode, assignedOnly, assignedStaff, semesterId,
      page = 1, limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...(req.user.role === 'student' && { studentId: req.user.id }),
      ...((req.user.role === 'staff' || req.user.role === 'admin') && assignedOnly === 'true' && { assignedStaffId: req.user.id }),
      ...(status && { status }),
      ...(documentTypeId && { documentTypeId: parseInt(documentTypeId) }),
      ...(submissionMethod && { submissionMethod }),
      ...(releaseMethod && { releaseMethod }),
      ...(semesterId && { semesterId: parseInt(semesterId) }),
      ...(trackingCode && { trackingCode: { contains: trackingCode, mode: 'insensitive' } }),
      ...(assignedStaff === 'unassigned' && { assignedStaffId: null }),
      ...(assignedStaff && assignedStaff !== 'unassigned' && assignedStaff !== '' && {
        assignedStaffId: parseInt(assignedStaff)
      })
    };

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          student: { select: { name: true, email: true, photo: true } },
          documentType: {
            select: {
              name: true,
              code: true,
              staffAssignments: {
                include: { staff: { select: { id: true, name: true } } }
              }
            }
          },
          semester: { select: { name: true, code: true, schoolYear: true } },
          assignedStaff: { select: { name: true, email: true } },
          activityLogs: {
            include: {
              performedBy: { select: { name: true, email: true, role: true } }
            },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.document.count({ where })
    ]);

    res.status(200).json({
      success: true,
      count: documents.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      documents
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDocument = async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        student: { select: { name: true, email: true, photo: true } },
        documentType: { select: { name: true, code: true } },
        semester: { select: { name: true, code: true, schoolYear: true } },
        assignedStaff: { select: { name: true, email: true, photo: true } },
        activityLogs: {
          include: {
            performedBy: { select: { name: true, email: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!document) return res.status(404).json({ message: 'Document not found' });

    const hasAccess =
      req.user.role === 'admin' ||
      req.user.role === 'staff' ||
      document.studentId === req.user.id;

    if (!hasAccess) return res.status(403).json({ message: 'Not authorized to view this document' });

    res.status(200).json({ success: true, document });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.trackDocument = async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { trackingCode: req.params.trackingCode.toUpperCase() },
      select: {
        trackingCode: true,
        status: true,
        submissionMethod: true,
        releaseMethod: true,
        createdAt: true,
        documentType: { select: { name: true, code: true } },
        semester: { select: { name: true, code: true, schoolYear: true } },
        activityLogs: {
          select: {
            action: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            performedBy: { select: { name: true, role: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!document) return res.status(404).json({ message: 'Document not found with this tracking code' });

    res.status(200).json({ success: true, document });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignDocument = async (req, res) => {
  try {
    const { staffId } = req.body;
    const docId = parseInt(req.params.id);

    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const newStaffId = staffId ? parseInt(staffId) : null;

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { assignedStaffId: newStaffId },
      include: { assignedStaff: { select: { name: true, email: true } } }
    });

    if (newStaffId) {
      const staff = await prisma.user.findUnique({ where: { id: newStaffId }, select: { name: true } });
      await logActivity(docId, req.user.id, `Assigned to ${staff?.name || 'staff'}`);
    } else {
      await logActivity(docId, req.user.id, 'Document unassigned');
    }

    res.status(200).json({
      success: true,
      message: newStaffId ? 'Document assigned successfully' : 'Document unassigned successfully',
      document: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDocumentStatus = async (req, res) => {
  try {
    const { status, remarks, notifyStudent, reassignToStaffId } = req.body;
    const docId = parseInt(req.params.id);

    const document = await prisma.document.findUnique({
      where: { id: docId },
      include: { student: { select: { email: true, name: true } } }
    });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const isUnassigning = (reassignToStaffId === '' || reassignToStaffId === 'unassign') && document.assignedStaffId !== null;

    if (req.user.role === 'staff' && document.assignedStaffId !== null && document.assignedStaffId !== req.user.id) {
      return res.status(403).json({ message: 'This document is assigned to another staff member.' });
    }

    const fromStatus = document.status;

    // Handle file upload — action_required uses actionRequiredFileUrl, others use scannedFileUrl
    const isActionRequired = status === 'action_required';
    const scannedFileUrl = !isActionRequired && req.file ? req.file.path : document.scannedFileUrl;
    const scannedFileName = !isActionRequired && req.file ? req.file.originalname : document.scannedFileName;
    const actionRequiredFileUrl = isActionRequired && req.file ? req.file.path : document.actionRequiredFileUrl;
    const actionRequiredFileName = isActionRequired && req.file ? req.file.originalname : document.actionRequiredFileName;

    const newStaffId = reassignToStaffId && reassignToStaffId !== 'unassign' && reassignToStaffId !== ''
      ? parseInt(reassignToStaffId)
      : isUnassigning ? null : document.assignedStaffId;

    const finalStatus = (status === 'completed' && document.releaseMethod === 'online')
      ? 'released'
      : status;

    const updated = await prisma.document.update({
      where: { id: docId },
      data: {
        status: finalStatus,
        remarks: remarks || document.remarks,
        scannedFileUrl,
        scannedFileName: scannedFileName || null,
        actionRequiredFileUrl,
        actionRequiredFileName: actionRequiredFileName || null,
        assignedStaffId: newStaffId,
        notifyStudent: notifyStudent === 'true' || notifyStudent === true
      },
      include: {
        student: { select: { name: true, email: true } },
        documentType: { select: { name: true, code: true } },
        assignedStaff: { select: { name: true, email: true } }
      }
    });

    const actionMessages = {
      submitted:        'Document submitted',
      received:         'Document received at office',
      processing:       'Document is being processed',
      action_required:  'Action required from student',
      for_signature:    'Document sent for signature',
      completed:        'Document processing completed',
      released:         'Document released to student',
      rejected:         'Document rejected',
    };

    const statusChanged = finalStatus !== fromStatus;
    const newReassignId = parseInt(reassignToStaffId);
    const assignmentChanged = (!isNaN(newReassignId) && newReassignId !== document.assignedStaffId) || isUnassigning;

    let actionText = '';

    if (statusChanged && assignmentChanged) {
      if (isUnassigning) {
        actionText = `${actionMessages[finalStatus]} · Document unassigned`;
      } else {
        const staff = await prisma.user.findUnique({ where: { id: newReassignId }, select: { name: true } });
        actionText = `${actionMessages[finalStatus]} · Assigned to ${staff?.name || 'staff'}`;
      }
    } else if (statusChanged) {
      actionText = actionMessages[finalStatus] || `Status updated to ${finalStatus}`;
    } else if (assignmentChanged) {
      if (isUnassigning) {
        actionText = 'Document unassigned';
      } else {
        const staff = await prisma.user.findUnique({ where: { id: newReassignId }, select: { name: true } });
        actionText = `Assigned to ${staff?.name || 'staff'}`;
      }
    }

    if (!actionText && req.file) {
      actionText = 'Document file updated';
    }

    await logActivity(docId, req.user.id, actionText, fromStatus, finalStatus, remarks || null);

    res.status(200).json({
      success: true,
      message: `Document status updated to ${finalStatus}`,
      document: updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.receiveDocument = async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const { remarks } = req.body;

    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.submissionMethod !== 'in_person') {
      return res.status(400).json({ message: 'Only in-person documents need to be marked as received' });
    }

    const assignedStaffId = await getDefaultStaff(document.documentTypeId);

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { status: 'received', assignedStaffId },
      include: {
        assignedStaff: { select: { name: true, email: true } },
        documentType: { select: { name: true, code: true } }
      }
    });

    await logActivity(
      docId,
      req.user.id,
      assignedStaffId
        ? `Physical document received · Assigned to ${updated.assignedStaff?.name || 'staff'}`
        : 'Physical document received at office',
      document.status,
      'received',
      remarks
    );

    res.status(200).json({ success: true, message: 'Document marked as received', document: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Student submits revised file in response to action_required
// @route   PATCH /api/documents/:id/revise
// @access  Private (Student)
exports.submitRevision = async (req, res) => {
  try {
    const docId = parseInt(req.params.id);

    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    if (document.studentId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (document.status !== 'action_required') {
      return res.status(400).json({ message: 'Document is not awaiting revision' });
    }

    const revisedFileUrl = req.file ? req.file.path : document.revisedFileUrl;
    const revisedFileName = req.file ? req.file.originalname : document.revisedFileName;

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { revisedFileUrl, revisedFileName }
    });

    await logActivity(
      docId,
      req.user.id,
      'Student submitted revised file',
      'action_required',
      'action_required'
    );

    res.status(200).json({ success: true, message: 'Revision submitted successfully', document: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const docId = parseInt(req.params.id);
    const document = await prisma.document.findUnique({ where: { id: docId } });
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const isOwner = document.studentId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const canDeleteAsStudent = isOwner && document.status === 'submitted';

    if (!isAdmin && !canDeleteAsStudent) {
      return res.status(403).json({
        message: 'You can only delete your own submissions that are still in Submitted status'
      });
    }

    const filesToDelete = [
      document.studentFileUrl,
      document.scannedFileUrl,
      document.actionRequiredFileUrl,
      document.revisedFileUrl
    ].filter(Boolean);

    for (const url of filesToDelete) {
      const parts = url.split('/');
      const publicId = `dts-documents/${parts[parts.length - 1].split('.')[0]}`;
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    await logActivity(
      docId,
      req.user.id,
      `Document deleted (${document.trackingCode})`,
      document.status,
      null
    );

    await prisma.document.delete({ where: { id: docId } });

    res.status(200).json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDocumentStats = async (req, res) => {
  try {
    const where = req.user.role === 'student' ? { studentId: req.user.id } : {};

    const [total, inProgress, completed, released, rejected] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.count({ where: { ...where, status: { in: ['submitted', 'received', 'processing', 'action_required', 'for_signature'] } } }),
      prisma.document.count({ where: { ...where, status: 'completed' } }),
      prisma.document.count({ where: { ...where, status: 'released' } }),
      prisma.document.count({ where: { ...where, status: 'rejected' } })
    ]);

    res.status(200).json({ success: true, total, inProgress, completed, released, rejected });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
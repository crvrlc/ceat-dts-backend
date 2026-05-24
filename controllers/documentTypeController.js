const prisma = require('../config/prisma');

// @desc    Create document type
// @route   POST /api/document-types
// @access  Private (Admin only)
exports.createDocumentType = async (req, res) => {
  try {
    const { name, code } = req.body;

    const documentType = await prisma.documentType.create({
      data: {
        name,
        code: code.toUpperCase()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Document type created successfully',
      documentType
    });
  } catch (error) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({
        message: `A document type with this ${error.meta?.target?.includes('code') ? 'code' : 'name'} already exists`
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all document types
// @route   GET /api/document-types
// @access  Private
exports.getDocumentTypes = async (req, res) => {
  try {
    const { isActive } = req.query;

    const documentTypes = await prisma.documentType.findMany({
      where: {
        ...(isActive !== undefined && { isActive: isActive === 'true' })
      },
      include: {
        staffAssignments: {
          include: {
            staff: { select: { id: true, name: true, position: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      success: true,
      count: documentTypes.length,
      documentTypes
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single document type
// @route   GET /api/document-types/:id
// @access  Private
exports.getDocumentType = async (req, res) => {
  try {
    const documentType = await prisma.documentType.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!documentType) {
      return res.status(404).json({ message: 'Document type not found' });
    }

    res.status(200).json({ success: true, documentType });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update document type
// @route   PUT /api/document-types/:id
// @access  Private (Admin only)
exports.updateDocumentType = async (req, res) => {
  try {
    const { name, code, isActive } = req.body;

    const existing = await prisma.documentType.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!existing) return res.status(404).json({ message: 'Document type not found' });

    const documentType = await prisma.documentType.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.status(200).json({
      success: true,
      message: 'Document type updated successfully',
      documentType
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        message: `A document type with this ${error.meta?.target?.includes('code') ? 'code' : 'name'} already exists`
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete document type
// @route   DELETE /api/document-types/:id
// @access  Private (Admin only)
exports.deleteDocumentType = async (req, res) => {
  try {
    const existing = await prisma.documentType.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!existing) return res.status(404).json({ message: 'Document type not found' });

    // Check if any documents use this type
    const documentsCount = await prisma.document.count({
      where: { documentTypeId: parseInt(req.params.id) }
    });

    if (documentsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete — ${documentsCount} document(s) are using this type. Deactivate it instead.`
      });
    }

    await prisma.documentType.delete({ where: { id: parseInt(req.params.id) } });

    res.status(200).json({ success: true, message: 'Document type deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get default staff for a document type
// @route   GET /api/document-types/:id/staff
// @access  Private (Admin only)
exports.getDocumentTypeStaff = async (req, res) => {
  try {
    const assignments = await prisma.documentTypeStaffAssignment.findMany({
      where: { documentTypeId: parseInt(req.params.id) },
      include: {
        staff: {
          select: { id: true, name: true, email: true, position: true }
        }
      }
    });

    res.status(200).json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set default staff for a document type
// @route   POST /api/document-types/:id/staff
// @access  Private (Admin only)
exports.setDocumentTypeStaff = async (req, res) => {
  try {
    const { staffId } = req.body;

    const assignment = await prisma.documentTypeStaffAssignment.upsert({
      where: {
        documentTypeId_staffId: {
          documentTypeId: parseInt(req.params.id),
          staffId: parseInt(staffId)
        }
      },
      update: {},
      create: {
        documentTypeId: parseInt(req.params.id),
        staffId: parseInt(staffId)
      }
    });

    res.status(200).json({
      success: true,
      message: 'Default staff assigned to document type',
      assignment
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove default staff from document type
// @route   DELETE /api/document-types/:id/staff/:staffId
// @access  Private (Admin only)
exports.removeDocumentTypeStaff = async (req, res) => {
  try {
    await prisma.documentTypeStaffAssignment.delete({
      where: {
        documentTypeId_staffId: {
          documentTypeId: parseInt(req.params.id),
          staffId: parseInt(req.params.staffId)
        }
      }
    });

    res.status(200).json({ success: true, message: 'Staff removed from document type' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
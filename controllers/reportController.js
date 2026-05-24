const prisma = require('../config/prisma');

// ─────────────────────────────────────────────
// HELPER: build date filter for createdAt
// ─────────────────────────────────────────────
const buildDateFilter = async (query) => {
  const { semesterId, startDate, endDate } = query;

  if (semesterId) {
    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(semesterId) }
    });
    if (!semester) throw new Error('Semester not found');
    // Filter by documents belonging to this semester
    return { semesterId: parseInt(semesterId) };
  }

  if (startDate && endDate) {
    return {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };
  }

  return {};
};

// @desc    Get overview statistics
// @route   GET /api/reports/overview
// @access  Private (Admin/Staff)
exports.getOverview = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);
    const { documentTypeId, status } = req.query;

    const where = {
      ...dateFilter,
      ...(documentTypeId && { documentTypeId: parseInt(documentTypeId) }),
      ...(status && { status })
    };

    const totalDocuments = await prisma.document.count({ where });

    // Count by status
    const statusGroups = await prisma.document.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });

    const byStatus = statusGroups.map(g => ({
      status: g.status,
      count: g._count.status
    }));

    // Average processing time (submitted → released) for released documents
    const releasedDocs = await prisma.document.findMany({
      where: { ...where, status: 'released' },
      select: { createdAt: true, updatedAt: true }
    });

    let avgProcessingTime = 0;
    if (releasedDocs.length > 0) {
      const totalDays = releasedDocs.reduce((sum, doc) => {
        const days = Math.ceil((doc.updatedAt - doc.createdAt) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0);
      avgProcessingTime = (totalDays / releasedDocs.length).toFixed(1);
    }

    res.status(200).json({
      success: true,
      data: { totalDocuments, byStatus, avgProcessingTime }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get documents submitted per month
// @route   GET /api/reports/per-month
// @access  Private (Admin/Staff)
exports.getDocumentsPerMonth = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);
    const { documentTypeId } = req.query;

    const where = {
      ...dateFilter,
      ...(documentTypeId && { documentTypeId: parseInt(documentTypeId) })
    };

    const documents = await prisma.document.findMany({
      where,
      select: { createdAt: true }
    });

    // Group by year-month in JS
    const map = {};
    for (const doc of documents) {
      const year = doc.createdAt.getFullYear();
      const month = doc.createdAt.getMonth() + 1;
      const key = `${year}-${month}`;
      map[key] = map[key] ? { ...map[key], count: map[key].count + 1 } : { year, month, count: 1 };
    }

    const result = Object.values(map).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get submitted vs released per month (trend)
// @route   GET /api/reports/monthly-trend
// @access  Private (Admin/Staff)
exports.getMonthlyTrend = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const documents = await prisma.document.findMany({
      where: dateFilter,
      select: { createdAt: true, status: true, updatedAt: true }
    });

    const map = {};

    for (const doc of documents) {
      const year = doc.createdAt.getFullYear();
      const month = doc.createdAt.getMonth() + 1;
      const key = `${year}-${month}`;
      if (!map[key]) map[key] = { year, month, submitted: 0, released: 0 };
      map[key].submitted += 1;
      if (doc.status === 'released') map[key].released += 1;
    }

    const result = Object.values(map).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get submission method breakdown (online vs in_person)
// @route   GET /api/reports/submission-methods
// @access  Private (Admin/Staff)
exports.getSubmissionMethods = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const groups = await prisma.document.groupBy({
      by: ['submissionMethod'],
      where: dateFilter,
      _count: { submissionMethod: true }
    });

    const data = groups.map(g => ({
      method: g.submissionMethod,
      count: g._count.submissionMethod
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get release method breakdown
// @route   GET /api/reports/release-methods
// @access  Private (Admin/Staff)
exports.getReleaseMethods = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const groups = await prisma.document.groupBy({
      by: ['releaseMethod'],
      where: dateFilter,
      _count: { releaseMethod: true }
    });

    const data = groups.map(g => ({
      method: g.releaseMethod,
      count: g._count.releaseMethod
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get document type statistics
// @route   GET /api/reports/document-types
// @access  Private (Admin/Staff)
exports.getDocumentTypeStats = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const groups = await prisma.document.groupBy({
      by: ['documentTypeId'],
      where: dateFilter,
      _count: { documentTypeId: true },
      orderBy: { _count: { documentTypeId: 'desc' } }
    });

    // Fetch document type names
    const typeIds = groups.map(g => g.documentTypeId);
    const types = await prisma.documentType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true, code: true }
    });

    const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

    const data = groups.map(g => ({
      documentTypeId: g.documentTypeId,
      name: typeMap[g.documentTypeId]?.name || 'Unknown',
      code: typeMap[g.documentTypeId]?.code || '',
      count: g._count.documentTypeId
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get top 5 document types
// @route   GET /api/reports/top-document-types
// @access  Private (Admin/Staff)
exports.getTopDocumentTypes = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const groups = await prisma.document.groupBy({
      by: ['documentTypeId'],
      where: dateFilter,
      _count: { documentTypeId: true },
      orderBy: { _count: { documentTypeId: 'desc' } },
      take: 5
    });

    const typeIds = groups.map(g => g.documentTypeId);
    const types = await prisma.documentType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true, code: true }
    });

    const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

    const data = groups.map(g => ({
      documentTypeId: g.documentTypeId,
      name: typeMap[g.documentTypeId]?.name || 'Unknown',
      code: typeMap[g.documentTypeId]?.code || '',
      count: g._count.documentTypeId
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get status distribution
// @route   GET /api/reports/status-distribution
// @access  Private (Admin/Staff)
exports.getStatusDistribution = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const groups = await prisma.document.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { status: true },
      orderBy: { _count: { status: 'desc' } }
    });

    const data = groups.map(g => ({
      status: g.status,
      count: g._count.status
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get staff performance
// @route   GET /api/reports/staff-performance
// @access  Private (Admin/Staff)
exports.getStaffPerformance = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);

    const staff = await prisma.user.findMany({
      where: { role: { in: ['staff', 'admin'] } },
      select: { id: true, name: true, email: true, role: true, position: true }
    });

    const staffPerformance = await Promise.all(
      staff.map(async (member) => {
        const [active, completed] = await Promise.all([
          prisma.document.count({
            where: {
              assignedStaffId: member.id,
              status: { notIn: ['completed', 'released', 'rejected'] }
            }
          }),
          prisma.document.count({
            where: {
              ...dateFilter,
              assignedStaffId: member.id,
              status: { in: ['completed', 'released'] }
            }
          })
        ]);

        return { staff: member, workload: active, processed: completed };
      })
);

    staffPerformance.sort((a, b) => b.processed - a.processed);

    res.status(200).json({ success: true, data: staffPerformance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get processing times by document type
// @route   GET /api/reports/processing-times
// @access  Private (Admin/Staff)
exports.getProcessingTimes = async (req, res) => {
  try {
    const dateFilter = await buildDateFilter(req.query);
    const { documentTypeId } = req.query;

    const where = {
      ...dateFilter,
      status: 'released',
      ...(documentTypeId && { documentTypeId: parseInt(documentTypeId) })
    };

    const documents = await prisma.document.findMany({
      where,
      select: {
        documentTypeId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Group by document type and calculate average days
    const map = {};
    for (const doc of documents) {
      const days = Math.ceil((doc.updatedAt - doc.createdAt) / (1000 * 60 * 60 * 24));
      if (!map[doc.documentTypeId]) {
        map[doc.documentTypeId] = { total: 0, count: 0 };
      }
      map[doc.documentTypeId].total += days;
      map[doc.documentTypeId].count += 1;
    }

    const typeIds = Object.keys(map).map(Number);
    const types = await prisma.documentType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, name: true, code: true }
    });
    const typeMap = Object.fromEntries(types.map(t => [t.id, t]));

    const data = typeIds.map(id => ({
      documentTypeId: id,
      name: typeMap[id]?.name || 'Unknown',
      code: typeMap[id]?.code || '',
      avgDays: parseFloat((map[id].total / map[id].count).toFixed(1)),
      count: map[id].count
    })).sort((a, b) => b.avgDays - a.avgDays);

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
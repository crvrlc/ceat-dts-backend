const prisma = require('../config/prisma');

// @desc    Get all activity logs
// @route   GET /api/activity-logs
// @access  Private (Admin/Staff)
exports.getActivityLogs = async (req, res) => {
  try {
    const { documentId, trackingCode, search, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      ...(documentId && { documentId: parseInt(documentId) }),
      // Combined search: tracking code OR performer name
      ...(search && {
        OR: [
          { document: { trackingCode: { contains: search, mode: 'insensitive' } } },
          { performedBy: { name: { contains: search, mode: 'insensitive' } } },
          { action: { contains: search, mode: 'insensitive' } },
        ]
      }),
      // Legacy trackingCode filter (keep for backward compat)
      ...(trackingCode && !search && {
        document: { trackingCode: { contains: trackingCode, mode: 'insensitive' } }
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom + 'T00:00:00.000+08:00') }),
          ...(dateTo   && { lte: new Date(dateTo   + 'T23:59:59.999+08:00') }),
        }
      }),
    };

    const [logs, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          performedBy: { select: { name: true, email: true, role: true } },
          document: { select: { trackingCode: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.activityLog.count({ where })
    ]);

    res.status(200).json({
      success: true,
      logs,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
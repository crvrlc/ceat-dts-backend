const prisma = require('../config/prisma');

// @desc    Get all activity logs
// @route   GET /api/activity-logs
// @access  Private (Admin/Staff)
exports.getActivityLogs = async (req, res) => {
  try {
    const { documentId, trackingCode, performedBy, dateFrom, dateTo, page = 1, limit = 50 } = req.query;

    console.log('dateFrom:', dateFrom);
    console.log('dateTo:', dateTo);
    console.log('dateFrom parsed:', dateFrom ? new Date(dateFrom + 'T00:00:00.000+08:00') : null);
    console.log('dateTo parsed:', dateTo ? new Date(dateTo + 'T23:59:59.999+08:00') : null);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

   const where = {
    ...(documentId && { documentId: parseInt(documentId) }),
    ...(trackingCode && {
      document: {
        trackingCode: { contains: trackingCode, mode: 'insensitive' }
      }
    }),
    ...(performedBy && {
      performedBy: {
        name: { contains: performedBy, mode: 'insensitive' }
      }
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
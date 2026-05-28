const prisma = require('../config/prisma');

const logActivity = async (performedById, action, entityType, entityId) => {
  await prisma.activityLog.create({
    data: { performedById, action, entityType, entityId }
  });
};

// @desc    Get all student registrations (paginated + searchable)
// @route   GET /api/student-registrations
// @access  Private (Admin/Staff)
exports.getStudentRegistrations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(5000, parseInt(req.query.limit) || 20));
    const search = req.query.search?.trim() || '';
    const skip = (page - 1) * limit;

    const where = search
      ? { email: { contains: search, mode: 'insensitive' } }
      : {};

    const [registrations, total] = await Promise.all([
      prisma.studentRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.studentRegistration.count({ where })
    ]);

    res.status(200).json({
      success: true,
      registrations,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a single student registration
// @route   POST /api/student-registrations
// @access  Private (Admin/Staff)
exports.addStudentRegistration = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.studentRegistration.findUnique({
      where: { email: normalizedEmail }
    });
    if (existing) {
      return res.status(400).json({ message: 'This email is already registered' });
    }

    const registration = await prisma.studentRegistration.create({
      data: { email: normalizedEmail }
    });

    await logActivity(req.user.id, `Added student registration: ${normalizedEmail}`, 'student', registration.id);

    res.status(201).json({ success: true, registration });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk add student registrations from CSV
// @route   POST /api/student-registrations/bulk
// @access  Private (Admin/Staff)
exports.bulkAddStudentRegistrations = async (req, res) => {
  try {
    const { students } = req.body;
    // students = [{ email }, ...]

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }

    // Normalize and deduplicate within the uploaded list
    const seen = new Set();
    const normalized = [];
    for (const s of students) {
      const email = s.email?.toLowerCase().trim();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      normalized.push(email);
    }

    if (normalized.length === 0) {
      return res.status(400).json({ message: 'No valid emails found in the uploaded data' });
    }

    // Find which emails already exist in the DB
    const existing = await prisma.studentRegistration.findMany({
      where: { email: { in: normalized } },
      select: { email: true }
    });

    const existingSet = new Set(existing.map(r => r.email));
    const toInsert = normalized.filter(email => !existingSet.has(email));
    const skippedCount = normalized.length - toInsert.length;

    if (toInsert.length > 0) {
      await prisma.studentRegistration.createMany({
        data: toInsert.map(email => ({ email })),
        skipDuplicates: true
      });
    }

    await logActivity(req.user.id, `Bulk added ${toInsert.length} student(s), ${skippedCount} skipped`, 'student', null);

    res.status(201).json({
      success: true,
      added: toInsert.length,
      skipped: skippedCount,
      message: `${toInsert.length} student(s) added, ${skippedCount} skipped (already registered)`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a student registration
// @route   DELETE /api/student-registrations/:id
// @access  Private (Admin/Staff)
exports.deleteStudentRegistration = async (req, res) => {
  try {
    const registration = await prisma.studentRegistration.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.isUsed) {
      return res.status(400).json({
        message: 'Cannot delete — this student has already created an account'
      });
    }

    await prisma.studentRegistration.delete({ where: { id: parseInt(req.params.id) } });

    await logActivity(req.user.id, `Removed student registration: ${registration.email}`, 'student', registration.id);

    res.status(200).json({ success: true, message: 'Registration removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
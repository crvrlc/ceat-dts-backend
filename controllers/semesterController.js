const prisma = require('../config/prisma');

const logActivity = async (performedById, action, entityType, entityId) => {
  await prisma.activityLog.create({
    data: { performedById, action, entityType, entityId }
  });
};

// Generate semester code from name and school year
// Format: 1 + last 2 digits of start year + semester number
// e.g. "1st Semester 2025-2026" → "1251"
// e.g. "2nd Semester 2025-2026" → "1252"
const generateSemesterCode = (name, schoolYear) => {
  const startYear = schoolYear.split('-')[0].slice(-2);
  const lowerName = name.toLowerCase();
  let semNumber;
  if (lowerName.includes('2nd')) {
    semNumber = '2';
  } else if (lowerName.includes('midyear') || lowerName.includes('mid-year') || lowerName.includes('summer')) {
    semNumber = '3';
  } else {
    semNumber = '1';
  }
  return `1${startYear}${semNumber}`;
};

// @desc    Create semester
// @route   POST /api/semesters
// @access  Private (Admin only)
exports.createSemester = async (req, res) => {
  try {
    const { name, schoolYear, period, isCurrent } = req.body;

    const code = generateSemesterCode(name, schoolYear);

    // Check for duplicate code
    const existing = await prisma.semester.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ message: 'Semester with this code already exists' });
    }

    // If setting as current, unset all others first
    if (isCurrent) {
      await prisma.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false }
      });
    }

    const semester = await prisma.semester.create({
      data: { name, schoolYear, code, period: period || null, isCurrent: isCurrent || false }
    });

    await logActivity(req.user.id, `Created semester: ${name} ${schoolYear} (${code})`, 'semester', semester.id);

    res.status(201).json({
      success: true,
      message: 'Semester created successfully',
      semester
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all semesters
// @route   GET /api/semesters
// @access  Private
exports.getSemesters = async (req, res) => {
  try {
    const semesters = await prisma.semester.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      count: semesters.length,
      semesters
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current semester
// @route   GET /api/semesters/current
// @access  Private
exports.getCurrentSemester = async (req, res) => {
  try {
    const semester = await prisma.semester.findFirst({ where: { isCurrent: true } });

    if (!semester) {
      return res.status(404).json({ message: 'No current semester set' });
    }

    res.status(200).json({ success: true, semester });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single semester
// @route   GET /api/semesters/:id
// @access  Private
exports.getSemester = async (req, res) => {
  try {
    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    res.status(200).json({ success: true, semester });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update semester
// @route   PUT /api/semesters/:id
// @access  Private (Admin only)
exports.updateSemester = async (req, res) => {
  try {
    const { name, schoolYear, period, isCurrent } = req.body;

    const existing = await prisma.semester.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!existing) return res.status(404).json({ message: 'Semester not found' });

    // Regenerate code if name or schoolYear changed
    const updatedName = name || existing.name;
    const updatedSchoolYear = schoolYear || existing.schoolYear;
    const code = generateSemesterCode(updatedName, updatedSchoolYear);

    // If setting this as current, unset all others first
    if (isCurrent) {
      await prisma.semester.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false }
      });
    }

    const semester = await prisma.semester.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name: updatedName,
        schoolYear: updatedSchoolYear,
        code,
        ...(period && { period }),
        ...(isCurrent !== undefined && { isCurrent })
      }
    });

    await logActivity(req.user.id, `Updated semester: ${semester.name} ${semester.schoolYear} (${semester.code})`, 'semester', semester.id);

    res.status(200).json({
      success: true,
      message: 'Semester updated successfully',
      semester
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set current semester
// @route   PATCH /api/semesters/:id/set-current
// @access  Private (Admin only)
exports.setCurrentSemester = async (req, res) => {
  try {
    // Unset all current semesters
    await prisma.semester.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false }
    });

    const semester = await prisma.semester.update({
      where: { id: parseInt(req.params.id) },
      data: { isCurrent: true }
    });

    await logActivity(req.user.id, `Set current semester: ${semester.name} ${semester.schoolYear} (${semester.code})`, 'semester', semester.id);

    res.status(200).json({
      success: true,
      message: 'Current semester updated',
      semester
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete semester
// @route   DELETE /api/semesters/:id
// @access  Private (Admin only)
exports.deleteSemester = async (req, res) => {
  try {
    const semester = await prisma.semester.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!semester) return res.status(404).json({ message: 'Semester not found' });

    if (semester.isCurrent) {
      return res.status(400).json({ message: 'Cannot delete the current semester' });
    }

    await prisma.semester.delete({ where: { id: parseInt(req.params.id) } });

    await logActivity(req.user.id, `Deleted semester: ${semester.name} ${semester.schoolYear} (${semester.code})`, 'semester', semester.id);

    res.status(200).json({ success: true, message: 'Semester deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
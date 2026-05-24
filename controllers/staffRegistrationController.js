const prisma = require('../config/prisma');

// @desc    Pre-register staff email
// @route   POST /api/staff-registrations
// @access  Private (Admin only)
exports.registerStaffEmail = async (req, res) => {
  try {
    const { email, role, position } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const existing = await prisma.staffRegistration.findUnique({
      where: { email: email.toLowerCase().trim() }
    });
    if (existing) {
      return res.status(400).json({ message: 'This email is already pre-registered' });
    }

    const registration = await prisma.staffRegistration.create({
      data: {
        email: email.toLowerCase().trim(),
        role: role || 'staff',
        position: position || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Staff email registered successfully',
      registration
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pre-registered staff emails
// @route   GET /api/staff-registrations
// @access  Private (Admin only)
exports.getStaffRegistrations = async (req, res) => {
  try {
    const registrations = await prisma.staffRegistration.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete staff registration
// @route   DELETE /api/staff-registrations/:id
// @access  Private (Admin only)
exports.deleteStaffRegistration = async (req, res) => {
  try {
    const registration = await prisma.staffRegistration.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.isUsed) {
      return res.status(400).json({
        message: 'Cannot delete — this registration has already been used to create an account'
      });
    }

    await prisma.staffRegistration.delete({ where: { id: parseInt(req.params.id) } });

    res.status(200).json({ success: true, message: 'Staff registration deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
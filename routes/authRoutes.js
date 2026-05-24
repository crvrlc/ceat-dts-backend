const express = require('express');
const passport = require('passport');
const { googleCallback, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// @desc    Initiate Google OAuth
// @route   GET /api/auth/google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/?error=unauthorized`,
    session: false
  }),
  googleCallback
);

// @desc    Handle unauthorized login (email not in whitelist)
// @route   GET /api/auth/unauthorized
// @access  Public   
router.get('/unauthorized', (req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/?error=unauthorized`);
});

// @desc    Get current user
// @route   GET /api/auth/me
router.get('/me', protect, getMe);

// @desc    Logout
// @route   GET /api/auth/logout
router.get('/logout', logout);

module.exports = router;
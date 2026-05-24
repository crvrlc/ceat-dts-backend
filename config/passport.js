const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();
        const photo = profile.photos?.[0]?.value || null;

        // 1. Check if user already exists by Google ID
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
        if (user) return done(null, user);

        // 2. Check if user exists by email (created manually)
        user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          user = await prisma.user.update({
            where: { email },
            data: { googleId: profile.id, photo }
          });
          return done(null, user);
        }

        // 3. Check staff whitelist
        const staffReg = await prisma.staffRegistration.findUnique({ where: { email } });
        if (staffReg && !staffReg.isUsed) {
          await prisma.staffRegistration.update({
            where: { email },
            data: { isUsed: true, usedAt: new Date() }
          });

          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              photo,
              role: staffReg.role,
              position: staffReg.position
            }
          });
          return done(null, user);
        }

        // 4. Check student whitelist
        const studentReg = await prisma.studentRegistration.findUnique({ where: { email } });
        if (studentReg && !studentReg.isUsed) {
          await prisma.studentRegistration.update({
            where: { email },
            data: { isUsed: true, usedAt: new Date() }
          });

          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              photo,
              role: 'student'
            }
          });
          return done(null, user);
        }

        // 5. Not in any whitelist — block login
        return done(null, false, { message: 'unauthorized' });

      } catch (error) {
        console.error('Passport error:', error);
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
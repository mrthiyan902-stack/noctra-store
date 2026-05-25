require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

// ── DB ──────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err.message));
} else {
  console.error('⚠️ MONGODB_URI not set — database features unavailable');
}

// ── SESSION STORE ────────────────────────────────────────
// Always start with memory store (safe default)
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'noctra_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// Try to upgrade to MongoDB-backed session store
if (MONGODB_URI) {
  try {
    const MongoStore = require('connect-mongo');
    const store = MongoStore.create({
      mongoUrl: MONGODB_URI,
      ttl: 60 * 60 * 24,
      autoRemove: 'native',
      touchAfter: 24 * 3600
    });
    store.on('error', (err) => {
      console.error('⚠️ Session store error:', err.message);
    });
    sessionConfig.store = store;
    console.log('✅ MongoDB session store configured');
  } catch (e) {
    console.warn('⚠️ connect-mongo load failed, using memory store:', e.message);
  }
}

// ── MIDDLEWARE ──────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.set('trust proxy', 1);

app.use(session(sessionConfig));
app.use(flash());

// ── GLOBAL LOCALS ───────────────────────────────────────
app.use((req, res, next) => {
  try {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.admin = req.session.admin || null;
    const cart = req.session.cart || [];
    res.locals.cartCount = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
  } catch (e) {
    res.locals.success = [];
    res.locals.error = [];
    res.locals.admin = null;
    res.locals.cartCount = 0;
  }
  next();
});

// ── DEBUG HEALTH CHECK ───────────────────────────────────
app.get('/_health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState, // 0=disconnected,1=connected,2=connecting,3=disconnecting
    env: {
      MONGODB_URI: MONGODB_URI ? '✅ set' : '❌ missing',
      SESSION_SECRET: process.env.SESSION_SECRET ? '✅ set' : '❌ missing',
      SSL_COMMERZ_STORE_ID: process.env.SSL_COMMERZ_STORE_ID ? '✅ set' : (process.env.SSLCOMMERZ_STORE_ID ? '✅ set (old key)' : '❌ missing'),
      SSL_COMMERZ_STORE_PASSWORD: process.env.SSL_COMMERZ_STORE_PASSWORD ? '✅ set' : (process.env.SSLCOMMERZ_STORE_PASSWORD ? '✅ set (old key)' : '❌ missing'),
      SSL_COMMERZ_IS_LIVE: process.env.SSL_COMMERZ_IS_LIVE || process.env.SSLCOMMERZ_IS_LIVE || '❌ missing',
      APP_URL: process.env.APP_URL || '❌ missing (using localhost)',
      NODE_ENV: process.env.NODE_ENV || 'not set'
    }
  });
});

// ── ROUTES ──────────────────────────────────────────────
app.use('/', require('./routes/shop'));
app.use('/admin', require('./routes/admin'));
app.use('/cart', require('./routes/cart'));
app.use('/payment', require('./routes/payment'));

// ── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack || err.message || err);
  try {
    res.status(500).render('500', { title: 'Error — NOCTRA' });
  } catch (renderErr) {
    res.status(500).send('Something went wrong. Please try again.');
  }
});

// ── UNHANDLED REJECTIONS ─────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.stack || err.message);
  // Don't exit — keep server alive
});

// ── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 NOCTRA running on port ${PORT}`));

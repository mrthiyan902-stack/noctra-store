require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

// ── DB ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ── SESSION STORE ────────────────────────────────────────
let sessionStore;
try {
  const MongoStore = require('connect-mongo');
  sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 60 * 60 * 24,
    autoRemove: 'native'
  });
  console.log('✅ Using MongoDB session store');
} catch (e) {
  console.warn('⚠️ connect-mongo not available, using memory store:', e.message);
  sessionStore = undefined;
}

// ── MIDDLEWARE ──────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.set('trust proxy', 1);

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'noctra_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

if (sessionStore) {
  sessionConfig.store = sessionStore;
}

app.use(session(sessionConfig));
app.use(flash());

// ── GLOBAL LOCALS ───────────────────────────────────────
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.admin = req.session.admin || null;
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
  next();
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

// ── ERROR HANDLER ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// ── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 NOCTRA running on port ${PORT}`));

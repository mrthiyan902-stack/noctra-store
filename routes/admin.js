const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const { isAdmin } = require('../middleware/auth');

// ── AUTH ─────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login — NOCTRA' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('🔐 Login attempt:', username);
  console.log('🔐 ENV username:', process.env.ADMIN_USERNAME);
  console.log('🔐 Match:', username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD);
  try {
    // Check env credentials first, then DB
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      req.session.admin = { username };
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        return res.redirect('/admin');
      });
      return;
    }
    const admin = await Admin.findOne({ username });
    if (admin && await admin.comparePassword(password)) {
      req.session.admin = { username };
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        return res.redirect('/admin');
      });
      return;
    }
    req.flash('error', 'Invalid username or password');
    res.redirect('/admin/login');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Login failed');
    res.redirect('/admin/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/login');
});

// ── DASHBOARD ────────────────────────────────────────────

router.get('/', isAdmin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.countDocuments({ paymentStatus: 'paid' });
    const revenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);
    res.render('admin/dashboard', {
      title: 'Dashboard — NOCTRA Admin',
      totalProducts, totalOrders, paidOrders,
      revenue: revenue[0]?.total || 0,
      recentOrders
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', { title: 'Dashboard', totalProducts: 0, totalOrders: 0, paidOrders: 0, revenue: 0, recentOrders: [] });
  }
});

// ── PRODUCTS ─────────────────────────────────────────────

router.get('/products', isAdmin, async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.render('admin/products', { title: 'Products — NOCTRA Admin', products });
});

router.get('/products/new', isAdmin, (req, res) => {
  res.render('admin/product-form', { title: 'Add Product — NOCTRA Admin', product: null });
});

router.post('/products', isAdmin, async (req, res) => {
  try {
    const { name, category, price, originalPrice, description, shortDescription, image, badge, stock, sku, brand, tags, featured } = req.body;
    const product = new Product({
      name, category,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      description, shortDescription, image, badge,
      stock: parseInt(stock) || 0,
      sku, brand,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      featured: featured === 'on'
    });
    await product.save();
    req.flash('success', 'Product added successfully!');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', 'Failed to add product: ' + err.message);
    res.redirect('/admin/products/new');
  }
});

router.get('/products/:id/edit', isAdmin, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.redirect('/admin/products');
  res.render('admin/product-form', { title: 'Edit Product — NOCTRA Admin', product });
});

router.put('/products/:id', isAdmin, async (req, res) => {
  try {
    const { name, category, price, originalPrice, description, shortDescription, image, badge, stock, sku, brand, tags, featured, active } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      name, category,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : null,
      description, shortDescription, image, badge,
      stock: parseInt(stock) || 0,
      sku, brand,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      featured: featured === 'on',
      active: active !== 'false'
    });
    req.flash('success', 'Product updated!');
    res.redirect('/admin/products');
  } catch (err) {
    req.flash('error', 'Update failed');
    res.redirect('/admin/products');
  }
});

router.delete('/products/:id', isAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  req.flash('success', 'Product deleted');
  res.redirect('/admin/products');
});

// ── ORDERS ───────────────────────────────────────────────

router.get('/orders', isAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.render('admin/orders', { title: 'Orders — NOCTRA Admin', orders });
});

router.get('/orders/:id', isAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.redirect('/admin/orders');
  res.render('admin/order-detail', { title: 'Order — NOCTRA Admin', order });
});

router.post('/orders/:id/status', isAdmin, async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.status });
  req.flash('success', 'Order status updated');
  res.redirect('/admin/orders/' + req.params.id);
});

module.exports = router;

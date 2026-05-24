const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// View cart
router.get('/', (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  res.render('shop/cart', { title: 'Cart — NOCTRA', cart, subtotal });
});

// Add to cart
router.post('/add/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect('/shop');
    let cart = req.session.cart || [];
    const existing = cart.find(i => i.productId === req.params.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        productId: req.params.id,
        name: product.name,
        image: product.image,
        price: product.price,
        qty: 1
      });
    }
    req.session.cart = cart;
    req.flash('success', `${product.name} added to cart!`);
    res.redirect('back');
  } catch (err) {
    res.redirect('/shop');
  }
});

// Update qty
router.post('/update/:id', (req, res) => {
  let cart = req.session.cart || [];
  const qty = parseInt(req.body.qty);
  if (qty <= 0) {
    cart = cart.filter(i => i.productId !== req.params.id);
  } else {
    const item = cart.find(i => i.productId === req.params.id);
    if (item) item.qty = qty;
  }
  req.session.cart = cart;
  res.redirect('/cart');
});

// Remove
router.post('/remove/:id', (req, res) => {
  let cart = req.session.cart || [];
  req.session.cart = cart.filter(i => i.productId !== req.params.id);
  res.redirect('/cart');
});

// Clear
router.post('/clear', (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
});

module.exports = router;

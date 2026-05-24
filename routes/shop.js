const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Home
router.get('/', async (req, res) => {
  try {
    const featured = await Product.find({ active: true, featured: true }).limit(8);
    const latest = await Product.find({ active: true }).sort({ createdAt: -1 }).limit(8);
    const categories = await Product.distinct('category', { active: true });
    res.render('shop/home', { title: 'NOCTRA — Premium Store', featured, latest, categories });
  } catch (err) {
    console.error(err);
    res.render('shop/home', { title: 'NOCTRA', featured: [], latest: [], categories: [] });
  }
});

// Shop all
router.get('/shop', async (req, res) => {
  try {
    const { category, sort, search } = req.query;
    let query = { active: true };
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    let sortObj = { createdAt: -1 };
    if (sort === 'price-asc') sortObj = { price: 1 };
    if (sort === 'price-desc') sortObj = { price: -1 };
    if (sort === 'popular') sortObj = { reviewCount: -1 };
    const products = await Product.find(query).sort(sortObj);
    const categories = await Product.distinct('category', { active: true });
    res.render('shop/shop', { title: 'Shop — NOCTRA', products, categories, category, sort, search });
  } catch (err) {
    console.error(err);
    res.render('shop/shop', { title: 'Shop — NOCTRA', products: [], categories: [], category: '', sort: '', search: '' });
  }
});

// Product detail
router.get('/product/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, active: true });
    if (!product) return res.redirect('/shop');
    const related = await Product.find({ category: product.category, active: true, _id: { $ne: product._id } }).limit(4);
    res.render('shop/product', { title: product.name + ' — NOCTRA', product, related });
  } catch (err) {
    res.redirect('/shop');
  }
});

module.exports = router;

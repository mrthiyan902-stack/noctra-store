const express = require('express');
const router = express.Router();
const axios = require('axios');
const Order = require('../models/Order');

// Read env vars lazily (inside route handlers) so they're always fresh
function getSSLConfig() {
  const STORE_ID   = process.env.SSL_COMMERZ_STORE_ID       || process.env.SSLCOMMERZ_STORE_ID;
  const STORE_PASS = process.env.SSL_COMMERZ_STORE_PASSWORD  || process.env.SSLCOMMERZ_STORE_PASSWORD;
  const IS_LIVE    = (process.env.SSL_COMMERZ_IS_LIVE        || process.env.SSLCOMMERZ_IS_LIVE) === 'true';
  const BASE_URL   = IS_LIVE
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';
  const APP_URL    = process.env.APP_URL || 'http://localhost:3000';
  return { STORE_ID, STORE_PASS, BASE_URL, APP_URL };
}

// Checkout page
router.get('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  res.render('shop/checkout', { title: 'Checkout — NOCTRA', cart, subtotal });
});

// Initiate payment
router.post('/initiate', async (req, res) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/cart');

    const { STORE_ID, STORE_PASS, BASE_URL, APP_URL } = getSSLConfig();

    if (!STORE_ID || !STORE_PASS) {
      console.error('❌ SSLCommerz credentials missing. STORE_ID:', STORE_ID, 'STORE_PASS:', STORE_PASS ? '***set***' : 'MISSING');
      req.flash('error', 'Payment gateway is not configured. Please contact support.');
      return res.redirect('/payment/checkout');
    }

    const { name, phone, email, address, city, postcode, notes } = req.body;
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const total = subtotal;

    // Create pending order
    const order = new Order({
      customer: { name, phone, email, address, city, postcode, notes },
      items: cart.map(i => ({
        product: i.productId,
        name: i.name,
        image: i.image,
        price: i.price,
        qty: i.qty
      })),
      subtotal,
      total,
      paymentStatus: 'pending',
      orderStatus: 'pending'
    });
    await order.save();

    // SSLCommerz payload
    const data = {
      store_id:     STORE_ID,
      store_passwd: STORE_PASS,
      total_amount: total,
      currency:     'BDT',
      tran_id:      order.orderId,
      success_url:  `${APP_URL}/payment/success`,
      fail_url:     `${APP_URL}/payment/fail`,
      cancel_url:   `${APP_URL}/payment/cancel`,
      ipn_url:      `${APP_URL}/payment/ipn`,
      cus_name:     name,
      cus_email:    email || 'customer@noctra.com',
      cus_add1:     address,
      cus_city:     city,
      cus_postcode: postcode || '0000',
      cus_country:  'Bangladesh',
      cus_phone:    phone,
      ship_name:    name,
      ship_add1:    address,
      ship_city:    city,
      ship_country: 'Bangladesh',
      product_name:     cart.map(i => i.name).join(', ').substring(0, 255),
      product_category: 'General',
      product_profile:  'general',
      num_of_item:      cart.length
    };

    console.log('💳 Initiating SSLCommerz payment for order:', order.orderId);
    console.log('💳 Gateway URL base:', BASE_URL);

    const response = await axios.post(
      `${BASE_URL}/gwprocess/v4/api.php`,
      new URLSearchParams(data),
      { timeout: 15000 }
    );

    console.log('💳 SSLCommerz response status:', response.data.status);

    if (response.data.status === 'SUCCESS') {
      req.session.pendingOrderId = order.orderId;
      return res.redirect(response.data.GatewayPageURL);
    } else {
      console.error('❌ SSLCommerz error:', JSON.stringify(response.data));
      req.flash('error', 'Payment initiation failed: ' + (response.data.failedreason || 'Please try again.'));
      return res.redirect('/payment/checkout');
    }
  } catch (err) {
    console.error('❌ Payment initiate error:', err.message);
    if (err.response) {
      console.error('   Response data:', JSON.stringify(err.response.data));
    }
    req.flash('error', 'Something went wrong with payment. Please try again.');
    return res.redirect('/payment/checkout');
  }
});

// Success
router.post('/success', async (req, res) => {
  try {
    const { tran_id, val_id, status, bank_tran_id } = req.body;
    if (status === 'VALID' || status === 'VALIDATED') {
      await Order.findOneAndUpdate(
        { orderId: tran_id },
        { paymentStatus: 'paid', orderStatus: 'confirmed', transactionId: val_id || bank_tran_id, sslData: req.body }
      );
      req.session.cart = [];
      req.session.pendingOrderId = null;
      const order = await Order.findOne({ orderId: tran_id });
      return res.render('shop/success', { title: 'Order Confirmed — NOCTRA', order });
    }
    res.redirect('/payment/fail');
  } catch (err) {
    console.error('❌ Payment success handler error:', err.message);
    res.redirect('/');
  }
});

// Fail
router.post('/fail', async (req, res) => {
  try {
    const { tran_id } = req.body;
    if (tran_id) {
      await Order.findOneAndUpdate({ orderId: tran_id }, { paymentStatus: 'failed' });
    }
    res.render('shop/fail', { title: 'Payment Failed — NOCTRA' });
  } catch (err) {
    console.error('❌ Payment fail handler error:', err.message);
    res.render('shop/fail', { title: 'Payment Failed — NOCTRA' });
  }
});

// Cancel
router.post('/cancel', async (req, res) => {
  try {
    const { tran_id } = req.body;
    if (tran_id) {
      await Order.findOneAndUpdate({ orderId: tran_id }, { paymentStatus: 'cancelled' });
    }
    res.render('shop/cancel', { title: 'Payment Cancelled — NOCTRA' });
  } catch (err) {
    console.error('❌ Payment cancel handler error:', err.message);
    res.render('shop/cancel', { title: 'Payment Cancelled — NOCTRA' });
  }
});

// IPN (instant payment notification)
router.post('/ipn', async (req, res) => {
  try {
    const { tran_id, status, val_id } = req.body;
    if (status === 'VALID' || status === 'VALIDATED') {
      await Order.findOneAndUpdate(
        { orderId: tran_id },
        { paymentStatus: 'paid', orderStatus: 'confirmed', transactionId: val_id }
      );
    }
    res.status(200).send('IPN received');
  } catch (err) {
    console.error('❌ IPN handler error:', err.message);
    res.status(200).send('IPN received');
  }
});

module.exports = router;

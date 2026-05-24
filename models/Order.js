const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    postcode: { type: String },
    notes: { type: String }
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    image: String,
    price: Number,
    qty: Number
  }],
  subtotal: Number,
  shipping: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: Number,
  paymentMethod: { type: String },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled'], default: 'pending' },
  orderStatus: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  transactionId: { type: String },
  sslData: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'NOCTRA-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);

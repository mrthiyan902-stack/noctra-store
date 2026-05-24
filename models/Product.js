const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  description: { type: String, required: true },
  shortDescription: { type: String },
  image: { type: String, required: true },
  images: [String],
  badge: { type: String, default: '' },
  stock: { type: Number, default: 0 },
  sku: { type: String },
  brand: { type: String },
  tags: [String],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);

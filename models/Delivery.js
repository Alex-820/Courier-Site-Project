const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true, unique: true },
  senderName: { type: String, required: true },
  senderAddress: { type: String, required: true },
  receiverName: { type: String, required: true },
  receiverAddress: { type: String, required: true },
  packageDetails: { type: String, required: true },
  weight: { type: Number, required: true },
  dimensions: {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  shippingOption: { type: String, required: true }, // e.g., Standard, Express
  status: { type: String, default: 'Label Created' }, // Current status
  currentLocation: { type: String, default: 'Origin' },
  estimatedDelivery: { type: Date },
  trackingHistory: [
    {
      status: { type: String },
      location: { type: String },
      date: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Delivery', deliverySchema);

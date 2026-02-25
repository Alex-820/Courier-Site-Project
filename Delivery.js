const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  senderName: { type: String, required: true },
  senderAddress: { type: String, required: true },
  receiverName: { type: String, required: true },
  receiverAddress: { type: String, required: true },
  packageDetails: { type: String, required: true },
  status: { type: String, default: 'Pending' },
estimatedDeliveryDate: String // <-- add this line
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Delivery', deliverySchema);

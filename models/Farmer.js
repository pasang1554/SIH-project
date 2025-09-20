// models/Farmer.js
const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  language: { type: String, default: 'en' },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitude, latitude]
  },
  farms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }],
  preferences: {
    communicationMethod: { type: String, enum: ['sms', 'voice', 'app'], default: 'sms' },
    notificationTime: { type: String, default: '06:00' }
  },
  createdAt: { type: Date, default: Date.now }
});

farmerSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Farmer', farmerSchema);
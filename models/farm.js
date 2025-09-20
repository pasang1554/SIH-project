// models/Farm.js
const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  name: { type: String, required: true },
  area: { type: Number, required: true }, // in hectares
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  boundary: {
    type: { type: String, default: 'Polygon' },
    coordinates: [[[Number]]] // GeoJSON polygon
  },
  crops: [{
    cropType: String,
    plantingDate: Date,
    expectedHarvestDate: Date,
    area: Number,
    status: { type: String, enum: ['planned', 'planted', 'growing', 'harvested'] }
  }],
  soilData: {
    ph: Number,
    nitrogen: Number,
    phosphorus: Number,
    potassium: Number,
    organicMatter: Number,
    lastTested: Date
  },
  irrigationType: { type: String, enum: ['rainfed', 'drip', 'sprinkler', 'flood'] },
  iotDevices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'IoTDevice' }]
});

farmSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('Farm', farmSchema);
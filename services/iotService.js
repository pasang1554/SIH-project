// services/iotService.js
const mqtt = require('mqtt');
const IoTReading = require('../models/IoTReading');

class IoTService {
  constructor() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL);
    this.setupListeners();
  }

  setupListeners() {
    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.client.subscribe('sensors/+/data');
    });

    this.client.on('message', async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const deviceId = topic.split('/')[1];
        
        const reading = new IoTReading({
          deviceId,
          timestamp: new Date(data.timestamp),
          data: {
            temperature: data.temperature,
            humidity: data.humidity,
            soilMoisture: data.soilMoisture,
            ph: data.ph,
            light: data.light
          }
        });
        
        await reading.save();
        await this.processReading(reading);
      } catch (error) {
        console.error('Error processing IoT data:', error);
      }
    });
  }

  async processReading(reading) {
    // Check for anomalies and trigger alerts
    if (reading.data.soilMoisture < 20) {
      await this.triggerAlert(reading.deviceId, 'LOW_MOISTURE', reading.data);
    }
    
    if (reading.data.temperature > 40) {
      await this.triggerAlert(reading.deviceId, 'HIGH_TEMPERATURE', reading.data);
    }
  }

  async triggerAlert(deviceId, alertType, data) {
    // Implementation for sending alerts to farmers
    const device = await IoTDevice.findById(deviceId).populate('farm');
    if (device && device.farm) {
      await this.notificationService.sendAlert(device.farm.farmer, alertType, data);
    }
  }
}

module.exports = new IoTService();
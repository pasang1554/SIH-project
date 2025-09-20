// services/smsService.js
const twilio = require('twilio');
const schedule = require('node-schedule');
const Farmer = require('../models/Farmer');
const Recommendation = require('../models/Recommendation');

class SMSService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.setupScheduledMessages();
  }

  setupScheduledMessages() {
    // Daily morning advisory at 6 AM
    schedule.scheduleJob('0 6 * * *', async () => {
      await this.sendDailyAdvisory();
    });

    // Weekly market prices on Sunday
    schedule.scheduleJob('0 8 * * 0', async () => {
      await this.sendWeeklyMarketUpdate();
    });
  }

  async sendSMS(phoneNumber, message, language = 'en') {
    try {
      const localizedMessage = await this.translateMessage(message, language);
      
      await this.client.messages.create({
        body: localizedMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });
      
      await this.logMessage(phoneNumber, localizedMessage, 'sent');
    } catch (error) {
      console.error('SMS sending failed:', error);
      await this.logMessage(phoneNumber, message, 'failed');
    }
  }

  async sendDailyAdvisory() {
    const farmers = await Farmer.find({ 
      'preferences.communicationMethod': 'sms',
      active: true 
    });

    for (const farmer of farmers) {
      const advisory = await this.generateDailyAdvisory(farmer);
      await this.sendSMS(farmer.phoneNumber, advisory, farmer.language);
    }
  }

  async generateDailyAdvisory(farmer) {
    const weather = await weatherService.getWeatherForLocation(
      farmer.location.coordinates[1], 
      farmer.location.coordinates[0]
    );
    
    const recommendations = await Recommendation.find({
      farmer: farmer._id,
      date: new Date().toISOString().split('T')[0],
      priority: 'high'
    });

    let message = `Good morning ${farmer.name}!\n`;
    message += `Weather: ${weather.temperature}°C, ${weather.description}\n`;
    
    if (weather.precipitation > 70) {
      message += `⚠️ High chance of rain today. Avoid spraying.\n`;
    }
    
    recommendations.forEach(rec => {
      message += `• ${rec.message}\n`;
    });

    return message;
  }

  // Handle incoming SMS
  async handleIncomingSMS(req, res) {
    const { From, Body } = req.body;
    const farmer = await Farmer.findOne({ phoneNumber: From });
    
    if (!farmer) {
      await this.sendSMS(From, 'Please register first. Send REGISTER to get started.');
      return res.sendStatus(200);
    }

    const response = await this.processCommand(Body, farmer);
    await this.sendSMS(From, response, farmer.language);
    
    res.sendStatus(200);
  }

  async processCommand(command, farmer) {
    const cmd = command.trim().toUpperCase();
    
    switch (cmd) {
      case 'WEATHER':
        return this.getWeatherSMS(farmer);
      case 'PRICE':
        return this.getPriceSMS(farmer);
      case 'HELP':
        return this.getHelpSMS(farmer.language);
      default:
        return this.processNaturalQuery(command, farmer);
    }
  }
}

module.exports = new SMSService();
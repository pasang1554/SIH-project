// services/whatsappService.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox'],
      }
    });
    
    this.initialize();
  }

  initialize() {
    this.client.on('qr', (qr) => {
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
    });

    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    this.client.initialize();
  }

  async handleMessage(message) {
    const contact = await message.getContact();
    const farmer = await Farmer.findOne({ phoneNumber: contact.number });
    
    if (!farmer) {
      await message.reply('Welcome! Please register by sending your location and farm details.');
      return;
    }

    // Handle different message types
    if (message.hasMedia) {
      await this.handleMediaMessage(message, farmer);
    } else if (message.location) {
      await this.handleLocationMessage(message, farmer);
    } else {
      await this.handleTextMessage(message, farmer);
    }
  }

  async handleMediaMessage(message, farmer) {
    const media = await message.downloadMedia();
    
    if (media.mimetype.startsWith('image/')) {
      // Process image for disease detection
      const analysis = await this.analyzeImage(media.data);
      
      if (analysis.diseaseDetected) {
        const response = `🔍 Disease Detected: ${analysis.disease}\n\n`;
        response += `📋 Recommended Treatment:\n${analysis.treatment}\n\n`;
        response += `⚠️ Severity: ${analysis.severity}/5`;
        
        await message.reply(response);
        
        // Send treatment images if available
        if (analysis.treatmentImages) {
          for (const img of analysis.treatmentImages) {
            const media = MessageMedia.fromFilePath(img);
            await this.client.sendMessage(message.from, media);
          }
        }
      }
    }
  }

  async analyzeImage(imageData) {
    // Convert base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');
    
    // Preprocess image
    const processedImage = await sharp(buffer)
      .resize(224, 224)
      .toBuffer();
    
    // Run disease detection model
    const prediction = await mlService.detectCropDisease(processedImage);
    
    return {
      diseaseDetected: prediction.confidence > 0.7,
      disease: prediction.disease,
      severity: prediction.severity,
      treatment: await this.getTreatmentRecommendation(prediction.disease),
      treatmentImages: await this.getTreatmentImages(prediction.disease)
    };
  }

  async sendScheduledUpdates() {
    const farmers = await Farmer.find({ 
      'preferences.communicationMethod': 'whatsapp',
      whatsappNumber: { $exists: true }
    });

    for (const farmer of farmers) {
      try {
        // Send weather update with visual card
        const weatherCard = await this.generateWeatherCard(farmer);
        const media = MessageMedia.fromFilePath(weatherCard);
        await this.client.sendMessage(farmer.whatsappNumber, media);
        
        // Send personalized recommendations
        const recommendations = await this.getPersonalizedRecommendations(farmer);
        await this.client.sendMessage(farmer.whatsappNumber, recommendations);
        
      } catch (error) {
        console.error(`Failed to send WhatsApp update to ${farmer.name}:`, error);
      }
    }
  }

  async generateWeatherCard(farmer) {
    // Create visual weather card using Canvas or Sharp
    const weather = await weatherService.getWeatherForLocation(
      farmer.location.coordinates[1],
      farmer.location.coordinates[0]
    );
    
    // Generate image with weather info
    // Implementation details...
    
    return './temp/weather-card.png';
  }
}

module.exports = new WhatsAppService();
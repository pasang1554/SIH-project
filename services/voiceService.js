// services/voiceService.js
const twilio = require('twilio');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { SpeechClient } = require('@google-cloud/speech');

class VoiceService {
  constructor() {
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.ttsClient = new TextToSpeechClient();
    this.sttClient = new SpeechClient();
  }

  // Handle incoming voice calls
  async handleIncomingCall(req, res) {
    const twiml = new twilio.twiml.VoiceResponse();
    const farmer = await this.identifyFarmer(req.body.From);
    
    if (!farmer) {
      twiml.say({ language: 'en-IN' }, 'Welcome to Smart Agriculture Advisory. Please register first by pressing 1.');
      twiml.gather({
        numDigits: 1,
        action: '/voice/register',
      });
    } else {
      const greeting = await this.getLocalizedGreeting(farmer.language);
      twiml.play(greeting);
      
      twiml.say({ language: farmer.languageCode }, 
        'Press 1 for weather update, 2 for crop advice, 3 for market prices, 4 to speak your question'
      );
      
      twiml.gather({
        numDigits: 1,
        action: '/voice/menu',
        method: 'POST',
      });
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
  }

  // Convert text to speech in local language
  async textToSpeech(text, languageCode) {
    const request = {
      input: { text },
      voice: {
        languageCode,
        ssmlGender: 'NEUTRAL',
      },
      audioConfig: {
        audioEncoding: 'MP3',
      },
    };

    const [response] = await this.ttsClient.synthesizeSpeech(request);
    return response.audioContent;
  }

  // Process voice queries
  async processVoiceQuery(audioBuffer, languageCode) {
    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode,
      },
      audio: {
        content: audioBuffer.toString('base64'),
      },
    };

    const [response] = await this.sttClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    return this.processNaturalLanguageQuery(transcription, languageCode);
  }

  // Natural language processing for queries
  async processNaturalLanguageQuery(query, languageCode) {
    // Implement NLP logic here
    const intent = await this.detectIntent(query);
    
    switch (intent.type) {
      case 'WEATHER':
        return this.getWeatherAdvice(intent.parameters);
      case 'PEST_CONTROL':
        return this.getPestControlAdvice(intent.parameters);
      case 'IRRIGATION':
        return this.getIrrigationAdvice(intent.parameters);
      case 'MARKET_PRICE':
        return this.getMarketPrices(intent.parameters);
      default:
        return this.getGeneralAdvice(query);
    }
  }
}

module.exports = new VoiceService();
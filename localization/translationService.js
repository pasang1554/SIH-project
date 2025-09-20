// Updated translationService.js with better error handling
const i18n = require('i18n');
const path = require('path');
const fs = require('fs').promises;

class TranslationService {
  constructor() {
    this.supportedLanguages = [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'हिन्दी' },
      { code: 'te', name: 'తెలుగు' },
      { code: 'ta', name: 'தமிழ்' },
      { code: 'kn', name: 'ಕನ್ನಡ' },
      { code: 'mr', name: 'मराठी' },
      { code: 'gu', name: 'ગુજરાતી' },
      { code: 'pa', name: 'ਪੰਜਾਬੀ' },
      { code: 'bn', name: 'বাংলা' },
      { code: 'ml', name: 'മലയാളം' },
      { code: 'or', name: 'ଓଡ଼ିଆ' },
      { code: 'as', name: 'অসমীয়া' }
    ];

    this.redis = null;
    this.voiceService = null;
    this.s3Service = null;
    
    this.initializeI18n();
    this.initializeServices();
  }

  async initializeServices() {
    try {
      // Lazy load services to avoid circular dependencies
      this.redis = require('../config/redis');
      this.voiceService = require('../services/voiceService');
      this.s3Service = require('../services/s3Service');
    } catch (error) {
      console.warn('Some services not available:', error.message);
    }
  }

  initializeI18n() {
    // Create locales directory if it doesn't exist
    const localesDir = path.join(__dirname, 'locales');
    if (!require('fs').existsSync(localesDir)) {
      require('fs').mkdirSync(localesDir, { recursive: true });
    }

    i18n.configure({
      locales: this.supportedLanguages.map(l => l.code),
      directory: localesDir,
      defaultLocale: 'en',
      objectNotation: true,
      updateFiles: false,
      syncFiles: false
    });
  }

  async translateRecommendation(recommendation, targetLanguage) {
    if (targetLanguage === 'en') return recommendation;

    try {
      // Check cache first if redis is available
      if (this.redis) {
        const cacheKey = `trans:${targetLanguage}:${recommendation.id}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }

      // Translate
      const translated = {
        ...recommendation,
        title: await this.translateText(recommendation.title, targetLanguage),
        message: await this.translateText(recommendation.message, targetLanguage),
        actions: recommendation.actions ? await Promise.all(
          recommendation.actions.map(action => 
            this.translateText(action, targetLanguage)
          )
        ) : []
      };

      // Cache translation if redis is available
      if (this.redis) {
        const cacheKey = `trans:${targetLanguage}:${recommendation.id}`;
        await this.redis.setex(cacheKey, 86400, JSON.stringify(translated));
      }
      
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return recommendation; // Fallback to original
    }
  }

  async translateText(text, targetLanguage) {
    try {
      // For now, use i18n if translation exists
      const translated = i18n.__({ phrase: text, locale: targetLanguage });
      if (translated !== text) {
        return translated;
      }
      
      // If you want to use Google Translate API, uncomment below
      // const { translate } = require('@vitalets/google-translate-api');
      // const result = await translate(text, { to: targetLanguage });
      // return result.text;
      
      return text; // Return original if no translation available
    } catch (error) {
      console.error('Translation failed:', error);
      return text;
    }
  }

  // Generate voice content in local language
  async generateVoiceContent(text, language) {
    try {
      if (!this.voiceService) {
        throw new Error('Voice service not available');
      }

      const audioContent = await this.voiceService.textToSpeech(text, language);
      const filename = `audio_${Date.now()}_${language}.mp3`;
      const tempDir = path.join(__dirname, '../temp');
      
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });
      
      const filepath = path.join(tempDir, filename);
      await fs.writeFile(filepath, audioContent);
      
      // Upload to S3 if service is available
      if (this.s3Service) {
        const s3Key = `voice-content/${filename}`;
        await this.s3Service.uploadFile(filepath, s3Key);
        
        // Clean up temp file
        await fs.unlink(filepath);
        
        return this.s3Service.getSignedUrl(s3Key);
      }
      
      return filepath; // Return local path if S3 not available
    } catch (error) {
      console.error('Voice content generation failed:', error);
      throw error;
    }
  }

  // Create localized content templates
  getLocalizedTemplates(language) {
    return {
      weatherAlert: i18n.__({ phrase: 'weather.alert', locale: language }),
      irrigationReminder: i18n.__({ phrase: 'irrigation.reminder', locale: language }),
      pestWarning: i18n.__({ phrase: 'pest.warning', locale: language }),
      harvestAdvice: i18n.__({ phrase: 'harvest.advice', locale: language }),
      marketUpdate: i18n.__({ phrase: 'market.update', locale: language })
    };
  }
}

module.exports = new TranslationService();
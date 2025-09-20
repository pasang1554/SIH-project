// services/satelliteService.js
const axios = require('axios');
const tf = require('@tensorflow/tfjs-node');
const sharp = require('sharp');

class SatelliteService {
  constructor() {
    this.sentinelHubUrl = process.env.SENTINEL_HUB_URL;
    this.clientId = process.env.SENTINEL_CLIENT_ID;
    this.clientSecret = process.env.SENTINEL_CLIENT_SECRET;
    this.loadModels();
  }

  async loadModels() {
    // Load pre-trained models for vegetation analysis
    this.ndviModel = await tf.loadLayersModel('file://./models/ndvi_analysis/model.json');
    this.cropHealthModel = await tf.loadLayersModel('file://./models/crop_health/model.json');
  }

  async getToken() {
    const response = await axios.post('https://services.sentinel-hub.com/oauth/token', {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    
    return response.data.access_token;
  }

  async getFarmImagery(farmBoundary, dateFrom, dateTo) {
    const token = await this.getToken();
    
    const evalscript = `
      //VERSION=3
      function setup() {
        return {
          input: ["B04", "B08", "B02", "B03"],
          output: { bands: 4 }
        };
      }
      
      function evaluatePixel(sample) {
        let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
        return [sample.B04, sample.B03, sample.B02, ndvi];
      }
    `;
    
    const requestBody = {
      input: {
        bounds: {
          geometry: farmBoundary,
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" }
        },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: { from: dateFrom, to: dateTo },
            maxCloudCoverage: 20
          }
        }]
      },
      output: {
        width: 512,
        height: 512,
        responses: [{
          identifier: "default",
          format: { type: "image/tiff" }
        }]
      },
      evalscript
    };
    
    const response = await axios.post(
      `${this.sentinelHubUrl}/api/v1/process`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    return response.data;
  }

  async analyzeVegetationHealth(imageBuffer) {
    // Process image and extract NDVI
    const image = await sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    // Convert to tensor for ML processing
    const imageTensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, info.channels]
    );
    
    // Normalize and prepare for model
    const normalized = imageTensor.div(255.0);
    const batched = normalized.expandDims(0);
    
    // Run inference
    const predictions = await this.cropHealthModel.predict(batched);
    const healthScore = await predictions.data();
    
    // Calculate statistics
    const ndviValues = this.extractNDVIValues(data, info);
    const stats = this.calculateNDVIStats(ndviValues);
    
    return {
      healthScore: healthScore[0],
      ndvi: stats,
      recommendations: this.generateHealthRecommendations(stats, healthScore[0])
    };
  }

  extractNDVIValues(data, info) {
    const ndviValues = [];
    const pixelCount = info.width * info.height;
    
    for (let i = 0; i < pixelCount; i++) {
      const offset = i * info.channels;
      const ndvi = data[offset + 3]; // NDVI is in the 4th channel
      ndviValues.push(ndvi / 255); // Normalize to 0-1
    }
    
    return ndviValues;
  }

  calculateNDVIStats(ndviValues) {
    const validValues = ndviValues.filter(v => v > -1 && v < 1);
    const sum = validValues.reduce((a, b) => a + b, 0);
    const mean = sum / validValues.length;
    
    const sortedValues = validValues.sort((a, b) => a - b);
    const median = sortedValues[Math.floor(sortedValues.length / 2)];
    
    return {
      mean,
      median,
      min: Math.min(...validValues),
      max: Math.max(...validValues),
      healthyPercentage: (validValues.filter(v => v > 0.4).length / validValues.length) * 100
    };
  }

  generateHealthRecommendations(ndviStats, healthScore) {
    const recommendations = [];
    
    if (ndviStats.mean < 0.3) {
      recommendations.push({
        type: 'urgent',
        message: 'Crop stress detected. Check for water stress or pest infestation.',
        action: 'immediate_inspection'
      });
    } else if (ndviStats.mean < 0.5) {
      recommendations.push({
        type: 'warning',
        message: 'Below optimal vegetation health. Consider nutrient supplementation.',
        action: 'soil_testing'
      });
    }
    
    if (ndviStats.healthyPercentage < 70) {
      recommendations.push({
        type: 'advisory',
        message: `Only ${ndviStats.healthyPercentage.toFixed(1)}% of field showing healthy vegetation.`,
        action: 'field_assessment'
      });
    }
    
    return recommendations;
  }
}

module.exports = new Satell
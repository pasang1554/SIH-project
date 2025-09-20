// tests/unit/mlService.test.js
const mlService = require('../../services/mlService');
const tf = require('@tensorflow/tfjs-node');

describe('ML Service Unit Tests', () => {
  describe('NDVI Calculation', () => {
    it('should calculate NDVI correctly', () => {
      const nir = 0.8;
      const red = 0.2;
      const expectedNDVI = (nir - red) / (nir + red);
      
      const result = mlService.calculateNDVI(nir, red);
      expect(result).toBeCloseTo(expectedNDVI, 5);
    });

    it('should handle edge cases', () => {
      const result = mlService.calculateNDVI(0, 0);
      expect(result).toBe(0);
    });
  });

  describe('Crop Health Prediction', () => {
    it('should return health score between 0 and 1', async () => {
      const mockImageData = tf.randomNormal([224, 224, 3]);
      const healthScore = await mlService.predictCropHealth(mockImageData);
      
      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Disease Detection', () => {
    it('should detect disease with confidence score', async () => {
      const mockImage = Buffer.from('fake-image-data');
      const result = await mlService.detectDisease(mockImage);
      
      expect(result).toHaveProperty('disease');
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
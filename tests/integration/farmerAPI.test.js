// tests/integration/farmerAPI.test.js
const request = require('supertest');
const app = require('../../server');
const Farmer = require('../../models/Farmer');
const { generateToken } = require('../../utils/auth');

describe('Farmer API Integration Tests', () => {
  let authToken;
  let testFarmer;

  beforeAll(async () => {
    // Create test farmer
    testFarmer = await Farmer.create({
      name: 'Test Farmer',
      phoneNumber: '+1234567890',
      location: {
        type: 'Point',
        coordinates: [78.9629, 20.5937]
      },
      language: 'en'
    });

    authToken = generateToken(testFarmer._id);
  });

  afterAll(async () => {
    await Farmer.deleteMany({ phoneNumber: '+1234567890' });
  });

  describe('GET /api/farmers/dashboard', () => {
    it('should return dashboard data for authenticated farmer', async () => {
      const response = await request(app)
        .get('/api/farmers/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('weather');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('alerts');
      expect(response.body.farmer.id).toBe(testFarmer._id.toString());
    });

    it('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/farmers/dashboard')
        .expect(401);
    });
  });

  describe('POST /api/farmers/farms', () => {
    it('should create a new farm', async () => {
      const farmData = {
        name: 'Test Farm',
        area: 5.5,
        location: {
          type: 'Point',
          coordinates: [78.9629, 20.5937]
        },
        crops: [{
          cropType: 'Rice',
          plantingDate: new Date(),
          area: 3.5
        }],
        irrigationType: 'drip'
      };

      const response = await request(app)
        .post('/api/farmers/farms')
        .set('Authorization', `Bearer ${authToken}`)
        .send(farmData)
        .expect(201);

      expect(response.body.farm).toHaveProperty('_id');
      expect(response.body.farm.name).toBe(farmData.name);
      expect(response.body.farm.farmer).toBe(testFarmer._id.toString());
    });
  });
});

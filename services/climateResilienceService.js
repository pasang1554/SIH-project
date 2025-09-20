// services/climateResilienceService.js
const tf = require('@tensorflow/tfjs-node');
const axios = require('axios');

class ClimateResilienceService {
  constructor() {
    this.climateModels = new Map();
    this.initializeModels();
  }

  async initializeModels() {
    // Load climate prediction models
    this.climateModels.set(
      'drought_risk',
      await tf.loadLayersModel('file://./models/climate/drought_risk/model.json')
    );
    
    this.climateModels.set(
      'flood_risk',
      await tf.loadLayersModel('file://./models/climate/flood_risk/model.json')
    );
    
    this.climateModels.set(
      'crop_suitability',
      await tf.loadLayersModel('file://./models/climate/crop_suitability/model.json')
    );
  }

  async assessClimateRisks(farmId) {
    const farm = await Farm.findById(farmId).populate('historicalData');
    
    // Fetch climate data
    const climateData = await this.fetchClimateData(farm.location);
    const historicalWeather = await this.getHistoricalWeather(farm.location, 5); // 5 years
    
    // Analyze trends
    const trends = this.analyzeClimateTrends(historicalWeather);
    
    // Predict risks
    const risks = {
      drought: await this.predictDroughtRisk(farm, climateData, trends),
      flood: await this.predictFloodRisk(farm, climateData, trends),
      temperature: await this.assessTemperatureRisks(farm, climateData, trends),
      extremeEvents: await this.predictExtremeEvents(farm, climateData)
    };
    
    // Generate adaptation strategies
    const adaptations = await this.generateAdaptationStrategies(farm, risks);
    
    // Calculate resilience score
    const resilienceScore = this.calculateResilienceScore(farm, risks, adaptations);
    
    return {
      risks,
      trends,
      adaptations,
      resilienceScore,
      recommendations: await this.generateClimateRecommendations(farm, risks)
    };
  }

  async fetchClimateData(location) {
    const sources = [
      {
        name: 'NOAA',
        url: `https://api.noaa.gov/climate/data`,
        parser: this.parseNOAAData
      },
      {
        name: 'ERA5',
        url: `https://climate.copernicus.eu/api/v2`,
        parser: this.parseERA5Data
      }
    ];
    
    const climateData = {};
    
    for (const source of sources) {
      try {
        const response = await axios.get(source.url, {
          params: {
            lat: location.coordinates[1],
            lon: location.coordinates[0],
            variables: ['temperature', 'precipitation', 'humidity', 'wind']
          }
        });
        
        climateData[source.name] = source.parser(response.data);
      } catch (error) {
        console.error(`Failed to fetch from ${source.name}:`, error);
      }
    }
    
    return this.aggregateClimateData(climateData);
  }

  async predictDroughtRisk(farm, climateData, trends) {
    // Prepare features
    const features = tf.tensor2d([[
      climateData.precipitation.annual,
      climateData.precipitation.variability,
      climateData.temperature.mean,
      climateData.evapotranspiration,
      
            trends.precipitationTrend,
      trends.temperatureTrend,
      farm.soilData.waterRetention || 0.5,
      farm.irrigationType === 'rainfed' ? 1 : 0
    ]]);
    
    // Predict drought risk
    const prediction = await this.climateModels.get('drought_risk').predict(features);
    const riskScore = await prediction.data();
    
    // Analyze seasonal patterns
    const seasonalRisks = await this.analyzeSeasonalDroughtRisk(farm, climateData);
    
    // Calculate water deficit
    const waterDeficit = this.calculateWaterDeficit(
      climateData.precipitation,
      climateData.evapotranspiration,
      farm.crops
    );
    
    return {
      riskLevel: this.categorizeRisk(riskScore[0]),
      probability: riskScore[0],
      seasonalPattern: seasonalRisks,
      waterDeficit,
      criticalPeriods: this.identifyCriticalPeriods(seasonalRisks),
      mitigationStrategies: await this.getDroughtMitigationStrategies(farm, riskScore[0])
    };
  }

  async generateAdaptationStrategies(farm, risks) {
    const strategies = [];
    
    // Drought adaptation
    if (risks.drought.riskLevel === 'high') {
      strategies.push({
        category: 'water_management',
        priority: 'critical',
        strategies: [
          {
            name: 'Rainwater Harvesting',
            description: 'Install rainwater collection systems',
            cost: 'Medium',
            effectiveness: 'High',
            implementation: await this.getRainwaterHarvestingPlan(farm)
          },
          {
            name: 'Drought-Resistant Varieties',
            description: 'Switch to drought-tolerant crop varieties',
            cost: 'Low',
            effectiveness: 'High',
            varieties: await this.recommendDroughtResistantCrops(farm)
          },
          {
            name: 'Micro-Irrigation',
            description: 'Install drip or sprinkler irrigation',
            cost: 'High',
            effectiveness: 'Very High',
            roi: '2-3 years'
          }
        ]
      });
    }
    
    // Flood adaptation
    if (risks.flood.riskLevel === 'high') {
      strategies.push({
        category: 'flood_management',
        priority: 'high',
        strategies: [
          {
            name: 'Drainage Systems',
            description: 'Improve field drainage',
            cost: 'Medium',
            effectiveness: 'High',
            plan: await this.getDrainagePlan(farm)
          },
          {
            name: 'Flood-Tolerant Crops',
            description: 'Plant flood-resistant varieties',
            cost: 'Low',
            effectiveness: 'Medium',
            varieties: await this.recommendFloodTolerantCrops(farm)
          }
        ]
      });
    }
    
    // Temperature stress adaptation
    if (risks.temperature.heatStress > 0.6) {
      strategies.push({
        category: 'heat_management',
        priority: 'medium',
        strategies: [
          {
            name: 'Shade Nets',
            description: 'Install shade nets for sensitive crops',
            cost: 'Medium',
            effectiveness: 'High',
            coverage: this.calculateShadeNetRequirement(farm)
          },
          {
            name: 'Mulching',
            description: 'Apply organic mulch to reduce soil temperature',
            cost: 'Low',
            effectiveness: 'Medium',
            materials: ['Rice straw', 'Sugarcane trash', 'Plastic mulch']
          }
        ]
      });
    }
    
    return strategies;
  }

  async recommendClimateResilientCrops(farm, climateProjections) {
    const currentCrops = farm.crops.map(c => c.cropType);
    const suitabilityScores = {};
    
    // Evaluate crop suitability under future climate
    const crops = [
      'Rice', 'Wheat', 'Maize', 'Sorghum', 'Pearl Millet',
      'Chickpea', 'Pigeon Pea', 'Groundnut', 'Cotton', 'Sugarcane'
    ];
    
    for (const crop of crops) {
      const features = tf.tensor2d([[
        climateProjections.temperature.mean,
        climateProjections.temperature.max,
        climateProjections.precipitation.annual,
        climateProjections.precipitation.monsoon,
        farm.soilData.ph || 7,
        farm.soilData.organicMatter || 2,
        farm.location.coordinates[1], // latitude
        farm.elevation || 100
      ]]);
      
      const suitability = await this.climateModels.get('crop_suitability').predict(features);
      suitabilityScores[crop] = await suitability.data();
    }
    
    // Rank crops by climate resilience
    const rankedCrops = Object.entries(suitabilityScores)
      .sort((a, b) => b[1][0] - a[1][0])
      .map(([crop, score]) => ({
        crop,
        suitabilityScore: score[0],
        currentlyGrown: currentCrops.includes(crop),
        recommendation: this.getCropRecommendation(crop, score[0], farm)
      }));
    
    return rankedCrops;
  }

  calculateResilienceScore(farm, risks, adaptations) {
    let score = 100;
    
    // Deduct points for risks
    const riskWeights = {
      drought: 30,
      flood: 25,
      temperature: 20,
      extremeEvents: 25
    };
    
    for (const [riskType, weight] of Object.entries(riskWeights)) {
      const risk = risks[riskType];
      if (risk.riskLevel === 'high') {
        score -= weight * 0.8;
      } else if (risk.riskLevel === 'medium') {
        score -= weight * 0.4;
      }
    }
    
    // Add points for implemented adaptations
    const implementedAdaptations = farm.adaptations || [];
    score += implementedAdaptations.length * 5;
    
    // Consider crop diversity
    const cropDiversity = new Set(farm.crops.map(c => c.cropType)).size;
    score += Math.min(cropDiversity * 3, 15);
    
    // Consider water management
    if (farm.irrigationType !== 'rainfed') {
      score += 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  async generateClimateRecommendations(farm, risks) {
    const recommendations = [];
    
    // Immediate actions
    const immediateActions = [];
    
    if (risks.drought.probability > 0.7) {
      immediateActions.push({
        action: 'Water Conservation',
        steps: [
          'Reduce irrigation frequency',
          'Apply mulch to retain moisture',
          'Consider deficit irrigation for hardy crops'
        ],
        timeline: 'Immediate'
      });
    }
    
    if (risks.temperature.heatStress > 0.6) {
      immediateActions.push({
        action: 'Heat Stress Management',
        steps: [
          'Irrigate during early morning or late evening',
          'Provide shade for sensitive crops',
          'Apply reflective mulch'
        ],
        timeline: 'Within 1 week'
      });
    }
    
    // Long-term planning
    const longTermPlans = await this.generateLongTermClimatePlan(farm, risks);
    
    // Financial planning
    const financialRecommendations = await this.getClimateFinanceOptions(farm, risks);
    
    return {
      immediate: immediateActions,
      shortTerm: this.getShortTermRecommendations(risks),
      longTerm: longTermPlans,
      financial: financialRecommendations,
      training: await this.getClimateTrainingRecommendations(farm)
    };
  }

  async monitorClimateIndicators(farmId) {
    const indicators = {
      temperature: await this.monitorTemperatureAnomalies(farmId),
      precipitation: await this.monitorPrecipitationPatterns(farmId),
      extremeEvents: await this.trackExtremeEvents(farmId),
      phenology: await this.monitorCropPhenology(farmId),
      soilHealth: await this.monitorSoilHealthIndicators(farmId)
    };
    
    // Generate alerts
    const alerts = [];
    
    if (indicators.temperature.anomaly > 2) {
      alerts.push({
        type: 'temperature_anomaly',
        severity: 'high',
        message: `Temperature ${indicators.temperature.anomaly}°C above normal`,
        recommendations: await this.getTemperatureAdaptations(indicators.temperature)
      });
    }
    
    if (indicators.precipitation.deficit > 30) {
      alerts.push({
        type: 'precipitation_deficit',
        severity: 'high',
        message: `Rainfall ${indicators.precipitation.deficit}% below normal`,
        recommendations: await this.getDroughtPreparedness(indicators.precipitation)
      });
    }
    
    return {
      indicators,
      alerts,
      trends: this.analyzeIndicatorTrends(indicators),
      projections: await this.projectClimateImpacts(indicators)
    };
  }
}

module.exports = new ClimateResilienceService();
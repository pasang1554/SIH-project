// analytics/advancedAnalytics.js
const tf = require('@tensorflow/tfjs-node');
const { BigQuery } = require('@google-cloud/bigquery');
const moment = require('moment');

class AdvancedAnalytics {
  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });
    this.dataset = this.bigquery.dataset('agriculture_analytics');
  }

  async generateComprehensiveReport(farmerId, dateRange) {
    const report = {
      summary: await this.generateSummary(farmerId, dateRange),
      yieldAnalysis: await this.analyzeYieldTrends(farmerId, dateRange),
      costBenefitAnalysis: await this.performCostBenefitAnalysis(farmerId, dateRange),
      weatherImpact: await this.analyzeWeatherImpact(farmerId, dateRange),
      marketAnalysis: await this.analyzeMarketPerformance(farmerId, dateRange),
      sustainabilityMetrics: await this.calculateSustainabilityScore(farmerId),
      recommendations: await this.generateStrategicRecommendations(farmerId),
      predictions: await this.generatePredictions(farmerId)
    };
    
    return report;
  }

  async analyzeYieldTrends(farmerId, dateRange) {
    const query = `
      SELECT 
        DATE_TRUNC(harvest_date, MONTH) as month,
        crop_type,
        AVG(yield_per_hectare) as avg_yield,
        MAX(yield_per_hectare) as max_yield,
        MIN(yield_per_hectare) as min_yield,
        STDDEV(yield_per_hectare) as yield_variance,
        COUNT(*) as harvest_count
      FROM \`${this.dataset.id}.harvest_data\`
      WHERE farmer_id = @farmerId
        AND harvest_date BETWEEN @startDate AND @endDate
      GROUP BY month, crop_type
      ORDER BY month DESC
    `;
    
    const options = {
      query,
      params: {
        farmerId,
        startDate: dateRange.start,
        endDate: dateRange.end
      }
    };
    
    const [rows] = await this.bigquery.query(options);
    
    // Perform trend analysis
    const trends = this.analyzeTrends(rows);
    
    // Generate yield predictions
    const predictions = await this.predictYield(rows);
    
    return {
      historicalData: rows,
      trends,
      predictions,
      insights: this.generateYieldInsights(rows, trends)
    };
  }

  async performCostBenefitAnalysis(farmerId, dateRange) {
    // Fetch cost data
    const costs = await this.getCostData(farmerId, dateRange);
    const revenues = await this.getRevenueData(farmerId, dateRange);
    
    // Calculate metrics
    const totalCosts = costs.reduce((sum, cost) => sum + cost.amount, 0);
    const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);
    const netProfit = totalRevenue - totalCosts;
    const roi = ((netProfit / totalCosts) * 100).toFixed(2);
    
    // Breakdown by category
    const costBreakdown = this.categorizeExpenses(costs);
    const revenueBreakdown = this.categorizeRevenue(revenues);
    
    // Efficiency metrics
    const efficiencyMetrics = await this.calculateEfficiencyMetrics(farmerId, {
      costs,
      revenues,
      dateRange
    });
    
    return {
      summary: {
        totalCosts,
        totalRevenue,
        netProfit,
        roi: `${roi}%`,
        profitMargin: `${((netProfit / totalRevenue) * 100).toFixed(2)}%`
      },
      costBreakdown,
      revenueBreakdown,
      efficiencyMetrics,
      recommendations: this.generateFinancialRecommendations({
        costs,
        revenues,
        efficiencyMetrics
      })
    };
  }

  async analyzeWeatherImpact(farmerId, dateRange) {
    const farms = await Farm.find({ farmer: farmerId });
    const weatherData = [];
    const yieldData = [];
    
    for (const farm of farms) {
      const weather = await WeatherData.find({
        location: {
          $near: {
            $geometry: farm.location,
            $maxDistance: 5000 // 5km radius
          }
        },
        date: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      });
      
      const yields = await Yield.find({
        farm: farm._id,
        date: {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      });
      
      weatherData.push(...weather);
      yieldData.push(...yields);
    }
    
    // Correlation analysis
    const correlations = this.calculateWeatherYieldCorrelation(weatherData, yieldData);
    
    // Impact assessment
    const impacts = {
      rainfall: this.assessRainfallImpact(weatherData, yieldData),
      temperature: this.assessTemperatureImpact(weatherData, yieldData),
      extremeEvents: this.identifyExtremeWeatherEvents(weatherData)
    };
    
    return {
      correlations,
      impacts,
      riskAssessment: this.assessWeatherRisks(weatherData),
      adaptationStrategies: this.recommendAdaptationStrategies(impacts)
    };
  }

  async generateStrategicRecommendations(farmerId) {
    const farmer = await Farmer.findById(farmerId).populate('farms');
    const historicalData = await this.getHistoricalData(farmerId);
    
    const recommendations = [];
    
    // Crop diversification analysis
    const cropDiversity = this.analyzeCropDiversity(historicalData);
    if (cropDiversity.score < 0.5) {
      recommendations.push({
        type: 'strategic',
        priority: 'high',
        category: 'crop_diversification',
        title: 'Increase Crop Diversity',
        description: 'Your farm shows low crop diversity. Consider adding these crops for better risk management:',
        suggestions: await this.suggestCrops(farmer.farms[0].location, historicalData),
        potentialImpact: {
                    riskReduction: '35%',
          incomeStability: '+25%',
          soilHealth: 'Improved'
        }
      });
    }
    
    // Market timing optimization
    const marketAnalysis = await this.analyzeMarketTiming(historicalData);
    if (marketAnalysis.suboptimalSales > 30) {
      recommendations.push({
        type: 'strategic',
        priority: 'high',
        category: 'market_timing',
        title: 'Optimize Market Timing',
        description: 'Analysis shows you could improve profits by timing your sales better',
        suggestions: marketAnalysis.optimalTimings,
        potentialImpact: {
          revenueIncrease: `${marketAnalysis.potentialGain}%`,
          implementation: 'Use cold storage or staggered harvesting'
        }
      });
    }
    
    // Technology adoption
    const techScore = await this.assessTechnologyAdoption(farmerId);
    if (techScore < 0.6) {
      recommendations.push({
        type: 'strategic',
        priority: 'medium',
        category: 'technology',
        title: 'Adopt Precision Agriculture Technologies',
        description: 'Implementing modern farming technologies can significantly improve yields',
        suggestions: [
          {
            technology: 'Drip Irrigation',
            cost: '₹50,000 per hectare',
            roi: '2 years',
            benefits: 'Water savings: 40%, Yield increase: 20%'
          },
          {
            technology: 'Soil Sensors',
            cost: '₹15,000 per unit',
            roi: '1 season',
            benefits: 'Fertilizer optimization: 30% reduction'
          }
        ]
      });
    }
    
    return recommendations;
  }

  async generatePredictions(farmerId) {
    const historicalData = await this.getHistoricalData(farmerId);
    
    // Load pre-trained models
    const yieldModel = await tf.loadLayersModel('file://./models/yield_prediction/model.json');
    const priceModel = await tf.loadLayersModel('file://./models/price_prediction/model.json');
    
    // Prepare features
    const features = this.prepareFeatures(historicalData);
    
    // Make predictions
    const yieldPredictions = await this.predictWithModel(yieldModel, features.yield);
    const pricePredictions = await this.predictWithModel(priceModel, features.price);
    
    // Generate scenarios
    const scenarios = {
      optimistic: this.generateScenario(yieldPredictions, pricePredictions, 1.2),
      realistic: this.generateScenario(yieldPredictions, pricePredictions, 1.0),
      pessimistic: this.generateScenario(yieldPredictions, pricePredictions, 0.8)
    };
    
    return {
      yield: {
        nextSeason: yieldPredictions.nextSeason,
        confidence: yieldPredictions.confidence,
        factors: yieldPredictions.influencingFactors
      },
      price: {
        forecast: pricePredictions.forecast,
        volatility: pricePredictions.volatility,
        bestSellingWindow: pricePredictions.optimalWindow
      },
      scenarios,
      recommendations: this.generatePredictiveRecommendations(scenarios)
    };
  }

  calculateWeatherYieldCorrelation(weatherData, yieldData) {
    // Group data by time periods
    const periods = this.groupByPeriods(weatherData, yieldData);
    
    const correlations = {
      rainfall: this.pearsonCorrelation(
        periods.map(p => p.avgRainfall),
        periods.map(p => p.avgYield)
      ),
      temperature: this.pearsonCorrelation(
        periods.map(p => p.avgTemperature),
        periods.map(p => p.avgYield)
      ),
      humidity: this.pearsonCorrelation(
        periods.map(p => p.avgHumidity),
        periods.map(p => p.avgYield)
      )
    };
    
    return {
      correlations,
      interpretation: this.interpretCorrelations(correlations),
      criticalThresholds: this.identifyCriticalThresholds(periods)
    };
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return {
      value: correlation,
      strength: Math.abs(correlation) > 0.7 ? 'strong' : 
                Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
      direction: correlation > 0 ? 'positive' : 'negative'
    };
  }
}

module.exports = new AdvancedAnalytics();
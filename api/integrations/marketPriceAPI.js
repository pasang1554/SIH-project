// api/integrations/marketPriceAPI.js
const axios = require('axios');
const cron = require('node-cron');
const MarketPrice = require('../models/MarketPrice');

class MarketPriceService {
  constructor() {
    this.sources = [
      {
        name: 'AGMARKNET',
        url: process.env.AGMARKNET_API_URL,
        parser: this.parseAgmarknetData
      },
      {
        name: 'NCDEX',
        url: process.env.NCDEX_API_URL,
        parser: this.parseNCDEXData
      }
    ];
    
    this.setupScheduledFetch();
  }

  setupScheduledFetch() {
    // Fetch prices every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.fetchAllMarketPrices();
    });
  }

  async fetchAllMarketPrices() {
    for (const source of this.sources) {
      try {
        const data = await this.fetchFromSource(source);
        await this.processMarketData(data, source.name);
      } catch (error) {
        console.error(`Failed to fetch from ${source.name}:`, error);
      }
    }
  }

  async fetchFromSource(source) {
    const response = await axios.get(source.url, {
      headers: {
        'Authorization': `Bearer ${process.env[`${source.name}_API_KEY`]}`
      }
    });
    
    return source.parser(response.data);
  }

  async processMarketData(data, source) {
    for (const item of data) {
      await MarketPrice.findOneAndUpdate(
        {
          commodity: item.commodity,
          market: item.market,
          date: item.date
        },
        {
          ...item,
          source,
          updatedAt: new Date()
        },
        { upsert: true }
      );
    }
    
    // Analyze price trends
    await this.analyzePriceTrends();
  }

  async analyzePriceTrends() {
    const commodities = await MarketPrice.distinct('commodity');
    
    for (const commodity of commodities) {
      const prices = await MarketPrice.find({ commodity })
        .sort({ date: -1 })
        .limit(30);
      
      if (prices.length < 7) continue;
      
      const trend = this.calculateTrend(prices);
      const prediction = await this.predictPrice(commodity, prices);
      
      // Send alerts if significant changes
      if (Math.abs(trend.changePercent) > 10) {
        await this.sendPriceAlert(commodity, trend, prediction);
      }
    }
  }

  calculateTrend(prices) {
    const recent = prices.slice(0, 7);
    const previous = prices.slice(7, 14);
    
    const recentAvg = recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
    const previousAvg = previous.reduce((sum, p) => sum + p.price, 0) / previous.length;
    
    const change = recentAvg - previousAvg;
    const changePercent = (change / previousAvg) * 100;
    
    return {
      current: recentAvg,
      change,
      changePercent,
      trend: change > 0 ? 'increasing' : 'decreasing'
    };
  }

  async predictPrice(commodity, historicalPrices) {
    // Simple linear regression for price prediction
    const x = historicalPrices.map((_, i) => i);
    const y = historicalPrices.map(p => p.price);
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Predict next 7 days
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const predictedPrice = slope * (n + i) + intercept;
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        price: Math.max(0, predictedPrice) // Ensure non-negative
      });
    }
    
    return predictions;
  }

  async getMarketRecommendation(farmerId, commodity) {
    const farmer = await Farmer.findById(farmerId).populate('location');
    const nearbyMarkets = await this.findNearbyMarkets(farmer.location, 50); // 50km radius
    
    const prices = await MarketPrice.find({
      commodity,
      market: { $in: nearbyMarkets.map(m => m.name) },
      date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Find best market
    const marketAnalysis = this.analyzeMarkets(prices, nearbyMarkets);
    
    return {
      bestMarket: marketAnalysis.best,
      averagePrice: marketAnalysis.average,
      priceRange: marketAnalysis.range,
      recommendation: this.generateMarketRecommendation(marketAnalysis),
      forecast: await this.predictPrice(commodity, prices)
    };
  }
}

module.exports = new MarketPriceService();
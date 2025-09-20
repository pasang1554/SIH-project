// monitoring/metricsCollector.js
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Define metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const activeUsers = new prometheus.Gauge({
  name: 'active_users_total',
  help: 'Total number of active users',
  labelNames: ['user_type']
});

const recommendationsGenerated = new prometheus.Counter({
  name: 'recommendations_generated_total',
  help: 'Total number of recommendations generated',
  labelNames: ['type', 'priority']
});

const mlInferenceTime = new prometheus.Histogram({
  name: 'ml_inference_duration_seconds',
  help: 'ML model inference time',
  labelNames: ['model_name'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5]
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(activeUsers);
register.registerMetric(recommendationsGenerated);
register.registerMetric(mlInferenceTime);

// Middleware for Express
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
};

// Analytics Dashboard Component
class AnalyticsDashboard {
  constructor() {
    this.setupRealtimeAnalytics();
  }

  async collectUserMetrics() {
    const metrics = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 },
          activeLastWeek: {
            $sum: {
              $cond: [
                { $gte: ['$lastActive', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    metrics.forEach(metric => {
      activeUsers.labels(metric._id).set(metric.activeLastWeek);
    });
  }

  async trackRecommendationMetrics() {
    const recommendations = await Recommendation.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { type: '$type', priority: '$priority' },
          count: { $sum: 1 }
        }
      }
    ]);

    recommendations.forEach(rec => {
      recommendationsGenerated
        .labels(rec._id.type, rec._id.priority)
        .inc(rec.count);
    });
  }

  setupRealtimeAnalytics() {
    // Collect metrics every minute
    setInterval(() => {
      this.collectUserMetrics();
      this.trackRecommendationMetrics();
    }, 60000);
  }

  async generateAnalyticsReport() {
    const report = {
      userEngagement: await this.getUserEngagementMetrics(),
      platformPerformance: await this.getPlatformPerformanceMetrics(),
      agriculturalImpact: await this.getAgriculturalImpactMetrics(),
      financialMetrics: await this.getFinancialMetrics()
    };

    return report;
  }

  async getUserEngagementMetrics() {
    const [
      totalUsers,
      activeUsers,
      avgSessionDuration,
      featureUsage
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Session.aggregate([
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      this.getFeatureUsageStats()
    ]);

    return {
      totalUsers,
      monthlyActiveUsers: activeUsers,
      avgSessionMinutes: avgSessionDuration[0]?.avgDuration / 60000 || 0,
      featureUsage
    };
  }

  async getAgriculturalImpactMetrics() {
    const farms = await Farm.aggregate([
      {
        $lookup: {
          from: 'yields',
          localField: '_id',
          foreignField: 'farm',
          as: 'yields'
        }
      },
      {
        $project: {
          area: 1,
          beforePlatform: { $arrayElemAt: ['$yields', 0] },
          afterPlatform: { $arrayElemAt: ['$yields', -1] }
        }
      }
    ]);

    const yieldImprovement = farms.reduce((acc, farm) => {
      if (farm.beforePlatform && farm.afterPlatform) {
        const improvement = ((farm.afterPlatform.yield - farm.beforePlatform.yield) / farm.beforePlatform.yield) * 100;
        return acc + improvement;
      }
      return acc;
    }, 0) / farms.length;

    return {
      totalFarmsImpacted: farms.length,
      avgYieldImprovement: `${yieldImprovement.toFixed(1)}%`,
      totalAreaCovered: farms.reduce((acc, f) => acc + f.area, 0),
      sustainabilityScore: await this.calculateSustainabilityScore()
    };
  }
}

module.exports = {
  metricsMiddleware,
  register,
  AnalyticsDashboard
};
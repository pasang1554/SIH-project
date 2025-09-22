// system/performanceOptimizer.js
const cluster = require('cluster');
const os = require('os');
const compression = require('compression');
const NodeCache = require('node-cache');

class SystemOptimizer {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 600 }); // 10 minutes default
    this.initializeOptimizations();
  }

  initializeOptimizations() {
    if (cluster.isMaster) {
      this.setupMasterProcess();
    } else {
      this.setupWorkerProcess();
    }
  }

  setupMasterProcess() {
    const numCPUs = os.cpus().length;
    
    console.log(`Master ${process.pid} setting up ${numCPUs} workers`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    
    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
      cluster.fork(); // Restart worker
    });
    
    // Load balancing
    this.setupLoadBalancing();
    
    // Memory monitoring
    this.monitorSystemResources();
  }

  setupWorkerProcess() {
    const app = require('../app');
    
    // Apply optimizations
    app.use(compression());
    app.use(this.cacheMiddleware.bind(this));
    app.use(this.rateLimitMiddleware.bind(this));
    
    // Database connection pooling
    this.optimizeDatabaseConnections();
    
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Worker ${process.pid} started on port ${PORT}`);
    });
  }

  cacheMiddleware(req, res, next) {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') return next();
    
    const key = `cache_${req.originalUrl}`;
    const cachedResponse = this.cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method
    res.json = (body) => {
      // Cache successful responses
      if (res.statusCode === 200) {
        this.cache.set(key, body);
      }
      
      // Call original json method
      originalJson.call(res, body);
    };
    
    next();
  }

  async optimizeDatabaseConnections() {
    const mongoose = require('mongoose');
    
    // Connection pool settings
    mongoose.set('poolSize', 10);
    mongoose.set('bufferMaxEntries', 0);
    mongoose.set('useCreateIndex', true);
    
    // Add connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected with optimized pool');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
  }

  monitorSystemResources() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = {
        memory: {
          rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
          heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
          heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
          external: (usage.external / 1024 / 1024).toFixed(2) + ' MB'
        },
        cpu: {
          user: (cpuUsage.user / 1000000).toFixed(2) + ' seconds',
          system: (cpuUsage.system / 1000000).toFixed(2) + ' seconds'
        },
        uptime: process.uptime() + ' seconds'
      };
      
      // Log metrics
      console.log('System Metrics:', metrics);
      
      // Check for memory leaks
      if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
        console.warn('High memory usage detected');
        this.performGarbageCollection();
      }
    }, 60000); // Every minute
  }

  performGarbageCollection() {
    if (global.gc) {
      global.gc();
      console.log('Manual garbage collection performed');
    }
  }

  async optimizeQueries() {
    // Index optimization
    const indexes = {
      farmers: [
        { phoneNumber: 1 },
        { location: '2dsphere' },
        { 'farms.location': '2dsphere' }
      ],
      recommendations: [
        { farmerId: 1, createdAt: -1 },
        { priority: -1, delivered: 1 }
      ],
      weatherData: [
        { location: '2dsphere', date: -1 }
      ],
      iotReadings: [
        { deviceId: 1, timestamp: -1 },
        { farmId: 1, timestamp: -1 }
      ]
    };
    
    for (const [collection, collectionIndexes] of Object.entries(indexes)) {
      const model = mongoose.model(collection);
      for (const index of collectionIndexes) {
        await model.createIndexes([index]);
      }
    }
    
    console.log('Database indexes optimized');
  }

  setupLoadBalancing() {
    const workers = [];
    
    for (const id in cluster.workers) {
      workers.push(cluster.workers[id]);
    }
    
    let currentWorker = 0;
    
    // Round-robin load balancing
    this.getNextWorker = () => {
      const worker = workers[currentWorker];
      currentWorker = (currentWorker + 1) % workers.length;
      return worker;
    };
        // Implement sticky sessions for WebSocket connections
    this.setupStickySession();
  }

  setupStickySession() {
    const net = require('net');
    const farmhash = require('farmhash');
    
    if (cluster.isMaster) {
      const server = net.createServer({ pauseOnConnect: true }, (connection) => {
        // Extract IP for sticky session
        const ip = connection.remoteAddress;
        const workerIndex = farmhash.hash32(ip) % Object.keys(cluster.workers).length;
        const worker = Object.values(cluster.workers)[workerIndex];
        
        worker.send('sticky-session:connection', connection);
      });
      
      server.listen(process.env.PORT || 5000);
    }
  }

  async performHealthCheck() {
    const checks = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      storage: await this.checkStorageHealth(),
      apis: await this.checkExternalAPIs(),
      memory: this.checkMemoryHealth(),
      cpu: this.checkCPUHealth()
    };
    
    const overall = Object.values(checks).every(check => check.status === 'healthy');
    
    return {
      status: overall ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date()
    };
  }

  async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - start;
      
      return {
        status: latency < 100 ? 'healthy' : 'slow',
        latency: `${latency}ms`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  optimizeImageDelivery() {
    const sharp = require('sharp');
    
    return async (req, res, next) => {
      if (!req.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
        return next();
      }
      
      const width = parseInt(req.query.w) || null;
      const height = parseInt(req.query.h) || null;
      const quality = parseInt(req.query.q) || 85;
      const format = req.query.f || 'webp';
      
      try {
        const imagePath = path.join(__dirname, '../public', req.url);
        
        let transform = sharp(imagePath);
        
        if (width || height) {
          transform = transform.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
          });
        }
        
        transform = transform[format]({ quality });
        
        const buffer = await transform.toBuffer();
        
        res.set('Content-Type', `image/${format}`);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
      } catch (error) {
        next();
      }
    };
  }
}

// Initialize system optimizer
const optimizer = new SystemOptimizer();

// Export optimization middleware
module.exports = {
  optimizer,
  cacheMiddleware: optimizer.cacheMiddleware.bind(optimizer),
  imageOptimizer: optimizer.optimizeImageDelivery(),
  healthCheck: optimizer.performHealthCheck.bind(optimizer)
};
  
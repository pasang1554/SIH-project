// iot/deviceManager.js
const mqtt = require('mqtt');
const { EventEmitter } = require('events');
const crypto = require('crypto');

class IoTDeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();
    this.edgeNodes = new Map();
    this.initializeMQTT();
    this.setupEdgeComputing();
  }

  initializeMQTT() {
    this.mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL, {
      clientId: 'device-manager-' + crypto.randomBytes(8).toString('hex'),
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD
    });

    this.mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.subscribeToTopics();
    });

    this.mqttClient.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  subscribeToTopics() {
    const topics = [
      'devices/+/register',
      'devices/+/data',
      'devices/+/status',
      'devices/+/config',
      'edge/+/compute',
      'edge/+/sync'
    ];

    topics.forEach(topic => {
      this.mqttClient.subscribe(topic, (err) => {
        if (err) console.error(`Failed to subscribe to ${topic}:`, err);
      });
    });
  }

  async registerDevice(deviceData) {
    const device = {
      id: deviceData.id || crypto.randomBytes(16).toString('hex'),
      type: deviceData.type,
      farmId: deviceData.farmId,
      location: deviceData.location,
      sensors: deviceData.sensors,
      firmware: deviceData.firmware,
      status: 'active',
      lastSeen: new Date(),
      config: await this.generateDeviceConfig(deviceData),
      calibration: deviceData.calibration || {}
    };

    // Store device
    await IoTDevice.create(device);
    this.devices.set(device.id, device);

    // Send configuration
    this.mqttClient.publish(
      `devices/${device.id}/config`,
      JSON.stringify(device.config)
    );

    // Setup monitoring
    this.monitorDevice(device.id);

    return device;
  }

  async generateDeviceConfig(deviceData) {
    const farm = await Farm.findById(deviceData.farmId);
    
    return {
      samplingInterval: this.calculateOptimalSamplingInterval(deviceData),
      thresholds: await this.getThresholds(farm, deviceData.type),
      edgeProcessing: {
        enabled: true,
        algorithms: this.getEdgeAlgorithms(deviceData.type)
      },
      powerManagement: {
        mode: 'adaptive',
        sleepSchedule: this.generateSleepSchedule(farm.location)
      },
      connectivity: {
        primary: 'mqtt',
        fallback: 'lorawan',
        compression: true
      }
    };
  }

  calculateOptimalSamplingInterval(deviceData) {
    const intervals = {
      soil_moisture: 3600, // 1 hour
      weather_station: 900, // 15 minutes
      pest_trap: 7200, // 2 hours
      water_level: 1800, // 30 minutes
      crop_camera: 21600 // 6 hours
    };

    return intervals[deviceData.type] || 3600;
  }

  setupEdgeComputing() {
    // Edge computing algorithms
    this.edgeAlgorithms = {
      anomaly_detection: (data, history) => {
        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const stdDev = Math.sqrt(
          history.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / history.length
        );
        
        return Math.abs(data - mean) > 2 * stdDev;
      },
      
      trend_analysis: (data, history) => {
        if (history.length < 5) return null;
        
        const recent = history.slice(-5);
        const trend = recent.reduce((acc, val, i) => {
          if (i === 0) return 0;
          return acc + (val - recent[i - 1]);
        }, 0) / (recent.length - 1);
        
        return {
          direction: trend > 0 ? 'increasing' : 'decreasing',
          rate: Math.abs(trend)
        };
      },
      
      data_aggregation: (readings) => {
        return {
          min: Math.min(...readings),
          max: Math.max(...readings),
          avg: readings.reduce((a, b) => a + b, 0) / readings.length,
          count: readings.length
        };
      }
    };
  }

  async handleMessage(topic, message) {
    const [, deviceId, action] = topic.split('/');
    const data = JSON.parse(message.toString());

    switch (action) {
      case 'register':
        await this.registerDevice({ ...data, id: deviceId });
        break;
        
      case 'data':
        await this.processDeviceData(deviceId, data);
        break;
        
      case 'status':
        await this.updateDeviceStatus(deviceId, data);
        break;
        
      case 'compute':
        await this.handleEdgeComputation(deviceId, data);
        break;
    }
  }

  async processDeviceData(deviceId, data) {
    const device = this.devices.get(deviceId);
    if (!device) return;

    // Update last seen
    device.lastSeen = new Date();

    // Store raw data
    const reading = await IoTReading.create({
      deviceId,
      timestamp: new Date(data.timestamp),
      data: data.readings,
      metadata: data.metadata
    });

    // Edge processing
    const processed = await this.performEdgeProcessing(device, data);

    // Check for alerts
    const alerts = await this.checkAlertConditions(device, processed);
    
    if (alerts.length > 0) {
      await this.handleAlerts(device, alerts);
    }

    // Update aggregates
    await this.updateAggregates(device, processed);

    // Emit for real-time dashboard
    this.emit('device-data', {
      deviceId,
      data: processed,
      alerts
    });
  }

  async performEdgeProcessing(device, rawData) {
    const processed = { ...rawData };
    
    // Get historical data for context
    const history = await this.getDeviceHistory(device.id, 24); // 24 hours

    // Apply edge algorithms
    for (const [sensor, value] of Object.entries(rawData.readings)) {
      const sensorHistory = history.map(h => h.data[sensor]).filter(v => v !== undefined);
      
      processed.analysis = processed.analysis || {};
      processed.analysis[sensor] = {
        anomaly: this.edgeAlgorithms.anomaly_detection(value, sensorHistory),
        trend: this.edgeAlgorithms.trend_analysis(value, sensorHistory),
        aggregates: this.edgeAlgorithms.data_aggregation([...sensorHistory, value])
      };
    }

    return processed;
  }

  async checkAlertConditions(device, data) {
    const alerts = [];
    const farm = await Farm.findById(device.farmId);
    const thresholds = await this.getThresholds(farm, device.type);

    for (const [sensor, value] of Object.entries(data.readings)) {
      const threshold = thresholds[sensor];
      if (!threshold) continue;

      if (value < threshold.min) {
        alerts.push({
          type: 'threshold_breach',
          severity: 'high',
          sensor,
          value,
          threshold: threshold.min,
          direction: 'below',
          message: `${sensor} is critically low: ${value} (minimum: ${threshold.min})`
        });
      } else if (value > threshold.max) {
        alerts.push({
          type: 'threshold_breach',
          severity: 'high',
          sensor,
          value,
          threshold: threshold.max,
          direction: 'above',
          message: `${sensor} is critically high: ${value} (maximum: ${threshold.max})`
        });
      }

      // Check for anomalies
      if (data.analysis && data.analysis[sensor]?.anomaly) {
        alerts.push({
          type: 'anomaly',
          severity: 'medium',
          sensor,
          value,
          message: `Unusual ${sensor} reading detected: ${value}`
        });
      }
    }

    return alerts;
  }

  async handleAlerts(device, alerts) {
    const farm = await Farm.findById(device.farmId).populate('farmer');
    
    for (const alert of alerts) {
      // Store alert
      await Alert.create({
        deviceId: device.id,
        farmId: device.farmId,
        ...alert,
        timestamp: new Date()
      });

      // Send notifications based on severity
      if (alert.severity === 'high') {
        await notificationService.sendNotification(
          farm.farmer._id,
          {
            title: 'Critical Alert from Your Farm',
            body: alert.message,
            data: {
              type: 'iot_alert',
              deviceId: device.id,
              alert
            }
          },
          {
            channels: ['push', 'sms'],
            priority: 'high'
          }
        );
      }

      // Trigger automated responses
      await this.triggerAutomatedResponse(device, alert);
    }
  }

  async triggerAutomatedResponse(device, alert) {
    const automations = await Automation.find({
      farmId: device.farmId,
      trigger: {
        type: 'iot_alert',
        conditions: {
          sensor: alert.sensor,
          severity: alert.severity
        }
      },
      enabled: true
    });

    for (const automation of automations) {
      await this.executeAutomation(automation, { device, alert });
    }
  }

  async performDeviceMaintenance() {
    // Check all devices
    for (const [deviceId, device] of this.devices) {
      const lastSeenMinutes = (Date.now() - device.lastSeen) / 60000;
      
      // Mark offline if not seen for 30 minutes
      if (lastSeenMinutes > 30 && device.status === 'active') {
        device.status = 'offline';
        await IoTDevice.findByIdAndUpdate(deviceId, { status: 'offline' });
        
        // Notify farmer
        const farm = await Farm.findById(device.farmId).populate('farmer');
        await notificationService.sendNotification(
          farm.farmer._id,
          {
            title: 'Device Offline',
            body: `Your ${device.type} sensor has gone offline`,
            data: { type: 'device_offline', deviceId }
          }
        );
      }
      
      // Check battery levels
      if (device.battery && device.battery < 20) {
        await this.sendBatteryAlert(device);
      }
      
      // Check for firmware updates
      await this.checkFirmwareUpdates(device);
    }
  }

  async generateDeviceReport(farmId, period = 'week') {
    const devices = await IoTDevice.find({ farmId });
    const report = {
      summary: {
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.status === 'active').length,
        alerts: 0,
        dataPoints: 0
      },
      devices: [],
      insights: []
    };

    for (const device of devices) {
      const deviceReport = await this.analyzeDevicePerformance(device, period);
      report.devices.push(deviceReport);
      report.summary.alerts += deviceReport.alertCount;
      report.summary.dataPoints += deviceReport.dataPoints;
          }

    // Generate insights
    report.insights = await this.generateIoTInsights(report.devices, farmId);
    
    return report;
  }

  async analyzeDevicePerformance(device, period) {
    const startDate = this.getStartDate(period);
    
    const readings = await IoTReading.find({
      deviceId: device._id,
      timestamp: { $gte: startDate }
    });
    
    const alerts = await Alert.find({
      deviceId: device._id,
      timestamp: { $gte: startDate }
    });
    
    // Calculate uptime
    const totalMinutes = (Date.now() - startDate) / 60000;
    const offlineEvents = await DeviceEvent.find({
      deviceId: device._id,
      type: 'offline',
      timestamp: { $gte: startDate }
    });
    
    const downtime = offlineEvents.reduce((total, event) => {
      const duration = event.duration || 30; // default 30 minutes
      return total + duration;
    }, 0);
    
    const uptime = ((totalMinutes - downtime) / totalMinutes) * 100;
    
    return {
      deviceId: device._id,
      type: device.type,
      status: device.status,
      uptime: `${uptime.toFixed(1)}%`,
      dataPoints: readings.length,
      alertCount: alerts.length,
      batteryLevel: device.battery || 100,
      lastMaintenance: device.lastMaintenance,
      performance: {
        dataQuality: this.assessDataQuality(readings),
        reliability: uptime > 95 ? 'excellent' : uptime > 85 ? 'good' : 'needs attention',
        alerts: this.categorizeAlerts(alerts)
      }
    };
  }

  async generateIoTInsights(deviceReports, farmId) {
    const insights = [];
    
    // Device reliability insight
    const avgUptime = deviceReports.reduce((sum, d) => 
      sum + parseFloat(d.uptime), 0) / deviceReports.length;
    
    if (avgUptime < 90) {
      insights.push({
        type: 'reliability',
        priority: 'high',
        message: `Average device uptime is ${avgUptime.toFixed(1)}%. Consider checking network connectivity.`,
        action: 'Review device placement and network coverage'
      });
    }
    
    // Alert patterns
    const totalAlerts = deviceReports.reduce((sum, d) => sum + d.alertCount, 0);
    if (totalAlerts > deviceReports.length * 10) {
      insights.push({
        type: 'alerts',
        priority: 'medium',
        message: 'High number of alerts detected. Review threshold settings.',
        action: 'Calibrate sensors and adjust alert thresholds'
      });
    }
    
    // Maintenance recommendations
    const maintenanceNeeded = deviceReports.filter(d => {
      const lastMaintenance = new Date(d.lastMaintenance);
      const daysSince = (Date.now() - lastMaintenance) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    });
    
    if (maintenanceNeeded.length > 0) {
      insights.push({
        type: 'maintenance',
        priority: 'medium',
        message: `${maintenanceNeeded.length} devices need maintenance`,
        action: 'Schedule device maintenance',
        devices: maintenanceNeeded.map(d => d.deviceId)
      });
    }
    
    return insights;
  }
}

module.exports = new IoTDeviceManager();
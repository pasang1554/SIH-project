// services/notificationService.js
const admin = require('firebase-admin');
const WebSocket = require('ws');
const EventEmitter = require('events');
const Bull = require('bull');
const twilio = require('twilio');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.initializeFirebase();
    this.initializeWebSocket();
    this.initializeQueues();
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  initializeFirebase() {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  }

  initializeWebSocket() {
    this.wss = new WebSocket.Server({ port: process.env.WS_PORT || 8080 });
    
    this.wss.on('connection', (ws, req) => {
      const userId = this.getUserIdFromRequest(req);
      
      ws.userId = userId;
      ws.isAlive = true;
      
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      ws.on('message', (message) => {
        this.handleWebSocketMessage(ws, message);
      });
      
      ws.on('close', () => {
        console.log(`WebSocket closed for user: ${userId}`);
      });
    });
    
    // Heartbeat to keep connections alive
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  initializeQueues() {
    this.notificationQueue = new Bull('notifications', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }
    });
    
    this.priorityQueue = new Bull('priority-notifications', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }
    });
    
    // Process notifications
    this.notificationQueue.process(async (job) => {
      return this.processNotification(job.data);
    });
    
    this.priorityQueue.process(async (job) => {
      return this.processNotification(job.data, true);
    });
  }

  async sendNotification(userId, notification, options = {}) {
    const user = await User.findById(userId);
    if (!user) return;
    
    const notificationData = {
      userId,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      timestamp: new Date(),
      priority: options.priority || 'normal',
      channels: options.channels || ['push', 'inApp']
    };
    
    // Add to appropriate queue
    if (options.priority === 'high' || options.immediate) {
      await this.priorityQueue.add(notificationData);
    } else {
      await this.notificationQueue.add(notificationData, {
        delay: options.delay || 0
      });
    }
    
    // Store notification in database
    await Notification.create({
      ...notificationData,
      read: false,
      delivered: false
    });
  }

  async processNotification(notificationData, isPriority = false) {
    const { userId, channels } = notificationData;
    const results = {};
    
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'push':
            results.push = await this.sendPushNotification(userId, notificationData);
            break;
          case 'sms':
            results.sms = await this.sendSMSNotification(userId, notificationData);
            break;
          case 'whatsapp':
            results.whatsapp = await this.sendWhatsAppNotification(userId, notificationData);
            break;
          case 'inApp':
            results.inApp = await this.sendInAppNotification(userId, notificationData);
            break;
          case 'voice':
            results.voice = await this.sendVoiceCall(userId, notificationData);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${channel} notification:`, error);
        results[channel] = { success: false, error: error.message };
      }
    }
    
    // Update delivery status
    await Notification.findByIdAndUpdate(notificationData._id, {
      delivered: true,
      deliveryResults: results,
      deliveredAt: new Date()
    });
    
    return results;
  }

  async sendPushNotification(userId, notification) {
    const user = await User.findById(userId);
    if (!user.fcmToken) {
      throw new Error('No FCM token found');
    }
    
    const message = {
      token: user.fcmToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data,
      android: {
        priority: notification.priority === 'high' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };
    
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  }

  async sendInAppNotification(userId, notification) {
    // Send via WebSocket if user is connected
    const userSocket = Array.from(this.wss.clients).find(ws => ws.userId === userId);
    
    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
      userSocket.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
      return { success: true, method: 'websocket' };
    }
    
    // Otherwise, they'll get it when they next connect
    return { success: true, method: 'queued' };
  }

  async sendSMSNotification(userId, notification) {
    const user = await User.findById(userId);
    if (!user.phoneNumber) {
      throw new Error('No phone number found');
    }
    
    const message = await this.twilioClient.messages.create({
      body: `${notification.title}\n${notification.body}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phoneNumber
    });
    
    return { success: true, messageId: message.sid };
  }

  async sendVoiceCall(userId, notification) {
    const user = await User.findById(userId);
    if (!user.phoneNumber) {
      throw new Error('No phone number found');
    }
    
    // Generate TTS audio for the notification
    const audioUrl = await translationService.generateVoiceContent(
      `${notification.title}. ${notification.body}`,
      user.language
    );
    
    const call = await this.twilioClient.calls.create({
      url: `${process.env.API_URL}/voice/play?audio=${encodeURIComponent(audioUrl)}`,
      to: user.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    return { success: true, callId: call.sid };
  }

  // Bulk notification methods
  async sendBulkNotification(filter, notification, options = {}) {
    const users = await User.find(filter).select('_id');
    const userIds = users.map(u => u._id);
    
    const jobs = userIds.map(userId => ({
      userId,
      ...notification,
      channels: options.channels || ['push']
    }));
    
    // Add jobs in batches
    const batchSize = 100;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      await this.notificationQueue.addBulk(
        batch.map(job => ({ data: job }))
      );
    }
    
    return { totalQueued: jobs.length };
  }

  // Emergency broadcast system
  async broadcastEmergency(region, message, channels = ['sms', 'voice', 'push']) {
    const filter = {
      'location.region': region,
      active: true
    };
    
    const notification = {
      title: 'EMERGENCY ALERT',
      body: message,
      data: {
        type: 'emergency',
        region,
        timestamp: new Date()
      }
    };
    
    return this.sendBulkNotification(filter, notification, {
      channels,
      priority: 'high'
    });
  }
}

module.exports = new NotificationService();
// mobile/services/offlineSync.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import SQLite from 'react-native-sqlite-storage';

class OfflineSyncService {
  constructor() {
    this.db = null;
    this.syncQueue = [];
    this.initializeDatabase();
    this.setupNetworkListener();
  }

  async initializeDatabase() {
    this.db = await SQLite.openDatabase({
      name: 'AgriAdvisor.db',
      location: 'default',
    });
    
    await this.createTables();
  }

  async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY,
        farmId TEXT,
        type TEXT,
        content TEXT,
        priority INTEGER,
        createdAt TEXT,
        synced INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS weather_cache (
        id TEXT PRIMARY KEY,
        location TEXT,
        data TEXT,
        timestamp TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS offline_actions (
        id TEXT PRIMARY KEY,
        action TEXT,
        payload TEXT,
        timestamp TEXT,
        synced INTEGER DEFAULT 0
      )`
    ];

    for (const query of queries) {
      await this.db.executeSql(query);
    }
  }

  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.syncOfflineData();
      }
    });
  }

  async saveOfflineAction(action, payload) {
    const id = this.generateId();
    const timestamp = new Date().toISOString();
    
    await this.db.executeSql(
      'INSERT INTO offline_actions (id, action, payload, timestamp) VALUES (?, ?, ?, ?)',
      [id, action, JSON.stringify(payload), timestamp]
    );
    
    this.syncQueue.push({ id, action, payload, timestamp });
  }

  async syncOfflineData() {
    try {
      // Get all unsynced actions
      const [results] = await this.db.executeSql(
        'SELECT * FROM offline_actions WHERE synced = 0 ORDER BY timestamp ASC'
      );
      
      const actions = [];
      for (let i = 0; i < results.rows.length; i++) {
        actions.push(results.rows.item(i));
      }
      
      // Process each action
      for (const action of actions) {
        try {
          await this.processOfflineAction(action);
          
          // Mark as synced
          await this.db.executeSql(
            'UPDATE offline_actions SET synced = 1 WHERE id = ?',
            [action.id]
          );
        } catch (error) {
          console.error('Failed to sync action:', error);
        }
      }
      
      // Sync recommendations and other data
      await this.syncRecommendations();
      await this.syncWeatherData();
      
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  async cacheRecommendations(recommendations) {
    for (const rec of recommendations) {
      await this.db.executeSql(
        `INSERT OR REPLACE INTO recommendations 
         (id, farmId, type, content, priority, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rec.id, rec.farmId, rec.type, JSON.stringify(rec.content), 
         rec.priority, rec.createdAt]
      );
    }
  }

  async getOfflineRecommendations(farmId) {
    const [results] = await this.db.executeSql(
      'SELECT * FROM recommendations WHERE farmId = ? ORDER BY priority DESC, createdAt DESC',
      [farmId]
    );
    
    const recommendations = [];
    for (let i = 0; i < results.rows.length; i++) {
      const item = results.rows.item(i);
            item.content = JSON.parse(item.content);
      recommendations.push(item);
    }
    
    return recommendations;
  }

  async processOfflineAction(action) {
    const payload = JSON.parse(action.payload);
    
    switch (action.action) {
      case 'UPDATE_CROP_STATUS':
        await api.updateCropStatus(payload);
        break;
      case 'LOG_ACTIVITY':
        await api.logFarmActivity(payload);
        break;
      case 'REPORT_ISSUE':
        await api.reportIssue(payload);
        break;
      case 'SAVE_OBSERVATION':
        await api.saveFieldObservation(payload);
        break;
      default:
        console.warn('Unknown offline action:', action.action);
    }
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default new OfflineSyncService();
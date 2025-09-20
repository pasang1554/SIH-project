// services/weatherService.js
const axios = require('axios');
const cron = require('node-cron');
const WeatherData = require('../models/WeatherData');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    this.setupScheduledTasks();
  }

  setupScheduledTasks() {
    // Fetch weather data every 3 hours
    cron.schedule('0 */3 * * *', async () => {
      await this.updateAllFarmWeather();
    });
  }

  async getWeatherForLocation(lat, lon) {
    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric'
        }
      });
      
      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        windSpeed: response.data.wind.speed,
        cloudCover: response.data.clouds.all,
        description: response.data.weather[0].description
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw error;
    }
  }

  async getForecast(lat, lon, days = 5) {
    try {
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric',
          cnt: days * 8 // 8 forecasts per day (3-hour intervals)
        }
      });
      
      return this.processForecastData(response.data.list);
    } catch (error) {
      console.error('Error fetching forecast:', error);
      throw error;
    }
  }

  processForecastData(forecastList) {
    const dailyForecasts = {};
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          date,
          tempMin: item.main.temp_min,
          tempMax: item.main.temp_max,
          humidity: item.main.humidity,
          precipitation: 0,
          conditions: []
        };
      }
      
      dailyForecasts[date].tempMin = Math.min(dailyForecasts[date].tempMin, item.main.temp_min);
      dailyForecasts[date].tempMax = Math.max(dailyForecasts[date].tempMax, item.main.temp_max);
      
      if (item.rain && item.rain['3h']) {
        dailyForecasts[date].precipitation += item.rain['3h'];
      }
      
      dailyForecasts[date].conditions.push(item.weather[0].main);
    });
    
    return Object.values(dailyForecasts);
  }
}

module.exports = new WeatherService();
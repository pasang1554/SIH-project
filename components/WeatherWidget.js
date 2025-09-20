// components/WeatherWidget.js
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

const WeatherWidget = ({ data }) => {
  const { t } = useTranslation();

  if (!data) return null;

  const getWeatherGradient = (condition) => {
    switch (condition) {
      case 'sunny':
        return ['#FFB74D', '#FF9800'];
      case 'cloudy':
        return ['#90A4AE', '#607D8B'];
      case 'rainy':
        return ['#64B5F6', '#1976D2'];
      default:
        return ['#81C784', '#4CAF50'];
    }
  };

  return (
    <LinearGradient
      colors={getWeatherGradient(data.condition)}
      style={styles.container}
    >
      <View style={styles.mainInfo}>
        <View>
          <Text style={styles.temperature}>{data.temperature}°C</Text>
          <Text style={styles.condition}>{t(`weather.${data.condition}`)}</Text>
        </View>
        <Image
          source={{ uri: data.iconUrl }}
          style={styles.weatherIcon}
        />
      </View>
      
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Icon name="water-drop" size={16} color="#FFFFFF" />
          <Text style={styles.detailText}>{data.humidity}%</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="air" size={16} color="#FFFFFF" />
          <Text style={styles.detailText}>{data.windSpeed} km/h</Text>
        </View>
        <View style={styles.detailItem}>
          <Icon name="opacity" size={16} color="#FFFFFF" />
          <Text style={styles.detailText}>{data.precipitation}%</Text>
        </View>
      </View>

      {data.recommendation && (
        <View style={styles.recommendation}>
          <Icon name="info" size={16} color="#FFFFFF" />
          <Text style={styles.recommendationText}>{data.recommendation}</Text>
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    elevation: 4,
  },
  mainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  condition: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  weatherIcon: {
    width: 80,
    height: 80,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: '#FFFFFF',
    marginLeft: 4,
    fontSize: 14,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  recommendationText: {
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
});

export default WeatherWidget;
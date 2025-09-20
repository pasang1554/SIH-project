// screens/HomeScreen.js - Main Dashboard
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import WeatherWidget from '../components/WeatherWidget';
import AlertCard from '../components/AlertCard';
import QuickActions from '../components/QuickActions';
import CropHealthIndicator from '../components/CropHealthIndicator';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.getDashboardData();
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with Greeting */}
      <LinearGradient
        colors={['#4CAF50', '#2E7D32']}
        style={styles.header}
      >
        <Text style={styles.greeting}>
          {t('greeting', { name: dashboardData?.farmerName })}
        </Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Text>
      </LinearGradient>

      {/* Weather Widget */}
      <WeatherWidget data={dashboardData?.weather} />

      {/* Active Alerts */}
      {dashboardData?.alerts?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('activeAlerts')}</Text>
          {dashboardData.alerts.map((alert, index) => (
            <AlertCard key={index} alert={alert} />
          ))}
        </View>
      )}

      {/* Crop Health Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('cropHealthOverview')}</Text>
        <View style={styles.cropHealthContainer}>
          {dashboardData?.farms?.map((farm, index) => (
            <CropHealthIndicator
              key={index}
              farm={farm}
              onPress={() => navigation.navigate('FarmDetail', { farmId: farm.id })}
            />
          ))}
        </View>
      </View>

      {/* Productivity Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('productivityTrend')}</Text>
        <LineChart
          data={{
            labels: dashboardData?.productivityLabels || [],
            datasets: [{
              data: dashboardData?.productivityData || []
            }]
          }}
          width={width - 32}
          height={200}
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#FFFFFF',
            backgroundGradientTo: '#FFFFFF',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#2E7D32'
            }
          }}
          bezier
          style={styles.chart}
        />
      </View>

      {/* Quick Actions */}
      <QuickActions navigation={navigation} />

      {/* Today's Tasks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('todaysTasks')}</Text>
        {dashboardData?.tasks?.map((task, index) => (
          <TouchableOpacity
            key={index}
            style={styles.taskCard}
            onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
          >
            <View style={styles.taskIcon}>
              <Icon name={task.icon} size={24} color="#2E7D32" />
            </View>
            <View style={styles.taskContent}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskDescription}>{task.description}</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#BDBDBD" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 24,
    paddingTop: 48,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
    color: '#E8F5E9',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  cropHealthContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    elevation: 2,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#757575',
  },
});

export default HomeScreen;
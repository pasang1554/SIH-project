// App.js - Main Navigation Structure
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import store from './store';

// Screens
import HomeScreen from './screens/HomeScreen';
import FarmDashboard from './screens/FarmDashboard';
import WeatherScreen from './screens/WeatherScreen';
import RecommendationsScreen from './screens/RecommendationsScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function App() {
  return (
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarStyle: {
                backgroundColor: '#2E7D32',
                borderTopWidth: 0,
                elevation: 8,
                height: 60,
              },
              tabBarActiveTintColor: '#FFFFFF',
              tabBarInactiveTintColor: '#81C784',
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
              },
            }}
          >
            <Tab.Screen 
              name="Home" 
              component={HomeScreen}
              options={{
                tabBarIcon: ({ color }) => <Icon name="home" size={24} color={color} />,
              }}
            />
            <Tab.Screen 
              name="Farms" 
              component={FarmDashboard}
              options={{
                tabBarIcon: ({ color }) => <Icon name="agriculture" size={24} color={color} />,
              }}
            />
            <Tab.Screen 
              name="Weather" 
              component={WeatherScreen}
              options={{
                tabBarIcon: ({ color }) => <Icon name="cloud" size={24} color={color} />,
              }}
            />
            <Tab.Screen 
              name="Advice" 
              component={RecommendationsScreen}
              options={{
                tabBarIcon: ({ color }) => <Icon name="lightbulb" size={24} color={color} />,
              }}
            />
            <Tab.Screen 
              name="Profile" 
              component={ProfileScreen}
              options={{
                tabBarIcon: ({ color }) => <Icon name="person" size={24} color={color} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </I18nextProvider>
    </Provider>
  );
}

export default App;  
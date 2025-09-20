// training/interactiveGuide.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';

const InteractiveGuide = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [language, setLanguage] = useState('en');

  const trainingModules = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      steps: [
        {
          title: 'Welcome to Smart Agriculture',
          content: 'Learn how this app can help improve your farming',
          video: 'intro_video.mp4',
          interactive: true
        },
        {
          title: 'Setting up your profile',
          content: 'Add your farm details for personalized recommendations',
          demo: 'ProfileSetupDemo'
        },
        {
          title: 'Understanding the dashboard',
          content: 'Navigate through different features',
          interactive: true,
          highlights: ['weather', 'alerts', 'recommendations']
        }
      ]
    },
    {
      id: 'using-features',
      title: 'Using Key Features',
      steps: [
        {
          title: 'Weather Forecasts',
          content: 'Get accurate weather predictions for your area',
          demo: 'WeatherDemo'
        },
        {
          title: 'Crop Health Monitoring',
          content: 'Use satellite imagery to monitor your crops',
          video: 'crop_health_tutorial.mp4'
        },
        {
          title: 'Getting Recommendations',
          content: 'Receive timely advice for your crops',
          interactive: true
        }
      ]
    },
    {
      id: 'advanced-features',
      title: 'Advanced Features',
      steps: [
        {
          title: 'Voice Commands',
          content: 'Use voice to get information quickly',
          demo: 'VoiceDemo'
        },
        {
          title: 'Market Prices',
          content: 'Check current market rates',
          interactive: true
        },
        {
          title: 'Community Features',
          content: 'Connect with other farmers',
          demo: 'CommunityDemo'
        }
      ]
    }
  ];

  const completeModule = async (moduleId) => {
    const completed = await AsyncStorage.getItem('completedModules');
    const modules = completed ? JSON.parse(completed) : [];
    modules.push(moduleId);
    await AsyncStorage.setItem('completedModules', JSON.stringify(modules));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {trainingModules[currentStep].title}
        </Text>
        <TouchableOpacity onPress={() => setLanguage('hi')}>
          <Text>हिंदी में देखें</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Render current step content */}
        {renderStepContent(trainingModules[currentStep].steps[0])}
      </View>

      <View style={styles.navigation}>
        <TouchableOpacity 
          onPress={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <Text style={styles.navButton}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.progress}>
          {trainingModules.map((_, index) => (
            <View 
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.activeDot
              ]}
            />
          ))}
        </View>

        <TouchableOpacity 
          onPress={() => {
            if (currentStep < trainingModules.length - 1) {
              setCurrentStep(currentStep + 1);
            } else {
              completeModule('basic-training');
              navigation.navigate('Home');
            }
          }}
        >
          <Text style={styles.navButton}>
            {currentStep === trainingModules.length - 1 ? 'Finish' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  header: {
    padding: 20,
    backgroundColor: '#2E7D32',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  content: {
    flex: 1,
    padding: 20
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    elevation: 4
  },
  navButton: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600'
  },
  progress: {
    flexDirection: 'row',
    gap: 8
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCCCCC'
  },
  activeDot: {
    backgroundColor: '#2E7D32',
    width: 24
  }
};

export default InteractiveGuide;
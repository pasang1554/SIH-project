# ml_models/crop_health_model.py
import tensorflow as tf
import numpy as np
from PIL import Image
import json
import redis
import boto3
from datetime import datetime

class CropHealthAnalyzer:
    def __init__(self):
        self.model = self.load_model()
        self.redis_client = redis.Redis(host='localhost', port=6379, db=0)
        self.s3_client = boto3.client('s3')
        
    def load_model(self):
        """Load pre-trained crop health model"""
        model = tf.keras.models.load_model('models/crop_health_v2.h5')
        return model
    
    def preprocess_satellite_image(self, image_path):
        """Preprocess satellite imagery for analysis"""
        # Load multi-spectral image
        image = Image.open(image_path)
        
        # Extract bands (B2, B3, B4, B8 for Sentinel-2)
        bands = np.array(image)
        
        # Calculate vegetation indices
        nir = bands[:, :, 3].astype(float)
        red = bands[:, :, 2].astype(float)
        
        # NDVI calculation
        ndvi = (nir - red) / (nir + red + 1e-8)
        
        # EVI calculation
        blue = bands[:, :, 0].astype(float)
        evi = 2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1))
        
        # Stack indices
        indices = np.stack([ndvi, evi], axis=-1)
        
        # Normalize
        indices = (indices - np.min(indices)) / (np.max(indices) - np.min(indices) + 1e-8)
        
        return indices
    
    def analyze_field_health(self, field_boundary, date_range):
        """Analyze crop health for a specific field"""
        # Fetch satellite imagery
        imagery = self.fetch_satellite_imagery(field_boundary, date_range)
        
        # Preprocess
        processed_images = []
        for img_path in imagery:
            processed = self.preprocess_satellite_image(img_path)
            processed_images.append(processed)
        
        # Run inference
        predictions = []
        for img in processed_images:
            # Reshape for model input
            img_batch = np.expand_dims(img, axis=0)
            
            # Predict
            health_score = self.model.predict(img_batch)[0]
            predictions.append(health_score)
        
        # Analyze trends
        analysis = self.analyze_health_trends(predictions, date_range)
        
        # Generate recommendations
        recommendations = self.generate_recommendations(analysis)
        
        return {
            'health_scores': predictions,
            'analysis': analysis,
            'recommendations': recommendations
        }
    
    def analyze_health_trends(self, health_scores, dates):
        """Analyze temporal trends in crop health"""
        scores = np.array(health_scores)
        
        # Calculate statistics
        mean_health = np.mean(scores)
        trend = np.polyfit(range(len(scores)), scores, 1)[0]
        
        # Detect anomalies
        anomalies = []
        threshold = mean_health - 2 * np.std(scores)
        
        for i, score in enumerate(scores):
            if score < threshold:
                anomalies.append({
                    'date': dates[i],
                    'score': float(score),
                    'severity': 'high' if score < threshold * 0.8 else 'medium'
                })
        
        return {
            'mean_health': float(mean_health),
            'trend': 'improving' if trend > 0 else 'declining',
            'trend_rate': float(trend),
            'anomalies': anomalies
        }
    
    def generate_recommendations(self, analysis):
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        if analysis['mean_health'] < 0.5:
            recommendations.append({
                'priority': 'high',
                'type': 'irrigation',
                'message': 'Critical: Low vegetation health detected. Immediate irrigation recommended.',
                'action': 'Check soil moisture and irrigate within 24 hours'
            })
        
        if analysis['trend'] == 'declining' and abs(analysis['trend_rate']) > 0.1:
            recommendations.append({
                'priority': 'medium',
                'type': 'inspection',
                'message': 'Declining crop health trend detected.',
                'action': 'Inspect field for pest/disease signs'
            })
        
        for anomaly in analysis['anomalies']:
            if anomaly['severity'] == 'high':
                recommendations.append({
                    'priority': 'high',
                    'type': 'intervention',
                    'message': f"Severe health drop detected on {anomaly['date']}",
                    'action': 'Investigate affected area immediately'
                })
        
        return recommendations
    
    def detect_crop_disease(self, image_path):
        """Detect diseases from field images"""
        # Load disease detection model
        disease_model = tf.keras.models.load_model('models/disease_detection_v2.h5')
        
        # Preprocess image
        image = Image.open(image_path).resize((224, 224))
        image_array = np.array(image) / 255.0
        image_batch = np.expand_dims(image_array, axis=0)
        
        # Predict
        predictions = disease_model.predict(image_batch)[0]
        
        # Get disease classes
        disease_classes = [
            'healthy', 'bacterial_blight', 'brown_spot', 
            'leaf_blast', 'tungro', 'sheath_blight'
        ]
        
        # Get top prediction
        disease_idx = np.argmax(predictions)
        confidence = predictions[disease_idx]
        
        if disease_idx == 0:  # Healthy
            return {
                'disease_detected': False,
                'disease': 'None',
                'confidence': float(confidence)
            }
        
        return {
            'disease_detected': True,
            'disease': disease_classes[disease_idx],
            'confidence': float(confidence),
            'severity': self.estimate_severity(image_array, disease_idx),
            'treatment': self.get_treatment_recommendation(disease_classes[disease_idx])
        }
    
    def get_treatment_recommendation(self, disease):
        """Get treatment recommendations for detected disease"""
        treatments = {
            'bacterial_blight': {
                'chemical': 'Streptomycin sulfate 90% + Tetracycline hydrochloride 10%',
                'dosage': '15g per 10 liters of water',
                'organic': 'Neem oil spray (3-4ml/liter)',
                'cultural': 'Remove infected plants, improve drainage'
            },
            'brown_spot': {
                'chemical': 'Mancozeb 75% WP',
                'dosage': '2g per liter of water',
                'organic': 'Trichoderma viride',
                'cultural': 'Use resistant varieties, balanced fertilization'
            },
            # Add more treatments...
        }
        
        return treatments.get(disease, {})
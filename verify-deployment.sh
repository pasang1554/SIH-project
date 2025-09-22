#!/bin/bash
# verify-deployment.sh

set -e

echo "🔍 Starting post-deployment verification..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_URL="https://api.agriplatform.com"
APP_URL="https://app.agriplatform.com"
ADMIN_URL="https://admin.agriplatform.com"

# Function to check endpoint
check_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $description (Status: $status)"
        return 0
    else
        echo -e "${RED}✗${NC} $description (Expected: $expected_status, Got: $status)"
        return 1
    fi
}

# API Health Checks
echo -e "\n📡 Checking API endpoints..."
check_endpoint "$API_URL/health" 200 "API Health"
check_endpoint "$API_URL/api/weather/current?lat=20.5937&lon=78.9629" 200 "Weather API"
check_endpoint "$API_URL/api/market/prices" 200 "Market Prices API"

# Web Application Checks
echo -e "\n🌐 Checking web applications..."
check_endpoint "$APP_URL" 200 "Mobile Web App"
check_endpoint "$ADMIN_URL" 200 "Admin Dashboard"

# Database Connectivity
echo -e "\n🗄️ Checking database connectivity..."
kubectl exec -n production deployment/api-deployment -- npm run db:ping

# Redis Connectivity
echo -e "\n💾 Checking Redis connectivity..."
kubectl exec -n production deployment/redis -- redis-cli ping

# ML Service
echo -e "\n🤖 Checking ML service..."
check_endpoint "$API_URL/ml/health" 200 "ML Service Health"

# IoT Endpoints
echo -e "\n📡 Checking IoT endpoints..."
check_endpoint "$API_URL/api/iot/status" 200 "IoT Service Status"

# Performance Metrics
echo -e "\n⚡ Checking performance..."
response_time=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/health")
echo "API Response Time: ${response_time}s"

# SSL Certificate
echo -e "\n🔒 Checking SSL certificates..."
echo | openssl s_client -servername api.agriplatform.com -connect api.agriplatform.com:443 2>/dev/null | openssl x509 -noout -dates

# Monitoring
echo -e "\n📊 Checking monitoring systems..."
check_endpoint "https://monitoring.agriplatform.com/api/v1/query?query=up" 200 "Prometheus"
check_endpoint "https://grafana.agriplatform.com/api/health" 200 "Grafana"

# Final Summary
echo -e "\n📋 Deployment Verification Summary"
echo "=================================="
echo "✅ All checks completed"
echo "🚀 Platform is ready for production use"
echo ""
echo "Access URLs:"
echo "- API: $API_URL"
echo "- App: $APP_URL"
echo "- Admin: $ADMIN_URL"
echo "- Docs: $API_URL/docs"

#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "🚀 Starting Smart Agriculture Platform Deployment..."

# Environment setup
export NODE_ENV=production
export DEPLOYMENT_TIME=$(date +%Y%m%d_%H%M%S)

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Functions
log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Pre-deployment checks
echo "Running pre-deployment checks..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_NODE="14.0.0"
if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
    log_error "Node.js version must be >= $REQUIRED_NODE"
fi
log_success "Node.js version check passed"

# Check environment variables
required_vars=(
    "MONGODB_URI"
    "REDIS_URL"
    "JWT_SECRET"
    "TWILIO_ACCOUNT_SID"
    "WEATHER_API_KEY"
    "SENTINEL_CLIENT_ID"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Missing required environment variable: $var"
    fi
done
log_success "Environment variables check passed"

# Build process
echo -e "\n📦 Building application..."

# Install dependencies
npm ci --production
log_success "Dependencies installed"

# Run tests
npm run test:production
log_success "Tests passed"

# Build frontend
cd client
npm ci
npm run build
cd ..
log_success "Frontend built"

# Database migrations
echo -e "\n🗄️ Running database migrations..."
npm run migrate:production
log_success "Database migrations completed"

# ML model setup
echo -e "\n🤖 Setting up ML models..."
python3 ml_service/setup_models.py
log_success "ML models ready"

# Docker build
echo -e "\n🐳 Building Docker images..."
docker-compose -f docker-compose.prod.yml build
log_success "Docker images built"

# Backup current deployment
echo -e "\n💾 Backing up current deployment..."
kubectl create backup production-backup-$DEPLOYMENT_TIME
log_success "Backup created"

# Deploy to Kubernetes
echo -e "\n☸️ Deploying to Kubernetes..."
kubectl apply -f k8s/production/

# Wait for rollout
kubectl rollout status deployment/api-deployment -n production
kubectl rollout status deployment/ml-service-deployment -n production
log_success "Kubernetes deployment completed"

# Health checks
echo -e "\n🏥 Running health checks..."
sleep 30

HEALTH_CHECK=$(curl -s https://api.agriplatform.com/health)
if [[ $HEALTH_CHECK != *"healthy"* ]]; then
    log_warning "Health check failed, initiating rollback..."
    kubectl rollout undo deployment/api-deployment -n production
    log_error "Deployment failed - rolled back to previous version"
fi
log_success "Health checks passed"

# Update CDN
echo -e "\n🌐 Updating CDN..."
aws s3 sync client/build s3://agriplatform-static --delete
aws cloudfront create-invalidation --distribution-id $CF_DISTRIBUTION_ID --paths "/*"
log_success "CDN updated"

# Post-deployment tasks
echo -e "\n🔧 Running post-deployment tasks..."

# Clear caches
redis-cli -h $REDIS_HOST FLUSHDB
log_success "Caches cleared"

# Warm up cache
npm run cache:warm
log_success "Cache warmed up"

# Update monitoring
curl -X POST https://api.newrelic.com/v2/applications/$NEW_RELIC_APP_ID/deployments.json \
  -H "X-Api-Key:$NEW_RELIC_API_KEY" \
  -d "deployment[revision]=$DEPLOYMENT_TIME"
log_success "Monitoring updated"

# Send notifications
echo -e "\n📢 Sending deployment notifications..."
npm run notify:deployment -- --version=$DEPLOYMENT_TIME
log_success "Notifications sent"

echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo "Deployment ID: $DEPLOYMENT_TIME"
echo "Application URL: https://app.agriplatform.com"
echo "Admin Dashboard: https://admin.agriplatform.com"
echo "API Documentation: https://api.agriplatform.com/docs"
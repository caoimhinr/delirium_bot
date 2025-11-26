#!/bin/bash
# -------------------------------
# Deployment script for Discord bot
# -------------------------------

# Config
APP_NAME="delirium_bot"           # PM2 process name
APP_DIR="/opt/delirium_bot"   # Path to your bot
BRANCH="main"                 # Git branch to deploy
ECOSYSTEM="ecosystem.config.js"  # PM2 ecosystem file (if used)

echo "🚀 Starting deployment..."

# Go to the bot directory
cd $APP_DIR || { echo "Directory not found: $APP_DIR"; exit 1; }

# Make sure we are on the correct branch
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Install/update dependencies
echo "📦 Installing npm dependencies..."
npm install

# Build step (optional, if using TypeScript or other build)
# echo "🔨 Building project..."
# npm run build

# Restart PM2 process
echo "🔁 Restarting PM2 process..."
pm2 restart $ECOSYSTEM || pm2 start $ECOSYSTEM

# Optional: save PM2 list for startup
pm2 save

echo "✅ Deployment complete!"

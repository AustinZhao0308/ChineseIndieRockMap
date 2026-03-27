#!/bin/bash
# Step 1: Pull the latest code
git pull
# Step 1.5: Install dependencies
npm install --legacy-peer-deps
# Step 2: Build the project
npm run build
# Step 3: Delete the existing PM2 process
pm2 delete map
# Step 4: Start the service with PM2
pm2 start npm --name map -- start
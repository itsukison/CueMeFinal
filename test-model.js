#!/usr/bin/env node

/**
 * Model Testing Script for CueMe
 *
 * This script helps test different Gemini models for streaming performance.
 *
 * Usage:
 *   npm run test-model gemini-1.5-flash    # Test with gemini-1.5-flash
 *   npm run test-model gemini-2.0-flash    # Test with gemini-2.0-flash (default)
 *   npm run test-model gemini-2.0-flash-exp # Test with gemini-2.0-flash-exp
 *
 * Update your .env file with the model you want to test:
 *   GEMINI_MODEL=gemini-1.5-flash
 *   GEMINI_MODEL=gemini-2.0-flash
 *   GEMINI_MODEL=gemini-2.0-flash-exp
 */

const fs = require('fs');
const path = require('path');

const MODELS = {
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    description: 'Fast, lightweight model for quick responses',
    expectedLatency: '500-1000ms',
    quality: 'Good'
  },
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    description: 'Latest fast model with improved capabilities',
    expectedLatency: '300-800ms',
    quality: 'Very Good'
  },
  'gemini-2.0-flash-exp': {
    name: 'Gemini 2.0 Flash Experimental',
    description: 'Experimental model with latest optimizations',
    expectedLatency: '200-600ms',
    quality: 'Excellent'
  }
};

function updateEnvModel(modelName) {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found. Please create one with your GEMINI_API_KEY.');
    return false;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // Remove existing GEMINI_MODEL line if present
  envContent = envContent.split('\n').filter(line => !line.startsWith('GEMINI_MODEL=')).join('\n');

  // Add new model line
  envContent += `\nGEMINI_MODEL=${modelName}\n`;

  fs.writeFileSync(envPath, envContent);

  console.log(`✅ Updated .env file with GEMINI_MODEL=${modelName}`);
  return true;
}

function showModelInfo(modelName) {
  const model = MODELS[modelName];
  if (!model) {
    console.log(`❌ Unknown model: ${modelName}`);
    console.log('Available models:');
    Object.keys(MODELS).forEach(key => {
      console.log(`  - ${key}`);
    });
    return;
  }

  console.log(`\n📊 Testing with ${model.name}`);
  console.log(`   Description: ${model.description}`);
  console.log(`   Expected Latency: ${model.expectedLatency}`);
  console.log(`   Quality: ${model.quality}\n`);

  console.log('🔧 Testing Instructions:');
  console.log('1. Restart the CueMe application');
  console.log('2. Ask a question and watch the console for performance metrics');
  console.log('3. Look for these log messages:');
  console.log('   - "[LLMHelper] Starting streaming response with model..."');
  console.log('   - "[LLMHelper] First chunk received in Xms"');
  console.log('   - "[QuestionSidePanel] Chunk X arrived in Xms"');
  console.log('4. Compare the latency with previous models\n');
}

// Main execution
const modelName = process.argv[2] || 'gemini-2.0-flash';

if (updateEnvModel(modelName)) {
  showModelInfo(modelName);
  console.log('🚀 Ready to test! Restart your application to use the new model.');
}
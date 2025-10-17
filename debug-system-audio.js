#!/usr/bin/env node

// Debug script to test system audio capture pipeline
// Run this while the app is running to see detailed logs

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 System Audio Debug Helper');
console.log('=' .repeat(50));

console.log('\n📋 Instructions:');
console.log('1. Start CueMe app');
console.log('2. Switch to "System Audio" source');
console.log('3. Start listening');
console.log('4. Play some audio (YouTube, Zoom, etc.)');
console.log('5. Watch the logs below for debugging info');

console.log('\n🎯 What to look for:');
console.log('✅ "Received audio data" - Native binary is working');
console.log('✅ "Audio content detected: true" - Audio has content');
console.log('✅ "Forwarding system audio" - Data reaches processor');
console.log('✅ "Starting transcription" - Transcription is triggered');
console.log('✅ "Whisper API response" - OpenAI returns text');

console.log('\n📊 Common Issues:');
console.log('❌ No "Received audio data" → Screen Recording permission needed');
console.log('❌ "Audio content detected: false" → No audio playing or wrong source');
console.log('❌ No "Starting transcription" → Question detection disabled');
console.log('❌ "Transcription error" → OpenAI API key or network issue');

console.log('\n🔍 Monitoring logs...');
console.log('Press Ctrl+C to stop\n');

// Monitor the app logs (if running via npm start)
const logProcess = spawn('tail', ['-f', '/dev/null'], { stdio: 'inherit' });

// Keep the script running
process.on('SIGINT', () => {
  console.log('\n\n🛑 Debug monitoring stopped');
  process.exit(0);
});

// Just keep running to show instructions
setInterval(() => {
  // Do nothing, just keep alive
}, 1000);
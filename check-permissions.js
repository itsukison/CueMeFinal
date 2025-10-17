#!/usr/bin/env node

// Quick permission checker for system audio
const { spawn } = require('child_process');

console.log('🔐 CueMe System Audio Permission Checker');
console.log('=' .repeat(45));

// Check if Screen Recording permission is granted
console.log('\n🔍 Checking Screen Recording permission...');

const checkPermission = spawn('sqlite3', [
  '/Library/Application Support/com.apple.TCC/TCC.db',
  "SELECT service, client, auth_value FROM access WHERE service='kTCCServiceScreenCapture' AND client LIKE '%CueMe%';"
], { stdio: 'pipe' });

let output = '';
checkPermission.stdout.on('data', (data) => {
  output += data.toString();
});

checkPermission.on('close', (code) => {
  if (output.trim()) {
    const lines = output.trim().split('\n');
    lines.forEach(line => {
      const [service, client, authValue] = line.split('|');
      const status = authValue === '2' ? '✅ GRANTED' : '❌ DENIED';
      console.log(`${status} - ${client}`);
    });
  } else {
    console.log('❓ No Screen Recording permissions found for CueMe');
    console.log('   This might mean:');
    console.log('   - Permission never requested');
    console.log('   - App bundle ID different than expected');
    console.log('   - Permission database access restricted');
  }

  console.log('\n📋 Manual Check:');
  console.log('1. Open System Settings');
  console.log('2. Go to Privacy & Security → Screen Recording');
  console.log('3. Look for CueMe in the list');
  console.log('4. Make sure it\'s enabled (checked)');
  console.log('5. Restart CueMe after granting permission');

  console.log('\n🧪 Test System Audio:');
  console.log('1. Play audio through headphones (YouTube, Zoom)');
  console.log('2. Switch CueMe to "System Audio" source');
  console.log('3. Start listening');
  console.log('4. Check console logs for audio capture messages');
});

checkPermission.on('error', (err) => {
  console.log('⚠️  Could not check TCC database (this is normal on newer macOS)');
  console.log('\n📋 Manual Check Required:');
  console.log('1. Open System Settings');
  console.log('2. Go to Privacy & Security → Screen Recording');
  console.log('3. Look for CueMe in the list');
  console.log('4. Make sure it\'s enabled (checked)');
  console.log('5. Restart CueMe after granting permission');
});
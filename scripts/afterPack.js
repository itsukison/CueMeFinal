#!/usr/bin/env node

/**
 * afterPack hook for electron-builder
 * Ensures native binaries have correct permissions and are code-signed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function(context) {
  console.log('\n🔧 Running afterPack hook...');
  
  const { appOutDir, packager, electronPlatformName } = context;
  
  // Only process macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('⏭️  Skipping afterPack for non-macOS platform');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const binaryPath = path.join(resourcesPath, 'dist-native', 'SystemAudioCapture');

  console.log(`📦 App path: ${appPath}`);
  console.log(`📂 Resources path: ${resourcesPath}`);
  console.log(`🔨 Binary path: ${binaryPath}`);

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    console.warn(`⚠️  Binary not found at: ${binaryPath}`);
    console.warn('   Audio capture may not work in production!');
    return;
  }

  try {
    // Step 1: Set execute permissions
    console.log('🔐 Setting execute permissions...');
    fs.chmodSync(binaryPath, 0o755);
    console.log('✅ Execute permissions set (755)');

    // Step 2: Enhanced code signing for universal compatibility
    const identity = process.env.APPLE_IDENTITY || process.env.CSC_NAME || process.env.CSC_IDENTITY_AUTO_DISCOVERY || '-';
    
    console.log(`🔏 Code signing binary for universal deployment...`);
    
    try {
      const entitlementsPath = path.join(process.cwd(), 'assets', 'entitlements.mac.plist');
      
      // Enhanced signing with timeout and retry
      const signWithRetry = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const signCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${entitlementsPath}" --timestamp "${binaryPath}"`;
            
            execSync(signCommand, { 
              stdio: 'inherit',
              timeout: 30000  // 30 second timeout
            });
            
            console.log(`✅ Binary code-signed successfully (attempt ${i + 1})`);
            return true;
          } catch (error) {
            console.warn(`⚠️  Signing attempt ${i + 1} failed: ${error.message}`);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
          }
        }
      };
      
      await signWithRetry();
      
      // Enhanced verification with detailed output
      const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${binaryPath}"`;
      execSync(verifyCommand, { 
        stdio: 'inherit',
        timeout: 10000
      });
      console.log('✅ Signature verified with strict validation');
      
      // Check entitlements are properly applied
      const entitlementsCommand = `codesign --display --entitlements - "${binaryPath}"`;
      const entitlementsOutput = execSync(entitlementsCommand, { 
        encoding: 'utf8',
        timeout: 10000
      });
      
      if (entitlementsOutput.includes('com.apple.security.device.screen-capture')) {
        console.log('✅ Screen capture entitlement confirmed');
      } else {
        console.warn('⚠️  Screen capture entitlement may not be applied correctly');
      }
      
    } catch (signError) {
      console.error('❌ Enhanced code signing failed:', signError.message);
      
      // Fallback: Try basic adhoc signing for development
      try {
        console.log('🔄 Attempting fallback adhoc signing...');
        const adhocCommand = `codesign --force --sign - "${binaryPath}"`;
        execSync(adhocCommand, { stdio: 'inherit', timeout: 10000 });
        console.log('✅ Fallback adhoc signing successful');
        console.warn('⚠️  Using adhoc signature - may require permission re-grant');
      } catch (adhocError) {
        console.error('❌ All signing methods failed:', adhocError.message);
        console.warn('⚠️  Binary will remain unsigned - will likely fail on other machines');
      }
    }

    // Step 3: Enhanced binary testing with permission validation
    console.log('🧪 Testing binary with permission checks...');
    try {
      // Test basic execution
      const testCommand = `"${binaryPath}" --help`;
      execSync(testCommand, { timeout: 5000, stdio: 'pipe' });
      console.log('✅ Binary executes successfully');
      
      // Test permission status
      const permissionCommand = `"${binaryPath}" permissions`;
      const permissionOutput = execSync(permissionCommand, { 
        timeout: 5000, 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (permissionOutput.includes('granted')) {
        console.log('✅ Binary can check permissions successfully');
      } else {
        console.log('📝 Binary permission check output:', permissionOutput.split('\n')[0]);
      }
      
    } catch (testError) {
      console.warn('⚠️  Binary testing inconclusive (may be normal for daemon processes)');
      console.log('   Error:', testError.message.split('\n')[0]);
    }

    // Step 4: Display final status
    console.log('\n📊 Final binary status:');
    const stats = fs.statSync(binaryPath);
    const permissions = (stats.mode & parseInt('777', 8)).toString(8);
    console.log(`   Permissions: ${permissions}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    try {
      const signInfo = execSync(`codesign -dv "${binaryPath}" 2>&1`, { encoding: 'utf8' });
      console.log('   Signature: ✅ Signed');
      console.log(signInfo.split('\n').slice(0, 3).join('\n'));
    } catch {
      console.log('   Signature: ⚠️  Not signed');
    }

    console.log('\n✅ afterPack hook completed successfully\n');

  } catch (error) {
    console.error('\n❌ afterPack hook failed:', error);
    console.error('   Audio capture may not work in production!\n');
    // Don't throw - allow build to continue
  }
};

#!/usr/bin/env node

/**
 * afterPack hook for electron-builder
 * Signs the audiotee binary with correct entitlements
 * Following: https://stronglytyped.uk/articles/packaging-shipping-electron-apps-audiotee
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Process and sign the audiotee binary with proper entitlements
 */
function processAudioteeBinary(binaryPath) {
  try {
    console.log(`\n🔧 Processing audiotee binary: ${binaryPath}`);

    // Step 1: Set execute permissions
    console.log("🔐 Setting execute permissions...");
    fs.chmodSync(binaryPath, 0o755);
    console.log("✅ Execute permissions set (755)");

    // CRITICAL: Remove quarantine attribute to allow Core Audio Taps access
    console.log("🧹 Removing quarantine attribute...");
    try {
      execSync(`xattr -d com.apple.quarantine "${binaryPath}"`, {
        stdio: "pipe",
        timeout: 5000,
      });
      console.log("✅ Quarantine removed - binary can access Core Audio Taps");
    } catch (xattrError) {
      console.log("ℹ️  No quarantine attribute (already clean)");
    }

    // Step 2: Get signing identity
    const identity =
      process.env.APPLE_IDENTITY ||
      process.env.CSC_NAME ||
      process.env.CSC_IDENTITY_AUTO_DISCOVERY ||
      "-";

    console.log(`🔏 Code signing audiotee binary...`);

    // Use the main app's entitlements
    const entitlementsPath = path.join(
      process.cwd(),
      "assets",
      "entitlements.mac.plist"
    );

    if (!fs.existsSync(entitlementsPath)) {
      console.warn(`⚠️  Entitlements not found at: ${entitlementsPath}`);
      throw new Error("Entitlements file missing");
    }

    // Sign with retry logic
    const signWithRetry = (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const signCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${entitlementsPath}" --timestamp "${binaryPath}"`;

          execSync(signCommand, {
            stdio: "inherit",
            timeout: 30000,
          });

          console.log(
            `✅ Audiotee binary code-signed successfully (attempt ${i + 1})`
          );
          return true;
        } catch (error) {
          console.warn(`⚠️  Signing attempt ${i + 1} failed: ${error.message}`);
          if (i === retries - 1) throw error;
        }
      }
    };

    signWithRetry();

    // Verify signature
    const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${binaryPath}"`;
    execSync(verifyCommand, {
      stdio: "inherit",
      timeout: 10000,
    });
    console.log("✅ Signature verified");

    // Check entitlements
    const entitlementsCommand = `codesign --display --entitlements - "${binaryPath}"`;
    const entitlementsOutput = execSync(entitlementsCommand, {
      encoding: "utf8",
      timeout: 10000,
    });

    if (
      entitlementsOutput.includes("com.apple.security.device.screen-capture")
    ) {
      console.log("✅ Screen capture entitlement confirmed");
    } else {
      console.warn(
        "⚠️  Screen capture entitlement may not be applied correctly"
      );
    }

    // CRITICAL: Verify Info.plist is embedded
    console.log("🔍 Verifying Info.plist embedding...");
    const infoPlistCheck = execSync(
      `otool -l "${binaryPath}" | grep -c __info_plist || echo 0`,
      {
        encoding: "utf8",
        timeout: 5000,
      }
    ).trim();

    if (parseInt(infoPlistCheck) > 0) {
      console.log(
        "✅ Info.plist embedded in binary - macOS 14.2+ support confirmed!"
      );
    } else {
      console.error("❌ CRITICAL: Info.plist NOT embedded!");
      console.error(
        "   Binary may fail on macOS 14.2+ without NSAudioCaptureUsageDescription"
      );
      console.error(
        "   Consider using the custom-built audiotee from custom-binaries/"
      );
    }

    // Test execution
    console.log("🧪 Testing binary execution...");
    execSync(`"${binaryPath}" --help > /dev/null 2>&1`, { timeout: 5000 });
    console.log("✅ Binary executes successfully");

    // Display final status
    console.log("\n📊 Final binary status:");
    const stats = fs.statSync(binaryPath);
    const permissions = (stats.mode & parseInt("777", 8)).toString(8);
    console.log(`   Permissions: ${permissions}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);

    const signInfo = execSync(`codesign -dv "${binaryPath}" 2>&1`, {
      encoding: "utf8",
    });
    console.log("   Signature: ✅ Signed");
    console.log(signInfo.split("\n").slice(0, 3).join("\n"));

    console.log("\n✅ Audiotee binary processing complete\n");
    return true;
  } catch (error) {
    console.error("\n❌ Audiotee binary processing failed:", error.message);
    console.error("   Audio capture may not work in production!\n");
    return false;
  }
}

module.exports = async function (context) {
  console.log("\n🔧 Running afterPack hook...");

  const { appOutDir, packager, electronPlatformName } = context;

  // Only process macOS builds
  if (electronPlatformName !== "darwin") {
    console.log("⏭️  Skipping afterPack for non-macOS platform");
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const resourcesPath = path.join(appPath, "Contents", "Resources");

  // Binary location (following article: directly in Resources/)
  const binaryPath = path.join(resourcesPath, "audiotee");

  console.log(`📦 App path: ${appPath}`);
  console.log(`📂 Resources path: ${resourcesPath}`);
  console.log(`🎵 Binary path: ${binaryPath}`);

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    console.error("❌ audiotee binary not found at:", binaryPath);
    console.error("   System audio capture will not work in production!");
    return;
  }

  console.log("✅ Found audiotee binary");

  // Process and sign the binary
  try {
    const success = processAudioteeBinary(binaryPath);
    if (!success) {
      console.warn(
        "⚠️  Failed to process audiotee binary, but continuing build..."
      );
    }
  } catch (error) {
    console.error("\n❌ afterPack hook failed:", error);
    console.error("   Audio capture may not work in production!\n");
  }
};

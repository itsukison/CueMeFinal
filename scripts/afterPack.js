#!/usr/bin/env node

/**
 * afterPack hook for electron-builder
 * Ensures native binaries have correct permissions and are code-signed
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Sign and verify the helper app with correct entitlements
 * This is where the ACTUAL signing happens (not in build-helper-app.sh)
 */
function processHelperApp(appPath) {
  console.log("\n🔧 Signing and verifying helper app...");

  const helperPath = path.join(
    appPath,
    "Contents",
    "Library",
    "LoginItems",
    "AudioTeeHelper.app"
  );

  if (!fs.existsSync(helperPath)) {
    console.error("❌ Helper app not found at:", helperPath);
    return false;
  }

  console.log("✅ Found helper app:", helperPath);

  try {
    // Get signing identity from environment (set by electron-builder)
    const identity =
      process.env.CSC_NAME ||
      process.env.APPLE_IDENTITY ||
      process.env.CSC_IDENTITY_AUTO_DISCOVERY;

    if (!identity || identity === "-") {
      console.warn(
        "⚠️  No signing identity found - helper app will remain unsigned"
      );
      console.warn(
        "   This is OK for development, but REQUIRED for production!"
      );
      return true; // Don't fail the build in development
    }

    console.log("🔐 Using signing identity:", identity);

    // Path to helper-specific entitlements
    const helperEntitlementsPath = path.join(
      process.cwd(),
      "helper-apps",
      "AudioTeeHelper",
      "entitlements.plist"
    );

    if (!fs.existsSync(helperEntitlementsPath)) {
      console.error(
        "❌ Helper entitlements not found at:",
        helperEntitlementsPath
      );
      return false;
    }

    console.log("📜 Using helper entitlements:", helperEntitlementsPath);

    // Sign the binary first
    const binaryPath = path.join(helperPath, "Contents", "MacOS", "audiotee");
    console.log("🔏 Signing helper binary...");

    const signBinaryCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${binaryPath}"`;
    execSync(signBinaryCommand, { stdio: "inherit", timeout: 30000 });
    console.log("✅ Helper binary signed");

    // Sign the app bundle
    console.log("🔏 Signing helper app bundle...");
    const signAppCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${helperPath}"`;
    execSync(signAppCommand, { stdio: "inherit", timeout: 30000 });
    console.log("✅ Helper app bundle signed");

    // Verify signature
    console.log("🔍 Verifying helper app signature...");
    const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${helperPath}"`;
    execSync(verifyCommand, { stdio: "inherit", timeout: 10000 });
    console.log("✅ Helper app signature verified");

    // Check Info.plist
    const infoPlistPath = path.join(helperPath, "Contents", "Info.plist");
    if (fs.existsSync(infoPlistPath)) {
      console.log("✅ Helper app Info.plist found");

      // Verify bundle identifier
      const bundleIdCommand = `defaults read "${infoPlistPath}" CFBundleIdentifier`;
      const bundleId = execSync(bundleIdCommand, { encoding: "utf8" }).trim();
      console.log("   Bundle ID:", bundleId);

      if (bundleId !== "com.cueme.audiotee-helper") {
        console.warn("⚠️  Unexpected bundle ID:", bundleId);
      }
    }

    // CRITICAL: Verify entitlements are correct
    console.log("\n🔍 Verifying helper app entitlements...");
    const entitlementsCommand = `codesign -d --entitlements - "${helperPath}" 2>&1`;
    const entitlementsOutput = execSync(entitlementsCommand, {
      encoding: "utf8",
      timeout: 10000,
    });

    // Check for critical entitlements
    const hasScreenCapture = entitlementsOutput.includes(
      "com.apple.security.device.screen-capture"
    );
    const hasSandboxFalse =
      entitlementsOutput.includes("com.apple.security.app-sandbox") &&
      entitlementsOutput.match(
        /com\.apple\.security\.app-sandbox[\s\S]*?\[Bool\]\s*false/i
      );

    if (hasScreenCapture) {
      console.log("✅ Helper has screen-capture entitlement");
    } else {
      console.error("❌ CRITICAL: Helper missing screen-capture entitlement!");
      console.error("   System audio capture will NOT work!");
      console.error("   Entitlements output:", entitlementsOutput);
      return false;
    }

    if (hasSandboxFalse) {
      console.log("✅ Helper has app-sandbox disabled");
    } else if (entitlementsOutput.includes("com.apple.security.app-sandbox")) {
      console.error(
        "❌ CRITICAL: Helper has app-sandbox ENABLED (should be false)!"
      );
      console.error("   Core Audio Taps will be blocked!");
      return false;
    } else {
      console.log("✅ Helper has no app-sandbox (defaults to disabled)");
    }

    console.log("\n✅ Helper app signing and verification complete");
    return true;
  } catch (error) {
    console.error("❌ Helper app processing failed:", error.message);
    console.error("   This will cause system audio capture to fail!");
    return false;
  }
}

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

  console.log(`📦 App path: ${appPath}`);
  console.log(`📂 Resources path: ${resourcesPath}`);

  // Process helper app
  console.log("\n📦 Processing helper app...");
  const helperSuccess = processHelperApp(appPath);
  if (!helperSuccess) {
    console.warn("⚠️  Helper app processing failed, but continuing build...");
  }

  // PRIORITY: Process custom binary FIRST (has Info.plist)
  const customBinaryPath = path.join(
    resourcesPath,
    "app.asar.unpacked",
    "custom-binaries",
    "audiotee"
  );

  // Fallback: npm package binary (no Info.plist)
  const npmBinaryPath = path.join(
    resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "audiotee",
    "bin",
    "audiotee"
  );

  // Check custom binary FIRST
  if (fs.existsSync(customBinaryPath)) {
    console.log(
      `✅ Found custom audiotee binary (with Info.plist): ${customBinaryPath}`
    );
    try {
      const success = processAudioteeBinary(customBinaryPath);
      if (!success) {
        console.warn(
          "⚠️  Failed to process custom binary, but continuing build..."
        );
      }
    } catch (error) {
      console.error("\n❌ afterPack hook failed:", error);
      console.error("   Audio capture may not work in production!\n");
    }
    return;
  }

  // Fallback to npm binary if custom not found
  if (fs.existsSync(npmBinaryPath)) {
    console.warn(
      `⚠️  Custom binary not found, using npm package binary: ${npmBinaryPath}`
    );
    console.warn(
      "   NOTE: npm binary lacks Info.plist - may fail on macOS 14.2+"
    );
    try {
      const success = processAudioteeBinary(npmBinaryPath);
      if (!success) {
        console.warn(
          "⚠️  Failed to process npm binary, but continuing build..."
        );
      }
    } catch (error) {
      console.error("\n❌ afterPack hook failed:", error);
      console.error("   Audio capture may not work in production!\n");
    }
    return;
  }

  // No binary found
  console.error("❌ No audiotee binary found!");
  console.error(`   Checked paths:`);
  console.error(`   - ${customBinaryPath}`);
  console.error(`   - ${npmBinaryPath}`);
  console.warn("   System audio capture will not work in production!");
};

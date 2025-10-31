/**
 * afterAllArtifactBuild hook for electron-builder
 * This runs AFTER all signing and notarization
 * We use this to sign the helper app with correct entitlements
 * because electron-builder's entitlementsInherit was overwriting them
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = async function (context) {
  console.log("\n" + "=".repeat(80));
  console.log(
    "🔒 afterAllArtifactBuild: Signing helper app with correct entitlements"
  );
  console.log("=".repeat(80));

  // Only process macOS builds
  if (context.platformToTargets.get("mac") === undefined) {
    console.log("ℹ️  Skipping: Not a macOS build");
    return;
  }

  // Get the app path from artifacts
  const macArtifacts = context.artifactPaths.filter(
    (p) => p.endsWith(".app") || p.includes(".app/")
  );

  if (macArtifacts.length === 0) {
    console.warn("⚠️  No macOS app artifacts found");
    return;
  }

  // Find the .app bundle
  let appPath = macArtifacts[0];
  if (!appPath.endsWith(".app")) {
    // Extract .app path from full artifact path
    const appMatch = appPath.match(/(.+\.app)/);
    if (appMatch) {
      appPath = appMatch[1];
    }
  }

  console.log("📦 Found app:", appPath);

  const helperPath = path.join(
    appPath,
    "Contents",
    "Resources",
    "Library",
    "LoginItems",
    "AudioTeeHelper.app"
  );

  if (!fs.existsSync(helperPath)) {
    console.error("❌ Helper app not found at:", helperPath);
    throw new Error("Helper app not found - cannot sign");
  }

  console.log("✅ Found helper app:", helperPath);

  // Get signing identity from environment
  const identity =
    process.env.CSC_NAME ||
    process.env.APPLE_IDENTITY ||
    process.env.CSC_IDENTITY_AUTO_DISCOVERY;

  if (!identity || identity === "-") {
    console.warn(
      "⚠️  No signing identity found - helper app will remain unsigned"
    );
    console.warn("   This is OK for development, but REQUIRED for production!");
    return;
  }

  console.log("🔐 Using signing identity:", identity);

  // Path to helper-specific entitlements
  const helperEntitlementsPath = path.join(
    context.projectDir,
    "helper-apps",
    "AudioTeeHelper",
    "entitlements.plist"
  );

  if (!fs.existsSync(helperEntitlementsPath)) {
    console.error(
      "❌ Helper entitlements not found at:",
      helperEntitlementsPath
    );
    throw new Error("Helper entitlements file not found");
  }

  console.log("📜 Using helper entitlements:", helperEntitlementsPath);

  try {
    // Sign the binary first
    const binaryPath = path.join(helperPath, "Contents", "MacOS", "audiotee");
    console.log("\n🔏 Signing helper binary...");

    const signBinaryCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${binaryPath}"`;
    execSync(signBinaryCommand, { stdio: "inherit", timeout: 30000 });
    console.log("✅ Helper binary signed");

    // Sign the app bundle
    console.log("\n🔏 Signing helper app bundle...");
    const signAppCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${helperPath}"`;
    execSync(signAppCommand, { stdio: "inherit", timeout: 30000 });
    console.log("✅ Helper app bundle signed");

    // Verify signature
    console.log("\n🔍 Verifying helper app signature...");
    const verifyCommand = `codesign --verify --deep --strict --verbose=2 "${helperPath}"`;
    execSync(verifyCommand, { stdio: "inherit", timeout: 10000 });
    console.log("✅ Helper app signature verified");

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
      throw new Error("Helper missing screen-capture entitlement");
    }

    if (hasSandboxFalse) {
      console.log("✅ Helper has app-sandbox disabled");
    } else if (entitlementsOutput.includes("com.apple.security.app-sandbox")) {
      console.error(
        "❌ CRITICAL: Helper has app-sandbox ENABLED (should be false)!"
      );
      console.error("   Core Audio Taps will be blocked!");
      throw new Error("Helper has app-sandbox enabled");
    } else {
      console.log("✅ Helper has no app-sandbox (defaults to disabled)");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Helper app signed and verified with correct entitlements!");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ FAILED: Helper app signing/verification failed!");
    console.error("=".repeat(80));
    console.error("Error:", error.message);
    throw error; // Fail the build
  }
};

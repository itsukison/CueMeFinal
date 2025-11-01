#!/usr/bin/env node

/**
 * afterSign hook for electron-builder (macOS)
 * Ensures the AudioTee helper app is signed with the helper entitlements
 * before electron-builder creates DMG/ZIP artifacts.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = async function (context) {
  console.log("\n" + "=".repeat(80));
  console.log("🔒 afterSign: Signing helper app with correct entitlements");
  console.log("=".repeat(80));

  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") {
    console.log("ℹ️  Skipping: not a macOS build");
    return;
  }

  if (!appOutDir || !packager) {
    console.warn("⚠️  Missing appOutDir or packager in afterSign context");
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log("📦 App path:", appPath);

  if (!fs.existsSync(appPath)) {
    console.error("❌ App bundle not found at:", appPath);
    return;
  }

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

  const identity =
    process.env.CSC_NAME ||
    process.env.APPLE_IDENTITY ||
    process.env.CSC_IDENTITY_AUTO_DISCOVERY;

  if (!identity || identity === "-") {
    console.warn("⚠️  No signing identity found - helper will remain unsigned");
    console.warn("   This is OK for development, but REQUIRED for production!");
    return;
  }

  console.log("🔐 Using signing identity:", identity);

  const helperEntitlementsPath = path.join(
    context.packager.projectDir,
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

  const helperBinaryPath = path.join(
    helperPath,
    "Contents",
    "MacOS",
    "audiotee"
  );

  try {
    console.log("\n🔏 Signing helper binary...");
    execSync(
      `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${helperBinaryPath}"`,
      { stdio: "inherit", timeout: 30000 }
    );
    console.log("✅ Helper binary signed");

    console.log("\n🔏 Signing helper app bundle...");
    execSync(
      `codesign --force --sign "${identity}" --options runtime --entitlements "${helperEntitlementsPath}" --timestamp "${helperPath}"`,
      { stdio: "inherit", timeout: 30000 }
    );
    console.log("✅ Helper app bundle signed");

    console.log("\n🔍 Verifying helper app signature...");
    execSync(`codesign --verify --deep --strict --verbose=2 "${helperPath}"`, {
      stdio: "inherit",
      timeout: 10000,
    });
    console.log("✅ Helper app signature verified");

    console.log("\n🔍 Verifying helper app entitlements...");
    const entitlementsOutput = execSync(
      `codesign -d --entitlements - "${helperPath}" 2>&1`,
      {
        encoding: "utf8",
        timeout: 10000,
      }
    );

    const hasScreenCapture = entitlementsOutput.includes(
      "com.apple.security.device.screen-capture"
    );
    const hasSandboxDisabled = entitlementsOutput.match(
      /com\.apple\.security\.app-sandbox[\s\S]*?\[Bool\]\s*false/i
    );

    if (!hasScreenCapture) {
      console.error("❌ Helper missing screen-capture entitlement");
      throw new Error("Helper missing screen-capture entitlement");
    }

    console.log("✅ Helper has screen-capture entitlement");

    if (!hasSandboxDisabled) {
      console.error("❌ Helper app-sandbox is not disabled");
      throw new Error("Helper app-sandbox is not disabled");
    }

    console.log("✅ Helper app-sandbox disabled");
    console.log("\n" + "=".repeat(80));
    console.log("✅ Helper app signed with correct entitlements (afterSign)");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ FAILED: Helper signing in afterSign");
    console.error("=".repeat(80));
    console.error("Error:", error.message);
    throw error;
  }
};

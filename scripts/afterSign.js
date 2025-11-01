#!/usr/bin/env node

/**
 * afterSign hook for electron-builder (macOS)
 * Following article approach - binary signing happens in afterPack
 * This hook is kept for potential future post-sign verification
 */

module.exports = async function (context) {
  console.log("\n🔒 afterSign: Main app signed");
  console.log("   (audiotee binary signing handled in afterPack)\n");

  // No additional signing needed - article approach uses afterPack for binary
  return;
};

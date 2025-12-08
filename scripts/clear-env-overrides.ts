#!/usr/bin/env ts-node
/**
 * Clear Environment Overrides Script
 * ===================================
 *
 * Generates a shell script to clear all capability environment overrides.
 *
 * USAGE:
 *   npm run capability:clear-env-overrides
 *   npm run capability:clear-env-overrides > clear-overrides.sh && chmod +x clear-overrides.sh && ./clear-overrides.sh
 */

import { generateClearOverridesScript } from '../core/config/env-override-safety';

function main(): void {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
Clear Environment Overrides
===========================

Generates a shell script to unset all capability environment variables.

Usage:
  npm run capability:clear-env-overrides              # Print script to stdout
  npm run capability:clear-env-overrides > clear.sh   # Save to file

After generating, run:
  chmod +x clear.sh && source clear.sh

Or manually unset specific variables:
  unset CAPABILITY_EXTERNAL_AFIP
  unset CAPABILITY_EXTERNAL_WHATSAPP
`);
    return;
  }

  const script = generateClearOverridesScript();
  console.log(script);
}

main();

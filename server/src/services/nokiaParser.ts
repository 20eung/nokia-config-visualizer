/**
 * Nokia Config Parser (Backend)
 * v5.5.0 - Auto-parsing feature
 *
 * This is a thin wrapper around nokiaParserCore.ts (copied from Frontend parserV3.ts).
 * Frontend parser is pure TypeScript with no browser APIs, so it works in backend.
 */

import {
  parseL2VPNConfig,
  extractHostname,
  extractSystemIp,
  parseQosPolicyDefinitions,
  parseSDPs,
} from './nokiaParserCore';

import type { ParsedConfigV3, SDP } from '../types';

/**
 * Main Parser Function - Parse Nokia SR-OS config file
 *
 * @param configText - Raw Nokia config file content (TiMOS format)
 * @returns ParsedConfigV3 - Structured config data (services, SDPs, connections)
 */
export function parseNokiaConfig(configText: string): ParsedConfigV3 {
  console.log('[nokiaParser] Parsing Nokia config...');

  try {
    // Call core parser (1677 lines of battle-tested logic)
    const result = parseL2VPNConfig(configText);

    console.log(`[nokiaParser] Parsed successfully: ${result.hostname}, ${result.services.length} services`);

    return result;
  } catch (error) {
    console.error('[nokiaParser] Parsing failed:', error);
    throw new Error(`Nokia config parsing failed: ${(error as Error).message}`);
  }
}

/**
 * Re-export helper functions for external use
 */
export {
  extractHostname,
  extractSystemIp,
  parseQosPolicyDefinitions,
  parseSDPs,
};

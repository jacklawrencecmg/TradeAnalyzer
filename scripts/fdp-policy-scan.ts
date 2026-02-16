#!/usr/bin/env node
/**
 * FDP Policy Scanner
 *
 * Prevents merges/deploys if code bypasses FDP canonical values.
 *
 * FAILS BUILD if it finds:
 * - SQL queries to value tables outside src/lib/fdp/**
 * - Value calculations in rankings/trade/advice/export modules
 * - Endpoints returning values without value_epoch
 * - Direct imports of value tables
 *
 * Usage:
 *   npm run fdp-scan
 *   npm test (includes scan)
 *   npm run release (includes scan)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Violation {
  file: string;
  line: number;
  rule: string;
  message: string;
  snippet: string;
}

const violations: Violation[] = [];

// Prohibited table names (cannot be queried outside FDP module)
const PROHIBITED_TABLES = [
  'latest_player_values',
  'player_value_history',
  'player_values',
  'ktc_value_snapshots',
];

// Prohibited patterns (value calculations)
const PROHIBITED_PATTERNS = [
  /value\s*=\s*\d+/,                          // value = 123
  /value\s*=\s*calculateValue/,               // value = calculateValue(...)
  /value\s*=\s*baseValue\s*[+\-*/]/,         // value = baseValue + ...
  /\{\s*value:\s*\d+/,                        // { value: 123 }
  /player\.value\s*=\s*/,                     // player.value = ...
  /return.*value:\s*\d+/,                     // return { value: 123 }
];

// File patterns to scan
const SCAN_PATTERNS = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'supabase/functions/**/*.ts',
];

// Files/directories to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  '__pycache__',
  '.git',
  'src/lib/fdp/getFDPValue.ts',              // Allowed
  'src/lib/fdp/verifyFDPConsistency.ts',    // Allowed
  'src/tests/',                              // Test files allowed
  'scripts/fdp-policy-scan.ts',             // Self
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function scanFile(filePath: string): void {
  if (shouldExclude(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for direct table queries
    for (const table of PROHIBITED_TABLES) {
      if (line.includes(`from('${table}')`) || line.includes(`from("${table}")`)) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'DIRECT_TABLE_QUERY',
          message: `Direct query to ${table} is prohibited. Use getFDPValue() instead.`,
          snippet: line.trim(),
        });
      }
    }

    // Check for value calculations in specific modules
    if (
      filePath.includes('/rankings/') ||
      filePath.includes('/trade/') ||
      filePath.includes('/advice/') ||
      filePath.includes('/export/')
    ) {
      for (const pattern of PROHIBITED_PATTERNS) {
        if (pattern.test(line) && !line.includes('getFDPValue')) {
          violations.push({
            file: filePath,
            line: lineNum,
            rule: 'VALUE_CALCULATION',
            message: 'Value calculation outside FDP module is prohibited.',
            snippet: line.trim(),
          });
        }
      }
    }

    // Check for endpoint responses without value_epoch
    if (
      line.includes('return') &&
      line.includes('value') &&
      content.includes('Response') &&
      !content.includes('value_epoch')
    ) {
      if (filePath.includes('supabase/functions/')) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'MISSING_VALUE_EPOCH',
          message: 'Endpoint returns value without value_epoch.',
          snippet: line.trim(),
        });
      }
    }

    // Check for direct supabase imports in business logic
    if (
      line.includes("from '../supabase'") ||
      line.includes('from "../supabase"')
    ) {
      if (
        !filePath.includes('/lib/fdp/') &&
        !filePath.includes('/lib/supabase.ts') &&
        !filePath.includes('supabase/functions/')
      ) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'DIRECT_SUPABASE_IMPORT',
          message: 'Direct supabase import in business logic. Use getFDPValue() instead.',
          snippet: line.trim(),
        });
      }
    }

    // Check for .value access without getFDPValue
    if (
      line.match(/\.value\s*[)};,]/) &&
      !line.includes('getFDPValue') &&
      !line.includes('fdpValue') &&
      !line.includes('canonicalValue') &&
      !line.includes('// allowed')
    ) {
      if (
        filePath.includes('/components/') ||
        filePath.includes('/lib/rankings') ||
        filePath.includes('/lib/trade')
      ) {
        violations.push({
          file: filePath,
          line: lineNum,
          rule: 'UNSAFE_VALUE_ACCESS',
          message: 'Direct .value access without FDP validation.',
          snippet: line.trim(),
        });
      }
    }
  });
}

function scanDirectory(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExclude(fullPath)) continue;

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(fullPath);
    }
  }
}

function printReport(): void {
  console.log('\n===========================================');
  console.log('       FDP POLICY SCANNER REPORT');
  console.log('===========================================\n');

  if (violations.length === 0) {
    console.log('✓ FDP POLICY ENFORCED');
    console.log('✓ No violations found');
    console.log('✓ All code paths use canonical FDP values\n');
    return;
  }

  console.log(`✗ POLICY VIOLATIONS DETECTED: ${violations.length}\n`);

  // Group by rule
  const byRule = new Map<string, Violation[]>();
  violations.forEach(v => {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule)!.push(v);
  });

  for (const [rule, ruleViolations] of byRule) {
    console.log(`\n[${rule}] ${ruleViolations.length} violation(s):`);
    console.log('─'.repeat(60));

    ruleViolations.forEach(v => {
      console.log(`\n  File: ${v.file}:${v.line}`);
      console.log(`  Rule: ${v.message}`);
      console.log(`  Code: ${v.snippet}`);
    });
  }

  console.log('\n===========================================');
  console.log('BUILD BLOCKED - FDP POLICY VIOLATIONS');
  console.log('===========================================\n');
  console.log('Fix violations by:');
  console.log('  1. Replace direct table queries with getFDPValue()');
  console.log('  2. Remove value calculations outside FDP module');
  console.log('  3. Add value_epoch to all value responses');
  console.log('  4. Use canonical FDP interface\n');
}

function main(): void {
  const projectRoot = path.resolve(__dirname, '..');

  console.log('Scanning for FDP policy violations...');
  console.log(`Root: ${projectRoot}\n`);

  // Scan src directory
  const srcDir = path.join(projectRoot, 'src');
  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir);
  }

  // Scan supabase functions
  const functionsDir = path.join(projectRoot, 'supabase', 'functions');
  if (fs.existsSync(functionsDir)) {
    scanDirectory(functionsDir);
  }

  printReport();

  // Exit with error if violations found
  if (violations.length > 0) {
    process.exit(1);
  }
}

main();

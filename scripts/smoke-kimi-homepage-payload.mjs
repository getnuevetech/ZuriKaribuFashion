#!/usr/bin/env node

import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const readArg = (name) => {
  const withEquals = args.find((entry) => entry.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = args.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) return args[index + 1];
  return undefined;
};

const baseUrlInput = readArg('base') || process.env.API_BASE_URL || 'http://localhost:3001/api';
const timeoutMs = Number(readArg('timeout') || process.env.API_SMOKE_TIMEOUT_MS || 12000);
const baseUrl = String(baseUrlInput || '').trim().replace(/\/+$/, '');
const endpoint = '/homepage-sections/kimi-homepage-payload';

if (!baseUrl) {
  console.error('Missing API base URL. Pass --base=https://your-api-domain/api');
  process.exit(1);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
const started = Date.now();

const requiredKeys = [
  'contractVersion',
  'generatedAt',
  'visibility',
  'topStrip',
  'statsStrip',
  'howItWorksStyle',
  'featuredProductDescription',
  'authPageSettings',
  'experienceSettings',
  'heroSlides',
  'managedBanners',
  'promoBadge',
  'countries',
  'categories',
  'howItWorks',
  'designerSpotlights',
  'featuredCollections',
  'heritage',
  'testimonials',
  'footer',
  'shopByBlocks',
  'freshDrops',
  'newsletter',
];

const requiredFeaturedSections = [
  'FEATURED_DESIGNS',
  'FEATURED_FABRICS',
  'FEATURED_READY_TO_WEAR',
  'TRENDING_NOW',
];

const printFail = (message) => {
  console.error(`\nKimi payload smoke test FAILED: ${message}`);
  process.exit(2);
};

try {
  console.log(`\nKimi payload smoke test: ${baseUrl}${endpoint}`);
  console.log(`Timeout: ${timeoutMs}ms`);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    signal: controller.signal,
  });
  const rawText = await response.text();
  let parsed;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (response.status !== 200) {
    printFail(`expected HTTP 200, got ${response.status}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    printFail('response is not valid JSON object');
  }
  if (parsed.success !== true) {
    printFail(`response.success is not true (value: ${String(parsed.success)})`);
  }
  const data = parsed.data;
  if (!data || typeof data !== 'object') {
    printFail('response.data is missing or invalid');
  }

  const missingKeys = requiredKeys.filter((key) => !(key in data));
  if (missingKeys.length > 0) {
    printFail(`missing required keys: ${missingKeys.join(', ')}`);
  }

  if (String(data.contractVersion || '') !== 'KIMI_HOMEPAGE_PAYLOAD_V1') {
    printFail(`unexpected contractVersion: ${String(data.contractVersion || '')}`);
  }
  if (!data.generatedAt || Number.isNaN(Date.parse(String(data.generatedAt)))) {
    printFail('generatedAt is missing or not a valid ISO timestamp');
  }

  const featuredCollections = data.featuredCollections;
  if (!featuredCollections || typeof featuredCollections !== 'object') {
    printFail('featuredCollections is missing or invalid');
  }
  const missingFeaturedSections = requiredFeaturedSections.filter(
    (key) => !(key in featuredCollections) || !Array.isArray(featuredCollections[key])
  );
  if (missingFeaturedSections.length > 0) {
    printFail(`featuredCollections missing required arrays: ${missingFeaturedSections.join(', ')}`);
  }

  const payloadForChecksum = {
    visibility: data.visibility,
    topStrip: data.topStrip,
    statsStrip: data.statsStrip,
    howItWorksStyle: data.howItWorksStyle,
    featuredProductDescription: data.featuredProductDescription,
    authPageSettings: data.authPageSettings,
    experienceSettings: data.experienceSettings,
    heroSlides: data.heroSlides,
    managedBanners: data.managedBanners,
    promoBadge: data.promoBadge,
    countries: data.countries,
    categories: data.categories,
    howItWorks: data.howItWorks,
    designerSpotlights: data.designerSpotlights,
    featuredCollections: data.featuredCollections,
    heritage: data.heritage,
    testimonials: data.testimonials,
    footer: data.footer,
    shopByBlocks: data.shopByBlocks,
    freshDrops: data.freshDrops,
    newsletter: data.newsletter,
  };

  const recomputedChecksum = createHash('sha256')
    .update(JSON.stringify({ contractVersion: data.contractVersion, payload: payloadForChecksum }))
    .digest('hex');

  const payloadChecksum = String(data.payloadChecksum || '').trim();
  if (payloadChecksum) {
    if (payloadChecksum !== recomputedChecksum) {
      printFail(`checksum mismatch (expected ${recomputedChecksum}, got ${payloadChecksum})`);
    }
    console.log(`Checksum: ${payloadChecksum} (verified)`);
  } else {
    console.log('Checksum: not present (optional, skipped verification)');
  }

  const elapsedMs = Date.now() - started;
  console.log(`Contract version: ${data.contractVersion}`);
  console.log(`Generated at: ${data.generatedAt}`);
  console.log(`Validated keys: ${requiredKeys.length}`);
  console.log(`Duration: ${elapsedMs}ms`);
  console.log('\nKimi payload smoke test passed.');
} catch (error) {
  printFail(error instanceof Error ? error.message : String(error || 'Request failed'));
} finally {
  clearTimeout(timer);
}

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
const payloadEndpoint = '/homepage-sections/kimi-homepage-payload';
const experienceEndpoint = '/homepage-sections/experience-settings';

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
  console.log(`\nKimi payload smoke test: ${baseUrl}${payloadEndpoint}`);
  console.log(`Timeout: ${timeoutMs}ms`);

  const response = await fetch(`${baseUrl}${payloadEndpoint}`, {
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

  const experienceResponse = await fetch(`${baseUrl}${experienceEndpoint}`, {
    method: 'GET',
    signal: controller.signal,
  });
  const experienceRawText = await experienceResponse.text();
  let experienceParsed;
  try {
    experienceParsed = experienceRawText ? JSON.parse(experienceRawText) : null;
  } catch {
    experienceParsed = null;
  }
  if (experienceResponse.status !== 200) {
    printFail(`experience settings endpoint expected HTTP 200, got ${experienceResponse.status}`);
  }
  if (!experienceParsed || typeof experienceParsed !== 'object' || experienceParsed.success !== true) {
    printFail('experience settings response is invalid');
  }
  const experience = experienceParsed.data;
  if (!experience || typeof experience !== 'object') {
    printFail('experience settings data is missing');
  }
  const requiredExperienceKeys = [
    'enabledModes',
    'defaultMode',
    'themeModes',
    'defaultThemeMode',
    'homepageTemplate',
    'rolloutMode',
    'allowPreviewQuery',
    'previewQueryParam',
    'trustBadges',
    'kimiCopy',
  ];
  const missingExperienceKeys = requiredExperienceKeys.filter((key) => !(key in experience));
  if (missingExperienceKeys.length > 0) {
    printFail(`experience settings missing required keys: ${missingExperienceKeys.join(', ')}`);
  }
  if (!['LEGACY', 'KIMI'].includes(String(experience.homepageTemplate || ''))) {
    printFail(`experience settings homepageTemplate is invalid: ${String(experience.homepageTemplate || '')}`);
  }
  if (!['LIVE', 'PREVIEW_SAFE'].includes(String(experience.rolloutMode || ''))) {
    printFail(`experience settings rolloutMode is invalid: ${String(experience.rolloutMode || '')}`);
  }
  if (!Array.isArray(experience.enabledModes) || experience.enabledModes.length === 0) {
    printFail('experience settings enabledModes is empty');
  }
  if (!Array.isArray(experience.themeModes) || experience.themeModes.length === 0) {
    printFail('experience settings themeModes is empty');
  }
  if (typeof experience.previewQueryParam !== 'string' || !experience.previewQueryParam.trim()) {
    printFail('experience settings previewQueryParam is missing');
  }
  if (!Array.isArray(experience.trustBadges)) {
    printFail('experience settings trustBadges is invalid');
  }
  if (!experience.kimiCopy || typeof experience.kimiCopy !== 'object') {
    printFail('experience settings kimiCopy is invalid');
  }

  const elapsedMs = Date.now() - started;
  console.log(`Contract version: ${data.contractVersion}`);
  console.log(`Generated at: ${data.generatedAt}`);
  console.log(`Validated keys: ${requiredKeys.length}`);
  console.log(
    `Runtime settings: ${String(experience.homepageTemplate || 'UNKNOWN')}/${String(experience.rolloutMode || 'UNKNOWN')}`
  );
  console.log(`Duration: ${elapsedMs}ms`);
  console.log('\nKimi payload smoke test passed.');
} catch (error) {
  printFail(error instanceof Error ? error.message : String(error || 'Request failed'));
} finally {
  clearTimeout(timer);
}

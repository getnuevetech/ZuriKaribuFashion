const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

const KNOWN_STATIC_OR_INTERNAL_PATTERNS = [
  /^\/$/,
  /^\/jenks$/,
  /^\/jenks-dynamic$/,
  /^\/home-jenks$/,
  /^\/home-kimi$/,
  /^\/home-jenks-static$/,
  /^\/kimi-v14-r20260320-35\/index\.html(?:\?.*)?$/,
  /^\/shop$/,
  /^\/cart$/,
  /^\/ready-to-wear(?:\/[^/?#]+)?$/,
  /^\/fabrics(?:\/[^/?#]+)?$/,
  /^\/custom(?:\/[^/?#]+)?$/,
  /^\/designs(?:\/[^/?#]+)?$/,
  /^\/country-products(?:\?.*)?$/,
  /^\/contact$/,
  /^\/contact-us$/,
  /^\/login$/,
  /^\/signin$/,
  /^\/sign-in$/,
  /^\/register$/,
  /^\/signup$/,
  /^\/sign-up$/,
  /^\/forgot-password$/,
  /^\/forgot$/,
  /^\/forgotpassword$/,
  /^\/reset-password(?:\?.*)?$/,
  /^\/auth\/login$/,
  /^\/auth\/register$/,
  /^\/auth\/forgot-password$/,
  /^\/auth\/reset-password(?:\?.*)?$/,
  /^\/help-center$/,
  /^\/seller-designer-support$/,
  /^\/stories\/[^/?#]+$/,
  /^\/rtw$/,
  /^\/readytowear$/,
  /^\/ftb$/,
  /^\/fabric$/,
  /^\/fabric-to-buy$/,
  /^\/fabrics-to-buy$/,
  /^\/ctw$/,
  /^\/customtowear$/,
  /^\/about$/,
  /^\/about-us$/,
  /^\/designers$/,
  /^\/support$/,
  /^\/faq$/,
];

const isKnownInternalPath = (path) => KNOWN_STATIC_OR_INTERNAL_PATTERNS.some((pattern) => pattern.test(path));

test.describe('JENKS CTA crawl + auth route hardening', () => {
  test('crawl /jenks anchors and verify internal href coverage', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    // Static Jenks page can keep long-lived asset activity; domcontentloaded is a safer readiness gate.
    await page.goto(`${BASE_URL}/jenks`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(main\/?|jenks|kimi-v14-r20260320-35\/index\.html)(\?.*)?(#.*)?$/);

    const hrefs = await page.$$eval('a[href]', (anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute('href') || '')
        .map((href) => href.trim())
        .filter(Boolean)
    );

    const internalPaths = Array.from(
      new Set(
        hrefs
          .filter((href) => href.startsWith('/') || href.startsWith('#/'))
          .map((href) => {
            const normalizedHref = href.startsWith('#/') ? href.slice(1) : href;
            try {
              const url = new URL(`http://local${normalizedHref}`);
              return `${url.pathname}${url.search}`;
            } catch {
              return normalizedHref;
            }
          })
      )
    );

    const unknownInternalPaths = internalPaths.filter((path) => !isKnownInternalPath(path));
    expect(
      unknownInternalPaths,
      `Unknown internal hrefs found in /jenks page: ${unknownInternalPaths.join(', ')}`
    ).toEqual([]);

    // Route-level crawl for discovered internal links.
    for (const path of internalPaths) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      // We consider routed page healthy if React root is present.
      await expect(page.locator('#root')).toBeVisible();
    }

    expect(consoleErrors, `Console errors found while crawling /jenks: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('auth pages are present and alias routes resolve correctly', async ({ page }) => {
    const authRouteExpectations = [
      ['/login', /\/login$/],
      ['/signin', /\/login$/],
      ['/sign-in', /\/login$/],
      ['/auth/login', /\/login$/],
      ['/register', /\/register$/],
      ['/signup', /\/register$/],
      ['/sign-up', /\/register$/],
      ['/auth/register', /\/register$/],
      ['/forgot-password', /\/forgot-password$/],
      ['/forgot', /\/forgot-password$/],
      ['/forgotpassword', /\/forgot-password$/],
      ['/auth/forgot-password', /\/forgot-password$/],
      ['/reset-password?token=fake-token', /\/reset-password\?token=fake-token$/],
      ['/auth/reset-password?token=fake-token', /\/reset-password\?token=fake-token$/],
    ];

    for (const [route, expectedUrlPattern] of authRouteExpectations) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(expectedUrlPattern);
      await expect(page.locator('#root')).toBeVisible();
    }

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register|create account|sign up/i })).toBeVisible();

    await page.goto(`${BASE_URL}/register`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /create account|register|sign up/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in|login/i })).toBeVisible();

    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /send reset link|send/i })).toBeVisible();

    await page.goto(`${BASE_URL}/reset-password?token=fake-token`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/reset password|token|password/i);
  });
});


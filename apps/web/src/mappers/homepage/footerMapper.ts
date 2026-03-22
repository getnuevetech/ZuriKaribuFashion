type FooterNavLink = {
  label: string;
  href: string;
};

type FooterPolicyLink = {
  label: string;
  href: string;
};

export type FooterMapperResult = {
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  copyright: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    twitter: string;
  };
  menus: {
    shop: FooterNavLink[];
    company: FooterNavLink[];
    support: FooterNavLink[];
  };
  policies: {
    privacy: FooterPolicyLink;
    terms: FooterPolicyLink;
  };
};

const FOOTER_DEFAULT_MENUS: Record<'shop' | 'company' | 'support', FooterNavLink[]> = {
  shop: [
    { label: 'Ready To Wear', href: '/ready-to-wear' },
    { label: 'Custom To Wear', href: '/designs' },
    { label: 'Fabrics To Buy', href: '/fabrics' },
    { label: 'New Arrivals', href: '/ready-to-wear' },
  ],
  company: [
    { label: 'About Us', href: '/#about' },
    { label: 'Our Designers', href: '/designs' },
    { label: 'Sustainability', href: '/#about' },
    { label: 'Careers', href: '/#contact' },
  ],
  support: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'Customer FAQs', href: '/help-center' },
    { label: 'Seller/Designer Support', href: '/seller-designer-support' },
    { label: 'Returns & Support', href: '/help-center' },
  ],
};

const FOOTER_DEFAULT_POLICIES: Record<'privacy' | 'terms', FooterPolicyLink> = {
  privacy: { label: 'Privacy Policy', href: '#' },
  terms: { label: 'Terms of Service', href: '#' },
};

const asText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const parseObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
};

const normalizeFooterNavLinks = (raw: unknown, fallback: FooterNavLink[]): FooterNavLink[] => {
  if (!Array.isArray(raw)) return fallback;
  const parsed = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const label = asText(row.label);
      const href = asText(row.href, row.url, '#');
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((entry): entry is FooterNavLink => Boolean(entry));
  return parsed.length > 0 ? parsed : fallback;
};

const normalizePolicyLink = (raw: unknown, fallback: FooterPolicyLink): FooterPolicyLink => {
  const row = parseObject(raw);
  if (!row) return fallback;
  return {
    label: asText(row.label, fallback.label),
    href: asText(row.href, row.link, row.externalUrl, fallback.href),
  };
};

const ensureFooterLink = (links: FooterNavLink[], requiredLink: FooterNavLink): FooterNavLink[] => {
  const exists = links.some((entry) => entry.href.trim().toLowerCase() === requiredLink.href.trim().toLowerCase());
  if (exists) return links;
  return [...links, requiredLink];
};

const parseFooterConfig = (rawFooter: any) => {
  // Support both dedicated config payload and legacy socialLinks JSON container.
  const config =
    parseObject(rawFooter?.config) ||
    parseObject(rawFooter?.settings) ||
    parseObject(rawFooter?.socialLinks) ||
    null;
  if (!config) {
    return {
      menus: { ...FOOTER_DEFAULT_MENUS },
      policies: { ...FOOTER_DEFAULT_POLICIES },
    };
  }
  const rawMenus = parseObject(config.menus) || {};
  const rawPolicies = parseObject(config.policies) || {};
  const supportLinks = ensureFooterLink(
    normalizeFooterNavLinks(rawMenus.support, FOOTER_DEFAULT_MENUS.support),
    { label: 'Seller/Designer Support', href: '/seller-designer-support' }
  );
  return {
    menus: {
      shop: normalizeFooterNavLinks(rawMenus.shop, FOOTER_DEFAULT_MENUS.shop),
      company: normalizeFooterNavLinks(rawMenus.company, FOOTER_DEFAULT_MENUS.company),
      support: ensureFooterLink(supportLinks, { label: 'Customer FAQs', href: '/help-center' }),
    },
    policies: {
      privacy: normalizePolicyLink(rawPolicies.privacy, FOOTER_DEFAULT_POLICIES.privacy),
      terms: normalizePolicyLink(rawPolicies.terms, FOOTER_DEFAULT_POLICIES.terms),
    },
  };
};

export const mapFooterContent = (rawFooter: unknown): FooterMapperResult => {
  const row = rawFooter && typeof rawFooter === 'object' ? (rawFooter as Record<string, unknown>) : {};
  const socialContainer = parseObject(row.socialLinks) || {};
  const config = parseFooterConfig(row);

  return {
    companyName: asText(row.companyName, 'ZURIKARIBU'),
    tagline: asText(
      row.tagline,
      'Wear the story of Africa. Discover authentic fashion crafted by talented African designers.'
    ),
    email: asText(row.email, 'hello@zurikaribu.com'),
    phone: asText(row.phone, '+1 (555) 123-4567'),
    address: asText(row.address, 'Lagos, Nigeria'),
    copyright: asText(row.copyright, '© 2026 ZuriKaribu. All rights reserved.'),
    socialLinks: {
      instagram: asText((socialContainer as any).instagram, '#'),
      facebook: asText((socialContainer as any).facebook, '#'),
      twitter: asText((socialContainer as any).twitter, '#'),
    },
    menus: config.menus,
    policies: config.policies,
  };
};

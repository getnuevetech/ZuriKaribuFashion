import { Facebook, Instagram, Mail, MapPin, Phone, Twitter } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

type FooterNavLink = {
  label: string;
  href: string;
};

type FooterPolicyLink = {
  label: string;
  href: string;
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
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
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
  if (!raw || typeof raw !== 'object') return fallback;
  const row = raw as Record<string, unknown>;
  return {
    label: asText(row.label, fallback.label),
    href: asText(row.href, row.link, row.externalUrl, fallback.href),
  };
};

export default function Footer() {
  const { data: footerContent } = useQuery({
    queryKey: ['homepageFooterContent'],
    queryFn: async () => {
      const response = await api.homepageSections.getFooter();
      return response.success ? response.data : null;
    },
  });

  const socialLinks = useMemo(() => {
    const fallback = { instagram: '#', facebook: '#', twitter: '#' };
    const raw = footerContent?.socialLinks;
    if (!raw) return fallback;
    if (typeof raw === 'object') {
      return {
        instagram: raw.instagram || '#',
        facebook: raw.facebook || '#',
        twitter: raw.twitter || '#',
      };
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return {
          instagram: parsed?.instagram || '#',
          facebook: parsed?.facebook || '#',
          twitter: parsed?.twitter || '#',
        };
      } catch {
        return fallback;
      }
    }
    return fallback;
  }, [footerContent?.socialLinks]);
  const footerConfig = useMemo(() => {
    const fallback = {
      menus: { ...FOOTER_DEFAULT_MENUS },
      policies: { ...FOOTER_DEFAULT_POLICIES },
    };
    const raw = footerContent?.socialLinks;
    if (!raw) return fallback;
    const parsed =
      typeof raw === 'string'
        ? (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }
          })()
        : typeof raw === 'object'
          ? raw
          : null;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const row = parsed as Record<string, unknown>;
    const rawMenus = (row.menus && typeof row.menus === 'object' ? row.menus : {}) as Record<string, unknown>;
    const rawPolicies =
      (row.policies && typeof row.policies === 'object' ? row.policies : {}) as Record<string, unknown>;
    return {
      menus: {
        shop: normalizeFooterNavLinks(rawMenus.shop, FOOTER_DEFAULT_MENUS.shop),
        company: normalizeFooterNavLinks(rawMenus.company, FOOTER_DEFAULT_MENUS.company),
        support: normalizeFooterNavLinks(rawMenus.support, FOOTER_DEFAULT_MENUS.support),
      },
      policies: {
        privacy: normalizePolicyLink(rawPolicies.privacy, FOOTER_DEFAULT_POLICIES.privacy),
        terms: normalizePolicyLink(rawPolicies.terms, FOOTER_DEFAULT_POLICIES.terms),
      },
    };
  }, [footerContent?.socialLinks]);

  const companyName = footerContent?.companyName?.trim() || 'ZURIKARIBU';
  const tagline =
    footerContent?.tagline?.trim() ||
    'Wear the story of Africa. Discover authentic fashion crafted by talented African designers.';
  const email = footerContent?.email?.trim() || 'hello@zurikaribu.com';
  const phone = footerContent?.phone?.trim() || '+1 (555) 123-4567';
  const address = footerContent?.address?.trim() || 'Lagos, Nigeria';
  const copyright =
    footerContent?.copyright?.trim() || '© 2026 ZuriKaribu. All rights reserved.';

  return (
    <footer className="bg-black text-white py-16 lg:py-20">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="font-['Oswald'] text-2xl font-bold mb-4">{companyName.toUpperCase()}</h3>
            <p className="text-white/60 mb-6 max-w-sm">{tagline}</p>
            <div className="flex items-center gap-4">
              <div className="flex gap-4">
                <a href={socialLinks.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href={socialLinks.facebook} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href={socialLinks.twitter} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              {footerConfig.menus.shop.map((item, index) => (
                <li key={`shop-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {footerConfig.menus.company.map((item, index) => (
                <li key={`company-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              {footerConfig.menus.support.map((item, index) => (
                <li key={`support-${index}`}>
                  <a href={item.href} className="text-white/60 hover:text-white transition-colors text-sm">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 py-8 border-t border-white/10 mb-8">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Mail className="w-4 h-4" />
            <span>{email}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Phone className="w-4 h-4" />
            <span>{phone}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <MapPin className="w-4 h-4" />
            <span>{address}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm">{copyright}</p>
          <div className="flex gap-6">
            <a href={footerConfig.policies.privacy.href} className="text-white/40 hover:text-white text-sm transition-colors">
              {footerConfig.policies.privacy.label}
            </a>
            <a href={footerConfig.policies.terms.href} className="text-white/40 hover:text-white text-sm transition-colors">
              {footerConfig.policies.terms.label}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

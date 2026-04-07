import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, resolveAssetUrl } from '../services/api';

type Props = {
  config?: Record<string, unknown> | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const asNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const isExternalHref = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(String(href || ''));

const normalizeHref = (value: unknown, fallback = '/') => {
  const raw = asString(value, fallback);
  if (isExternalHref(raw)) return raw;
  const withPrefix = raw.startsWith('/') ? raw : `/${raw}`;
  return withPrefix.replace(/^\/cystomtowear(\/|$)/i, '/customtowear$1');
};

const normalizeImage = (value: unknown) => {
  const raw = asString(value, '');
  if (!raw) return '';
  return resolveAssetUrl(raw) || raw;
};

const socialIconFromLabel = (label: string) => {
  const token = String(label || '').trim().toLowerCase();
  if (token.includes('facebook')) return Facebook;
  if (token.includes('twitter') || token.includes('x')) return Twitter;
  if (token.includes('youtube')) return Youtube;
  if (token.includes('linkedin')) return Linkedin;
  return Instagram;
};

export default function JenksV2NewsletterFooter({ config }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });

  const { data: fetchedConfig } = useQuery({
    queryKey: ['jenksV2NewsletterFooterConfig'],
    enabled: !config,
    queryFn: async () => {
      const response = await api.jenksV2Frontpage.getPublicConfig();
      return response.success ? (response.data as Record<string, unknown>) : null;
    },
  });

  const rootConfig = asRecord(config || fetchedConfig);
  const newsletterFooterCfg = useMemo(() => asRecord(rootConfig.newsletterFooter), [rootConfig]);
  const newsletterCfg = useMemo(() => asRecord(newsletterFooterCfg.newsletter), [newsletterFooterCfg.newsletter]);
  const footerCfg = useMemo(() => asRecord(newsletterFooterCfg.footer), [newsletterFooterCfg.footer]);
  const sectionVisibilityCfg = useMemo(() => asRecord(rootConfig.sectionVisibility), [rootConfig.sectionVisibility]);

  const newsletterFooterSectionEnabled = useMemo(() => {
    const rows = asArray(sectionVisibilityCfg.sections).map((entry) => asRecord(entry));
    const targetRows = rows.filter(
      (row) => asString(row.templateKey, '').toUpperCase() === 'NEWSLETTER_FOOTER' && !asBoolean(row.isCustom, false)
    );
    if (targetRows.length === 0) return true;
    return targetRows.some((row) => asBoolean(row.enabled, true));
  }, [sectionVisibilityCfg.sections]);

  const footerLinkGroups = useMemo(() => {
    const rows = asArray(footerCfg.linkGroups)
      .map((entry) => asRecord(entry))
      .map((entry, idx) => ({
        id: asString(entry.id, `group-${idx + 1}`),
        title: asString(entry.title, `Group ${idx + 1}`),
        links: asArray(entry.links)
          .map((link) => asRecord(link))
          .filter((link) => asBoolean(link.enabled, true))
          .map((link, linkIdx) => ({
            id: asString(link.id, `link-${idx + 1}-${linkIdx + 1}`),
            label: asString(link.label, 'Link'),
            href: normalizeHref(link.href, '/'),
          })),
      }))
      .filter((group) => group.links.length > 0);
    if (rows.length > 0) return rows;
    return [
      {
        id: 'fallback-shop',
        title: 'Shop',
        links: [
          { id: 'fallback-rtw', label: 'Ready To Wear', href: '/readytowear' },
          { id: 'fallback-ctw', label: 'Custom To Wear', href: '/customtowear' },
          { id: 'fallback-ftb', label: 'Fabrics', href: '/fabricstobuy' },
        ],
      },
    ];
  }, [footerCfg.linkGroups]);

  const footerSocialLinks = useMemo(
    () =>
      asArray(footerCfg.socialLinks)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry, idx) => ({
          id: asString(entry.id, `social-${idx + 1}`),
          label: asString(entry.label, 'Instagram'),
          icon: asString(entry.icon, asString(entry.label, 'Instagram')),
          href: normalizeHref(entry.href, '#'),
        })),
    [footerCfg.socialLinks]
  );

  const footerPolicyLinks = useMemo(
    () =>
      asArray(footerCfg.policyLinks)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry, idx) => ({
          id: asString(entry.id, `policy-${idx + 1}`),
          label: asString(entry.label, 'Policy'),
          href: normalizeHref(entry.href, '/'),
        })),
    [footerCfg.policyLinks]
  );

  const footerMapCfg = useMemo(() => asRecord(footerCfg.map), [footerCfg.map]);
  const footerMapEnabled = asBoolean(footerMapCfg.enabled, false);
  const footerMapImage = normalizeImage(footerMapCfg.image);
  const footerMapOverlayColor = asString(footerMapCfg.overlayColor, '#0a0a0a');
  const footerMapOverlayOpacity = Math.max(0, Math.min(1, asNumber(footerMapCfg.overlayOpacity, 55) / 100));
  const footerMapHeight = Math.max(80, Math.min(900, Math.round(asNumber(footerMapCfg.minHeight, 320))));

  const footerLogoCfg = useMemo(() => asRecord(footerCfg.logo), [footerCfg.logo]);
  const footerLogoMode = asString(footerLogoCfg.mode, 'TEXT').toUpperCase();
  const footerLogoImageUrl = normalizeImage(footerLogoCfg.imageUrl);
  const footerLogoFontWeight = Math.max(100, Math.min(900, Math.round(asNumber(footerLogoCfg.fontWeight, 700))));

  const newsletterEnabled = newsletterFooterSectionEnabled && asBoolean(newsletterCfg.enabled, true);
  const footerEnabled = newsletterFooterSectionEnabled && asBoolean(footerCfg.enabled, true);
  if (!newsletterEnabled && !footerEnabled) return null;

  const renderNavLink = (href: string, label: string, className: string, key: string) => {
    if (isExternalHref(href)) {
      return (
        <a key={key} href={href} className={className} target="_blank" rel="noreferrer">
          {label}
        </a>
      );
    }
    return (
      <Link key={key} to={href} className={className}>
        {label}
      </Link>
    );
  };

  const onSubmitNewsletter = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setStatus({ kind: 'error', message: 'Enter a valid email address.' });
      return;
    }
    setSubmitting(true);
    setStatus({ kind: 'idle', message: '' });
    try {
      const response = await api.homepageSections.subscribeHomepageNewsletter({
        email: normalized,
        source: 'jenks-v2-public-pages',
      });
      if (!response.success) throw new Error(String(response.message || 'Subscription failed.'));
      setStatus({
        kind: 'success',
        message: asString(newsletterCfg.successMessage, 'You are subscribed.'),
      });
      setEmail('');
    } catch (error: any) {
      const message = String(error?.response?.data?.message || error?.message || 'Unable to subscribe right now.');
      setStatus({ kind: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {newsletterEnabled ? (
        <section className="bg-white py-24">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="mx-auto flex w-full max-w-[920px] flex-col items-center justify-center gap-6 text-center">
              <div className="max-w-[760px]">
                <h3 className="font-['Oswald'] text-4xl font-bold uppercase">
                  {asString(newsletterCfg.title, 'JOIN THE MOVEMENT.')}
                </h3>
                <p className="mt-2 text-sm text-black/60">
                  {asString(newsletterCfg.description, 'Subscribe for new arrivals and stories from the continent.')}
                </p>
              </div>
              <form className="flex w-full max-w-[560px] gap-2" onSubmit={onSubmitNewsletter}>
                <input
                  className="h-10 flex-1 border border-black/20 px-3 text-sm outline-none"
                  placeholder={asString(newsletterCfg.emailPlaceholder, 'Enter email')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 bg-[#e66045] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : asString(newsletterCfg.submitLabel, 'Subscribe')}
                </button>
              </form>
              {status.kind !== 'idle' ? (
                <p className={`text-xs ${status.kind === 'success' ? 'text-green-700' : 'text-red-600'}`}>{status.message}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {footerEnabled ? (
        <footer className="relative bg-[#0a0a0a] text-white" style={{ minHeight: `${footerMapHeight}px` }}>
          {footerMapEnabled && footerMapImage ? (
            <>
              <img src={footerMapImage} alt="Footer map underlay" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: footerMapOverlayColor, opacity: footerMapOverlayOpacity }} />
            </>
          ) : null}
          <div className="relative z-10 w-full px-4 pt-12 sm:px-6 lg:px-12 xl:px-20">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
              <div>
                {footerLogoMode === 'IMAGE' && footerLogoImageUrl ? (
                  <img
                    src={footerLogoImageUrl}
                    alt={asString(footerLogoCfg.altText, 'Jenks')}
                    className="object-contain"
                    style={{
                      width: Math.max(40, Math.round(asNumber(footerLogoCfg.width, 180))),
                      height: Math.max(16, Math.round(asNumber(footerLogoCfg.height, 52))),
                    }}
                  />
                ) : (
                  <p
                    className="font-['Oswald'] uppercase tracking-[0.08em]"
                    style={{
                      color: asString(footerLogoCfg.textColor, '#ffffff'),
                      fontFamily: asString(footerLogoCfg.fontFamily, 'Oswald'),
                      fontSize: `${Math.max(10, Math.round(asNumber(footerLogoCfg.fontSize, 30)))}px`,
                      fontWeight: footerLogoFontWeight,
                    }}
                  >
                    {asString(footerLogoCfg.text, asString(footerCfg.brandText, 'Jenks')).toUpperCase()}
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3 text-white/75">
                  {footerSocialLinks.map((social) => {
                    const Icon = socialIconFromLabel(social.icon || social.label);
                    return (
                      <a key={social.id} href={social.href} className="hover:text-white" target="_blank" rel="noreferrer">
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>

              {footerLinkGroups.map((group) => (
                <div key={group.id} className="md:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{group.title}</p>
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    {group.links.map((link) => renderNavLink(link.href, link.label, 'block hover:text-white', link.id))}
                  </div>
                </div>
              ))}

              <div className="md:col-span-2 lg:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Contact</p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  <p className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {asString(footerCfg.contactEmail, 'support@zurikaribu.com')}
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {asString(footerCfg.contactPhone, '+234 000 000 0000')}
                  </p>
                  <p className="inline-flex items-center gap-2 text-white/72">
                    <MapPin className="h-4 w-4" /> {asString(footerCfg.address, 'Lagos, Nigeria')}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-10 border-t border-white/10 pt-5 text-xs text-white/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{asString(footerCfg.copyright, `© ${new Date().getFullYear()} ZuriKaribu. All rights reserved.`)}</span>
                {footerPolicyLinks.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {footerPolicyLinks.map((link) =>
                      renderNavLink(link.href, link.label, 'hover:text-white/80', link.id)
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </footer>
      ) : null}
    </>
  );
}

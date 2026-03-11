import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload, X, Globe, Sparkles, ShoppingBag, User, BookOpen, MessageSquare, Layout, Loader2, BarChart3 } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

type SectionType = 'topStrip' | 'statsStrip' | 'countries' | 'howItWorks' | 'categories' | 'designerSpotlight' | 'heritage' | 'testimonials' | 'footer';

interface TopStripContent {
  messages: string[];
  separator: string;
  repeatCount: number;
  animationSeconds: number;
  fontSize: number;
  isBold: boolean;
  pauseOnHover: boolean;
  textColor: string;
  backgroundColor: string;
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
}
interface StatsStripContent {
  items: Array<{
    value: string;
    suffix: string;
    label: string;
    displayOrder: number;
    isActive: boolean;
  }>;
  backgroundImage: string;
  backgroundColor: string;
  overlayColor: string;
  overlayOpacity: number;
  valueColor: string;
  suffixColor: string;
  labelColor: string;
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
}

interface Country {
  id: string;
  name: string;
  flag: string;
  image: string;
  fabrics: string;
  displayOrder: number;
  isActive: boolean;
}

interface HowItWorksStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

interface ShopCategory {
  id: string;
  key: string;
  title: string;
  description: string;
  image: string;
  images?: string[] | string;
  ctaText: string;
  ctaLink: string;
  displayOrder: number;
  isActive: boolean;
}

interface DesignerSpotlight {
  id: string;
  designerId: string;
  quote: string;
  bio: string;
  image: string;
  linkMode?: 'DEFAULT_STORE' | 'CUSTOM_URL' | 'BLOG';
  externalUrl?: string | null;
  blogPostId?: string | null;
  blog?: {
    id: string;
    title: string;
    slug: string;
    audienceType: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
    link: string;
  } | null;
  vendorType?: 'DESIGNER' | 'SELLER' | null;
  displayOrder: number;
  isActive: boolean;
  designer?: {
    businessName: string;
    country: string;
  };
}

interface BlogOption {
  id: string;
  title: string;
  slug: string;
  audienceType: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
  link: string;
}

interface HeritageSection {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaText?: string;
  ctaLink?: string;
  displayOrder: number;
  isActive: boolean;
}

interface Testimonial {
  id: string;
  name: string;
  initials: string;
  location: string;
  avatar: string;
  quote: string;
  displayOrder: number;
  isActive: boolean;
}

interface FooterContent {
  id: string;
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  socialLinks?: string | Record<string, unknown>;
  copyright: string;
}
type FooterLinkMode = 'CUSTOM_URL' | 'BLOG';
type FooterMenuKey = 'shop' | 'company' | 'support';
interface FooterMenuLink {
  label: string;
  href: string;
}
interface FooterPolicyConfig {
  label: string;
  href: string;
  linkMode: FooterLinkMode;
  blogPostId: string;
  externalUrl: string;
}
interface FooterSocialConfig {
  instagram: string;
  facebook: string;
  twitter: string;
  menus: Record<FooterMenuKey, FooterMenuLink[]>;
  policies: {
    privacy: FooterPolicyConfig;
    terms: FooterPolicyConfig;
  };
}

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

interface DesignerOption {
  id: string;
  businessName: string;
  country: string;
  vendorType?: 'DESIGNER' | 'SELLER';
}

interface HowItWorksStyleSettings {
  enabled: boolean;
  iconColor: string;
  iconHoverColor: string;
}

interface CountryImageGenerationSettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  promptTemplate: string;
  responseImagePath: string;
  requestMethod: 'GET' | 'POST';
}
interface FeaturedProductDescriptionSettings {
  wordLimit: number;
}

const FEATURED_DESCRIPTION_PREVIEW_TEXT =
  'Hand-finished African fashion piece crafted with premium fabric for modern style and everyday comfort.';
const FOOTER_MENU_DEFAULTS: Record<FooterMenuKey, FooterMenuLink[]> = {
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
    { label: 'Contact Us', href: '/#contact' },
    { label: 'FAQs', href: '/#contact' },
    { label: 'Shipping Info', href: '/#contact' },
    { label: 'Returns', href: '/#contact' },
  ],
};
const FOOTER_POLICY_DEFAULTS = {
  privacy: {
    label: 'Privacy Policy',
    href: '#',
    linkMode: 'CUSTOM_URL' as FooterLinkMode,
    blogPostId: '',
    externalUrl: '#',
  },
  terms: {
    label: 'Terms of Service',
    href: '#',
    linkMode: 'CUSTOM_URL' as FooterLinkMode,
    blogPostId: '',
    externalUrl: '#',
  },
};

const trimPreviewToWordLimit = (text: string, limit: number) => {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ')}…`;
};
const parseCategoryImageList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 5);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(
            parsed
              .map((item) => String(item || '').trim())
              .filter(Boolean)
          )
        ).slice(0, 5);
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }
  return Array.from(
    new Set(
      text
        .split(/\r?\n|,|\|/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 5);
};
const encodeCategoryImageList = (images: string[]): string => {
  const normalized = Array.from(
    new Set(
      (Array.isArray(images) ? images : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  ).slice(0, 5);
  if (normalized.length <= 1) {
    return normalized[0] || '';
  }
  return JSON.stringify(normalized);
};
const toFooterMenuTextarea = (links: FooterMenuLink[]) => links.map((item) => `${item.label}|${item.href}`).join('\n');
const parseFooterMenuTextarea = (value: string): FooterMenuLink[] =>
  String(value || '')
    .split('\n')
    .map((line) => {
      const parts = line.split('|');
      const label = String(parts[0] || '').trim();
      const href = String(parts.slice(1).join('|') || '').trim();
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((entry): entry is FooterMenuLink => Boolean(entry));
const parseFooterSocialConfig = (raw: unknown): FooterSocialConfig => {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })()
      : raw && typeof raw === 'object'
        ? raw
        : null;
  if (!parsed || typeof parsed !== 'object') {
    return {
      instagram: '#',
      facebook: '#',
      twitter: '#',
      menus: { ...FOOTER_MENU_DEFAULTS },
      policies: { ...FOOTER_POLICY_DEFAULTS },
    };
  }
  const row = parsed as Record<string, any>;
  const menus = row.menus && typeof row.menus === 'object' ? row.menus : {};
  const policies = row.policies && typeof row.policies === 'object' ? row.policies : {};
  const normalizeMenu = (key: FooterMenuKey) => {
    const fallback = FOOTER_MENU_DEFAULTS[key];
    const rawMenu = Array.isArray(menus[key]) ? menus[key] : [];
    const parsedMenu = rawMenu
      .map((entry: any) => {
        if (!entry || typeof entry !== 'object') return null;
        const label = String(entry.label || '').trim();
        const href = String(entry.href || entry.url || '').trim();
        if (!label || !href) return null;
        return { label, href };
      })
      .filter((entry: FooterMenuLink | null): entry is FooterMenuLink => Boolean(entry));
    return parsedMenu.length > 0 ? parsedMenu : fallback;
  };
  const normalizePolicy = (key: 'privacy' | 'terms') => {
    const policy = policies[key] && typeof policies[key] === 'object' ? policies[key] : {};
    const fallback = FOOTER_POLICY_DEFAULTS[key];
    return {
      label: String(policy.label || fallback.label),
      href: String(policy.href || policy.link || policy.externalUrl || fallback.href),
      linkMode: String(policy.linkMode || '').toUpperCase() === 'BLOG' ? 'BLOG' : 'CUSTOM_URL',
      blogPostId: String(policy.blogPostId || ''),
      externalUrl: String(policy.externalUrl || policy.href || policy.link || fallback.externalUrl),
    };
  };
  return {
    instagram: String(row.instagram || '#'),
    facebook: String(row.facebook || '#'),
    twitter: String(row.twitter || '#'),
    menus: {
      shop: normalizeMenu('shop'),
      company: normalizeMenu('company'),
      support: normalizeMenu('support'),
    },
    policies: {
      privacy: normalizePolicy('privacy'),
      terms: normalizePolicy('terms'),
    },
  };
};

const FALLBACK_AFRICAN_COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: 'CD', name: 'Democratic Republic of the Congo', flag: '🇨🇩' },
  { code: 'CI', name: "Cote d'Ivoire", flag: '🇨🇮' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'ST', name: 'Sao Tome and Principe', flag: '🇸🇹' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'EH', name: 'Western Sahara', flag: '🇪🇭' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
];

const TABS = [
  { id: 'topStrip' as SectionType, label: 'Top Strip', icon: Layout },
  { id: 'statsStrip' as SectionType, label: 'Stats Strip', icon: BarChart3 },
  { id: 'countries' as SectionType, label: 'Countries', icon: Globe },
  { id: 'howItWorks' as SectionType, label: 'How It Works', icon: Sparkles },
  { id: 'categories' as SectionType, label: 'Categories', icon: ShoppingBag },
  { id: 'designerSpotlight' as SectionType, label: 'Designer Spotlight', icon: User },
  { id: 'heritage' as SectionType, label: 'Heritage', icon: BookOpen },
  { id: 'testimonials' as SectionType, label: 'Testimonials', icon: MessageSquare },
  { id: 'footer' as SectionType, label: 'Footer & Policies', icon: Layout },
];

export default function HomepageSections() {
  const [activeTab, setActiveTab] = useState<SectionType>('topStrip');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [howItWorks, setHowItWorks] = useState<HowItWorksStep[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [designerSpotlights, setDesignerSpotlights] = useState<DesignerSpotlight[]>([]);
  const [heritageSections, setHeritageSections] = useState<HeritageSection[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [footerContents, setFooterContents] = useState<FooterContent[]>([]);
  const [topStripContent, setTopStripContent] = useState<TopStripContent | null>(null);
  const [statsStripContent, setStatsStripContent] = useState<StatsStripContent | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [designerOptions, setDesignerOptions] = useState<DesignerOption[]>([]);
  const [blogOptions, setBlogOptions] = useState<BlogOption[]>([]);
  const [countryImageSettings, setCountryImageSettings] = useState<CountryImageGenerationSettings>({
    enabled: false,
    apiUrl: '',
    apiKey: '',
    model: '',
    promptTemplate: 'High quality fashion editorial image inspired by {country}. Keywords: {keywords}. Fabrics: {fabrics}.',
    responseImagePath: 'url',
    requestMethod: 'POST',
  });
  const [countryImageSaving, setCountryImageSaving] = useState(false);
  const [featuredProductDescriptionSettings, setFeaturedProductDescriptionSettings] = useState<FeaturedProductDescriptionSettings>({
    wordLimit: 12,
  });
  const [featuredProductDescriptionSaving, setFeaturedProductDescriptionSaving] = useState(false);
  const [howItWorksStyle, setHowItWorksStyle] = useState<HowItWorksStyleSettings>({
    enabled: false,
    iconColor: '#111827',
    iconHoverColor: '#ffffff',
  });
  const [howItWorksStyleSaving, setHowItWorksStyleSaving] = useState(false);
  const featuredDescriptionPreview = trimPreviewToWordLimit(
    FEATURED_DESCRIPTION_PREVIEW_TEXT,
    Math.max(5, Math.min(60, Number(featuredProductDescriptionSettings.wordLimit) || 12))
  );

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    fetchAuxiliaryOptions();
  }, []);

  useEffect(() => {
    fetchCountryImageSettings();
  }, []);
  useEffect(() => {
    fetchFeaturedProductDescriptionSettings();
  }, []);

  useEffect(() => {
    fetchHowItWorksStyleSettings();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'topStrip':
          const topStripRes = await api.homepageSections.getAdminTopStrip();
          if (topStripRes.success) setTopStripContent(topStripRes.data);
          break;
        case 'statsStrip':
          const statsStripRes = await api.homepageSections.getAdminStatsStrip();
          if (statsStripRes.success) setStatsStripContent(statsStripRes.data);
          break;
        case 'countries':
          const countriesRes = await api.homepageSections.getAdminCountries();
          if (countriesRes.success) setCountries(countriesRes.data);
          break;
        case 'howItWorks':
          const howItWorksRes = await api.homepageSections.getAdminHowItWorks();
          if (howItWorksRes.success) setHowItWorks(howItWorksRes.data);
          break;
        case 'categories':
          const categoriesRes = await api.homepageSections.getAdminCategories();
          if (categoriesRes.success) {
            const normalized = (Array.isArray(categoriesRes.data) ? categoriesRes.data : []).map((row: any) => {
              const imageList = parseCategoryImageList(row?.images ?? row?.image);
              return {
                ...row,
                image: imageList[0] || String(row?.image || ''),
                images: imageList,
              };
            });
            setCategories(normalized);
          }
          break;
        case 'designerSpotlight':
          const spotlightRes = await api.homepageSections.getAdminDesignerSpotlights();
          if (spotlightRes.success) setDesignerSpotlights(spotlightRes.data);
          break;
        case 'heritage':
          const heritageRes = await api.homepageSections.getAdminHeritage();
          if (heritageRes.success) setHeritageSections(heritageRes.data);
          break;
        case 'testimonials':
          const testimonialsRes = await api.homepageSections.getAdminTestimonials();
          if (testimonialsRes.success) setTestimonials(testimonialsRes.data);
          break;
        case 'footer':
          const footerRes = await api.homepageSections.getAdminFooter();
          if (footerRes.success && footerRes.data) setFooterContents([footerRes.data]);
          if (footerRes.success && !footerRes.data) setFooterContents([]);
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuxiliaryOptions = async () => {
    const [countryOptionsResult, designerOptionsResult, blogOptionsResult] = await Promise.allSettled([
      api.homepageSections.getAdminCountryOptions(),
      api.homepageSections.getAdminDesignerOptions(),
      api.blogs.getAdminOptions(),
    ]);

    if (countryOptionsResult.status === 'fulfilled' && countryOptionsResult.value.success) {
      setCountryOptions(
        Array.isArray(countryOptionsResult.value.data) && countryOptionsResult.value.data.length > 0
          ? countryOptionsResult.value.data
          : FALLBACK_AFRICAN_COUNTRY_OPTIONS
      );
    } else {
      setCountryOptions(FALLBACK_AFRICAN_COUNTRY_OPTIONS);
    }

    if (designerOptionsResult.status === 'fulfilled' && designerOptionsResult.value.success) {
      setDesignerOptions(Array.isArray(designerOptionsResult.value.data) ? designerOptionsResult.value.data : []);
    } else {
      if (designerOptionsResult.status === 'rejected') {
        console.error('Error fetching designer options:', designerOptionsResult.reason);
      }
      setDesignerOptions([]);
    }

    if (blogOptionsResult.status === 'fulfilled' && blogOptionsResult.value.success) {
      setBlogOptions(Array.isArray(blogOptionsResult.value.data) ? blogOptionsResult.value.data : []);
    } else {
      if (blogOptionsResult.status === 'rejected') {
        console.error('Error fetching blog options:', blogOptionsResult.reason);
      }
      setBlogOptions([]);
    }
  };

  const fetchCountryImageSettings = async () => {
    try {
      const response = await api.homepageSections.getAdminCountryImageGeneration();
      if (response.success && response.data) {
        setCountryImageSettings({
          enabled: !!response.data.enabled,
          apiUrl: response.data.apiUrl || '',
          apiKey: response.data.apiKey || '',
          model: response.data.model || '',
          promptTemplate: response.data.promptTemplate || 'High quality fashion editorial image inspired by {country}. Keywords: {keywords}. Fabrics: {fabrics}.',
          responseImagePath: response.data.responseImagePath || 'url',
          requestMethod: response.data.requestMethod || 'POST',
        });
      }
    } catch (error) {
      console.error('Error fetching country image generation settings:', error);
    }
  };

  const fetchHowItWorksStyleSettings = async () => {
    try {
      const response = await api.homepageSections.getAdminHowItWorksStyle();
      if (response.success && response.data) {
        setHowItWorksStyle({
          enabled: !!response.data.enabled,
          iconColor: response.data.iconColor || '#111827',
          iconHoverColor: response.data.iconHoverColor || '#ffffff',
        });
      }
    } catch (error) {
      console.error('Error fetching how it works style settings:', error);
    }
  };
  const fetchFeaturedProductDescriptionSettings = async () => {
    try {
      const response = await api.homepageSections.getAdminFeaturedProductDescriptionSettings();
      if (response.success && response.data) {
        setFeaturedProductDescriptionSettings({
          wordLimit: Math.max(5, Math.min(60, Number(response.data.wordLimit) || 12)),
        });
      }
    } catch (error) {
      console.error('Error fetching featured product description settings:', error);
    }
  };

  const handleSaveHowItWorksStyleSettings = async () => {
    setHowItWorksStyleSaving(true);
    try {
      const response = await api.homepageSections.updateAdminHowItWorksStyle(howItWorksStyle);
      if (response.success && response.data) {
        setHowItWorksStyle({
          enabled: !!response.data.enabled,
          iconColor: response.data.iconColor || '#111827',
          iconHoverColor: response.data.iconHoverColor || '#ffffff',
        });
        window.alert('How it works style saved.');
      }
    } catch (error: any) {
      console.error('Error saving how it works style settings:', error);
      window.alert(error?.response?.data?.message || 'Failed to save how it works style.');
    } finally {
      setHowItWorksStyleSaving(false);
    }
  };

  const handleSaveCountryImageSettings = async () => {
    setCountryImageSaving(true);
    try {
      const response = await api.homepageSections.updateAdminCountryImageGeneration(countryImageSettings);
      if (response.success && response.data) {
        setCountryImageSettings({
          enabled: !!response.data.enabled,
          apiUrl: response.data.apiUrl || '',
          apiKey: response.data.apiKey || '',
          model: response.data.model || '',
          promptTemplate: response.data.promptTemplate || countryImageSettings.promptTemplate,
          responseImagePath: response.data.responseImagePath || 'url',
          requestMethod: response.data.requestMethod || 'POST',
        });
        window.alert('Country image generation settings saved.');
      }
    } catch (error: any) {
      console.error('Error saving country image generation settings:', error);
      window.alert(error?.response?.data?.message || 'Failed to save country image generation settings.');
    } finally {
      setCountryImageSaving(false);
    }
  };
  const handleSaveFeaturedProductDescriptionSettings = async () => {
    setFeaturedProductDescriptionSaving(true);
    try {
      const response = await api.homepageSections.updateAdminFeaturedProductDescriptionSettings({
        wordLimit: Math.max(5, Math.min(60, Number(featuredProductDescriptionSettings.wordLimit) || 12)),
      });
      if (response.success && response.data) {
        setFeaturedProductDescriptionSettings({
          wordLimit: Math.max(5, Math.min(60, Number(response.data.wordLimit) || 12)),
        });
        window.alert('Featured product description word limit saved.');
      }
    } catch (error: any) {
      console.error('Error saving featured product description settings:', error);
      window.alert(error?.response?.data?.message || 'Failed to save featured product description settings.');
    } finally {
      setFeaturedProductDescriptionSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      let response;
      switch (activeTab) {
        case 'countries':
          const country = countries.find(c => c.id === id);
          if (country) {
            response = await api.homepageSections.updateCountry(id, { ...country, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'howItWorks':
          const step = howItWorks.find(s => s.id === id);
          if (step) {
            response = await api.homepageSections.updateHowItWorksStep(id, { ...step, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'categories':
          const cat = categories.find(c => c.id === id);
          if (cat) {
            response = await api.homepageSections.updateCategory(id, {
              ...cat,
              image: encodeCategoryImageList(parseCategoryImageList((cat as any).images ?? (cat as any).image)),
              isActive: !currentStatus,
            });
            if (response.success) fetchData();
          }
          break;
        case 'designerSpotlight':
          const spotlight = designerSpotlights.find(s => s.id === id);
          if (spotlight) {
            response = await api.homepageSections.updateDesignerSpotlight(id, { ...spotlight, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'heritage':
          const heritage = heritageSections.find(h => h.id === id);
          if (heritage) {
            response = await api.homepageSections.updateHeritage(id, { ...heritage, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'testimonials':
          const testimonial = testimonials.find(t => t.id === id);
          if (testimonial) {
            response = await api.homepageSections.updateTestimonial(id, { ...testimonial, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      let response;
      switch (activeTab) {
        case 'countries':
          response = await api.homepageSections.deleteCountry(id);
          break;
        case 'howItWorks':
          response = await api.homepageSections.deleteHowItWorksStep(id);
          break;
        case 'categories':
          response = await api.homepageSections.deleteCategory(id);
          break;
        case 'designerSpotlight':
          response = await api.homepageSections.deleteDesignerSpotlight(id);
          break;
        case 'heritage':
          response = await api.homepageSections.deleteHeritage(id);
          break;
        case 'testimonials':
          response = await api.homepageSections.deleteTestimonial(id);
          break;
      }
      if (response?.success) fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const openModal = (item: any = null) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setEditingItem(null);
    setShowModal(false);
  };

  const handleSave = () => {
    fetchData();
    closeModal();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homepage Sections</h1>
          <p className="text-gray-500 mt-1">Manage all dynamic homepage content</p>
        </div>
        <Button onClick={() => openModal(activeTab === 'topStrip' ? topStripContent : activeTab === 'statsStrip' ? statsStripContent : null)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {activeTab === 'topStrip' || activeTab === 'statsStrip' ? 'Edit Settings' : 'Add New'}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Country Image Generation API</h2>
          <p className="text-sm text-gray-500">
            Configure image API from Admin. If country image is empty, it auto-generates from keyword/country data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="country-image-enabled"
            type="checkbox"
            checked={countryImageSettings.enabled}
            onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="country-image-enabled" className="text-sm font-medium text-gray-700">
            Enable custom image API (falls back to deterministic placeholder if unavailable)
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
            <input
              type="text"
              value={countryImageSettings.apiUrl}
              onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, apiUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="https://api.provider.com/generate"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={countryImageSettings.apiKey}
              onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Provider API key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model (optional)</label>
            <input
              type="text"
              value={countryImageSettings.model}
              onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="gpt-image-1 / custom model"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Method</label>
            <select
              value={countryImageSettings.requestMethod}
              onChange={(e) =>
                setCountryImageSettings((prev) => ({
                  ...prev,
                  requestMethod: (e.target.value as 'GET' | 'POST') || 'POST',
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Template</label>
            <textarea
              value={countryImageSettings.promptTemplate}
              onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, promptTemplate: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Use {country}, {fabrics}, {keywords}"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Response Image Path</label>
            <input
              type="text"
              value={countryImageSettings.responseImagePath}
              onChange={(e) => setCountryImageSettings((prev) => ({ ...prev, responseImagePath: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="url or data[0].url"
            />
          </div>
        </div>
        <div>
          <Button onClick={handleSaveCountryImageSettings} disabled={countryImageSaving}>
            {countryImageSaving ? 'Saving...' : 'Save Image Generation Settings'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Featured Product Description</h2>
          <p className="text-sm text-gray-500">
            Control how many words are shown for product descriptions in featured frontpage cards.
          </p>
        </div>
        <div className="max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description Word Limit</label>
          <input
            type="number"
            value={featuredProductDescriptionSettings.wordLimit}
            onChange={(e) =>
              setFeaturedProductDescriptionSettings({
                wordLimit: Math.max(5, Math.min(60, parseInt(e.target.value, 10) || 12)),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            min={5}
            max={60}
          />
          <p className="mt-1 text-xs text-gray-500">Allowed range: 5 to 60 words.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600">Live Preview</p>
          <p className="mt-1 text-xs text-gray-700">
            {featuredDescriptionPreview}
          </p>
        </div>
        <div>
          <Button onClick={handleSaveFeaturedProductDescriptionSettings} disabled={featuredProductDescriptionSaving}>
            {featuredProductDescriptionSaving ? 'Saving...' : 'Save Description Word Limit'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'howItWorks' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={howItWorksStyle.enabled}
                onChange={(e) => setHowItWorksStyle((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Enable custom How It Works icon colors
            </label>
            <div className={`grid gap-4 md:grid-cols-2 ${howItWorksStyle.enabled ? '' : 'opacity-60'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon Color</label>
                <input
                  type="color"
                  value={howItWorksStyle.iconColor}
                  disabled={!howItWorksStyle.enabled}
                  onChange={(e) => setHowItWorksStyle((prev) => ({ ...prev, iconColor: e.target.value }))}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon Hover Color</label>
                <input
                  type="color"
                  value={howItWorksStyle.iconHoverColor}
                  disabled={!howItWorksStyle.enabled}
                  onChange={(e) => setHowItWorksStyle((prev) => ({ ...prev, iconHoverColor: e.target.value }))}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <Button onClick={handleSaveHowItWorksStyleSettings} disabled={howItWorksStyleSaving}>
                {howItWorksStyleSaving ? 'Saving...' : 'Save How It Works Style'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {activeTab === 'topStrip' && (
              <TopStripTable
                data={topStripContent}
                onEdit={() => openModal(topStripContent)}
              />
            )}
            {activeTab === 'statsStrip' && (
              <StatsStripTable
                data={statsStripContent}
                onEdit={() => openModal(statsStripContent)}
              />
            )}
            {activeTab === 'countries' && (
              <CountriesTable
                data={countries}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'howItWorks' && (
              <HowItWorksTable
                data={howItWorks}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'categories' && (
              <CategoriesTable
                data={categories}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'designerSpotlight' && (
              <DesignerSpotlightTable
                data={designerSpotlights}
                designers={designerOptions}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'heritage' && (
              <HeritageTable
                data={heritageSections}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'testimonials' && (
              <TestimonialsTable
                data={testimonials}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'footer' && (
              <FooterTable
                data={footerContents}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <SectionModal
          type={activeTab}
          item={editingItem}
          countryOptions={countryOptions}
          designers={designerOptions}
          blogOptions={blogOptions}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// Table Components
function TopStripTable({ data, onEdit }: { data: TopStripContent | null; onEdit: () => void }) {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Top Announcement Strip</h3>
            <p className="text-xs text-gray-500">
              This controls the scrolling message bar above the hero banner.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Separator: {data?.separator || '•'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Repeat count: {data?.repeatCount ?? 4}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Animation: {data?.animationSeconds ?? 20}s
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Font size: {data?.fontSize ?? 12}px
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Weight: {data?.isBold ? 'Bold' : 'Regular'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Pause on hover: {data?.pauseOnHover ? 'Enabled' : 'Disabled'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.textColor || '#ffffff' }}
                />
                Text: {data?.textColor || '#ffffff'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.backgroundColor || '#000000' }}
                />
                Background: {data?.backgroundColor || '#000000'}
              </span>
            </div>
            <div className="space-y-1">
              {messages.length > 0 ? (
                messages.map((message, idx) => (
                  <p key={`${idx}-${message}`} className="text-sm text-gray-700">
                    • {message}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500">No top strip message configured yet.</p>
              )}
            </div>
          </div>
          <Button onClick={onEdit} className="inline-flex items-center gap-2 self-start">
            <Edit2 className="h-4 w-4" />
            Edit Top Strip
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatsStripTable({ data, onEdit }: { data: StatsStripContent | null; onEdit: () => void }) {
  const items = Array.isArray(data?.items) ? data.items.filter((item) => item.isActive) : [];
  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Homepage Statistics Strip</h3>
            <p className="text-xs text-gray-500">
              This controls the stats bar shown below the hero banner on the frontpage.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Overlay opacity: {data?.overlayOpacity ?? 45}%
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.backgroundColor || '#111827' }}
                />
                Background: {data?.backgroundColor || '#111827'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.overlayColor || '#000000' }}
                />
                Overlay: {data?.overlayColor || '#000000'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-2xl font-bold text-gray-900">
                      {item.value}
                      <span className="ml-1 text-yellow-500">{item.suffix}</span>
                    </p>
                    <p className="mt-1 text-xs tracking-widest text-gray-500">{item.label}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No active stat items configured yet.</p>
              )}
            </div>
          </div>
          <Button onClick={onEdit} className="self-start">Edit Stats Strip</Button>
        </div>
      </div>
    </div>
  );
}

function CountriesTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flag</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fabrics</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: Country) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.name} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-2xl">{item.flag}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.fabrics}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HowItWorksTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtitle</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: HowItWorksStep) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.stepNumber}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.title}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.subtitle}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.icon}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoriesTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTA</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: ShopCategory) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.title} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.key}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.description}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.ctaText} → {item.ctaLink}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignerSpotlightTable({ data, designers, onEdit, onToggle, onDelete }: any) {
  const profileById = new Map(
    (Array.isArray(designers) ? designers : []).map((profile: DesignerOption) => [profile.id, profile])
  );
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designer / Seller</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bio</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: DesignerSpotlight) => {
          const linkedProfile = profileById.get(String(item.designerId || ''));
          const linkedName =
            item.designer?.businessName ||
            linkedProfile?.businessName ||
            `Profile ${String(item.designerId || '').slice(0, 8)}`;
          const linkedCountry = item.designer?.country || linkedProfile?.country || '';
          const linkedVendorType =
            String(item.vendorType || linkedProfile?.vendorType || 'DESIGNER').toUpperCase() === 'SELLER'
              ? 'Seller'
              : 'Designer';
          return (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={linkedName} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">Spotlight Card</span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
              <div className="font-medium">{linkedName}</div>
              <div className="text-xs text-gray-500">
                {linkedVendorType}
                {linkedCountry ? ` • ${linkedCountry}` : ''}
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{item.quote}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.bio}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        )})}
      </tbody>
    </table>
  );
}

function HeritageTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtitle</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTA</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: HeritageSection) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.title} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.subtitle}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.ctaText || '-'} {item.ctaLink ? `→ ${item.ctaLink}` : ''}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TestimonialsTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initials</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: Testimonial) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.avatar && (
                  <img src={item.avatar} alt={item.name} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.location}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.initials}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.quote}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FooterTable({ data, onEdit }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tagline</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: FooterContent) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.companyName}</td>
            <td className="px-6 py-4 text-sm text-gray-500">{item.email} · {item.phone}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.tagline}</td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                <Edit2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Modal Component
function SectionModal({
  type,
  item,
  countryOptions,
  designers,
  blogOptions,
  onClose,
  onSave,
}: {
  type: SectionType;
  item: any;
  countryOptions: CountryOption[];
  designers: DesignerOption[];
  blogOptions: BlogOption[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<any>(() => {
    if (type === 'topStrip' && item) {
      return {
        ...item,
        messagesText: Array.isArray(item.messages) ? item.messages.join('\n') : '',
        fontSize: Number(item.fontSize) || 12,
        isBold: Boolean(item.isBold),
        textColor: item.textColor || '#ffffff',
        backgroundColor: item.backgroundColor || '#000000',
        pauseOnHover: Boolean(item.pauseOnHover ?? true),
      };
    }
    if (type === 'statsStrip' && item) {
      return {
        ...item,
        items: Array.isArray(item.items) && item.items.length > 0
          ? item.items
          : [
              { value: '120', suffix: '+', label: 'COUNTRIES', displayOrder: 0, isActive: true },
              { value: '50', suffix: 'K+', label: 'DESIGNERS', displayOrder: 1, isActive: true },
              { value: '1', suffix: 'M+', label: 'FABRICS', displayOrder: 2, isActive: true },
              { value: '100', suffix: 'K+', label: 'PRODUCTS', displayOrder: 3, isActive: true },
            ],
        backgroundImage: item.backgroundImage || '',
        backgroundColor: item.backgroundColor || '#111827',
        overlayColor: item.overlayColor || '#000000',
        overlayOpacity: Number(item.overlayOpacity) || 45,
        valueColor: item.valueColor || '#ffffff',
        suffixColor: item.suffixColor || '#facc15',
        labelColor: item.labelColor || '#d1d5db',
      };
    }
    if (type === 'heritage' && item) {
      const link = String(item.ctaLink || '').trim();
      const linkedBlog = blogOptions.find(
        (blog) => String(blog.link || '').trim() === link || `/stories/${blog.slug}` === link
      );
      return {
        ...item,
        linkMode: linkedBlog ? 'BLOG' : 'CUSTOM_URL',
        blogPostId: linkedBlog?.id || '',
        externalUrl: linkedBlog ? '' : link,
        ctaLink: link,
      };
    }
    if (type === 'footer' && item) {
      const config = parseFooterSocialConfig(item.socialLinks);
      const resolveBlogFromHref = (href: string) =>
        blogOptions.find(
          (blog) => String(blog.link || '').trim() === href || `/stories/${blog.slug}` === href
        );
      const termsFromHref = resolveBlogFromHref(config.policies.terms.href);
      const privacyFromHref = resolveBlogFromHref(config.policies.privacy.href);
      const termsLinkMode: FooterLinkMode =
        config.policies.terms.linkMode === 'BLOG' || Boolean(config.policies.terms.blogPostId || termsFromHref)
          ? 'BLOG'
          : 'CUSTOM_URL';
      const privacyLinkMode: FooterLinkMode =
        config.policies.privacy.linkMode === 'BLOG' || Boolean(config.policies.privacy.blogPostId || privacyFromHref)
          ? 'BLOG'
          : 'CUSTOM_URL';
      return {
        ...item,
        instagram: config.instagram,
        facebook: config.facebook,
        twitter: config.twitter,
        shopMenuText: toFooterMenuTextarea(config.menus.shop),
        companyMenuText: toFooterMenuTextarea(config.menus.company),
        supportMenuText: toFooterMenuTextarea(config.menus.support),
        termsLinkMode,
        termsBlogPostId: config.policies.terms.blogPostId || termsFromHref?.id || '',
        termsExternalUrl: config.policies.terms.externalUrl || config.policies.terms.href || '#',
        privacyLinkMode,
        privacyBlogPostId: config.policies.privacy.blogPostId || privacyFromHref?.id || '',
        privacyExternalUrl: config.policies.privacy.externalUrl || config.policies.privacy.href || '#',
      };
    }
    if (type === 'categories' && item) {
      const imageList = parseCategoryImageList((item as any).images ?? (item as any).image);
      return {
        ...item,
        image: imageList[0] || String((item as any).image || ''),
        categoryImagesText: imageList.join('\n'),
      };
    }
    return item || getDefaultFormData(type);
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const effectiveCountryOptions = countryOptions.length > 0 ? countryOptions : FALLBACK_AFRICAN_COUNTRY_OPTIONS;
  const designerProfiles = designers.filter((item) => item.vendorType !== 'SELLER');
  const sellerProfiles = designers.filter((item) => item.vendorType === 'SELLER');
  const selectedSpotlightProfile = designers.find((item) => item.id === String(formData?.designerId || ''));
  const spotlightAudienceType = selectedSpotlightProfile?.vendorType === 'SELLER' ? 'SELLER' : 'DESIGNER';
  const filteredBlogOptions = blogOptions.filter(
    (item) => item.audienceType === spotlightAudienceType || item.audienceType === 'OTHER'
  );

  function getDefaultFormData(sectionType: SectionType) {
    switch (sectionType) {
      case 'topStrip':
        return {
          messagesText: 'Free shipping on orders over $250\nNew arrivals weekly\nAuthentic African designs',
          separator: '•',
          repeatCount: 4,
          animationSeconds: 20,
          fontSize: 12,
          isBold: false,
          pauseOnHover: true,
          textColor: '#ffffff',
          backgroundColor: '#000000',
        };
      case 'countries':
        return { countryCode: '', name: '', flag: '', image: '', imageKeyword: '', fabrics: '', displayOrder: 0, isActive: true };
      case 'statsStrip':
        return {
          items: [
            { value: '120', suffix: '+', label: 'COUNTRIES', displayOrder: 0, isActive: true },
            { value: '50', suffix: 'K+', label: 'DESIGNERS', displayOrder: 1, isActive: true },
            { value: '1', suffix: 'M+', label: 'FABRICS', displayOrder: 2, isActive: true },
            { value: '100', suffix: 'K+', label: 'PRODUCTS', displayOrder: 3, isActive: true },
          ],
          backgroundImage: '',
          backgroundColor: '#111827',
          overlayColor: '#000000',
          overlayOpacity: 45,
          valueColor: '#ffffff',
          suffixColor: '#facc15',
          labelColor: '#d1d5db',
        };
      case 'howItWorks':
        return { stepNumber: 1, title: '', subtitle: '', icon: 'Sparkles', displayOrder: 0, isActive: true };
      case 'categories':
        return {
          key: '',
          title: '',
          description: '',
          image: '',
          categoryImagesText: '',
          ctaText: 'Shop Now',
          ctaLink: '',
          displayOrder: 0,
          isActive: true,
        };
      case 'designerSpotlight':
        return {
          designerId: '',
          quote: '',
          bio: '',
          image: '',
          linkMode: 'DEFAULT_STORE',
          externalUrl: '',
          blogPostId: '',
          displayOrder: 0,
          isActive: true,
        };
      case 'heritage':
        return {
          title: '',
          subtitle: '',
          image: '',
          ctaText: 'Read Our Story',
          ctaLink: '/about',
          linkMode: 'CUSTOM_URL',
          externalUrl: '/about',
          blogPostId: '',
          displayOrder: 0,
          isActive: true,
        };
      case 'testimonials':
        return { name: '', initials: '', location: '', quote: '', avatar: '', displayOrder: 0, isActive: true };
      case 'footer':
        return {
          companyName: '',
          tagline: '',
          email: '',
          phone: '',
          address: '',
          copyright: '',
          instagram: '#',
          facebook: '#',
          twitter: '#',
          shopMenuText: toFooterMenuTextarea(FOOTER_MENU_DEFAULTS.shop),
          companyMenuText: toFooterMenuTextarea(FOOTER_MENU_DEFAULTS.company),
          supportMenuText: toFooterMenuTextarea(FOOTER_MENU_DEFAULTS.support),
          termsLinkMode: 'CUSTOM_URL',
          termsBlogPostId: '',
          termsExternalUrl: '#',
          privacyLinkMode: 'CUSTOM_URL',
          privacyBlogPostId: '',
          privacyExternalUrl: '#',
        };
      default:
        return {};
    }
  }

  const countryOptionByCode = new Map(effectiveCountryOptions.map((option) => [option.code, option]));
  const countryOptionByName = new Map(effectiveCountryOptions.map((option) => [option.name.toLowerCase(), option]));

  useEffect(() => {
    if (type !== 'countries') return;
    const name = String(formData?.name || '').trim().toLowerCase();
    const existingCode = String(formData?.countryCode || '').trim().toUpperCase();
    const option =
      (existingCode ? countryOptionByCode.get(existingCode) : undefined) ||
      (name ? countryOptionByName.get(name) : undefined);
    if (!option) return;
    if (existingCode === option.code && String(formData?.flag || '') === option.flag) return;
    setFormData((prev: any) => ({
      ...prev,
      countryCode: option.code,
      name: prev?.name || option.name,
      flag: option.flag,
    }));
  }, [type, effectiveCountryOptions]);

  useEffect(() => {
    if (type !== 'designerSpotlight') return;
    setFormData((prev: any) => {
      const next = { ...prev };
      if (String(next.linkMode || 'DEFAULT_STORE') !== 'CUSTOM_URL') {
        next.externalUrl = '';
      }
      if (String(next.linkMode || 'DEFAULT_STORE') !== 'BLOG') {
        next.blogPostId = '';
      }
      return next;
    });
  }, [type, formData?.linkMode]);

  useEffect(() => {
    if (type !== 'heritage') return;
    setFormData((prev: any) => {
      const next = { ...prev };
      if (String(next.linkMode || 'CUSTOM_URL') !== 'BLOG') {
        next.blogPostId = '';
      }
      if (String(next.linkMode || 'CUSTOM_URL') !== 'CUSTOM_URL') {
        next.externalUrl = '';
      }
      return next;
    });
  }, [type, formData?.linkMode]);
  useEffect(() => {
    if (type !== 'footer') return;
    setFormData((prev: any) => {
      const next = { ...prev };
      if (String(next.termsLinkMode || 'CUSTOM_URL') !== 'BLOG') {
        next.termsBlogPostId = '';
      }
      if (String(next.privacyLinkMode || 'CUSTOM_URL') !== 'BLOG') {
        next.privacyBlogPostId = '';
      }
      return next;
    });
  }, [type, formData?.termsLinkMode, formData?.privacyLinkMode]);

  const handleCountryNameChange = (countryName: string) => {
    const option = countryOptionByName.get(String(countryName || '').trim().toLowerCase());
    setFormData((prev: any) => ({
      ...prev,
      countryCode: option?.code || prev?.countryCode || '',
      name: option?.name || countryName,
      flag: option?.flag || prev?.flag || '',
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response.success) {
        setFormData((prev: any) => {
          if (type === 'categories' && field === 'image') {
            const current = parseCategoryImageList(prev?.categoryImagesText || prev?.image || '');
            const nextImages = Array.from(new Set([response.data.url, ...current])).slice(0, 5);
            return {
              ...prev,
              image: nextImages[0] || response.data.url,
              categoryImagesText: nextImages.join('\n'),
            };
          }
          return { ...prev, [field]: response.data.url };
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCountryImage = async () => {
    if (type !== 'countries') return;
    setGeneratingImage(true);
    try {
      const response = await api.homepageSections.generateCountryImage({
        countryCode: String(formData.countryCode || '').trim().toUpperCase() || undefined,
        country: String(formData.name || '').trim() || undefined,
        fabrics: String(formData.fabrics || '').trim() || undefined,
        imageKeyword: String(formData.imageKeyword || '').trim() || undefined,
      });
      if (response.success && response.data?.image) {
        setFormData((prev: any) => ({
          ...prev,
          image: response.data.image,
          name: response.data.country || prev.name,
          countryCode: response.data.countryCode || prev.countryCode,
          flag: response.data.flag || prev.flag,
        }));
      }
    } catch (error: any) {
      console.error('Error generating country image:', error);
      window.alert(error?.response?.data?.message || 'Failed to generate country image.');
    } finally {
      setGeneratingImage(false);
    }
  };

  const updateStatsItem = (index: number, patch: Partial<{ value: string; suffix: string; label: string; displayOrder: number; isActive: boolean }>) => {
    setFormData((prev: any) => {
      const nextItems = Array.isArray(prev.items) ? [...prev.items] : [];
      const current = nextItems[index] || { value: '', suffix: '', label: '', displayOrder: index, isActive: true };
      nextItems[index] = { ...current, ...patch };
      return { ...prev, items: nextItems };
    });
  };

  const addStatsItem = () => {
    setFormData((prev: any) => {
      const nextItems = Array.isArray(prev.items) ? [...prev.items] : [];
      const displayOrder =
        nextItems.length > 0
          ? Math.max(...nextItems.map((item: any, idx: number) => Number(item?.displayOrder ?? idx))) + 1
          : 0;
      nextItems.push({ value: '', suffix: '', label: '', displayOrder, isActive: true });
      return { ...prev, items: nextItems };
    });
  };

  const removeStatsItem = (index: number) => {
    setFormData((prev: any) => {
      const nextItems = Array.isArray(prev.items) ? [...prev.items] : [];
      nextItems.splice(index, 1);
      return { ...prev, items: nextItems };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = (() => {
        if (type === 'topStrip') {
          const rawMessages =
            typeof formData.messagesText === 'string'
              ? formData.messagesText
              : Array.isArray(formData.messages)
                ? formData.messages.join('\n')
                : '';
          const messages = rawMessages
            .split('\n')
            .map((entry: string) => entry.trim())
            .filter(Boolean);
          if (messages.length === 0) {
            throw new Error('Please enter at least one scrolling message.');
          }
          return {
            messages,
            separator: String(formData.separator || '').trim() || '•',
            repeatCount: Number(formData.repeatCount) || 4,
            animationSeconds: Number(formData.animationSeconds) || 20,
            fontSize: Number(formData.fontSize) || 12,
            isBold: Boolean(formData.isBold),
            pauseOnHover: Boolean(formData.pauseOnHover ?? true),
            textColor: String(formData.textColor || '#ffffff').trim().toLowerCase(),
            backgroundColor: String(formData.backgroundColor || '#000000').trim().toLowerCase(),
          };
        }
        if (type === 'statsStrip') {
          const items = (Array.isArray(formData.items) ? formData.items : [])
            .map((entry: any, index: number) => ({
              value: String(entry?.value || '').trim(),
              suffix: String(entry?.suffix || '').trim(),
              label: String(entry?.label || '').trim().toUpperCase(),
              displayOrder: Number(entry?.displayOrder ?? index) || index,
              isActive: Boolean(entry?.isActive ?? true),
            }))
            .filter((entry: any) => entry.value.length > 0 && entry.label.length > 0);
          if (items.length === 0) {
            throw new Error('Please add at least one statistic with value and label.');
          }
          return {
            items,
            backgroundImage: String(formData.backgroundImage || '').trim(),
            backgroundColor: String(formData.backgroundColor || '#111827').trim().toLowerCase(),
            overlayColor: String(formData.overlayColor || '#000000').trim().toLowerCase(),
            overlayOpacity: Math.max(0, Math.min(100, Number(formData.overlayOpacity) || 45)),
            valueColor: String(formData.valueColor || '#ffffff').trim().toLowerCase(),
            suffixColor: String(formData.suffixColor || '#facc15').trim().toLowerCase(),
            labelColor: String(formData.labelColor || '#d1d5db').trim().toLowerCase(),
          };
        }
        if (type === 'countries') {
          const normalizedCode = String(formData.countryCode || '').trim().toUpperCase();
          const selected =
            countryOptionByCode.get(normalizedCode) ||
            countryOptionByName.get(String(formData.name || '').trim().toLowerCase());
          return {
            ...formData,
            countryCode: selected?.code || normalizedCode,
            name: selected?.name || String(formData.name || '').trim(),
            flag: selected?.flag || String(formData.flag || '').trim(),
            image: String(formData.image || '').trim() || undefined,
            imageKeyword: String(formData.imageKeyword || '').trim() || undefined,
            fabrics: String(formData.fabrics || '').trim() || undefined,
          };
        }
        if (type === 'categories') {
          const title = String(formData.title || '').trim();
          const key = String(formData.key || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const manualList = parseCategoryImageList(formData.categoryImagesText);
          const uploadImage = String(formData.image || '').trim();
          const images = manualList.length > 0 ? manualList : uploadImage ? [uploadImage] : [];
          return {
            ...formData,
            key,
            image: encodeCategoryImageList(images),
          };
        }
        if (type === 'heritage') {
          const linkMode = String(formData.linkMode || 'CUSTOM_URL').toUpperCase();
          const blog = blogOptions.find((option) => option.id === String(formData.blogPostId || ''));
          const resolvedLink =
            linkMode === 'BLOG'
              ? String(blog?.link || '').trim()
              : String(formData.externalUrl || formData.ctaLink || '').trim();
          if (linkMode === 'BLOG' && !resolvedLink) {
            throw new Error('Please select a blog story for heritage link.');
          }
          return {
            title: String(formData.title || '').trim(),
            subtitle: String(formData.subtitle || '').trim(),
            image: String(formData.image || '').trim(),
            ctaText: String(formData.ctaText || '').trim() || undefined,
            ctaLink: resolvedLink || undefined,
            displayOrder: Number(formData.displayOrder || 0),
            isActive: Boolean(formData.isActive),
          };
        }
        if (type === 'testimonials') {
          const initials =
            String(formData.initials || '').trim() ||
            String(formData.name || '')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() || '')
              .join('');
          return { ...formData, initials };
        }
        if (type === 'footer') {
          const termsMode = String(formData.termsLinkMode || 'CUSTOM_URL').toUpperCase() === 'BLOG' ? 'BLOG' : 'CUSTOM_URL';
          const privacyMode =
            String(formData.privacyLinkMode || 'CUSTOM_URL').toUpperCase() === 'BLOG' ? 'BLOG' : 'CUSTOM_URL';
          const termsBlog = blogOptions.find((blog) => blog.id === String(formData.termsBlogPostId || ''));
          const privacyBlog = blogOptions.find((blog) => blog.id === String(formData.privacyBlogPostId || ''));
          const termsHref =
            termsMode === 'BLOG'
              ? String(termsBlog?.link || '').trim()
              : String(formData.termsExternalUrl || '#').trim();
          const privacyHref =
            privacyMode === 'BLOG'
              ? String(privacyBlog?.link || '').trim()
              : String(formData.privacyExternalUrl || '#').trim();
          if (termsMode === 'BLOG' && !termsHref) {
            throw new Error('Please select a blog story for Terms of Service.');
          }
          if (privacyMode === 'BLOG' && !privacyHref) {
            throw new Error('Please select a blog story for Privacy Policy.');
          }
          const shopMenu = parseFooterMenuTextarea(String(formData.shopMenuText || ''));
          const companyMenu = parseFooterMenuTextarea(String(formData.companyMenuText || ''));
          const supportMenu = parseFooterMenuTextarea(String(formData.supportMenuText || ''));
          return {
            companyName: formData.companyName || undefined,
            tagline: formData.tagline || undefined,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            address: formData.address || undefined,
            socialLinks: {
              instagram: String(formData.instagram || '#').trim() || '#',
              facebook: String(formData.facebook || '#').trim() || '#',
              twitter: String(formData.twitter || '#').trim() || '#',
              menus: {
                shop: shopMenu,
                company: companyMenu,
                support: supportMenu,
              },
              policies: {
                terms: {
                  label: 'Terms of Service',
                  linkMode: termsMode,
                  blogPostId: termsMode === 'BLOG' ? String(formData.termsBlogPostId || '') : '',
                  externalUrl: termsMode === 'CUSTOM_URL' ? termsHref : '',
                  href: termsHref || '#',
                },
                privacy: {
                  label: 'Privacy Policy',
                  linkMode: privacyMode,
                  blogPostId: privacyMode === 'BLOG' ? String(formData.privacyBlogPostId || '') : '',
                  externalUrl: privacyMode === 'CUSTOM_URL' ? privacyHref : '',
                  href: privacyHref || '#',
                },
              },
            },
            copyright: formData.copyright || undefined,
          };
        }
        return formData;
      })();

      let response;
      if (item?.id) {
        // Update existing
        switch (type) {
          case 'topStrip':
            response = await api.homepageSections.updateAdminTopStrip(payload);
            break;
          case 'statsStrip':
            response = await api.homepageSections.updateAdminStatsStrip(payload);
            break;
          case 'countries':
            response = await api.homepageSections.updateCountry(item.id, payload);
            break;
          case 'howItWorks':
            response = await api.homepageSections.updateHowItWorksStep(item.id, payload);
            break;
          case 'categories':
            response = await api.homepageSections.updateCategory(item.id, payload);
            break;
          case 'designerSpotlight':
            response = await api.homepageSections.updateDesignerSpotlight(item.id, payload);
            break;
          case 'heritage':
            response = await api.homepageSections.updateHeritage(item.id, payload);
            break;
          case 'testimonials':
            response = await api.homepageSections.updateTestimonial(item.id, payload);
            break;
          case 'footer':
            response = await api.homepageSections.updateFooter(item.id, payload);
            break;
        }
      } else {
        // Create new
        switch (type) {
          case 'topStrip':
            response = await api.homepageSections.updateAdminTopStrip(payload);
            break;
          case 'statsStrip':
            response = await api.homepageSections.updateAdminStatsStrip(payload);
            break;
          case 'countries':
            response = await api.homepageSections.createCountry(payload);
            break;
          case 'howItWorks':
            response = await api.homepageSections.createHowItWorksStep(payload);
            break;
          case 'categories':
            response = await api.homepageSections.createCategory(payload);
            break;
          case 'designerSpotlight':
            response = await api.homepageSections.createDesignerSpotlight(payload);
            break;
          case 'heritage':
            response = await api.homepageSections.createHeritage(payload);
            break;
          case 'testimonials':
            response = await api.homepageSections.createTestimonial(payload);
            break;
          case 'footer':
            response = await api.homepageSections.createFooter(payload);
            break;
        }
      }
      if (response?.success) {
        onSave();
      } else {
        throw new Error('Unable to save this section right now.');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      const message =
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        'Failed to save changes.';
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => {
    switch (type) {
      case 'topStrip':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scrolling Messages (one per line)</label>
              <textarea
                value={
                  typeof formData.messagesText === 'string'
                    ? formData.messagesText
                    : Array.isArray(formData.messages)
                      ? formData.messages.join('\n')
                      : ''
                }
                onChange={(e) => setFormData({ ...formData, messagesText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Separator</label>
                <input
                  type="text"
                  value={formData.separator || '•'}
                  onChange={(e) => setFormData({ ...formData, separator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                <input
                  type="number"
                  value={formData.repeatCount || 4}
                  onChange={(e) => setFormData({ ...formData, repeatCount: parseInt(e.target.value, 10) || 4 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={2}
                  max={12}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Animation Seconds</label>
                <input
                  type="number"
                  value={formData.animationSeconds || 20}
                  onChange={(e) => setFormData({ ...formData, animationSeconds: parseInt(e.target.value, 10) || 20 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={8}
                  max={120}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Size (px)</label>
                <input
                  type="number"
                  value={formData.fontSize || 12}
                  onChange={(e) => setFormData({ ...formData, fontSize: parseInt(e.target.value, 10) || 12 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={10}
                  max={40}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="top-strip-bold"
                type="checkbox"
                checked={!!formData.isBold}
                onChange={(e) => setFormData({ ...formData, isBold: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="top-strip-bold" className="text-sm font-medium text-gray-700">
                Bold text
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="top-strip-pause-on-hover"
                type="checkbox"
                checked={!!formData.pauseOnHover}
                onChange={(e) => setFormData({ ...formData, pauseOnHover: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="top-strip-pause-on-hover" className="text-sm font-medium text-gray-700">
                Pause marquee on mouse hover
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.textColor || '#ffffff'}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="h-10 w-14 rounded border border-gray-300 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={formData.textColor || '#ffffff'}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.backgroundColor || '#000000'}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="h-10 w-14 rounded border border-gray-300 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={formData.backgroundColor || '#000000'}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </>
        );
      case 'statsStrip':
        return (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background Image URL (optional)</label>
                <input
                  type="text"
                  value={formData.backgroundImage || ''}
                  onChange={(e) => setFormData({ ...formData, backgroundImage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overlay Opacity (%)</label>
                <input
                  type="number"
                  value={formData.overlayOpacity ?? 45}
                  onChange={(e) => setFormData({ ...formData, overlayOpacity: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={0}
                  max={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                <input
                  type="color"
                  value={formData.backgroundColor || '#111827'}
                  onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Overlay Color</label>
                <input
                  type="color"
                  value={formData.overlayColor || '#000000'}
                  onChange={(e) => setFormData({ ...formData, overlayColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value Color</label>
                <input
                  type="color"
                  value={formData.valueColor || '#ffffff'}
                  onChange={(e) => setFormData({ ...formData, valueColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Suffix Color</label>
                <input
                  type="color"
                  value={formData.suffixColor || '#facc15'}
                  onChange={(e) => setFormData({ ...formData, suffixColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label Color</label>
                <input
                  type="color"
                  value={formData.labelColor || '#d1d5db'}
                  onChange={(e) => setFormData({ ...formData, labelColor: e.target.value })}
                  className="h-10 w-full cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Statistic Items</label>
                <Button type="button" onClick={addStatsItem}>Add Item</Button>
              </div>
              {(Array.isArray(formData.items) ? formData.items : []).map((entry: any, index: number) => (
                <div key={`stat-item-${index}`} className="rounded-lg border border-gray-200 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
                      <input
                        type="text"
                        value={entry?.value || ''}
                        onChange={(e) => updateStatsItem(index, { value: e.target.value })}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Suffix</label>
                      <input
                        type="text"
                        value={entry?.suffix || ''}
                        onChange={(e) => updateStatsItem(index, { suffix: e.target.value })}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="K+"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                      <input
                        type="text"
                        value={entry?.label || ''}
                        onChange={(e) => updateStatsItem(index, { label: e.target.value.toUpperCase() })}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        placeholder="COUNTRIES"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Order</label>
                      <input
                        type="number"
                        value={entry?.displayOrder ?? index}
                        onChange={(e) => updateStatsItem(index, { displayOrder: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        min={0}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={Boolean(entry?.isActive ?? true)}
                          onChange={(e) => updateStatsItem(index, { isActive: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => removeStatsItem(index)}
                        disabled={(Array.isArray(formData.items) ? formData.items.length : 0) <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      case 'countries':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Name</label>
              <select
                value={formData.name || ''}
                onChange={(e) => handleCountryNameChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              >
                <option value="">Select country</option>
                {effectiveCountryOptions.map((option) => (
                  <option key={option.code} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
              <input
                type="text"
                value={formData.countryCode || ''}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auto Flag</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-2xl">
                {formData.flag || '🌍'}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Flag icon is auto-filled based on country selection.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabrics</label>
              <input
                type="text"
                value={formData.fabrics || ''}
                onChange={(e) => setFormData({ ...formData, fabrics: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Kente, Adinkra"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image Keyword (for auto-generate)</label>
              <input
                type="text"
                value={formData.imageKeyword || ''}
                onChange={(e) => setFormData({ ...formData, imageKeyword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="e.g. kente fashion portrait"
              />
              <p className="mt-1 text-xs text-gray-500">
                If image is empty when saving, system auto-generates from this keyword and country details.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.image || ''}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Auto-generated or paste image URL"
                />
                <Button
                  type="button"
                  onClick={handleGenerateCountryImage}
                  disabled={generatingImage}
                >
                  {generatingImage ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </>
        );
      case 'howItWorks':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Number</label>
              <input
                type="number"
                value={formData.stepNumber || 1}
                onChange={(e) => setFormData({ ...formData, stepNumber: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <textarea
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon Name</label>
              <input
                type="text"
                value={formData.icon || ''}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Search, Eye, Sparkles..."
                required
              />
            </div>
          </>
        );
      case 'categories':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (slug)</label>
              <input
                type="text"
                value={formData.key || ''}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="ready-to-wear"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Images (up to 5 URLs, one per line)
              </label>
              <textarea
                value={formData.categoryImagesText || ''}
                onChange={(e) => {
                  const nextText = e.target.value;
                  const parsed = parseCategoryImageList(nextText);
                  setFormData({
                    ...formData,
                    categoryImagesText: nextText,
                    image: parsed[0] || formData.image || '',
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={4}
                placeholder="https://.../image-1.jpg&#10;https://.../image-2.jpg"
              />
              <p className="mt-1 text-xs text-gray-500">
                Homepage rotates these images automatically for a dynamic look.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input
                type="text"
                value={formData.ctaText || ''}
                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Shop Now"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
              <input
                type="text"
                value={formData.ctaLink || ''}
                onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="/designs"
                required
              />
            </div>
          </>
        );
      case 'designerSpotlight':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designer / Seller</label>
              <select
                value={formData.designerId || ''}
                onChange={(e) => setFormData({ ...formData, designerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              >
                <option value="">Select profile</option>
                {designerProfiles.length === 0 && sellerProfiles.length === 0 ? (
                  <option value="" disabled>
                    No designer/seller profiles found yet
                  </option>
                ) : null}
                {designerProfiles.length > 0 ? (
                  <optgroup label="Designers">
                    {designerProfiles.map((designer) => (
                      <option key={designer.id} value={designer.id}>
                        {designer.businessName}
                        {designer.country ? ` (${designer.country})` : ''} [Designer]
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {sellerProfiles.length > 0 ? (
                  <optgroup label="Sellers">
                    {sellerProfiles.map((seller) => (
                      <option key={seller.id} value={seller.id}>
                        {seller.businessName}
                        {seller.country ? ` (${seller.country})` : ''} [Seller]
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote</label>
              <textarea
                value={formData.quote || ''}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={2}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Link Destination</label>
              <select
                value={formData.linkMode || 'DEFAULT_STORE'}
                onChange={(e) => setFormData({ ...formData, linkMode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="DEFAULT_STORE">Default store page</option>
                <option value="CUSTOM_URL">Custom URL</option>
                <option value="BLOG">Blog story</option>
              </select>
            </div>
            {String(formData.linkMode || 'DEFAULT_STORE') === 'CUSTOM_URL' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom URL</label>
                <input
                  type="url"
                  value={formData.externalUrl || ''}
                  onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="https://example.com/story"
                  required
                />
              </div>
            ) : null}
            {String(formData.linkMode || 'DEFAULT_STORE') === 'BLOG' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Blog Story</label>
                <select
                  value={formData.blogPostId || ''}
                  onChange={(e) => setFormData({ ...formData, blogPostId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value="">Select story</option>
                  {filteredBlogOptions.map((blog) => (
                    <option key={blog.id} value={blog.id}>
                      [{blog.audienceType}] {blog.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </>
        );
      case 'heritage':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <input
                type="text"
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input
                type="text"
                value={formData.ctaText || ''}
                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Read Our Story"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
              <select
                value={formData.linkMode || 'CUSTOM_URL'}
                onChange={(e) => setFormData({ ...formData, linkMode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="CUSTOM_URL">Custom / External URL</option>
                <option value="BLOG">Blog story</option>
              </select>
            </div>
            {String(formData.linkMode || 'CUSTOM_URL') === 'BLOG' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Blog Story</label>
                <select
                  value={formData.blogPostId || ''}
                  onChange={(e) => setFormData({ ...formData, blogPostId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value="">Select story</option>
                  {blogOptions.map((blog) => (
                    <option key={blog.id} value={blog.id}>
                      [{blog.audienceType}] {blog.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">External URL / Internal Path</label>
                <input
                  type="text"
                  value={formData.externalUrl || formData.ctaLink || ''}
                  onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value, ctaLink: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="/about or https://example.com/story"
                />
              </div>
            )}
          </>
        );
      case 'testimonials':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="New York, USA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initials</label>
              <input
                type="text"
                value={formData.initials || ''}
                onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="AJ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote</label>
              <textarea
                value={formData.quote || ''}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={4}
                required
              />
            </div>
          </>
        );
      case 'footer':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.companyName || ''}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="ZuriKaribu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Social Links</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Instagram</label>
                  <input
                    type="text"
                    value={formData.instagram || ''}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Facebook</label>
                  <input
                    type="text"
                    value={formData.facebook || ''}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="https://facebook.com/..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Twitter / X</label>
                  <input
                    type="text"
                    value={formData.twitter || ''}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="https://x.com/..."
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Policy Links</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Terms of Service</p>
                  <select
                    value={formData.termsLinkMode || 'CUSTOM_URL'}
                    onChange={(e) => setFormData({ ...formData, termsLinkMode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="CUSTOM_URL">Custom / External URL</option>
                    <option value="BLOG">Blog Story</option>
                  </select>
                  {String(formData.termsLinkMode || 'CUSTOM_URL') === 'BLOG' ? (
                    <select
                      value={formData.termsBlogPostId || ''}
                      onChange={(e) => setFormData({ ...formData, termsBlogPostId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="">Select blog story</option>
                      {blogOptions.map((blog) => (
                        <option key={blog.id} value={blog.id}>
                          [{blog.audienceType}] {blog.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.termsExternalUrl || ''}
                      onChange={(e) => setFormData({ ...formData, termsExternalUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="/stories/terms or https://..."
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Privacy Policy</p>
                  <select
                    value={formData.privacyLinkMode || 'CUSTOM_URL'}
                    onChange={(e) => setFormData({ ...formData, privacyLinkMode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="CUSTOM_URL">Custom / External URL</option>
                    <option value="BLOG">Blog Story</option>
                  </select>
                  {String(formData.privacyLinkMode || 'CUSTOM_URL') === 'BLOG' ? (
                    <select
                      value={formData.privacyBlogPostId || ''}
                      onChange={(e) => setFormData({ ...formData, privacyBlogPostId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="">Select blog story</option>
                      {blogOptions.map((blog) => (
                        <option key={blog.id} value={blog.id}>
                          [{blog.audienceType}] {blog.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.privacyExternalUrl || ''}
                      onChange={(e) => setFormData({ ...formData, privacyExternalUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      placeholder="/stories/privacy or https://..."
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Footer Menus</h4>
              <p className="text-xs text-gray-500">Use one item per line in this format: <span className="font-medium">Label|URL</span></p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Shop Menu</label>
                <textarea
                  value={formData.shopMenuText || ''}
                  onChange={(e) => setFormData({ ...formData, shopMenuText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Menu</label>
                <textarea
                  value={formData.companyMenuText || ''}
                  onChange={(e) => setFormData({ ...formData, companyMenuText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Support Menu</label>
                <textarea
                  value={formData.supportMenuText || ''}
                  onChange={(e) => setFormData({ ...formData, supportMenuText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  rows={4}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Copyright</label>
              <input
                type="text"
                value={formData.copyright || ''}
                onChange={(e) => setFormData({ ...formData, copyright: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-white shadow-xl max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Edit' : 'Add'} {type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex h-[calc(92vh-84px)] flex-col">
          <div className="space-y-4 overflow-y-auto p-6">
            {renderFormFields()}

            {/* Image Upload */}
            {(type === 'countries' || type === 'categories' || type === 'designerSpotlight' || type === 'heritage' || type === 'testimonials') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <div className="flex items-center gap-4">
                  {(type === 'testimonials' ? formData.avatar : formData.image) && (
                    <img src={type === 'testimonials' ? formData.avatar : formData.image} alt="Preview" className="h-20 w-20 object-cover" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, type === 'testimonials' ? 'avatar' : 'image')}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Display Order */}
            {type !== 'footer' && type !== 'topStrip' && type !== 'statsStrip' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.displayOrder || 0}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={0}
                />
              </div>
            )}

            {/* Active Status */}
            {type !== 'footer' && type !== 'topStrip' && type !== 'statsStrip' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={!!formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? 'Saving...' : item ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

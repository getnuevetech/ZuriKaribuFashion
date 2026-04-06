import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Scissors,
  Shirt,
  ClipboardCheck,
  Tag,
  Layers,
  DollarSign,
  Image as ImageIcon,
  FileText,
  CreditCard,
  Truck,
  Sparkles,
  Star,
  Bell,
  Database,
  Search,
  Mail,
  MessageSquare,
  PhoneCall,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import DashboardErrorBoundary from '../components/DashboardErrorBoundary';
import { api } from '../services/api';
import { isSuperAdminUser } from '../auth/superAdmin';

import { 
  User, 
  Ruler,
  Home,
  LayoutTemplate,
  LayoutGrid
} from 'lucide-react';

type UserRole =
  | 'ADMINISTRATOR'
  | 'FABRIC_SELLER'
  | 'FASHION_DESIGNER'
  | 'RESELLER_INFLUENCER'
  | 'QA_TEAM'
  | 'CUSTOMER';
type DashboardType = 'admin' | 'seller' | 'designer' | 'reseller' | 'qa' | 'customer';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface DashboardSearchEntry {
  label: string;
  href: string;
  keywords: string[];
}
interface DashboardClockWeatherSettings {
  showClock: boolean;
  showDate: boolean;
  showAmPm: boolean;
  showGmt: boolean;
  showSeconds: boolean;
  showTimeZoneName: boolean;
  showWeather: boolean;
  weatherLocationMode: 'AUTO_USER_COUNTRY' | 'CUSTOM_LOCATION';
  customWeatherLocation: string;
  weatherUnit: 'C' | 'F';
  weatherRefreshSeconds: number;
}
interface DashboardWeatherSnapshot {
  temperature: number;
  weatherLabel: string;
  locationLabel: string;
}

const LEGACY_HOMEPAGE_PATHS = ['/admin/homepage', '/admin/homepage-visibility'] as const;
const JENKS_HOMEPAGE_PATHS = ['/admin/jenks-homepage', '/admin/homepage-sections'] as const;
const JENKS_V2_FRONTPAGE_MANAGER_PATHS = [
  '/admin/jenks-v2-frontpage-manager',
  '/admin/jenks-v2-frontpage-manager/top-navigations',
  '/admin/jenks-v2-frontpage-manager/shop-by',
  '/admin/jenks-v2-frontpage-manager/category-manage',
  '/admin/jenks-v2-frontpage-manager/text-icon-cards',
  '/admin/jenks-v2-frontpage-manager/featured',
  '/admin/jenks-v2-frontpage-manager/fresh-drops',
  '/admin/jenks-v2-frontpage-manager/designer-spotlight',
  '/admin/jenks-v2-frontpage-manager/heritage',
  '/admin/jenks-v2-frontpage-manager/newsletter-footer',
  '/admin/jenks-v2-frontpage-manager/section-visibility',
] as const;
const navItems: Record<DashboardType, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Profile', href: '/admin/profile', icon: User },
    { label: 'Customer Accounts', href: '/admin/customer-accounts', icon: Users },
    { label: 'Administrator Accounts', href: '/admin/administrator-accounts', icon: User },
    { label: 'Vendor Profiles', href: '/admin/vendor-profiles', icon: Tag },
    { label: 'Referral/Influence', href: '/admin/resellers', icon: Users },
    { label: 'Traffic Report', href: '/admin/traffic', icon: Layers },
    { label: 'Report Studio', href: '/admin/reports', icon: FileText },
    { label: 'Measurement Templates', href: '/admin/measurement-templates', icon: Ruler },
    { label: 'Currency Matrix', href: '/admin/currency', icon: DollarSign },
    { label: 'Product Management', href: '/admin/products', icon: Package },
    { label: 'Automation', href: '/admin/automation/system', icon: Sparkles },
    { label: 'Dynamic Fields', href: '/admin/dynamic-fields', icon: Layers },
    { label: 'Pricing Rules', href: '/admin/pricing', icon: DollarSign },
    { label: 'Promo Codes', href: '/admin/promo-codes', icon: CreditCard },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard },
    { label: 'Shipping', href: '/admin/shipping', icon: Truck },
    { label: '3D TryON', href: '/admin/try-on', icon: Sparkles },
    { label: 'Featured Requests', href: '/admin/featured-requests', icon: Star },
    { label: 'Notifications', href: '/admin/notifications', icon: Bell },
    { label: 'Partner API', href: '/admin/partners', icon: Settings },
    { label: 'API Diagnostics', href: '/admin/api-diagnostics', icon: Settings },
    { label: 'Order Management', href: '/admin/orders', icon: ShoppingBag },
    { label: 'Ticket Management', href: '/admin/ticket-management', icon: MessageSquare },
    { label: 'Customer Service Chat', href: '/admin/customer-service/chat', icon: MessageSquare },
    { label: 'Customer Service Settings', href: '/admin/customer-service/settings', icon: Settings },
    { label: 'VoIP Management', href: '/admin/voip', icon: PhoneCall },
    { label: 'Banners', href: '/admin/banners', icon: ImageIcon },
    { label: 'Homepage', href: '/admin/homepage', icon: LayoutTemplate },
    { label: 'Jenks FrontPage Manage', href: '/admin/jenks-homepage', icon: LayoutGrid },
    { label: 'Jenks-V2 FrontPage Manager', href: '/admin/jenks-v2-frontpage-manager', icon: LayoutGrid },
    { label: 'Homepage Runtime Switchboard', href: '/admin/homepage-runtime', icon: LayoutGrid },
    { label: 'Category Pages', href: '/admin/category-pages', icon: LayoutGrid },
    { label: 'Blogs', href: '/admin/blogs', icon: FileText },
    { label: 'Help Center Content', href: '/admin/help-center-content', icon: FileText },
    { label: 'Module Switchboard', href: '/admin/modules', icon: Settings },
    { label: 'Activity Logs', href: '/admin/activity-logs', icon: ClipboardCheck },
  ],
  seller: [
    { label: 'Dashboard', href: '/seller', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/seller?tab=fabrics', icon: Package },
    { label: 'Failed Product Approval', href: '/seller/failed-product-approvals', icon: ClipboardCheck },
    { label: '3D TryON', href: '/seller?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/seller?tab=orders', icon: ShoppingBag },
    { label: 'Messages', href: '/seller/messages', icon: Mail },
    { label: 'Support Center', href: '/seller/support-center', icon: MessageSquare },
    { label: 'Payment', href: '/seller/payments', icon: CreditCard },
    { label: 'Enterprise', href: '/seller/enterprise', icon: Users },
    { label: 'Profile', href: '/seller/profile', icon: User },
  ],
  designer: [
    { label: 'Dashboard', href: '/designer', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/designer?tab=designs', icon: Package },
    { label: 'Failed Product Approval', href: '/designer/failed-product-approvals', icon: ClipboardCheck },
    { label: 'Measurements', href: '/designer/measurements', icon: Ruler },
    { label: '3D TryON', href: '/designer?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/designer?tab=orders', icon: ShoppingBag },
    { label: 'Messages', href: '/designer/messages', icon: Mail },
    { label: 'Support Center', href: '/designer/support-center', icon: MessageSquare },
    { label: 'Payment', href: '/designer/payments', icon: CreditCard },
    { label: 'Enterprise', href: '/designer/enterprise', icon: Users },
    { label: 'Profile', href: '/designer/profile', icon: User },
  ],
  reseller: [
    { label: 'Dashboard', href: '/reseller', icon: LayoutDashboard },
    { label: 'Referrals', href: '/reseller?tab=referrals', icon: Users },
    { label: 'Commissions', href: '/reseller?tab=commissions', icon: DollarSign },
    { label: 'Profile', href: '/reseller/profile', icon: User },
    { label: 'Materials', href: '/reseller/materials', icon: ImageIcon },
    { label: 'Support Center', href: '/reseller/support-center', icon: MessageSquare },
  ],
  qa: [
    { label: 'Dashboard', href: '/qa', icon: LayoutDashboard },
    { label: 'Orders', href: '/qa?tab=pending', icon: ClipboardCheck },
    { label: 'Messages', href: '/qa/messages', icon: Mail },
    { label: 'Support Center', href: '/help-center', icon: MessageSquare },
  ],
  customer: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: '3D TryON', href: '/dashboard?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/orders', icon: ShoppingBag },
    { label: 'Messages', href: '/dashboard/messages', icon: Mail },
    { label: 'Support Center', href: '/help-center', icon: MessageSquare },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Measurements', href: '/measurements', icon: Ruler },
  ],
};

const navModuleByHref: Record<string, 'ticketing' | 'chat' | 'communications' | 'help_center'> = {
  '/admin/ticket-management': 'ticketing',
  '/admin/customer-service/settings': 'ticketing',
  '/admin/customer-service/chat': 'chat',
  '/admin/voip': 'communications',
  '/admin/help-center-content': 'help_center',
  '/seller/support-center': 'help_center',
  '/designer/support-center': 'help_center',
  '/reseller/support-center': 'help_center',
  '/help-center': 'help_center',
};

const roleLabels: Record<DashboardType, string> = {
  admin: 'Administrator',
  seller: 'Fabric Seller',
  designer: 'Fashion Designer',
  reseller: 'Reseller / Influencer',
  qa: 'QA Team',
  customer: 'Customer',
};

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  NG: 'Africa/Lagos',
  GH: 'Africa/Accra',
  KE: 'Africa/Nairobi',
  ZA: 'Africa/Johannesburg',
  EG: 'Africa/Cairo',
  SN: 'Africa/Dakar',
  RW: 'Africa/Kigali',
  TZ: 'Africa/Dar_es_Salaam',
  UG: 'Africa/Kampala',
  ET: 'Africa/Addis_Ababa',
  CM: 'Africa/Douala',
  DZ: 'Africa/Algiers',
  MA: 'Africa/Casablanca',
  US: 'America/New_York',
  CA: 'America/Toronto',
  GB: 'Europe/London',
  FR: 'Europe/Paris',
};
const COUNTRY_WEATHER_QUERY_MAP: Record<string, string> = {
  NG: 'Lagos, Nigeria',
  GH: 'Accra, Ghana',
  KE: 'Nairobi, Kenya',
  ZA: 'Johannesburg, South Africa',
  EG: 'Cairo, Egypt',
  SN: 'Dakar, Senegal',
  RW: 'Kigali, Rwanda',
  TZ: 'Dar es Salaam, Tanzania',
  UG: 'Kampala, Uganda',
  ET: 'Addis Ababa, Ethiopia',
  CM: 'Douala, Cameroon',
  DZ: 'Algiers, Algeria',
  MA: 'Casablanca, Morocco',
  US: 'New York, United States',
  CA: 'Toronto, Canada',
  GB: 'London, United Kingdom',
  FR: 'Paris, France',
};
const DASHBOARD_CLOCK_WEATHER_DEFAULTS: DashboardClockWeatherSettings = {
  showClock: true,
  showDate: true,
  showAmPm: true,
  showGmt: true,
  showSeconds: true,
  showTimeZoneName: true,
  showWeather: true,
  weatherLocationMode: 'AUTO_USER_COUNTRY',
  customWeatherLocation: '',
  weatherUnit: 'C',
  weatherRefreshSeconds: 600,
};
const resolveTimezoneFromCountry = (countryRaw: string) => {
  const value = String(countryRaw || '').trim().toUpperCase();
  if (!value) return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (COUNTRY_TIMEZONE_MAP[value]) return COUNTRY_TIMEZONE_MAP[value];
  const compact = value.replace(/[^A-Z]/g, '');
  if (COUNTRY_TIMEZONE_MAP[compact]) return COUNTRY_TIMEZONE_MAP[compact];
  const keywordMap: Array<[string, string]> = [
    ['NIGERIA', 'Africa/Lagos'],
    ['GHANA', 'Africa/Accra'],
    ['KENYA', 'Africa/Nairobi'],
    ['SOUTH AFRICA', 'Africa/Johannesburg'],
    ['EGYPT', 'Africa/Cairo'],
    ['SENEGAL', 'Africa/Dakar'],
    ['TANZANIA', 'Africa/Dar_es_Salaam'],
    ['UGANDA', 'Africa/Kampala'],
    ['ETHIOPIA', 'Africa/Addis_Ababa'],
    ['UNITED STATES', 'America/New_York'],
    ['CANADA', 'America/Toronto'],
    ['UNITED KINGDOM', 'Europe/London'],
  ];
  const match = keywordMap.find(([key]) => value.includes(key));
  return match?.[1] || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
};
const normalizeDashboardClockWeatherSettings = (raw: unknown): DashboardClockWeatherSettings => {
  if (!raw || typeof raw !== 'object') return { ...DASHBOARD_CLOCK_WEATHER_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const asBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  const asNum = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const showClock = asBool(row.showClock, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showClock);
  let showAmPm = asBool(row.showAmPm, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showAmPm);
  let showGmt = asBool(row.showGmt, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showGmt);
  if (showClock && !showAmPm && !showGmt) {
    showAmPm = true;
    showGmt = true;
  }
  return {
    showClock,
    showDate: asBool(row.showDate, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showDate),
    showAmPm,
    showGmt,
    showSeconds: asBool(row.showSeconds, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showSeconds),
    showTimeZoneName: asBool(row.showTimeZoneName, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showTimeZoneName),
    showWeather: asBool(row.showWeather, DASHBOARD_CLOCK_WEATHER_DEFAULTS.showWeather),
    weatherLocationMode:
      String(row.weatherLocationMode || '').trim().toUpperCase() === 'CUSTOM_LOCATION'
        ? 'CUSTOM_LOCATION'
        : 'AUTO_USER_COUNTRY',
    customWeatherLocation: String(row.customWeatherLocation || '').trim().slice(0, 120),
    weatherUnit: String(row.weatherUnit || '').trim().toUpperCase() === 'F' ? 'F' : 'C',
    weatherRefreshSeconds: Math.max(
      60,
      Math.min(
        3600,
        Math.round(asNum(row.weatherRefreshSeconds, DASHBOARD_CLOCK_WEATHER_DEFAULTS.weatherRefreshSeconds))
      )
    ),
  };
};
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy hail thunderstorm',
};
const getGmtOffsetLabel = (date: Date, timeZone: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const token = parts.find((part) => part.type === 'timeZoneName')?.value || '';
    return token || 'GMT';
  } catch {
    return 'GMT';
  }
};
const weatherLocationFromTimezone = (timeZone: string) => {
  const token = String(timeZone || '').trim();
  if (!token.includes('/')) return '';
  const cityToken = token.split('/').pop() || '';
  if (!cityToken) return '';
  return cityToken.replace(/_/g, ' ');
};

interface DashboardLayoutProps {
  userType: DashboardType;
}

export default function DashboardLayout({ userType }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState(true);
  const [isTicketManagementMenuOpen, setIsTicketManagementMenuOpen] = useState(true);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(true);
  const [isLegacyMenuOpen, setIsLegacyMenuOpen] = useState(true);
  const [isJenksMenuOpen, setIsJenksMenuOpen] = useState(true);
  const [isJenksV2MenuOpen, setIsJenksV2MenuOpen] = useState(true);
  const [isAdminAccountsMenuOpen, setIsAdminAccountsMenuOpen] = useState(true);
  const [isProductManagementMenuOpen, setIsProductManagementMenuOpen] = useState(true);
  const [isAutomationMenuOpen, setIsAutomationMenuOpen] = useState(true);
  const [isReferralMenuOpen, setIsReferralMenuOpen] = useState(true);
  const [isCustomerAccountsMenuOpen, setIsCustomerAccountsMenuOpen] = useState(true);
  const [isEnterpriseMenuOpen, setIsEnterpriseMenuOpen] = useState(true);
  const [enterpriseRoleManagementAllowed, setEnterpriseRoleManagementAllowed] = useState(false);
  const [supportCalling, setSupportCalling] = useState(false);
  const [moduleAccessMap, setModuleAccessMap] = useState<Record<string, { allowed: boolean }> | null>(null);
  const [clockNow, setClockNow] = useState<Date>(() => new Date());
  const [dashboardClockWeatherSettings, setDashboardClockWeatherSettings] = useState<DashboardClockWeatherSettings>(
    DASHBOARD_CLOCK_WEATHER_DEFAULTS
  );
  const [weatherNow, setWeatherNow] = useState<DashboardWeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string>('');
  const { user, token, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const items = navItems[userType] || [];
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isSuperAdmin = useMemo(() => isSuperAdminUser(user as any), [user]);
  const hasPermissionRequirement = (requirement: string) => {
    const alternatives = String(requirement || '')
      .split('|')
      .map((token) => token.trim())
      .filter(Boolean);
    if (alternatives.length === 0) return true;
    return alternatives.some((permission) => userPermissions.includes(permission));
  };
  const canAccessAdminNav = (href: string) => {
    if (userType !== 'admin') return true;
    if (
      (href === '/admin/homepage' ||
        href === '/admin/homepage-visibility' ||
        href === '/admin/homepage-sections' ||
        href === '/admin/jenks-homepage' ||
        href === '/admin/homepage-runtime' ||
        href === '/admin/jenks-v2-frontpage-manager' ||
        href.startsWith('/admin/jenks-v2-frontpage-manager/')) &&
      !isSuperAdmin
    ) {
      return false;
    }
    if (!userPermissions || userPermissions.length === 0 || userPermissions.includes('*')) return true;
    const permissionByHref: Record<string, string[]> = {
      '/admin/users': ['users:read'],
      '/admin/profile': [],
      '/admin/customer-accounts': ['users:read'],
      '/admin/customer-accounts/newsletter-subscribers': ['users:read'],
      '/admin/administrator-accounts': [],
      '/admin/administrators': ['users:read'],
      '/admin/roles': ['admin:roles:manage', 'users:read'],
      '/admin/authenticator-security': ['authenticator:manage|users:manage'],
      '/admin/vendor-profiles': ['vendor_profiles:read'],
      '/admin/resellers': ['users:manage'],
      '/admin/referrals/list': ['users:read'],
      '/admin/referrals/materials': ['users:manage'],
      '/admin/reports': ['admin:dashboard:read'],
      '/admin/activity-logs': ['session_audit:read'],
      '/admin/session-audit': ['session_audit:read'],
      '/admin/traffic': ['traffic:read'],
      '/admin/measurement-templates': ['measurement_templates:manage'],
      '/admin/currency': ['currency:manage'],
      '/admin/products': ['products:manage'],
      '/admin/products/configuration': ['products:manage'],
      '/admin/products/stock-list': ['products:manage'],
      '/admin/products/price-compare': ['products:manage'],
      '/admin/products/failed-ai-approvals': ['products:manage'],
      '/admin/product-labels': ['products:manage'],
      '/admin/product-change-requests': ['products:manage'],
      '/admin/automation/approvals': ['products:manage'],
      '/admin/automation/ai-integrations': ['products:manage'],
      '/admin/automation/system': ['products:manage'],
      '/admin/dynamic-fields': ['dynamic_fields:manage|products:manage|users:manage'],
      '/admin/pricing': ['pricing:manage'],
      '/admin/promo-codes': ['pricing:manage'],
      '/admin/payments': ['payments:manage'],
      '/admin/vendor-payments': ['payments:manage'],
      '/admin/shipping': ['shipping:manage'],
      '/admin/try-on': ['products:manage'],
      '/admin/featured-requests': ['products:manage'],
      '/admin/notifications': ['notifications:manage'],
      '/admin/backups': ['backups:manage'],
      '/admin/partners': ['users:manage'],
      '/admin/orders': ['orders:manage'],
      '/admin/ticket-management': ['orders:manage'],
      '/admin/tickets': ['orders:manage'],
      '/admin/customer-service/chat': ['customer_service:chat:manage'],
      '/admin/customer-service/settings': ['customer_service:settings:manage'],
      '/admin/voip': ['voip:manage|whatsapp:manage|orders:manage'],
      '/admin/banners': ['banners:manage'],
      '/admin/homepage': ['homepage:manage'],
      '/admin/homepage-visibility': ['homepage:manage'],
      '/admin/homepage-sections': ['homepage:manage'],
      '/admin/jenks-homepage': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/top-navigations': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/shop-by': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/category-manage': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/text-icon-cards': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/featured': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/fresh-drops': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/designer-spotlight': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/heritage': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/newsletter-footer': ['homepage:manage'],
      '/admin/jenks-v2-frontpage-manager/section-visibility': ['homepage:manage'],
      '/admin/homepage-runtime': ['homepage:manage'],
      '/admin/category-pages': ['homepage:manage'],
      '/admin/blogs': ['homepage:manage'],
      '/admin/help-center-content': ['help_center:manage|homepage:manage'],
      '/admin/modules': ['modules:manage|users:manage|admin:roles:manage'],
    };
    const required = permissionByHref[href] || [];
    if (required.length === 0) return true;
    return required.every((requirement) => hasPermissionRequirement(requirement));
  };
  const canAccessModuleNav = (href: string) => {
    const moduleKey = navModuleByHref[href];
    if (!moduleKey) return true;
    if (!moduleAccessMap) return true;
    return moduleAccessMap[moduleKey]?.allowed !== false;
  };
  const visibleItems = items
    .filter((item) => canAccessAdminNav(item.href) && canAccessModuleNav(item.href))
    .filter((item) => {
      if (userType !== 'admin' || !isSuperAdmin) return true;
      return item.href !== '/admin/homepage-visibility';
    });
  const roleLabel = userType === 'admin' && isSuperAdmin ? 'Super Admin' : roleLabels[userType] || 'User';
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const userCountryRaw = String((user as any)?.country || (user as any)?.location || '').trim();
  const userCountryCode = useMemo(() => {
    const compact = userCountryRaw.toUpperCase().replace(/[^A-Z]/g, '');
    if (compact.length === 2) return compact;
    const keywordMap: Array<[string, string]> = [
      ['NIGERIA', 'NG'],
      ['GHANA', 'GH'],
      ['KENYA', 'KE'],
      ['SOUTH AFRICA', 'ZA'],
      ['EGYPT', 'EG'],
      ['SENEGAL', 'SN'],
      ['RWANDA', 'RW'],
      ['TANZANIA', 'TZ'],
      ['UGANDA', 'UG'],
      ['ETHIOPIA', 'ET'],
      ['CAMEROON', 'CM'],
      ['ALGERIA', 'DZ'],
      ['MOROCCO', 'MA'],
      ['UNITED STATES', 'US'],
      ['CANADA', 'CA'],
      ['UNITED KINGDOM', 'GB'],
      ['FRANCE', 'FR'],
    ];
    const upper = userCountryRaw.toUpperCase();
    const match = keywordMap.find(([keyword]) => upper.includes(keyword));
    return match?.[1] || '';
  }, [userCountryRaw]);
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  );
  const userTimeZone = useMemo(() => {
    if (!userCountryRaw) return browserTimeZone;
    return resolveTimezoneFromCountry(userCountryRaw) || browserTimeZone;
  }, [browserTimeZone, userCountryRaw]);
  const effectiveWeatherLocation = useMemo(() => {
    if (dashboardClockWeatherSettings.weatherLocationMode === 'CUSTOM_LOCATION') {
      const custom = dashboardClockWeatherSettings.customWeatherLocation.trim();
      if (custom) return custom;
    }
    const byCountryCode = COUNTRY_WEATHER_QUERY_MAP[userCountryCode];
    if (byCountryCode) return byCountryCode;
    if (userCountryRaw) return userCountryRaw;
    const fromTimezone = weatherLocationFromTimezone(userTimeZone);
    if (fromTimezone) return fromTimezone;
    return 'London';
  }, [
    dashboardClockWeatherSettings.customWeatherLocation,
    dashboardClockWeatherSettings.weatherLocationMode,
    userCountryCode,
    userCountryRaw,
    userTimeZone,
  ]);
  const timePrimaryLabel = useMemo(() => {
    if (!dashboardClockWeatherSettings.showClock) return '';
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: dashboardClockWeatherSettings.showSeconds ? '2-digit' : undefined,
      hour12: dashboardClockWeatherSettings.showAmPm,
      timeZone: userTimeZone,
    });
    return formatter.format(clockNow);
  }, [clockNow, dashboardClockWeatherSettings.showAmPm, dashboardClockWeatherSettings.showClock, dashboardClockWeatherSettings.showSeconds, userTimeZone]);
  const gmtLabel = useMemo(() => {
    if (!dashboardClockWeatherSettings.showClock || !dashboardClockWeatherSettings.showGmt) return '';
    return getGmtOffsetLabel(clockNow, userTimeZone);
  }, [clockNow, dashboardClockWeatherSettings.showClock, dashboardClockWeatherSettings.showGmt, userTimeZone]);
  const dashboardDateLabel = useMemo(() => {
    if (!dashboardClockWeatherSettings.showDate) return '';
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: userTimeZone,
    }).format(clockNow);
  }, [clockNow, dashboardClockWeatherSettings.showDate, userTimeZone]);
  const legacySubmenu = [
    { label: 'Legacy Homepage Manager', href: '/admin/homepage', icon: ChevronRight },
    { label: 'Frontpage Visibility', href: '/admin/homepage-visibility', icon: ChevronRight },
  ];
  const jenksSubmenu = [
    { label: 'FrontPage', href: '/admin/jenks-homepage', icon: ChevronRight },
    { label: 'Legacy Sections', href: '/admin/homepage-sections', icon: ChevronRight },
  ];
  const jenksV2Submenu = [
    { label: 'Top Navigations', href: '/admin/jenks-v2-frontpage-manager/top-navigations', icon: ChevronRight },
    { label: 'Shop By', href: '/admin/jenks-v2-frontpage-manager/shop-by', icon: ChevronRight },
    { label: 'Category Manage', href: '/admin/jenks-v2-frontpage-manager/category-manage', icon: ChevronRight },
    { label: 'Text & Icon Cards', href: '/admin/jenks-v2-frontpage-manager/text-icon-cards', icon: ChevronRight },
    { label: 'Featured', href: '/admin/jenks-v2-frontpage-manager/featured', icon: ChevronRight },
    { label: 'Fresh Drops', href: '/admin/jenks-v2-frontpage-manager/fresh-drops', icon: ChevronRight },
    { label: 'Designer Spotlight', href: '/admin/jenks-v2-frontpage-manager/designer-spotlight', icon: ChevronRight },
    { label: 'Heritage', href: '/admin/jenks-v2-frontpage-manager/heritage', icon: ChevronRight },
    { label: 'Newsletter and Footer', href: '/admin/jenks-v2-frontpage-manager/newsletter-footer', icon: ChevronRight },
    { label: 'Section Visibility', href: '/admin/jenks-v2-frontpage-manager/section-visibility', icon: ChevronRight },
  ];
  const orderManagementSubmenu = [
    { label: 'Order List', href: '/admin/orders?tab=list', icon: ChevronRight },
    { label: 'Processing Workflow', href: '/admin/orders?tab=processing-workflow', icon: ChevronRight },
  ];
  const ticketManagementSubmenu = [
    { label: 'Ticket List', href: '/admin/tickets', icon: ChevronRight },
    { label: 'Ticket Queue', href: '/admin/orders?tab=ticket-queue', icon: ChevronRight },
    { label: 'Ticket Workflow', href: '/admin/orders?tab=ticketing-workflow', icon: ChevronRight },
  ];
  const adminAccountsSubmenu = [
    { label: 'Administrator', href: '/admin/administrators', icon: ChevronRight },
    { label: 'Role Management', href: '/admin/roles', icon: ChevronRight },
    { label: 'Authenticator Security', href: '/admin/authenticator-security', icon: ChevronRight },
    { label: 'Backup Center', href: '/admin/backups', icon: Database },
  ];
  const customerAccountsSubmenu = [
    { label: 'Customer List', href: '/admin/customer-accounts', icon: ChevronRight },
    { label: 'Newsletter Subscribers', href: '/admin/customer-accounts/newsletter-subscribers', icon: ChevronRight },
  ];
  const canRenderAdminAccountsSubItem = (href: string) => {
    if (href === '/admin/backups') return true;
    return canAccessAdminNav(href);
  };
  const paymentSubmenu = [
    { label: 'Payment API', href: '/admin/payments', icon: ChevronRight },
    { label: 'Seller Earnings', href: '/admin/vendor-payments?tab=seller-earnings', icon: ChevronRight },
    { label: 'Designer Earnings', href: '/admin/vendor-payments?tab=designer-earnings', icon: ChevronRight },
    { label: 'Vendor Payment Config', href: '/admin/vendor-payments?tab=vendor-config', icon: ChevronRight },
    { label: 'Withdrawal Pay Integration', href: '/admin/vendor-payments?tab=withdrawal-integrations', icon: ChevronRight },
  ];
  const productManagementSubmenu = [
    { label: 'Product', href: '/admin/products', icon: ChevronRight },
    { label: 'Stock Level Analysis', href: '/admin/products/stock-list', icon: ChevronRight },
    { label: 'Product Price Compare', href: '/admin/products/price-compare', icon: ChevronRight },
    { label: 'Failed AI Approval', href: '/admin/products/failed-ai-approvals', icon: ChevronRight },
    { label: 'Product Configuration', href: '/admin/products/configuration', icon: ChevronRight },
    { label: 'Product Labels', href: '/admin/product-labels', icon: ChevronRight },
    { label: 'Product Change Request', href: '/admin/product-change-requests', icon: ChevronRight },
  ];
  const automationSubmenu = [
    { label: 'Automation System Switchboard', href: '/admin/automation/system', icon: ChevronRight },
    { label: 'Automation Outcomes', href: '/admin/automation/approvals', icon: ChevronRight },
    { label: 'AI API Integrations', href: '/admin/automation/ai-integrations', icon: ChevronRight },
  ];
  const referralSubmenu = [
    { label: 'Program Settings', href: '/admin/resellers', icon: ChevronRight },
    { label: 'Referral List', href: '/admin/referrals/list', icon: ChevronRight },
    { label: 'Referral Materials', href: '/admin/referrals/materials', icon: ChevronRight },
  ];
  const enterpriseSubmenu =
    userType === 'seller'
      ? [
          { label: 'Enterprise Workspace', href: '/seller/enterprise', icon: ChevronRight },
          ...(enterpriseRoleManagementAllowed
            ? [{ label: 'Sub-account Role Management', href: '/seller/enterprise/role-management', icon: ChevronRight }]
            : []),
        ]
      : userType === 'designer'
        ? [
            { label: 'Enterprise Workspace', href: '/designer/enterprise', icon: ChevronRight },
            ...(enterpriseRoleManagementAllowed
              ? [{ label: 'Sub-account Role Management', href: '/designer/enterprise/role-management', icon: ChevronRight }]
              : []),
          ]
        : [];
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [isDashboardSearchOpen, setIsDashboardSearchOpen] = useState(false);
  const [highlightedSearchResultIndex, setHighlightedSearchResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (userType !== 'seller' && userType !== 'designer') {
      setEnterpriseRoleManagementAllowed(false);
      return;
    }
    if (!token || !user?.id) {
      setEnterpriseRoleManagementAllowed(false);
      return;
    }
    let cancelled = false;
    const resolveEnterpriseStatus = async () => {
      try {
        const fallbackApiUrl =
          typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api';
        const apiBase = String(import.meta.env.VITE_API_URL || fallbackApiUrl).replace(/\/+$/, '');
        const response = await fetch(`${apiBase}/enterprise/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          if (!cancelled) setEnterpriseRoleManagementAllowed(false);
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setEnterpriseRoleManagementAllowed(Boolean(payload?.data?.account?.isEnterprise));
        }
      } catch {
        if (!cancelled) setEnterpriseRoleManagementAllowed(false);
      }
    };
    void resolveEnterpriseStatus();
    return () => {
      cancelled = true;
    };
  }, [userType, user?.id, token]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setModuleAccessMap(null);
      return;
    }
    let cancelled = false;
    const loadModuleAccess = async () => {
      try {
        const response = await api.moduleRuntime.getDecisions({
          keys: ['ticketing', 'chat', 'communications', 'help_center'],
        });
        if (!cancelled) {
          setModuleAccessMap(response?.data?.map || {});
        }
      } catch {
        if (!cancelled) {
          setModuleAccessMap(null);
        }
      }
    };
    void loadModuleAccess();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const loadClockWeatherSettings = async () => {
      try {
        const response = await api.homepageSections.getDashboardClockWeatherSettings();
        if (!cancelled && response?.success && response?.data) {
          setDashboardClockWeatherSettings(normalizeDashboardClockWeatherSettings(response.data));
        }
      } catch {
        if (!cancelled) {
          setDashboardClockWeatherSettings({ ...DASHBOARD_CLOCK_WEATHER_DEFAULTS });
        }
      }
    };
    void loadClockWeatherSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const toFahrenheit = (value: number) => (value * 9) / 5 + 32;
  const weatherLocationLabel = useMemo(
    () => (dashboardClockWeatherSettings.weatherLocationMode === 'CUSTOM_LOCATION'
      ? dashboardClockWeatherSettings.customWeatherLocation.trim() || effectiveWeatherLocation
      : effectiveWeatherLocation),
    [
      dashboardClockWeatherSettings.customWeatherLocation,
      dashboardClockWeatherSettings.weatherLocationMode,
      effectiveWeatherLocation,
    ]
  );
  const buildGeocodingUrl = (name: string) =>
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const buildWeatherUrl = (latitude: number, longitude: number) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`;

  const refreshWeather = async () => {
    if (!dashboardClockWeatherSettings.showWeather) {
      setWeatherNow(null);
      setWeatherError('');
      return;
    }
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const locationToQuery = weatherLocationLabel || weatherLocationFromTimezone(userTimeZone) || 'London';
      const geoResponse = await fetch(buildGeocodingUrl(locationToQuery));
      const geoPayload = await geoResponse.json().catch(() => null);
      const geoResult = Array.isArray(geoPayload?.results) ? geoPayload.results[0] : null;
      if (!geoResult || !Number.isFinite(Number(geoResult.latitude)) || !Number.isFinite(Number(geoResult.longitude))) {
        throw new Error('Location not found');
      }
      const latitude = Number(geoResult.latitude);
      const longitude = Number(geoResult.longitude);
      const weatherResponse = await fetch(buildWeatherUrl(latitude, longitude));
      const weatherPayload = await weatherResponse.json().catch(() => null);
      const current = weatherPayload?.current;
      if (!current || !Number.isFinite(Number(current.temperature_2m))) {
        throw new Error('Weather unavailable');
      }
      const temperatureC = Number(current.temperature_2m);
      const convertedTemperature =
        dashboardClockWeatherSettings.weatherUnit === 'F' ? toFahrenheit(temperatureC) : temperatureC;
      const weatherCode = Number(current.weather_code);
      const weatherLabel = WEATHER_CODE_LABELS[weatherCode] || 'Weather update';
      setWeatherNow({
        temperature: Number(convertedTemperature.toFixed(1)),
        weatherLabel,
        locationLabel: `${String(geoResult.name || locationToQuery)}${geoResult.country ? `, ${String(geoResult.country)}` : ''}`,
      });
      setWeatherError('');
    } catch {
      setWeatherNow(null);
      setWeatherError('Weather unavailable');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    void refreshWeather();
    const interval = setInterval(() => {
      void refreshWeather();
    }, Math.max(60, dashboardClockWeatherSettings.weatherRefreshSeconds) * 1000);
    return () => clearInterval(interval);
  }, [
    dashboardClockWeatherSettings.showWeather,
    dashboardClockWeatherSettings.weatherRefreshSeconds,
    dashboardClockWeatherSettings.weatherUnit,
    userTimeZone,
    weatherLocationLabel,
  ]);

  const dashboardTimeLabel = timePrimaryLabel;

  const normalizeSearchToken = (value: string) => String(value || '').trim().toLowerCase();
  const addSearchEntries = (
    target: DashboardSearchEntry[],
    rows: Array<{ label: string; href: string; keywords?: string[] }>,
    options?: { prefix?: string }
  ) => {
    const prefix = options?.prefix ? `${options.prefix} ` : '';
    for (const row of rows) {
      target.push({
        label: `${prefix}${row.label}`.trim(),
        href: row.href,
        keywords: Array.isArray(row.keywords) ? row.keywords : [],
      });
    }
  };
  const dashboardSearchEntries = useMemo(() => {
    const entries: DashboardSearchEntry[] = [];
    addSearchEntries(entries, visibleItems.map((item) => ({ label: item.label, href: item.href })));

    if (userType === 'admin') {
      addSearchEntries(
        entries,
        adminAccountsSubmenu
          .filter((item) => canRenderAdminAccountsSubItem(item.href))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['admin account', 'administrator'] })),
        { prefix: 'Administrator Accounts' }
      );
      addSearchEntries(
        entries,
        paymentSubmenu
          .filter((item) => canAccessAdminNav(item.href.split('?')[0]))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['payment', 'earnings', 'withdrawal'] })),
        { prefix: 'Payment' }
      );
      addSearchEntries(
        entries,
        orderManagementSubmenu
          .filter((item) => canAccessAdminNav(item.href.split('?')[0]))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['order', 'processing', 'workflow', 'delivery'] })),
        { prefix: 'Order Management' }
      );
      addSearchEntries(
        entries,
        ticketManagementSubmenu
          .filter((item) => canAccessAdminNav(item.href.split('?')[0]) && canAccessModuleNav('/admin/ticket-management'))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['ticket', 'queue', 'workflow', 'routing'] })),
        { prefix: 'Ticket Management' }
      );
      addSearchEntries(
        entries,
        productManagementSubmenu
          .filter((item) => canAccessAdminNav(item.href.split('?')[0]))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['product', 'catalog', 'labels', 'configuration'] })),
        { prefix: 'Product Management' }
      );
      addSearchEntries(
        entries,
        automationSubmenu
          .filter((item) => canAccessAdminNav(item.href))
          .map((item) => ({ label: item.label, href: item.href, keywords: ['automation', 'ai', 'approval'] })),
        { prefix: 'Automation' }
      );
      addSearchEntries(
        entries,
        referralSubmenu
          .filter((item) => canAccessAdminNav(item.href))
          .map((item) => ({
            label: item.label,
            href: item.href,
            keywords: ['referral', 'influencer', 'commission', 'materials', 'referral list'],
          })),
        { prefix: 'Referral/Influence' }
      );
      if (isSuperAdmin) {
        addSearchEntries(
          entries,
          legacySubmenu
            .filter((item) => canAccessAdminNav(item.href))
            .map((item) => ({
              label: item.label,
              href: item.href,
              keywords: ['legacy', 'homepage', 'frontpage', 'visibility', 'sections'],
            })),
          { prefix: 'Legacy' }
        );
        addSearchEntries(
          entries,
          jenksSubmenu
            .filter((item) => canAccessAdminNav(item.href))
            .map((item) => ({
              label: item.label,
              href: item.href,
              keywords: ['jenks', 'homepage', 'trust badges', 'copy controls', 'experience'],
            })),
          { prefix: 'Jenks FrontPage Manage' }
        );
        addSearchEntries(
          entries,
          jenksV2Submenu
            .filter((item) => canAccessAdminNav(item.href))
            .map((item) => ({
              label: item.label,
              href: item.href,
              keywords: ['jenks v2', 'frontpage', 'manager', 'section visibility', 'hero', 'shop by', 'featured'],
            })),
          { prefix: 'Jenks-V2 FrontPage Manager' }
        );
      }
      addSearchEntries(
        entries,
        [
          {
            label: 'Taxonomy Management',
            href: '/admin/products/configuration',
            keywords: ['product taxonomy', 'style', 'material type', 'category'],
          },
          {
            label: 'Designer Fabric Country Access',
            href: '/admin/products/configuration',
            keywords: ['designer fabric country access', 'country access', 'fabric access'],
          },
          {
            label: 'Designer Country Access Requests',
            href: '/admin/products/configuration',
            keywords: ['country access requests', 'approve designer country'],
          },
        ],
        { prefix: 'Product Configuration' }
      );
    }
    if (userType === 'seller' || userType === 'designer') {
      addSearchEntries(
        entries,
        enterpriseSubmenu.map((item) => ({
          label: item.label,
          href: item.href,
          keywords: ['enterprise', 'sub-account', 'role management'],
        })),
        { prefix: 'Enterprise' }
      );
    }

    const deduped = new Map<string, DashboardSearchEntry>();
    for (const entry of entries) {
      const key = `${entry.label}::${entry.href}`;
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      }
    }
    return Array.from(deduped.values());
  }, [userType, visibleItems, userPermissions, enterpriseRoleManagementAllowed, isSuperAdmin]);

  const dashboardSearchResults = useMemo(() => {
    const query = normalizeSearchToken(dashboardSearchQuery);
    if (!query) return dashboardSearchEntries.slice(0, 10);
    const tokens = query.split(/\s+/).filter(Boolean);
    const scored = dashboardSearchEntries
      .map((entry) => {
        const haystack = normalizeSearchToken(`${entry.label} ${entry.href} ${entry.keywords.join(' ')}`);
        const allMatch = tokens.every((token) => haystack.includes(token));
        if (!allMatch) return null;
        const exactLabel = normalizeSearchToken(entry.label) === query ? 3 : 0;
        const startsWith = normalizeSearchToken(entry.label).startsWith(query) ? 2 : 0;
        const includes = haystack.includes(query) ? 1 : 0;
        return { entry, score: exactLabel + startsWith + includes };
      })
      .filter((row): row is { entry: DashboardSearchEntry; score: number } => Boolean(row))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.entry);
    return scored.slice(0, 10);
  }, [dashboardSearchEntries, dashboardSearchQuery]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setIsDashboardSearchOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedSearchResultIndex(0);
  }, [dashboardSearchQuery, dashboardSearchResults.length]);

  const handleDashboardSearchNavigate = (entry?: DashboardSearchEntry) => {
    if (!entry) return;
    navigate(entry.href);
    setDashboardSearchQuery('');
    setIsDashboardSearchOpen(false);
  };

  const handleDashboardSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsDashboardSearchOpen(true);
      setHighlightedSearchResultIndex((prev) =>
        Math.min(prev + 1, Math.max(0, dashboardSearchResults.length - 1))
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedSearchResultIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === 'Escape') {
      setIsDashboardSearchOpen(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      handleDashboardSearchNavigate(dashboardSearchResults[highlightedSearchResultIndex] || dashboardSearchResults[0]);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStartSupportCall = async () => {
    if (userType === 'admin') return;
    try {
      setSupportCalling(true);
      const response = await api.customerService.startVoipCall({
        contextType: 'DIRECT',
        contextId: `${userType}-dashboard-support`,
      });
      const callLink = String(response?.data?.callLink || '').trim();
      if (callLink) {
        window.open(callLink, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // no-op: avoid interrupting dashboard flow if VoIP is not enabled
    } finally {
      setSupportCalling(false);
    }
  };

  const readHrefMeta = (href: string) => {
    const value = String(href || '').trim();
    const queryIndex = value.indexOf('?');
    const rawPath = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
    const rawQuery = queryIndex >= 0 ? value.slice(queryIndex + 1) : '';
    const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const params = new URLSearchParams(rawQuery);
    return {
      pathname,
      tab: params.get('tab'),
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-navy-600 text-white transition-all duration-300 ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-white/10">
            <Link to="/" className="font-display text-xl font-bold">
              {isSidebarOpen ? 'African Fashion' : 'AF'}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => {
              const currentTab = new URLSearchParams(location.search).get('tab');
              const hrefMeta = readHrefMeta(item.href);
              const isActive =
                location.pathname === hrefMeta.pathname &&
                (hrefMeta.tab ? currentTab === hrefMeta.tab : !currentTab);
              const Icon = item.icon;

              if (userType === 'admin' && item.href === '/admin/homepage' && isSuperAdmin) {
                const legacyMenuActive = LEGACY_HOMEPAGE_PATHS.includes(location.pathname as (typeof LEGACY_HOMEPAGE_PATHS)[number]);
                const visibleLegacySubmenu = legacySubmenu.filter((subItem) => canAccessAdminNav(subItem.href));
                if (visibleLegacySubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsLegacyMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        legacyMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Legacy</span>
                          <span className="ml-auto">
                            {isLegacyMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isLegacyMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleLegacySubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/jenks-homepage' && isSuperAdmin) {
                const jenksMenuActive = JENKS_HOMEPAGE_PATHS.includes(location.pathname as (typeof JENKS_HOMEPAGE_PATHS)[number]);
                const visibleJenksSubmenu = jenksSubmenu.filter((subItem) => canAccessAdminNav(subItem.href));
                if (visibleJenksSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsJenksMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        jenksMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Jenks FrontPage Manage</span>
                          <span className="ml-auto">
                            {isJenksMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isJenksMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleJenksSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/jenks-v2-frontpage-manager' && isSuperAdmin) {
                const jenksV2MenuActive =
                  JENKS_V2_FRONTPAGE_MANAGER_PATHS.includes(
                    location.pathname as (typeof JENKS_V2_FRONTPAGE_MANAGER_PATHS)[number]
                  ) || location.pathname.startsWith('/admin/jenks-v2-frontpage-manager/');
                const visibleJenksV2Submenu = jenksV2Submenu.filter((subItem) => canAccessAdminNav(subItem.href));
                if (visibleJenksV2Submenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsJenksV2MenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        jenksV2MenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Jenks-V2 FrontPage Manager</span>
                          <span className="ml-auto">
                            {isJenksV2MenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isJenksV2MenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleJenksV2Submenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/payments') {
                const paymentMenuActive = location.pathname === '/admin/payments' || location.pathname === '/admin/vendor-payments';
                const visiblePaymentSubmenu = paymentSubmenu.filter((subItem) => canAccessAdminNav(subItem.href.split('?')[0]));
                if (visiblePaymentSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsPaymentMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        paymentMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Payment</span>
                          <span className="ml-auto">
                            {isPaymentMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isPaymentMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visiblePaymentSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/orders') {
                const orderMenuActive =
                  location.pathname === '/admin/orders' &&
                  currentTab !== 'ticket-queue' &&
                  currentTab !== 'ticketing-workflow';
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsOrderMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        orderMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Order Management</span>
                          <span className="ml-auto">
                            {isOrderMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isOrderMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {orderManagementSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/ticket-management') {
                const ticketMenuActive =
                  location.pathname === '/admin/tickets' ||
                  (location.pathname === '/admin/orders' &&
                    (currentTab === 'ticket-queue' || currentTab === 'ticketing-workflow'));
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsTicketManagementMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        ticketMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Ticket Management</span>
                          <span className="ml-auto">
                            {isTicketManagementMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isTicketManagementMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {ticketManagementSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/products') {
                const productMenuActive =
                  location.pathname === '/admin/products' ||
                  location.pathname === '/admin/products/configuration' ||
                  location.pathname === '/admin/products/stock-list' ||
                  location.pathname === '/admin/products/price-compare' ||
                  location.pathname === '/admin/products/failed-ai-approvals' ||
                  location.pathname === '/admin/product-labels' ||
                  location.pathname === '/admin/product-change-requests';
                const visibleProductSubmenu = productManagementSubmenu.filter((subItem) =>
                  canAccessAdminNav(subItem.href)
                );
                if (visibleProductSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsProductManagementMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        productMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Product Management</span>
                          <span className="ml-auto">
                            {isProductManagementMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isProductManagementMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleProductSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/administrator-accounts') {
                const adminAccountsMenuActive =
                  location.pathname === '/admin/administrators' ||
                  location.pathname === '/admin/roles' ||
                  location.pathname === '/admin/authenticator-security' ||
                  location.pathname === '/admin/backups';
                const visibleAdminAccountSubmenu = adminAccountsSubmenu.filter((subItem) =>
                  canRenderAdminAccountsSubItem(subItem.href)
                );
                if (visibleAdminAccountSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsAdminAccountsMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        adminAccountsMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Administrator Accounts</span>
                          <span className="ml-auto">
                            {isAdminAccountsMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isAdminAccountsMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleAdminAccountSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/customer-accounts') {
                const customerAccountsMenuActive =
                  location.pathname === '/admin/customer-accounts' ||
                  location.pathname === '/admin/customer-accounts/newsletter-subscribers';
                const visibleCustomerAccountsSubmenu = customerAccountsSubmenu.filter((subItem) =>
                  canAccessAdminNav(subItem.href)
                );
                if (visibleCustomerAccountsSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsCustomerAccountsMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        customerAccountsMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Customer Accounts</span>
                          <span className="ml-auto">
                            {isCustomerAccountsMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isCustomerAccountsMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleCustomerAccountsSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/automation/system') {
                const automationMenuActive = location.pathname.startsWith('/admin/automation');
                const visibleAutomationSubmenu = automationSubmenu.filter((subItem) => canAccessAdminNav(subItem.href));
                if (visibleAutomationSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsAutomationMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        automationMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Automation</span>
                          <span className="ml-auto">
                            {isAutomationMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isAutomationMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleAutomationSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (userType === 'admin' && item.href === '/admin/resellers') {
                const referralMenuActive =
                  location.pathname === '/admin/resellers' ||
                  location.pathname === '/admin/referrals/list' ||
                  location.pathname === '/admin/referrals/materials';
                const visibleReferralSubmenu = referralSubmenu.filter((subItem) => canAccessAdminNav(subItem.href));
                if (visibleReferralSubmenu.length === 0) {
                  return null;
                }
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsReferralMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        referralMenuActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Referral/Influence</span>
                          <span className="ml-auto">
                            {isReferralMenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isReferralMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {visibleReferralSubmenu.map((subItem) => {
                          const subMeta = readHrefMeta(subItem.href);
                          const subActive =
                            location.pathname === subMeta.pathname &&
                            (subMeta.tab ? currentTab === subMeta.tab : !currentTab);
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (
                (userType === 'seller' && item.href === '/seller/enterprise') ||
                (userType === 'designer' && item.href === '/designer/enterprise')
              ) {
                const enterpriseMenuActive = enterpriseSubmenu.some((subItem) => location.pathname === subItem.href);
                return (
                  <div key={item.href} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setIsEnterpriseMenuOpen((prev) => !prev)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        enterpriseMenuActive
                          ? 'bg-white/10 text-white'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen ? (
                        <>
                          <span className="text-sm font-medium">Enterprise</span>
                          <span className="ml-auto">
                            {isEnterpriseMenuOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </>
                      ) : null}
                    </button>
                    {isEnterpriseMenuOpen && isSidebarOpen ? (
                      <div className="ml-7 space-y-1">
                        {enterpriseSubmenu.map((subItem) => {
                          const subActive = location.pathname === subItem.href;
                          const SubIcon = subItem.icon;
                          return (
                            <Link
                              key={subItem.href}
                              to={subItem.href}
                              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                subActive
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <SubIcon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/10">
            {isSidebarOpen ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {displayName[0] || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-white/50">{roleLabel}</p>
                  </div>
                </div>
                {userType === 'customer' ? (
                  <button
                    onClick={() => void handleStartSupportCall()}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    disabled={supportCalling}
                  >
                    <PhoneCall className="w-4 h-4" />
                    {supportCalling ? 'Calling support...' : 'Call Support'}
                  </button>
                ) : null}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 mx-auto text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="relative bg-white border-b border-gray-200 px-4 py-3 lg:px-8">
          <div className="absolute right-4 top-2 text-right leading-tight lg:right-8">
            {dashboardClockWeatherSettings.showClock ? (
              <span className="block text-base font-bold text-red-600">
                {dashboardTimeLabel}
                {dashboardClockWeatherSettings.showGmt && gmtLabel ? (
                  <span className="ml-2 text-sm font-semibold text-red-500">{gmtLabel}</span>
                ) : null}
              </span>
            ) : null}
            {dashboardClockWeatherSettings.showDate ? (
              <span className="block text-xs font-semibold text-gray-500">
                {dashboardDateLabel}
                {dashboardClockWeatherSettings.showTimeZoneName ? ` (${userTimeZone})` : ''}
              </span>
            ) : null}
            {dashboardClockWeatherSettings.showWeather ? (
              <span className="block text-xs font-semibold text-gray-500">
                {weatherLoading
                  ? 'Weather: updating...'
                  : weatherNow
                    ? `Weather: ${weatherNow.temperature}°${dashboardClockWeatherSettings.weatherUnit} · ${weatherNow.weatherLabel} · ${weatherNow.locationLabel}`
                    : weatherError || 'Weather unavailable'}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pr-36 sm:pr-44 lg:pr-[30rem]">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>

            <div ref={searchContainerRef} className="relative flex-1 max-w-2xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={dashboardSearchQuery}
                onChange={(event) => {
                  setDashboardSearchQuery(event.target.value);
                  setIsDashboardSearchOpen(true);
                }}
                onFocus={() => setIsDashboardSearchOpen(true)}
                onKeyDown={handleDashboardSearchKeyDown}
                placeholder="Search dashboard functions (orders, products, payments, tickets...)"
                className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-800 focus:border-amber-500 focus:outline-none"
              />
              {isDashboardSearchOpen ? (
                <div className="absolute left-0 right-0 top-11 z-20 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="max-h-80 overflow-y-auto py-1">
                    {dashboardSearchResults.length > 0 ? (
                      dashboardSearchResults.map((entry, index) => (
                        <button
                          key={`${entry.label}-${entry.href}-${index}`}
                          type="button"
                          onClick={() => handleDashboardSearchNavigate(entry)}
                          className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm ${
                            index === highlightedSearchResultIndex
                              ? 'bg-amber-50 text-amber-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-medium">{entry.label}</span>
                          <span className="shrink-0 text-xs text-gray-400">{entry.href}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-gray-500">No dashboard functions found.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <Link
              to="/"
              className="shrink-0 text-sm text-gray-600 hover:text-coral-500 transition-colors whitespace-nowrap"
            >
              View Store
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <DashboardErrorBoundary>
            <Outlet />
          </DashboardErrorBoundary>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

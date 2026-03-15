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
  Eye,
  CreditCard,
  Truck,
  Sparkles,
  Star,
  Bell,
  Database,
  Search,
  Mail,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import DashboardErrorBoundary from '../components/DashboardErrorBoundary';

import { 
  User, 
  Ruler,
  Home,
  LayoutTemplate,
  LayoutGrid
} from 'lucide-react';

type UserRole = 'ADMINISTRATOR' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'CUSTOMER';
type DashboardType = 'admin' | 'seller' | 'designer' | 'qa' | 'customer';

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

const navItems: Record<DashboardType, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Customer Accounts', href: '/admin/customer-accounts', icon: Users },
    { label: 'Administrator Accounts', href: '/admin/administrator-accounts', icon: User },
    { label: 'Vendor Profiles', href: '/admin/vendor-profiles', icon: Tag },
    { label: 'Traffic Report', href: '/admin/traffic', icon: Layers },
    { label: 'Measurement Templates', href: '/admin/measurement-templates', icon: Ruler },
    { label: 'Currency Matrix', href: '/admin/currency', icon: DollarSign },
    { label: 'Product Management', href: '/admin/products', icon: Package },
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
    { label: 'Banners', href: '/admin/banners', icon: ImageIcon },
    { label: 'Homepage', href: '/admin/homepage', icon: LayoutTemplate },
    { label: 'Frontpage Visibility', href: '/admin/homepage-visibility', icon: Eye },
    { label: 'Homepage Sections', href: '/admin/homepage-sections', icon: LayoutGrid },
    { label: 'Category Pages', href: '/admin/category-pages', icon: LayoutGrid },
    { label: 'Blogs', href: '/admin/blogs', icon: FileText },
    { label: 'Activity Logs', href: '/admin/activity-logs', icon: ClipboardCheck },
  ],
  seller: [
    { label: 'Dashboard', href: '/seller', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/seller?tab=fabrics', icon: Package },
    { label: '3D TryON', href: '/seller?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/seller?tab=orders', icon: ShoppingBag },
    { label: 'Messages', href: '/seller/messages', icon: Mail },
    { label: 'Payment', href: '/seller/payments', icon: CreditCard },
    { label: 'Enterprise', href: '/seller/enterprise', icon: Users },
    { label: 'Profile', href: '/seller/profile', icon: User },
  ],
  designer: [
    { label: 'Dashboard', href: '/designer', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/designer?tab=designs', icon: Package },
    { label: 'Measurements', href: '/designer/measurements', icon: Ruler },
    { label: '3D TryON', href: '/designer?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/designer?tab=orders', icon: ShoppingBag },
    { label: 'Messages', href: '/designer/messages', icon: Mail },
    { label: 'Payment', href: '/designer/payments', icon: CreditCard },
    { label: 'Enterprise', href: '/designer/enterprise', icon: Users },
    { label: 'Profile', href: '/designer/profile', icon: User },
  ],
  qa: [
    { label: 'Dashboard', href: '/qa', icon: LayoutDashboard },
    { label: 'Orders', href: '/qa?tab=pending', icon: ClipboardCheck },
    { label: 'Messages', href: '/qa/messages', icon: Mail },
  ],
  customer: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: '3D TryON', href: '/dashboard?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/orders', icon: ShoppingBag },
    { label: 'Messages', href: '/dashboard/messages', icon: Mail },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Measurements', href: '/measurements', icon: Ruler },
  ],
};

const roleLabels: Record<DashboardType, string> = {
  admin: 'Administrator',
  seller: 'Fabric Seller',
  designer: 'Fashion Designer',
  qa: 'QA Team',
  customer: 'Customer',
};

interface DashboardLayoutProps {
  userType: DashboardType;
}

export default function DashboardLayout({ userType }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState(true);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(true);
  const [isAdminAccountsMenuOpen, setIsAdminAccountsMenuOpen] = useState(true);
  const [isProductManagementMenuOpen, setIsProductManagementMenuOpen] = useState(true);
  const [isEnterpriseMenuOpen, setIsEnterpriseMenuOpen] = useState(true);
  const [enterpriseRoleManagementAllowed, setEnterpriseRoleManagementAllowed] = useState(false);
  const { user, token, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const items = navItems[userType] || [];
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canAccessAdminNav = (href: string) => {
    if (userType !== 'admin') return true;
    if (!userPermissions || userPermissions.length === 0 || userPermissions.includes('*')) return true;
    const permissionByHref: Record<string, string[]> = {
      '/admin/users': ['users:read'],
      '/admin/customer-accounts': ['users:read'],
      '/admin/administrator-accounts': [],
      '/admin/administrators': ['users:read'],
      '/admin/roles': ['admin:roles:manage', 'users:read'],
      '/admin/vendor-profiles': ['vendor_profiles:read'],
      '/admin/activity-logs': ['session_audit:read'],
      '/admin/session-audit': ['session_audit:read'],
      '/admin/traffic': ['traffic:read'],
      '/admin/measurement-templates': ['measurement_templates:manage'],
      '/admin/currency': ['currency:manage'],
      '/admin/products': ['products:manage'],
      '/admin/products/configuration': ['products:manage'],
      '/admin/product-labels': ['products:manage'],
      '/admin/product-change-requests': ['products:manage'],
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
      '/admin/banners': ['banners:manage'],
      '/admin/homepage': ['homepage:manage'],
      '/admin/homepage-visibility': ['homepage:manage'],
      '/admin/homepage-sections': ['homepage:manage'],
      '/admin/category-pages': ['homepage:manage'],
      '/admin/blogs': ['homepage:manage'],
    };
    const required = permissionByHref[href] || [];
    if (required.length === 0) return true;
    return required.every((permission) => userPermissions.includes(permission));
  };
  const visibleItems = items.filter((item) => canAccessAdminNav(item.href));
  const roleLabel = roleLabels[userType] || 'User';
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const orderManagementSubmenu = [
    { label: 'Order List', href: '/admin/orders?tab=list', icon: ChevronRight },
    { label: 'Ticket Queue', href: '/admin/orders?tab=ticket-queue', icon: ChevronRight },
    { label: 'Ticket Workflow', href: '/admin/orders?tab=ticketing-workflow', icon: ChevronRight },
    { label: 'Processing Workflow', href: '/admin/orders?tab=processing-workflow', icon: ChevronRight },
  ];
  const adminAccountsSubmenu = [
    { label: 'Administrator', href: '/admin/administrators', icon: ChevronRight },
    { label: 'Role Management', href: '/admin/roles', icon: ChevronRight },
    { label: 'Backup Center', href: '/admin/backups', icon: Database },
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
    { label: 'Product Configuration', href: '/admin/products/configuration', icon: ChevronRight },
    { label: 'Product Labels', href: '/admin/product-labels', icon: ChevronRight },
    { label: 'Product Change Request', href: '/admin/product-change-requests', icon: ChevronRight },
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
          .map((item) => ({ label: item.label, href: item.href, keywords: ['order', 'ticket', 'workflow', 'queue'] })),
        { prefix: 'Order Management' }
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
  }, [userType, visibleItems, userPermissions, enterpriseRoleManagementAllowed]);

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
                const orderMenuActive = location.pathname === '/admin/orders';
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

              if (userType === 'admin' && item.href === '/admin/products') {
                const productMenuActive =
                  location.pathname === '/admin/products' ||
                  location.pathname === '/admin/products/configuration' ||
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-3 px-4 lg:px-8">
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
                          index === highlightedSearchResultIndex ? 'bg-amber-50 text-amber-900' : 'text-gray-700 hover:bg-gray-50'
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

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-coral-500 transition-colors whitespace-nowrap"
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

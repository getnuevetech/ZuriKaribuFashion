import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Scissors,
  Shirt,
  ClipboardCheck,
  Tag,
  Layers,
  DollarSign,
  Image as ImageIcon,
  Copy,
  Check,
  BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getVendorStorePathForRole } from '../auth/rbac';

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

const navItems: Record<DashboardType, NavItem[]> = {
  admin: [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Role Management', href: '/admin/roles', icon: Settings },
    { label: 'Vendor Profiles', href: '/admin/vendor-profiles', icon: BadgeCheck },
    { label: 'Session Audit', href: '/admin/session-audit', icon: Shield },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Pricing Rules', href: '/admin/pricing', icon: DollarSign },
    { label: 'Currency Matrix', href: '/admin/currency', icon: Tag },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
    { label: 'Traffic Reports', href: '/admin/traffic', icon: Tag },
    { label: 'Banners', href: '/admin/banners', icon: ImageIcon },
    { label: 'Homepage', href: '/admin/homepage', icon: LayoutTemplate },
    { label: 'Homepage Sections', href: '/admin/homepage-sections', icon: LayoutGrid },
    { label: 'Measurement Templates', href: '/admin/measurement-templates', icon: Ruler },
  ],
  seller: [
    { label: 'Dashboard', href: '/seller', icon: LayoutDashboard },
    { label: 'Complete Profile', href: '/seller/profile-setup', icon: BadgeCheck },
    { label: 'My Fabrics', href: '/seller/fabrics', icon: Layers },
    { label: 'Orders', href: '/seller/orders', icon: ShoppingBag },
  ],
  designer: [
    { label: 'Dashboard', href: '/designer', icon: LayoutDashboard },
    { label: 'Complete Profile', href: '/designer/profile-setup', icon: BadgeCheck },
    { label: 'My Designs', href: '/designer/designs', icon: Scissors },
    { label: 'Orders', href: '/designer/orders', icon: ShoppingBag },
  ],
  qa: [
    { label: 'Dashboard', href: '/qa', icon: LayoutDashboard },
    { label: 'Orders', href: '/qa/orders', icon: ClipboardCheck },
  ],
  customer: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Orders', href: '/orders', icon: ShoppingBag },
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
  const [copiedStorefront, setCopiedStorefront] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const items = navItems[userType] || [];
  const userPermissions = Array.isArray((user as any)?.permissions) ? ((user as any).permissions as string[]) : [];
  const canAccessAdminNav = (href: string) => {
    if (userType !== 'admin') return true;
    if (!userPermissions || userPermissions.length === 0 || userPermissions.includes('*')) return true;
    const permissionByHref: Record<string, string[]> = {
      '/admin': ['admin:dashboard:read'],
      '/admin/users': ['users:read'],
      '/admin/roles': ['admin:roles:manage', 'users:read'],
      '/admin/vendor-profiles': ['vendor_profiles:read'],
      '/admin/session-audit': ['session_audit:read'],
      '/admin/products': ['products:manage'],
      '/admin/pricing': ['pricing:manage'],
      '/admin/currency': ['currency:manage'],
      '/admin/orders': ['orders:manage'],
      '/admin/traffic': ['traffic:read'],
      '/admin/banners': ['banners:manage'],
      '/admin/homepage': ['homepage:manage'],
      '/admin/homepage-sections': ['homepage:manage'],
      '/admin/measurement-templates': ['measurement_templates:manage'],
    };
    const required = permissionByHref[href] || [];
    if (required.length === 0) return true;
    return required.every((permission) => userPermissions.includes(permission));
  };
  const visibleItems = items.filter((item) => canAccessAdminNav(item.href));
  const roleLabel = roleLabels[userType] || 'User';
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const vendorStoreHref = getVendorStorePathForRole(user?.role, user?.id);
  const storefrontUrl =
    vendorStoreHref && typeof window !== 'undefined'
      ? `${window.location.origin}${vendorStoreHref}`
      : vendorStoreHref || '';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCopyStorefront = async () => {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopiedStorefront(true);
      window.setTimeout(() => setCopiedStorefront(false), 1800);
    } catch {
      window.prompt('Copy storefront URL:', storefrontUrl);
    }
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
              {isSidebarOpen ? 'ZuriKaribu' : 'ZK'}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => {
              const isActive =
                location.pathname === item.href ||
                location.pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

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
                    {vendorStoreHref ? (
                      <Link to={vendorStoreHref} className="text-sm font-medium truncate hover:text-coral-200 transition-colors">
                        {displayName}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium truncate">{displayName}</p>
                    )}
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-4">
            {vendorStoreHref ? (
              <>
                <div className="hidden lg:block text-right">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Storefront URL</p>
                  <Link to={vendorStoreHref} className="text-sm text-gray-600 hover:text-coral-500 transition-colors">
                    {storefrontUrl}
                  </Link>
                </div>
                <button
                  onClick={handleCopyStorefront}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  {copiedStorefront ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedStorefront ? 'Copied' : 'Copy URL'}
                </button>
                <Link
                  to={vendorStoreHref}
                  className="text-sm text-gray-600 hover:text-coral-500 transition-colors"
                >
                  View Store
                </Link>
              </>
            ) : null}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
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

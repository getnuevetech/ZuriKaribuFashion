import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

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
    { label: 'Customer Accounts', href: '/admin/customer-accounts', icon: Users },
    { label: 'Administrator Accounts', href: '/admin/administrator-accounts', icon: User },
    { label: 'Vendor Profiles', href: '/admin/vendor-profiles', icon: Tag },
    { label: 'Session Audit', href: '/admin/session-audit', icon: ClipboardCheck },
    { label: 'Traffic Report', href: '/admin/traffic', icon: Layers },
    { label: 'Measurement Templates', href: '/admin/measurement-templates', icon: Ruler },
    { label: 'Currency Matrix', href: '/admin/currency', icon: DollarSign },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Product Labels', href: '/admin/product-labels', icon: Tag },
    { label: 'Pricing Rules', href: '/admin/pricing', icon: DollarSign },
    { label: 'Promo Codes', href: '/admin/promo-codes', icon: CreditCard },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard },
    { label: 'Shipping', href: '/admin/shipping', icon: Truck },
    { label: '3D TryON', href: '/admin/try-on', icon: Sparkles },
    { label: 'Featured Requests', href: '/admin/featured-requests', icon: Star },
    { label: 'Partner API', href: '/admin/partners', icon: Settings },
    { label: 'API Diagnostics', href: '/admin/api-diagnostics', icon: Settings },
    { label: 'Order Management', href: '/admin/orders', icon: ShoppingBag },
    { label: 'Banners', href: '/admin/banners', icon: ImageIcon },
    { label: 'Homepage', href: '/admin/homepage', icon: LayoutTemplate },
    { label: 'Frontpage Visibility', href: '/admin/homepage-visibility', icon: Eye },
    { label: 'Homepage Sections', href: '/admin/homepage-sections', icon: LayoutGrid },
    { label: 'Category Pages', href: '/admin/category-pages', icon: LayoutGrid },
    { label: 'Blogs', href: '/admin/blogs', icon: FileText },
  ],
  seller: [
    { label: 'Dashboard', href: '/seller', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/seller?tab=fabrics', icon: Package },
    { label: '3D TryON', href: '/seller?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/seller?tab=orders', icon: ShoppingBag },
    { label: 'Payment', href: '/seller/payments', icon: CreditCard },
  ],
  designer: [
    { label: 'Dashboard', href: '/designer', icon: LayoutDashboard },
    { label: 'Product Lists', href: '/designer?tab=designs', icon: Package },
    { label: '3D TryON', href: '/designer?tab=tryon', icon: Sparkles },
    { label: 'Orders', href: '/designer?tab=orders', icon: ShoppingBag },
    { label: 'Payment', href: '/designer/payments', icon: CreditCard },
  ],
  qa: [
    { label: 'Dashboard', href: '/qa', icon: LayoutDashboard },
    { label: 'Orders', href: '/qa?tab=pending', icon: ClipboardCheck },
  ],
  customer: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: '3D TryON', href: '/dashboard?tab=tryon', icon: Sparkles },
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
  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState(true);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(true);
  const [isAdminAccountsMenuOpen, setIsAdminAccountsMenuOpen] = useState(true);
  const { user, logout } = useAuthStore();
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
      '/admin/administrator-accounts': ['users:read'],
      '/admin/administrators': ['users:read'],
      '/admin/roles': ['admin:roles:manage', 'users:read'],
      '/admin/vendor-profiles': ['vendor_profiles:read'],
      '/admin/session-audit': ['session_audit:read'],
      '/admin/traffic': ['traffic:read'],
      '/admin/measurement-templates': ['measurement_templates:manage'],
      '/admin/currency': ['currency:manage'],
      '/admin/products': ['products:manage'],
      '/admin/product-labels': ['products:manage'],
      '/admin/pricing': ['pricing:manage'],
      '/admin/promo-codes': ['pricing:manage'],
      '/admin/payments': ['payments:manage'],
      '/admin/vendor-payments': ['payments:manage'],
      '/admin/shipping': ['shipping:manage'],
      '/admin/try-on': ['products:manage'],
      '/admin/featured-requests': ['products:manage'],
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
  ];
  const paymentSubmenu = [
    { label: 'Payment API', href: '/admin/payments', icon: ChevronRight },
    { label: 'Seller Earnings', href: '/admin/vendor-payments?tab=seller-earnings', icon: ChevronRight },
    { label: 'Designer Earnings', href: '/admin/vendor-payments?tab=designer-earnings', icon: ChevronRight },
    { label: 'Vendor Payment Config', href: '/admin/vendor-payments?tab=vendor-config', icon: ChevronRight },
    { label: 'Withdrawal Pay Integration', href: '/admin/vendor-payments?tab=withdrawal-integrations', icon: ChevronRight },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
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
              const hrefUrl = new URL(item.href, window.location.origin);
              const currentTab = new URLSearchParams(location.search).get('tab');
              const hrefTab = hrefUrl.searchParams.get('tab');
              const isActive =
                location.pathname === hrefUrl.pathname &&
                (hrefTab ? currentTab === hrefTab : !currentTab);
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
                          const subUrl = new URL(subItem.href, window.location.origin);
                          const subTab = subUrl.searchParams.get('tab');
                          const subActive =
                            location.pathname === subUrl.pathname &&
                            (subTab ? currentTab === subTab : !currentTab);
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
                          const subUrl = new URL(subItem.href, window.location.origin);
                          const subTab = subUrl.searchParams.get('tab');
                          const subActive =
                            location.pathname === subUrl.pathname &&
                            (subTab ? currentTab === subTab : !currentTab);
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
                  location.pathname === '/admin/administrators' || location.pathname === '/admin/roles';
                const visibleAdminAccountSubmenu = adminAccountsSubmenu.filter((subItem) =>
                  canAccessAdminNav(subItem.href)
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
                          const subUrl = new URL(subItem.href, window.location.origin);
                          const subTab = subUrl.searchParams.get('tab');
                          const subActive =
                            location.pathname === subUrl.pathname &&
                            (subTab ? currentTab === subTab : !currentTab);
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-coral-500 transition-colors"
            >
              View Store
            </Link>
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

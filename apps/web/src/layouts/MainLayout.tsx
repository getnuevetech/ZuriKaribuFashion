import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { api } from '../services/api';
import Footer from '../components/Footer';
import { getHomeRouteForRole, normalizeRole } from '../auth/rbac';

const USE_DYNAMIC_HOMEPAGE = import.meta.env.VITE_HOMEPAGE_MODE === 'dynamic';

export default function MainLayout() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout, user } = useAuthStore();
  const { getItemCount } = useCartStore();
  const navigate = useNavigate();
  const { data: footerContent } = useQuery({
    queryKey: ['homepageFooterForHeader'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getFooter();
      return response.success ? response.data : null;
    },
  });
  const brandName = footerContent?.companyName?.trim() || 'ZURIKARIBU';
  const userRole = normalizeRole(user?.role);
  const dashboardRoute = getHomeRouteForRole(user?.role);
  const profileRoute = userRole === 'CUSTOMER' ? '/profile' : dashboardRoute;
  const ordersRoute = userRole === 'CUSTOMER' ? '/orders' : dashboardRoute;
  const profileLabel = userRole === 'CUSTOMER' ? 'My Profile' : 'Dashboard';
  const ordersLabel = userRole === 'CUSTOMER' ? 'My Orders' : 'Go to Dashboard';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { label: 'Home', href: '#' },
    { label: 'Shop', href: '#shop' },
    { label: 'Designers', href: '#designers' },
    { label: 'About', href: '#about' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-black text-white py-2 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-8 text-xs tracking-wider">
              <span>Free shipping on orders over $250</span>
              <span>•</span>
              <span>New arrivals weekly</span>
              <span>•</span>
              <span>Authentic African designs</span>
              <span>•</span>
            </div>
          ))}
        </div>
      </div>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'glass shadow-lg py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="font-['Oswald'] text-xl sm:text-2xl font-semibold tracking-wide">
                {brandName.toUpperCase()}
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium link-underline"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 lg:gap-4">
              <div className="hidden md:block">
                <select className="w-20 h-8 text-xs border-none bg-transparent">
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>NGN</option>
                  <option>GHS</option>
                </select>
              </div>
              <Link
                to="/cart"
                className="relative p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                  {getItemCount()}
                </span>
              </Link>

              {isAuthenticated ? (
                <div className="relative group">
                  <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
                    <User className="w-5 h-5" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="py-2">
                      <Link
                        to={profileRoute}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {profileLabel}
                      </Link>
                      <Link
                        to={ordersRoute}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {ordersLabel}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden sm:flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity"
                >
                  Sign In
                </Link>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 border-t border-black/10 pt-4 animate-fade-in">
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                {!isAuthenticated && (
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-lg font-medium flex items-center gap-2"
                  >
                    <User className="w-5 h-5" /> Sign In
                  </Link>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public Pages
import Home from './pages/Home';
import Designs from './pages/Designs';
import DesignDetail from './pages/DesignDetail';
import Fabrics from './pages/Fabrics';
import FabricDetail from './pages/FabricDetail';
import ReadyToWear from './pages/ReadyToWear';
import ReadyToWearDetail from './pages/ReadyToWearDetail';
import TryOn from './pages/TryOn';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import VendorStore from './pages/VendorStore';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import StaticPage from './pages/StaticPage';
import StoryDetail from './pages/StoryDetail';

// Customer Pages
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerOrders from './pages/customer/Orders';
import CustomerProfile from './pages/customer/Profile';
import CustomerMeasurements from './pages/customer/Measurements';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminProducts from './pages/admin/Products';
import AdminOrders from './pages/admin/Orders';
import AdminPricingRules from './pages/admin/PricingRules';
import AdminBanners from './pages/admin/Banners';
import AdminHomepage from './pages/admin/Homepage';
import AdminHomepageSections from './pages/admin/HomepageSections';
import AdminTraffic from './pages/admin/Traffic';
import AdminMeasurementTemplates from './pages/admin/MeasurementTemplates';
import AdminCurrencyMatrix from './pages/admin/CurrencyMatrix';
import AdminSessionAudit from './pages/admin/SessionAudit';
import AdminVendorProfiles from './pages/admin/VendorProfiles';
import AdminRoleManagement from './pages/admin/RoleManagement';

// Seller Pages
import SellerDashboard from './pages/seller/Dashboard';

// Designer Pages
import DesignerDashboard from './pages/designer/Dashboard';
import VendorProfileSetup from './pages/vendor/ProfileSetup';

// QA Pages
import QADashboard from './pages/qa/Dashboard';

// Auth
import ProtectedRoute from './components/ProtectedRoute';
import AdminPermissionGuard from './components/AdminPermissionGuard';
import { useAuthStore } from './store/authStore';
import { getHomeRouteForRole } from './auth/rbac';
import { ToastProvider } from './components/ui/ToastProvider';
import { CurrencyProvider } from './components/ui/CurrencyProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_placeholder');

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Elements stripe={stripePromise}>
        <ToastProvider>
          <CurrencyProvider>
            <Router>
              <Routes>
            {/* Public Routes */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/custom-to-wear" element={<Designs />} />
              <Route path="/custom-to-wear/:id" element={<DesignDetail />} />
              <Route path="/fabrics-to-sell" element={<Fabrics />} />
              <Route path="/fabrics-to-sell/:id" element={<FabricDetail />} />
              <Route path="/designs" element={<Designs />} />
              <Route path="/designs/:id" element={<DesignDetail />} />
              <Route path="/fabrics" element={<Fabrics />} />
              <Route path="/fabrics/:id" element={<FabricDetail />} />
              <Route path="/ready-to-wear" element={<ReadyToWear />} />
              <Route path="/ready-to-wear/:id" element={<ReadyToWearDetail />} />
              <Route path="/stories/:slug" element={<StoryDetail />} />
              <Route path="/designers" element={<Navigate to="/custom-to-wear" replace />} />
              <Route
                path="/about"
                element={
                  <StaticPage
                    title="About ZuriKaribu"
                    description="ZuriKaribu connects talented designers and fabric sellers with global customers. We curate authentic pieces, celebrate craftsmanship, and make African style accessible worldwide."
                    primaryCtaLabel="Explore Collections"
                    primaryCtaHref="/ready-to-wear"
                    secondaryCtaLabel="Meet Designers"
                    secondaryCtaHref="/custom-to-wear"
                  />
                }
              />
              <Route
                path="/contact"
                element={
                  <StaticPage
                    title="Contact Us"
                    description="Need support with an order, vendor onboarding, or partnerships? Reach our team at hello@zurikaribu.com and we will get back to you as soon as possible."
                    primaryCtaLabel="Browse Shop"
                    primaryCtaHref="/ready-to-wear"
                    secondaryCtaLabel="Read FAQs"
                    secondaryCtaHref="/faqs"
                  />
                }
              />
              <Route
                path="/sustainability"
                element={
                  <StaticPage
                    title="Sustainability"
                    description="We prioritize durable products, responsible sourcing, and mindful production. Our mission is to celebrate fashion while reducing waste and supporting long-term local value creation."
                    primaryCtaLabel="Shop Fabrics"
                    primaryCtaHref="/fabrics-to-sell"
                    secondaryCtaLabel="About Us"
                    secondaryCtaHref="/about"
                  />
                }
              />
              <Route
                path="/careers"
                element={
                  <StaticPage
                    title="Careers"
                    description="We are building the future of African fashion commerce. Follow our hiring updates and opportunities for product, operations, and creative roles."
                    primaryCtaLabel="Explore Platform"
                    primaryCtaHref="/"
                    secondaryCtaLabel="Contact Us"
                    secondaryCtaHref="/contact"
                  />
                }
              />
              <Route
                path="/faqs"
                element={
                  <StaticPage
                    title="Frequently Asked Questions"
                    description="Find quick answers about payments, shipping timelines, returns, sizing, and vendor policies. For anything else, our support team is ready to assist."
                    primaryCtaLabel="View Shipping"
                    primaryCtaHref="/shipping"
                    secondaryCtaLabel="Contact Us"
                    secondaryCtaHref="/contact"
                  />
                }
              />
              <Route
                path="/shipping"
                element={
                  <StaticPage
                    title="Shipping Information"
                    description="Shipping time and cost depend on destination, product type, and vendor location. You will always see the latest delivery estimate at checkout before payment."
                    primaryCtaLabel="Start Shopping"
                    primaryCtaHref="/ready-to-wear"
                    secondaryCtaLabel="Returns Policy"
                    secondaryCtaHref="/returns"
                  />
                }
              />
              <Route
                path="/returns"
                element={
                  <StaticPage
                    title="Returns & Exchanges"
                    description="Eligible returns and exchanges are accepted within policy windows based on item condition and order type. Contact support with your order details for guided help."
                    primaryCtaLabel="Contact Support"
                    primaryCtaHref="/contact"
                    secondaryCtaLabel="Browse Shop"
                    secondaryCtaHref="/ready-to-wear"
                  />
                }
              />
              <Route
                path="/privacy"
                element={
                  <StaticPage
                    title="Privacy Policy"
                    description="We are committed to protecting your personal data and handling it responsibly. This page explains what data we collect, why we collect it, and how you can control it."
                    primaryCtaLabel="Terms of Service"
                    primaryCtaHref="/terms"
                    secondaryCtaLabel="Contact Us"
                    secondaryCtaHref="/contact"
                  />
                }
              />
              <Route
                path="/terms"
                element={
                  <StaticPage
                    title="Terms of Service"
                    description="These terms describe platform usage rules, order processing expectations, and account responsibilities for customers, vendors, and partners."
                    primaryCtaLabel="Privacy Policy"
                    primaryCtaHref="/privacy"
                    secondaryCtaLabel="Start Shopping"
                    secondaryCtaHref="/ready-to-wear"
                  />
                }
              />
              <Route path="/try-on/:id" element={<TryOn />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/store/:role/:userId" element={<VendorStore />} />
              <Route path="/vendor/:role/:userId" element={<VendorStore />} />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={
              isAuthenticated ? <Navigate to={getHomeRouteForRole(user?.role)} replace /> : <Login />
            } />
            <Route path="/register" element={
              isAuthenticated ? <Navigate to={getHomeRouteForRole(user?.role)} replace /> : <Register />
            } />
            <Route path="/forgot-password" element={
              isAuthenticated ? <Navigate to={getHomeRouteForRole(user?.role)} replace /> : <ForgotPassword />
            } />

            {/* Checkout - Requires Auth */}
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/checkout" element={<Checkout />} />
            </Route>

            {/* Customer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route element={<DashboardLayout userType="customer" />}>
                <Route path="/dashboard" element={<CustomerDashboard />} />
                <Route path="/orders" element={<CustomerOrders />} />
                <Route path="/profile" element={<CustomerProfile />} />
                <Route path="/measurements" element={<CustomerMeasurements />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMINISTRATOR']} />}>
              <Route element={<DashboardLayout userType="admin" />}>
                <Route
                  path="/admin"
                  element={
                    <AdminPermissionGuard required={['admin:dashboard:read']}>
                      <AdminDashboard />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminPermissionGuard required={['users:read']}>
                      <AdminUsers />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/roles"
                  element={
                    <AdminPermissionGuard required={['admin:roles:manage', 'users:read']}>
                      <AdminRoleManagement />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/vendor-profiles"
                  element={
                    <AdminPermissionGuard required={['vendor_profiles:read']}>
                      <AdminVendorProfiles />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/session-audit"
                  element={
                    <AdminPermissionGuard required={['session_audit:read']}>
                      <AdminSessionAudit />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/products"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProducts />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <AdminPermissionGuard required={['orders:manage']}>
                      <AdminOrders />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/orders/:id"
                  element={
                    <AdminPermissionGuard required={['orders:manage']}>
                      <AdminOrders />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/pricing"
                  element={
                    <AdminPermissionGuard required={['pricing:manage']}>
                      <AdminPricingRules />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/currency"
                  element={
                    <AdminPermissionGuard required={['currency:manage']}>
                      <AdminCurrencyMatrix />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/traffic"
                  element={
                    <AdminPermissionGuard required={['traffic:read']}>
                      <AdminTraffic />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/banners"
                  element={
                    <AdminPermissionGuard required={['banners:manage']}>
                      <AdminBanners />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/homepage"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']}>
                      <AdminHomepage />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/homepage-sections"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']}>
                      <AdminHomepageSections />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/measurement-templates"
                  element={
                    <AdminPermissionGuard required={['measurement_templates:manage']}>
                      <AdminMeasurementTemplates />
                    </AdminPermissionGuard>
                  }
                />
              </Route>
            </Route>

            {/* Seller Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FABRIC_SELLER']} />}>
              <Route element={<DashboardLayout userType="seller" />}>
                <Route path="/seller" element={<SellerDashboard />} />
                <Route path="/seller/profile-setup" element={<VendorProfileSetup />} />
                <Route path="/seller/fabrics" element={<SellerDashboard />} />
                <Route path="/seller/orders" element={<SellerDashboard />} />
              </Route>
            </Route>

            {/* Designer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FASHION_DESIGNER']} />}>
              <Route element={<DashboardLayout userType="designer" />}>
                <Route path="/designer" element={<DesignerDashboard />} />
                <Route path="/designer/profile-setup" element={<VendorProfileSetup />} />
                <Route path="/designer/designs" element={<DesignerDashboard />} />
                <Route path="/designer/orders" element={<DesignerDashboard />} />
              </Route>
            </Route>

            {/* QA Routes */}
            <Route element={<ProtectedRoute allowedRoles={['QA_TEAM']} />}>
              <Route element={<DashboardLayout userType="qa" />}>
                <Route path="/qa" element={<QADashboard />} />
                <Route path="/qa/orders" element={<QADashboard />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Router>
          </CurrencyProvider>
        </ToastProvider>
      </Elements>
    </QueryClientProvider>
  );
}

export default App;

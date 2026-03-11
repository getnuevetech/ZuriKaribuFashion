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
import ReadyToWearTryOn from './pages/ReadyToWearTryOn';
import TryOn from './pages/TryOn';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import StoryPage from './pages/Story';
import SellerStorefront from './pages/storefront/SellerStorefront';
import DesignerStorefront from './pages/storefront/DesignerStorefront';

// Customer Pages
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerOrders from './pages/customer/Orders';
import CustomerProfile from './pages/customer/Profile';
import CustomerMeasurements from './pages/customer/Measurements';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminProducts from './pages/admin/Products';
import AdminProductLabels from './pages/admin/ProductLabels';
import AdminOrders from './pages/admin/Orders';
import AdminPricingRules from './pages/admin/PricingRules';
import AdminPromoCodes from './pages/admin/PromoCodes';
import AdminBanners from './pages/admin/Banners';
import AdminHomepage from './pages/admin/Homepage';
import AdminHomepageSections from './pages/admin/HomepageSections';
import AdminHomepageVisibility from './pages/admin/HomepageVisibility';
import AdminBlogs from './pages/admin/Blogs';
import AdminRoleManagement from './pages/admin/RoleManagement';
import AdminVendorProfiles from './pages/admin/VendorProfiles';
import AdminSessionAudit from './pages/admin/SessionAudit';
import AdminTraffic from './pages/admin/Traffic';
import AdminMeasurementTemplates from './pages/admin/MeasurementTemplates';
import AdminCurrencyMatrix from './pages/admin/CurrencyMatrix';
import AdminPayments from './pages/admin/Payments';
import AdminShipping from './pages/admin/Shipping';

// Seller Pages
import SellerDashboard from './pages/seller/Dashboard';

// Designer Pages
import DesignerDashboard from './pages/designer/Dashboard';

// QA Pages
import QADashboard from './pages/qa/Dashboard';

// Auth
import ProtectedRoute from './components/ProtectedRoute';
import AdminPermissionGuard from './components/AdminPermissionGuard';
import { useAuthStore } from './store/authStore';
import { getHomeRouteForUser } from './auth/rbac';

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
  const authenticatedHomeRoute = getHomeRouteForUser(user);

  return (
    <QueryClientProvider client={queryClient}>
      <Elements stripe={stripePromise}>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/designs" element={<Designs />} />
              <Route path="/designs/:id" element={<DesignDetail />} />
              <Route path="/fabrics" element={<Fabrics />} />
              <Route path="/fabrics/:id" element={<FabricDetail />} />
              <Route path="/ready-to-wear" element={<ReadyToWear />} />
              <Route path="/ready-to-wear/:id" element={<ReadyToWearDetail />} />
              <Route path="/ready-to-wear/:id/try-on" element={<ReadyToWearTryOn />} />
              <Route path="/try-on/:id" element={<TryOn />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/stories/:slug" element={<StoryPage />} />
              <Route path="/store/seller/:profileId/:brandSlug" element={<SellerStorefront />} />
              <Route path="/store/designer/:profileId/:brandSlug" element={<DesignerStorefront />} />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={
              isAuthenticated ? <Navigate to={authenticatedHomeRoute} replace /> : <Login />
            } />
            <Route path="/register" element={
              isAuthenticated ? <Navigate to={authenticatedHomeRoute} replace /> : <Register />
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
                  element={<AdminDashboard />}
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
                  path="/admin/traffic"
                  element={
                    <AdminPermissionGuard required={['traffic:read']}>
                      <AdminTraffic />
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
                <Route
                  path="/admin/currency"
                  element={
                    <AdminPermissionGuard required={['currency:manage']}>
                      <AdminCurrencyMatrix />
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
                  path="/admin/product-labels"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProductLabels />
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
                  path="/admin/pricing"
                  element={
                    <AdminPermissionGuard required={['pricing:manage']}>
                      <AdminPricingRules />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/promo-codes"
                  element={
                    <AdminPermissionGuard required={['pricing:manage']}>
                      <AdminPromoCodes />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/payments"
                  element={
                    <AdminPermissionGuard required={['payments:manage']}>
                      <AdminPayments />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/shipping"
                  element={
                    <AdminPermissionGuard required={['shipping:manage']}>
                      <AdminShipping />
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
                  path="/admin/homepage-visibility"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']}>
                      <AdminHomepageVisibility />
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
                  path="/admin/blogs"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']}>
                      <AdminBlogs />
                    </AdminPermissionGuard>
                  }
                />
              </Route>
            </Route>

            {/* Seller Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FABRIC_SELLER']} />}>
              <Route element={<DashboardLayout userType="seller" />}>
                <Route path="/seller" element={<SellerDashboard />} />
              </Route>
            </Route>

            {/* Designer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FASHION_DESIGNER']} />}>
              <Route element={<DashboardLayout userType="designer" />}>
                <Route path="/designer" element={<DesignerDashboard />} />
              </Route>
            </Route>

            {/* QA Routes */}
            <Route element={<ProtectedRoute allowedRoles={['QA_TEAM']} />}>
              <Route element={<DashboardLayout userType="qa" />}>
                <Route path="/qa" element={<QADashboard />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </Elements>
    </QueryClientProvider>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Public Pages
import Home from './pages/Home';
import HomeEntry from './pages/HomeEntry';
import ShopPage from './pages/Shop';
import CountryProducts from './pages/CountryProducts';
import ReadyToWear from './pages/ReadyToWear';
import ReadyToWearDetail from './pages/ReadyToWearDetail';
import Fabrics from './pages/Fabrics';
import FabricDetail from './pages/FabricDetail';
import Designs from './pages/Designs';
import DesignDetail from './pages/DesignDetail';
import ReadyToWearTryOn from './pages/ReadyToWearTryOn';
import TryOn from './pages/TryOn';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePasswordRequired from './pages/ChangePasswordRequired';
import ReferralCodeRedirect from './pages/ReferralCodeRedirect';
import StoryPage from './pages/Story';
import ContactPage from './pages/Contact';
import HelpCenterPage from './pages/HelpCenter';
import VendorSupportCenterPage from './pages/VendorSupportCenter';
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
import AdminCategoryPages from './pages/admin/CategoryPages';
import AdminBlogs from './pages/admin/Blogs';
import AdminRoleManagement from './pages/admin/RoleManagement';
import AdminVendorProfiles from './pages/admin/VendorProfiles';
import AdminSessionAudit from './pages/admin/SessionAudit';
import AdminTraffic from './pages/admin/Traffic';
import AdminMeasurementTemplates from './pages/admin/MeasurementTemplates';
import AdminCurrencyMatrix from './pages/admin/CurrencyMatrix';
import AdminPayments from './pages/admin/Payments';
import AdminVendorPayments from './pages/admin/VendorPayments';
import AdminShipping from './pages/admin/Shipping';
import AdminPartnerIntegrations from './pages/admin/PartnerIntegrations';
import AdminTryOnSettings from './pages/admin/TryOnSettings';
import AdminApiRouteDiagnostics from './pages/admin/ApiRouteDiagnostics';
import AdminFeaturedRequests from './pages/admin/FeaturedRequests';
import AdminNotificationCenter from './pages/admin/NotificationCenter';
import AdminBackups from './pages/admin/Backups';
import AdminProductChangeRequests from './pages/admin/ProductChangeRequests';
import AdminProductStockList from './pages/admin/ProductStockList';
import AdminProductPriceCompare from './pages/admin/ProductPriceCompare';
import AdminFailedAiApproval from './pages/admin/FailedAiApproval';
import AdminResellerInfluencers from './pages/admin/ResellerInfluencers';
import AdminAutomationApprovals from './pages/admin/AutomationApprovals';
import AdminAutomationAiConfig from './pages/admin/AutomationAiConfig';
import AdminAutomationSystem from './pages/admin/AutomationSystem';
import AdminDynamicFields from './pages/admin/DynamicFields';
import AdminReferralMaterials from './pages/admin/ReferralMaterials';
import AdminReferralList from './pages/admin/ReferralList';
import AdminReports from './pages/admin/Reports';
import AdminProfilePage from './pages/admin/Profile';
import AdminTicketManagement from './pages/admin/TicketManagement';
import AdminCustomerServiceChat from './pages/admin/CustomerServiceChat';
import AdminCustomerServiceSettings from './pages/admin/CustomerServiceSettings';
import AdminVoipConfiguration from './pages/admin/VoipConfiguration';
import AdminAuthenticatorSettings from './pages/admin/AuthenticatorSettings';
import AdminHelpCenterContent from './pages/admin/HelpCenterContent';
import AdminModuleRuntimeSettings from './pages/admin/ModuleRuntimeSettings';
import AdminHomepageRuntimeSwitchboard from './pages/admin/HomepageRuntimeSwitchboard';
import { JenksV14Redirect } from './pages/JenksV14Redirect';

// Seller Pages
import SellerDashboard from './pages/seller/Dashboard';
import SellerPayments from './pages/seller/Payments';
import SellerProfilePage from './pages/seller/Profile';
import SellerEnterprisePage from './pages/seller/Enterprise';
import SellerEnterpriseRoleManagementPage from './pages/seller/EnterpriseRoleManagement';
import SellerMessagesPage from './pages/seller/Messages';
import SellerFailedProductApprovalPage from './pages/seller/FailedProductApproval';

// Designer Pages
import DesignerDashboard from './pages/designer/Dashboard';
import DesignerPayments from './pages/designer/Payments';
import DesignerProfilePage from './pages/designer/Profile';
import DesignerEnterprisePage from './pages/designer/Enterprise';
import DesignerEnterpriseRoleManagementPage from './pages/designer/EnterpriseRoleManagement';
import DesignerMessagesPage from './pages/designer/Messages';
import DesignerMeasurementsPage from './pages/designer/Measurements';
import DesignerFailedProductApprovalPage from './pages/designer/FailedProductApproval';

// QA Pages
import QADashboard from './pages/qa/Dashboard';
import QAMessagesPage from './pages/qa/Messages';
import CustomerMessagesPage from './pages/customer/Messages';
import ResellerDashboard from './pages/reseller/Dashboard';
import ResellerProfilePage from './pages/reseller/Profile';
import ResellerMaterialsPage from './pages/reseller/Materials';

// Auth
import ProtectedRoute from './components/ProtectedRoute';
import AdminPermissionGuard from './components/AdminPermissionGuard';
import DashboardErrorBoundary from './components/DashboardErrorBoundary';
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

// Initialize Stripe strictly from runtime key sourced via Admin Payment Integrations API.
const runtimeStripeKey =
  typeof window !== 'undefined'
    ? String(window.localStorage.getItem('af_runtime_stripe_publishable_key') || '').trim()
    : '';
const configuredStripeKey = String(runtimeStripeKey || '').trim();
const hasUsableStripeKey = /^pk_(test|live)_/i.test(configuredStripeKey);
const stripePromise = hasUsableStripeKey ? loadStripe(configuredStripeKey) : null;

function NavigateWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ''}${location.hash || ''}`} replace />;
}

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const authenticatedHomeRoute = getHomeRouteForUser(user);

  return (
    <QueryClientProvider client={queryClient}>
      <Elements stripe={stripePromise}>
        <Router>
          <Routes>
            <Route path="/" element={<HomeEntry />} />
            <Route path="/main" element={<JenksV14Redirect />} />
            <Route path="/main/" element={<JenksV14Redirect />} />
            <Route path="/jenks" element={<JenksV14Redirect />} />
            <Route path="/home-jenks-static" element={<JenksV14Redirect />} />

            {/* Public Routes */}
            <Route element={<MainLayout />}>
              <Route path="/home-legacy" element={<NavigateWithSearch to="/home" />} />
              <Route path="/home" element={<JenksV14Redirect />} />
              <Route path="/home-live" element={<NavigateWithSearch to="/home" />} />
              <Route path="/jenks-dynamic" element={<NavigateWithSearch to="/home" />} />
              <Route path="/home-jenks" element={<NavigateWithSearch to="/home" />} />
              <Route path="/rtw" element={<Navigate to="/ready-to-wear" replace />} />
              <Route path="/readytowear" element={<Navigate to="/ready-to-wear" replace />} />
              <Route path="/ftb" element={<Navigate to="/fabrics" replace />} />
              <Route path="/fabric" element={<Navigate to="/fabrics" replace />} />
              <Route path="/fabric-to-buy" element={<Navigate to="/fabrics" replace />} />
              <Route path="/fabrics-to-buy" element={<Navigate to="/fabrics" replace />} />
              <Route path="/ctw" element={<Navigate to="/custom" replace />} />
              <Route path="/customtowear" element={<Navigate to="/custom" replace />} />
              <Route path="/contact-us" element={<Navigate to="/contact" replace />} />
              <Route path="/about" element={<Navigate to="/home#about" replace />} />
              <Route path="/about-us" element={<Navigate to="/home#about" replace />} />
              <Route path="/designers" element={<Navigate to="/custom" replace />} />
              <Route path="/support" element={<Navigate to="/help-center" replace />} />
              <Route path="/faq" element={<Navigate to="/help-center" replace />} />
              <Route path="/terms" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/privacy" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/legal/terms" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/legal/privacy" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/country-products" element={<CountryProducts />} />
              <Route path="/ready-to-wear" element={<ReadyToWear />} />
              <Route path="/ready-to-wear/:id" element={<ReadyToWearDetail />} />
              <Route path="/fabrics" element={<Fabrics />} />
              <Route path="/fabrics/:id" element={<FabricDetail />} />
              <Route path="/custom" element={<Designs />} />
              <Route path="/custom/:id" element={<DesignDetail />} />
              <Route path="/designs" element={<Designs />} />
              <Route path="/designs/:id" element={<DesignDetail />} />
              <Route path="/custom-to-wear" element={<Navigate to="/custom" replace />} />
              <Route path="/custom-to-wear/:id" element={<DesignDetail />} />
              <Route path="/ready-to-wear/:id/try-on" element={<ReadyToWearTryOn />} />
              <Route path="/try-on/:id" element={<TryOn />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/stories/:slug" element={<StoryPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help-center" element={<HelpCenterPage />} />
              <Route path="/seller-designer-support" element={<VendorSupportCenterPage />} />
              <Route path="/store/seller/:profileId/:brandSlug" element={<SellerStorefront />} />
              <Route path="/store/designer/:profileId/:brandSlug" element={<DesignerStorefront />} />
            </Route>

            {/* Auth Routes */}
            <Route path="/login" element={<NavigateWithSearch to="/auth/login" />} />
            <Route path="/auth" element={<NavigateWithSearch to="/auth/login" />} />
            <Route path="/signin" element={<NavigateWithSearch to="/auth/login" />} />
            <Route path="/sign-in" element={<NavigateWithSearch to="/auth/login" />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/forgot-password" element={<NavigateWithSearch to="/auth/forgot-password" />} />
            <Route path="/forgot" element={<NavigateWithSearch to="/auth/forgot-password" />} />
            <Route path="/forgotpassword" element={<NavigateWithSearch to="/auth/forgot-password" />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<NavigateWithSearch to="/auth/reset-password" />} />
            <Route path="/password-reset" element={<NavigateWithSearch to="/auth/reset-password" />} />
            <Route path="/reset" element={<NavigateWithSearch to="/auth/reset-password" />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<NavigateWithSearch to="/auth/register" />} />
            <Route
              path="/auth/register"
              element={isAuthenticated ? <Navigate to={authenticatedHomeRoute} replace /> : <Register />}
            />
            <Route path="/signup" element={<NavigateWithSearch to="/auth/register" />} />
            <Route path="/sign-up" element={<NavigateWithSearch to="/auth/register" />} />
            <Route path="/:referralCode" element={<ReferralCodeRedirect />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password-required" element={<ChangePasswordRequired />} />
            </Route>

            {/* Checkout - Requires Auth */}
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="/checkout" element={<Checkout />} />
            </Route>

            {/* Customer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="customer" />
                  </DashboardErrorBoundary>
                }
              >
                <Route path="/dashboard" element={<CustomerDashboard />} />
                <Route path="/orders" element={<CustomerOrders />} />
                <Route path="/dashboard/messages" element={<CustomerMessagesPage />} />
                <Route path="/profile" element={<CustomerProfile />} />
                <Route path="/measurements" element={<CustomerMeasurements />} />
              </Route>
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['ADMINISTRATOR']} />}>
              <Route
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="admin" />
                  </DashboardErrorBoundary>
                }
              >
                <Route
                  path="/admin"
                  element={<AdminDashboard />}
                />
                <Route path="/admin/profile" element={<AdminProfilePage />} />
                <Route
                  path="/admin/customer-accounts"
                  element={
                    <AdminPermissionGuard required={['users:read']}>
                      <AdminUsers />
                    </AdminPermissionGuard>
                  }
                />
                <Route path="/admin/users" element={<Navigate to="/admin/customer-accounts" replace />} />
                <Route path="/admin/administrator-accounts" element={<Navigate to="/admin/administrators" replace />} />
                <Route
                  path="/admin/administrators"
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
                  path="/admin/authenticator-security"
                  element={
                    <AdminPermissionGuard required={['authenticator:manage|users:manage']}>
                      <AdminAuthenticatorSettings />
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
                  path="/admin/activity-logs"
                  element={
                    <AdminPermissionGuard required={['session_audit:read']}>
                      <AdminSessionAudit />
                    </AdminPermissionGuard>
                  }
                />
                <Route path="/admin/session-audit" element={<Navigate to="/admin/activity-logs" replace />} />
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
                  path="/admin/products/configuration"
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
                  path="/admin/product-change-requests"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProductChangeRequests />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/products/stock-list"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProductStockList />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/products/price-compare"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProductPriceCompare />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/products/failed-ai-approvals"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminFailedAiApproval />
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
                  path="/admin/ticket-management"
                  element={
                    <AdminPermissionGuard required={['orders:manage']}>
                      <AdminTicketManagement />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/tickets"
                  element={
                    <AdminPermissionGuard required={['orders:manage']}>
                      <AdminTicketManagement />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/customer-service/chat"
                  element={
                    <AdminPermissionGuard required={['customer_service:chat:manage']}>
                      <AdminCustomerServiceChat />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/customer-service/settings"
                  element={
                    <AdminPermissionGuard required={['customer_service:settings:manage']}>
                      <AdminCustomerServiceSettings />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/voip"
                  element={
                    <AdminPermissionGuard required={['voip:manage|whatsapp:manage|orders:manage']}>
                      <AdminVoipConfiguration />
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
                  path="/admin/vendor-payments"
                  element={
                    <AdminPermissionGuard required={['payments:manage']}>
                      <AdminVendorPayments />
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
                  path="/admin/try-on"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminTryOnSettings />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/featured-requests"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminFeaturedRequests />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/notifications"
                  element={
                    <AdminPermissionGuard required={['notifications:manage']}>
                      <AdminNotificationCenter />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/backups"
                  element={
                    <AdminPermissionGuard required={['backups:manage']}>
                      <AdminBackups />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/resellers"
                  element={
                    <AdminPermissionGuard required={['users:manage']}>
                      <AdminResellerInfluencers />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/referrals/list"
                  element={
                    <AdminPermissionGuard required={['users:read']}>
                      <AdminReferralList />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/referrals/materials"
                  element={
                    <AdminPermissionGuard required={['users:manage']}>
                      <AdminReferralMaterials />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <AdminPermissionGuard required={['admin:dashboard:read']}>
                      <AdminReports />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/automation/approvals"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminAutomationApprovals />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/automation/ai-integrations"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminAutomationAiConfig />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/automation/system"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminAutomationSystem />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/dynamic-fields"
                  element={
                    <AdminPermissionGuard required={['dynamic_fields:manage|products:manage|users:manage']}>
                      <AdminDynamicFields />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/partners"
                  element={
                    <AdminPermissionGuard required={['users:manage']}>
                      <AdminPartnerIntegrations />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/api-diagnostics"
                  element={<AdminApiRouteDiagnostics />}
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
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminHomepage />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/homepage-visibility"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminHomepageVisibility />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/homepage-sections"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminHomepageSections />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/jenks-homepage"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminHomepageSections />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/homepage-runtime"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminHomepageRuntimeSwitchboard />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/category-pages"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']}>
                      <AdminCategoryPages />
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
                <Route
                  path="/admin/help-center-content"
                  element={
                    <AdminPermissionGuard required={['help_center:manage|homepage:manage']}>
                      <AdminHelpCenterContent />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/modules"
                  element={
                    <AdminPermissionGuard required={['modules:manage|users:manage|admin:roles:manage']}>
                      <AdminModuleRuntimeSettings />
                    </AdminPermissionGuard>
                  }
                />
              </Route>
            </Route>

            {/* Seller Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FABRIC_SELLER']} />}>
              <Route
                path="/seller"
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="seller" />
                  </DashboardErrorBoundary>
                }
              >
                <Route index element={<SellerDashboard />} />
                <Route path="dashboard" element={<SellerDashboard />} />
                <Route path="payments" element={<SellerPayments />} />
                <Route path="profile" element={<SellerProfilePage />} />
                <Route path="enterprise" element={<SellerEnterprisePage />} />
                <Route path="enterprise/role-management" element={<SellerEnterpriseRoleManagementPage />} />
                <Route path="messages" element={<SellerMessagesPage />} />
                <Route path="failed-product-approvals" element={<SellerFailedProductApprovalPage />} />
                <Route path="support-center" element={<VendorSupportCenterPage />} />
                <Route path="*" element={<Navigate to="/seller" replace />} />
              </Route>
            </Route>

            {/* Designer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['FASHION_DESIGNER']} />}>
              <Route
                path="/designer"
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="designer" />
                  </DashboardErrorBoundary>
                }
              >
                <Route index element={<DesignerDashboard />} />
                <Route path="dashboard" element={<DesignerDashboard />} />
                <Route path="payments" element={<DesignerPayments />} />
                <Route path="profile" element={<DesignerProfilePage />} />
                <Route path="measurements" element={<DesignerMeasurementsPage />} />
                <Route path="enterprise" element={<DesignerEnterprisePage />} />
                <Route path="enterprise/role-management" element={<DesignerEnterpriseRoleManagementPage />} />
                <Route path="messages" element={<DesignerMessagesPage />} />
                <Route path="failed-product-approvals" element={<DesignerFailedProductApprovalPage />} />
                <Route path="support-center" element={<VendorSupportCenterPage />} />
                <Route path="*" element={<Navigate to="/designer" replace />} />
              </Route>
            </Route>

            {/* QA Routes */}
            <Route element={<ProtectedRoute allowedRoles={['QA_TEAM']} />}>
              <Route
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="qa" />
                  </DashboardErrorBoundary>
                }
              >
                <Route path="/qa" element={<QADashboard />} />
                <Route path="/qa/messages" element={<QAMessagesPage />} />
              </Route>
            </Route>

            {/* Reseller Routes */}
            <Route element={<ProtectedRoute allowedRoles={['RESELLER_INFLUENCER']} />}>
              <Route
                path="/reseller"
                element={
                  <DashboardErrorBoundary>
                    <DashboardLayout userType="reseller" />
                  </DashboardErrorBoundary>
                }
              >
                <Route index element={<ResellerDashboard />} />
                <Route path="profile" element={<ResellerProfilePage />} />
                <Route path="materials" element={<ResellerMaterialsPage />} />
                <Route path="support-center" element={<VendorSupportCenterPage />} />
                <Route path="*" element={<Navigate to="/reseller" replace />} />
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

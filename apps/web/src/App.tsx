import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

import JenksV2MainLayout from './layouts/JenksV2MainLayout';
import JenksFrontpageV2 from './pages/jenks-v2/JenksFrontpageV2';
import ProtectedRoute from './components/ProtectedRoute';
import AdminPermissionGuard from './components/AdminPermissionGuard';
import DashboardErrorBoundary from './components/DashboardErrorBoundary';
import { useAuthStore } from './store/authStore';
import { getHomeRouteForUser } from './auth/rbac';

const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));

const CountryProducts = lazy(() => import('./pages/CountryProducts'));
const ReadyToWear = lazy(() => import('./pages/ReadyToWear'));
const ReadyToWearDetail = lazy(() => import('./pages/ReadyToWearDetail'));
const Fabrics = lazy(() => import('./pages/Fabrics'));
const FabricDetail = lazy(() => import('./pages/FabricDetail'));
const Designs = lazy(() => import('./pages/Designs'));
const DesignDetail = lazy(() => import('./pages/DesignDetail'));
const KimiProductDetail = lazy(() => import('./pages/KimiProductDetail'));
const ReadyToWearTryOn = lazy(() => import('./pages/ReadyToWearTryOn'));
const Shop = lazy(() => import('./pages/Shop'));
const TryOn = lazy(() => import('./pages/TryOn'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ChangePasswordRequired = lazy(() => import('./pages/ChangePasswordRequired'));
const ReferralCodeRedirect = lazy(() => import('./pages/ReferralCodeRedirect'));
const StoryPage = lazy(() => import('./pages/Story'));
const ContactPage = lazy(() => import('./pages/Contact'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenter'));
const VendorSupportCenterPage = lazy(() => import('./pages/VendorSupportCenter'));
const SellerStorefront = lazy(() => import('./pages/storefront/SellerStorefront'));
const DesignerStorefront = lazy(() => import('./pages/storefront/DesignerStorefront'));

const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const CustomerOrders = lazy(() => import('./pages/customer/Orders'));
const CustomerProfile = lazy(() => import('./pages/customer/Profile'));
const CustomerMeasurements = lazy(() => import('./pages/customer/Measurements'));
const CustomerMessagesPage = lazy(() => import('./pages/customer/Messages'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminProductLabels = lazy(() => import('./pages/admin/ProductLabels'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const AdminPricingRules = lazy(() => import('./pages/admin/PricingRules'));
const AdminPromoCodes = lazy(() => import('./pages/admin/PromoCodes'));
const AdminBanners = lazy(() => import('./pages/admin/Banners'));
const AdminHomepage = lazy(() => import('./pages/admin/Homepage'));
const AdminHomepageSections = lazy(() => import('./pages/admin/HomepageSections'));
const AdminHomepageVisibility = lazy(() => import('./pages/admin/HomepageVisibility'));
const AdminCategoryPages = lazy(() => import('./pages/admin/CategoryPages'));
const AdminBlogs = lazy(() => import('./pages/admin/Blogs'));
const AdminRoleManagement = lazy(() => import('./pages/admin/RoleManagement'));
const AdminVendorProfiles = lazy(() => import('./pages/admin/VendorProfiles'));
const AdminSessionAudit = lazy(() => import('./pages/admin/SessionAudit'));
const AdminTraffic = lazy(() => import('./pages/admin/Traffic'));
const AdminNewsletterSubscribersPage = lazy(() => import('./pages/admin/NewsletterSubscribers'));
const AdminMeasurementTemplates = lazy(() => import('./pages/admin/MeasurementTemplates'));
const AdminCurrencyMatrix = lazy(() => import('./pages/admin/CurrencyMatrix'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminVendorPayments = lazy(() => import('./pages/admin/VendorPayments'));
const AdminShipping = lazy(() => import('./pages/admin/Shipping'));
const AdminPartnerIntegrations = lazy(() => import('./pages/admin/PartnerIntegrations'));
const AdminTryOnSettings = lazy(() => import('./pages/admin/TryOnSettings'));
const AdminApiRouteDiagnostics = lazy(() => import('./pages/admin/ApiRouteDiagnostics'));
const AdminFeaturedRequests = lazy(() => import('./pages/admin/FeaturedRequests'));
const AdminNotificationCenter = lazy(() => import('./pages/admin/NotificationCenter'));
const AdminBackups = lazy(() => import('./pages/admin/Backups'));
const AdminProductChangeRequests = lazy(() => import('./pages/admin/ProductChangeRequests'));
const AdminProductStockList = lazy(() => import('./pages/admin/ProductStockList'));
const AdminProductPriceCompare = lazy(() => import('./pages/admin/ProductPriceCompare'));
const AdminFailedAiApproval = lazy(() => import('./pages/admin/FailedAiApproval'));
const AdminResellerInfluencers = lazy(() => import('./pages/admin/ResellerInfluencers'));
const AdminAutomationApprovals = lazy(() => import('./pages/admin/AutomationApprovals'));
const AdminAutomationAiConfig = lazy(() => import('./pages/admin/AutomationAiConfig'));
const AdminAutomationSystem = lazy(() => import('./pages/admin/AutomationSystem'));
const AdminDynamicFields = lazy(() => import('./pages/admin/DynamicFields'));
const AdminReferralMaterials = lazy(() => import('./pages/admin/ReferralMaterials'));
const AdminReferralList = lazy(() => import('./pages/admin/ReferralList'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminProfilePage = lazy(() => import('./pages/admin/Profile'));
const AdminTicketManagement = lazy(() => import('./pages/admin/TicketManagement'));
const AdminCustomerServiceChat = lazy(() => import('./pages/admin/CustomerServiceChat'));
const AdminCustomerServiceSettings = lazy(() => import('./pages/admin/CustomerServiceSettings'));
const AdminVoipConfiguration = lazy(() => import('./pages/admin/VoipConfiguration'));
const AdminAuthenticatorSettings = lazy(() => import('./pages/admin/AuthenticatorSettings'));
const AdminHelpCenterContent = lazy(() => import('./pages/admin/HelpCenterContent'));
const AdminContactPageManager = lazy(() => import('./pages/admin/ContactPageManager'));
const AdminModuleRuntimeSettings = lazy(() => import('./pages/admin/ModuleRuntimeSettings'));
const AdminHomepageRuntimeSwitchboard = lazy(() => import('./pages/admin/HomepageRuntimeSwitchboard'));
const AdminJenksHomepageManage = lazy(() => import('./pages/admin/JenksHomepageManage'));
const AdminJenksV2FrontPageManager = lazy(() => import('./pages/admin/JenksV2FrontPageManager'));

const SellerDashboard = lazy(() => import('./pages/seller/Dashboard'));
const SellerPayments = lazy(() => import('./pages/seller/Payments'));
const SellerProfilePage = lazy(() => import('./pages/seller/Profile'));
const SellerEnterprisePage = lazy(() => import('./pages/seller/Enterprise'));
const SellerEnterpriseRoleManagementPage = lazy(() => import('./pages/seller/EnterpriseRoleManagement'));
const SellerMessagesPage = lazy(() => import('./pages/seller/Messages'));
const SellerFailedProductApprovalPage = lazy(() => import('./pages/seller/FailedProductApproval'));

const DesignerDashboard = lazy(() => import('./pages/designer/Dashboard'));
const DesignerPayments = lazy(() => import('./pages/designer/Payments'));
const DesignerProfilePage = lazy(() => import('./pages/designer/Profile'));
const DesignerEnterprisePage = lazy(() => import('./pages/designer/Enterprise'));
const DesignerEnterpriseRoleManagementPage = lazy(() => import('./pages/designer/EnterpriseRoleManagement'));
const DesignerMessagesPage = lazy(() => import('./pages/designer/Messages'));
const DesignerMeasurementsPage = lazy(() => import('./pages/designer/Measurements'));
const DesignerFailedProductApprovalPage = lazy(() => import('./pages/designer/FailedProductApproval'));

const QADashboard = lazy(() => import('./pages/qa/Dashboard'));
const QAMessagesPage = lazy(() => import('./pages/qa/Messages'));
const ResellerDashboard = lazy(() => import('./pages/reseller/Dashboard'));
const ResellerProfilePage = lazy(() => import('./pages/reseller/Profile'));
const ResellerMaterialsPage = lazy(() => import('./pages/reseller/Materials'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Initialize Stripe strictly from runtime key sourced via Admin Payment Integrations API.
const readRuntimeStripeKey = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem('af_runtime_stripe_publishable_key') || '').trim();
  } catch {
    // Some mobile/private browsing environments block localStorage access.
    // We should not crash app bootstrap because of Stripe runtime key lookup.
    return '';
  }
};

const runtimeStripeKey = readRuntimeStripeKey();
const configuredStripeKey = String(runtimeStripeKey || '').trim();
const hasUsableStripeKey = /^pk_(test|live)_/i.test(configuredStripeKey);
const stripePromise = hasUsableStripeKey ? loadStripe(configuredStripeKey) : null;

function NavigateWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search || ''}${location.hash || ''}`} replace />;
}

function NavigateCategoryDetailWithSearch({
  toBase,
  includeTryOn = false,
}: {
  toBase: '/readytowear' | '/fabricstobuy' | '/customtowear';
  includeTryOn?: boolean;
}) {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const safeId = encodeURIComponent(String(id || '').trim());
  const suffix = includeTryOn ? '/try-on' : '';
  return <Navigate to={`${toBase}/${safeId}${suffix}${location.search || ''}${location.hash || ''}`} replace />;
}

function RouteSuspenseFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter Tight, Inter, system-ui, -apple-system, sans-serif',
        background: '#f8f6f1',
        color: '#111111',
      }}
    >
      Loading...
    </div>
  );
}

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const authenticatedHomeRoute = getHomeRouteForUser(user);

  return (
    <QueryClientProvider client={queryClient}>
      <Elements stripe={stripePromise}>
        <Router>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Routes>
            <Route path="/" element={<JenksFrontpageV2 />} />
            <Route path="/main" element={<NavigateWithSearch to="/" />} />
            <Route path="/main/" element={<NavigateWithSearch to="/" />} />
            <Route path="/jenks" element={<NavigateWithSearch to="/" />} />
            <Route path="/home-jenks-static" element={<NavigateWithSearch to="/" />} />
            <Route path="/home-v2-preview" element={<JenksFrontpageV2 />} />
            <Route path="/home-v2-preview/" element={<JenksFrontpageV2 />} />
            <Route path="/jenks-v2-preview" element={<NavigateWithSearch to="/" />} />
            <Route path="/rtw" element={<NavigateWithSearch to="/readytowear" />} />
            <Route path="/ready-to-wear" element={<NavigateWithSearch to="/readytowear" />} />
            <Route path="/ready-to-wear/:id" element={<NavigateCategoryDetailWithSearch toBase="/readytowear" />} />
            <Route
              path="/ready-to-wear/:id/try-on"
              element={<NavigateCategoryDetailWithSearch toBase="/readytowear" includeTryOn />}
            />
            <Route path="/jenks-v14/ready-to-wear" element={<NavigateWithSearch to="/readytowear" />} />
            <Route path="/jenks-v14/ready-to-wear/:id" element={<NavigateCategoryDetailWithSearch toBase="/readytowear" />} />
            <Route
              path="/jenks-v14/ready-to-wear/:id/try-on"
              element={<NavigateCategoryDetailWithSearch toBase="/readytowear" includeTryOn />}
            />
            <Route path="/ftb" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/fabric" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/fabric-to-buy" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/fabrics-to-buy" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/fabrics" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/fabrics/:id" element={<NavigateCategoryDetailWithSearch toBase="/fabricstobuy" />} />
            <Route path="/jenks-v14/fabrics" element={<NavigateWithSearch to="/fabricstobuy" />} />
            <Route path="/jenks-v14/fabrics/:id" element={<NavigateCategoryDetailWithSearch toBase="/fabricstobuy" />} />
            <Route path="/ctw" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/cystomtowear" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/custom-to-wear" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/custom-to-wear/:id" element={<NavigateCategoryDetailWithSearch toBase="/customtowear" />} />
            <Route path="/custom" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/custom/:id" element={<NavigateCategoryDetailWithSearch toBase="/customtowear" />} />
            <Route path="/designs" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/designs/:id" element={<NavigateCategoryDetailWithSearch toBase="/customtowear" />} />
            <Route path="/jenks-v14/custom-to-wear" element={<NavigateWithSearch to="/customtowear" />} />
            <Route path="/jenks-v14/custom-to-wear/:id" element={<NavigateCategoryDetailWithSearch toBase="/customtowear" />} />

            {/* Public Routes */}
            <Route element={<JenksV2MainLayout />}>
              <Route path="/readytowear" element={<ReadyToWear />} />
              <Route path="/fabricstobuy" element={<Fabrics />} />
              <Route path="/customtowear" element={<Designs />} />
              <Route path="/cystomtowear" element={<NavigateWithSearch to="/customtowear" />} />
              <Route path="/readytowear/:id" element={<ReadyToWearDetail />} />
              <Route path="/fabricstobuy/:id" element={<FabricDetail />} />
              <Route path="/customtowear/:id" element={<DesignDetail />} />
              <Route path="/cystomtowear/:id" element={<NavigateCategoryDetailWithSearch toBase="/customtowear" />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/Shop" element={<Shop />} />
              <Route path="/product/:id" element={<KimiProductDetail />} />
              <Route path="/readytowear/:id/try-on" element={<ReadyToWearTryOn />} />
              <Route path="/home-legacy" element={<NavigateWithSearch to="/" />} />
              <Route path="/home" element={<NavigateWithSearch to="/" />} />
              <Route path="/home-live" element={<NavigateWithSearch to="/" />} />
              <Route path="/jenks-dynamic" element={<NavigateWithSearch to="/" />} />
              <Route path="/home-jenks" element={<NavigateWithSearch to="/" />} />
              <Route path="/contact-us" element={<Navigate to="/contact" replace />} />
              <Route path="/about" element={<Navigate to="/#about" replace />} />
              <Route path="/about-us" element={<Navigate to="/#about" replace />} />
              <Route path="/designers" element={<Navigate to="/customtowear" replace />} />
              <Route path="/support" element={<Navigate to="/help-center" replace />} />
              <Route path="/faq" element={<Navigate to="/help-center" replace />} />
              <Route path="/terms" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/privacy" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/legal/terms" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/legal/privacy" element={<NavigateWithSearch to="/help-center" />} />
              <Route path="/country-products" element={<CountryProducts />} />
              <Route path="/country" element={<CountryProducts />} />
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
                <Route
                  path="/admin/customer-accounts/newsletter-subscribers"
                  element={
                    <AdminPermissionGuard required={['users:read']}>
                      <AdminNewsletterSubscribersPage />
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
                  path="/admin/products/product-card"
                  element={
                    <AdminPermissionGuard required={['products:manage']}>
                      <AdminProducts />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/products/configuration"
                  element={<Navigate to="/admin/products/configuration/detailed-product-view" replace />}
                />
                <Route
                  path="/admin/products/configuration/product-cards"
                  element={<Navigate to="/admin/products/product-card" replace />}
                />
                <Route
                  path="/admin/products/configuration/detailed-product-view"
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
                      <AdminJenksHomepageManage />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/jenks-v2-frontpage-manager"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminJenksV2FrontPageManager />
                    </AdminPermissionGuard>
                  }
                />
                <Route
                  path="/admin/jenks-v2-frontpage-manager/:submenu"
                  element={
                    <AdminPermissionGuard required={['homepage:manage']} superAdminOnly>
                      <AdminJenksV2FrontPageManager />
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
                  path="/admin/category-pages-manager"
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
                  path="/admin/contact-page-manager"
                  element={
                    <AdminPermissionGuard required={['help_center:manage|homepage:manage']}>
                      <AdminContactPageManager />
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
          </Suspense>
        </Router>
      </Elements>
    </QueryClientProvider>
  );
}

export default App;

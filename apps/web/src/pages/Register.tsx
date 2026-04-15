import { useEffect, useState, type ComponentType, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  Store,
  Scissors,
  Phone,
  Building2,
  MapPin,
  Info,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import { getHomeRouteForUser } from '../auth/rbac';
import {
  getAfricanCountryOptions,
  getCityOptionsByCountryCode,
  getCountryOptions,
  resolveCountryCode,
  resolveCountryName,
} from '../data/locationOptions';
import { normalizePhoneWithCountryPrefix } from '../utils/phone';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';
import AuthPageShell from '../components/auth/AuthPageShell';

type UserRole = 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER';

const DEFAULT_REFERRAL_CODE = 'PLATFORM-DEFAULT';

const normalizeReferralCodeInput = (value: string) =>
  String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '-')
    .slice(0, 80);

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const roleOptions: RoleOption[] = [
  {
    value: 'CUSTOMER',
    label: 'Customer',
    description: 'Shop for African fashion designs and fabrics',
    icon: User,
  },
  {
    value: 'FABRIC_SELLER',
    label: 'Fabric Seller',
    description: 'Sell authentic African fabrics to designers',
    icon: Store,
  },
  {
    value: 'FASHION_DESIGNER',
    label: 'Fashion Designer',
    description: 'Create and sell your unique designs',
    icon: Scissors,
  },
];

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const { settings: authPageSettings } = useAuthPageSettings();

  const referralCodeFromQuery = normalizeReferralCodeInput(String(searchParams.get('ref') || '').trim());
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: '',
    city: '',
    address: '',
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    bio: '',
    referralCode: referralCodeFromQuery || DEFAULT_REFERRAL_CODE,
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const googleClientId = String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
  ).trim();

  const allCountryOptions = getCountryOptions();
  const africanCountryOptions = getAfricanCountryOptions();
  const countryOptions =
    selectedRole === 'FABRIC_SELLER' || selectedRole === 'FASHION_DESIGNER'
      ? africanCountryOptions
      : allCountryOptions;
  const selectedCountryCode = resolveCountryCode(formData.country);
  const cityOptions = getCityOptionsByCountryCode(selectedCountryCode);

  useEffect(() => {
    if (!referralCodeFromQuery) return;
    setFormData((prev) => ({ ...prev, referralCode: referralCodeFromQuery }));
  }, [referralCodeFromQuery]);

  useEffect(() => {
    let cancelled = false;
    const loadPublicReferralConfig = async () => {
      try {
        const response = await api.referrals.getPublicProgramSettings();
        if (!response.success || cancelled) return;
        const defaultCode = normalizeReferralCodeInput(
          String(response.data?.defaultReferralCode || DEFAULT_REFERRAL_CODE)
        );
        if (!defaultCode) return;
        setFormData((prev) => {
          if (referralCodeFromQuery) return prev;
          const current = normalizeReferralCodeInput(prev.referralCode || '');
          if (!current || current === DEFAULT_REFERRAL_CODE) {
            return { ...prev, referralCode: defaultCode };
          }
          return prev;
        });
      } catch {
        // Keep local fallback code when route is unavailable.
      }
    };
    void loadPublicReferralConfig();
    return () => {
      cancelled = true;
    };
  }, [referralCodeFromQuery]);

  useEffect(() => {
    if (selectedRole !== 'FABRIC_SELLER' && selectedRole !== 'FASHION_DESIGNER') return;
    if (!selectedCountryCode) return;
    const isAllowed = africanCountryOptions.some((entry) => entry.code === selectedCountryCode);
    if (isAllowed) return;
    setFormData((prev) => ({ ...prev, country: '', city: '' }));
  }, [selectedRole, selectedCountryCode, africanCountryOptions]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();

    if (firstName.length < 2 || lastName.length < 2) {
      setError('First name and last name must each be at least 2 characters.');
      return;
    }

    const passwordSecurity = evaluatePasswordSecurity(formData.password);
    if (!passwordSecurity.isValid) {
      setError(passwordSecurity.message);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!formData.agreeTerms) {
      setError('Please agree to the terms and conditions.');
      return;
    }

    const isVendor = selectedRole === 'FABRIC_SELLER' || selectedRole === 'FASHION_DESIGNER';
    if (isVendor && (!formData.businessName.trim() || !formData.country.trim() || !formData.city.trim())) {
      setError('Business name, country, and city are required for sellers and designers.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneWithCountryPrefix(formData.phone, formData.country);
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        role: selectedRole,
        phone: normalizedPhone || formData.phone.trim(),
        country: formData.country.trim() || undefined,
        city: formData.city.trim() || undefined,
        address: formData.address.trim() || undefined,
        businessName: formData.businessName.trim() || undefined,
        businessEmail: formData.businessEmail.trim() || undefined,
        businessPhone: formData.businessPhone.trim() || undefined,
        bio: selectedRole === 'FASHION_DESIGNER' ? formData.bio.trim() || undefined : undefined,
        referralCode: normalizeReferralCodeInput(formData.referralCode),
      };

      const response = await api.auth.register(payload);
      if (response.success) {
        if (response.data.user?.status === 'ACTIVE' && response.data.token) {
          login(response.data.user, response.data.token);
          navigate(getHomeRouteForUser(response.data.user), { replace: true });
        } else {
          setNotice(
            'Account created successfully. Your account is pending admin approval before login.'
          );
          navigate('/auth/login', { replace: true });
        }
      }
    } catch (submitError: any) {
      setError(submitError?.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const credential = String(credentialResponse.credential || '').trim();
    if (!credential) {
      setError('Google authentication did not return a valid credential.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await api.auth.loginWithGoogle(credential);
      if (response.success && response.data?.token) {
        login(response.data.user, response.data.token);
        const targetRoute = getHomeRouteForUser(response.data.user);
        navigate(targetRoute, { replace: true });
        window.setTimeout(() => {
          if (
            window.location.pathname === '/register' ||
            window.location.pathname === '/auth/register'
          ) {
            window.location.assign(targetRoute);
          }
        }, 0);
      } else {
        setError('Google sign up failed. Please try again.');
      }
    } catch (googleError: any) {
      const message = String(googleError?.response?.data?.message || '').trim();
      if (message.toLowerCase().includes('route not found')) {
        setError(
          'Google sign up is not available on the current backend deployment yet. Please redeploy the API service.'
        );
      } else {
        setError(message || 'Google sign up failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      brandName={authPageSettings.brandName}
      heroImage={authPageSettings.registerHeroImage}
      heroImageFallback={AUTH_PAGE_SETTINGS_DEFAULTS.registerHeroImage}
      heroAlt={`${authPageSettings.brandName} register`}
      heroTitle={
        <>
          Join the
          <br />
          movement.
        </>
      }
      heroSubtitle="Discover authentic African fashion from talented designers across 54 countries."
      pageTitle="Create account"
      pageSubtitle="Sign up to start shopping African fashion from designers worldwide."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {roleOptions.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.value;
          return (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelectedRole(role.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-[#e85a3d] bg-[#e85a3d]/10'
                  : 'border-[#e5e5e5] bg-white hover:bg-[#f5f5f5]'
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 text-[#1a1a1a]" />
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{role.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#666666]">{role.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error ? <div className="border border-red-200 bg-red-50 p-4 text-base text-red-700">{error}</div> : null}
      {notice ? (
        <div className="border border-green-200 bg-green-50 p-4 text-base text-green-700">{notice}</div>
      ) : null}
      {referralCodeFromQuery ? (
        <div className="border border-[#f3d1c8] bg-[#fff5f2] p-4 text-sm text-[#a54b37]">
          Referral applied: <span className="font-semibold">{referralCodeFromQuery}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="firstName" className="text-[#1a1a1a] font-medium text-base">
              First name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
              <input
                id="firstName"
                type="text"
                required
                value={formData.firstName}
                onChange={(event) => setFormData((prev) => ({ ...prev, firstName: event.target.value }))}
                className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
                placeholder="First name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="lastName" className="text-[#1a1a1a] font-medium text-base">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              value={formData.lastName}
              onChange={(event) => setFormData((prev) => ({ ...prev, lastName: event.target.value }))}
              className="h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 outline-none text-base"
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-[#1a1a1a] font-medium text-base">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
              placeholder="Enter your email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-[#1a1a1a] font-medium text-base">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              className="pl-11 pr-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
              placeholder="Create a password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#666666] transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-sm text-[#999999]">Must be at least 8 characters with a number and special character.</p>
          <PasswordStrengthMeter password={formData.password} />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-[#1a1a1a] font-medium text-base">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              value={formData.confirmPassword}
              onChange={(event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              className="pl-11 pr-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
              placeholder="Confirm your password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#666666] transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="phone" className="text-[#1a1a1a] font-medium text-base">
              Phone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="country" className="text-[#1a1a1a] font-medium text-base">
              Country
            </label>
            <select
              id="country"
              value={selectedCountryCode}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  country: resolveCountryName(event.target.value),
                  city: '',
                  phone: normalizePhoneWithCountryPrefix(prev.phone, resolveCountryName(event.target.value)),
                }))
              }
              className="h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 outline-none text-base"
            >
              <option value="">Select country</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="city" className="text-[#1a1a1a] font-medium text-base">
              City
            </label>
            <select
              id="city"
              value={formData.city}
              onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
              className="h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 outline-none text-base"
              disabled={!formData.country}
            >
              <option value="">{formData.country ? 'Select city' : 'Select country first'}</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="address" className="text-[#1a1a1a] font-medium text-base">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
                placeholder="Business/Home address"
              />
            </div>
          </div>
        </div>

        {(selectedRole === 'FABRIC_SELLER' || selectedRole === 'FASHION_DESIGNER') && (
          <>
            <div className="space-y-2">
              <label htmlFor="businessName" className="text-[#1a1a1a] font-medium text-base">
                Business name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
                <input
                  id="businessName"
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, businessName: event.target.value }))
                  }
                  className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
                  placeholder="Business name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="businessEmail" className="text-[#1a1a1a] font-medium text-base">
                  Business email
                </label>
                <input
                  id="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, businessEmail: event.target.value }))
                  }
                  className="h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 outline-none text-base"
                  placeholder="Business email"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="businessPhone" className="text-[#1a1a1a] font-medium text-base">
                  Business phone
                </label>
                <input
                  id="businessPhone"
                  type="tel"
                  value={formData.businessPhone}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, businessPhone: event.target.value }))
                  }
                  className="h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 outline-none text-base"
                  placeholder="Business phone"
                />
              </div>
            </div>
          </>
        )}

        {selectedRole === 'FASHION_DESIGNER' && (
          <div className="space-y-2">
            <label htmlFor="bio" className="text-[#1a1a1a] font-medium text-base">
              Brand bio
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(event) => setFormData((prev) => ({ ...prev, bio: event.target.value }))}
              className="min-h-24 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg px-3 py-3 outline-none text-base"
              placeholder="Short description about your brand or design style"
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="referralCode" className="text-[#1a1a1a] font-medium text-base">
            Referral code
          </label>
          <div className="relative">
            <Info className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
            <input
              id="referralCode"
              type="text"
              required
              value={formData.referralCode}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  referralCode: normalizeReferralCodeInput(event.target.value),
                }))
              }
              className="pl-11 h-12 w-full bg-white border border-[#e5e5e5] focus:border-[#e85a3d] focus:ring-2 focus:ring-[#e85a3d]/20 rounded-lg outline-none text-base"
              placeholder="Referral code"
            />
          </div>
          <p className="text-sm text-[#999999]">
            Referral code is required. If you do not have one, keep the default code.
          </p>
        </div>

        <div className="flex items-start space-x-3">
          <input
            id="terms"
            type="checkbox"
            checked={formData.agreeTerms}
            onChange={(event) => setFormData((prev) => ({ ...prev, agreeTerms: event.target.checked }))}
            className="mt-1 h-4 w-4 border-[#d1d1d1] rounded"
          />
          <label htmlFor="terms" className="text-base text-[#666666] cursor-pointer leading-relaxed">
            I agree to the{' '}
            <Link to="/legal/terms" className="text-[#e85a3d] hover:text-[#d14a2d] font-medium">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" className="text-[#e85a3d] hover:text-[#d14a2d] font-medium">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          disabled={!formData.agreeTerms || loading}
          className="w-full h-12 bg-[#e85a3d] hover:bg-[#d14a2d] disabled:bg-[#cccccc] text-white text-base font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Creating account...' : 'Create Account'}
          {!loading ? <ArrowRight className="ml-2 w-4 h-4" /> : null}
        </Button>
      </form>

      {authPageSettings.showGoogleOnRegister ? (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e5e5e5]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#faf9f7] text-sm text-[#999999]">Or sign up with</span>
            </div>
          </div>
          {googleClientId ? (
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign up was cancelled or failed.')}
              />
            </div>
          ) : (
            <p className="text-center text-sm text-amber-700">
              Google sign up is unavailable. Missing <span className="font-semibold">VITE_GOOGLE_CLIENT_ID</span>.
            </p>
          )}
        </>
      ) : null}

      <p className="text-center text-base text-[#666666]">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-[#e85a3d] hover:text-[#d14a2d] font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}

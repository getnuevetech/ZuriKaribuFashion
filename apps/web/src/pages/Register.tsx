import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Store, Scissors } from 'lucide-react';
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
import { useAuthPageSettings } from '../hooks/useAuthPageSettings';

type UserRole = 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER';

interface RoleOption {
  value: UserRole;
  label: string;
  description: string;
  icon: React.ElementType;
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
  const { login } = useAuthStore();
  const { settings: authPageSettings } = useAuthPageSettings();
  const [selectedRole, setSelectedRole] = useState<UserRole>('CUSTOMER');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: '',
    city: '',
    businessName: '',
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
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
    if (selectedRole !== 'FABRIC_SELLER' && selectedRole !== 'FASHION_DESIGNER') return;
    if (!selectedCountryCode) return;
    const isAllowed = africanCountryOptions.some((entry) => entry.code === selectedCountryCode);
    if (isAllowed) return;
    setFormData((prev) => ({ ...prev, country: '', city: '' }));
  }, [selectedRole, selectedCountryCode, africanCountryOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.agreeTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      const [firstName = '', ...lastNameParts] = formData.fullName.trim().split(/\s+/);
      const lastName = lastNameParts.join(' ') || firstName;
      const normalizedPhone = normalizePhoneWithCountryPrefix(formData.phone, formData.country);

      const response = await api.auth.register({
        email: formData.email,
        password: formData.password,
        phone: normalizedPhone || formData.phone,
        country: formData.country,
        city: formData.city,
        businessName: formData.businessName,
        firstName,
        lastName,
        role: selectedRole,
      });

      if (response.success) {
        if (response.data.user?.status === 'ACTIVE' && response.data.token) {
          login(response.data.user, response.data.token);
          navigate(getHomeRouteForUser(response.data.user));
        } else {
          setNotice('Account created successfully. Your account is pending admin approval before login.');
          navigate('/login');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
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
          if (window.location.pathname === '/register') {
            window.location.assign(targetRoute);
          }
        }, 0);
      } else {
        setError('Google sign up failed. Please try again.');
      }
    } catch (err: any) {
      const message = String(err?.response?.data?.message || '').trim();
      if (message.toLowerCase().includes('route not found')) {
        setError('Google sign up is not available on the current backend deployment yet. Please redeploy the API service.');
      } else {
        setError(message || 'Google sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden border border-gray-200 bg-black shadow-sm md:min-h-[760px]">
          <img
            src={authPageSettings.registerHeroImage}
            alt={`${authPageSettings.brandName} register`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
          <p className="absolute left-6 top-5 text-3xl font-bold text-white md:text-4xl">
            {authPageSettings.brandName}
          </p>
          <p className="absolute bottom-6 left-6 pr-6 text-2xl font-medium italic text-white md:text-4xl">
            {authPageSettings.registerHeroCaption}
          </p>
        </div>

        <div className="border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8 md:py-10">
          <div className="mx-auto w-full max-w-md space-y-5">
            <div className="text-center">
              <p className="text-4xl font-bold text-black">{authPageSettings.brandName}</p>
              <h2 className="mt-6 text-4xl font-bold text-gray-900">{authPageSettings.registerTitle}</h2>
              <p className="mt-2 text-sm text-gray-600">{authPageSettings.registerSubtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {roleOptions.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedRole(role.value)}
                    className={`border p-2 text-left transition-colors ${
                      isSelected
                        ? 'border-black bg-amber-50'
                        : 'border-gray-300 bg-white hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 text-gray-700" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{role.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-gray-500">{role.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {notice}
              </div>
            ) : null}

            {authPageSettings.showGoogleOnRegister ? (
              <>
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Social Signup</p>
                {googleClientId ? (
                  <div className="flex justify-center">
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign up was cancelled or failed.')} />
                  </div>
                ) : (
                  <p className="text-center text-xs text-amber-700">
                    Google sign up is currently unavailable. Missing frontend environment variable:
                    {' '}
                    <span className="font-semibold">VITE_GOOGLE_CLIENT_ID</span>.
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
              </>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative sm:col-span-2">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="h-11 w-full border border-gray-300 pl-10 pr-3 text-sm focus:border-black focus:outline-none"
                    placeholder="Full Name"
                  />
                </div>

                <div className="relative sm:col-span-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-11 w-full border border-gray-300 pl-10 pr-3 text-sm focus:border-black focus:outline-none"
                    placeholder="Email Address"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-11 w-full border border-gray-300 pl-10 pr-10 text-sm focus:border-black focus:outline-none"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                  placeholder="Confirm Password"
                />

                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                  placeholder="Phone (optional)"
                />

                <select
                  required
                  value={selectedCountryCode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      country: resolveCountryName(e.target.value),
                      city: '',
                      phone: normalizePhoneWithCountryPrefix(formData.phone, resolveCountryName(e.target.value)),
                    })
                  }
                  className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none"
                >
                  <option value="">Country</option>
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>

                {(selectedRole === 'FABRIC_SELLER' || selectedRole === 'FASHION_DESIGNER') ? (
                  <>
                    <input
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none sm:col-span-2"
                      placeholder="Business Name"
                    />

                    <select
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="h-11 w-full border border-gray-300 px-3 text-sm focus:border-black focus:outline-none sm:col-span-2"
                      disabled={!formData.country}
                    >
                      <option value="">{formData.country ? 'Select City' : 'Select country first'}</option>
                      {cityOptions.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>

              <label htmlFor="terms" className="inline-flex items-start gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.agreeTerms}
                  onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="text-amber-700 hover:text-amber-800">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-amber-700 hover:text-amber-800">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <Button type="submit" className="h-11 w-full text-sm" disabled={loading}>
                {loading ? 'Creating account...' : authPageSettings.registerSubmitLabel}
                {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-amber-700 hover:text-amber-800">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

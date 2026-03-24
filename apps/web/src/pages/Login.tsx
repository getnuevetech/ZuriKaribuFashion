import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import { getHomeRouteForUser } from '../auth/rbac';
import { AUTH_PAGE_SETTINGS_DEFAULTS, useAuthPageSettings } from '../hooks/useAuthPageSettings';
import AuthPageShell from '../components/auth/AuthPageShell';

type LoginMfaMethod = 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR';

type LoginMfaChallenge = {
  challengeId: string;
  method: LoginMfaMethod;
  methods: LoginMfaMethod[];
  expiresAt: string;
  requiresTotpSetup?: boolean;
  deliveryHint?: string;
  setup?: {
    secret: string;
    otpauthUrl: string;
    issuer: string;
    digits: number;
    periodSeconds: number;
  };
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, token } = useAuthStore();
  const { settings: authPageSettings } = useAuthPageSettings();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<LoginMfaChallenge | null>(null);
  const [mfaSetupQrDataUrl, setMfaSetupQrDataUrl] = useState('');
  const [mfaSetupQrError, setMfaSetupQrError] = useState('');
  const googleClientId = String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
  ).trim();

  const resolveRedirectFromLocation = (fallbackRoute: string) => {
    const stateFrom = (location.state as any)?.from;
    const statePath =
      stateFrom && typeof stateFrom === 'object' && typeof stateFrom.pathname === 'string'
        ? `${stateFrom.pathname || ''}${stateFrom.search || ''}${stateFrom.hash || ''}`
        : '';
    const queryReturnTo = new URLSearchParams(location.search).get('returnTo') || '';
    const candidate = String(statePath || queryReturnTo || '').trim();
    if (!candidate || !candidate.startsWith('/')) return fallbackRoute;
    if (candidate.startsWith('/login') || candidate.startsWith('/register')) return fallbackRoute;
    return candidate;
  };

  const resolvePostLoginRoute = (nextUser: any) => {
    const fallbackRoute = getHomeRouteForUser(nextUser);
    return resolveRedirectFromLocation(fallbackRoute);
  };

  const completeLogin = (nextUser: any, nextToken: string) => {
    login(nextUser, nextToken);
    const targetRoute = resolvePostLoginRoute(nextUser);
    navigate(targetRoute, { replace: true });
    window.setTimeout(() => {
      if (window.location.pathname === '/login' || window.location.pathname === '/auth/login') {
        window.location.assign(targetRoute);
      }
    }, 0);
  };

  const handleAuthResponse = (response: any) => {
    if (response?.data?.requiresSecondFactor && response?.data?.challenge) {
      setMfaChallenge(response.data.challenge);
      setMfaCode('');
      setMfaError('');
      setError('');
      return;
    }
    if (response?.success && response?.data?.user && response?.data?.token) {
      completeLogin(response.data.user, response.data.token);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !token || !user) return;
    const targetRoute = resolvePostLoginRoute(user);
    navigate(targetRoute, { replace: true });
  }, [isAuthenticated, token, navigate, user, location.state, location.search]);

  useEffect(() => {
    const otpauthUrl = String(mfaChallenge?.setup?.otpauthUrl || '').trim();
    if (!otpauthUrl) {
      setMfaSetupQrDataUrl('');
      setMfaSetupQrError('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(otpauthUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (cancelled) return;
        setMfaSetupQrDataUrl(dataUrl);
        setMfaSetupQrError('');
      })
      .catch(() => {
        if (cancelled) return;
        setMfaSetupQrDataUrl('');
        setMfaSetupQrError('Unable to generate QR code. Use the setup key below.');
      });
    return () => {
      cancelled = true;
    };
  }, [mfaChallenge?.setup?.otpauthUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaError('');
    setLoading(true);

    try {
      const response = await api.auth.login(formData.email, formData.password);
      handleAuthResponse(response);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
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
    setMfaError('');
    setLoading(true);
    try {
      const response = await api.auth.loginWithGoogle(credential);
      if (response.success) {
        handleAuthResponse(response);
      } else {
        setError('Google login failed. Please try again.');
      }
    } catch (err: any) {
      const message = String(err?.response?.data?.message || '').trim();
      if (message.toLowerCase().includes('route not found')) {
        setError('Google login is not available on the current backend deployment yet. Please redeploy the API service.');
      } else {
        setError(message || 'Google login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaMethodChange = async (method: LoginMfaMethod) => {
    if (!mfaChallenge?.challengeId) return;
    setMfaError('');
    setLoading(true);
    try {
      const response = await api.auth.selectMfaChallengeMethod(mfaChallenge.challengeId, method);
      if (response?.data?.challenge) {
        setMfaChallenge(response.data.challenge);
        setMfaCode('');
      }
    } catch (err: any) {
      setMfaError(err?.response?.data?.message || 'Failed to switch authentication method.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge?.challengeId) return;
    setMfaError('');
    setLoading(true);
    try {
      const response = await api.auth.verifyMfaChallenge(mfaChallenge.challengeId, mfaCode);
      if (response?.success && response?.data?.user && response?.data?.token) {
        setMfaChallenge(null);
        setMfaCode('');
        completeLogin(response.data.user, response.data.token);
      } else {
        setMfaError('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setMfaError(err?.response?.data?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const expiresAtLabel = mfaChallenge?.expiresAt
    ? new Date(mfaChallenge.expiresAt).toLocaleTimeString()
    : '';

  return (
    <AuthPageShell
      brandName={authPageSettings.brandName}
      sectionLabel=""
      heroImage={authPageSettings.loginHeroImage}
      heroImageFallback={AUTH_PAGE_SETTINGS_DEFAULTS.loginHeroImage}
      heroAlt={`${authPageSettings.brandName} login`}
      heroCaption="Made by Africans. Worn by the world."
      heroSupportingText="African fashion marketplace — ready-to-wear, custom, and fabrics from 54 countries."
      title="Welcome back"
      subtitle="Sign in to access your account and continue shopping."
    >
      {error ? (
        <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!mfaChallenge && authPageSettings.showGoogleOnLogin ? (
        <>
          {googleClientId ? (
            <div className="flex justify-center">
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google login was cancelled or failed.')} />
            </div>
          ) : (
            <p className="text-center text-xs text-amber-700">
              Google login is currently unavailable. Missing frontend environment variable:
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

      {mfaChallenge ? (
        <form onSubmit={handleVerifyMfa} className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Second-factor verification required</p>
              <p className="text-xs text-amber-800">Use your chosen method to complete sign-in.</p>
            </div>
          </div>

          {mfaChallenge.methods.length > 1 ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Authentication method</label>
              <select
                value={mfaChallenge.method}
                onChange={(event) => handleMfaMethodChange(event.target.value as LoginMfaMethod)}
                className="h-12 w-full rounded-xl border border-[#e5e5e5] bg-white px-4 text-sm focus:border-[#e85a3c] focus:outline-none"
              >
                <option value="EMAIL_OTP">Email OTP</option>
                <option value="TOTP_AUTHENTICATOR">Google Authenticator / Authenticator App</option>
              </select>
            </div>
          ) : null}

          {mfaChallenge.method === 'EMAIL_OTP' ? (
            <p className="text-xs text-gray-700">{mfaChallenge.deliveryHint || 'A one-time passcode has been sent to your email.'}</p>
          ) : null}

          {mfaChallenge.method === 'TOTP_AUTHENTICATOR' && mfaChallenge.requiresTotpSetup ? (
            <div className="space-y-2 rounded border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold text-gray-800">Set up Google Authenticator</p>
              <p className="text-xs text-gray-600">
                Scan this barcode in your authenticator app. If scanning is unavailable, use the setup key.
              </p>
              {mfaSetupQrDataUrl ? (
                <div className="flex justify-center">
                  <img
                    src={mfaSetupQrDataUrl}
                    alt="Authenticator setup QR code"
                    className="h-44 w-44 rounded border border-gray-200 bg-white p-1"
                  />
                </div>
              ) : null}
              {mfaSetupQrError ? <p className="text-[11px] text-amber-700">{mfaSetupQrError}</p> : null}
              <code className="block break-all rounded bg-gray-100 p-2 text-[11px] text-gray-900">
                {mfaChallenge.setup?.secret}
              </code>
              {mfaChallenge.setup?.otpauthUrl ? (
                <a href={mfaChallenge.setup.otpauthUrl} className="text-xs text-amber-700 underline" target="_blank" rel="noreferrer">
                  Open setup link
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">
              {mfaChallenge.method === 'EMAIL_OTP' ? 'OTP code' : 'Authenticator code'}
            </label>
            <input
              required
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\s+/g, ''))}
              className="h-12 w-full rounded-xl border border-[#e5e5e5] bg-white px-4 text-sm tracking-widest focus:border-[#e85a3c] focus:outline-none"
              placeholder="Enter verification code"
            />
            {expiresAtLabel ? <p className="text-[11px] text-gray-500">Challenge expires at {expiresAtLabel}</p> : null}
          </div>

          {mfaError ? <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">{mfaError}</div> : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="submit" className="h-12 w-full rounded-xl bg-[#e85a3c] text-sm font-semibold text-white hover:bg-[#d14a2e]" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Sign in'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-xl border border-[#d7d7d7] bg-white text-sm font-semibold text-[#2d2d2d] hover:bg-[#f4f4f4]"
              disabled={loading}
              onClick={() => {
                if (mfaChallenge.method === 'EMAIL_OTP') {
                  void handleMfaMethodChange('EMAIL_OTP');
                } else {
                  setMfaChallenge(null);
                  setMfaCode('');
                  setMfaError('');
                }
              }}
            >
              {mfaChallenge.method === 'EMAIL_OTP' ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend code
                </>
              ) : (
                'Use another account'
              )}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 w-full rounded-xl border border-[#e6e6e6] bg-white pl-10 pr-4 text-sm focus:border-[#e85a3c] focus:outline-none"
                placeholder="Enter your email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-12 w-full rounded-xl border border-[#e6e6e6] bg-white pl-10 pr-10 text-sm focus:border-[#e85a3c] focus:outline-none"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label htmlFor="remember" className="inline-flex items-center gap-2 text-gray-600">
              <input
                type="checkbox"
                id="remember"
                className="h-4 w-4 border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              Remember me
            </label>
            <Link to="/auth/forgot-password" className="text-[#e85a3c] hover:text-[#c9492f]">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="h-12 w-full rounded-xl bg-[#e85a3c] text-sm font-semibold text-white hover:bg-[#d14a2e]" disabled={loading}>
            {loading ? 'Signing in...' : authPageSettings.loginSubmitLabel}
            {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-3 pt-1 text-[#a7a7a7]">
        <span className="h-px flex-1 bg-[#dddddd]" />
        <span className="text-sm">Or continue with</span>
        <span className="h-px flex-1 bg-[#dddddd]" />
      </div>

      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link to="/auth/register" className="font-medium text-[#e85a3c] hover:text-[#c9492f]">
          Create account
        </Link>
      </p>
    </AuthPageShell>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import Button from '../components/ui/Button';
import { getHomeRouteForUser } from '../auth/rbac';
import { useAuthPageSettings } from '../hooks/useAuthPageSettings';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuthStore();
  const { settings: authPageSettings } = useAuthPageSettings();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  useEffect(() => {
    if (!isAuthenticated) return;
    const targetRoute = resolvePostLoginRoute(user);
    navigate(targetRoute, { replace: true });
  }, [isAuthenticated, navigate, user, location.state, location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.auth.login(formData.email, formData.password);
      if (response.success) {
        login(response.data.user, response.data.token);
        const targetRoute = resolvePostLoginRoute(response.data.user);
        navigate(targetRoute, { replace: true });
        window.setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.assign(targetRoute);
          }
        }, 0);
      }
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
    setLoading(true);
    try {
      const response = await api.auth.loginWithGoogle(credential);
      if (response.success && response.data?.token) {
        login(response.data.user, response.data.token);
        const targetRoute = resolvePostLoginRoute(response.data.user);
        navigate(targetRoute, { replace: true });
        window.setTimeout(() => {
          if (window.location.pathname === '/login') {
            window.location.assign(targetRoute);
          }
        }, 0);
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

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 md:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-2">
        <div className="relative min-h-[360px] overflow-hidden border border-gray-200 bg-black shadow-sm md:min-h-[640px]">
          <img
            src={authPageSettings.loginHeroImage}
            alt={`${authPageSettings.brandName} login`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20" />
          <p className="absolute left-6 top-5 font-['Oswald'] text-3xl font-bold text-white md:text-4xl">
            {authPageSettings.brandName}
          </p>
          <p className="absolute bottom-6 left-6 pr-6 font-['Oswald'] text-2xl font-medium italic text-white md:text-4xl">
            {authPageSettings.loginHeroCaption}
          </p>
        </div>

        <div className="border border-gray-200 bg-white px-5 py-8 shadow-sm sm:px-8 md:py-10">
          <div className="mx-auto w-full max-w-md space-y-5">
            <Link to="/" className="inline-flex text-sm font-medium text-amber-700 hover:text-amber-800">
              Back to Home
            </Link>
            <div className="text-center">
              <p className="font-['Oswald'] text-4xl font-bold text-black">{authPageSettings.brandName}</p>
              <h2 className="mt-6 font-['Oswald'] text-4xl font-bold text-gray-900">{authPageSettings.loginTitle}</h2>
              <p className="mt-2 text-sm text-gray-600">{authPageSettings.loginSubtitle}</p>
            </div>

            {error ? (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {authPageSettings.showGoogleOnLogin ? (
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
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
                <Link to="/forgot-password" className="text-amber-700 hover:text-amber-800">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="h-11 w-full text-sm" disabled={loading}>
                {loading ? 'Signing in...' : authPageSettings.loginSubmitLabel}
                {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-medium text-amber-700 hover:text-amber-800">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

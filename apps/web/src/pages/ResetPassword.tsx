import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { evaluatePasswordSecurity } from '../utils/passwordSecurity';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => String(params.get('token') || '').trim(), [params]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    const passwordSecurity = evaluatePasswordSecurity(newPassword);
    if (!passwordSecurity.isValid) {
      setError(passwordSecurity.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.auth.resetPassword(token, newPassword);
      setMessage(response?.message || 'Password reset successful.');
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (requestError: any) {
      setError(
        String(
          requestError?.response?.data?.message ||
            requestError?.message ||
            'Unable to reset password right now.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset password</h1>
          <p className="mt-2 text-gray-600">Set a new password for your account.</p>
        </div>

        {!token ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Invalid reset link. Please request a new one from the forgot password page.
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                className="w-full rounded-lg border px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="w-full rounded-lg border px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <PasswordStrengthMeter password={newPassword} />

          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? 'Resetting password...' : (
              <>
                Reset password
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          <Link to="/login" className="font-medium text-amber-600 hover:text-amber-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}


import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.auth.requestPasswordReset(email);
      setMessage(
        response?.message ||
          'If your email exists in our system, a password reset link has been sent.'
      );
    } catch (requestError: any) {
      setError(
        String(
          requestError?.response?.data?.message ||
            requestError?.message ||
            'Unable to send reset link right now.'
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
          <h1 className="text-3xl font-bold text-gray-900">Forgot password</h1>
          <p className="mt-2 text-gray-600">
            Enter your email and we will send a secure reset link.
          </p>
        </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending reset link...' : (
              <>
                Send reset link
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link to="/login" className="font-medium text-amber-600 hover:text-amber-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}


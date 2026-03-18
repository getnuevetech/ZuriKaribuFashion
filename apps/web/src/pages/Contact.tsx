import { useEffect, useState } from 'react';
import { MessageCircle, Phone, Mail, Send } from 'lucide-react';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

const CHAT_SESSION_STORAGE_KEY = 'af_customer_service_chat_session_v1';

export default function ContactPage() {
  const { isAuthenticated } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [languages, setLanguages] = useState<Array<{ code: string; label: string }>>([{ code: 'en', label: 'English' }]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    departmentId: '',
    preferredLanguage: 'en',
    issueType: 'customer-service',
    issueDetails: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.customerService.getPublicConfig();
        const rows = Array.isArray(response?.data?.departments) ? response.data.departments : [];
        const languageRows = Array.isArray(response?.data?.supportedLanguages) ? response.data.supportedLanguages : [];
        setDepartments(rows.map((row: any) => ({ id: String(row.id || ''), name: String(row.name || '') })));
        setLanguages(
          languageRows.length > 0
            ? languageRows.map((row: any) => ({ code: String(row.code || 'en'), label: String(row.label || row.code || 'Language') }))
            : [{ code: 'en', label: 'English' }]
        );
        const defaultLanguage = String(response?.data?.settings?.defaultLanguage || 'en');
        setForm((prev) => ({
          ...prev,
          preferredLanguage: prev.preferredLanguage || defaultLanguage,
          departmentId: prev.departmentId || String(rows[0]?.id || ''),
        }));
      } catch {
        // Keep static defaults if config endpoint is unavailable.
      }
    };
    void load();
  }, []);

  const openChatWidget = (payload?: Record<string, unknown>) => {
    window.dispatchEvent(
      new CustomEvent('af-open-support-chat', {
        detail: payload || {},
      })
    );
  };

  const startChatNow = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.startChat({
        departmentId: form.departmentId || undefined,
        issueType: form.issueType || undefined,
        preferredLanguage: form.preferredLanguage || 'en',
        ...(isAuthenticated
          ? {}
          : {
              name: form.name.trim() || undefined,
              email: form.email.trim() || undefined,
              phone: form.phone.trim() || undefined,
            }),
      });
      const sessionId = String(response?.data?.sessionId || '');
      const token = String(response?.data?.token || '');
      if (!sessionId) throw new Error('Unable to start support chat.');
      window.localStorage.setItem(
        CHAT_SESSION_STORAGE_KEY,
        JSON.stringify({
          sessionId,
          token,
          preferredLanguage: form.preferredLanguage || 'en',
        })
      );
      if (form.issueDetails.trim()) {
        await api.customerService.sendChatMessage(
          sessionId,
          {
            body: form.issueDetails.trim(),
            sourceLanguage: 'auto',
            preferredLanguage: form.preferredLanguage || 'en',
          },
          token || undefined
        );
      }
      setMessage('Live support session started. Opening chat widget now.');
      openChatWidget({
        mode: 'support',
        sessionId,
        token,
        preferredLanguage: form.preferredLanguage || 'en',
      });
    } catch (startError: any) {
      setError(startError?.response?.data?.message || startError?.message || 'Failed to start support chat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="rounded-2xl border bg-white p-8 shadow-sm space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Contact Us</h1>
          <p className="mt-3 text-sm text-gray-600">
            Start support immediately, route to the right department, and communicate in your preferred language.
          </p>
        </div>

        {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <MessageCircle className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">Live Chat</h2>
            <p className="mt-1 text-xs text-gray-600">
              Start support here or from the popup icon. Your messages can be translated to agent/admin preferred language.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <Mail className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">Email Support</h2>
            <p className="mt-1 text-xs text-gray-600">
              Incoming support emails can be converted into tickets and routed through workflow/SLA rules.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <Phone className="h-5 w-5 text-amber-600" />
            <h2 className="mt-2 text-sm font-semibold text-gray-900">VoIP Callback</h2>
            <p className="mt-1 text-xs text-gray-600">
              Agents can start in-app VoIP calls where enabled to avoid costly international phone calls.
            </p>
          </div>
        </div>

        <section className="rounded-xl border bg-gray-50 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Start Live Support Now</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {!isAuthenticated ? (
              <>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Full name"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Email address"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Phone number"
                  className="rounded border px-3 py-2 text-sm md:col-span-2"
                />
              </>
            ) : (
              <p className="rounded border bg-white px-3 py-2 text-xs text-gray-600 md:col-span-2">
                You are signed in. Contact details from your account will be used automatically.
              </p>
            )}
            <select
              value={form.departmentId}
              onChange={(event) => setForm((prev) => ({ ...prev, departmentId: event.target.value }))}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              value={form.preferredLanguage}
              onChange={(event) => setForm((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
              className="rounded border px-3 py-2 text-sm"
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  Preferred language: {language.label}
                </option>
              ))}
            </select>
            <input
              value={form.issueType}
              onChange={(event) => setForm((prev) => ({ ...prev, issueType: event.target.value }))}
              placeholder="Issue type (customer service / track order / refund)"
              className="rounded border px-3 py-2 text-sm md:col-span-2"
            />
            <textarea
              value={form.issueDetails}
              onChange={(event) => setForm((prev) => ({ ...prev, issueDetails: event.target.value }))}
              rows={4}
              placeholder="Briefly describe your request"
              className="rounded border px-3 py-2 text-sm md:col-span-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startChatNow()} disabled={saving}>
              <Send className="mr-2 h-4 w-4" />
              {saving ? 'Starting...' : 'Start Live Support Chat'}
            </Button>
            <Button variant="outline" onClick={() => openChatWidget({ mode: 'support' })}>
              Open Chat Popup
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

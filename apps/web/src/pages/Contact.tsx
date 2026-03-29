import { useEffect, useState } from 'react';
import { ArrowRight, Mail, MessageCircle, Phone, Send } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/jenks-v2.css';

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
            ? languageRows.map((row: any) => ({
                code: String(row.code || 'en'),
                label: String(row.label || row.code || 'Language'),
              }))
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
    <div className="kimi-site min-h-screen bg-[#f4f2ed] text-[#111]">
      <section className="border-b border-black/10 bg-[#0c0c0d] py-16 text-white">
        <div className="mx-auto w-full max-w-[1700px] px-4 sm:px-6 lg:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Support</p>
          <h1 className="mt-3 font-['Oswald'] text-5xl font-bold uppercase leading-[0.92] sm:text-6xl">Contact Jenks</h1>
          <p className="mt-4 max-w-2xl text-sm text-white/75 sm:text-base">
            Start support immediately, route to the correct team, and communicate in your preferred language.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1700px] space-y-8 px-4 py-10 sm:px-6 lg:px-12">
        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="border border-black/10 bg-white p-5">
            <MessageCircle className="h-5 w-5 text-[#e66045]" />
            <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.08em]">Live Chat</h2>
            <p className="mt-2 text-xs text-black/60">
              Start support here or from the popup icon. Messages can be translated for agent and admin workflows.
            </p>
          </article>
          <article className="border border-black/10 bg-white p-5">
            <Mail className="h-5 w-5 text-[#e66045]" />
            <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.08em]">Email Support</h2>
            <p className="mt-2 text-xs text-black/60">
              Incoming email issues can be converted into tickets and routed through SLA and department rules.
            </p>
          </article>
          <article className="border border-black/10 bg-white p-5">
            <Phone className="h-5 w-5 text-[#e66045]" />
            <h2 className="mt-3 text-sm font-semibold uppercase tracking-[0.08em]">VoIP Callback</h2>
            <p className="mt-2 text-xs text-black/60">
              Where enabled, support agents can initiate in-app calls to resolve complex issues quickly.
            </p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="border border-black/10 bg-white p-6 sm:p-8">
            <h2 className="font-['Oswald'] text-3xl font-bold uppercase">Start Live Support Now</h2>
            <p className="mt-2 text-sm text-black/60">
              This form is connected to your admin-controlled customer service configuration (departments and languages).
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {!isAuthenticated ? (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Full Name</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Full name"
                      className="h-10 w-full border border-black/15 px-3 text-sm outline-none focus:border-black/40"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Email Address</span>
                    <input
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="Email address"
                      className="h-10 w-full border border-black/15 px-3 text-sm outline-none focus:border-black/40"
                    />
                  </label>
                  <label className="text-sm md:col-span-2">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Phone Number</span>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                      placeholder="Phone number"
                      className="h-10 w-full border border-black/15 px-3 text-sm outline-none focus:border-black/40"
                    />
                  </label>
                </>
              ) : (
                <p className="border border-black/10 bg-[#f7f5ef] px-3 py-2 text-xs text-black/65 md:col-span-2">
                  You are signed in. Contact details from your account will be used automatically.
                </p>
              )}

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Department</span>
                <select
                  value={form.departmentId}
                  onChange={(event) => setForm((prev) => ({ ...prev, departmentId: event.target.value }))}
                  className="h-10 w-full border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Preferred Language</span>
                <select
                  value={form.preferredLanguage}
                  onChange={(event) => setForm((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
                  className="h-10 w-full border border-black/15 bg-white px-3 text-sm outline-none focus:border-black/40"
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Issue Type</span>
                <input
                  value={form.issueType}
                  onChange={(event) => setForm((prev) => ({ ...prev, issueType: event.target.value }))}
                  placeholder="customer service / track order / refund"
                  className="h-10 w-full border border-black/15 px-3 text-sm outline-none focus:border-black/40"
                />
              </label>

              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-black/65">Issue Details</span>
                <textarea
                  value={form.issueDetails}
                  onChange={(event) => setForm((prev) => ({ ...prev, issueDetails: event.target.value }))}
                  rows={5}
                  placeholder="Briefly describe your request"
                  className="w-full border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void startChatNow()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 border border-black bg-black px-4 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#181818] disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {saving ? 'Starting...' : 'Start Live Support Chat'}
              </button>
              <button
                type="button"
                onClick={() => openChatWidget({ mode: 'support' })}
                className="inline-flex h-10 items-center gap-2 border border-black/20 bg-white px-4 text-xs font-semibold uppercase tracking-[0.1em] text-black/75 hover:border-black/45"
              >
                Open Chat Popup
              </button>
            </div>
          </div>

          <aside className="border border-black/10 bg-[#0f0f11] p-6 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Need immediate help?</p>
            <h3 className="mt-3 font-['Oswald'] text-3xl font-bold uppercase leading-[0.95]">
              Talk to our support team
            </h3>
            <p className="mt-4 text-sm text-white/70">
              If you already started a chat session, reopen the widget and continue your conversation.
            </p>
            <button
              type="button"
              onClick={() => openChatWidget({ mode: 'support' })}
              className="mt-6 inline-flex items-center gap-2 border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:border-white"
            >
              Open support widget
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </aside>
        </section>
      </div>
    </div>
  );
}

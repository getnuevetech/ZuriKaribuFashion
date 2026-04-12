import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, ShoppingBag, Paperclip, ChevronDown, Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const STORAGE_KEY = 'af_customer_service_chat_session_v1';
const SHOPPING_STORAGE_KEY = 'af_customer_service_shopping_chat_v1';
const OPEN_CHAT_EVENT = 'af-open-support-chat';

type SupportedLanguage = { code: string; label: string };
type Department = { id: string; name: string; code: string; description?: string };

function parseCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const needle = `${name}=`;
  const cookie = document.cookie.split(';').map((row) => row.trim()).find((row) => row.startsWith(needle));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice(needle.length));
  } catch {
    // Malformed cookie values should never crash chat rendering.
    return cookie.slice(needle.length);
  }
}

function safeReadLocalStorage(key: string) {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage quota/privacy errors
  }
}

export default function CustomerServiceChatWidget() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'support' | 'shopping'>('support');
  const [config, setConfig] = useState<any>(null);
  const [languages, setLanguages] = useState<SupportedLanguage[]>([{ code: 'en', label: 'English' }]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');

  const [sessionId, setSessionId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [messageSourceLanguage, setMessageSourceLanguage] = useState('auto');
  const [departmentId, setDepartmentId] = useState('');
  const [issueType, setIssueType] = useState('customer-service');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [thread, setThread] = useState<any>(null);
  const [composer, setComposer] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const [shoppingMessages, setShoppingMessages] = useState<
    Array<{ id: string; from: 'BOT' | 'USER'; text: string; suggestions?: any[] }>
  >([]);
  const [shoppingComposer, setShoppingComposer] = useState('');

  const pollRef = useRef<number | null>(null);

  const isDashboardPath = useMemo(() => /^\/(admin|seller|designer|qa|reseller|dashboard|orders|profile|measurements)/i.test(location.pathname), [location.pathname]);

  const avatarGender = useMemo(() => {
    const cookieGender = parseCookie('customer_gender').toLowerCase();
    if (cookieGender.includes('female') || cookieGender === 'f') return 'female';
    if (cookieGender.includes('male') || cookieGender === 'm') return 'male';
    return 'female';
  }, []);

  const shoppingAvatar = useMemo(() => {
    const female = String(config?.settings?.shoppingBotAvatarFemale || '').trim();
    const male = String(config?.settings?.shoppingBotAvatarMale || '').trim();
    if (avatarGender === 'male' && male) return male;
    if (avatarGender === 'female' && female) return female;
    return '';
  }, [avatarGender, config?.settings?.shoppingBotAvatarFemale, config?.settings?.shoppingBotAvatarMale]);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.customerService.getPublicConfig();
      const data = response?.data || null;
      setConfig(data);
      setLanguages(Array.isArray(data?.supportedLanguages) && data.supportedLanguages.length > 0 ? data.supportedLanguages : [{ code: 'en', label: 'English' }]);
      setDepartments(Array.isArray(data?.departments) ? data.departments : []);
      const defaultLanguage = String(data?.settings?.defaultLanguage || 'en');
      setPreferredLanguage((current) => current || defaultLanguage);
      if (!departmentId && Array.isArray(data?.departments) && data.departments[0]?.id) {
        setDepartmentId(String(data.departments[0].id));
      }
    } catch (configError: any) {
      setError(configError?.response?.data?.message || 'Failed to load chat configuration.');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (nextSessionId = sessionId, token = sessionToken) => {
    if (!nextSessionId) return;
    try {
      const response = await api.customerService.getChatThread(
        nextSessionId,
        { preferredLanguage },
        token || undefined
      );
      setThread(response?.data || null);
    } catch (threadError: any) {
      setError(threadError?.response?.data?.message || 'Failed to load chat thread.');
    }
  };

  useEffect(() => {
    if (isDashboardPath) return;
    void loadConfig();
    try {
      const sessionSnapshot = JSON.parse(safeReadLocalStorage(STORAGE_KEY) || '{}');
      const restoredSessionId = String(sessionSnapshot?.sessionId || '');
      const restoredToken = String(sessionSnapshot?.token || '');
      const restoredLanguage = String(sessionSnapshot?.preferredLanguage || '');
      if (restoredSessionId) {
        setSessionId(restoredSessionId);
        setSessionToken(restoredToken);
        if (restoredLanguage) setPreferredLanguage(restoredLanguage);
      }
      const shoppingSnapshot = JSON.parse(safeReadLocalStorage(SHOPPING_STORAGE_KEY) || '{}');
      if (Array.isArray(shoppingSnapshot?.messages)) {
        setShoppingMessages(shoppingSnapshot.messages);
      }
    } catch {
      // ignore storage parse errors
    }
  }, [isDashboardPath]);

  useEffect(() => {
    if (isDashboardPath) return;
    const handler = (event: Event) => {
      try {
        const detail = (event as CustomEvent)?.detail || {};
        const nextMode = String((detail as any)?.mode || 'support').trim().toLowerCase();
        setOpen(true);
        setMode(nextMode === 'shopping' ? 'shopping' : 'support');
        const nextDepartmentId = String((detail as any)?.departmentId || '').trim();
        const nextIssueType = String((detail as any)?.issueType || '').trim();
        const nextLanguage = String((detail as any)?.preferredLanguage || '').trim().toLowerCase();
        const nextSessionId = String((detail as any)?.sessionId || '').trim();
        const nextToken = String((detail as any)?.token || '').trim();
        const nextName = String((detail as any)?.name || '').trim();
        const nextEmail = String((detail as any)?.email || '').trim();
        const nextPhone = String((detail as any)?.phone || '').trim();
        if (nextDepartmentId) setDepartmentId(nextDepartmentId);
        if (nextIssueType) setIssueType(nextIssueType);
        if (nextLanguage) setPreferredLanguage(nextLanguage);
        if (nextName) setGuestName(nextName);
        if (nextEmail) setGuestEmail(nextEmail);
        if (nextPhone) setGuestPhone(nextPhone);
        if (nextSessionId) {
          setSessionId(nextSessionId);
          setSessionToken(nextToken);
        }
      } catch {
        // ignore malformed custom event payloads
      }
    };
    window.addEventListener(OPEN_CHAT_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler as EventListener);
  }, [isDashboardPath]);

  useEffect(() => {
    if (isDashboardPath) return;
    if (!sessionId) return;
    void loadThread();
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      void loadThread();
    }, 10000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [sessionId, preferredLanguage, isDashboardPath]);

  useEffect(() => {
    if (isDashboardPath) return;
    if (!config?.settings?.shoppingBotEnabled && !config?.settings?.serviceBotEnabled) return;
    const delayMinutes = Number(config?.settings?.shoppingBotDelayMinutes || 3);
    const timer = window.setTimeout(() => {
      setOpen(true);
      setMode('shopping');
      if (shoppingMessages.length === 0) {
        setShoppingMessages([
          {
            id: `bot-${Date.now()}`,
            from: 'BOT',
            text: 'Hi! I can help you find products. Tell me what you are looking for (style, fabric, color, budget).',
          },
        ]);
      }
    }, Math.max(0, delayMinutes) * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [config?.settings?.shoppingBotDelayMinutes, config?.settings?.shoppingBotEnabled, config?.settings?.serviceBotEnabled, shoppingMessages.length, isDashboardPath]);

  useEffect(() => {
    if (sessionId) {
      safeWriteLocalStorage(
        STORAGE_KEY,
        JSON.stringify({
          sessionId,
          token: sessionToken,
          preferredLanguage,
        })
      );
    }
  }, [sessionId, sessionToken, preferredLanguage]);

  useEffect(() => {
    safeWriteLocalStorage(
      SHOPPING_STORAGE_KEY,
      JSON.stringify({
        messages: shoppingMessages.slice(-40),
      })
    );
  }, [shoppingMessages]);

  const startSupportChat = async () => {
    setError('');
    try {
      const response = await api.customerService.startChat({
        departmentId: departmentId || undefined,
        issueType: issueType || undefined,
        preferredLanguage,
        ...(isAuthenticated
          ? {}
          : {
              name: guestName.trim() || undefined,
              email: guestEmail.trim() || undefined,
              phone: guestPhone.trim() || undefined,
            }),
      });
      const newSessionId = String(response?.data?.sessionId || '');
      const newToken = String(response?.data?.token || '');
      if (!newSessionId) throw new Error('Unable to start support chat session.');
      setSessionId(newSessionId);
      setSessionToken(newToken);
      await loadThread(newSessionId, newToken);
    } catch (startError: any) {
      setError(startError?.response?.data?.message || startError?.message || 'Failed to start support chat.');
    }
  };

  const uploadAttachment = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const upload = await api.upload.file(formData);
      const url = String(upload?.data?.url || '').trim();
      if (url) {
        setAttachments((prev) => [...prev, url]);
      }
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const sendSupportMessage = async () => {
    if (!sessionId || !composer.trim()) return;
    setError('');
    try {
      await api.customerService.sendChatMessage(
        sessionId,
        {
          body: composer.trim(),
          sourceLanguage: messageSourceLanguage === 'auto' ? 'auto' : messageSourceLanguage,
          preferredLanguage,
          attachments,
        },
        sessionToken || undefined
      );
      setComposer('');
      setAttachments([]);
      await loadThread();
    } catch (sendError: any) {
      setError(sendError?.response?.data?.message || 'Failed to send message.');
    }
  };

  const sendShoppingMessage = async () => {
    if (!shoppingComposer.trim()) return;
    const text = shoppingComposer.trim();
    setShoppingComposer('');
    setShoppingMessages((prev) => [...prev, { id: `user-${Date.now()}`, from: 'USER', text }]);
    try {
      const response = await api.customerService.botRespond({
        mode: 'SHOPPING',
        message: text,
        preferredLanguage,
        genderHint: avatarGender,
        contextPaths: [location.pathname],
      });
      setShoppingMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          from: 'BOT',
          text: String(response?.data?.reply || 'Here are some suggestions based on your request.'),
          suggestions: Array.isArray(response?.data?.suggestions) ? response.data.suggestions : [],
        },
      ]);
    } catch (botError: any) {
      setShoppingMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          from: 'BOT',
          text: botError?.response?.data?.message || 'I could not fetch suggestions right now. Try again shortly.',
        },
      ]);
    }
  };

  if (isDashboardPath) return null;
  const accentColor = 'var(--accent, #8a63f8)';
  const panelGradient = `linear-gradient(120deg, ${accentColor} 0%, #77c5ff 100%)`;
  const fieldClass =
    'w-full rounded-[18px] border border-[#e6e9f0] bg-white px-4 py-3 text-sm text-[#20263a] shadow-[0_6px_20px_rgba(31,42,61,0.08)] focus:outline-none focus:ring-2 focus:ring-[var(--accent,#8a63f8)]/20';
  const issueOptions = [
    { value: 'customer-service', label: 'Customer Service' },
    { value: 'track-order', label: 'Track Order' },
    { value: 'account-refund', label: 'Account / Refund' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-[60] inline-flex items-center justify-center rounded-full transition-all ${
          open
            ? 'h-16 w-16 border border-[#e3e6ee] bg-[#edf0f6] text-[#97a0af] shadow-[0_16px_30px_rgba(34,45,67,0.18)]'
            : 'h-14 w-14 text-white shadow-[0_18px_40px_rgba(34,45,67,0.35)]'
        }`}
        style={open ? undefined : { background: panelGradient }}
        aria-label="Open customer service chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open ? (
        <div className="fixed bottom-28 right-5 z-[60] w-[370px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[34px] border border-[#d9deea] bg-[#f5f7fc] shadow-[0_30px_70px_rgba(20,28,48,0.26)]">
          <div className="px-4 pb-4 pt-5 text-white" style={{ background: panelGradient }}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-white/20 p-0.5 shadow-[0_6px_16px_rgba(0,0,0,0.2)]">
                {shoppingAvatar ? (
                  <img src={shoppingAvatar} alt="Shopping assistant avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white/20 text-lg font-semibold text-white">Z</div>
                )}
              </div>
              <div>
                <p className="text-[52px] leading-none font-semibold tracking-tight text-white">Zuri</p>
              </div>
            </div>
          </div>

          <div className="mx-4 mt-[-14px] flex items-center gap-3 rounded-[30px] bg-[#f8f9fc] p-2 shadow-[0_8px_24px_rgba(15,23,42,0.11)]">
            <button
              type="button"
              onClick={() => setMode('support')}
              className={`inline-flex min-h-[46px] flex-1 items-center justify-center gap-1 rounded-full px-4 py-2 text-[15px] font-semibold transition ${
                mode === 'support'
                  ? 'bg-white text-[#1f2433] shadow-[0_8px_20px_rgba(41,54,79,0.14)] ring-1 ring-[#e2e7f0]'
                  : 'bg-transparent text-[#9ca3af] hover:text-[#545f73]'
              }`}
            >
              <Bot className="h-4 w-4" />
              Support Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('shopping')}
              className={`inline-flex min-h-[46px] flex-1 items-center justify-center gap-1 rounded-full px-4 py-2 text-[15px] font-semibold transition ${
                mode === 'shopping'
                  ? 'bg-white text-[#1f2433] shadow-[0_8px_20px_rgba(41,54,79,0.14)] ring-1 ring-[#e2e7f0]'
                  : 'bg-transparent text-[#9ca3af] hover:text-[#545f73]'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Shopping Bot
            </button>
          </div>

          {error ? <div className="border-b bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

          {mode === 'support' ? (
            <div className="space-y-3 p-3">
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading support settings...</div>
              ) : !sessionId ? (
                <div className="space-y-3 p-1">
                  {isAuthenticated ? (
                    <div className="flex items-center gap-3 rounded-[18px] border border-[#e6e9f0] bg-white px-4 py-3 text-[17px] text-[#6b7383] shadow-[0_6px_20px_rgba(31,42,61,0.08)]">
                      <span className="h-3 w-3 rounded-full bg-[#61c46b]" />
                      <span>Logged in as {user?.firstName || user?.email}</span>
                    </div>
                  ) : (
                    <>
                      <input
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Your name"
                        className={fieldClass}
                      />
                      <input
                        value={guestEmail}
                        onChange={(event) => setGuestEmail(event.target.value)}
                        placeholder="Your email"
                        className={fieldClass}
                      />
                      <input
                        value={guestPhone}
                        onChange={(event) => setGuestPhone(event.target.value)}
                        placeholder="Your phone"
                        className={fieldClass}
                      />
                    </>
                  )}
                  {departments.length > 0 ? (
                    <div className="relative">
                      <select
                        value={departmentId}
                        onChange={(event) => setDepartmentId(event.target.value)}
                        className={`${fieldClass} appearance-none pr-10`}
                      >
                        <option value="">Select department</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    </div>
                  ) : null}
                  <div className="relative">
                    <select
                      value={issueType}
                      onChange={(event) => setIssueType(event.target.value)}
                      className={`${fieldClass} appearance-none pr-10`}
                    >
                      {issueOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  </div>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b0b7c4]" />
                    <select
                      value={preferredLanguage}
                      onChange={(event) => setPreferredLanguage(event.target.value)}
                      className={`${fieldClass} appearance-none pl-11 pr-10`}
                    >
                      {languages.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                  </div>
                  <div className="h-[62px] rounded-[20px] bg-[#e6e9ef]" />
                  <button
                    type="button"
                    onClick={() => void startSupportChat()}
                    className="inline-flex min-h-[64px] w-full items-center justify-center rounded-full px-6 text-[20px] font-semibold text-white shadow-[0_16px_34px_rgba(83,119,237,0.35)]"
                    style={{ background: panelGradient }}
                  >
                    Start Support Chat
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-1">
                  <div className="max-h-[320px] space-y-2 overflow-auto rounded-[22px] border border-[#e6e9f0] bg-white p-3 shadow-[0_10px_24px_rgba(31,42,61,0.08)]">
                    {Array.isArray(thread?.messages) && thread.messages.length > 0 ? (
                      thread.messages.map((row: any) => {
                        const isCustomer = row.senderRole === 'CUSTOMER';
                        return (
                          <div
                            key={row.id}
                            className={`rounded-[16px] border px-3 py-2 ${
                              isCustomer ? 'ml-8 border-[#d9e5ff] bg-[#eef4ff]' : 'mr-8 border-[#f3e4cb] bg-[#fff6e7]'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-[#7b8496]">
                              <span>{row.senderDisplayName || row.senderRole || 'Agent'}</span>
                              <span>{row.createdAt ? new Date(row.createdAt).toLocaleTimeString() : ''}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#252c3c]">{row.body || ''}</p>
                            {row?.translated ? (
                              <p className="mt-1 text-[11px] text-[#8a93a6]">
                                Translated from {String(row.sourceLanguage || '').toUpperCase()} to{' '}
                                {String(row.translatedToLanguage || '').toUpperCase()}
                              </p>
                            ) : null}
                            {Array.isArray(row.attachments) && row.attachments.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {row.attachments.map((url: string) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-[#d7def2] bg-white px-2.5 py-1 text-[11px] text-[#415272] hover:border-[var(--accent,#8a63f8)]"
                                  >
                                    Attachment
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-6 text-center text-xs text-[#8c95a7]">No messages yet.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <select
                        value={preferredLanguage}
                        onChange={(event) => setPreferredLanguage(event.target.value)}
                        className={`${fieldClass} appearance-none pr-10 text-xs`}
                      >
                        {languages.map((language) => (
                          <option key={language.code} value={language.code}>
                            View: {language.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    </div>
                    <div className="relative">
                      <select
                        value={messageSourceLanguage}
                        onChange={(event) => setMessageSourceLanguage(event.target.value)}
                        className={`${fieldClass} appearance-none pr-10 text-xs`}
                      >
                        <option value="auto">Message language: Auto detect</option>
                        {languages.map((language) => (
                          <option key={language.code} value={language.code}>
                            Message language: {language.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      rows={3}
                      placeholder="Type your message..."
                      className={`${fieldClass} min-h-[86px] flex-1 resize-none`}
                    />
                    <label className="inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full border border-[#d9deea] bg-white text-[#697284] shadow-[0_6px_20px_rgba(31,42,61,0.12)] hover:text-[var(--accent,#8a63f8)]">
                      <Paperclip className="h-4 w-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadAttachment(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void sendSupportMessage()}
                      className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full text-white shadow-[0_12px_24px_rgba(83,119,237,0.35)] disabled:opacity-50"
                      style={{ background: panelGradient }}
                      disabled={!composer.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  {uploading ? <p className="text-[11px] text-[#7f8798]">Uploading attachment...</p> : null}
                  {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((entry) => entry !== url))}
                          className="rounded-full border border-[#d7def2] bg-white px-2.5 py-1 text-[11px] text-[#52607f]"
                        >
                          Attached file ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 p-3">
              <div className="max-h-[320px] space-y-2 overflow-auto rounded-[22px] border border-[#e6e9f0] bg-white p-3 shadow-[0_10px_24px_rgba(31,42,61,0.08)]">
                {shoppingMessages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#8c95a7]">Ask the shopping bot to recommend products.</p>
                ) : (
                  shoppingMessages.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-[16px] border px-3 py-2 ${
                        row.from === 'USER' ? 'ml-8 border-[#d9e5ff] bg-[#eef4ff]' : 'mr-8 border-[#f3e4cb] bg-[#fff6e7]'
                      }`}
                    >
                      <p className="text-[11px] text-[#7b8496]">{row.from === 'USER' ? 'You' : 'Shopping Bot'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#252c3c]">{row.text}</p>
                      {Array.isArray(row.suggestions) && row.suggestions.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {row.suggestions.map((item: any) => (
                            <a
                              key={`${item.type}-${item.id}`}
                              href={String(item.href || '#')}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-[12px] border border-[#d7def2] bg-white px-3 py-2 text-xs text-[#374564] hover:border-[var(--accent,#8a63f8)]"
                            >
                              {item.type} • {item.name} • ${Number(item.price || 0).toFixed(2)}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={shoppingComposer}
                  onChange={(event) => setShoppingComposer(event.target.value)}
                  rows={3}
                  placeholder="Describe what you want to shop for..."
                  className={`${fieldClass} min-h-[86px] flex-1 resize-none`}
                />
                <button
                  type="button"
                  onClick={() => void sendShoppingMessage()}
                  className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full text-white shadow-[0_12px_24px_rgba(83,119,237,0.35)] disabled:opacity-50"
                  style={{ background: panelGradient }}
                  disabled={!shoppingComposer.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

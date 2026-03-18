import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, ShoppingBag, Paperclip } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const STORAGE_KEY = 'af_customer_service_chat_session_v1';
const SHOPPING_STORAGE_KEY = 'af_customer_service_shopping_chat_v1';

type SupportedLanguage = { code: string; label: string };
type Department = { id: string; name: string; code: string; description?: string };

function parseCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const needle = `${name}=`;
  const cookie = document.cookie.split(';').map((row) => row.trim()).find((row) => row.startsWith(needle));
  return cookie ? decodeURIComponent(cookie.slice(needle.length)) : '';
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
      const sessionSnapshot = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      const restoredSessionId = String(sessionSnapshot?.sessionId || '');
      const restoredToken = String(sessionSnapshot?.token || '');
      const restoredLanguage = String(sessionSnapshot?.preferredLanguage || '');
      if (restoredSessionId) {
        setSessionId(restoredSessionId);
        setSessionToken(restoredToken);
        if (restoredLanguage) setPreferredLanguage(restoredLanguage);
      }
      const shoppingSnapshot = JSON.parse(window.localStorage.getItem(SHOPPING_STORAGE_KEY) || '{}');
      if (Array.isArray(shoppingSnapshot?.messages)) {
        setShoppingMessages(shoppingSnapshot.messages);
      }
    } catch {
      // ignore storage parse errors
    }
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
      window.localStorage.setItem(
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
    window.localStorage.setItem(
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-xl hover:bg-gray-900"
        aria-label="Open customer service chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open ? (
        <div className="fixed bottom-24 right-5 z-[60] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                {shoppingAvatar ? (
                  <img src={shoppingAvatar} alt="Shopping assistant avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-600">BOT</div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">ZuriKaribu Assistant</p>
                <p className="text-[11px] text-gray-500">Live support + shopping helper</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-gray-600 hover:bg-gray-100"
              aria-label="Close chat widget"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-b px-3 py-2">
            <button
              type="button"
              onClick={() => setMode('support')}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                mode === 'support' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              Support Chat
            </button>
            <button
              type="button"
              onClick={() => setMode('shopping')}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                mode === 'shopping' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Shopping Bot
            </button>
          </div>

          {error ? <div className="border-b bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

          {mode === 'support' ? (
            <div className="space-y-3 p-3">
              {loading ? (
                <div className="py-8 text-center text-xs text-gray-500">Loading support settings...</div>
              ) : !sessionId ? (
                <div className="space-y-2">
                  {!isAuthenticated ? (
                    <>
                      <input
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Your name"
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                      <input
                        value={guestEmail}
                        onChange={(event) => setGuestEmail(event.target.value)}
                        placeholder="Your email"
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                      <input
                        value={guestPhone}
                        onChange={(event) => setGuestPhone(event.target.value)}
                        placeholder="Your phone"
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </>
                  ) : (
                    <p className="rounded border bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      Logged in as {user?.firstName || user?.email}. Contact info is already available.
                    </p>
                  )}
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={issueType}
                    onChange={(event) => setIssueType(event.target.value)}
                    placeholder="Issue type (track order, account/refund, etc.)"
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                  <select
                    value={preferredLanguage}
                    onChange={(event) => setPreferredLanguage(event.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  >
                    {languages.map((language) => (
                      <option key={language.code} value={language.code}>
                        Preferred language: {language.label}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => void startSupportChat()}>Start Support Chat</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-[280px] space-y-2 overflow-auto rounded border bg-gray-50 p-2">
                    {Array.isArray(thread?.messages) && thread.messages.length > 0 ? (
                      thread.messages.map((row: any) => (
                        <div key={row.id} className={`rounded border p-2 ${row.senderRole === 'CUSTOMER' ? 'bg-white' : 'bg-amber-50'}`}>
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>{row.senderDisplayName || row.senderRole || 'Agent'}</span>
                            <span>{row.createdAt ? new Date(row.createdAt).toLocaleTimeString() : ''}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{row.body || ''}</p>
                          {row?.translated ? (
                            <p className="mt-1 text-[11px] text-gray-500">
                              Translated from {String(row.sourceLanguage || '').toUpperCase()} to{' '}
                              {String(row.translatedToLanguage || '').toUpperCase()}
                            </p>
                          ) : null}
                          {Array.isArray(row.attachments) && row.attachments.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {row.attachments.map((url: string) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline">
                                  Attachment
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">No messages yet.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={preferredLanguage}
                      onChange={(event) => setPreferredLanguage(event.target.value)}
                      className="rounded border px-2 py-2 text-xs"
                    >
                      {languages.map((language) => (
                        <option key={language.code} value={language.code}>
                          View: {language.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={messageSourceLanguage}
                      onChange={(event) => setMessageSourceLanguage(event.target.value)}
                      className="rounded border px-2 py-2 text-xs"
                    >
                      <option value="auto">Message language: Auto detect</option>
                      {languages.map((language) => (
                        <option key={language.code} value={language.code}>
                          Message language: {language.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      rows={3}
                      placeholder="Type your message..."
                      className="flex-1 rounded border px-3 py-2 text-sm"
                    />
                    <label className="inline-flex cursor-pointer items-center justify-center rounded border px-2 py-2 text-gray-600 hover:bg-gray-50">
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
                      className="inline-flex items-center justify-center rounded bg-black px-3 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
                      disabled={!composer.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  {uploading ? <p className="text-[11px] text-gray-500">Uploading attachment...</p> : null}
                  {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((entry) => entry !== url))}
                          className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-700"
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
            <div className="space-y-2 p-3">
              <div className="max-h-[320px] space-y-2 overflow-auto rounded border bg-gray-50 p-2">
                {shoppingMessages.length === 0 ? (
                  <p className="text-xs text-gray-500">Ask the shopping bot to recommend products.</p>
                ) : (
                  shoppingMessages.map((row) => (
                    <div key={row.id} className={`rounded border p-2 ${row.from === 'USER' ? 'bg-white' : 'bg-amber-50'}`}>
                      <p className="text-[11px] text-gray-500">{row.from === 'USER' ? 'You' : 'Shopping Bot'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{row.text}</p>
                      {Array.isArray(row.suggestions) && row.suggestions.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {row.suggestions.map((item: any) => (
                            <a
                              key={`${item.type}-${item.id}`}
                              href={String(item.href || '#')}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded border bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
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
              <div className="flex gap-2">
                <textarea
                  value={shoppingComposer}
                  onChange={(event) => setShoppingComposer(event.target.value)}
                  rows={3}
                  placeholder="Describe what you want to shop for..."
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void sendShoppingMessage()}
                  className="inline-flex items-center justify-center rounded bg-black px-3 py-2 text-white hover:bg-gray-900 disabled:opacity-50"
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

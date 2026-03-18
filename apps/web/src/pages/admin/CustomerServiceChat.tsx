import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Send, UserPlus, ArrowRightLeft, Eye, EyeOff, PhoneCall, Paperclip } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ChatSession = {
  id: string;
  status: string;
  departmentName?: string;
  issueType?: string;
  source?: string;
  guestName?: string;
  guestEmail?: string;
  assignedAdminUserId?: string | null;
  preferredLanguage?: string;
  updatedAt?: string;
};

export default function AdminCustomerServiceChat() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [thread, setThread] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [viewerLanguage, setViewerLanguage] = useState('en');
  const [messageSourceLanguage, setMessageSourceLanguage] = useState('auto');
  const [supportedLanguages, setSupportedLanguages] = useState<Array<{ code: string; label: string }>>([
    { code: 'en', label: 'English' },
  ]);
  const [targetUserId, setTargetUserId] = useState('');
  const [participantIdForVisibility, setParticipantIdForVisibility] = useState('');
  const [messageBanner, setMessageBanner] = useState('');
  const [error, setError] = useState('');

  const selectedSession = useMemo(
    () => sessions.find((row) => row.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const loadSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.customerService.listAdminChats({
        status: statusFilter || undefined,
        search: search || undefined,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setSessions(rows);
      if (!selectedSessionId && rows[0]?.id) {
        setSelectedSessionId(String(rows[0].id));
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load customer service chats.');
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const response = await api.customerService.getChatThread(sessionId, {
        preferredLanguage: viewerLanguage || undefined,
      });
      const data = response?.data || null;
      setThread(data);
      const languages = Array.isArray(data?.language?.supportedLanguages) ? data.language.supportedLanguages : [];
      if (languages.length > 0) {
        setSupportedLanguages(languages.map((row: any) => ({ code: String(row.code || 'en'), label: String(row.label || row.code || 'Language') })));
      }
      const preferred = String(data?.language?.viewerPreferredLanguage || '').trim().toLowerCase();
      if (preferred) setViewerLanguage(preferred);
    } catch (threadError: any) {
      setThread(null);
      setError(threadError?.response?.data?.message || 'Failed to load chat thread.');
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      void loadThread(selectedSessionId);
    } else {
      setThread(null);
    }
  }, [selectedSessionId, viewerLanguage]);

  const refreshAll = async () => {
    await loadSessions();
    if (selectedSessionId) {
      await loadThread(selectedSessionId);
    }
  };

  const sendReply = async () => {
    if (!selectedSessionId || !reply.trim()) return;
    setSaving(true);
    setError('');
    setMessageBanner('');
    try {
      await api.customerService.sendChatMessage(selectedSessionId, {
        body: reply.trim(),
        sourceLanguage: messageSourceLanguage || 'auto',
        preferredLanguage: viewerLanguage || 'en',
        attachments: replyAttachments,
      });
      setReply('');
      setReplyAttachments([]);
      setMessageBanner('Reply sent.');
      await loadThread(selectedSessionId);
      await loadSessions();
    } catch (sendError: any) {
      setError(sendError?.response?.data?.message || 'Failed to send chat reply.');
    } finally {
      setSaving(false);
    }
  };

  const uploadAttachment = async (file: File | null) => {
    if (!file) return;
    setUploadingAttachment(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.upload.file(formData);
      const url = String(response?.data?.url || '').trim();
      if (url) {
        setReplyAttachments((prev) => Array.from(new Set([...prev, url])).slice(0, 12));
      }
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || 'Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const runAction = async (payload: Record<string, unknown>) => {
    if (!selectedSessionId) return;
    setSaving(true);
    setError('');
    setMessageBanner('');
    try {
      await api.customerService.applyAdminChatAction(selectedSessionId, payload);
      setMessageBanner('Action applied.');
      await refreshAll();
    } catch (actionError: any) {
      setError(actionError?.response?.data?.message || 'Failed to apply action.');
    } finally {
      setSaving(false);
    }
  };

  const startCall = async () => {
    if (!selectedSessionId) return;
    try {
      const response = await api.customerService.startVoipCall({
        contextType: 'CHAT',
        contextId: selectedSessionId,
      });
      if (response?.data?.callLink) {
        window.open(response.data.callLink, '_blank', 'noopener,noreferrer');
      }
    } catch (callError: any) {
      setError(callError?.response?.data?.message || 'Failed to start chat call.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Customer Service Live Chat</h1>
          <p className="text-sm text-gray-600">
            Handle live chat sessions, add supervisors, transfer ownership, escalate, and run in-app VoIP calls.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshAll()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {messageBanner ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{messageBanner}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chat..."
              className="col-span-2 rounded border px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="PENDING">PENDING</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <Button variant="outline" onClick={() => void loadSessions()}>
              Filter
            </Button>
          </div>

          <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">No chat sessions found.</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded border px-3 py-2 text-left ${
                    selectedSessionId === session.id ? 'border-black bg-gray-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {session.guestName || session.guestEmail || session.id}
                    </p>
                    <span className="text-[10px] text-gray-500">{session.status}</span>
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {session.departmentName || 'Department not set'} • {session.issueType || 'General'}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    {session.updatedAt ? new Date(session.updatedAt).toLocaleString() : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4">
          {selectedSession && thread ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedSession.guestName || selectedSession.guestEmail || 'Customer Chat'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedSession.departmentName || 'Department'} • {selectedSession.issueType || 'General'} •{' '}
                    {selectedSession.status}
                  </p>
                </div>
                <Button variant="outline" onClick={() => void startCall()}>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Call
                </Button>
              </div>

              <div className="rounded border p-3 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Agent Actions</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={targetUserId}
                    onChange={(event) => setTargetUserId(event.target.value)}
                    placeholder="Target admin user id"
                    className="rounded border px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void runAction({ action: 'ADD_AGENT', targetUserId })}
                      disabled={saving || !targetUserId.trim()}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Agent
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void runAction({ action: 'TRANSFER', targetUserId })}
                      disabled={saving || !targetUserId.trim()}
                    >
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transfer
                    </Button>
                    <Button variant="outline" onClick={() => void runAction({ action: 'ESCALATE' })} disabled={saving}>
                      Escalate
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <input
                    value={participantIdForVisibility}
                    onChange={(event) => setParticipantIdForVisibility(event.target.value)}
                    placeholder="Participant id"
                    className="rounded border px-3 py-2 text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() =>
                      void runAction({
                        action: 'TOGGLE_VISIBILITY',
                        participantId: participantIdForVisibility,
                        visibleToCustomer: true,
                      })
                    }
                    disabled={saving || !participantIdForVisibility.trim()}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Visible
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void runAction({
                        action: 'TOGGLE_VISIBILITY',
                        participantId: participantIdForVisibility,
                        visibleToCustomer: false,
                      })
                    }
                    disabled={saving || !participantIdForVisibility.trim()}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Invisible
                  </Button>
                </div>
              </div>

              <div className="rounded border p-3 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Messages</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={viewerLanguage}
                      onChange={(event) => setViewerLanguage(event.target.value)}
                      className="rounded border px-2 py-2 text-sm"
                    >
                      {supportedLanguages.map((row) => (
                        <option key={row.code} value={row.code}>
                          View language: {row.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={messageSourceLanguage}
                      onChange={(event) => setMessageSourceLanguage(event.target.value)}
                      className="rounded border px-2 py-2 text-sm"
                    >
                      <option value="auto">Message language: Auto detect</option>
                      {supportedLanguages.map((row) => (
                        <option key={`msg-${row.code}`} value={row.code}>
                          Message language: {row.label}
                        </option>
                      ))}
                    </select>
                  </div>
                <div className="max-h-[360px] space-y-2 overflow-auto rounded border bg-gray-50 p-2">
                  {Array.isArray(thread?.messages) && thread.messages.length > 0 ? (
                    thread.messages.map((row: any) => (
                      <div key={row.id} className="rounded border bg-white p-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>
                            {row.senderDisplayName || 'Unknown'} ({row.senderRole || 'USER'})
                          </span>
                          <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{row.body || ''}</p>
                        {row?.translated ? (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Translated from {String(row.sourceLanguage || '').toUpperCase()} to{' '}
                            {String(row.translatedToLanguage || '').toUpperCase()}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No messages yet.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Reply in chat..."
                    rows={3}
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
                  <Button onClick={() => void sendReply()} disabled={saving || !reply.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                </div>
                {uploadingAttachment ? <p className="text-xs text-gray-500">Uploading attachment...</p> : null}
                {replyAttachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {replyAttachments.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setReplyAttachments((prev) => prev.filter((entry) => entry !== url))}
                        className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-700"
                      >
                        Attached file ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-500">Select a chat session to manage conversation.</div>
          )}
        </section>
      </div>
    </div>
  );
}

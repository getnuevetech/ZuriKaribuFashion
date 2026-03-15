import { useEffect, useState } from 'react';
import { Mail, MailOpen, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../ui/Button';

type MessagesInboxProps = {
  heading: string;
  description: string;
};

type InboxMessage = {
  id: string;
  source: 'IN_APP' | 'DISPATCH';
  title: string;
  subject: string;
  body: string;
  sentEmail?: boolean;
  sentPush?: boolean;
  sentInApp?: boolean;
  deliveryStatus?: string;
  isRead?: boolean;
  createdAt: string;
};

export default function MessagesInbox({ heading, description }: MessagesInboxProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = async () => {
    try {
      setError('');
      const response = await api.messages.getInbox({ page: 1, limit: 100 });
      if (!response.success) {
        setError(response.message || 'Unable to load messages.');
        return;
      }
      setMessages(Array.isArray(response.data?.messages) ? response.data.messages : []);
      setUnreadCount(Number(response.data?.unreadCount || 0));
    } catch (issue: any) {
      setError(issue?.response?.data?.message || issue?.message || 'Unable to load messages.');
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await load();
      setLoading(false);
    };
    void run();
  }, []);

  const refresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const markAllRead = async () => {
    try {
      setMarkingRead(true);
      setError('');
      await api.messages.markInboxRead({ markAll: true });
      await load();
    } catch (issue: any) {
      setError(issue?.response?.data?.message || issue?.message || 'Unable to mark messages as read.');
    } finally {
      setMarkingRead(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{heading}</h1>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button variant="outline" onClick={markAllRead} disabled={markingRead || unreadCount <= 0}>
              <MailOpen className="mr-2 h-4 w-4" />
              Mark all read ({unreadCount})
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border bg-white">
        {loading ? (
          <div className="px-5 py-10 text-sm text-gray-500">Loading inbox...</div>
        ) : messages.length === 0 ? (
          <div className="px-5 py-10 text-sm text-gray-500">No messages yet.</div>
        ) : (
          <div className="divide-y">
            {messages.map((message) => (
              <div key={message.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {message.isRead ? (
                        <MailOpen className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Mail className="h-4 w-4 text-black" />
                      )}
                      <p className={`truncate text-sm ${message.isRead ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
                        {message.title || message.subject || 'Message'}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{message.body || '—'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>{new Date(message.createdAt).toLocaleString()}</span>
                      <span className="rounded border px-1.5 py-0.5">{message.source}</span>
                      {message.sentEmail ? <span className="rounded border px-1.5 py-0.5">Email</span> : null}
                      {message.sentPush ? <span className="rounded border px-1.5 py-0.5">Push</span> : null}
                      {message.sentInApp ? <span className="rounded border px-1.5 py-0.5">In-app</span> : null}
                    </div>
                  </div>
                  {!message.isRead ? (
                    <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      New
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

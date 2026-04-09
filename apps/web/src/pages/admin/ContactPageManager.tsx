import { useEffect, useMemo, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ContactCard = {
  id: string;
  title: string;
  description: string;
  icon: 'CHAT' | 'EMAIL' | 'PHONE';
  enabled: boolean;
  sortOrder: number;
};

type ContactPageSettings = {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  formTitle: string;
  formSubtitle: string;
  issueTypePlaceholder: string;
  issueDetailsPlaceholder: string;
  startChatButtonLabel: string;
  openWidgetButtonLabel: string;
  cards: ContactCard[];
};

const EMPTY_SETTINGS: ContactPageSettings = {
  heroTag: '',
  heroTitle: '',
  heroSubtitle: '',
  formTitle: '',
  formSubtitle: '',
  issueTypePlaceholder: '',
  issueDetailsPlaceholder: '',
  startChatButtonLabel: '',
  openWidgetButtonLabel: '',
  cards: [],
};

const normalizeSettings = (input: any): ContactPageSettings => ({
  heroTag: String(input?.heroTag || ''),
  heroTitle: String(input?.heroTitle || ''),
  heroSubtitle: String(input?.heroSubtitle || input?.heroDescription || ''),
  formTitle: String(input?.formTitle || ''),
  formSubtitle: String(input?.formSubtitle || input?.formDescription || ''),
  issueTypePlaceholder: String(input?.issueTypePlaceholder || ''),
  issueDetailsPlaceholder: String(input?.issueDetailsPlaceholder || ''),
  startChatButtonLabel: String(input?.startChatButtonLabel || input?.primaryButtonLabel || ''),
  openWidgetButtonLabel: String(input?.openWidgetButtonLabel || input?.secondaryButtonLabel || ''),
  cards: Array.isArray(input?.supportChannels || input?.cards)
    ? (input.supportChannels || input.cards).map((row: any, index: number) => ({
        id: String(row?.id || `card-${index + 1}`),
        title: String(row?.title || ''),
        description: String(row?.description || ''),
        icon:
          String(row?.icon || 'CHAT').toUpperCase() === 'EMAIL'
            ? 'EMAIL'
            : String(row?.icon || 'CHAT').toUpperCase() === 'PHONE'
              ? 'PHONE'
              : 'CHAT',
        enabled: row?.enabled !== false,
        sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : index + 1,
      }))
    : [],
});

export default function ContactPageManager() {
  const [settings, setSettings] = useState<ContactPageSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const sortedCards = useMemo(
    () => [...settings.cards].sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.cards]
  );

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.contactPage.getAdminConfig();
      setSettings(normalizeSettings(response?.data || {}));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load Contact page manager settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        heroTag: String(settings.heroTag || '').trim(),
        heroTitle: String(settings.heroTitle || '').trim(),
        heroDescription: String(settings.heroSubtitle || '').trim(),
        formTitle: String(settings.formTitle || '').trim(),
        formDescription: String(settings.formSubtitle || '').trim(),
        issueTypePlaceholder: String(settings.issueTypePlaceholder || '').trim(),
        issueDetailsPlaceholder: String(settings.issueDetailsPlaceholder || '').trim(),
        supportChannels: settings.cards.map((card) => ({
          id: String(card.id || '').trim(),
          title: String(card.title || '').trim(),
          description: String(card.description || '').trim(),
          icon: card.icon === 'PHONE' ? 'PHONE' : card.icon === 'EMAIL' ? 'EMAIL' : 'CHAT',
          enabled: card.enabled !== false,
          sortOrder: Number.isFinite(Number(card.sortOrder)) ? Number(card.sortOrder) : 0,
        })),
      };
      const response = await api.contactPage.updateAdminConfig(payload);
      setSettings(normalizeSettings(response?.data || payload));
      setMessage(response?.message || 'Contact page settings saved.');
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save Contact page settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contact Page Manager</h1>
          <p className="text-sm text-gray-600">Manage all content and cards for the /contact page from admin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadSettings()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => void saveSettings()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Contact Page'}
          </Button>
        </div>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Hero</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-xs">
            Hero Tag
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.heroTag}
              onChange={(event) => setSettings((prev) => ({ ...prev, heroTag: event.target.value }))}
            />
          </label>
          <label className="text-xs md:col-span-2">
            Hero Title
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.heroTitle}
              onChange={(event) => setSettings((prev) => ({ ...prev, heroTitle: event.target.value }))}
            />
          </label>
          <label className="text-xs md:col-span-3">
            Hero Subtitle
            <textarea
              className="mt-1 min-h-[84px] w-full rounded border px-2 py-1.5"
              value={settings.heroSubtitle}
              onChange={(event) => setSettings((prev) => ({ ...prev, heroSubtitle: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Form</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs">
            Form Title
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.formTitle}
              onChange={(event) => setSettings((prev) => ({ ...prev, formTitle: event.target.value }))}
            />
          </label>
          <label className="text-xs">
            Form Subtitle
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.formSubtitle}
              onChange={(event) => setSettings((prev) => ({ ...prev, formSubtitle: event.target.value }))}
            />
          </label>
          <label className="text-xs">
            Issue Type Placeholder
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.issueTypePlaceholder}
              onChange={(event) => setSettings((prev) => ({ ...prev, issueTypePlaceholder: event.target.value }))}
            />
          </label>
          <label className="text-xs">
            Issue Details Placeholder
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.issueDetailsPlaceholder}
              onChange={(event) => setSettings((prev) => ({ ...prev, issueDetailsPlaceholder: event.target.value }))}
            />
          </label>
          <label className="text-xs">
            Start Chat Button Label
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.startChatButtonLabel}
              onChange={(event) => setSettings((prev) => ({ ...prev, startChatButtonLabel: event.target.value }))}
            />
          </label>
          <label className="text-xs">
            Open Widget Button Label
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={settings.openWidgetButtonLabel}
              onChange={(event) => setSettings((prev) => ({ ...prev, openWidgetButtonLabel: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Contact Cards</h2>
        <div className="mt-3 space-y-2">
          {sortedCards.map((card, index) => (
            <div key={card.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
              <label className="text-xs md:col-span-2">
                Title
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={card.title}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      cards: prev.cards.map((row) => (row.id === card.id ? { ...row, title: event.target.value } : row)),
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-5">
                Description
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={card.description}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      cards: prev.cards.map((row) => (row.id === card.id ? { ...row, description: event.target.value } : row)),
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-2">
                Icon
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={card.icon}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      cards: prev.cards.map((row) =>
                        row.id === card.id ? { ...row, icon: event.target.value as ContactCard['icon'] } : row
                      ),
                    }))
                  }
                >
                  <option value="CHAT">CHAT</option>
                  <option value="EMAIL">EMAIL</option>
                  <option value="PHONE">PHONE</option>
                </select>
              </label>
              <label className="text-xs md:col-span-1">
                Order
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={card.sortOrder}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      cards: prev.cards.map((row) =>
                        row.id === card.id ? { ...row, sortOrder: Number(event.target.value || index + 1) } : row
                      ),
                    }))
                  }
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs md:col-span-1 pt-6">
                <input
                  type="checkbox"
                  checked={card.enabled}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      cards: prev.cards.map((row) => (row.id === card.id ? { ...row, enabled: event.target.checked } : row)),
                    }))
                  }
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

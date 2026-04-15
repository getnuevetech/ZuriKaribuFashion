import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type AudienceRole =
  | 'ALL'
  | 'CUSTOMER'
  | 'FABRIC_SELLER'
  | 'FASHION_DESIGNER'
  | 'VENDORS'
  | 'RESELLER_INFLUENCER'
  | 'ADMINISTRATOR'
  | 'QA_TEAM';

const AUDIENCE_OPTIONS: Array<{ value: AudienceRole; label: string }> = [
  { value: 'ALL', label: 'All users' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'VENDORS', label: 'All vendors (seller + designer)' },
  { value: 'FABRIC_SELLER', label: 'Sellers' },
  { value: 'FASHION_DESIGNER', label: 'Designers' },
  { value: 'RESELLER_INFLUENCER', label: 'Resellers / Influencers' },
  { value: 'ADMINISTRATOR', label: 'Administrators' },
  { value: 'QA_TEAM', label: 'QA Team' },
];

const DEFAULT_TEMPLATE_PAYLOAD = {
  title: 'New notification template',
  subject: 'New notification from African Fashion',
  bodyHtml: '<p>Hello,</p><p>This is a new notification template.</p>',
  bodyText: 'Hello,\n\nThis is a new notification template.',
  audienceRole: 'ALL' as AudienceRole,
  channelEmail: true,
  channelPush: true,
  channelInApp: true,
  isActive: true,
};

const sanitizeTemplateKey = (value: string) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');

export default function AdminNotificationCenter() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [editor, setEditor] = useState({
    key: '',
    title: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    audienceRole: 'ALL' as AudienceRole,
    channelEmail: true,
    channelPush: true,
    channelInApp: true,
    isActive: true,
  });
  const [sendForm, setSendForm] = useState({
    templateKey: '',
    title: '',
    subject: '',
    bodyHtml: '',
    bodyText: '',
    audienceRole: 'ALL' as AudienceRole,
    channelEmail: true,
    channelPush: true,
    channelInApp: true,
  });
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [messageTemplateKey, setMessageTemplateKey] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((entry) => String(entry.key) === selectedTemplateKey) || null,
    [templates, selectedTemplateKey]
  );

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [templatesResponse, dispatchResponse] = await Promise.all([
        api.admin.getNotificationTemplates(),
        api.admin.getNotificationDispatches({ page: 1, limit: 20 }),
      ]);
      const nextTemplates = Array.isArray(templatesResponse.data) ? templatesResponse.data : [];
      setTemplates(nextTemplates);
      if (nextTemplates.length > 0) {
        const first = nextTemplates[0];
        setSelectedTemplateKey(String(first.key || ''));
        setEditor({
          key: String(first.key || ''),
          title: String(first.title || ''),
          subject: String(first.subject || ''),
          bodyHtml: String(first.bodyHtml || ''),
          bodyText: String(first.bodyText || ''),
          audienceRole: String(first.audienceRole || 'ALL') as AudienceRole,
          channelEmail: Boolean(first.channelEmail),
          channelPush: Boolean(first.channelPush),
          channelInApp: Boolean(first.channelInApp),
          isActive: first.isActive !== false,
        });
        setSendForm({
          templateKey: String(first.key || ''),
          title: String(first.title || ''),
          subject: String(first.subject || ''),
          bodyHtml: String(first.bodyHtml || ''),
          bodyText: String(first.bodyText || ''),
          audienceRole: String(first.audienceRole || 'ALL') as AudienceRole,
          channelEmail: Boolean(first.channelEmail),
          channelPush: Boolean(first.channelPush),
          channelInApp: Boolean(first.channelInApp),
        });
      }
      setDispatches(Array.isArray(dispatchResponse.data?.dispatches) ? dispatchResponse.data.dispatches : []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load notification center data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    setEditor({
      key: String(selectedTemplate.key || ''),
      title: String(selectedTemplate.title || ''),
      subject: String(selectedTemplate.subject || ''),
      bodyHtml: String(selectedTemplate.bodyHtml || ''),
      bodyText: String(selectedTemplate.bodyText || ''),
      audienceRole: String(selectedTemplate.audienceRole || 'ALL') as AudienceRole,
      channelEmail: Boolean(selectedTemplate.channelEmail),
      channelPush: Boolean(selectedTemplate.channelPush),
      channelInApp: Boolean(selectedTemplate.channelInApp),
      isActive: selectedTemplate.isActive !== false,
    });
    setSendForm({
      templateKey: String(selectedTemplate.key || ''),
      title: String(selectedTemplate.title || ''),
      subject: String(selectedTemplate.subject || ''),
      bodyHtml: String(selectedTemplate.bodyHtml || ''),
      bodyText: String(selectedTemplate.bodyText || ''),
      audienceRole: String(selectedTemplate.audienceRole || 'ALL') as AudienceRole,
      channelEmail: Boolean(selectedTemplate.channelEmail),
      channelPush: Boolean(selectedTemplate.channelPush),
      channelInApp: Boolean(selectedTemplate.channelInApp),
    });
  }, [selectedTemplate]);

  const saveTemplate = async () => {
    if (!editor.key.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.admin.upsertNotificationTemplate(editor.key, {
        title: editor.title,
        subject: editor.subject,
        bodyHtml: editor.bodyHtml,
        bodyText: editor.bodyText,
        audienceRole: editor.audienceRole,
        channelEmail: editor.channelEmail,
        channelPush: editor.channelPush,
        channelInApp: editor.channelInApp,
        isActive: editor.isActive,
      });
      setSuccess('Template saved successfully.');
      await loadData();
      setSelectedTemplateKey(editor.key);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    const key = sanitizeTemplateKey(newTemplateKey);
    if (!key || key.length < 3) {
      setError('Enter a template key with at least 3 characters.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.admin.createNotificationTemplate({
        key,
        ...DEFAULT_TEMPLATE_PAYLOAD,
      });
      setSuccess('Template created successfully.');
      setNewTemplateKey('');
      await loadData();
      setSelectedTemplateKey(key);
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create template.');
    } finally {
      setSaving(false);
    }
  };

  const saveMessageAsTemplate = async () => {
    const key = sanitizeTemplateKey(messageTemplateKey);
    if (!key || key.length < 3) {
      setError('Enter a template key to save this message.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.admin.createNotificationTemplate({
        key,
        title: String(sendForm.title || '').trim() || DEFAULT_TEMPLATE_PAYLOAD.title,
        subject: String(sendForm.subject || '').trim() || DEFAULT_TEMPLATE_PAYLOAD.subject,
        bodyHtml: String(sendForm.bodyHtml || '').trim() || DEFAULT_TEMPLATE_PAYLOAD.bodyHtml,
        bodyText: String(sendForm.bodyText || '').trim() || DEFAULT_TEMPLATE_PAYLOAD.bodyText,
        audienceRole: sendForm.audienceRole,
        channelEmail: sendForm.channelEmail,
        channelPush: sendForm.channelPush,
        channelInApp: sendForm.channelInApp,
        isActive: true,
      });
      setSuccess('Message saved as template.');
      setMessageTemplateKey('');
      await loadData();
      setSelectedTemplateKey(key);
    } catch (saveAsError: any) {
      setError(saveAsError?.response?.data?.message || 'Failed to save message as template.');
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    const key = String(selectedTemplate?.key || '').trim();
    if (!key) return;
    if (selectedTemplate?.isSystem) {
      setError('System templates cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete template "${key}"?`)) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.admin.deleteNotificationTemplate(key);
      setSuccess('Template deleted successfully.');
      await loadData();
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Failed to delete template.');
    } finally {
      setSaving(false);
    }
  };

  const sendNotification = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.admin.sendNotificationDispatch({
        templateKey: sendForm.templateKey || undefined,
        title: sendForm.title || undefined,
        subject: sendForm.subject || undefined,
        bodyHtml: sendForm.bodyHtml || undefined,
        bodyText: sendForm.bodyText || undefined,
        audienceRole: sendForm.audienceRole,
        channelEmail: sendForm.channelEmail,
        channelPush: sendForm.channelPush,
        channelInApp: sendForm.channelInApp,
      });
      setSuccess(response?.message || 'Notification dispatched successfully.');
      const dispatchResponse = await api.admin.getNotificationDispatches({ page: 1, limit: 20 });
      setDispatches(Array.isArray(dispatchResponse.data?.dispatches) ? dispatchResponse.data.dispatches : []);
    } catch (sendError: any) {
      setError(sendError?.response?.data?.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure platform email/push/in-app templates and send admin broadcasts.
        </p>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Templates</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={newTemplateKey}
              onChange={(event) => setNewTemplateKey(event.target.value.toUpperCase())}
              placeholder="NEW_TEMPLATE_KEY"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <Button onClick={createTemplate} disabled={saving}>
              Create
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {templates.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => setSelectedTemplateKey(String(template.key || ''))}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  String(template.key || '') === selectedTemplateKey
                    ? 'border-black bg-gray-100 text-gray-900'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">
                  {template.title}{' '}
                  {template.isSystem ? (
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">System</span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">{template.key}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Template configuration</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={editor.key}
              onChange={(event) => setEditor((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))}
              placeholder="Template key"
              className="rounded border px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={editor.title}
              onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Title"
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              value={editor.subject}
              onChange={(event) => setEditor((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Email subject"
              className="rounded border px-3 py-2 text-sm"
            />
            <select
              value={editor.audienceRole}
              onChange={(event) => setEditor((prev) => ({ ...prev, audienceRole: event.target.value as AudienceRole }))}
              className="rounded border px-3 py-2 text-sm md:col-span-2"
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <textarea
              value={editor.bodyHtml}
              onChange={(event) => setEditor((prev) => ({ ...prev, bodyHtml: event.target.value }))}
              placeholder="Body HTML"
              className="h-24 rounded border px-3 py-2 text-sm md:col-span-2"
            />
            <textarea
              value={editor.bodyText}
              onChange={(event) => setEditor((prev) => ({ ...prev, bodyText: event.target.value }))}
              placeholder="Body text"
              className="h-20 rounded border px-3 py-2 text-sm md:col-span-2"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.channelEmail}
                onChange={(event) => setEditor((prev) => ({ ...prev, channelEmail: event.target.checked }))}
              />
              Email
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.channelPush}
                onChange={(event) => setEditor((prev) => ({ ...prev, channelPush: event.target.checked }))}
              />
              Push
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.channelInApp}
                onChange={(event) => setEditor((prev) => ({ ...prev, channelInApp: event.target.checked }))}
              />
              In-app
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(event) => setEditor((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Active
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="flex gap-2">
              {!selectedTemplate?.isSystem ? (
                <Button onClick={deleteTemplate} disabled={saving} variant="outline">
                  Delete Template
                </Button>
              ) : null}
              <Button onClick={saveTemplate} disabled={saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Send notification</h2>
        <p className="mt-1 text-xs text-gray-500">
          Use a template or override title/body before sending.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={sendForm.templateKey}
            onChange={(event) => {
              const key = String(event.target.value || '').trim();
              const selected = templates.find((entry) => String(entry.key || '') === key);
              if (!selected) {
                setSendForm((prev) => ({ ...prev, templateKey: key }));
                return;
              }
              setSendForm({
                templateKey: key,
                title: String(selected.title || ''),
                subject: String(selected.subject || ''),
                bodyHtml: String(selected.bodyHtml || ''),
                bodyText: String(selected.bodyText || ''),
                audienceRole: String(selected.audienceRole || 'ALL') as AudienceRole,
                channelEmail: Boolean(selected.channelEmail),
                channelPush: Boolean(selected.channelPush),
                channelInApp: Boolean(selected.channelInApp),
              });
            }}
            className="rounded border px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">No template (manual)</option>
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.title} ({template.key})
              </option>
            ))}
          </select>
          <input
            value={sendForm.title}
            onChange={(event) => setSendForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={sendForm.subject}
            onChange={(event) => setSendForm((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Subject"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={sendForm.audienceRole}
            onChange={(event) => setSendForm((prev) => ({ ...prev, audienceRole: event.target.value as AudienceRole }))}
            className="rounded border px-3 py-2 text-sm md:col-span-2"
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={sendForm.bodyHtml}
            onChange={(event) => setSendForm((prev) => ({ ...prev, bodyHtml: event.target.value }))}
            placeholder="Body HTML"
            className="h-20 rounded border px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            value={sendForm.bodyText}
            onChange={(event) => setSendForm((prev) => ({ ...prev, bodyText: event.target.value }))}
            placeholder="Body text"
            className="h-20 rounded border px-3 py-2 text-sm md:col-span-2"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendForm.channelEmail}
              onChange={(event) => setSendForm((prev) => ({ ...prev, channelEmail: event.target.checked }))}
            />
            Email
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendForm.channelPush}
              onChange={(event) => setSendForm((prev) => ({ ...prev, channelPush: event.target.checked }))}
            />
            Push
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendForm.channelInApp}
              onChange={(event) => setSendForm((prev) => ({ ...prev, channelInApp: event.target.checked }))}
            />
            In-app
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <input
              value={messageTemplateKey}
              onChange={(event) => setMessageTemplateKey(event.target.value.toUpperCase())}
              placeholder="SAVE_AS_TEMPLATE_KEY"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <Button onClick={saveMessageAsTemplate} disabled={saving} variant="outline">
              Save as Template
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={sendNotification} disabled={sending}>
              {sending ? 'Sending...' : 'Send Notification'}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Recent dispatches</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Audience</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Push</th>
                <th className="py-2 pr-3">In-app</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((dispatch) => (
                <tr key={dispatch.id} className="border-t">
                  <td className="py-2 pr-3">{dispatch.createdAt ? new Date(dispatch.createdAt).toLocaleString() : '-'}</td>
                  <td className="py-2 pr-3">{dispatch.title}</td>
                  <td className="py-2 pr-3">{dispatch.recipientRole}</td>
                  <td className="py-2 pr-3">{dispatch.sentEmail ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3">{dispatch.sentPush ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3">{dispatch.sentInApp ? 'Yes' : 'No'}</td>
                  <td className="py-2">{dispatch.deliveryStatus}</td>
                </tr>
              ))}
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No dispatch history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


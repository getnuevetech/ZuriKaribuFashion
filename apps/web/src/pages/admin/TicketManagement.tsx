import { useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw, Send, Phone, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type TicketRow = {
  id: string;
  source: string;
  title: string;
  subject: string;
  status: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  assignedAdminUserId?: string | null;
  assignedAdminRoleId?: string | null;
  assignedGroupId?: string | null;
  dueAt?: string | null;
  escalatedAt?: string | null;
  relatedOrderId?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

type TicketMessage = {
  id: string;
  senderDisplayName?: string;
  senderRole?: string;
  body?: string;
  createdAt?: string;
  attachments?: string[];
};

const SOURCE_OPTIONS = ['ORDER', 'EMAIL', 'PHONE', 'WEB', 'OTHER', 'CHAT', 'BOT'];

export default function AdminTicketManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'list' | 'workflow' | 'email'>('list');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [newTicket, setNewTicket] = useState({
    source: 'OTHER',
    title: '',
    subject: '',
    body: '',
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
  });
  const [assignment, setAssignment] = useState({
    targetType: 'ADMIN_GROUP',
    targetId: '',
    status: '',
    source: '',
  });
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    groupType: 'MIXED',
    roleTokens: '',
    userIds: '',
  });
  const [newRule, setNewRule] = useState({
    name: '',
    source: 'ALL',
    sequence: 1,
    targetType: 'ADMIN_GROUP',
    targetId: '',
    slaHours: 24,
    escalationTargetType: 'ADMIN_GROUP',
    escalationTargetId: '',
  });

  const selectedTicket = useMemo(
    () => tickets.find((row) => row.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketsResponse, groupsResponse, rulesResponse, departmentsResponse, settingsResponse] =
        await Promise.all([
          api.customerService.listTickets({
            search: search || undefined,
            source: sourceFilter || undefined,
            status: statusFilter || undefined,
          }),
          api.customerService.listRoutingGroups(),
          api.customerService.listRoutingRules(),
          api.customerService.listDepartments(),
          api.customerService.getSettings(),
        ]);
      setTickets(Array.isArray(ticketsResponse?.data) ? ticketsResponse.data : []);
      setGroups(Array.isArray(groupsResponse?.data) ? groupsResponse.data : []);
      setRules(Array.isArray(rulesResponse?.data) ? rulesResponse.data : []);
      setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
      setSettings(settingsResponse?.data || null);
      if (!selectedTicketId && Array.isArray(ticketsResponse?.data) && ticketsResponse.data[0]?.id) {
        setSelectedTicketId(String(ticketsResponse.data[0].id));
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load ticket management.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    if (!ticketId) return;
    try {
      const response = await api.customerService.getTicketMessages(ticketId);
      setTicketMessages(Array.isArray(response?.data) ? response.data : []);
    } catch (messageError: any) {
      setTicketMessages([]);
      setError(messageError?.response?.data?.message || 'Failed to load ticket messages.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      void loadMessages(selectedTicketId);
    } else {
      setTicketMessages([]);
    }
  }, [selectedTicketId]);

  const refreshTickets = async () => {
    await load();
    if (selectedTicketId) {
      await loadMessages(selectedTicketId);
    }
  };

  const sendReply = async () => {
    if (!selectedTicketId || !replyBody.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.replyTicket(selectedTicketId, {
        body: replyBody.trim(),
        visibleToCustomer: true,
      });
      setReplyBody('');
      setMessage('Reply sent.');
      await loadMessages(selectedTicketId);
      await load();
    } catch (replyError: any) {
      setError(replyError?.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = async () => {
    if (!selectedTicketId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.assignTicket(selectedTicketId, {
        targetType: assignment.targetId ? assignment.targetType : undefined,
        targetId: assignment.targetId || undefined,
        status: assignment.status || undefined,
        source: assignment.source || undefined,
      });
      setMessage('Ticket assignment updated.');
      await refreshTickets();
    } catch (assignError: any) {
      setError(assignError?.response?.data?.message || 'Failed to update assignment.');
    } finally {
      setSaving(false);
    }
  };

  const createManualTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.body.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.createTicket({
        source: newTicket.source,
        title: newTicket.title.trim(),
        subject: newTicket.subject.trim() || newTicket.title.trim(),
        body: newTicket.body.trim(),
        requesterName: newTicket.requesterName.trim() || undefined,
        requesterEmail: newTicket.requesterEmail.trim() || undefined,
        requesterPhone: newTicket.requesterPhone.trim() || undefined,
      });
      setNewTicket({
        source: 'OTHER',
        title: '',
        subject: '',
        body: '',
        requesterName: '',
        requesterEmail: '',
        requesterPhone: '',
      });
      setMessage('Manual ticket created.');
      await load();
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create manual ticket.');
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.createRoutingGroup({
        name: newGroup.name.trim(),
        description: newGroup.description.trim() || undefined,
        groupType: newGroup.groupType,
        roleTokens: newGroup.roleTokens
          .split(',')
          .map((row) => row.trim())
          .filter(Boolean),
        userIds: newGroup.userIds
          .split(',')
          .map((row) => row.trim())
          .filter(Boolean),
      });
      setNewGroup({
        name: '',
        description: '',
        groupType: 'MIXED',
        roleTokens: '',
        userIds: '',
      });
      setMessage('Routing group created.');
      const response = await api.customerService.listRoutingGroups();
      setGroups(Array.isArray(response?.data) ? response.data : []);
    } catch (groupError: any) {
      setError(groupError?.response?.data?.message || 'Failed to create routing group.');
    } finally {
      setSaving(false);
    }
  };

  const createRule = async () => {
    if (!newRule.name.trim() || !newRule.targetId.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.createRoutingRule({
        name: newRule.name.trim(),
        source: newRule.source,
        sequence: Number(newRule.sequence || 1),
        targetType: newRule.targetType,
        targetId: newRule.targetId.trim(),
        slaHours: Number(newRule.slaHours || 24),
        escalationTargetType: newRule.escalationTargetId.trim() ? newRule.escalationTargetType : undefined,
        escalationTargetId: newRule.escalationTargetId.trim() || undefined,
      });
      setNewRule({
        name: '',
        source: 'ALL',
        sequence: 1,
        targetType: 'ADMIN_GROUP',
        targetId: '',
        slaHours: 24,
        escalationTargetType: 'ADMIN_GROUP',
        escalationTargetId: '',
      });
      setMessage('Routing rule created.');
      const response = await api.customerService.listRoutingRules();
      setRules(Array.isArray(response?.data) ? response.data : []);
    } catch (ruleError: any) {
      setError(ruleError?.response?.data?.message || 'Failed to create routing rule.');
    } finally {
      setSaving(false);
    }
  };

  const startTicketCall = async () => {
    if (!selectedTicketId) return;
    try {
      const call = await api.customerService.startVoipCall({
        contextType: 'TICKET',
        contextId: selectedTicketId,
      });
      if (call?.data?.callLink) {
        window.open(call.data.callLink, '_blank', 'noopener,noreferrer');
      }
    } catch (callError: any) {
      setError(callError?.response?.data?.message || 'Failed to start VoIP call.');
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
          <h1 className="text-2xl font-semibold text-gray-900">Ticket Management</h1>
          <p className="text-sm text-gray-600">
            Unified ticket list across order/email/phone/other sources with routing, SLA and escalation controls.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshTickets()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'list', label: 'Ticket List' },
          { key: 'workflow', label: 'Workflow & Routing' },
          { key: 'email', label: 'Email Ingestion' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as any)}
            className={`rounded border px-3 py-2 text-sm ${
              tab === item.key ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-700" />
              <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, subject, requester..."
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="">All sources</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="">All status</option>
                <option value="OPEN">OPEN</option>
                <option value="PENDING">PENDING</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <Button variant="outline" onClick={() => void load()}>
              Apply Filter
            </Button>

            <div className="border-t pt-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Create Manual Ticket</h3>
              <div className="space-y-2">
                <select
                  value={newTicket.source}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, source: event.target.value }))}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  {SOURCE_OPTIONS.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
                <input
                  value={newTicket.title}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ticket title"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <input
                  value={newTicket.subject}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Subject (optional)"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <textarea
                  value={newTicket.body}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Initial message"
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <input
                  value={newTicket.requesterName}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, requesterName: event.target.value }))}
                  placeholder="Requester name"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <input
                  value={newTicket.requesterEmail}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, requesterEmail: event.target.value }))}
                  placeholder="Requester email"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <input
                  value={newTicket.requesterPhone}
                  onChange={(event) => setNewTicket((prev) => ({ ...prev, requesterPhone: event.target.value }))}
                  placeholder="Requester phone"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
                <Button onClick={() => void createManualTicket()} disabled={saving}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Ticket
                </Button>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Tickets ({tickets.length})</h3>
              <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
                {tickets.length === 0 ? (
                  <p className="text-xs text-gray-500">No tickets found.</p>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full rounded border px-3 py-2 text-left ${
                        selectedTicketId === ticket.id ? 'border-black bg-gray-100' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{ticket.title || ticket.subject}</p>
                        <span className="text-[10px] text-gray-500">{ticket.source}</span>
                      </div>
                      <p className="truncate text-xs text-gray-500">{ticket.subject}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                        <span>{ticket.status}</span>
                        <span>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ''}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4">
            {selectedTicket ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedTicket.title}</h2>
                    <p className="text-sm text-gray-600">
                      {selectedTicket.source} • {selectedTicket.status}
                      {selectedTicket.relatedOrderId ? ` • Order: ${selectedTicket.relatedOrderId}` : ''}
                    </p>
                    {selectedTicket.requesterName || selectedTicket.requesterEmail || selectedTicket.requesterPhone ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Requester: {selectedTicket.requesterName || '—'} {selectedTicket.requesterEmail ? `• ${selectedTicket.requesterEmail}` : ''}{' '}
                        {selectedTicket.requesterPhone ? `• ${selectedTicket.requesterPhone}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <Button variant="outline" onClick={() => void startTicketCall()}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </Button>
                </div>

                <div className="rounded border p-3 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Assignment & Escalation</h3>
                  <div className="grid gap-2 md:grid-cols-4">
                    <select
                      value={assignment.targetType}
                      onChange={(event) => setAssignment((prev) => ({ ...prev, targetType: event.target.value }))}
                      className="rounded border px-2 py-2 text-sm"
                    >
                      <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                      <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                      <option value="ADMIN_USER">ADMIN_USER</option>
                    </select>
                    <input
                      value={assignment.targetId}
                      onChange={(event) => setAssignment((prev) => ({ ...prev, targetId: event.target.value }))}
                      placeholder="Target id (group/user/role)"
                      className="rounded border px-2 py-2 text-sm"
                    />
                    <select
                      value={assignment.status}
                      onChange={(event) => setAssignment((prev) => ({ ...prev, status: event.target.value }))}
                      className="rounded border px-2 py-2 text-sm"
                    >
                      <option value="">Keep status</option>
                      <option value="OPEN">OPEN</option>
                      <option value="PENDING">PENDING</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                    <select
                      value={assignment.source}
                      onChange={(event) => setAssignment((prev) => ({ ...prev, source: event.target.value }))}
                      className="rounded border px-2 py-2 text-sm"
                    >
                      <option value="">Keep source</option>
                      {SOURCE_OPTIONS.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={() => void saveAssignment()} disabled={saving}>
                    Save Assignment
                  </Button>
                </div>

                <div className="rounded border p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Conversation</h3>
                  <div className="max-h-[320px] space-y-2 overflow-auto rounded border bg-gray-50 p-2">
                    {ticketMessages.length === 0 ? (
                      <p className="text-xs text-gray-500">No messages yet.</p>
                    ) : (
                      ticketMessages.map((row) => (
                        <div key={row.id} className="rounded border bg-white p-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>
                              {row.senderDisplayName || 'Unknown'} ({row.senderRole || 'USER'})
                            </span>
                            <span>{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{row.body || ''}</p>
                          {Array.isArray(row.attachments) && row.attachments.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {row.attachments.map((url) => (
                                <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                                  Attachment
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
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder="Reply to ticket..."
                      rows={3}
                      className="flex-1 rounded border px-3 py-2 text-sm"
                    />
                    <Button onClick={() => void sendReply()} disabled={saving || !replyBody.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-sm text-gray-500">Select a ticket to view details.</div>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'workflow' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Routing Groups</h2>
            <p className="text-xs text-gray-500">
              Define role-based or user-based groups, then route tickets to these groups in workflow rules.
            </p>
            <input
              value={newGroup.name}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Group name"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <input
              value={newGroup.description}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newGroup.groupType}
                onChange={(event) => setNewGroup((prev) => ({ ...prev, groupType: event.target.value }))}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="MIXED">MIXED</option>
                <option value="ROLE_BASED">ROLE_BASED</option>
                <option value="USER_BASED">USER_BASED</option>
              </select>
              <input
                value={newGroup.roleTokens}
                onChange={(event) => setNewGroup((prev) => ({ ...prev, roleTokens: event.target.value }))}
                placeholder="Role tokens CSV"
                className="col-span-2 rounded border px-2 py-2 text-sm"
              />
            </div>
            <input
              value={newGroup.userIds}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, userIds: event.target.value }))}
              placeholder="User IDs CSV"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <Button onClick={() => void createGroup()} disabled={saving}>
              Create Group
            </Button>
            <div className="max-h-[340px] space-y-2 overflow-auto border-t pt-2">
              {groups.map((group) => (
                <div key={group.id} className="rounded border px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-500">
                    {group.groupType} • active: {group.isActive === false ? 'no' : 'yes'}
                  </p>
                  <p className="text-xs text-gray-600 break-all">id: {group.id}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Routing Rules & SLA Escalation</h2>
            <p className="text-xs text-gray-500">
              Create ordered rules per source with SLA hours and optional escalation route.
            </p>
            <input
              value={newRule.name}
              onChange={(event) => setNewRule((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Rule name"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={newRule.source}
                onChange={(event) => setNewRule((prev) => ({ ...prev, source: event.target.value }))}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="ALL">ALL</option>
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={999}
                value={newRule.sequence}
                onChange={(event) => setNewRule((prev) => ({ ...prev, sequence: Number(event.target.value || 1) }))}
                placeholder="Sequence"
                className="rounded border px-2 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                max={720}
                value={newRule.slaHours}
                onChange={(event) => setNewRule((prev) => ({ ...prev, slaHours: Number(event.target.value || 24) }))}
                placeholder="SLA hours"
                className="rounded border px-2 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newRule.targetType}
                onChange={(event) => setNewRule((prev) => ({ ...prev, targetType: event.target.value }))}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                <option value="ADMIN_USER">ADMIN_USER</option>
              </select>
              <input
                value={newRule.targetId}
                onChange={(event) => setNewRule((prev) => ({ ...prev, targetId: event.target.value }))}
                placeholder="Target id"
                className="rounded border px-2 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newRule.escalationTargetType}
                onChange={(event) => setNewRule((prev) => ({ ...prev, escalationTargetType: event.target.value }))}
                className="rounded border px-2 py-2 text-sm"
              >
                <option value="ADMIN_GROUP">ESC to ADMIN_GROUP</option>
                <option value="ADMIN_ROLE">ESC to ADMIN_ROLE</option>
                <option value="ADMIN_USER">ESC to ADMIN_USER</option>
              </select>
              <input
                value={newRule.escalationTargetId}
                onChange={(event) => setNewRule((prev) => ({ ...prev, escalationTargetId: event.target.value }))}
                placeholder="Escalation target id (optional)"
                className="rounded border px-2 py-2 text-sm"
              />
            </div>
            <Button onClick={() => void createRule()} disabled={saving}>
              Create Rule
            </Button>
            <div className="max-h-[340px] space-y-2 overflow-auto border-t pt-2">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded border px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500">
                    {rule.source} • seq {rule.sequence} • SLA {rule.slaHours}h
                  </p>
                  <p className="text-xs text-gray-600">
                    {rule.targetType}:{rule.targetId}
                    {rule.escalationTargetId ? ` → ${rule.escalationTargetType}:${rule.escalationTargetId}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-900">Departments</h2>
            <div className="grid gap-2 md:grid-cols-3">
              {departments.map((department) => (
                <div key={department.id} className="rounded border px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{department.name}</p>
                  <p className="text-xs text-gray-500">{department.code}</p>
                  <p className="text-xs text-gray-600">
                    route: {department.targetType || 'AUTO'} {department.targetId ? `• ${department.targetId}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'email' ? (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Email Ticket Ingestion</h2>
          <p className="text-sm text-gray-600">
            Configure tokenized email ingestion. Incoming emails are auto-tagged as source = EMAIL and subject becomes ticket title.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(settings?.emailIngestEnabled)}
                onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), emailIngestEnabled: event.target.checked }))}
              />
              Enable email ingestion
            </label>
            <input
              value={String(settings?.emailIngestToken || '')}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), emailIngestToken: event.target.value }))}
              placeholder="Ingestion token"
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <Button
            onClick={async () => {
              setSaving(true);
              setError('');
              setMessage('');
              try {
                await api.customerService.updateSettings({
                  emailIngestEnabled: Boolean(settings?.emailIngestEnabled),
                  emailIngestToken: String(settings?.emailIngestToken || '').trim(),
                });
                setMessage('Email ingestion settings saved.');
              } catch (saveError: any) {
                setError(saveError?.response?.data?.message || 'Failed to save email settings.');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            Save Email Settings
          </Button>
          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Webhook endpoint</p>
            <p className="mt-1">POST /api/customer-service/email/ingest</p>
            <p className="mt-1">
              Required token header: <code>x-support-email-token</code>
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

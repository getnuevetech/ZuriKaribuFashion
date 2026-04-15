import { useEffect, useState } from 'react';
import { MessageCircle, PhoneCall, RefreshCw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type VoipRoute = {
  id: string;
  name: string;
  enabled: boolean;
  contextType: 'TICKET' | 'CHAT' | 'DIRECT' | 'ANY';
  fromRoles: string[];
  targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE' | 'CUSTOMER_SERVICE';
  targetId: string;
};

type VoipTransferTarget = {
  id: string;
  name: string;
  enabled: boolean;
  targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE';
  targetId: string;
};

type VoipCallLog = {
  id: string;
  routeId?: string | null;
  contextType: string;
  contextId?: string | null;
  fromCallerId?: string | null;
  toCallerId?: string | null;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

type WhatsAppRoute = {
  id: string;
  name: string;
  enabled: boolean;
  mode: 'CHAT' | 'CALL' | 'ANY';
  contextType: 'TICKET' | 'CHAT' | 'DIRECT' | 'ANY';
  fromRoles: string[];
  targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE' | 'CUSTOMER_SERVICE';
  targetId: string;
};

type WhatsAppEventLog = {
  id: string;
  routeId?: string | null;
  mode: 'CHAT' | 'CALL';
  contextType: string;
  contextId?: string | null;
  fromPhone?: string | null;
  toPhone?: string | null;
  status: string;
  eventLink: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

type PbxTrunk = {
  id: string;
  name: string;
  enabled: boolean;
  host: string;
  port: number;
  transport: 'UDP' | 'TCP' | 'TLS' | 'WS' | 'WSS';
  username: string;
  authType: 'IP' | 'CREDENTIALS';
  inboundPrefix: string;
  outboundPrefix: string;
};

type PbxQueue = {
  id: string;
  name: string;
  extension: string;
  strategy: 'RING_ALL' | 'ROUND_ROBIN' | 'LEAST_RECENT' | 'FEWEST_CALLS';
  maxWaitSeconds: number;
  members: string[];
  enabled: boolean;
};

const buildEmptyRoute = (): VoipRoute => ({
  id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  contextType: 'ANY',
  fromRoles: [],
  targetType: 'CUSTOMER_SERVICE',
  targetId: '',
});

const buildEmptyTransferTarget = (): VoipTransferTarget => ({
  id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  targetType: 'ADMIN_USER',
  targetId: '',
});

const buildEmptyWhatsAppRoute = (): WhatsAppRoute => ({
  id: `wa-route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  mode: 'ANY',
  contextType: 'ANY',
  fromRoles: [],
  targetType: 'CUSTOMER_SERVICE',
  targetId: '',
});

const buildEmptyPbxTrunk = (): PbxTrunk => ({
  id: `trunk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  host: '',
  port: 5060,
  transport: 'UDP',
  username: '',
  authType: 'CREDENTIALS',
  inboundPrefix: '',
  outboundPrefix: '',
});

const buildEmptyPbxQueue = (): PbxQueue => ({
  id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  extension: '',
  strategy: 'RING_ALL',
  maxWaitSeconds: 60,
  members: [],
  enabled: true,
});

export default function AdminVoipConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'configuration' | 'logs' | 'transfer' | 'whatsapp'>('configuration');
  const [settings, setSettings] = useState({
    enabled: false,
    provider: 'INTERNAL',
    callBaseUrl: '',
    pbxEnabled: false,
    pbxDeploymentMode: 'LOCAL_HOSTED' as 'LOCAL_HOSTED' | 'EXTERNAL_PROVIDER',
    pbxHost: '127.0.0.1',
    pbxPort: 5060,
    pbxTransport: 'UDP' as 'UDP' | 'TCP' | 'TLS' | 'WS' | 'WSS',
    pbxWebSocketUrl: '',
    pbxRealm: 'zurikaribu.local',
    pbxContext: 'default',
    pbxExtensionPrefix: '9',
    pbxExtensionDigits: 4,
    pbxExtensionNext: 1001,
    pbxRecordingEnabled: false,
    pbxCodecPreferences: ['OPUS', 'PCMU', 'PCMA'] as string[],
    pbxEmergencyNumbers: ['911', '112'] as string[],
    pbxTrunks: [] as PbxTrunk[],
    pbxQueues: [] as PbxQueue[],
    routes: [] as VoipRoute[],
    transferTargets: [] as VoipTransferTarget[],
    whatsappEnabled: false,
    whatsappBusinessNumber: '',
    whatsappChatBaseUrl: 'https://wa.me',
    whatsappCallBaseUrl: 'https://wa.me',
    whatsappRoutes: [] as WhatsAppRoute[],
  });
  const [callLogs, setCallLogs] = useState<VoipCallLog[]>([]);
  const [whatsAppLogs, setWhatsAppLogs] = useState<WhatsAppEventLog[]>([]);
  const [testContextId, setTestContextId] = useState('');
  const [testToUserId, setTestToUserId] = useState('');
  const [testWhatsAppMessage, setTestWhatsAppMessage] = useState('Hello from ZuriKaribu support.');
  const [testWhatsAppMode, setTestWhatsAppMode] = useState<'CHAT' | 'CALL'>('CHAT');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [voipResponse, whatsappResponse] = await Promise.all([
        api.customerService.getVoipSettings(),
        api.customerService.getWhatsAppSettings().catch(() => null),
      ]);
      if (voipResponse.success && voipResponse.data) {
        setSettings({
          enabled: Boolean(voipResponse.data.enabled),
          provider: String(voipResponse.data.provider || 'INTERNAL'),
          callBaseUrl: String(voipResponse.data.callBaseUrl || ''),
          pbxEnabled: Boolean(voipResponse.data.pbx?.enabled),
          pbxDeploymentMode:
            String(voipResponse.data.pbx?.deploymentMode || 'LOCAL_HOSTED').toUpperCase() === 'EXTERNAL_PROVIDER'
              ? 'EXTERNAL_PROVIDER'
              : 'LOCAL_HOSTED',
          pbxHost: String(voipResponse.data.pbx?.host || '127.0.0.1'),
          pbxPort: Math.max(1, Number(voipResponse.data.pbx?.port || 5060)),
          pbxTransport: ['UDP', 'TCP', 'TLS', 'WS', 'WSS'].includes(String(voipResponse.data.pbx?.transport || '').toUpperCase())
            ? (String(voipResponse.data.pbx?.transport || '').toUpperCase() as any)
            : 'UDP',
          pbxWebSocketUrl: String(voipResponse.data.pbx?.webSocketUrl || ''),
          pbxRealm: String(voipResponse.data.pbx?.realm || 'zurikaribu.local'),
          pbxContext: String(voipResponse.data.pbx?.context || 'default'),
          pbxExtensionPrefix: String(voipResponse.data.pbx?.extensionPrefix || '9'),
          pbxExtensionDigits: Math.max(2, Number(voipResponse.data.pbx?.extensionDigits || 4)),
          pbxExtensionNext: Math.max(1, Number(voipResponse.data.pbx?.extensionNext || 1001)),
          pbxRecordingEnabled: Boolean(voipResponse.data.pbx?.recordingEnabled),
          pbxCodecPreferences: Array.isArray(voipResponse.data.pbx?.codecPreferences)
            ? voipResponse.data.pbx!.codecPreferences.map((entry: any) => String(entry || '').trim()).filter(Boolean)
            : ['OPUS', 'PCMU', 'PCMA'],
          pbxEmergencyNumbers: Array.isArray(voipResponse.data.pbx?.emergencyNumbers)
            ? voipResponse.data.pbx!.emergencyNumbers.map((entry: any) => String(entry || '').trim()).filter(Boolean)
            : ['911', '112'],
          pbxTrunks: Array.isArray(voipResponse.data.pbx?.trunks)
            ? voipResponse.data.pbx!.trunks.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                host: String(row?.host || ''),
                port: Math.max(1, Number(row?.port || 5060)),
                transport: ['UDP', 'TCP', 'TLS', 'WS', 'WSS'].includes(String(row?.transport || '').toUpperCase())
                  ? (String(row?.transport || '').toUpperCase() as any)
                  : 'UDP',
                username: String(row?.username || ''),
                authType: String(row?.authType || '').toUpperCase() === 'IP' ? 'IP' : 'CREDENTIALS',
                inboundPrefix: String(row?.inboundPrefix || ''),
                outboundPrefix: String(row?.outboundPrefix || ''),
              }))
            : [],
          pbxQueues: Array.isArray(voipResponse.data.pbx?.queues)
            ? voipResponse.data.pbx!.queues.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                extension: String(row?.extension || ''),
                strategy: ['RING_ALL', 'ROUND_ROBIN', 'LEAST_RECENT', 'FEWEST_CALLS'].includes(
                  String(row?.strategy || '').toUpperCase()
                )
                  ? (String(row?.strategy || '').toUpperCase() as any)
                  : 'RING_ALL',
                maxWaitSeconds: Math.max(5, Number(row?.maxWaitSeconds || 60)),
                members: Array.isArray(row?.members)
                  ? row.members.map((entry: any) => String(entry || '').trim()).filter(Boolean)
                  : [],
                enabled: row?.enabled !== false,
              }))
            : [],
          routes: Array.isArray(voipResponse.data.routes)
            ? voipResponse.data.routes.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                contextType: ['TICKET', 'CHAT', 'DIRECT', 'ANY'].includes(String(row?.contextType || '').toUpperCase())
                  ? (String(row?.contextType || '').toUpperCase() as any)
                  : 'ANY',
                fromRoles: Array.isArray(row?.fromRoles)
                  ? row.fromRoles.map((entry: any) => String(entry || '').toUpperCase()).filter(Boolean)
                  : [],
                targetType: ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE'].includes(
                  String(row?.targetType || '').toUpperCase()
                )
                  ? (String(row?.targetType || '').toUpperCase() as any)
                  : 'CUSTOMER_SERVICE',
                targetId: String(row?.targetId || ''),
              }))
            : [],
          transferTargets: Array.isArray(voipResponse.data.transferTargets)
            ? voipResponse.data.transferTargets.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                targetType: ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE'].includes(String(row?.targetType || '').toUpperCase())
                  ? (String(row?.targetType || '').toUpperCase() as any)
                  : 'ADMIN_USER',
                targetId: String(row?.targetId || ''),
              }))
            : [],
          whatsappEnabled: Boolean(whatsappResponse?.data?.enabled),
          whatsappBusinessNumber: String(whatsappResponse?.data?.businessNumber || ''),
          whatsappChatBaseUrl: String(whatsappResponse?.data?.chatBaseUrl || 'https://wa.me'),
          whatsappCallBaseUrl: String(whatsappResponse?.data?.callBaseUrl || 'https://wa.me'),
          whatsappRoutes: Array.isArray(whatsappResponse?.data?.routes)
            ? whatsappResponse!.data.routes.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                mode: ['CHAT', 'CALL', 'ANY'].includes(String(row?.mode || '').toUpperCase())
                  ? (String(row?.mode || '').toUpperCase() as any)
                  : 'ANY',
                contextType: ['TICKET', 'CHAT', 'DIRECT', 'ANY'].includes(String(row?.contextType || '').toUpperCase())
                  ? (String(row?.contextType || '').toUpperCase() as any)
                  : 'ANY',
                fromRoles: Array.isArray(row?.fromRoles)
                  ? row.fromRoles.map((entry: any) => String(entry || '').toUpperCase()).filter(Boolean)
                  : [],
                targetType: ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE'].includes(
                  String(row?.targetType || '').toUpperCase()
                )
                  ? (String(row?.targetType || '').toUpperCase() as any)
                  : 'CUSTOMER_SERVICE',
                targetId: String(row?.targetId || ''),
              }))
            : [],
        });
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load VoIP settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadCallLogs = async () => {
    try {
      const response = await api.customerService.listVoipCalls({ limit: 200 });
      if (response.success) {
        setCallLogs(Array.isArray(response.data) ? response.data : []);
      }
    } catch (logError: any) {
      setError(logError?.response?.data?.message || 'Failed to load call logs.');
    }
  };

  const loadWhatsAppLogs = async () => {
    try {
      const response = await api.customerService.listWhatsAppEvents({ limit: 200 });
      if (response.success) {
        setWhatsAppLogs(Array.isArray(response.data) ? response.data : []);
      }
    } catch (logError: any) {
      setError(logError?.response?.data?.message || 'Failed to load WhatsApp logs.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    void loadCallLogs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'whatsapp') return;
    void loadWhatsAppLogs();
  }, [activeTab]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const [voipResponse, whatsappResponse] = await Promise.all([
        api.customerService.updateVoipSettings({
          enabled: settings.enabled,
          provider: settings.provider.trim(),
          callBaseUrl: settings.callBaseUrl.trim(),
          pbx: {
            enabled: settings.pbxEnabled,
            deploymentMode: settings.pbxDeploymentMode,
            host: settings.pbxHost.trim(),
            port: Number(settings.pbxPort || 5060),
            transport: settings.pbxTransport,
            webSocketUrl: settings.pbxWebSocketUrl.trim(),
            realm: settings.pbxRealm.trim(),
            context: settings.pbxContext.trim(),
            extensionPrefix: settings.pbxExtensionPrefix.trim(),
            extensionDigits: Number(settings.pbxExtensionDigits || 4),
            extensionNext: Number(settings.pbxExtensionNext || 1001),
            recordingEnabled: settings.pbxRecordingEnabled,
            codecPreferences: (Array.isArray(settings.pbxCodecPreferences) ? settings.pbxCodecPreferences : [])
              .map((entry) => String(entry || '').trim().toUpperCase())
              .filter(Boolean),
            emergencyNumbers: (Array.isArray(settings.pbxEmergencyNumbers) ? settings.pbxEmergencyNumbers : [])
              .map((entry) => String(entry || '').trim())
              .filter(Boolean),
            trunks: settings.pbxTrunks.map((row) => ({
              ...row,
              id: String(row.id || '').trim(),
              name: String(row.name || '').trim(),
              host: String(row.host || '').trim(),
              username: String(row.username || '').trim(),
              inboundPrefix: String(row.inboundPrefix || '').trim(),
              outboundPrefix: String(row.outboundPrefix || '').trim(),
              port: Number(row.port || 5060),
            })),
            queues: settings.pbxQueues.map((row) => ({
              ...row,
              id: String(row.id || '').trim(),
              name: String(row.name || '').trim(),
              extension: String(row.extension || '').trim(),
              maxWaitSeconds: Number(row.maxWaitSeconds || 60),
              members: (Array.isArray(row.members) ? row.members : [])
                .map((entry) => String(entry || '').trim())
                .filter(Boolean),
            })),
          },
          routes: settings.routes.map((row) => ({
            ...row,
            id: String(row.id || '').trim(),
            name: String(row.name || '').trim(),
            targetId: String(row.targetId || '').trim(),
            fromRoles: (Array.isArray(row.fromRoles) ? row.fromRoles : [])
              .map((entry) => String(entry || '').trim().toUpperCase())
              .filter(Boolean),
          })),
          transferTargets: settings.transferTargets.map((row) => ({
            ...row,
            id: String(row.id || '').trim(),
            name: String(row.name || '').trim(),
            targetId: String(row.targetId || '').trim(),
          })),
        }),
        api.customerService.updateWhatsAppSettings({
          enabled: settings.whatsappEnabled,
          businessNumber: settings.whatsappBusinessNumber.trim(),
          chatBaseUrl: settings.whatsappChatBaseUrl.trim(),
          callBaseUrl: settings.whatsappCallBaseUrl.trim(),
          routes: settings.whatsappRoutes.map((row) => ({
            ...row,
            id: String(row.id || '').trim(),
            name: String(row.name || '').trim(),
            targetId: String(row.targetId || '').trim(),
            fromRoles: (Array.isArray(row.fromRoles) ? row.fromRoles : [])
              .map((entry) => String(entry || '').trim().toUpperCase())
              .filter(Boolean),
          })),
        }),
      ]);
      if (voipResponse.success || whatsappResponse.success) {
        setMessage(whatsappResponse.message || voipResponse.message || 'Communication channel settings saved.');
      }
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save VoIP settings.');
    } finally {
      setSaving(false);
    }
  };

  const startTestCall = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.startVoipCall({
        contextType: 'DIRECT',
        contextId: testContextId.trim() || undefined,
        toUserId: testToUserId.trim() || undefined,
      });
      if (response.success && response.data?.callLink) {
        setMessage(`Call started. Opening ${response.data.callLink}`);
        window.open(response.data.callLink, '_blank', 'noopener,noreferrer');
      }
      if (activeTab === 'logs') await loadCallLogs();
    } catch (callError: any) {
      setError(callError?.response?.data?.message || 'Failed to start test call.');
    } finally {
      setSaving(false);
    }
  };

  const startWhatsAppTest = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.startWhatsAppSession({
        mode: testWhatsAppMode,
        contextType: 'DIRECT',
        contextId: testContextId.trim() || undefined,
        toUserId: testToUserId.trim() || undefined,
        message: testWhatsAppMessage.trim() || undefined,
      });
      if (response.success && response.data?.eventLink) {
        setMessage(`WhatsApp ${testWhatsAppMode.toLowerCase()} started. Opening ${response.data.eventLink}`);
        window.open(response.data.eventLink, '_blank', 'noopener,noreferrer');
      }
      if (activeTab === 'whatsapp') await loadWhatsAppLogs();
    } catch (whatsAppError: any) {
      setError(whatsAppError?.response?.data?.message || 'Failed to start WhatsApp session.');
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-semibold text-gray-900">VoIP Management</h1>
          <p className="text-sm text-gray-600">
            Manage PBX-style call configuration, WhatsApp routing, logs, and transfer targets.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('configuration')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'configuration' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          VoIP Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'logs' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Call Logs List
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transfer')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'transfer' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Call Transfer Management Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'whatsapp' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          WhatsApp Channel Management
        </button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      {activeTab === 'configuration' ? (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Provider Setup</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              Enable VoIP
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Provider</span>
                <input
                  value={settings.provider}
                  onChange={(event) => setSettings((prev) => ({ ...prev, provider: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="INTERNAL or provider name"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Call base URL</span>
                <input
                  value={settings.callBaseUrl}
                  onChange={(event) => setSettings((prev) => ({ ...prev, callBaseUrl: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="https://your-voip-app/call"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">PBX Core Configuration (Local PBS Hosting)</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.pbxEnabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, pbxEnabled: event.target.checked }))}
              />
              Enable built-in PBX mode
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Deployment Mode</span>
                <select
                  value={settings.pbxDeploymentMode}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, pbxDeploymentMode: event.target.value as 'LOCAL_HOSTED' | 'EXTERNAL_PROVIDER' }))
                  }
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="LOCAL_HOSTED">LOCAL_HOSTED</option>
                  <option value="EXTERNAL_PROVIDER">EXTERNAL_PROVIDER</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">PBX Host</span>
                <input
                  value={settings.pbxHost}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxHost: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="127.0.0.1"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">PBX Port</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.pbxPort}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxPort: Number(event.target.value || 5060) }))}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Transport</span>
                <select
                  value={settings.pbxTransport}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxTransport: event.target.value as any }))}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="UDP">UDP</option>
                  <option value="TCP">TCP</option>
                  <option value="TLS">TLS</option>
                  <option value="WS">WS</option>
                  <option value="WSS">WSS</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">WebSocket URL (softphone)</span>
                <input
                  value={settings.pbxWebSocketUrl}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxWebSocketUrl: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="ws://127.0.0.1:8088/ws"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Realm / Domain</span>
                <input
                  value={settings.pbxRealm}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxRealm: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="zurikaribu.local"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Dialplan Context</span>
                <input
                  value={settings.pbxContext}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxContext: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="default"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Extension Prefix</span>
                <input
                  value={settings.pbxExtensionPrefix}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxExtensionPrefix: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="9"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Extension Digits</span>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={settings.pbxExtensionDigits}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxExtensionDigits: Number(event.target.value || 4) }))}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Next Extension Number</span>
                <input
                  type="number"
                  min={1}
                  value={settings.pbxExtensionNext}
                  onChange={(event) => setSettings((prev) => ({ ...prev, pbxExtensionNext: Number(event.target.value || 1001) }))}
                  className="w-full rounded border px-3 py-2"
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Codec Preferences (comma separated)</span>
                <input
                  value={settings.pbxCodecPreferences.join(',')}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      pbxCodecPreferences: event.target.value
                        .split(',')
                        .map((entry) => entry.trim().toUpperCase())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  placeholder="OPUS,PCMU,PCMA"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Emergency Numbers (comma separated)</span>
                <input
                  value={settings.pbxEmergencyNumbers.join(',')}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      pbxEmergencyNumbers: event.target.value
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded border px-3 py-2"
                  placeholder="911,112"
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.pbxRecordingEnabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, pbxRecordingEnabled: event.target.checked }))}
              />
              Enable call recording
            </label>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">PBX Trunks</h2>
              <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, pbxTrunks: [...prev.pbxTrunks, buildEmptyPbxTrunk()] }))}>
                Add Trunk
              </Button>
            </div>
            <div className="space-y-3">
              {settings.pbxTrunks.map((trunk, index) => (
                <div key={trunk.id || `pbx-trunk-${index}`} className="rounded border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-6">
                    <input
                      value={trunk.id}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                        }))
                      }
                      placeholder="Trunk ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={trunk.name}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                        }))
                      }
                      placeholder="Trunk name"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <input
                      value={trunk.host}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, host: event.target.value } : row)),
                        }))
                      }
                      placeholder="Host"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={trunk.port}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, port: Number(event.target.value || 5060) } : row)),
                        }))
                      }
                      placeholder="Port"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={trunk.enabled}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-5">
                    <select
                      value={trunk.transport}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, transport: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="UDP">UDP</option>
                      <option value="TCP">TCP</option>
                      <option value="TLS">TLS</option>
                      <option value="WS">WS</option>
                      <option value="WSS">WSS</option>
                    </select>
                    <input
                      value={trunk.username}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, username: event.target.value } : row)),
                        }))
                      }
                      placeholder="Username"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <select
                      value={trunk.authType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, authType: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="CREDENTIALS">CREDENTIALS</option>
                      <option value="IP">IP</option>
                    </select>
                    <input
                      value={trunk.inboundPrefix}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, inboundPrefix: event.target.value } : row)),
                        }))
                      }
                      placeholder="Inbound Prefix"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={trunk.outboundPrefix}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxTrunks: prev.pbxTrunks.map((row, idx) => (idx === index ? { ...row, outboundPrefix: event.target.value } : row)),
                        }))
                      }
                      placeholder="Outbound Prefix"
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        pbxTrunks: prev.pbxTrunks.filter((_row, idx) => idx !== index),
                      }))
                    }
                  >
                    Remove Trunk
                  </button>
                </div>
              ))}
              {settings.pbxTrunks.length === 0 ? <p className="text-sm text-gray-500">No trunks configured yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">PBX Queues & Extensions</h2>
              <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, pbxQueues: [...prev.pbxQueues, buildEmptyPbxQueue()] }))}>
                Add Queue
              </Button>
            </div>
            <div className="space-y-3">
              {settings.pbxQueues.map((queue, index) => (
                <div key={queue.id || `pbx-queue-${index}`} className="rounded border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-6">
                    <input
                      value={queue.id}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                        }))
                      }
                      placeholder="Queue ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={queue.name}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                        }))
                      }
                      placeholder="Queue name"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <input
                      value={queue.extension}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) => (idx === index ? { ...row, extension: event.target.value } : row)),
                        }))
                      }
                      placeholder="Extension"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <select
                      value={queue.strategy}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) => (idx === index ? { ...row, strategy: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="RING_ALL">RING_ALL</option>
                      <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                      <option value="LEAST_RECENT">LEAST_RECENT</option>
                      <option value="FEWEST_CALLS">FEWEST_CALLS</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={queue.enabled}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            pbxQueues: prev.pbxQueues.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[180px_1fr]">
                    <input
                      type="number"
                      min={5}
                      max={7200}
                      value={queue.maxWaitSeconds}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) =>
                            idx === index ? { ...row, maxWaitSeconds: Number(event.target.value || 60) } : row
                          ),
                        }))
                      }
                      placeholder="Max wait (seconds)"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={queue.members.join(',')}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          pbxQueues: prev.pbxQueues.map((row, idx) =>
                            idx === index
                              ? {
                                  ...row,
                                  members: event.target.value
                                    .split(',')
                                    .map((entry) => entry.trim())
                                    .filter(Boolean),
                                }
                              : row
                          ),
                        }))
                      }
                      placeholder="Members by caller ID/extension (comma-separated)"
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        pbxQueues: prev.pbxQueues.filter((_row, idx) => idx !== index),
                      }))
                    }
                  >
                    Remove Queue
                  </button>
                </div>
              ))}
              {settings.pbxQueues.length === 0 ? <p className="text-sm text-gray-500">No queues configured yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Call Route Management</h2>
              <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, routes: [...prev.routes, buildEmptyRoute()] }))}>
                Add Route
              </Button>
            </div>
            <div className="space-y-3">
              {settings.routes.map((route, index) => (
                <div key={route.id || `route-${index}`} className="rounded border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-5">
                    <input
                      value={route.id}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                        }))
                      }
                      placeholder="Route ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={route.name}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                        }))
                      }
                      placeholder="Route name"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.contextType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, contextType: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="ANY">ANY</option>
                      <option value="TICKET">TICKET</option>
                      <option value="CHAT">CHAT</option>
                      <option value="DIRECT">DIRECT</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={route.enabled}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            routes: prev.routes.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={route.fromRoles.join(',')}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) =>
                            idx === index
                              ? {
                                  ...row,
                                  fromRoles: event.target.value
                                    .split(',')
                                    .map((entry) => entry.trim().toUpperCase())
                                    .filter(Boolean),
                                }
                              : row
                          ),
                        }))
                      }
                      placeholder="From roles (comma-separated)"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.targetType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, targetType: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="CUSTOMER_SERVICE">CUSTOMER_SERVICE</option>
                      <option value="ADMIN_USER">ADMIN_USER</option>
                      <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                      <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                    </select>
                    <input
                      value={route.targetId}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, targetId: event.target.value } : row)),
                        }))
                      }
                      placeholder="Target ID (if required)"
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.filter((_row, idx) => idx !== index),
                        }))
                      }
                    >
                      Remove Route
                    </button>
                  </div>
                </div>
              ))}
              {settings.routes.length === 0 ? <p className="text-sm text-gray-500">No routes configured yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Test Call</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={testContextId}
                onChange={(event) => setTestContextId(event.target.value)}
                placeholder="Context id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
              <input
                value={testToUserId}
                onChange={(event) => setTestToUserId(event.target.value)}
                placeholder="Target user id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                Save VoIP Configuration
              </Button>
              <Button onClick={() => void startTestCall()} disabled={saving} variant="outline">
                <PhoneCall className="mr-2 h-4 w-4" />
                Start Test Call
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'transfer' ? (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Call Transfer Targets</h2>
            <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, transferTargets: [...prev.transferTargets, buildEmptyTransferTarget()] }))}>
              Add Transfer Target
            </Button>
          </div>
          <div className="space-y-3">
            {settings.transferTargets.map((target, index) => (
              <div key={target.id || `transfer-${index}`} className="rounded border p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-5">
                  <input
                    value={target.id}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                      }))
                    }
                    placeholder="Transfer ID"
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <input
                    value={target.name}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                      }))
                    }
                    placeholder="Transfer name"
                    className="rounded border px-2 py-1 text-sm md:col-span-2"
                  />
                  <select
                    value={target.targetType}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, targetType: event.target.value as any } : row)),
                      }))
                    }
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="ADMIN_USER">ADMIN_USER</option>
                    <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                    <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={target.enabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                        }))
                      }
                    />
                    Enabled
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    value={target.targetId}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, targetId: event.target.value } : row)),
                      }))
                    }
                    placeholder="Target ID"
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.filter((_row, idx) => idx !== index),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {settings.transferTargets.length === 0 ? <p className="text-sm text-gray-500">No transfer targets configured yet.</p> : null}
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Transfer Configuration
          </Button>
        </section>
      ) : null}

      {activeTab === 'logs' ? (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Call Logs</h2>
            <Button variant="outline" onClick={() => void loadCallLogs()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Logs
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Call ID</th>
                  <th className="py-2 pr-3">Route</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2 pr-3">From</th>
                  <th className="py-2 pr-3">To</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Ended</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-mono text-xs">{row.id}</td>
                    <td className="py-2 pr-3">{row.routeId || '-'}</td>
                    <td className="py-2 pr-3">
                      {row.contextType}
                      {row.contextId ? ` (${row.contextId})` : ''}
                    </td>
                    <td className="py-2 pr-3">{row.fromCallerId || '-'}</td>
                    <td className="py-2 pr-3">{row.toCallerId || '-'}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2 pr-3">{row.startedAt ? new Date(row.startedAt).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-3">{row.endedAt ? new Date(row.endedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No call logs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'whatsapp' ? (
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">WhatsApp Provider Setup</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.whatsappEnabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, whatsappEnabled: event.target.checked }))}
              />
              Enable WhatsApp channel
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Business number</span>
                <input
                  value={settings.whatsappBusinessNumber}
                  onChange={(event) => setSettings((prev) => ({ ...prev, whatsappBusinessNumber: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="+2340000000000"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Chat base URL</span>
                <input
                  value={settings.whatsappChatBaseUrl}
                  onChange={(event) => setSettings((prev) => ({ ...prev, whatsappChatBaseUrl: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="https://wa.me"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Call base URL</span>
                <input
                  value={settings.whatsappCallBaseUrl}
                  onChange={(event) => setSettings((prev) => ({ ...prev, whatsappCallBaseUrl: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="https://wa.me"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">WhatsApp Route Management</h2>
              <Button
                variant="outline"
                onClick={() =>
                  setSettings((prev) => ({ ...prev, whatsappRoutes: [...prev.whatsappRoutes, buildEmptyWhatsAppRoute()] }))
                }
              >
                Add WhatsApp Route
              </Button>
            </div>
            <div className="space-y-3">
              {settings.whatsappRoutes.map((route, index) => (
                <div key={route.id || `wa-route-${index}`} className="rounded border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-6">
                    <input
                      value={route.id}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, id: event.target.value } : row
                          ),
                        }))
                      }
                      placeholder="Route ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={route.name}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, name: event.target.value } : row
                          ),
                        }))
                      }
                      placeholder="Route name"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.mode}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, mode: event.target.value as any } : row
                          ),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="ANY">ANY</option>
                      <option value="CHAT">CHAT</option>
                      <option value="CALL">CALL</option>
                    </select>
                    <select
                      value={route.contextType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, contextType: event.target.value as any } : row
                          ),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="ANY">ANY</option>
                      <option value="TICKET">TICKET</option>
                      <option value="CHAT">CHAT</option>
                      <option value="DIRECT">DIRECT</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={route.enabled}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                              idx === index ? { ...row, enabled: event.target.checked } : row
                            ),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={route.fromRoles.join(',')}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index
                              ? {
                                  ...row,
                                  fromRoles: event.target.value
                                    .split(',')
                                    .map((entry) => entry.trim().toUpperCase())
                                    .filter(Boolean),
                                }
                              : row
                          ),
                        }))
                      }
                      placeholder="From roles (comma-separated)"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.targetType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, targetType: event.target.value as any } : row
                          ),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="CUSTOMER_SERVICE">CUSTOMER_SERVICE</option>
                      <option value="ADMIN_USER">ADMIN_USER</option>
                      <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                      <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                    </select>
                    <input
                      value={route.targetId}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          whatsappRoutes: prev.whatsappRoutes.map((row, idx) =>
                            idx === index ? { ...row, targetId: event.target.value } : row
                          ),
                        }))
                      }
                      placeholder="Target ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        whatsappRoutes: prev.whatsappRoutes.filter((_row, idx) => idx !== index),
                      }))
                    }
                  >
                    Remove Route
                  </button>
                </div>
              ))}
              {settings.whatsappRoutes.length === 0 ? (
                <p className="text-sm text-gray-500">No WhatsApp routes configured yet.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Test WhatsApp Session</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={testContextId}
                onChange={(event) => setTestContextId(event.target.value)}
                placeholder="Context id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
              <input
                value={testToUserId}
                onChange={(event) => setTestToUserId(event.target.value)}
                placeholder="Target user id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
              <select
                value={testWhatsAppMode}
                onChange={(event) => setTestWhatsAppMode(event.target.value as 'CHAT' | 'CALL')}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="CHAT">CHAT</option>
                <option value="CALL">CALL</option>
              </select>
              <input
                value={testWhatsAppMessage}
                onChange={(event) => setTestWhatsAppMessage(event.target.value)}
                placeholder="Message text"
                className="rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                Save WhatsApp Configuration
              </Button>
              <Button onClick={() => void startWhatsAppTest()} disabled={saving} variant="outline">
                <MessageCircle className="mr-2 h-4 w-4" />
                Start WhatsApp {testWhatsAppMode === 'CALL' ? 'Call' : 'Chat'}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">WhatsApp Session Logs</h2>
              <Button variant="outline" onClick={() => void loadWhatsAppLogs()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Logs
              </Button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 pr-3">Session ID</th>
                    <th className="py-2 pr-3">Mode</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3">Context</th>
                    <th className="py-2 pr-3">From</th>
                    <th className="py-2 pr-3">To</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {whatsAppLogs.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs">{row.id}</td>
                      <td className="py-2 pr-3">{row.mode}</td>
                      <td className="py-2 pr-3">{row.routeId || '-'}</td>
                      <td className="py-2 pr-3">
                        {row.contextType}
                        {row.contextId ? ` (${row.contextId})` : ''}
                      </td>
                      <td className="py-2 pr-3">{row.fromPhone || '-'}</td>
                      <td className="py-2 pr-3">{row.toPhone || '-'}</td>
                      <td className="py-2 pr-3">{row.status}</td>
                      <td className="py-2 pr-3">
                        {row.eventLink ? (
                          <a className="text-amber-700 hover:underline" href={row.eventLink} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                  {whatsAppLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-500">
                        No WhatsApp sessions yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

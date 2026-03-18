import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Shield, Cloud, Database, HardDrive, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type BackupSettings = {
  storage: {
    uploadToS3: boolean;
    bucket: string;
    region: string;
    prefix: string;
    credentialsConfigured?: boolean;
  };
  daily: {
    enabled: boolean;
    runAtUtc: string;
    retainDays: number;
    backupDatabase: boolean;
    backupCustomerData: boolean;
    backupSellerData: boolean;
    backupDesignerData: boolean;
    backupSystemFiles: boolean;
  };
};

type BackupJob = {
  id: string;
  type: string;
  status: string;
  format?: string;
  fileName?: string;
  fileSizeBytes?: number;
  s3Uri?: string;
  errorMessage?: string;
  createdAt?: string | null;
  completedAt?: string | null;
};

type BackupRestoreJob = {
  id: string;
  artifactId: string;
  artifactType: string;
  status: string;
  summary?: string;
  errorMessage?: string;
  createdAt?: string | null;
  completedAt?: string | null;
};

const DEFAULT_SETTINGS: BackupSettings = {
  storage: {
    uploadToS3: false,
    bucket: '',
    region: '',
    prefix: 'secure-backups',
    credentialsConfigured: false,
  },
  daily: {
    enabled: false,
    runAtUtc: '02:00',
    retainDays: 14,
    backupDatabase: true,
    backupCustomerData: true,
    backupSellerData: true,
    backupDesignerData: true,
    backupSystemFiles: true,
  },
};

const formatBytes = (value: number) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
  const normalized = size / 1024 ** exponent;
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)} ${units[exponent]}`;
};

export default function AdminBackups() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [restoreJobs, setRestoreJobs] = useState<BackupRestoreJob[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreArtifactId, setRestoreArtifactId] = useState('');

  const completedJobs = useMemo(
    () => jobs.filter((job) => String(job.status || '').toUpperCase() === 'COMPLETED'),
    [jobs]
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, jobsResponse, restoreJobsResponse] = await Promise.all([
        api.admin.getBackupSettings(),
        api.admin.listBackups({ limit: 80 }),
        api.admin.listBackupRestoreJobs({ limit: 80 }),
      ]);
      if (settingsResponse.success && settingsResponse.data) {
        setSettings({
          storage: {
            uploadToS3: Boolean(settingsResponse.data.storage?.uploadToS3),
            bucket: String(settingsResponse.data.storage?.bucket || ''),
            region: String(settingsResponse.data.storage?.region || ''),
            prefix: String(settingsResponse.data.storage?.prefix || 'secure-backups'),
            credentialsConfigured: Boolean(settingsResponse.data.storage?.credentialsConfigured),
          },
          daily: {
            enabled: Boolean(settingsResponse.data.daily?.enabled),
            runAtUtc: String(settingsResponse.data.daily?.runAtUtc || '02:00'),
            retainDays: Math.max(1, Number(settingsResponse.data.daily?.retainDays || 14)),
            backupDatabase: settingsResponse.data.daily?.backupDatabase !== false,
            backupCustomerData: settingsResponse.data.daily?.backupCustomerData !== false,
            backupSellerData: settingsResponse.data.daily?.backupSellerData !== false,
            backupDesignerData: settingsResponse.data.daily?.backupDesignerData !== false,
            backupSystemFiles: settingsResponse.data.daily?.backupSystemFiles !== false,
          },
        });
      }
      if (jobsResponse.success && Array.isArray(jobsResponse.data)) {
        setJobs(jobsResponse.data);
        const firstCompleted = jobsResponse.data.find(
          (job: BackupJob) => String(job.status || '').toUpperCase() === 'COMPLETED'
        );
        if (firstCompleted && !restoreArtifactId) {
          setRestoreArtifactId(String(firstCompleted.id || ''));
        }
      } else {
        setJobs([]);
      }
      if (restoreJobsResponse.success && Array.isArray(restoreJobsResponse.data)) {
        setRestoreJobs(restoreJobsResponse.data);
      } else {
        setRestoreJobs([]);
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load backup center.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.admin.updateBackupSettings(settings);
      if (response.success && response.data) {
        setMessage(response.message || 'Backup settings saved.');
      }
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save backup settings.');
    } finally {
      setSaving(false);
    }
  };

  const runBackups = async (types: Array<'DATABASE_FULL' | 'SYSTEM_FULL' | 'CUSTOMER_FULL' | 'SELLER_FULL' | 'DESIGNER_FULL'>) => {
    if (types.length === 0) return;
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const response = await api.admin.runBackups({
        types,
        uploadToS3: settings.storage.uploadToS3,
      });
      if (response.success) {
        setMessage(response.message || 'Backup run completed.');
      }
      await load();
    } catch (runError: any) {
      setError(runError?.response?.data?.message || 'Backup run failed.');
    } finally {
      setRunning(false);
    }
  };

  const runDailyProfile = async () => {
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const response = await api.admin.runDailyBackupsNow();
      if (response.success) {
        setMessage(response.message || 'Daily profile backup executed.');
      }
      await load();
    } catch (runError: any) {
      setError(runError?.response?.data?.message || 'Failed to execute daily profile backup.');
    } finally {
      setRunning(false);
    }
  };

  const runRestore = async () => {
    if (!restoreArtifactId) return;
    setRestoring(true);
    setError('');
    setMessage('');
    try {
      const response = await api.admin.runBackupRestore({ artifactId: restoreArtifactId, mode: 'MERGE' });
      if (response.success) {
        setMessage(response.message || 'Restore job executed.');
      }
      await load();
    } catch (restoreError: any) {
      setError(restoreError?.response?.data?.message || 'Restore job failed.');
    } finally {
      setRestoring(false);
    }
  };

  const downloadArtifact = async (job: BackupJob) => {
    const jobId = String(job.id || '').trim();
    if (!jobId) return;
    setDownloadingId(jobId);
    setError('');
    try {
      const result = await api.admin.downloadBackupArtifact(jobId);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = result.fileName || String(job.fileName || `backup-${jobId}`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError?.response?.data?.message || 'Failed to download backup artifact.');
    } finally {
      setDownloadingId('');
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
          <h1 className="text-2xl font-semibold text-gray-900">Backup Center</h1>
          <p className="text-sm text-gray-600">
            Backup database, customer/seller/designer records, and full system files. Store securely in S3 and download locally.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">Secure S3 Storage</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">S3 bucket</span>
            <input
              value={settings.storage.bucket}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, storage: { ...prev.storage, bucket: event.target.value } }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="backup-bucket"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">S3 region</span>
            <input
              value={settings.storage.region}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, storage: { ...prev.storage, region: event.target.value } }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="eu-west-1"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">S3 folder/prefix</span>
            <input
              value={settings.storage.prefix}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, storage: { ...prev.storage, prefix: event.target.value } }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="secure-backups"
            />
          </label>
          <label className="inline-flex items-center gap-2 pt-7 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.storage.uploadToS3}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, storage: { ...prev.storage, uploadToS3: event.target.checked } }))
              }
            />
            Upload backups to S3
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Credentials configured:{' '}
          <span className={settings.storage.credentialsConfigured ? 'text-emerald-700' : 'text-amber-700'}>
            {settings.storage.credentialsConfigured ? 'Yes' : 'No'}
          </span>
        </p>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">Daily Backup Profile</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.enabled}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, enabled: event.target.checked } }))
              }
            />
            Enable daily profile
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Run at UTC (HH:MM)</span>
            <input
              value={settings.daily.runAtUtc}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, runAtUtc: event.target.value } }))
              }
              className="w-full rounded border px-3 py-2"
              placeholder="02:00"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Retention (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={settings.daily.retainDays}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  daily: { ...prev.daily, retainDays: Math.max(1, Number(event.target.value || 14)) },
                }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.backupDatabase}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, backupDatabase: event.target.checked } }))
              }
            />
            Full database backup
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.backupCustomerData}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, backupCustomerData: event.target.checked } }))
              }
            />
            Full customer data/orders/address/tickets
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.backupSellerData}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, backupSellerData: event.target.checked } }))
              }
            />
            Full seller details/orders/earnings/tickets
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.backupDesignerData}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, backupDesignerData: event.target.checked } }))
              }
            />
            Full designer details/orders/earnings/tickets
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.daily.backupSystemFiles}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, daily: { ...prev.daily, backupSystemFiles: event.target.checked } }))
              }
            />
            Full system/repository files backup
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Backup Settings'}
          </Button>
          <Button variant="outline" onClick={() => void runDailyProfile()} disabled={running}>
            {running ? 'Running...' : 'Run Daily Profile Now'}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Run Backup Now</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void runBackups(['DATABASE_FULL'])} disabled={running}>
            <Database className="mr-2 h-4 w-4" />
            Database Backup
          </Button>
          <Button onClick={() => void runBackups(['SYSTEM_FULL'])} disabled={running} variant="outline">
            <HardDrive className="mr-2 h-4 w-4" />
            Full System Backup
          </Button>
          <Button onClick={() => void runBackups(['CUSTOMER_FULL'])} disabled={running} variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Customer Dataset
          </Button>
          <Button onClick={() => void runBackups(['SELLER_FULL'])} disabled={running} variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Seller Dataset
          </Button>
          <Button onClick={() => void runBackups(['DESIGNER_FULL'])} disabled={running} variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Designer Dataset
          </Button>
          <Button
            onClick={() =>
              void runBackups(['DATABASE_FULL', 'CUSTOMER_FULL', 'SELLER_FULL', 'DESIGNER_FULL', 'SYSTEM_FULL'])
            }
            disabled={running}
          >
            Full Backup Bundle
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Restore Center</h2>
            <p className="text-xs text-gray-500">
              Restore from completed artifacts. Full database/system restores are intentionally marked as manual-required for safety.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={restoreArtifactId}
            onChange={(event) => setRestoreArtifactId(event.target.value)}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Select completed backup artifact</option>
            {completedJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.type} • {job.fileName || job.id} • {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
              </option>
            ))}
          </select>
          <Button onClick={() => void runRestore()} disabled={!restoreArtifactId || restoring}>
            {restoring ? 'Restoring...' : 'Run Restore'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Artifact</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Summary</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {restoreJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No restore jobs yet.
                  </td>
                </tr>
              ) : (
                restoreJobs.map((job) => (
                  <tr key={job.id} className="border-t">
                    <td className="px-3 py-2 text-xs text-gray-700">{job.artifactId}</td>
                    <td className="px-3 py-2">{job.artifactType}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs ${
                          String(job.status || '').toUpperCase() === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : String(job.status || '').toUpperCase() === 'FAILED'
                              ? 'bg-red-100 text-red-700'
                              : String(job.status || '').toUpperCase() === 'MANUAL_REQUIRED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {job.summary || job.errorMessage || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Backup Artifacts ({jobs.length})</h2>
          <span className="text-xs text-gray-500">Completed: {completedJobs.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">File</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Size</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">S3</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Created</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No backup artifacts yet.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-t">
                    <td className="px-3 py-2">{job.type}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs ${
                          String(job.status || '').toUpperCase() === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : String(job.status || '').toUpperCase() === 'FAILED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="max-w-[260px] truncate text-xs text-gray-700">{job.fileName || '—'}</p>
                      {job.errorMessage ? <p className="max-w-[260px] truncate text-xs text-red-600">{job.errorMessage}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{formatBytes(Number(job.fileSizeBytes || 0))}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{job.s3Uri ? 'Uploaded' : 'Local only'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {String(job.status || '').toUpperCase() === 'COMPLETED' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void downloadArtifact(job)}
                          disabled={downloadingId === String(job.id || '')}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {downloadingId === String(job.id || '') ? 'Downloading...' : 'Download'}
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">Not ready</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

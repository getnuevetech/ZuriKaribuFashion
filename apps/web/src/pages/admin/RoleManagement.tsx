import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface PermissionItem {
  key: string;
  label: string;
  group: string;
  description: string;
}

interface AdminRoleRecord {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  assignedAdmins: number;
}

interface AdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  adminRoleId: string | null;
}

export default function AdminRoleManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<AdminRoleRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    permissions: [] as string[],
  });

  const groupedPermissions = useMemo(() => {
    const byGroup = new Map<string, PermissionItem[]>();
    for (const item of catalog) {
      const list = byGroup.get(item.group) || [];
      list.push(item);
      byGroup.set(item.group, list);
    }
    return Array.from(byGroup.entries());
  }, [catalog]);

  const notifySuccess = (message: string) => window.alert(message);
  const notifyError = (message: string) => window.alert(message);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catalogRes, rolesRes, usersRes] = await Promise.all([
        api.admin.getPermissionCatalog(),
        api.admin.getAdminRoles(),
        api.admin.getUsers({ role: 'ADMINISTRATOR', limit: 100 }),
      ]);

      if (catalogRes.success) {
        setCatalog(catalogRes.data.catalog || []);
      }
      if (rolesRes.success) {
        setRoles(rolesRes.data || []);
      }
      if (usersRes.success) {
        setAdminUsers(
          (usersRes.data.users || []).map((user: any) => ({
            id: String(user.id),
            fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || String(user.email || ''),
            email: String(user.email || ''),
            adminRoleId: user?.adminProfile?.adminRoleId || null,
          }))
        );
      }
    } catch (error: any) {
      notifyError(error?.response?.data?.message || 'Failed to load role management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resetForm = () => {
    setEditingRoleId(null);
    setFormData({
      name: '',
      description: '',
      isActive: true,
      permissions: [],
    });
  };

  const startEdit = (role: AdminRoleRecord) => {
    setEditingRoleId(role.id);
    setFormData({
      name: role.name,
      description: role.description || '',
      isActive: role.isActive,
      permissions: role.permissions || [],
    });
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSaveRole = async () => {
    if (!formData.name.trim()) {
      notifyError('Role name is required.');
      return;
    }
    setSaving(true);
    try {
      if (editingRoleId) {
        await api.admin.updateAdminRole(editingRoleId, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
          permissions: formData.permissions,
        });
        notifySuccess('Admin role updated.');
      } else {
        await api.admin.createAdminRole({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
          permissions: formData.permissions,
        });
        notifySuccess('Admin role created.');
      }
      resetForm();
      await loadData();
    } catch (error: any) {
      notifyError(error?.response?.data?.message || 'Failed to save admin role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: AdminRoleRecord) => {
    if (role.isSystem) {
      notifyError('System roles cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.admin.deleteAdminRole(role.id);
      notifySuccess('Admin role deleted.');
      await loadData();
    } catch (error: any) {
      notifyError(error?.response?.data?.message || 'Failed to delete role.');
    }
  };

  const handleAssignRole = async (userId: string, adminRoleId: string) => {
    try {
      await api.admin.updateAdminUserAccess(userId, {
        adminRoleId: adminRoleId || null,
      });
      setAdminUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                adminRoleId: adminRoleId || null,
              }
            : user
        )
      );
      notifySuccess('Administrator role assignment saved.');
    } catch (error: any) {
      notifyError(error?.response?.data?.message || 'Failed to assign role.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
        <p className="text-gray-500 mt-1">Create granular admin roles and assign them to administrator users.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{editingRoleId ? 'Edit Role' : 'Create Role'}</h2>
            {editingRoleId ? (
              <Button variant="secondary" size="sm" onClick={resetForm}>
                New
              </Button>
            ) : null}
          </div>
          <input
            value={formData.name}
            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Role name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <textarea
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Role description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="w-4 h-4"
            />
            Role is active
          </label>
          <Button onClick={handleSaveRole} disabled={saving} className="w-full">
            {saving ? (
              'Saving...'
            ) : editingRoleId ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Role
              </>
            )}
          </Button>
        </div>

        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Permission Matrix</h2>
          <div className="space-y-5 max-h-[560px] overflow-y-auto pr-1">
            {groupedPermissions.map(([group, items]) => (
              <div key={group}>
                <h3 className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-2">{group}</h3>
                <div className="space-y-2">
                  {items.map((permission) => (
                    <label
                      key={permission.key}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission.key)}
                        onChange={() => togglePermission(permission.key)}
                        className="mt-1 w-4 h-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{permission.label}</p>
                        <p className="text-xs text-gray-500">{permission.description}</p>
                        <p className="text-[11px] text-gray-400 mt-1 font-mono">{permission.key}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Defined Roles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Permissions</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Assigned</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {role.name}
                      {role.isSystem ? <Shield className="w-4 h-4 text-amber-500" /> : null}
                    </p>
                    {role.description ? <p className="text-xs text-gray-500 mt-1">{role.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{role.permissions.length}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{role.assignedAdmins}</td>
                  <td className="px-4 py-3">
                    <Badge variant={role.isActive ? 'green' : 'gray'}>{role.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(role)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                        title="Edit role"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600 disabled:opacity-40"
                        disabled={role.isSystem}
                        title={role.isSystem ? 'System role cannot be deleted' : 'Delete role'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No admin roles found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assign Roles to Administrators</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Assigned Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {adminUsers.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{admin.fullName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{admin.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={admin.adminRoleId || ''}
                      onChange={(event) => void handleAssignRole(admin.id, event.target.value)}
                      className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Use default administrator permissions</option>
                      {roles
                        .filter((role) => role.isActive || role.id === admin.adminRoleId)
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
              {adminUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                    No administrator users found.
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

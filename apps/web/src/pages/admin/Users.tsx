import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Filter, XCircle, UserCheck, UserX, Mail, Plus, Edit, PhoneCall } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  country?: string;
  createdAt: string;
  orderCount?: number;
  adminRoleId?: string | null;
  callerId?: string | null;
}

interface AdminRoleOption {
  id: string;
  name: string;
  isActive: boolean;
}

export default function AdminUsers() {
  const location = useLocation();
  const isAdministratorMode = location.pathname.includes('/admin/administrators');
  const pageTitle = isAdministratorMode ? 'Administrator Accounts' : 'Customer Accounts';
  const addCtaLabel = isAdministratorMode ? 'Add Administrator' : 'Add Customer';
  const modalEntityLabel = isAdministratorMode ? 'Administrator' : 'Customer';
  const [users, setUsers] = useState<User[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'activate' | 'suspend' | 'reject' | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    status: 'ACTIVE',
    phone: '',
    callerId: '',
    country: '',
    adminRoleId: '',
  });
  const [editForm, setEditForm] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    callerId: '',
    country: '',
    status: 'ACTIVE',
    adminRoleId: '',
  });
  const authUser = useAuthStore((state) => state.user);
  const isSuperAdmin = useMemo(() => {
    const grants = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
    const normalized = grants.map((entry) => String(entry || '').trim());
    const lower = normalized.map((entry) => entry.toLowerCase());
    return normalized.includes('*') || normalized.includes('ALL') || lower.includes('all');
  }, [authUser?.permissions]);

  useEffect(() => {
    void fetchAdminRoles();
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [isAdministratorMode]);

  const fetchAdminRoles = async () => {
    try {
      const response = await api.admin.getAdminRoles();
      if (response.success) {
        const rows = Array.isArray(response.data) ? response.data : [];
        setAdminRoles(
          rows.map((row: any) => ({
            id: String(row.id || ''),
            name: String(row.name || ''),
            isActive: row.isActive !== false,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch admin roles:', error);
      setAdminRoles([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getUsers({
        search: search || undefined,
        role: isAdministratorMode ? undefined : 'CUSTOMER',
        status: statusFilter || undefined,
      });
      if (response.success) {
        const mappedUsers: User[] = response.data.users
          .map((user: any) => ({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          status: user.status,
          country: String(user.country || user?.adminProfile?.country || '').trim(),
          callerId: user.callerId ? String(user.callerId) : null,
          createdAt: user.createdAt,
          orderCount: 0,
          adminRoleId: user?.adminProfile?.adminRoleId ? String(user.adminProfile.adminRoleId) : null,
          }))
          .filter((user) =>
            isAdministratorMode
              ? user.role === 'ADMINISTRATOR' || Boolean(user.adminRoleId)
              : user.role === 'CUSTOMER'
          );
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedUser || !actionType) return;

    try {
      let newStatus = selectedUser.status;
      if (actionType === 'activate') newStatus = 'ACTIVE';
      if (actionType === 'suspend') newStatus = 'SUSPENDED';
      if (actionType === 'reject') newStatus = 'REJECTED';

      await api.admin.updateUserStatus(selectedUser.id, newStatus);
      fetchUsers();
      setShowActionModal(false);
      setSelectedUser(null);
      setActionType(null);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const openActionModal = (user: User, action: 'activate' | 'suspend' | 'reject') => {
    setSelectedUser(user);
    setActionType(action);
    setShowActionModal(true);
  };

  const startVoipCall = async (userId: string) => {
    if (!userId) return;
    try {
      const response = await api.customerService.startVoipCall({
        contextType: 'DIRECT',
        contextId: `admin-user-${userId}`,
        toUserId: userId,
      });
      if (response?.data?.callLink) {
        window.open(response.data.callLink, '_blank', 'noopener,noreferrer');
      }
    } catch (voipError) {
      console.error('Failed to start VoIP call:', voipError);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setCreateError('');
      const createdResponse = await api.admin.createUser({
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        password: createForm.password,
        role: isAdministratorMode ? 'ADMINISTRATOR' : 'CUSTOMER',
        status: createForm.status,
        phone: createForm.phone.trim() || undefined,
        country: isAdministratorMode ? createForm.country.trim() : undefined,
        callerId: isSuperAdmin ? createForm.callerId.trim() || undefined : undefined,
      });
      if (
        createdResponse?.success &&
        createdResponse?.data?.id &&
        isAdministratorMode
      ) {
        await api.admin.updateAdminUserAccess(String(createdResponse.data.id), {
          adminRoleId: createForm.adminRoleId || null,
        });
      }
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        status: 'ACTIVE',
        phone: '',
        callerId: '',
        country: '',
        adminRoleId: '',
      });
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      setCreateError(error?.response?.data?.message || 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditError('');
    setEditForm({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      phone: user.phone || '',
      callerId: user.callerId || '',
      country: user.country || '',
      status: user.status,
      adminRoleId: user.adminRoleId || '',
    });
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdating(true);
      setEditError('');
      await api.admin.updateUser(editForm.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        country: isAdministratorMode ? editForm.country.trim() : undefined,
        callerId: isSuperAdmin ? editForm.callerId.trim() || null : undefined,
        status: editForm.status,
      });
      if (isAdministratorMode) {
        await api.admin.updateAdminUserAccess(editForm.id, {
          adminRoleId: editForm.adminRoleId || null,
        });
      }
      setShowEditModal(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      setEditError(error?.response?.data?.message || 'Failed to update user.');
    } finally {
      setUpdating(false);
    }
  };

  const adminRoleNameById = useMemo(
    () =>
      new Map(
        adminRoles
          .filter((item) => item.id)
          .map((item) => [item.id, item.name])
      ),
    [adminRoles]
  );

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {addCtaLabel}
          </Button>
          <Button variant="outline">
            <Mail className="w-4 h-4 mr-2" />
            Send Bulk Email
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${isAdministratorMode ? 'administrators' : 'customers'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <Button variant="outline" onClick={fetchUsers}>
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  {isAdministratorMode ? 'Administrator' : 'Customer'}
                </th>
                {isAdministratorMode ? (
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Assigned Admin Role</th>
                ) : null}
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Country</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Orders</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="font-medium text-amber-700">
                          {user.fullName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.fullName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {isSuperAdmin && user.callerId ? (
                          <p className="text-[11px] text-emerald-700">Caller ID: {user.callerId}</p>
                        ) : null}
                        <p className="font-mono text-[11px] text-gray-400">UUID: {user.id}</p>
                      </div>
                    </div>
                  </td>
                  {isAdministratorMode ? (
                    <td className="py-3 px-4">
                      <Badge variant="secondary">
                        {user.adminRoleId ? adminRoleNameById.get(user.adminRoleId) || 'Assigned Role' : 'No role assigned'}
                      </Badge>
                    </td>
                  ) : null}
                  <td className="py-3 px-4">
                    <Badge 
                      variant={
                        user.status === 'ACTIVE' ? 'green' :
                        user.status === 'SUSPENDED' ? 'red' :
                        user.status === 'REJECTED' ? 'gray' : 'yellow'
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{user.country || '-'}</td>
                  <td className="py-3 px-4 text-gray-600">{user.orderCount || 0}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void startVoipCall(user.id)}
                        className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg"
                        title="Start VoIP call"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                      {user.status !== 'ACTIVE' && (
                        <button
                          onClick={() => openActionModal(user, 'activate')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Activate"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {user.status !== 'SUSPENDED' && (
                        <button
                          onClick={() => openActionModal(user, 'suspend')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Suspend"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      {user.status !== 'REJECTED' && user.status !== 'ACTIVE' && isAdministratorMode && (
                        <button
                          onClick={() => openActionModal(user, 'reject')}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && selectedUser && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {actionType === 'activate' && 'Activate User'}
              {actionType === 'suspend' && 'Suspend User'}
              {actionType === 'reject' && 'Reject User'}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to {actionType} <strong>{selectedUser.fullName}</strong>?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowActionModal(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={handleAction}
                variant={actionType === 'suspend' || actionType === 'reject' ? 'outline' : 'default'}
              >
                {actionType === 'activate' && <UserCheck className="w-4 h-4 mr-2" />}
                {actionType === 'suspend' && <UserX className="w-4 h-4 mr-2" />}
                {actionType === 'reject' && <XCircle className="w-4 h-4 mr-2" />}
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 max-h-[92vh] overflow-hidden">
            <h3 className="text-xl font-bold mb-4">Add {modalEntityLabel}</h3>
            <form onSubmit={handleCreateUser} className="flex h-[calc(92vh-110px)] flex-col">
              <div className="space-y-4 overflow-y-auto pr-1">
              {createError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="text"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Temporary password"
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                  className={`px-3 py-2 border rounded-lg ${isAdministratorMode ? '' : 'md:col-span-2'}`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              {isAdministratorMode ? (
                <select
                  value={createForm.adminRoleId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, adminRoleId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">No specific admin role</option>
                  {adminRoles
                    .filter((row) => row.isActive)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <input
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="w-full px-3 py-2 border rounded-lg"
              />
              {isSuperAdmin ? (
                <input
                  type="text"
                  value={createForm.callerId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, callerId: e.target.value }))}
                  placeholder="Caller ID / VoIP extension (optional)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : null}
              {isAdministratorMode ? (
                <input
                  type="text"
                  value={createForm.country}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="Country (optional)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : null}
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white pt-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : `Create ${modalEntityLabel}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 max-h-[92vh] overflow-hidden">
            <h3 className="text-xl font-bold mb-4">Edit {modalEntityLabel} Profile</h3>
            <form onSubmit={handleEditUser} className="flex h-[calc(92vh-110px)] flex-col">
              <div className="space-y-4 overflow-y-auto pr-1">
              {editError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {editError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  className="px-3 py-2 border rounded-lg"
                  required
                />
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="w-full px-3 py-2 border rounded-lg"
              />
              {isSuperAdmin ? (
                <input
                  type="text"
                  value={editForm.callerId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, callerId: e.target.value }))}
                  placeholder="Caller ID / VoIP extension (optional)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : null}
              {isAdministratorMode ? (
                <input
                  type="text"
                  value={editForm.country}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="Country (optional)"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className={`px-3 py-2 border rounded-lg ${isAdministratorMode ? '' : 'md:col-span-2'}`}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              {isAdministratorMode ? (
                <select
                  value={editForm.adminRoleId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, adminRoleId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">No specific admin role</option>
                  {adminRoles
                    .filter((row) => row.isActive)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
              ) : null}
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white pt-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

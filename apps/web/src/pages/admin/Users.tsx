import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  XCircle,
  UserCheck,
  UserX,
  Mail,
  Plus,
  Edit
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

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
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
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
    role: 'CUSTOMER',
    status: 'ACTIVE',
    phone: '',
  });
  const [editForm, setEditForm] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      if (response.success) {
        const mappedUsers: User[] = response.data.users.map((user: any) => ({
          id: user.id,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          status: user.status,
          country: '-',
          createdAt: user.createdAt,
          orderCount: 0,
        }));
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setCreateError('');
      await api.admin.createUser({
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        password: createForm.password,
        role: createForm.role,
        status: createForm.status,
        phone: createForm.phone.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        phone: '',
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
      role: user.role,
      status: user.status,
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
        role: editForm.role,
        status: editForm.status,
      });
      setShowEditModal(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      setEditError(error?.response?.data?.message || 'Failed to update user.');
    } finally {
      setUpdating(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(search.toLowerCase()) ||
                         user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
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
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="FABRIC_SELLER">Fabric Seller</option>
          <option value="FASHION_DESIGNER">Designer</option>
          <option value="QA_TEAM">QA Team</option>
          <option value="ADMINISTRATOR">Administrator</option>
        </select>
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
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
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary">{user.role}</Badge>
                  </td>
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
                      {user.status !== 'REJECTED' && user.status !== 'ACTIVE' && user.role !== 'CUSTOMER' && (
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
            <h3 className="text-xl font-bold mb-4">Add User</h3>
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
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="FABRIC_SELLER">Fabric Seller</option>
                  <option value="FASHION_DESIGNER">Designer</option>
                  <option value="QA_TEAM">QA Team</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <input
                type="text"
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone (optional)"
                className="w-full px-3 py-2 border rounded-lg"
              />
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white pt-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 max-h-[92vh] overflow-hidden">
            <h3 className="text-xl font-bold mb-4">Edit User Profile</h3>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="FABRIC_SELLER">Fabric Seller</option>
                  <option value="FASHION_DESIGNER">Designer</option>
                  <option value="QA_TEAM">QA Team</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                </select>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border rounded-lg"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
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

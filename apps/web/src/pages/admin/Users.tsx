import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  XCircle,
  UserCheck,
  UserX,
  Mail,
  Plus
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface User {
  id: string;
  fullName: string;
  email: string;
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
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    phone: '',
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
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
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
    } catch (error) {
      console.error('Failed to create user:', error);
      window.alert('Failed to create user.');
    } finally {
      setCreating(false);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
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
              <div className="flex gap-3 pt-2">
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
    </div>
  );
}

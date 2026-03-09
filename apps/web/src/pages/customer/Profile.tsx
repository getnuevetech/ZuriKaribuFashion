import { useState, useEffect } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit2, 
  Camera,
  Save,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface Address {
  id: string;
  label: string;
  fullName: string;
  address: string;
  city: string;
  postalCode?: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

interface AddressForm {
  label: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

export default function CustomerProfile() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleLinkedAt, setGoogleLinkedAt] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleSuccess, setGoogleSuccess] = useState('');
  const googleClientId = String(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || ''
  ).trim();
  
  const fullName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || user?.lastName || '';
  
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [newAddress, setNewAddress] = useState<AddressForm>({
    label: 'Home',
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
    fetchGoogleLinkStatus();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await api.customer.getAddresses();
      if (response.success) {
        setAddresses(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    }
  };

  const fetchGoogleLinkStatus = async () => {
    try {
      const response = await api.auth.getGoogleLinkStatus();
      if (response.success) {
        setGoogleLinked(Boolean(response.data?.linked));
        setGoogleEmail(String(response.data?.email || ''));
        setGoogleLinkedAt(String(response.data?.linkedAt || ''));
      }
    } catch (error) {
      console.error('Failed to fetch Google link status:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const response = await api.auth.updateProfile(profile);
      if (response.success) {
        updateUser(response.data);
        setEditing(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError('');
    try {
      const payload = {
        label: newAddress.label.trim() || 'Home',
        fullName: newAddress.fullName.trim(),
        phone: newAddress.phone.trim(),
        country: newAddress.country,
        city: newAddress.city.trim(),
        address: [newAddress.addressLine1, newAddress.addressLine2, newAddress.state]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(', '),
        postalCode: newAddress.postalCode.trim() || undefined,
        isDefault: Boolean(newAddress.isDefault),
      };
      const response = await api.customer.addAddress(payload);
      if (response.success) {
        setAddresses([...addresses, response.data]);
        setShowAddressForm(false);
        setNewAddress({
          label: 'Home',
          fullName: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
          phone: '',
          isDefault: false,
        });
      }
    } catch (error: any) {
      setAddressError(error?.response?.data?.message || 'Unable to save address. Please check your details.');
      console.error('Failed to add address:', error);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await api.customer.deleteAddress(id);
      setAddresses(addresses.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete address:', error);
    }
  };

  const handleGoogleLinkSuccess = async (credentialResponse: CredentialResponse) => {
    const credential = String(credentialResponse.credential || '').trim();
    if (!credential) {
      setGoogleError('Google authentication did not return a valid credential.');
      return;
    }
    try {
      setGoogleLoading(true);
      setGoogleError('');
      setGoogleSuccess('');
      const response = await api.auth.linkGoogleAccount(credential);
      if (response.success) {
        setGoogleSuccess('Google account linked successfully.');
        await fetchGoogleLinkStatus();
      }
    } catch (error: any) {
      setGoogleError(error?.response?.data?.message || 'Failed to link Google account.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleUnlink = async () => {
    try {
      setGoogleLoading(true);
      setGoogleError('');
      setGoogleSuccess('');
      const response = await api.auth.unlinkGoogleAccount();
      if (response.success) {
        setGoogleSuccess('Google account unlinked successfully.');
        setGoogleLinked(false);
        setGoogleEmail('');
        setGoogleLinkedAt('');
      }
    } catch (error: any) {
      setGoogleError(error?.response?.data?.message || 'Failed to unlink Google account.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-amber-700">
                  {profile.firstName.charAt(0) || profile.lastName.charAt(0) || '?'}
                </span>
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white hover:bg-amber-700">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{fullName}</h2>
              <p className="text-gray-500">{user?.email}</p>
              <Badge variant="secondary" className="mt-2">Customer</Badge>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => editing ? setEditing(false) : setEditing(true)}
          >
            {editing ? (
              <><X className="w-4 h-4 mr-2" /> Cancel</>
            ) : (
              <><Edit2 className="w-4 h-4 mr-2" /> Edit Profile</>
            )}
          </Button>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{profile.phone || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Member Since</p>
                <p className="font-medium">
                  {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Google Account Link */}
      {googleClientId ? (
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Google Account</h2>
              <p className="text-sm text-gray-500">
                Link Google so you can sign in with either password or Google.
              </p>
            </div>
            {googleLinked ? (
              <Badge variant="green">Linked</Badge>
            ) : (
              <Badge variant="secondary">Not Linked</Badge>
            )}
          </div>

          {googleError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {googleError}
            </div>
          ) : null}
          {googleSuccess ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {googleSuccess}
            </div>
          ) : null}

          {googleLinked ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                <p>
                  Linked email: <span className="font-medium text-gray-900">{googleEmail || profile.email}</span>
                </p>
                {googleLinkedAt ? (
                  <p>Linked on: {new Date(googleLinkedAt).toLocaleString()}</p>
                ) : null}
              </div>
              <Button variant="outline" onClick={handleGoogleUnlink} disabled={googleLoading}>
                {googleLoading ? 'Unlinking...' : 'Unlink Google'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-start">
              <GoogleLogin
                onSuccess={handleGoogleLinkSuccess}
                onError={() => setGoogleError('Google account linking was cancelled or failed.')}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Addresses */}
      <div className="bg-white rounded-xl p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Shipping Addresses</h2>
          <Button size="sm" onClick={() => setShowAddressForm(true)}>
            + Add Address
          </Button>
        </div>

        {showAddressForm && (
          <form onSubmit={handleAddAddress} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-4">Add New Address</h3>
            {addressError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addressError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  placeholder="Label (Home, Office)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="flex items-center gap-2 px-2">
                <input
                  id="isDefaultAddress"
                  type="checkbox"
                  checked={newAddress.isDefault}
                  onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                />
                <label htmlFor="isDefaultAddress" className="text-sm text-gray-700">Set as default</label>
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newAddress.fullName}
                  onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Address Line 1"
                  value={newAddress.addressLine1}
                  onChange={(e) => setNewAddress({ ...newAddress, addressLine1: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Address Line 2 (Optional)"
                  value={newAddress.addressLine2}
                  onChange={(e) => setNewAddress({ ...newAddress, addressLine2: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <input
                type="text"
                placeholder="City"
                value={newAddress.city}
                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="State"
                value={newAddress.state}
                onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={newAddress.postalCode}
                onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              />
              <select
                value={newAddress.country}
                onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Select Country</option>
                <option value="US">United States</option>
                <option value="NG">Nigeria</option>
                <option value="GH">Ghana</option>
                <option value="KE">Kenya</option>
                <option value="ZA">South Africa</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
              </select>
              <div className="md:col-span-2">
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="submit" size="sm">Save Address</Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowAddressForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{address.fullName}</p>
                    <Badge variant="secondary" className="text-xs">{address.label}</Badge>
                    {address.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{address.address}</p>
                  <p className="text-sm text-gray-600">
                    {address.city}{address.postalCode ? `, ${address.postalCode}` : ''}
                  </p>
                  <p className="text-sm text-gray-600">{address.country}</p>
                  <p className="text-sm text-gray-500 mt-1">{address.phone}</p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteAddress(address.id)}
                className="text-red-500 hover:text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
          {addresses.length === 0 && (
            <p className="text-gray-500 text-center py-8">No addresses saved yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

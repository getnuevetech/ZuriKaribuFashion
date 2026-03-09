import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Image as ImageIcon, 
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface Banner {
  id: string;
  name: string;
  section: string;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  images: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PromoBadgeSettings {
  valueText: string;
  labelText: string;
}

const PROMO_BADGE_FALLBACK_SECTION = 'PROMO_BADGE';
const PROMO_BADGE_DEFAULTS: PromoBadgeSettings = {
  valueText: '50+',
  labelText: 'New Arrivals',
};
const PROMO_BADGE_FALLBACK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const SECTIONS = [
  { value: 'BANNER_1', label: 'Banner 1 (After Featured Designs)' },
  { value: 'BANNER_2', label: 'Banner 2 (After Featured Ready To Wear)' },
  { value: 'HERO', label: 'Hero Banner' },
  { value: 'PROMO', label: 'Promotional Banner' },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [promoBadge, setPromoBadge] = useState<PromoBadgeSettings>({
    ...PROMO_BADGE_DEFAULTS,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    section: 'BANNER_1',
    title: '',
    subtitle: '',
    ctaText: '',
    ctaLink: '',
    images: [] as string[],
    isActive: true,
    displayOrder: 0,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const visibleBanners = useMemo(
    () => banners.filter((banner) => String(banner.section || '').toUpperCase() !== PROMO_BADGE_FALLBACK_SECTION),
    [banners]
  );

  const isRetryableRouteError = (error: unknown) => {
    const status = Number((error as any)?.response?.status || 0);
    const message = String((error as any)?.response?.data?.message || (error as any)?.message || '').toLowerCase();
    return status === 404 || status === 405 || message.includes('route not found') || message.includes('not found');
  };

  const upsertPromoBadgeFallbackBanner = async () => {
    const existing = banners.find(
      (banner) => String(banner.section || '').toUpperCase() === PROMO_BADGE_FALLBACK_SECTION
    );
    const payload = {
      name: existing?.name || 'Promo Badge Settings',
      section: PROMO_BADGE_FALLBACK_SECTION,
      title: promoBadge.valueText || PROMO_BADGE_DEFAULTS.valueText,
      subtitle: promoBadge.labelText || PROMO_BADGE_DEFAULTS.labelText,
      ctaText: '',
      ctaLink: '',
      images: existing?.images?.length ? existing.images : [PROMO_BADGE_FALLBACK_IMAGE],
      isActive: true,
      displayOrder: typeof existing?.displayOrder === 'number' ? existing.displayOrder : 0,
    };
    if (existing) {
      await api.admin.updateBanner(existing.id, payload);
      return;
    }
    await api.admin.createBanner(payload);
  };

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const [bannersResponse, promoBadgeResponse] = await Promise.all([
        api.admin.getBanners(),
        api.admin.getPromoBadgeSettings().catch(() => null),
      ]);
      if (bannersResponse.success) {
        setBanners(bannersResponse.data);
      }
      const fallbackBanner = Array.isArray(bannersResponse.data)
        ? bannersResponse.data.find(
            (banner: Banner) => String(banner.section || '').toUpperCase() === PROMO_BADGE_FALLBACK_SECTION
          )
        : null;
      const fallbackBadge: PromoBadgeSettings | null = fallbackBanner
        ? {
            valueText: fallbackBanner.title || PROMO_BADGE_DEFAULTS.valueText,
            labelText: fallbackBanner.subtitle || PROMO_BADGE_DEFAULTS.labelText,
          }
        : null;
      if (promoBadgeResponse && promoBadgeResponse.success && promoBadgeResponse.data) {
        const responseValue = promoBadgeResponse.data.valueText || PROMO_BADGE_DEFAULTS.valueText;
        const responseLabel = promoBadgeResponse.data.labelText || PROMO_BADGE_DEFAULTS.labelText;
        const responseLooksDefault =
          responseValue === PROMO_BADGE_DEFAULTS.valueText && responseLabel === PROMO_BADGE_DEFAULTS.labelText;
        setPromoBadge({
          valueText: fallbackBadge && responseLooksDefault ? fallbackBadge.valueText : responseValue,
          labelText: fallbackBadge && responseLooksDefault ? fallbackBadge.labelText : responseLabel,
        });
      } else if (fallbackBadge) {
        setPromoBadge(fallbackBadge);
      }
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBanner(null);
    setFormData({
      name: '',
      section: 'BANNER_1',
      title: '',
      subtitle: '',
      ctaText: '',
      ctaLink: '',
      images: [],
      isActive: true,
      displayOrder: 0,
    });
    setShowModal(true);
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      name: banner.name,
      section: banner.section,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      ctaText: banner.ctaText || '',
      ctaLink: banner.ctaLink || '',
      images: banner.images,
      isActive: banner.isActive,
      displayOrder: banner.displayOrder,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const response = await api.admin.deleteBanner(id);
      if (response.success) {
        setBanners(banners.filter(b => b.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete banner:', error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const response = await api.admin.toggleBanner(id);
      if (response.success) {
        setBanners(banners.map(b => 
          b.id === id ? { ...b, isActive: !b.isActive } : b
        ));
      }
    } catch (error) {
      console.error('Failed to toggle banner:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.images.length === 0) {
      alert('Please upload at least one image');
      return;
    }

    try {
      let bannerSaved = false;
      if (editingBanner) {
        const response = await api.admin.updateBanner(editingBanner.id, formData);
        if (response.success) {
          setBanners(banners.map(b => 
            b.id === editingBanner.id ? response.data : b
          ));
          bannerSaved = true;
        }
      } else {
        const response = await api.admin.createBanner(formData);
        if (response.success) {
          setBanners([...banners, response.data]);
          bannerSaved = true;
        }
      }

      if (formData.section === 'PROMO' && bannerSaved) {
        try {
          await api.admin.updatePromoBadgeSettings({
            valueText: promoBadge.valueText,
            labelText: promoBadge.labelText,
          });
        } catch (promoBadgeError) {
          if (isRetryableRouteError(promoBadgeError)) {
            try {
              await upsertPromoBadgeFallbackBanner();
            } catch (fallbackSaveError) {
              console.error('Failed to save promo badge fallback banner:', fallbackSaveError);
              window.alert('Promotional banner was saved, but promo badge text could not be saved.');
            }
          } else {
            console.error('Failed to save promo badge settings:', promoBadgeError);
            window.alert((promoBadgeError as any)?.response?.data?.message || 'Promotional banner was saved, but promo badge text could not be saved.');
          }
        }
      }

      setShowModal(false);
      await fetchBanners();
    } catch (error) {
      console.error('Failed to save banner:', error);
      window.alert((error as any)?.response?.data?.message || (error as any)?.message || 'Failed to save banner.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await api.upload.image(formData);
        if (response.success) {
          return response.data.url;
        }
        return null;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(url => url !== null) as string[];

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...validUrls],
      }));
    } catch (error) {
      console.error('Failed to upload images:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const getSectionLabel = (section: string) => {
    return SECTIONS.find(s => s.value === section)?.label || section;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
          <p className="text-gray-500 mt-1">Manage homepage banners and promotional images</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How Banner Rotation Works</p>
            <p className="text-sm text-blue-700 mt-1">
              Upload multiple images to a single banner and they will be randomly displayed each time the page loads. 
              This is perfect for A/B testing or showing different promotional content.
            </p>
          </div>
        </div>
      </div>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleBanners.map((banner) => (
          <div 
            key={banner.id} 
            className={`bg-white rounded-xl border overflow-hidden ${
              banner.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'
            }`}
          >
            {/* Banner Preview */}
            <div className="relative h-48 bg-gray-100">
              {banner.images.length > 0 ? (
                <img
                  src={banner.images[0]}
                  alt={banner.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ImageIcon className="w-12 h-12 text-gray-300" />
                </div>
              )}
              
              {/* Overlay with text preview */}
              {(banner.title || banner.subtitle) && (
                <div className="absolute inset-0 flex flex-col justify-end p-4" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent, transparent)' }}>
                  {banner.title && (
                    <h3 className="text-white font-bold text-lg">{banner.title}</h3>
                  )}
                  {banner.subtitle && (
                    <p className="text-white text-opacity-80 text-sm">{banner.subtitle}</p>
                  )}
                </div>
              )}

              {/* Image count badge */}
              {banner.images.length > 1 && (
                <div className="absolute top-3 right-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
                  {banner.images.length} images
                </div>
              )}

              {/* Status badge */}
              <div className="absolute top-3 left-3">
                <Badge variant={banner.isActive ? 'success' : 'default'}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            {/* Banner Info */}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{banner.name}</h3>
                  <p className="text-sm text-gray-500">{getSectionLabel(banner.section)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(banner.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title={banner.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {banner.isActive ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(banner)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {/* CTA Preview */}
              {banner.ctaText && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">CTA:</span>
                  <span className="text-coral-600 font-medium">{banner.ctaText}</span>
                  {banner.ctaLink && (
                    <span className="text-gray-400">→ {banner.ctaLink}</span>
                  )}
                </div>
              )}

              {/* Last updated */}
              <p className="text-xs text-gray-400 mt-3">
                Last updated: {new Date(banner.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {visibleBanners.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No banners yet</h3>
          <p className="text-gray-500 mb-4">Create your first banner to display on the homepage</p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Banner
          </Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBanner ? 'Edit Banner' : 'Create Banner'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Banner Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banner Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                  placeholder="e.g., Summer Sale Banner"
                  required
                />
              </div>

              {/* Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banner Section *
                </label>
                <select
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                  required
                >
                  {SECTIONS.map((section) => (
                    <option key={section.value} value={section.value}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Subtitle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                    placeholder="e.g., Summer Collection"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subtitle (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                    placeholder="e.g., Up to 50% off"
                  />
                </div>
              </div>

              {formData.section === 'PROMO' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Promo Badge Value
                    </label>
                    <input
                      type="text"
                      value={promoBadge.valueText}
                      onChange={(e) => setPromoBadge((prev) => ({ ...prev, valueText: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                      placeholder="50+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Promo Badge Label
                    </label>
                    <input
                      type="text"
                      value={promoBadge.labelText}
                      onChange={(e) => setPromoBadge((prev) => ({ ...prev, labelText: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                      placeholder="New Arrivals"
                    />
                  </div>
                </div>
              ) : null}

              {/* CTA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CTA Button Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                    placeholder="e.g., Shop Now"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CTA Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.ctaLink}
                    onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                    placeholder="e.g., /designs"
                  />
                </div>
              </div>

              {/* Images Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Banner Images * (Upload multiple for random rotation)
                </label>
                
                {/* Image Preview Grid */}
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative aspect-video">
                        <img
                          src={image}
                          alt={`Banner ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-coral-500 hover:bg-coral-50 transition-colors"
                >
                  {uploading ? (
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Click to upload images</span>
                      <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-transparent"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers display first
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 text-coral-500 rounded focus:ring-coral-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Active (visible on homepage)
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingBanner ? 'Update Banner' : 'Create Banner'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

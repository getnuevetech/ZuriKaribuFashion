import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Image as ImageIcon, Upload, X, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, RefreshCw, Star, Package } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaText: string | null;
  ctaLink: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface FeaturedProduct {
  id: string;
  productId: string;
  productType: 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';
  section: string;
  displayOrder: number;
  customTitle: string | null;
  customDescription: string | null;
  isActive: boolean;
  product?: {
    name: string;
    designer?: { businessName: string };
    seller?: { businessName: string };
  };
}

interface AvailableProduct {
  id: string;
  name: string;
  type: string;
  designer?: { businessName: string };
  seller?: { businessName: string };
}

const SECTIONS = [
  { value: 'FEATURED_DESIGNS', label: 'Featured Designs' },
  { value: 'FEATURED_FABRICS', label: 'Featured Fabrics' },
  { value: 'FEATURED_READY_TO_WEAR', label: 'Featured Ready To Wear' },
  { value: 'TRENDING_NOW', label: 'Trending Now' },
  { value: 'NEW_ARRIVALS', label: 'New Arrivals' },
];

export default function AdminHomepage() {
  const [activeTab, setActiveTab] = useState<'hero' | 'featured'>('hero');

  // Hero slides state
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [loadingHero, setLoadingHero] = useState(true);
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [editingHeroSlide, setEditingHeroSlide] = useState<HeroSlide | null>(null);
  const [heroFormData, setHeroFormData] = useState({
    title: '',
    subtitle: '',
    image: '',
    ctaText: '',
    ctaLink: '',
    displayOrder: 0,
  });
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);

  // Featured products state
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [showFeaturedModal, setShowFeaturedModal] = useState(false);
  const [editingFeatured, setEditingFeatured] = useState<FeaturedProduct | null>(null);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [featuredFormData, setFeaturedFormData] = useState({
    productId: '',
    productType: 'DESIGN',
    section: 'FEATURED_DESIGNS',
    displayOrder: 0,
    customTitle: '',
    customDescription: '',
  });

  useEffect(() => {
    fetchHeroSlides();
    fetchFeaturedProducts();
  }, []);

  const fetchHeroSlides = async () => {
    try {
      setLoadingHero(true);
      const response = await api.homepage.getAdminHeroSlides();
      if (response.success) {
        setHeroSlides(response.data);
      }
    } catch (error) {
      console.error('Error fetching hero slides:', error);
    } finally {
      setLoadingHero(false);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      setLoadingFeatured(true);
      const response = await api.homepage.getAdminFeatured();
      if (response.success) {
        setFeaturedProducts(response.data);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setLoadingFeatured(false);
    }
  };

  const fetchAvailableProducts = async (type: string) => {
    try {
      const response = await api.homepage.getProductsForFeaturing(type);
      if (response.success) {
        setAvailableProducts(response.data);
      }
    } catch (error) {
      console.error('Error fetching available products:', error);
    }
  };

  // Hero slide handlers
  const handleCreateHeroSlide = () => {
    setEditingHeroSlide(null);
    setHeroFormData({
      title: '',
      subtitle: '',
      image: '',
      ctaText: '',
      ctaLink: '',
      displayOrder: heroSlides.length,
    });
    setShowHeroModal(true);
  };

  const handleEditHeroSlide = (slide: HeroSlide) => {
    setEditingHeroSlide(slide);
    setHeroFormData({
      title: slide.title,
      subtitle: slide.subtitle,
      image: slide.image,
      ctaText: slide.ctaText || '',
      ctaLink: slide.ctaLink || '',
      displayOrder: slide.displayOrder,
    });
    setShowHeroModal(true);
  };

  const handleDeleteHeroSlide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;

    try {
      await api.homepage.deleteHeroSlide(id);
      setHeroSlides(heroSlides.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Error deleting hero slide:', error);
    }
  };

  const handleToggleHeroSlide = async (slide: HeroSlide) => {
    try {
      await api.homepage.updateHeroSlide(slide.id, {
        isActive: !slide.isActive,
      });
      setHeroSlides(
        heroSlides.map((s) =>
          s.id === slide.id ? { ...s, isActive: !s.isActive } : s
        )
      );
    } catch (error) {
      console.error('Error toggling hero slide:', error);
    }
  };

  const handleSubmitHeroSlide = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingHeroSlide) {
        const response = await api.homepage.updateHeroSlide(
          editingHeroSlide.id,
          heroFormData
        );
        if (response.success) {
          setHeroSlides(
            heroSlides.map((s) =>
              s.id === editingHeroSlide.id ? response.data : s
            )
          );
        }
      } else {
        const response = await api.homepage.createHeroSlide(heroFormData);
        if (response.success) {
          setHeroSlides([...heroSlides, response.data]);
        }
      }
      setShowHeroModal(false);
    } catch (error) {
      console.error('Error saving hero slide:', error);
    }
  };

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingHeroImage(true);
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response.success && response.data?.url) {
        setHeroFormData((prev) => ({ ...prev, image: response.data.url }));
      } else {
        window.alert('Image upload failed.');
      }
    } catch (error) {
      console.error('Error uploading hero image:', error);
      window.alert('Image upload failed.');
    } finally {
      setUploadingHeroImage(false);
      event.target.value = '';
    }
  };

  // Featured product handlers
  const handleCreateFeatured = () => {
    setEditingFeatured(null);
    setFeaturedFormData({
      productId: '',
      productType: 'DESIGN',
      section: 'FEATURED_DESIGNS',
      displayOrder: 0,
      customTitle: '',
      customDescription: '',
    });
    fetchAvailableProducts('DESIGN');
    setShowFeaturedModal(true);
  };

  const handleEditFeatured = (fp: FeaturedProduct) => {
    setEditingFeatured(fp);
    setFeaturedFormData({
      productId: fp.productId,
      productType: fp.productType,
      section: fp.section,
      displayOrder: fp.displayOrder,
      customTitle: fp.customTitle || '',
      customDescription: fp.customDescription || '',
    });
    setShowFeaturedModal(true);
  };

  const handleDeleteFeatured = async (id: string) => {
    if (!confirm('Are you sure you want to remove this featured product?')) return;

    try {
      await api.homepage.removeFeaturedProduct(id);
      setFeaturedProducts(featuredProducts.filter((fp) => fp.id !== id));
    } catch (error) {
      console.error('Error removing featured product:', error);
    }
  };

  const handleToggleFeatured = async (fp: FeaturedProduct) => {
    try {
      await api.homepage.updateFeaturedProduct(fp.id, {
        isActive: !fp.isActive,
      });
      setFeaturedProducts(
        featuredProducts.map((f) =>
          f.id === fp.id ? { ...f, isActive: !f.isActive } : f
        )
      );
    } catch (error) {
      console.error('Error toggling featured product:', error);
    }
  };

  const handleSubmitFeatured = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!featuredFormData.productId) {
      alert('Please select a product');
      return;
    }

    try {
      if (editingFeatured) {
        const response = await api.homepage.updateFeaturedProduct(
          editingFeatured.id,
          {
            displayOrder: featuredFormData.displayOrder,
            customTitle: featuredFormData.customTitle || undefined,
            customDescription: featuredFormData.customDescription || undefined,
          }
        );
        if (response.success) {
          setFeaturedProducts(
            featuredProducts.map((f) =>
              f.id === editingFeatured.id ? response.data : f
            )
          );
        }
      } else {
        const response = await api.homepage.addFeaturedProduct({
          productId: featuredFormData.productId,
          productType: featuredFormData.productType,
          section: featuredFormData.section,
          displayOrder: featuredFormData.displayOrder,
          customTitle: featuredFormData.customTitle || undefined,
          customDescription: featuredFormData.customDescription || undefined,
        });
        if (response.success) {
          setFeaturedProducts([...featuredProducts, response.data]);
        }
      }
      setShowFeaturedModal(false);
    } catch (error) {
      console.error('Error saving featured product:', error);
    }
  };

  const handleProductTypeChange = (type: string) => {
    setFeaturedFormData({ ...featuredFormData, productType: type, productId: '' });
    fetchAvailableProducts(type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homepage Management</h1>
          <p className="text-gray-500 mt-1">
            Manage hero slides and featured products displayed on the homepage
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('hero')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'hero'
                ? 'border-coral-500 text-coral-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Hero Slides
            </div>
          </button>
          <button
            onClick={() => setActiveTab('featured')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'featured'
                ? 'border-coral-500 text-coral-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Featured Products
            </div>
          </button>
        </nav>
      </div>

      {/* Hero Slides Tab */}
      {activeTab === 'hero' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Hero Slides</h2>
            <Button onClick={handleCreateHeroSlide}>
              <Plus className="w-4 h-4 mr-2" />
              Add Slide
            </Button>
          </div>

          {loadingHero ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral-500"></div>
            </div>
          ) : heroSlides.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hero slides yet
              </h3>
              <p className="text-gray-500 mb-4">
                Add hero slides to display on the homepage carousel
              </p>
              <Button onClick={handleCreateHeroSlide}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Slide
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {heroSlides.map((slide) => (
                <div
                  key={slide.id}
                  className="bg-white rounded-lg border overflow-hidden"
                >
                  <div className="aspect-video bg-gray-100 relative">
                    {slide.image ? (
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button
                        onClick={() => handleToggleHeroSlide(slide)}
                        className={`p-1.5 rounded-full ${
                          slide.isActive
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {slide.isActive ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {slide.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {slide.subtitle}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <Badge
                        variant={slide.isActive ? 'success' : 'secondary'}
                      >
                        {slide.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditHeroSlide(slide)}
                          className="p-2 text-gray-600 hover:text-coral-600 hover:bg-coral-50 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteHeroSlide(slide.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Featured Products Tab */}
      {activeTab === 'featured' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Featured Products
            </h2>
            <Button onClick={handleCreateFeatured}>
              <Plus className="w-4 h-4 mr-2" />
              Add Featured Product
            </Button>
          </div>

          {loadingFeatured ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coral-500"></div>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No featured products yet
              </h3>
              <p className="text-gray-500 mb-4">
                Add products to feature on the homepage
              </p>
              <Button onClick={handleCreateFeatured}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Product
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {SECTIONS.map((section) => {
                const sectionProducts = featuredProducts.filter(
                  (fp) => fp.section === section.value
                );
                if (sectionProducts.length === 0) return null;

                return (
                  <div key={section.value}>
                    <h3 className="text-md font-medium text-gray-900 mb-4">
                      {section.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sectionProducts.map((fp) => (
                        <div
                          key={fp.id}
                          className="bg-white rounded-lg border p-4 flex items-center gap-4"
                        >
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {fp.customTitle || fp.product?.name || 'Unknown Product'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {fp.productType} • Order: {fp.displayOrder}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleFeatured(fp)}
                              className={`p-1.5 rounded-full ${
                                fp.isActive
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {fp.isActive ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEditFeatured(fp)}
                              className="p-1.5 text-gray-600 hover:text-coral-600 hover:bg-coral-50 rounded-full"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFeatured(fp.id)}
                              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-full"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hero Slide Modal */}
      {showHeroModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-lg bg-white max-h-[92vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingHeroSlide ? 'Edit Hero Slide' : 'Add Hero Slide'}
              </h2>
              <button
                onClick={() => setShowHeroModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitHeroSlide} className="flex h-[calc(92vh-88px)] flex-col">
              <div className="space-y-4 overflow-y-auto p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={heroFormData.title}
                  onChange={(e) =>
                    setHeroFormData({ ...heroFormData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                  placeholder="e.g., Wear the Story"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle *
                </label>
                <textarea
                  required
                  value={heroFormData.subtitle}
                  onChange={(e) =>
                    setHeroFormData({ ...heroFormData, subtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                  rows={2}
                  placeholder="e.g., Discover authentic African fashion..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL *
                </label>
                <div className="space-y-2">
                  <input
                    type="url"
                    required
                    value={heroFormData.image}
                    onChange={(e) =>
                      setHeroFormData({ ...heroFormData, image: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    placeholder="https://..."
                  />
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingHeroImage ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleHeroImageUpload}
                        disabled={uploadingHeroImage}
                      />
                    </label>
                    {heroFormData.image ? (
                      <span className="text-xs text-green-700">Image selected</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CTA Text
                  </label>
                  <input
                    type="text"
                    value={heroFormData.ctaText}
                    onChange={(e) =>
                      setHeroFormData({ ...heroFormData, ctaText: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    placeholder="e.g., Shop Now"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CTA Link
                  </label>
                  <input
                    type="text"
                    value={heroFormData.ctaLink}
                    onChange={(e) =>
                      setHeroFormData({ ...heroFormData, ctaLink: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    placeholder="e.g., /designs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={heroFormData.displayOrder}
                  onChange={(e) =>
                    setHeroFormData({
                      ...heroFormData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                />
              </div>
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowHeroModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingHeroSlide ? 'Update Slide' : 'Add Slide'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Featured Product Modal */}
      {showFeaturedModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-lg bg-white max-h-[92vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {editingFeatured ? 'Edit Featured Product' : 'Add Featured Product'}
              </h2>
              <button
                onClick={() => setShowFeaturedModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitFeatured} className="flex h-[calc(92vh-88px)] flex-col">
              <div className="space-y-4 overflow-y-auto p-6">
              {!editingFeatured && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Type *
                    </label>
                    <select
                      value={featuredFormData.productType}
                      onChange={(e) => handleProductTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    >
                      <option value="DESIGN">Design</option>
                      <option value="FABRIC">Fabric</option>
                      <option value="READY_TO_WEAR">Ready To Wear</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product *
                    </label>
                    <select
                      required
                      value={featuredFormData.productId}
                      onChange={(e) =>
                        setFeaturedFormData({
                          ...featuredFormData,
                          productId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    >
                      <option value="">Select a product</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.designer?.businessName || p.seller?.businessName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Section *
                    </label>
                    <select
                      required
                      value={featuredFormData.section}
                      onChange={(e) =>
                        setFeaturedFormData({
                          ...featuredFormData,
                          section: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                    >
                      {SECTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Title (optional)
                </label>
                <input
                  type="text"
                  value={featuredFormData.customTitle}
                  onChange={(e) =>
                    setFeaturedFormData({
                      ...featuredFormData,
                      customTitle: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                  placeholder="Override the product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Description (optional)
                </label>
                <textarea
                  value={featuredFormData.customDescription}
                  onChange={(e) =>
                    setFeaturedFormData({
                      ...featuredFormData,
                      customDescription: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                  rows={2}
                  placeholder="Override the product description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={featuredFormData.displayOrder}
                  onChange={(e) =>
                    setFeaturedFormData({
                      ...featuredFormData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-coral-500"
                />
              </div>
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowFeaturedModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingFeatured ? 'Update' : 'Add to Featured'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

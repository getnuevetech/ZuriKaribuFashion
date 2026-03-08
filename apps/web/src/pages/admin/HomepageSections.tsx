import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload, X, Globe, Sparkles, ShoppingBag, User, BookOpen, MessageSquare, Layout, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

type SectionType = 'topStrip' | 'countries' | 'howItWorks' | 'categories' | 'designerSpotlight' | 'heritage' | 'testimonials' | 'footer';

interface TopStripContent {
  messages: string[];
  separator: string;
  repeatCount: number;
  animationSeconds: number;
  textColor: string;
  backgroundColor: string;
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
}

interface Country {
  id: string;
  name: string;
  flag: string;
  image: string;
  fabrics: string;
  displayOrder: number;
  isActive: boolean;
}

interface HowItWorksStep {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
}

interface ShopCategory {
  id: string;
  key: string;
  title: string;
  description: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  displayOrder: number;
  isActive: boolean;
}

interface DesignerSpotlight {
  id: string;
  designerId: string;
  quote: string;
  bio: string;
  image: string;
  displayOrder: number;
  isActive: boolean;
  designer?: {
    businessName: string;
    country: string;
  };
}

interface HeritageSection {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaText?: string;
  ctaLink?: string;
  displayOrder: number;
  isActive: boolean;
}

interface Testimonial {
  id: string;
  name: string;
  initials: string;
  location: string;
  avatar: string;
  quote: string;
  displayOrder: number;
  isActive: boolean;
}

interface FooterContent {
  id: string;
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  socialLinks?: string;
  copyright: string;
}

interface VisibilitySection {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

interface DesignerOption {
  id: string;
  businessName: string;
  country: string;
}

const TABS = [
  { id: 'topStrip' as SectionType, label: 'Top Strip', icon: Layout },
  { id: 'countries' as SectionType, label: 'Countries', icon: Globe },
  { id: 'howItWorks' as SectionType, label: 'How It Works', icon: Sparkles },
  { id: 'categories' as SectionType, label: 'Categories', icon: ShoppingBag },
  { id: 'designerSpotlight' as SectionType, label: 'Designer Spotlight', icon: User },
  { id: 'heritage' as SectionType, label: 'Heritage', icon: BookOpen },
  { id: 'testimonials' as SectionType, label: 'Testimonials', icon: MessageSquare },
  { id: 'footer' as SectionType, label: 'Footer', icon: Layout },
];

export default function HomepageSections() {
  const [activeTab, setActiveTab] = useState<SectionType>('topStrip');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [howItWorks, setHowItWorks] = useState<HowItWorksStep[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [designerSpotlights, setDesignerSpotlights] = useState<DesignerSpotlight[]>([]);
  const [heritageSections, setHeritageSections] = useState<HeritageSection[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [footerContents, setFooterContents] = useState<FooterContent[]>([]);
  const [topStripContent, setTopStripContent] = useState<TopStripContent | null>(null);
  const [visibilitySections, setVisibilitySections] = useState<VisibilitySection[]>([]);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [designerOptions, setDesignerOptions] = useState<DesignerOption[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    fetchVisibility();
  }, []);

  useEffect(() => {
    fetchAuxiliaryOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'topStrip':
          const topStripRes = await api.homepageSections.getAdminTopStrip();
          if (topStripRes.success) setTopStripContent(topStripRes.data);
          break;
        case 'countries':
          const countriesRes = await api.homepageSections.getAdminCountries();
          if (countriesRes.success) setCountries(countriesRes.data);
          break;
        case 'howItWorks':
          const howItWorksRes = await api.homepageSections.getAdminHowItWorks();
          if (howItWorksRes.success) setHowItWorks(howItWorksRes.data);
          break;
        case 'categories':
          const categoriesRes = await api.homepageSections.getAdminCategories();
          if (categoriesRes.success) setCategories(categoriesRes.data);
          break;
        case 'designerSpotlight':
          const spotlightRes = await api.homepageSections.getAdminDesignerSpotlights();
          if (spotlightRes.success) setDesignerSpotlights(spotlightRes.data);
          break;
        case 'heritage':
          const heritageRes = await api.homepageSections.getAdminHeritage();
          if (heritageRes.success) setHeritageSections(heritageRes.data);
          break;
        case 'testimonials':
          const testimonialsRes = await api.homepageSections.getAdminTestimonials();
          if (testimonialsRes.success) setTestimonials(testimonialsRes.data);
          break;
        case 'footer':
          const footerRes = await api.homepageSections.getAdminFooter();
          if (footerRes.success && footerRes.data) setFooterContents([footerRes.data]);
          if (footerRes.success && !footerRes.data) setFooterContents([]);
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisibility = async () => {
    setVisibilityLoading(true);
    try {
      const response = await api.homepageSections.getAdminVisibility();
      if (response.success) {
        setVisibilitySections(response.data.sections || []);
      }
    } catch (error) {
      console.error('Error fetching homepage visibility:', error);
    } finally {
      setVisibilityLoading(false);
    }
  };

  const fetchAuxiliaryOptions = async () => {
    try {
      const [countryOptionsRes, designerOptionsRes] = await Promise.all([
        api.homepageSections.getAdminCountryOptions(),
        api.homepageSections.getAdminDesignerOptions(),
      ]);
      if (countryOptionsRes.success) {
        setCountryOptions(countryOptionsRes.data || []);
      }
      if (designerOptionsRes.success) {
        setDesignerOptions(designerOptionsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching homepage auxiliary options:', error);
    }
  };

  const handleToggleVisibility = async (key: string, enabled: boolean) => {
    const nextVisibility = visibilitySections.reduce<Record<string, boolean>>((acc, section) => {
      acc[section.key] = section.key === key ? !enabled : section.enabled;
      return acc;
    }, {});

    setVisibilitySections((prev) =>
      prev.map((section) =>
        section.key === key
          ? {
              ...section,
              enabled: !enabled,
            }
          : section
      )
    );

    try {
      const response = await api.homepageSections.updateAdminVisibility(nextVisibility);
      if (response.success) {
        setVisibilitySections(response.data.sections || []);
      }
    } catch (error) {
      console.error('Error updating homepage visibility:', error);
      await fetchVisibility();
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      let response;
      switch (activeTab) {
        case 'countries':
          const country = countries.find(c => c.id === id);
          if (country) {
            response = await api.homepageSections.updateCountry(id, { ...country, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'howItWorks':
          const step = howItWorks.find(s => s.id === id);
          if (step) {
            response = await api.homepageSections.updateHowItWorksStep(id, { ...step, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'categories':
          const cat = categories.find(c => c.id === id);
          if (cat) {
            response = await api.homepageSections.updateCategory(id, { ...cat, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'designerSpotlight':
          const spotlight = designerSpotlights.find(s => s.id === id);
          if (spotlight) {
            response = await api.homepageSections.updateDesignerSpotlight(id, { ...spotlight, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'heritage':
          const heritage = heritageSections.find(h => h.id === id);
          if (heritage) {
            response = await api.homepageSections.updateHeritage(id, { ...heritage, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
        case 'testimonials':
          const testimonial = testimonials.find(t => t.id === id);
          if (testimonial) {
            response = await api.homepageSections.updateTestimonial(id, { ...testimonial, isActive: !currentStatus });
            if (response.success) fetchData();
          }
          break;
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      let response;
      switch (activeTab) {
        case 'countries':
          response = await api.homepageSections.deleteCountry(id);
          break;
        case 'howItWorks':
          response = await api.homepageSections.deleteHowItWorksStep(id);
          break;
        case 'categories':
          response = await api.homepageSections.deleteCategory(id);
          break;
        case 'designerSpotlight':
          response = await api.homepageSections.deleteDesignerSpotlight(id);
          break;
        case 'heritage':
          response = await api.homepageSections.deleteHeritage(id);
          break;
        case 'testimonials':
          response = await api.homepageSections.deleteTestimonial(id);
          break;
      }
      if (response?.success) fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const openModal = (item: any = null) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setEditingItem(null);
    setShowModal(false);
  };

  const handleSave = () => {
    fetchData();
    closeModal();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homepage Sections</h1>
          <p className="text-gray-500 mt-1">Manage all dynamic homepage content</p>
        </div>
        <Button onClick={() => openModal(activeTab === 'topStrip' ? topStripContent : null)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {activeTab === 'topStrip' ? 'Edit Top Strip' : 'Add New'}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Frontpage Section Visibility</h2>
          <p className="text-sm text-gray-500">Enable or disable entire homepage blocks instantly.</p>
        </div>
        {visibilityLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading section visibility...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibilitySections.map((section) => (
              <div
                key={section.key}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div className="pr-3">
                  <p className="text-sm font-medium text-gray-900">{section.label}</p>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
                <button
                  onClick={() => handleToggleVisibility(section.key, section.enabled)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    section.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {section.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <>
            {activeTab === 'topStrip' && (
              <TopStripTable
                data={topStripContent}
                onEdit={() => openModal(topStripContent)}
              />
            )}
            {activeTab === 'countries' && (
              <CountriesTable
                data={countries}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'howItWorks' && (
              <HowItWorksTable
                data={howItWorks}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'categories' && (
              <CategoriesTable
                data={categories}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'designerSpotlight' && (
              <DesignerSpotlightTable
                data={designerSpotlights}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'heritage' && (
              <HeritageTable
                data={heritageSections}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'testimonials' && (
              <TestimonialsTable
                data={testimonials}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'footer' && (
              <FooterTable
                data={footerContents}
                onEdit={openModal}
                onToggle={handleToggleActive}
                onDelete={handleDelete}
              />
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <SectionModal
          type={activeTab}
          item={editingItem}
          countryOptions={countryOptions}
          designers={designerOptions}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// Table Components
function TopStripTable({ data, onEdit }: { data: TopStripContent | null; onEdit: () => void }) {
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return (
    <div className="p-6 space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Top Announcement Strip</h3>
            <p className="text-xs text-gray-500">
              This controls the scrolling message bar above the hero banner.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Separator: {data?.separator || '•'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Repeat count: {data?.repeatCount ?? 4}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                Animation: {data?.animationSeconds ?? 20}s
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.textColor || '#ffffff' }}
                />
                Text: {data?.textColor || '#ffffff'}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1 inline-flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded border border-gray-300"
                  style={{ backgroundColor: data?.backgroundColor || '#000000' }}
                />
                Background: {data?.backgroundColor || '#000000'}
              </span>
            </div>
            <div className="space-y-1">
              {messages.length > 0 ? (
                messages.map((message, idx) => (
                  <p key={`${idx}-${message}`} className="text-sm text-gray-700">
                    • {message}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500">No top strip message configured yet.</p>
              )}
            </div>
          </div>
          <Button onClick={onEdit} className="inline-flex items-center gap-2 self-start">
            <Edit2 className="h-4 w-4" />
            Edit Top Strip
          </Button>
        </div>
      </div>
    </div>
  );
}

function CountriesTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flag</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fabrics</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: Country) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.name} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-2xl">{item.flag}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.fabrics}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HowItWorksTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtitle</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: HowItWorksStep) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.stepNumber}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.title}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.subtitle}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.icon}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoriesTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTA</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: ShopCategory) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.title} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.key}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.description}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.ctaText} → {item.ctaLink}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignerSpotlightTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designer</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bio</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: DesignerSpotlight) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.designer?.businessName} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.designer?.businessName || 'Unknown'}</span>
              </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{item.quote}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.bio}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HeritageTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtitle</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTA</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: HeritageSection) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.image && (
                  <img src={item.image} alt={item.title} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.title}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.subtitle}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.ctaText || '-'} {item.ctaLink ? `→ ${item.ctaLink}` : ''}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TestimonialsTable({ data, onEdit, onToggle, onDelete }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initials</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: Testimonial) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.displayOrder}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                {item.avatar && (
                  <img src={item.avatar} alt={item.name} className="h-10 w-10 object-cover mr-3" />
                )}
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.location}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.initials}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.quote}</td>
            <td className="px-6 py-4 whitespace-nowrap">
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => onToggle(item.id, item.isActive)} className="text-gray-400 hover:text-gray-600">
                  {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(item.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FooterTable({ data, onEdit }: any) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tagline</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((item: FooterContent) => (
          <tr key={item.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.companyName}</td>
            <td className="px-6 py-4 text-sm text-gray-500">{item.email} · {item.phone}</td>
            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.tagline}</td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button onClick={() => onEdit(item)} className="text-amber-600 hover:text-amber-900">
                <Edit2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Modal Component
function SectionModal({
  type,
  item,
  countryOptions,
  designers,
  onClose,
  onSave,
}: {
  type: SectionType;
  item: any;
  countryOptions: CountryOption[];
  designers: DesignerOption[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<any>(() => {
    if (type === 'topStrip' && item) {
      return {
        ...item,
        messagesText: Array.isArray(item.messages) ? item.messages.join('\n') : '',
        textColor: item.textColor || '#ffffff',
        backgroundColor: item.backgroundColor || '#000000',
      };
    }
    return item || getDefaultFormData(type);
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  function getDefaultFormData(sectionType: SectionType) {
    switch (sectionType) {
      case 'topStrip':
        return {
          messagesText: 'Free shipping on orders over $250\nNew arrivals weekly\nAuthentic African designs',
          separator: '•',
          repeatCount: 4,
          animationSeconds: 20,
          textColor: '#ffffff',
          backgroundColor: '#000000',
        };
      case 'countries':
        return { countryCode: '', name: '', flag: '', image: '', fabrics: '', displayOrder: 0, isActive: true };
      case 'howItWorks':
        return { stepNumber: 1, title: '', subtitle: '', icon: 'Sparkles', displayOrder: 0, isActive: true };
      case 'categories':
        return { key: '', title: '', description: '', image: '', ctaText: 'Shop Now', ctaLink: '', displayOrder: 0, isActive: true };
      case 'designerSpotlight':
        return { designerId: '', quote: '', bio: '', image: '', displayOrder: 0, isActive: true };
      case 'heritage':
        return { title: '', subtitle: '', image: '', ctaText: 'Read Our Story', ctaLink: '/about', displayOrder: 0, isActive: true };
      case 'testimonials':
        return { name: '', initials: '', location: '', quote: '', avatar: '', displayOrder: 0, isActive: true };
      case 'footer':
        return { companyName: '', tagline: '', email: '', phone: '', address: '', socialLinks: '', copyright: '' };
      default:
        return {};
    }
  }

  const countryOptionByCode = new Map(countryOptions.map((option) => [option.code, option]));
  const countryOptionByName = new Map(countryOptions.map((option) => [option.name.toLowerCase(), option]));

  useEffect(() => {
    if (type !== 'countries') return;
    const name = String(formData?.name || '').trim().toLowerCase();
    const existingCode = String(formData?.countryCode || '').trim().toUpperCase();
    const option =
      (existingCode ? countryOptionByCode.get(existingCode) : undefined) ||
      (name ? countryOptionByName.get(name) : undefined);
    if (!option) return;
    if (existingCode === option.code && String(formData?.flag || '') === option.flag) return;
    setFormData((prev: any) => ({
      ...prev,
      countryCode: option.code,
      name: prev?.name || option.name,
      flag: option.flag,
    }));
  }, [type, countryOptions]);

  const handleCountryCodeChange = (countryCode: string) => {
    const option = countryOptionByCode.get(String(countryCode || '').toUpperCase());
    setFormData((prev: any) => ({
      ...prev,
      countryCode: option?.code || countryCode,
      name: option?.name || prev?.name || '',
      flag: option?.flag || prev?.flag || '',
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response.success) {
        setFormData((prev: any) => ({ ...prev, [field]: response.data.url }));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = (() => {
        if (type === 'topStrip') {
          const rawMessages =
            typeof formData.messagesText === 'string'
              ? formData.messagesText
              : Array.isArray(formData.messages)
                ? formData.messages.join('\n')
                : '';
          const messages = rawMessages
            .split('\n')
            .map((entry: string) => entry.trim())
            .filter(Boolean);
          if (messages.length === 0) {
            throw new Error('Please enter at least one scrolling message.');
          }
          return {
            messages,
            separator: String(formData.separator || '').trim() || '•',
            repeatCount: Number(formData.repeatCount) || 4,
            animationSeconds: Number(formData.animationSeconds) || 20,
            textColor: String(formData.textColor || '#ffffff').trim().toLowerCase(),
            backgroundColor: String(formData.backgroundColor || '#000000').trim().toLowerCase(),
          };
        }
        if (type === 'categories') {
          const title = String(formData.title || '').trim();
          const key = String(formData.key || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return { ...formData, key };
        }
        if (type === 'testimonials') {
          const initials =
            String(formData.initials || '').trim() ||
            String(formData.name || '')
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() || '')
              .join('');
          return { ...formData, initials };
        }
        if (type === 'footer') {
          return {
            companyName: formData.companyName || undefined,
            tagline: formData.tagline || undefined,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            address: formData.address || undefined,
            socialLinks: formData.socialLinks || undefined,
            copyright: formData.copyright || undefined,
          };
        }
        return formData;
      })();

      let response;
      if (item?.id) {
        // Update existing
        switch (type) {
          case 'topStrip':
            response = await api.homepageSections.updateAdminTopStrip(payload);
            break;
          case 'countries':
            response = await api.homepageSections.updateCountry(item.id, payload);
            break;
          case 'howItWorks':
            response = await api.homepageSections.updateHowItWorksStep(item.id, payload);
            break;
          case 'categories':
            response = await api.homepageSections.updateCategory(item.id, payload);
            break;
          case 'designerSpotlight':
            response = await api.homepageSections.updateDesignerSpotlight(item.id, payload);
            break;
          case 'heritage':
            response = await api.homepageSections.updateHeritage(item.id, payload);
            break;
          case 'testimonials':
            response = await api.homepageSections.updateTestimonial(item.id, payload);
            break;
          case 'footer':
            response = await api.homepageSections.updateFooter(item.id, payload);
            break;
        }
      } else {
        // Create new
        switch (type) {
          case 'topStrip':
            response = await api.homepageSections.updateAdminTopStrip(payload);
            break;
          case 'countries':
            response = await api.homepageSections.createCountry(payload);
            break;
          case 'howItWorks':
            response = await api.homepageSections.createHowItWorksStep(payload);
            break;
          case 'categories':
            response = await api.homepageSections.createCategory(payload);
            break;
          case 'designerSpotlight':
            response = await api.homepageSections.createDesignerSpotlight(payload);
            break;
          case 'heritage':
            response = await api.homepageSections.createHeritage(payload);
            break;
          case 'testimonials':
            response = await api.homepageSections.createTestimonial(payload);
            break;
          case 'footer':
            response = await api.homepageSections.createFooter(payload);
            break;
        }
      }
      if (response?.success) {
        onSave();
      } else {
        throw new Error('Unable to save this section right now.');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      const message =
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        'Failed to save changes.';
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => {
    switch (type) {
      case 'topStrip':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scrolling Messages (one per line)</label>
              <textarea
                value={
                  typeof formData.messagesText === 'string'
                    ? formData.messagesText
                    : Array.isArray(formData.messages)
                      ? formData.messages.join('\n')
                      : ''
                }
                onChange={(e) => setFormData({ ...formData, messagesText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Separator</label>
                <input
                  type="text"
                  value={formData.separator || '•'}
                  onChange={(e) => setFormData({ ...formData, separator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                <input
                  type="number"
                  value={formData.repeatCount || 4}
                  onChange={(e) => setFormData({ ...formData, repeatCount: parseInt(e.target.value, 10) || 4 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={2}
                  max={12}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Animation Seconds</label>
                <input
                  type="number"
                  value={formData.animationSeconds || 20}
                  onChange={(e) => setFormData({ ...formData, animationSeconds: parseInt(e.target.value, 10) || 20 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  min={8}
                  max={120}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.textColor || '#ffffff'}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="h-10 w-14 rounded border border-gray-300 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={formData.textColor || '#ffffff'}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.backgroundColor || '#000000'}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="h-10 w-14 rounded border border-gray-300 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={formData.backgroundColor || '#000000'}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </>
        );
      case 'countries':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={formData.countryCode || ''}
                onChange={(e) => handleCountryCodeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              >
                <option value="">Select country</option>
                {countryOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.flag} {option.name} ({option.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auto Flag</label>
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-2xl">
                {formData.flag || '🌍'}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Flag icon is auto-filled based on country selection.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabrics</label>
              <input
                type="text"
                value={formData.fabrics || ''}
                onChange={(e) => setFormData({ ...formData, fabrics: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Kente, Adinkra"
              />
            </div>
          </>
        );
      case 'howItWorks':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Number</label>
              <input
                type="number"
                value={formData.stepNumber || 1}
                onChange={(e) => setFormData({ ...formData, stepNumber: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <textarea
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon Name</label>
              <input
                type="text"
                value={formData.icon || ''}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Search, Eye, Sparkles..."
                required
              />
            </div>
          </>
        );
      case 'categories':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (slug)</label>
              <input
                type="text"
                value={formData.key || ''}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="ready-to-wear"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input
                type="text"
                value={formData.ctaText || ''}
                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Shop Now"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
              <input
                type="text"
                value={formData.ctaLink || ''}
                onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="/designs"
                required
              />
            </div>
          </>
        );
      case 'designerSpotlight':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designer</label>
              <select
                value={formData.designerId || ''}
                onChange={(e) => setFormData({ ...formData, designerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              >
                <option value="">Select designer</option>
                {designers.map((designer) => (
                  <option key={designer.id} value={designer.id}>
                    {designer.businessName} ({designer.country})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote</label>
              <textarea
                value={formData.quote || ''}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={2}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                required
              />
            </div>
          </>
        );
      case 'heritage':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
              <input
                type="text"
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input
                type="text"
                value={formData.ctaText || ''}
                onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="Read Our Story"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTA Link</label>
              <input
                type="text"
                value={formData.ctaLink || ''}
                onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="/about"
              />
            </div>
          </>
        );
      case 'testimonials':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="New York, USA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initials</label>
              <input
                type="text"
                value={formData.initials || ''}
                onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="AJ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quote</label>
              <textarea
                value={formData.quote || ''}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={4}
                required
              />
            </div>
          </>
        );
      case 'footer':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.companyName || ''}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="ZuriKaribu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Social Links JSON</label>
              <textarea
                value={formData.socialLinks || ''}
                onChange={(e) => setFormData({ ...formData, socialLinks: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                rows={3}
                placeholder='{"instagram":"https://...","facebook":"https://...","twitter":"https://..."}'
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Copyright</label>
              <input
                type="text"
                value={formData.copyright || ''}
                onChange={(e) => setFormData({ ...formData, copyright: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Edit' : 'Add'} {type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {renderFormFields()}

          {/* Image Upload */}
          {(type === 'countries' || type === 'categories' || type === 'designerSpotlight' || type === 'heritage' || type === 'testimonials') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
              <div className="flex items-center gap-4">
                {(type === 'testimonials' ? formData.avatar : formData.image) && (
                  <img src={type === 'testimonials' ? formData.avatar : formData.image} alt="Preview" className="h-20 w-20 object-cover" />
                )}
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, type === 'testimonials' ? 'avatar' : 'image')}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Display Order */}
          {type !== 'footer' && type !== 'topStrip' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={formData.displayOrder || 0}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                min={0}
              />
            </div>
          )}

          {/* Active Status */}
          {type !== 'footer' && type !== 'topStrip' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={!!formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? 'Saving...' : item ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

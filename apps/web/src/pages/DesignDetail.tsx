import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  MapPin, 
  Star, 
  Ruler, 
  Shirt,
  ShoppingBag,
  Eye,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

interface Design {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  images: string[];
  category: { id: string; name: string };
  designer: {
    id: string;
    businessName: string;
    country: string;
    city: string;
    profileImage?: string;
  };
  suitableFabrics: Array<{
    fabric: {
      id: string;
      name: string;
      images: string[];
      pricePerMeter: number;
      seller: {
        businessName: string;
        country: string;
      };
    };
    minMeters: number;
    maxMeters: number;
  }>;
  measurements: Array<{
    name: string;
    description: string;
    unit: string;
    isRequired: boolean;
  }>;
  rating: number;
  reviewCount: number;
  orderCount: number;
}

export default function DesignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedFabric, setSelectedFabric] = useState<string | null>(null);
  const [fabricMeters, setFabricMeters] = useState<Record<string, number>>({});
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'fabrics' | 'measurements'>('details');

  useEffect(() => {
    fetchDesign();
  }, [id]);

  const fetchDesign = async () => {
    try {
      setLoading(true);
      const response = await api.products.getDesign(id!);
      if (response.success) {
        setDesign(response.data);
        // Initialize fabric meters
        const initialMeters: Record<string, number> = {};
        response.data.suitableFabrics.forEach((sf: any) => {
          initialMeters[sf.fabric.id] = sf.minMeters;
        });
        setFabricMeters(initialMeters);
      }
    } catch (error) {
      console.error('Failed to fetch design:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!selectedFabric) {
      setActiveTab('fabrics');
      return;
    }
    
    if (!user) {
      navigate('/login');
      return;
    }

    const fabric = design?.suitableFabrics.find(sf => sf.fabric.id === selectedFabric);
    if (!fabric || !design) return;

    const cartItem = {
      designId: design.id,
      designName: design.name,
      designImage: design.images[0],
      fabricId: fabric.fabric.id,
      fabricName: fabric.fabric.name,
      fabricImage: fabric.fabric.images[0],
      fabricMeters: fabricMeters[selectedFabric],
      fabricPrice: fabric.fabric.pricePerMeter,
      designerId: design.designer.id,
      designerName: design.designer.businessName,
      measurements,
      basePrice: design.basePrice,
      totalPrice: calculateTotal(),
    };

    addItem(cartItem);
    navigate('/cart');
  };

  const handleTryOn = () => {
    if (!selectedFabric) {
      setActiveTab('fabrics');
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/try-on/${id}?fabric=${selectedFabric}`);
  };

  const calculateTotal = () => {
    if (!design || !selectedFabric) return 0;
    const fabric = design.suitableFabrics.find(sf => sf.fabric.id === selectedFabric);
    if (!fabric) return design.basePrice;
    const meters = fabricMeters[selectedFabric] || fabric.minMeters;
    return design.basePrice + (fabric.fabric.pricePerMeter * meters);
  };

  const handleMeasurementChange = (name: string, value: number) => {
    setMeasurements(prev => ({ ...prev, [name]: value }));
  };

  const areAllRequiredMeasurementsFilled = () => {
    if (!design) return false;
    return design.measurements
      .filter(m => m.isRequired)
      .every(m => measurements[m.name] && measurements[m.name] > 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Design Not Found</h2>
          <p className="text-gray-600 mb-4">The design you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/designs')}>Browse Designs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate('/designs')}
            className="flex items-center text-gray-600 hover:text-amber-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Designs
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative bg-gray-100 overflow-hidden" style={{ aspectRatio: '4/5' }}>
              <img
                src={design.images[selectedImage]}
                alt={design.name}
                className="w-full h-full object-cover"
              />
              {design.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage(prev => prev === 0 ? design.images.length - 1 : prev - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImage(prev => prev === design.images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
              </button>
            </div>
            
            {/* Thumbnails */}
            {design.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {design.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`flex-shrink-0 w-20 h-20 overflow-hidden border-2 transition-colors ${
                      selectedImage === idx ? 'border-amber-600' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <Badge variant="secondary">{design.category.name}</Badge>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <Share2 className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{design.name}</h1>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{design.rating.toFixed(1)}</span>
                  <span className="text-gray-500">({design.reviewCount} reviews)</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">{design.orderCount} orders</span>
              </div>
            </div>

            {/* Designer Info */}
            <div className="flex items-center gap-4 p-4 bg-white rounded-xl border">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-amber-700">
                  {design.designer.businessName.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{design.designer.businessName}</h3>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="w-4 h-4" />
                  {design.designer.city}, {design.designer.country}
                </div>
              </div>
              <Button variant="outline" size="sm">View Profile</Button>
            </div>

            {/* Price */}
            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-700">
                  ${calculateTotal().toFixed(2)}
                </span>
                <span className="text-gray-500">total price</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Base: ${design.basePrice} + Fabric (varies by selection)
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-6">
                {(['details', 'fabrics', 'measurements'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                      activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <p className="text-gray-600 leading-relaxed">{design.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <Shirt className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">Custom Made</p>
                        <p className="text-xs text-gray-500">To your measurements</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <Ruler className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium">Perfect Fit</p>
                        <p className="text-xs text-gray-500">Guaranteed fit policy</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fabrics' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Select a fabric for your design. All fabrics are from sellers in the same country as your designer.
                  </p>
                  <div className="space-y-3">
                    {design.suitableFabrics.map(({ fabric, minMeters, maxMeters }) => (
                      <div
                        key={fabric.id}
                        onClick={() => setSelectedFabric(fabric.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedFabric === fabric.id 
                            ? 'border-amber-600 bg-amber-50' 
                            : 'border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex gap-4">
                          <img
                            src={fabric.images[0]}
                            alt={fabric.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">{fabric.name}</h4>
                                <p className="text-sm text-gray-500">{fabric.seller.businessName}</p>
                                <p className="text-sm text-gray-500">{fabric.seller.country}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-amber-700">
                                  ${fabric.pricePerMeter}/meter
                                </p>
                                <p className="text-xs text-gray-500">
                                  {minMeters}-{maxMeters} meters needed
                                </p>
                              </div>
                            </div>
                            {selectedFabric === fabric.id && (
                              <div className="mt-3 pt-3 border-t border-amber-200">
                                <label className="text-sm font-medium text-gray-700">
                                  Meters: {fabricMeters[fabric.id]}
                                </label>
                                <input
                                  type="range"
                                  min={minMeters}
                                  max={maxMeters}
                                  step={0.5}
                                  value={fabricMeters[fabric.id] || minMeters}
                                  onChange={(e) => setFabricMeters(prev => ({
                                    ...prev,
                                    [fabric.id]: parseFloat(e.target.value)
                                  }))}
                                  className="w-full mt-1"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'measurements' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Enter your measurements for a perfect fit.
                    </p>
                    <button
                      onClick={() => setShowMeasurementModal(true)}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                    >
                      How to measure?
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {design.measurements.map((measurement) => (
                      <div key={measurement.name} className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">
                          {measurement.name}
                          {measurement.isRequired && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={measurements[measurement.name] || ''}
                            onChange={(e) => handleMeasurementChange(measurement.name, parseFloat(e.target.value))}
                            placeholder={measurement.description}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                            {measurement.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleTryOn}
                disabled={!selectedFabric}
              >
                <Eye className="w-4 h-4 mr-2" />
                Virtual Try-On
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddToCart}
                disabled={!selectedFabric}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </div>

            {!selectedFabric && (
              <p className="text-sm text-amber-600 text-center">
                Please select a fabric to continue
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Measurement Guide Modal */}
      {showMeasurementModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">How to Measure</h3>
                <button 
                  onClick={() => setShowMeasurementModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {design.measurements.map((m) => (
                  <div key={m.name} className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-1">{m.name}</h4>
                    <p className="text-sm text-gray-600">{m.description}</p>
                    <p className="text-sm text-amber-600 mt-1">Unit: {m.unit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

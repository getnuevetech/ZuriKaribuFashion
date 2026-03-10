import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Camera,
  ChevronLeft,
  Share2,
  Download,
  ShoppingBag,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

// 3D Avatar Component
function Avatar({ measurements, garmentUrl, fabricColor }: { 
  measurements: Record<string, number>;
  garmentUrl?: string;
  fabricColor: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  // Procedural mannequin based on measurements
  const bust = measurements.bust || 90;
  const waist = measurements.waist || 70;
  const hips = measurements.hips || 95;
  const height = measurements.height || 170;

  const bustScale = bust / 90;
  const waistScale = waist / 70;
  const hipsScale = hips / 95;
  const heightScale = height / 170;

  return (
    <group>
      {/* Base Mannequin */}
      <mesh 
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Torso */}
        <cylinderGeometry args={[0.35 * bustScale, 0.25 * waistScale, 0.6 * heightScale, 32]} />
        <meshStandardMaterial 
          color={hovered ? '#f5e6d3' : '#e8d5c4'} 
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      
      {/* Hips */}
      <mesh position={[0, -0.4 * heightScale, 0]}>
        <cylinderGeometry args={[0.28 * hipsScale, 0.3 * hipsScale, 0.3 * heightScale, 32]} />
        <meshStandardMaterial color="#e8d5c4" roughness={0.6} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.4 * heightScale, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.15 * heightScale, 16]} />
        <meshStandardMaterial color="#e8d5c4" roughness={0.6} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.65 * heightScale, 0]}>
        <sphereGeometry args={[0.18 * heightScale, 32, 32]} />
        <meshStandardMaterial color="#e8d5c4" roughness={0.6} />
      </mesh>

      {/* Garment Overlay */}
      <mesh position={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.36 * bustScale, 0.26 * waistScale, 0.55 * heightScale, 32]} />
        <meshStandardMaterial 
          color={fabricColor} 
          roughness={0.8}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Pattern/Design Details */}
      <mesh position={[0, 0.1, 0.08]}>
        <torusGeometry args={[0.15 * bustScale, 0.02, 8, 32]} />
        <meshStandardMaterial color="#d4a574" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

// Loading Component
function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        <p className="mt-4 text-amber-700 font-medium">Generating Avatar...</p>
      </div>
    </Html>
  );
}

// Scene Component
function Scene({ measurements, fabricColor }: { 
  measurements: Record<string, number>;
  fabricColor: string;
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Environment preset="studio" />
      <Suspense fallback={<Loader />}>
        <Avatar measurements={measurements} fabricColor={fabricColor} />
      </Suspense>
      <OrbitControls 
        enablePan={false} 
        enableZoom={true}
        minDistance={2}
        maxDistance={5}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export default function TryOn() {
  const { id } = useParams<{ id: string }>;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { items, addItem } = useCartStore();
  const { formatFromUsd } = useCurrencyStore();
  
  const fabricId = searchParams.get('fabric');
  const [design, setDesign] = useState<any>(null);
  const [fabric, setFabric] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [avatarGenerated, setAvatarGenerated] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'ar'>('3d');
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, [id, fabricId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [designRes, fabricRes] = await Promise.all([
        api.products.getDesignById(id!),
        fabricId ? api.products.getFabricById(fabricId) : Promise.resolve(null)
      ]);
      
      if (designRes.success) {
        setDesign(designRes.data);
      }
      if (fabricRes?.success) {
        setFabric(fabricRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateAvatar = async () => {
    setGenerating(true);
    // Simulate avatar generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setAvatarGenerated(true);
    setGenerating(false);
  };

  const handleAddToCart = () => {
    if (!design || !fabric) return;
    
    const cartItem = {
      designId: design.id,
      designName: design.name,
      designImage: design.images[0],
      fabricId: fabric.id,
      fabricName: fabric.name,
      fabricImage: fabric.images[0],
      fabricMeters: 3,
      fabricPrice: fabric.pricePerMeter,
      designerId: design.designer.id,
      designerName: design.designer.businessName,
      measurements,
      basePrice: design.basePrice,
      totalPrice: design.basePrice + (fabric.pricePerMeter * 3),
      tryOnImage: null, // Would capture canvas
    };

    addItem(cartItem);
    navigate('/cart');
  };

  const handleScreenshot = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `try-on-${design?.name || 'design'}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const fabricColors: Record<string, string> = {
    'Ankara': '#ff6b35',
    'Kente': '#ffd700',
    'Aso Oke': '#8b4513',
    'Adire': '#4a0080',
    'Batik': '#2d5016',
    'Lace': '#f8e8e8',
    'Silk': '#e8d5c4',
    'Cotton': '#ffffff',
  };

  const getFabricColor = () => {
    if (!fabric) return '#e8d5c4';
    const color = fabricColors[fabric.name];
    return color || '#e8d5c4';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-amber-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <h1 className="text-xl font-bold">Virtual Try-On</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleScreenshot}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Save Image"
              >
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 3D Viewer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl overflow-hidden relative" style={{ height: '600px' }}>
              {!avatarGenerated ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-12 h-12 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      Generate Your Avatar
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      We'll create a personalized 3D avatar based on your measurements to show you exactly how this design will look.
                    </p>
                    <Button 
                      onClick={generateAvatar}
                      disabled={generating}
                      className="min-w-[200px]"
                    >
                      {generating ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Avatar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Canvas
                    ref={canvasRef}
                    camera={{ position: [0, 0, 3], fov: 50 }}
                    gl={{ preserveDrawingBuffer: true }}
                  >
                    <Scene measurements={measurements} fabricColor={getFabricColor()} />
                  </Canvas>
                  
                  {/* Controls Overlay */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
                    <button 
                      onClick={() => setRotation(r => r - 45)}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <RotateCw className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <ZoomIn className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <ZoomOut className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => { setRotation(0); setZoom(1); }}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="absolute top-4 right-4 flex bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-1 shadow-lg">
                    <button
                      onClick={() => setViewMode('3d')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === '3d' ? 'bg-amber-600 text-white' : 'text-gray-600'
                      }`}
                    >
                      3D View
                    </button>
                    <button
                      onClick={() => setViewMode('ar')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'ar' ? 'bg-amber-600 text-white' : 'text-gray-600'
                      }`}
                    >
                      AR View
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Tips */}
            <div className="bg-blue-50 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Try-On Tips</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Drag to rotate the view</li>
                <li>• Scroll to zoom in/out</li>
                <li>• Use accurate measurements for best results</li>
                <li>• The avatar shows approximate fit - actual garment may vary slightly</li>
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Design Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Badge variant="secondary" className="mb-2">{design?.category?.name}</Badge>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{design?.name}</h2>
              <p className="text-gray-600 text-sm mb-4">by {design?.designer?.businessName}</p>
              
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-2xl font-bold text-amber-700">
                  {formatFromUsd((design?.basePrice || 0) + (fabric?.pricePerMeter || 0) * 3)}
                </span>
                <span className="text-gray-500 text-sm">total</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Design:</span>
                  <span className="font-medium">{formatFromUsd(design?.basePrice || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Fabric ({fabric?.name}):</span>
                  <span className="font-medium">{formatFromUsd(fabric?.pricePerMeter || 0)}/yd × 3yd</span>
                </div>
              </div>
            </div>

            {/* Selected Fabric */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-3">Selected Fabric</h3>
              {fabric && (
                <div className="flex gap-3">
                  <img
                    src={fabric.images[0]}
                    alt={fabric.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{fabric.name}</p>
                    <p className="text-sm text-gray-500">{fabric.seller?.businessName}</p>
                    <p className="text-sm text-amber-600">{formatFromUsd(fabric.pricePerMeter)}/yard</p>
                  </div>
                </div>
              )}
            </div>

            {/* Measurements */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="font-semibold text-gray-900 mb-3">Your Measurements</h3>
              <div className="space-y-3">
                {design?.measurements?.map((m: any) => (
                  <div key={m.name}>
                    <label className="text-sm text-gray-600">{m.name}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={measurements[m.name] || ''}
                        onChange={(e) => setMeasurements(prev => ({
                          ...prev,
                          [m.name]: parseFloat(e.target.value)
                        }))}
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        placeholder={m.description}
                      />
                      <span className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                        {m.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setAvatarGenerated(false)}
                className="w-full mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                Update Measurements & Regenerate
              </button>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                className="w-full"
                onClick={handleAddToCart}
                disabled={!avatarGenerated}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/designs/${id}`)}
              >
                Change Selection
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

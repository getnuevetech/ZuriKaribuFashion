import '../styles/jenks-v2.css';
import { ThemeProvider } from './jenks-v14/context/ThemeContext';
import { useState, useRef, useLayoutEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  ArrowRight, 
  Home, 
  ChevronRight, 
  Heart, 
  Share2, 
  Truck, 
  RotateCcw, 
  Shield,
  Minus,
  Plus,
  Check,
  Star
} from 'lucide-react';
import ContactFooter from './jenks-v14/components/ContactFooter';

gsap.registerPlugin(ScrollTrigger);

// Product data
const productData: {
  id: string;
  name: string;
  designer: string;
  price: number;
  originalPrice: number | null;
  country: string;
  countryFlag: string;
  rating: number;
  reviews: number;
  description: string;
  features: string[];
  care: string;
  shipping: string;
  returns: string;
  images: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  inStock: boolean;
  sku: string;
} = {
  id: '1',
  name: 'Adire Diamond Gown',
  designer: 'Amaka Designs',
  price: 245.00,
  originalPrice: null,
  country: 'Nigeria',
  countryFlag: '🇳🇬',
  rating: 4.8,
  reviews: 24,
  description: 'A stunning maxi gown featuring traditional Adire dye techniques combined with contemporary silhouette. Hand-finished with intricate gold embroidery along the neckline and sleeves. Each piece is uniquely crafted by artisans in Abeokuta, Nigeria.',
  features: [
    '100% cotton Adire fabric',
    'Hand-dyed using traditional resist techniques',
    'Gold thread embroidery details',
    'Side pockets',
    'Concealed back zipper',
    'Fully lined'
  ],
  care: 'Dry clean only. Do not bleach. Iron on low heat.',
  shipping: 'Free shipping on orders over $200. Delivered within 5-7 business days.',
  returns: '30-day return policy. Items must be unworn with original tags attached.',
  images: [
    '/rw_product1.jpg',
    '/product_detail1.jpg',
    '/product_detail2.jpg',
    '/product_detail3.jpg',
    '/product_detail4.jpg',
  ],
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  colors: [
    { name: 'Terracotta', hex: '#C65D3B' },
    { name: 'Indigo', hex: '#2E3A59' },
    { name: 'Ochre', hex: '#CC7722' },
  ],
  inStock: true,
  sku: 'ADG-2024-001',
};

// Related products
const relatedProducts = [
  {
    id: '2',
    name: 'Heritage Power Suit',
    designer: 'Oluwole Atelier',
    price: '$380.00',
    image: '/rw_product2.jpg',
    countryFlag: '🇳🇬',
  },
  {
    id: '3',
    name: 'Ankara Flow Skirt',
    designer: 'Nana Kofi',
    price: '$125.00',
    image: '/rw_product3.jpg',
    countryFlag: '🇬🇭',
    isNew: true,
  },
  {
    id: '4',
    name: 'Terracotta Peplum Set',
    designer: 'Yemisi Studio',
    price: '$285.00',
    image: '/rw_product4.jpg',
    countryFlag: '🇳🇬',
  },
];

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  // In a real app, we would fetch product data based on the id
  // For now, we'll use the static productData
  console.log('Product ID:', id);
  
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState(productData.colors[0]);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'details' | 'shipping'>('description');
  const [addedToCart, setAddedToCart] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        contentRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top 60%',
          }
        }
      );

      if (relatedRef.current) {
        const cards = relatedRef.current.querySelectorAll('.related-card');
        gsap.fromTo(
          cards,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: relatedRef.current,
              start: 'top 80%',
            }
          }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const handleAddToCart = () => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const incrementQuantity = () => setQuantity(prev => Math.min(prev + 1, 5));
  const decrementQuantity = () => setQuantity(prev => Math.max(prev - 1, 1));

  return (
    <ThemeProvider>
      <div className="relative bg-[#F8F6F1] min-h-screen">
      <div className="grain-overlay" />

      {/* Breadcrumb Bar */}
      <div className="pt-24 pb-4 px-8 md:px-[8vw] bg-[#F8F6F1] border-b border-[#1A1A1A]/10">
        <nav className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors text-sm">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <ChevronRight className="w-4 h-4 text-[#9A9A9A]" />
          <Link to="/ready-to-wear" className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors text-sm">
            Ready to Wear
          </Link>
          <ChevronRight className="w-4 h-4 text-[#9A9A9A]" />
          <span className="text-[#1A1A1A] text-sm font-medium">{productData.name}</span>
        </nav>
      </div>

      {/* Main Product Section */}
      <section ref={heroRef} className="py-8 px-8 md:px-[8vw]">
        <div ref={contentRef} className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-[3/4] bg-white overflow-hidden">
              <img
                src={productData.images[selectedImage]}
                alt={productData.name}
                className="w-full h-full object-cover"
              />
              
              {/* Badges */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                  {productData.countryFlag}
                </span>
                {productData.originalPrice && (
                  <span className="label-mono bg-[#E85A3C] text-white px-3 py-1 text-xs">
                    SALE
                  </span>
                )}
              </div>

              {/* Wishlist Button */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-[#E85A3C] text-[#E85A3C]' : 'text-[#1A1A1A]'}`} />
              </button>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-5 gap-2">
              {productData.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square bg-white overflow-hidden border-2 transition-all ${
                    selectedImage === index ? 'border-[#E85A3C]' : 'border-transparent hover:border-[#1A1A1A]/20'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${productData.name} view ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:pt-8">
            {/* Designer */}
            <Link 
              to={`/designer/${productData.designer.toLowerCase().replace(/\s+/g, '-')}`}
              className="label-mono text-[#6B6B6B] hover:text-[#E85A3C] transition-colors"
            >
              {productData.designer}
            </Link>

            {/* Title */}
            <h1 className="headline-lg text-[clamp(28px,4vw,48px)] text-[#1A1A1A] mt-2 mb-4">
              {productData.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${i < Math.floor(productData.rating) ? 'fill-[#E85A3C] text-[#E85A3C]' : 'text-[#9A9A9A]'}`} 
                  />
                ))}
              </div>
              <span className="text-sm text-[#1A1A1A] font-medium">{productData.rating}</span>
              <span className="text-sm text-[#6B6B6B]">({productData.reviews} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-3xl font-light text-[#1A1A1A]">
                ${productData.price.toFixed(2)}
              </span>
              {productData.originalPrice && (
                <span className="text-xl text-[#9A9A9A] line-through">
                  ${productData.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Color Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="label-mono text-[#6B6B6B]">COLOR</span>
                <span className="text-sm text-[#1A1A1A]">{selectedColor.name}</span>
              </div>
              <div className="flex gap-3">
                {productData.colors.map((color) => (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      selectedColor.name === color.name 
                        ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A]/20' 
                        : 'border-transparent hover:border-[#1A1A1A]/30'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Size Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="label-mono text-[#6B6B6B]">SIZE</span>
                <button className="text-sm text-[#E85A3C] hover:underline">Size Guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {productData.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-12 h-12 border text-sm font-medium transition-all ${
                      selectedSize === size
                        ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                        : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {/* Quantity */}
              <div className="flex items-center border border-[#1A1A1A]/10 bg-white">
                <button
                  onClick={decrementQuantity}
                  className="w-12 h-12 flex items-center justify-center hover:bg-[#F8F6F1] transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={incrementQuantity}
                  className="w-12 h-12 flex items-center justify-center hover:bg-[#F8F6F1] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                className={`flex-1 h-12 flex items-center justify-center gap-2 font-medium transition-all ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#E85A3C]'
                }`}
              >
                {addedToCart ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Added to Cart</span>
                  </>
                ) : (
                  <>
                    <span>Add to Cart</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Share */}
              <button className="w-12 h-12 border border-[#1A1A1A]/10 bg-white flex items-center justify-center hover:border-[#E85A3C]/40 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 py-6 border-t border-b border-[#1A1A1A]/10">
              <div className="flex flex-col items-center text-center">
                <Truck className="w-5 h-5 text-[#6B6B6B] mb-2" />
                <span className="text-xs text-[#6B6B6B]">Free Shipping</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <RotateCcw className="w-5 h-5 text-[#6B6B6B] mb-2" />
                <span className="text-xs text-[#6B6B6B]">30-Day Returns</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Shield className="w-5 h-5 text-[#6B6B6B] mb-2" />
                <span className="text-xs text-[#6B6B6B]">Secure Payment</span>
              </div>
            </div>

            {/* SKU */}
            <p className="text-xs text-[#9A9A9A] mt-4">
              SKU: {productData.sku}
            </p>
          </div>
        </div>
      </section>

      {/* Product Details Tabs */}
      <section className="py-12 px-8 md:px-[8vw] border-t border-[#1A1A1A]/10">
        {/* Tab Navigation */}
        <div className="flex gap-8 border-b border-[#1A1A1A]/10 mb-8">
          {(['description', 'details', 'shipping'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-medium uppercase tracking-wider transition-colors relative ${
                activeTab === tab
                  ? 'text-[#1A1A1A]'
                  : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E85A3C]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-3xl">
          {activeTab === 'description' && (
            <div className="space-y-6">
              <p className="text-[#1A1A1A] leading-relaxed">
                {productData.description}
              </p>
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Highlights</h4>
                <ul className="space-y-2">
                  {productData.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-[#6B6B6B]">
                      <span className="w-1.5 h-1.5 bg-[#E85A3C] rounded-full" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Care Instructions</h4>
                <p className="text-[#6B6B6B]">{productData.care}</p>
              </div>
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Size & Fit</h4>
                <p className="text-[#6B6B6B]">Model is 5'9" and wears size M. Fits true to size. For a more relaxed fit, size up.</p>
              </div>
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Materials</h4>
                <p className="text-[#6B6B6B]">Outer: 100% Cotton (Adire-dyed)<br />Lining: 100% Viscose<br />Embroidery: Gold metallic thread</p>
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Shipping Information</h4>
                <p className="text-[#6B6B6B]">{productData.shipping}</p>
              </div>
              <div>
                <h4 className="font-medium text-[#1A1A1A] mb-3">Returns & Exchanges</h4>
                <p className="text-[#6B6B6B]">{productData.returns}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Related Products */}
      <section className="py-16 px-8 md:px-[8vw] border-t border-[#1A1A1A]/10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <span className="label-mono text-[#6B6B6B] block mb-2">YOU MAY ALSO LIKE</span>
            <h2 className="headline-lg text-[clamp(24px,3vw,40px)] text-[#1A1A1A]">
              Related Products
            </h2>
          </div>
          <Link 
            to="/ready-to-wear" 
            className="cta-link group hidden sm:inline-flex items-center gap-2"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div ref={relatedRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {relatedProducts.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="related-card group"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-white mb-4">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-lg shadow-lg">
                  {product.countryFlag}
                </div>
                {product.isNew && (
                  <div className="absolute top-3 right-3">
                    <span className="label-mono bg-[#E85A3C] text-white px-3 py-1 text-xs">
                      NEW
                    </span>
                  </div>
                )}
              </div>
              <h3 className="text-[#1A1A1A] font-medium group-hover:text-[#E85A3C] transition-colors">
                {product.name}
              </h3>
              <p className="text-sm text-[#6B6B6B] mb-1">{product.designer}</p>
              <p className="text-[#E85A3C] font-medium">{product.price}</p>
            </Link>
          ))}
        </div>
      </section>

      <ContactFooter />
      </div>
    </ThemeProvider>
  );
}

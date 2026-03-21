import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navigation from './sections/Navigation';
import HeroSection from './sections/HeroSection';
import ShopByBlocks from './sections/ShopByBlocks';
import ShopByCountry from './sections/ShopByCountry';
import TrustBadges from './sections/TrustBadges';
import ReadyToWear from './sections/ReadyToWear';
import FabricsToBuy from './sections/FabricsToBuy';
import CustomToWear from './sections/CustomToWear';
import HowItWorks from './sections/HowItWorks';
import FeaturedCustom from './sections/FeaturedCustom';
import FeaturedReadyToWear from './sections/FeaturedReadyToWear';
import FreshDrops from './sections/FreshDrops';
import DesignerSpotlight from './sections/DesignerSpotlight';
import HeritageStory from './sections/HeritageStory';
import ContactFooter from './sections/ContactFooter';

// Category Pages
import ReadyToWearPage from './pages/ReadyToWearPage';
import FabricsPage from './pages/FabricsPage';
import CustomToWearPage from './pages/CustomToWearPage';
import ProductDetailPage from './pages/ProductDetailPage';
import HomeStaticPage from './pages/HomeStaticPage';

gsap.registerPlugin(ScrollTrigger);

// Home Page Component
function HomePage() {
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for all sections to mount before creating global snap
    const timer = setTimeout(() => {
      const pinned = ScrollTrigger.getAll()
        .filter(st => st.vars.pin)
        .sort((a, b) => a.start - b.start);
      
      const maxScroll = ScrollTrigger.maxScroll(window);
      
      if (!maxScroll || pinned.length === 0) return;

      const pinnedRanges = pinned.map(st => ({
        start: st.start / maxScroll,
        end: (st.end ?? st.start) / maxScroll,
        center: (st.start + ((st.end ?? st.start) - st.start) * 0.5) / maxScroll,
      }));

      ScrollTrigger.create({
        snap: {
          snapTo: (value: number) => {
            const inPinned = pinnedRanges.some(r => value >= r.start - 0.02 && value <= r.end + 0.02);
            if (!inPinned) return value;
            
            const target = pinnedRanges.reduce((closest, r) =>
              Math.abs(r.center - value) < Math.abs(closest - value) ? r.center : closest,
              pinnedRanges[0]?.center ?? 0
            );
            return target;
          },
          duration: { min: 0.15, max: 0.35 },
          delay: 0,
          ease: "power2.out"
        }
      });
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={mainRef} className="relative">
      {/* Grain Overlay */}
      <div className="grain-overlay" />
      
      {/* Navigation */}
      <Navigation />
      
      {/* Sections */}
      <main className="relative">
        <HeroSection className="z-10" />
        <ShopByBlocks className="z-20" />
        <TrustBadges variant="horizontal" className="z-25" />
        <ShopByCountry className="z-30" />
        <ReadyToWear className="z-40" />
        <FabricsToBuy className="z-50" />
        <CustomToWear className="z-60" />
        <HowItWorks className="z-70" />
        <FeaturedCustom className="z-80" />
        <FeaturedReadyToWear className="z-90" />
        <FreshDrops className="z-100" />
        <DesignerSpotlight className="z-110" />
        <HeritageStory className="z-120" />
        <TrustBadges variant="grid" className="z-125" />
        <ContactFooter className="z-130" />
      </main>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home-static" element={<HomeStaticPage />} />
        <Route path="/static-home" element={<HomeStaticPage />} />
        <Route path="/ready-to-wear" element={<ReadyToWearPage />} />
        <Route path="/fabrics" element={<FabricsPage />} />
        <Route path="/designs" element={<CustomToWearPage />} />
        <Route path="/custom-to-wear" element={<CustomToWearPage />} />
        <Route path="/custom" element={<CustomToWearPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;

import React, { useState } from "react";
import ChinaMap from "./components/ChinaMap";
import ProvincePanel from "./components/ProvincePanel";
import BandModal from "./components/BandModal";
import VenueModal from "./components/VenueModal";
import AdBanner from "./components/AdBanner";
import GigModal from "./components/GigModal";
import { provinceData, Province, Band, Venue } from "./data";
import { Music2 } from "lucide-react";

export default function App() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isGigModalOpen, setIsGigModalOpen] = useState(false);

  const handleProvinceClick = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
  };

  const handleClosePanel = () => {
    setSelectedProvinceId(null);
  };

  const handleBandClick = (band: Band) => {
    setSelectedBand(band);
  };

  const handleVenueClick = (venue: Venue) => {
    setSelectedVenue(venue);
  };

  const handleCloseModal = () => {
    setSelectedBand(null);
    setSelectedVenue(null);
  };

  const selectedProvince = selectedProvinceId ? provinceData[selectedProvinceId] : null;

  return (
    <div className="w-full h-screen bg-[#0a0502] overflow-hidden font-sans relative">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#ff4e00] rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(255,78,0,0.3)]">
              <Music2 size={20} />
            </div>
            <h1 className="text-3xl font-serif text-white tracking-tight">
              中国独立摇滚地图
            </h1>
          </div>
          <div className="ml-14">
            <p className="text-sm text-gray-400 font-mono tracking-widest uppercase mb-1">
              Chinese Indie Rock Map
            </p>
            <div className="flex items-center gap-2">
              <div className="h-[1px] w-4 bg-gray-600/50"></div>
              <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                by <span className="text-[#ff4e00] font-semibold">Catbeer Records</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="hidden md:block pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-3">
          <p className="text-xs text-gray-300">
            点击高亮的省份探索当地独立乐队与场地 <span className="text-[#ff4e00] ml-2">●</span>
          </p>
        </div>
      </header>

      {/* Main Map */}
      <ChinaMap 
        onProvinceClick={handleProvinceClick} 
        selectedProvinceId={selectedProvinceId} 
      />

      {/* Side Panel */}
      <ProvincePanel 
        province={selectedProvince} 
        onClose={handleClosePanel} 
        onBandClick={handleBandClick} 
        onVenueClick={handleVenueClick}
      />

      {/* Band Modal */}
      <BandModal 
        band={selectedBand} 
        onClose={handleCloseModal} 
      />

      {/* Venue Modal */}
      <VenueModal 
        venue={selectedVenue} 
        onClose={handleCloseModal} 
      />

      {/* Ad Banner */}
      <AdBanner 
        isPanelOpen={!!selectedProvinceId} 
        onClick={() => setIsGigModalOpen(true)} 
      />

      {/* Gig Modal */}
      <GigModal 
        isOpen={isGigModalOpen} 
        onClose={() => setIsGigModalOpen(false)} 
      />
    </div>
  );
}

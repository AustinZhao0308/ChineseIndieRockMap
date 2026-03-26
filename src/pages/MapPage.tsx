import React, { useState, useEffect } from "react";
import ChinaMap from "../components/ChinaMap";
import ProvincePanel from "../components/ProvincePanel";
import BandModal from "../components/BandModal";
import VenueModal from "../components/VenueModal";
import RehearsalRoomModal from "../components/RehearsalRoomModal";
import SpotModal from "../components/SpotModal";
import AdBanner from "../components/AdBanner";
import GigModal from "../components/GigModal";
import FeedbackMenu from "../components/FeedbackMenu";
import { Band, Venue, RehearsalRoom, Spot } from "../data";
import { Music2 } from "lucide-react";
import { useProvinceData } from "../hooks/useProvinceData";

export default function MapPage() {
  const { data: provinceData, loading } = useProvinceData();
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'bands' | 'venues' | 'rehearsal_rooms' | 'spots'>('bands');
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedRehearsalRoom, setSelectedRehearsalRoom] = useState<RehearsalRoom | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isGigModalOpen, setIsGigModalOpen] = useState(false);
  const [featuredEvent, setFeaturedEvent] = useState<any>(null);
  const [isAdBannerVisible, setIsAdBannerVisible] = useState(true);

  useEffect(() => {
    fetch('/api/featured_events/active')
      .then(res => res.json())
      .then(data => {
        if (data) setFeaturedEvent(data);
      })
      .catch(err => console.error('Failed to load featured event', err));
  }, []);

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

  const handleRehearsalRoomClick = (room: RehearsalRoom) => {
    setSelectedRehearsalRoom(room);
  };

  const handleSpotClick = (spot: Spot) => {
    setSelectedSpot(spot);
  };

  const handleCloseModal = () => {
    setSelectedBand(null);
    setSelectedVenue(null);
    setSelectedRehearsalRoom(null);
    setSelectedSpot(null);
  };

  const selectedProvince = selectedProvinceId ? provinceData[selectedProvinceId] : null;

  if (loading) {
    return (
      <div className="w-full h-[100dvh] bg-[#0a0502] flex items-center justify-center">
        <div className="text-[#ff4e00] text-xl font-mono animate-pulse">Loading Map Data...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] bg-[#0a0502] overflow-hidden font-sans relative">
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

            {/* Category Selector */}
            <div className="mt-6 md:mt-8 flex flex-nowrap gap-3 sm:gap-5 md:gap-6 overflow-x-auto scrollbar-hide max-w-[calc(100vw-3rem)] md:max-w-none pb-1">
              {[
                { id: 'bands', zh: '乐队', en: 'BANDS' },
                { id: 'venues', zh: '场地', en: 'VENUES' },
                { id: 'rehearsal_rooms', zh: '排练房', en: 'REHEARSAL' },
                { id: 'spots', zh: '角落', en: 'SPOTS' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id as any);
                    setSelectedProvinceId(null); // Close panel when switching categories
                  }}
                  className={`flex items-baseline gap-1 whitespace-nowrap pb-1.5 border-b-2 transition-colors ${
                    activeCategory === cat.id
                      ? 'text-[#ff4e00] border-[#ff4e00]'
                      : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-medium tracking-widest">{cat.zh}</span>
                  <span className="text-[8px] sm:text-[10px] font-mono tracking-wider uppercase opacity-80">{cat.en}</span>
                </button>
              ))}
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
        provinceData={provinceData}
        activeCategory={activeCategory}
      />

      {/* Side Panel */}
      <ProvincePanel 
        province={selectedProvince} 
        onClose={handleClosePanel} 
        onBandClick={handleBandClick} 
        onVenueClick={handleVenueClick}
        onRehearsalRoomClick={handleRehearsalRoomClick}
        onSpotClick={handleSpotClick}
        activeCategory={activeCategory}
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

      {/* Rehearsal Room Modal */}
      <RehearsalRoomModal 
        room={selectedRehearsalRoom} 
        onClose={handleCloseModal} 
      />

      {/* Spot Modal */}
      <SpotModal 
        spot={selectedSpot} 
        onClose={handleCloseModal} 
      />

      {/* Ad Banner */}
      {featuredEvent && isAdBannerVisible && (
        <AdBanner 
          isPanelOpen={!!selectedProvinceId} 
          onClick={() => setIsGigModalOpen(true)} 
          onClose={() => setIsAdBannerVisible(false)}
          event={featuredEvent}
        />
      )}

      {/* Gig Modal */}
      {featuredEvent && (
        <GigModal 
          isOpen={isGigModalOpen} 
          onClose={() => setIsGigModalOpen(false)} 
          event={featuredEvent}
          onBandClick={handleBandClick}
        />
      )}

      {/* Feedback Menu */}
      <FeedbackMenu 
        isPanelOpen={!!selectedProvinceId}
        hasBanner={!!featuredEvent && isAdBannerVisible}
      />
    </div>
  );
}

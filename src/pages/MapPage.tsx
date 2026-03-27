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
  const { data: provinceData, loading, error } = useProvinceData();
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedRehearsalRoom, setSelectedRehearsalRoom] = useState<RehearsalRoom | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [isGigModalOpen, setIsGigModalOpen] = useState(false);
  const [featuredEvent, setFeaturedEvent] = useState<any>(null);
  const [featuredEventError, setFeaturedEventError] = useState<string | null>(null);
  const [isAdBannerVisible, setIsAdBannerVisible] = useState(true);

  useEffect(() => {
    fetch('/api/featured_events/active')
      .then(res => {
        if (!res.ok) throw new Error(`Featured Event API failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data) setFeaturedEvent(data);
      })
      .catch(err => {
        console.error('Failed to load featured event', err);
        setFeaturedEventError(err instanceof Error ? err.message : "Failed to load featured event");
      });
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

  if (error) {
    return (
      <div className="w-full h-[100dvh] bg-[#0a0502] flex flex-col items-center justify-center p-6 text-center">
        <div className="text-red-500 text-xl font-mono mb-4">Error Loading Data</div>
        <div className="text-gray-400 max-w-md">
          <p className="mb-2">{error}</p>
          <p className="text-sm">Please check your network connection or disable any adblockers that might be blocking API requests.</p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-6 py-2 bg-[#ff4e00] text-white rounded-full hover:bg-[#e04400] transition-colors"
        >
          Retry
        </button>
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
      />

      {/* Side Panel */}
      <ProvincePanel 
        province={selectedProvince} 
        onClose={handleClosePanel} 
        onBandClick={handleBandClick} 
        onVenueClick={handleVenueClick}
        onRehearsalRoomClick={handleRehearsalRoomClick}
        onSpotClick={handleSpotClick}
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

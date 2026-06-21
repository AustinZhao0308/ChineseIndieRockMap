import React, { useState, useEffect, useMemo } from "react";
import ChinaMap from "../components/ChinaMap";
import ProvincePanel from "../components/ProvincePanel";
import BandModal from "../components/BandModal";
import VenueModal from "../components/VenueModal";
import RehearsalRoomModal from "../components/RehearsalRoomModal";
import SpotModal from "../components/SpotModal";
import AdBanner from "../components/AdBanner";
import FeedbackMenu from "../components/FeedbackMenu";
import { Band, Venue, RehearsalRoom, Spot } from "../data";
import { Music2 } from "lucide-react";
import { useProvinceData } from "../hooks/useProvinceData";
import { Link, useNavigate } from "react-router-dom";

export default function MapPage() {
  const navigate = useNavigate();
  const { data: provinceData, loading, error } = useProvinceData();
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedRehearsalRoom, setSelectedRehearsalRoom] = useState<RehearsalRoom | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
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

  const totalBands = useMemo(() => {
    return Object.values(provinceData).reduce((provinceTotal, province) => {
      return provinceTotal + province.cities.reduce((cityTotal, city) => {
        return cityTotal + (city.bands?.length || 0);
      }, 0);
    }, 0);
  }, [provinceData]);

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
              独立摇滚地图
            </h1>
          </div>
          <div className="ml-14">
            <p className="text-sm text-gray-400 font-mono tracking-widest uppercase mb-1">
              Indie Rock Map
            </p>
            <p className="md:hidden text-[11px] text-gray-400 font-mono tracking-widest uppercase mb-1">
              已收录 <span className="text-[#ff4e00] font-semibold">{totalBands}</span> 支乐队
            </p>
            <Link to="/events" className="md:hidden inline-flex mt-1 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-md hover:bg-white/10 transition-colors">
              演出档案
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-[1px] w-4 bg-gray-600/50"></div>
              <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                by <span className="text-[#ff4e00] font-semibold">Catbeer Records</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex pointer-events-auto items-center gap-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-5 py-3">
          <p className="text-xs text-gray-300">
            已收录 <span className="text-[#ff4e00] font-semibold">{totalBands}</span> 支乐队 · 点击高亮的省份探索当地独立乐队与场地 <span className="text-[#ff4e00] ml-2">●</span>
          </p>
          <span className="h-4 w-px bg-white/10" />
          <Link to="/events" className="text-xs text-white/72 hover:text-white transition-colors">
            演出档案
          </Link>
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
          onClick={() => navigate(`/events/${featuredEvent.slug || featuredEvent.id}`)} 
          onClose={() => setIsAdBannerVisible(false)}
          event={featuredEvent}
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

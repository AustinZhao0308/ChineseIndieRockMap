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
import { useProvinceData } from "../hooks/useProvinceData";
import { useLocation, useNavigate } from "react-router-dom";

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const isEmbedded = query.get("embed") === "ios";
  const mapTheme = query.get("theme") === "light" ? "light" : "dark";
  const isLight = mapTheme === "light";
  const { data: provinceData, loading, error, updateBand } = useProvinceData();
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
    <div className="w-full h-[100dvh] overflow-hidden font-sans relative" style={{ background: isLight ? "#f6f3ed" : "#0a0502" }}>
      <div className={`absolute left-5 right-5 z-10 pointer-events-none sm:left-6 sm:right-6 md:left-10 md:right-auto lg:left-12 xl:left-14 ${isEmbedded ? 'top-[calc(1rem+env(safe-area-inset-top))] md:top-5' : 'top-[calc(4.05rem+env(safe-area-inset-top))] md:top-[4.9rem]'}`}>
        <div className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-[11px] backdrop-blur-xl md:px-4 md:text-xs ${isLight ? 'border-black/10 bg-white/72 text-black/58' : 'border-white/[0.08] bg-black/28 text-white/58'}`}>
          <span>
            已收录 <span className="font-semibold text-[#ff6a2b]">{totalBands}</span> 支乐队
          </span>
          <span className={`hidden md:inline ${isLight ? 'text-black/28' : 'text-white/28'}`}>·</span>
          <span className="hidden md:inline">点击高亮省份探索当地音乐现场</span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff4e00] shadow-[0_0_14px_rgba(255,78,0,0.72)]" />
        </div>
      </div>

      {/* Main Map */}
      <ChinaMap 
        onProvinceClick={handleProvinceClick} 
        selectedProvinceId={selectedProvinceId} 
        provinceData={provinceData}
        theme={mapTheme}
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
        onBandUpdated={(bandId, updates) => {
          updateBand(bandId, updates);
          setSelectedBand(current => current?.id === bandId ? { ...current, ...updates } : current);
        }}
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

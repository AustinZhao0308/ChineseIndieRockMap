import React from "react";
import { X, MapPin, Music, Building2, Users, Mic2, Coffee, DollarSign, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Province, Band, Venue, RehearsalRoom, Spot } from "../data";

interface ProvincePanelProps {
  province: Province | null;
  onClose: () => void;
  onBandClick: (band: Band) => void;
  onVenueClick: (venue: Venue) => void;
  onRehearsalRoomClick: (room: RehearsalRoom) => void;
  onSpotClick: (spot: Spot) => void;
}


const ProvincePanel: React.FC<ProvincePanelProps> = ({ province, onClose, onBandClick, onVenueClick, onRehearsalRoomClick, onSpotClick }) => {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [activeTab, setActiveTab] = React.useState<'bands' | 'venues' | 'rehearsal_rooms' | 'spots'>('bands');
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(false);
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const touchStartY = React.useRef(0);
  const scrollTopAtStart = React.useRef(0);

  const checkScroll = React.useCallback(() => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      checkScroll();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [checkScroll]);

  React.useEffect(() => {
    if (province) {
      setActiveTab('bands');
      setIsExpanded(false);
      setTimeout(checkScroll, 50);
    }
  }, [province, checkScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isMobile) {
      if (e.currentTarget.scrollTop > 10 && !isExpanded) {
        setIsExpanded(true);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isMobile) {
      touchStartY.current = e.touches[0].clientY;
      scrollTopAtStart.current = e.currentTarget.scrollTop;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isMobile && isExpanded) {
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY.current;

      // Only collapse if we started at the top and swiped down significantly
      if (scrollTopAtStart.current <= 0 && deltaY > 50) {
        setIsExpanded(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {province && (
        <motion.div
          initial={isMobile ? { y: "100%", opacity: 0, height: "55vh" } : { x: "100%", opacity: 0, height: "100%" }}
          animate={isMobile ? { y: 0, opacity: 1, height: isExpanded ? "85vh" : "55vh" } : { x: 0, opacity: 1, height: "100%" }}
          exit={isMobile ? { y: "100%", opacity: 0, height: isExpanded ? "85vh" : "55vh" } : { x: "100%", opacity: 0, height: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="absolute bottom-0 md:top-0 right-0 w-full md:w-[400px] bg-[#151619]/90 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-2xl z-40 overflow-y-auto scrollbar-hide rounded-t-3xl md:rounded-none"
        >
          <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Mobile drag indicator */}
            <div 
              className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 md:hidden cursor-pointer" 
              onClick={() => setIsExpanded(!isExpanded)}
            />
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-4xl font-serif text-white tracking-tight">
                  {province.name_zh}
                </h2>
                <p className="text-sm text-gray-400 uppercase tracking-widest mt-1">
                  {province.name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="relative mb-8">
              <div 
                ref={tabsRef}
                onScroll={checkScroll}
                className="flex gap-6 border-b border-white/10 overflow-x-auto scrollbar-hide pr-8"
              >
                <button
                onClick={() => setActiveTab('bands')}
                className={`pb-3 text-sm font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'bands' 
                    ? 'text-[#ff4e00] border-[#ff4e00]' 
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                乐队 Bands
              </button>
              <button
                onClick={() => setActiveTab('venues')}
                className={`pb-3 text-sm font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'venues' 
                    ? 'text-[#ff4e00] border-[#ff4e00]' 
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                场地 Venues
              </button>
              <button
                onClick={() => setActiveTab('rehearsal_rooms')}
                className={`pb-3 text-sm font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'rehearsal_rooms' 
                    ? 'text-[#ff4e00] border-[#ff4e00]' 
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                排练房 Rehearsal
              </button>
              <button
                onClick={() => setActiveTab('spots')}
                className={`pb-3 text-sm font-medium uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'spots' 
                    ? 'text-[#ff4e00] border-[#ff4e00]' 
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                城市角落 Spots
              </button>
            </div>

            {/* Right Arrow Indicator */}
            <AnimatePresence>
              {showRightArrow && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-12 pb-3 bg-gradient-to-l from-[#151619] via-[#151619]/80 to-transparent pointer-events-none"
                >
                  <motion.div
                    animate={{ x: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <ChevronRight size={18} className="text-[#ff4e00]" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-8">
              {province.cities.map((city, cityIdx) => {
                const hasContent = activeTab === 'bands' ? city.bands.length > 0 : 
                                   activeTab === 'venues' ? (city.venues && city.venues.length > 0) :
                                   activeTab === 'rehearsal_rooms' ? (city.rehearsalRooms && city.rehearsalRooms.length > 0) :
                                   (city.spots && city.spots.length > 0);
                
                if (!hasContent) return null;

                return (
                  <div key={cityIdx} className="relative">
                    <div className="flex items-center gap-2 mb-4 text-[#ff4e00]">
                      <MapPin size={18} />
                      <h3 className="text-xl font-medium text-white">{city.name_zh}</h3>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{city.name}</span>
                    </div>
                    
                    <div className="space-y-3 pl-6 border-l border-white/10 ml-[9px]">
                      {activeTab === 'bands' && city.bands.map((band) => (
                        <motion.div
                          whileHover={{ x: 4 }}
                          key={band.id}
                          onClick={() => onBandClick(band)}
                          className="group relative overflow-hidden cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-[#ff4e00]/30"
                        >
                          {/* Background Image with Gradient Mask */}
                          <div 
                            className="absolute inset-y-0 right-0 w-3/5 pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                            style={{ 
                              maskImage: 'linear-gradient(to left, black 20%, transparent 100%)', 
                              WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 100%)' 
                            }}
                          >
                            <img 
                              src={band.imageUrl || `https://picsum.photos/seed/${band.id}/400/300?grayscale`} 
                              alt={band.name_zh}
                              className="w-full h-full object-cover mix-blend-luminosity"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          {/* Content */}
                          <div className="relative z-20 p-4">
                            <div className="flex justify-between items-start">
                              <div className="w-2/3">
                                <h4 className="text-lg font-medium text-white group-hover:text-[#ff4e00] transition-colors drop-shadow-md">
                                  {band.name_zh}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1 drop-shadow-md">{band.name}</p>
                              </div>
                              <div className="bg-[#ff4e00]/20 p-2 rounded-full text-[#ff4e00] opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <Music size={16} />
                              </div>
                            </div>
                            <div className="mt-3">
                              <span className="inline-block px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] text-gray-300 uppercase tracking-wider border border-white/5">
                                {band.genre}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {activeTab === 'venues' && city.venues?.map((venue) => (
                        <motion.div
                          whileHover={{ x: 4 }}
                          key={venue.id}
                          onClick={() => onVenueClick(venue)}
                          className="group relative overflow-hidden cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-[#ff4e00]/30"
                        >
                          {/* Background Image with Gradient Mask */}
                          <div 
                            className="absolute inset-y-0 right-0 w-3/5 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                            style={{ 
                              maskImage: 'linear-gradient(to left, black 20%, transparent 100%)', 
                              WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 100%)' 
                            }}
                          >
                            <img 
                              src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/400/300?grayscale`} 
                              alt={venue.name_zh}
                              className="w-full h-full object-cover mix-blend-luminosity"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          {/* Content */}
                          <div className="relative z-20 p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="w-2/3">
                                <h4 className="text-lg font-medium text-white group-hover:text-[#ff4e00] transition-colors drop-shadow-md">
                                  {venue.name_zh}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1 drop-shadow-md">{venue.name}</p>
                              </div>
                              <div className="bg-[#ff4e00]/20 p-2 rounded-full text-[#ff4e00] opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <Building2 size={16} />
                              </div>
                            </div>
                            
                            <div className="space-y-2 mt-3">
                              <div className="flex items-start gap-2 text-xs text-gray-300 drop-shadow-md">
                                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="line-clamp-1">{venue.address}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300 drop-shadow-md">
                                <Users size={14} className="text-gray-400 shrink-0" />
                                <span>可容纳 {venue.capacity} 人</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-white/5 leading-relaxed drop-shadow-md">
                                {venue.intro}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {activeTab === 'rehearsal_rooms' && city.rehearsalRooms?.map((room) => (
                        <motion.div
                          whileHover={{ x: 4 }}
                          key={room.id}
                          onClick={() => onRehearsalRoomClick(room)}
                          className="group relative overflow-hidden cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-purple-500/30"
                        >
                          <div 
                            className="absolute inset-y-0 right-0 w-3/5 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                            style={{ 
                              maskImage: 'linear-gradient(to left, black 20%, transparent 100%)', 
                              WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 100%)' 
                            }}
                          >
                            <img 
                              src={room.imageUrl || `https://picsum.photos/seed/${room.id}/400/300?grayscale`} 
                              alt={room.name_zh}
                              className="w-full h-full object-cover mix-blend-luminosity"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          <div className="relative z-20 p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="w-2/3">
                                <h4 className="text-lg font-medium text-white group-hover:text-purple-400 transition-colors drop-shadow-md">
                                  {room.name_zh}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1 drop-shadow-md">{room.name}</p>
                              </div>
                              <div className="bg-purple-500/20 p-2 rounded-full text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <Mic2 size={16} />
                              </div>
                            </div>
                            
                            <div className="space-y-2 mt-3">
                              <div className="flex items-start gap-2 text-xs text-gray-300 drop-shadow-md">
                                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="line-clamp-1">{room.address}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300 drop-shadow-md">
                                <DollarSign size={14} className="text-gray-400 shrink-0" />
                                <span>{room.priceInfo}</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {activeTab === 'spots' && city.spots?.map((spot) => (
                        <motion.div
                          whileHover={{ x: 4 }}
                          key={spot.id}
                          onClick={() => onSpotClick(spot)}
                          className="group relative overflow-hidden cursor-pointer bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-yellow-500/30"
                        >
                          <div 
                            className="absolute inset-y-0 right-0 w-3/5 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500"
                            style={{ 
                              maskImage: 'linear-gradient(to left, black 20%, transparent 100%)', 
                              WebkitMaskImage: 'linear-gradient(to left, black 20%, transparent 100%)' 
                            }}
                          >
                            <img 
                              src={spot.imageUrl || `https://picsum.photos/seed/${spot.id}/400/300?grayscale`} 
                              alt={spot.name_zh}
                              className="w-full h-full object-cover mix-blend-luminosity"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          
                          <div className="relative z-20 p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="w-2/3">
                                <h4 className="text-lg font-medium text-white group-hover:text-yellow-400 transition-colors drop-shadow-md">
                                  {spot.name_zh}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1 drop-shadow-md">{spot.name}</p>
                              </div>
                              <div className="bg-yellow-500/20 p-2 rounded-full text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <Coffee size={16} />
                              </div>
                            </div>
                            
                            <div className="space-y-2 mt-3">
                              <div className="flex items-start gap-2 text-xs text-gray-300 drop-shadow-md">
                                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                <span className="line-clamp-1">{spot.address}</span>
                              </div>
                              <div className="mt-2">
                                <span className="inline-block px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] text-gray-300 uppercase tracking-wider border border-white/5">
                                  {spot.type}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Empty state for venues if none exist in the province */}
              {activeTab === 'venues' && !province.cities.some(city => city.venues && city.venues.length > 0) && (
                <div className="text-center py-12">
                  <Building2 size={32} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 text-sm">该省份暂无场地信息</p>
                </div>
              )}

              {activeTab === 'rehearsal_rooms' && !province.cities.some(city => city.rehearsalRooms && city.rehearsalRooms.length > 0) && (
                <div className="text-center py-12">
                  <Mic2 size={32} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 text-sm">该省份暂无排练房信息</p>
                </div>
              )}

              {activeTab === 'spots' && !province.cities.some(city => city.spots && city.spots.length > 0) && (
                <div className="text-center py-12">
                  <Coffee size={32} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 text-sm">该省份暂无城市角落信息</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProvincePanel;

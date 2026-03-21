import React from "react";
import { X, Calendar, MapPin, Users, Ticket } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GigModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  onBandClick?: (band: any) => void;
}

const GigModal: React.FC<GigModalProps> = ({ isOpen, onClose, event, onBandClick }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#151619] rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[90vh] flex flex-col"
        >
          {/* Header Image Area */}
          <div className="relative h-48 md:h-64 bg-zinc-900 shrink-0">
            <div className="absolute inset-0 bg-gradient-to-t from-[#151619] to-transparent z-10" />
            <img 
              src={event.image_url || "https://picsum.photos/seed/sonic-revolution/800/400?grayscale"} 
              alt={event.title}
              className="w-full h-full object-cover mix-blend-luminosity opacity-50"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors backdrop-blur-md"
            >
              <X size={20} />
            </button>
            
            <div className="absolute bottom-6 left-6 right-6 z-20">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff4e00]/20 border border-[#ff4e00]/30 rounded-full text-[#ff4e00] text-xs font-medium tracking-wider uppercase mb-3 backdrop-blur-md">
                <Ticket size={14} />
                <span>Featured Event</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-serif text-white tracking-tight drop-shadow-lg">
                {event.title}
              </h2>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 md:p-8 overflow-y-auto scrollbar-hide flex-1">
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-white/5 rounded-lg text-gray-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">演出时间</p>
                  <p className="text-white font-medium">{event.date_str}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-white/5 rounded-lg text-gray-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">演出地点</p>
                  <p className="text-white font-medium">{event.location}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{event.address}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                <Users size={20} className="text-[#ff4e00]" />
                <h3 className="text-xl font-medium text-white">演出详情 Event Details</h3>
              </div>

              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <div className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
                  {event.description}
                </div>
              </div>
            </div>

            {event.lineup && event.lineup.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                  <Users size={20} className="text-[#ff4e00]" />
                  <h3 className="text-xl font-medium text-white">演出阵容 Lineup</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {event.lineup.map((day: any, index: number) => (
                    <div key={index} className="bg-white/5 rounded-xl p-5 border border-white/5">
                      <div className="text-[#ff4e00] font-mono text-sm mb-4 pb-2 border-b border-white/10">
                        {day.day}
                      </div>
                      <ul className="space-y-3 text-sm text-gray-300">
                        {day.bands && day.bands.map((band: any, bIndex: number) => (
                          <li key={bIndex}>
                            <button 
                              onClick={() => {
                                if (onBandClick) {
                                  onBandClick(band);
                                }
                              }}
                              className="font-medium text-white hover:text-[#ff4e00] transition-colors text-left"
                            >
                              {band.name_zh || band.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {event.ticket_url && (
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-center">
                <a 
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-[#ff4e00] hover:bg-[#ff6a2b] text-white rounded-full font-medium tracking-wide transition-colors shadow-[0_0_20px_rgba(255,78,0,0.3)] hover:shadow-[0_0_30px_rgba(255,78,0,0.5)]"
                >
                  购票链接
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GigModal;

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Megaphone, ChevronRight, X } from "lucide-react";

interface AdBannerProps {
  isPanelOpen: boolean;
  onClick: () => void;
  onClose: () => void;
  event: any;
}

const AdBanner: React.FC<AdBannerProps> = ({ isPanelOpen, onClick, onClose, event }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ 
          opacity: 1, 
          y: 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`absolute z-30 transition-all duration-500 ease-in-out
          left-4 right-4 md:right-auto md:w-[400px]
          ${isPanelOpen 
            ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-6' 
            : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-6'
          }
        `}
      >
        <div 
          className="relative overflow-hidden bg-[#151619]/90 backdrop-blur-xl border border-[#ff4e00]/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] cursor-pointer group hover:border-[#ff4e00]/60 transition-colors"
          onClick={onClick}
        >
          {/* Background subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#ff4e00]/10 to-transparent pointer-events-none" />
          
          <div className="flex items-center p-3 gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#ff4e00]/20 flex items-center justify-center text-[#ff4e00] group-hover:scale-110 transition-transform">
              <Megaphone size={14} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-mono text-[#ff4e00] uppercase tracking-wider border border-[#ff4e00]/30 px-1 py-0.5 rounded backdrop-blur-sm leading-none">
                  Featured
                </span>
                <span className="text-[10px] text-gray-400 truncate">{event.date_str} @ {event.location}</span>
              </div>
              <h4 className="text-sm text-white font-medium truncate group-hover:text-[#ff4e00] transition-colors">
                {event.title}
              </h4>
            </div>
            
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-[#ff4e00] group-hover:text-white transition-colors">
                <ChevronRight size={14} />
              </div>
              <button 
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdBanner;

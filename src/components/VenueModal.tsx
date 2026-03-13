import React, { useState } from "react";
import { X, MapPin, Users, Info, Calendar, Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Venue } from "../data";

interface VenueModalProps {
  venue: Venue | null;
  onClose: () => void;
}

const VenueModal: React.FC<VenueModalProps> = ({ venue, onClose }) => {
  const [showContact, setShowContact] = useState(false);

  // Reset showContact when venue changes
  React.useEffect(() => {
    setShowContact(false);
  }, [venue]);

  if (!venue) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-3xl bg-[#151619] rounded-2xl overflow-hidden shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide"
        >
          {/* Header Image Area */}
          <div className="relative h-64 md:h-80 w-full overflow-hidden shrink-0">
            <img
              src={venue.imageUrl || `https://picsum.photos/seed/${venue.id}/800/400?grayscale`}
              alt={venue.name_zh}
              className="w-full h-full object-cover opacity-60"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#151619] via-[#151619]/50 to-transparent" />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-[#ff4e00] transition-colors text-white backdrop-blur-md z-10"
            >
              <X size={24} />
            </button>

            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex items-end justify-between">
                <div>
                  <span className="inline-block px-3 py-1 bg-[#ff4e00]/20 text-[#ff4e00] border border-[#ff4e00]/30 rounded-full text-xs font-medium uppercase tracking-widest mb-3">
                    <Users size={12} className="inline mr-1 mb-0.5" />
                    容纳 {venue.capacity} 人
                  </span>
                  <span className="inline-block px-3 py-1 bg-white/10 text-gray-300 border border-white/20 rounded-full text-xs font-medium tracking-widest mb-3 ml-2">
                    {venue.city_zh}
                  </span>
                  <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-1">
                    {venue.name_zh}
                  </h2>
                  <p className="text-lg text-gray-300 font-mono tracking-wider">
                    {venue.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Info size={16} />
                    场地介绍
                  </h3>
                  <p className="text-gray-300 leading-relaxed text-lg font-serif">
                    {venue.intro}
                  </p>
                </div>
                
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin size={16} />
                    详细地址
                  </h3>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-start gap-3">
                    <div className="bg-[#ff4e00]/20 p-2 rounded-lg text-[#ff4e00] shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="text-white font-medium mb-1">{venue.address}</p>
                      <p className="text-sm text-gray-400">建议提前规划路线，演出日周边可能拥堵。</p>
                    </div>
                  </div>
                </div>

                {venue.contactInfo && (
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Mail size={16} />
                      联系方式
                    </h3>
                    <div 
                      onClick={() => setShowContact(!showContact)}
                      className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 flex items-center gap-3 cursor-pointer transition-colors"
                    >
                      <div className="bg-[#ff4e00]/20 p-2 rounded-lg text-[#ff4e00] shrink-0">
                        <Mail size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">
                          {showContact ? venue.contactInfo : '点击查看联系方式 (微信/邮箱)'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {showContact ? '请说明来意' : '仅供演出预定及场地合作'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-6 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                <div>
                  <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={16} />
                    近期演出 (Demo)
                  </h3>
                  
                  {/* Mock Events List */}
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-black/40 rounded-xl p-3 border border-white/5 hover:border-white/20 transition-colors cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-[#ff4e00] font-mono">10/{15 + i}</span>
                          <span className="text-[10px] text-gray-500 border border-gray-700 px-1.5 rounded">售票中</span>
                        </div>
                        <p className="text-sm text-white font-medium truncate group-hover:text-[#ff4e00] transition-colors">
                          {['独立摇滚之夜', '后朋克派对', '民谣不插电专场'][i-1]}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {['Carsick Cars / 刺猬', '法兹 FAZI', '五条人'][i-1]}
                        </p>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-4 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                    查看全部演出
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VenueModal;

import React, { useState } from "react";
import { X, Disc, Headphones, Music, BookHeart, Mail } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Band } from "../data";

interface BandModalProps {
  band: Band | null;
  onClose: () => void;
}

const BandModal: React.FC<BandModalProps> = ({ band, onClose }) => {
  const [showContact, setShowContact] = useState(false);

  // Reset showContact when band changes
  React.useEffect(() => {
    setShowContact(false);
  }, [band]);

  if (!band) return null;

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
          className="relative w-full max-w-3xl bg-[#151619] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Header Image Area */}
          <div className="relative h-64 md:h-80 w-full overflow-hidden">
            <img
              src={band.imageUrl || `https://picsum.photos/seed/${band.id}/800/400?grayscale`}
              alt={band.name_zh}
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
                    {band.genre}
                  </span>
                  <span className="inline-block px-3 py-1 bg-white/10 text-gray-300 border border-white/20 rounded-full text-xs font-medium tracking-widest mb-3 ml-2">
                    {band.city_zh}
                  </span>
                  <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-1">
                    {band.name_zh}
                  </h2>
                  <p className="text-lg text-gray-300 font-mono tracking-wider">
                    {band.name}
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
                    <Disc size={16} />
                    乐队介绍
                  </h3>
                  <p className="text-gray-300 leading-relaxed text-lg font-serif">
                    {band.intro}
                  </p>
                </div>
                
                {band.contactInfo && (
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
                          {showContact ? band.contactInfo : '点击查看联系方式 (微信/邮箱)'}
                        </p>
                        <p className="text-sm text-gray-400">
                          {showContact ? '请说明来意' : '仅供演出邀约及商务合作'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-6 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8">
                <div>
                  <h3 className="text-sm text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Headphones size={16} />
                    作品与动态
                  </h3>
                  
                  <div className="flex flex-col gap-4">
                    {/* NetEase Cloud Music Link */}
                    <a 
                      href={band.neteaseUrl || `https://music.163.com/#/search/m/?s=${encodeURIComponent(band.name_zh)}&type=100`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 bg-[#C20C0C]/10 hover:bg-[#C20C0C]/20 rounded-xl p-4 border border-[#C20C0C]/30 transition-all duration-300"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#C20C0C] flex items-center justify-center text-white shadow-[0_0_15px_rgba(194,12,12,0.4)] group-hover:scale-110 transition-transform duration-300 shrink-0">
                        <Music size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-medium text-sm mb-0.5">网易云音乐</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                          主页试听
                        </span>
                      </div>
                    </a>

                    {/* Xiaohongshu Link */}
                    <a 
                      href={band.xiaohongshuUrl || `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(band.name_zh)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 bg-[#ff2442]/10 hover:bg-[#ff2442]/20 rounded-xl p-4 border border-[#ff2442]/30 transition-all duration-300"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#ff2442] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,36,66,0.4)] group-hover:scale-110 transition-transform duration-300 shrink-0">
                        <BookHeart size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-medium text-sm mb-0.5">小红书</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                          查看动态
                        </span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BandModal;

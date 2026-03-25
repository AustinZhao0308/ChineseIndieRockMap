import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Bug, Github, X, CheckCircle2, Copy, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedbackMenuProps {
  isPanelOpen?: boolean;
  hasBanner?: boolean;
}

export default function FeedbackMenu({ isPanelOpen = false, hasBanner = false }: FeedbackMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyWechat = async () => {
    try {
      await navigator.clipboard.writeText('catbeer_music');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = 'catbeer_music';
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Copy failed', e);
      }
      textArea.remove();
    }
  };

  return (
    <div 
      className={`absolute right-4 md:right-8 z-30 transition-all duration-500 ease-in-out
        ${hasBanner ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-8' : 'bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:bottom-8'}
        ${isPanelOpen 
          ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' 
          : ''
        }
      `} 
      ref={menuRef}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 md:bottom-16 right-0 mb-2 w-64 md:w-72 bg-[#151619] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 space-y-1">
              <button
                onClick={handleCopyWechat}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#07C160]/10 flex items-center justify-center text-[#07C160] shrink-0">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">乐队登记 / 勘误</div>
                    <div className="text-xs text-gray-400 mt-0.5">微信: catbeer_music</div>
                  </div>
                </div>
                {copied ? (
                  <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                ) : (
                  <Copy size={18} className="text-gray-500 group-hover:text-white transition-colors shrink-0" />
                )}
              </button>

              <a
                href="https://github.com/AustinZhao0308/ChineseIndieRockMap/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#ff4e00]/10 flex items-center justify-center text-[#ff4e00] shrink-0">
                  <Bug size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">需求 / Bug 反馈</div>
                  <div className="text-xs text-gray-400 mt-0.5">前往 GitHub 提交 Issue</div>
                </div>
              </a>

              <a
                href="https://github.com/AustinZhao0308/ChineseIndieRockMap"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
                  <Github size={20} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">开源 / 共建</div>
                  <div className="text-xs text-gray-400 mt-0.5">查看源码，欢迎 PR</div>
                </div>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all
          ${isOpen 
            ? 'bg-[#ff4e00] text-white shadow-[0_0_15px_rgba(255,78,0,0.3)]' 
            : 'bg-[#151619]/90 backdrop-blur-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)]'
          }
        `}
      >
        {isOpen ? <X size={20} className="md:w-6 md:h-6" /> : <HelpCircle size={20} className="md:w-6 md:h-6" />}
      </button>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Search, X } from 'lucide-react';

type ImageAssetReference = {
  type: string;
  title: string;
};

type ImageAsset = {
  filename: string;
  path: string;
  url: string;
  size: number;
  used: boolean;
  references: ImageAssetReference[];
};

type ImageAssetPickerProps = {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSelect: (url: string) => void;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function ImageAssetPicker({ isOpen, token, onClose, onSelect }: ImageAssetPickerProps) {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError('');
    fetch('/api/admin/assets', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load image assets');
        setAssets(data.assets || []);
      })
      .catch(err => setError(err.message || 'Failed to load image assets'))
      .finally(() => setLoading(false));
  }, [isOpen, token]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return assets;
    return assets.filter(asset =>
      asset.path.toLowerCase().includes(normalizedQuery) ||
      asset.url.toLowerCase().includes(normalizedQuery) ||
      asset.references.some(ref => ref.title.toLowerCase().includes(normalizedQuery) || ref.type.toLowerCase().includes(normalizedQuery))
    );
  }, [assets, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[86vh] flex flex-col">
        <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
          <h2 className="text-xl font-medium text-white flex items-center gap-2">
            <ImageIcon size={20} className="text-[#ff4e00]" />
            Choose Uploaded Image / 选择已上传图片
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search path or reference..."
              className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading image assets...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No uploaded images found.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <button
                  type="button"
                  key={asset.url}
                  onClick={() => {
                    onSelect(asset.url);
                    onClose();
                  }}
                  className="text-left rounded-lg border border-white/10 bg-black/30 overflow-hidden hover:border-[#ff4e00]/60 hover:bg-white/5 transition-colors"
                >
                  <div className="aspect-[4/3] bg-black/50">
                    <img src={asset.url} alt={asset.filename} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white truncate">{asset.filename}</span>
                      <span className="text-xs text-gray-500 shrink-0">{formatBytes(asset.size)}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono truncate">{asset.path}</div>
                    <div className={`inline-flex text-[10px] px-2 py-0.5 rounded-full ${asset.used ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      {asset.used ? 'Used' : 'Unused'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Plus, Trash2, Edit2, Music, MapPin } from 'lucide-react';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bands, setBands] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bands' | 'venues'>('bands');
  const [locations, setLocations] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);

  const showMessage = (text: string, type: 'error' | 'success' = 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    province_id: '',
    province_zh: '',
    city_id: '',
    city_zh: '',
    // Band specific
    band_id: '',
    genre: '',
    netease_url: '',
    xiaohongshu_url: '',
    // Venue specific
    venue_id: '',
    address: '',
    capacity: '',
    // Common
    name: '',
    name_zh: '',
    intro: '',
    image_url: '',
    contact_info: ''
  });

  // Derived options for dropdowns
  const provinces = locations;
  const selectedProvince = provinces.find(p => p.en === formData.province_id);
  const cities = selectedProvince ? selectedProvince.cities : [];

  useEffect(() => {
    fetch('/provincecity.json')
      .then(res => res.json())
      .then(data => {
        if (data && data['中国']) {
          setLocations(data['中国']);
        }
      })
      .catch(err => console.error('Failed to load locations', err));
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'bands' ? '/api/bands' : '/api/venues';
      const res = await fetch(endpoint);
      const data = await res.json();
      if (activeTab === 'bands') setBands(data);
      else setVenues(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provId = e.target.value;
    const prov = provinces.find(p => p.en === provId);
    setFormData({
      ...formData,
      province_id: provId,
      province_zh: prov ? prov.zh : '',
      city_id: '',
      city_zh: ''
    });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityId = e.target.value;
    const city = cities.find(c => c.en === cityId);
    setFormData({
      ...formData,
      city_id: cityId,
      city_zh: city ? city.zh : ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = activeTab === 'bands' ? '/api/bands' : '/api/venues';
      const url = isEditing ? `${endpoint}/${currentId}` : endpoint;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      if (activeTab === 'venues') {
        payload.capacity = parseInt(payload.capacity as string) || 0 as any;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchData();
        resetForm();
        showMessage(isEditing ? 'Updated successfully' : 'Added successfully', 'success');
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to save');
      }
    } catch (err) {
      showMessage('Network error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const endpoint = activeTab === 'bands' ? '/api/bands' : '/api/venues';
      const res = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        setConfirmDeleteId(null);
        showMessage('Deleted successfully', 'success');
      } else {
        showMessage('Failed to delete');
      }
    } catch (err) {
      showMessage('Network error');
    }
  };

  const handleEdit = (item: any) => {
    setIsEditing(true);
    setCurrentId(item.id);
    setFormData({
      province_id: item.province_id,
      province_zh: item.province_zh,
      city_id: item.city_id,
      city_zh: item.city_zh,
      band_id: item.band_id || '',
      venue_id: item.venue_id || '',
      name: item.name,
      name_zh: item.name_zh,
      genre: item.genre || '',
      netease_url: item.netease_url || '',
      xiaohongshu_url: item.xiaohongshu_url || '',
      address: item.address || '',
      capacity: item.capacity ? item.capacity.toString() : '',
      intro: item.intro,
      image_url: item.image_url || '',
      contact_info: item.contact_info || ''
    });
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setFormData({
      province_id: '', province_zh: '', city_id: '', city_zh: '',
      band_id: '', venue_id: '', name: '', name_zh: '', genre: '', 
      netease_url: '', xiaohongshu_url: '',
      address: '', capacity: '', intro: '', image_url: '', contact_info: ''
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#1a1a1a] p-8 rounded-2xl max-w-md w-full border border-white/10">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-[#ff4e00] rounded-full flex items-center justify-center text-white">
              <Lock size={24} />
            </div>
          </div>
          <h2 className="text-2xl text-white text-center mb-6 font-serif">Admin Access</h2>
          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-[#ff4e00]"
          />
          <button type="submit" className="w-full bg-[#ff4e00] text-white rounded-lg py-3 font-medium hover:bg-[#ff4e00]/90 transition-colors">
            Enter
          </button>
        </form>
      </div>
    );
  }

  const currentList = activeTab === 'bands' ? bands : venues;

  return (
    <div className="min-h-screen bg-[#0a0502] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif">Data Management</h1>
          <div className="flex items-center gap-4">
            {message && (
              <div className={`px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => { setActiveTab('bands'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'bands' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Music size={18} /> Manage Bands
          </button>
          <button 
            onClick={() => { setActiveTab('venues'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'venues' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <MapPin size={18} /> Manage Venues
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 h-fit">
            <h2 className="text-xl mb-6 font-medium flex items-center gap-2">
              {isEditing ? <Edit2 size={20} className="text-[#ff4e00]" /> : <Plus size={20} className="text-[#ff4e00]" />}
              {isEditing ? `Edit ${activeTab === 'bands' ? 'Band' : 'Venue'}` : `Add New ${activeTab === 'bands' ? 'Band' : 'Venue'}`}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select required value={formData.province_id} onChange={handleProvinceChange} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white">
                  <option value="" disabled>Select Province</option>
                  {provinces.map(p => (
                    <option key={p.en} value={p.en}>{p.zh} ({p.en})</option>
                  ))}
                </select>
                <select required value={formData.city_id} onChange={handleCityChange} disabled={!formData.province_id} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white disabled:opacity-50">
                  <option value="" disabled>Select City</option>
                  {cities.map(c => (
                    <option key={c.en} value={c.en}>{c.zh} ({c.en})</option>
                  ))}
                </select>
              </div>

              {activeTab === 'bands' ? (
                <input required placeholder="Band ID (e.g. carsick-cars)" value={formData.band_id} onChange={e => setFormData({...formData, band_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              ) : (
                <input required placeholder="Venue ID (e.g. school-bar)" value={formData.venue_id} onChange={e => setFormData({...formData, venue_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              )}

              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Name (副标题)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                <input required placeholder="Name (主标题)" value={formData.name_zh} onChange={e => setFormData({...formData, name_zh: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              </div>

              {activeTab === 'bands' ? (
                <>
                  <input required placeholder="Genre (e.g. Indie Rock)" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="NetEase Cloud Music URL" value={formData.netease_url} onChange={e => setFormData({...formData, netease_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <input placeholder="Xiaohongshu URL" value={formData.xiaohongshu_url} onChange={e => setFormData({...formData, xiaohongshu_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  </div>
                </>
              ) : (
                <>
                  <input required placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required type="number" placeholder="Capacity (e.g. 500)" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                </>
              )}

              <textarea required placeholder="Introduction" value={formData.intro} onChange={e => setFormData({...formData, intro: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full h-24 resize-none" />
              <input placeholder="Image URL (optional)" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              <input placeholder="Contact Info (WeChat/Email) (optional)" value={formData.contact_info} onChange={e => setFormData({...formData, contact_info: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-[#ff4e00] text-white rounded py-2 text-sm font-medium hover:bg-[#ff4e00]/90">
                  {isEditing ? 'Update' : 'Add'}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="flex-1 bg-white/10 text-white rounded py-2 text-sm font-medium hover:bg-white/20">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-[#1a1a1a] p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl mb-6 font-medium">Current {activeTab === 'bands' ? 'Bands' : 'Venues'} ({currentList.length})</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {currentList.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-black/30 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{item.name_zh}</span>
                        <span className="text-xs text-gray-500">{item.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex gap-2">
                        <span className="bg-white/5 px-2 py-0.5 rounded">{item.province_zh} - {item.city_zh}</span>
                        {activeTab === 'bands' ? (
                          <span className="bg-[#ff4e00]/10 text-[#ff4e00] px-2 py-0.5 rounded">{item.genre}</span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">容纳 {item.capacity} 人</span>
                        )}
                        {item.contact_info && (
                          <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded">有联系方式</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {confirmDeleteId === item.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">确定删除?</span>
                          <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                            是
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors">
                            否
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => setConfirmDeleteId(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

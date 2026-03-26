import React, { useState, useEffect } from 'react';
import { Lock, LogOut, Plus, Trash2, Edit2, Music, MapPin, X, Calendar, Star, Mic2, Coffee } from 'lucide-react';

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bands, setBands] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rehearsalRooms, setRehearsalRooms] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bands' | 'venues' | 'events' | 'rehearsal_rooms' | 'spots' | 'settings'>('bands');
  const [locations, setLocations] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');
  const [contactType, setContactType] = useState<'wechat' | 'email'>('wechat');
  const [contactValue, setContactValue] = useState('');
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

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
    ticket_url: '',
    // Rehearsal Room specific
    room_id: '',
    equipment: '',
    price_info: '',
    // Spot specific
    spot_id: '',
    type: '',
    business_hours: '',
    social_url: '',
    // Event specific
    title: '',
    date_str: '',
    location: '',
    is_active: false,
    lineup: [] as { day: string, bandIds: string[] }[],
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
      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'events' ? '/api/featured_events' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : '/api/spots';
      const res = await fetch(endpoint);
      const data = await res.json();
      if (activeTab === 'bands') setBands(data);
      else if (activeTab === 'venues') setVenues(data);
      else if (activeTab === 'events') setEvents(data);
      else if (activeTab === 'rehearsal_rooms') setRehearsalRooms(data);
      else if (activeTab === 'spots') setSpots(data);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      });
      if (res.ok) {
        showMessage('Password updated successfully', 'success');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await res.json();
        showMessage(data.error || 'Failed to update password', 'error');
      }
    } catch (err) {
      showMessage('Network error', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      showMessage('File size exceeds 1MB limit', 'error');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('image', file);

    try {
      showMessage('Uploading image...', 'success');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadData
      });
      
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        showMessage('登录已过期，请重新登录', 'error');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, image_url: data.url }));
        showMessage('Image uploaded successfully', 'success');
      } else {
        showMessage(data.error || 'Failed to upload image');
      }
    } catch (err) {
      showMessage('Network error during upload');
    }
  };

  const handleRemoveImage = async () => {
    const currentUrl = formData.image_url;
    if (!currentUrl) return;

    // If it's a local upload, delete it from server
    if (currentUrl.startsWith('/uploads/')) {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: currentUrl })
        });
      } catch (err) {
        console.error('Failed to delete image from server', err);
      }
    }

    // Clear the form data
    setFormData(prev => ({ ...prev, image_url: '' }));
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
      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'events' ? '/api/featured_events' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : '/api/spots';
      const url = isEditing ? `${endpoint}/${currentId}` : endpoint;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = { ...formData } as any;
      payload.contact_info = contactValue ? `${contactType}:${contactValue}` : '';
      if (activeTab === 'venues') {
        payload.capacity = parseInt(payload.capacity as string) || 0 as any;
      }
      if (activeTab === 'events') {
        payload.description = payload.intro;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        showMessage('登录已过期，请重新登录', 'error');
        return;
      }

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
      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'events' ? '/api/featured_events' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : '/api/spots';
      const res = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        showMessage('登录已过期，请重新登录', 'error');
        return;
      }

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
    
    let cType: 'wechat' | 'email' = 'wechat';
    let cValue = item.contact_info || '';
    if (cValue.startsWith('wechat:')) {
      cType = 'wechat';
      cValue = cValue.substring(7);
    } else if (cValue.startsWith('email:')) {
      cType = 'email';
      cValue = cValue.substring(6);
    }
    setContactType(cType);
    setContactValue(cValue);

    let parsedLineup = [];
    if (item.lineup) {
      try {
        parsedLineup = typeof item.lineup === 'string' ? JSON.parse(item.lineup) : item.lineup;
        // If it's already populated with band objects, map it back to just IDs for the form
        parsedLineup = parsedLineup.map((dayObj: any) => ({
          day: dayObj.day,
          bandIds: dayObj.bandIds || (dayObj.bands ? dayObj.bands.map((b: any) => b.band_id) : [])
        }));
      } catch (e) {
        parsedLineup = [];
      }
    }

    setFormData({
      province_id: item.province_id,
      province_zh: item.province_zh,
      city_id: item.city_id,
      city_zh: item.city_zh,
      band_id: item.band_id || '',
      venue_id: item.venue_id || '',
      room_id: item.room_id || '',
      spot_id: item.spot_id || '',
      name: item.name,
      name_zh: item.name_zh,
      genre: item.genre || '',
      type: item.type || '',
      netease_url: item.netease_url || '',
      xiaohongshu_url: item.xiaohongshu_url || '',
      social_url: item.social_url || '',
      address: item.address || '',
      capacity: item.capacity ? item.capacity.toString() : '',
      equipment: item.equipment || '',
      price_info: item.price_info || '',
      business_hours: item.business_hours || '',
      ticket_url: item.ticket_url || '',
      title: item.title || '',
      date_str: item.date_str || '',
      location: item.location || '',
      is_active: !!item.is_active,
      lineup: parsedLineup,
      intro: item.intro || item.description || '',
      image_url: item.image_url || '',
      contact_info: item.contact_info || ''
    });
    setImageInputType(item.image_url && !item.image_url.startsWith('/uploads/') ? 'url' : 'upload');
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setContactType('wechat');
    setContactValue('');
    setImageInputType('upload');
    setFormData({
      province_id: '', province_zh: '', city_id: '', city_zh: '',
      band_id: '', venue_id: '', room_id: '', spot_id: '', name: '', name_zh: '', genre: '', type: '',
      netease_url: '', xiaohongshu_url: '', social_url: '', ticket_url: '',
      title: '', date_str: '', location: '', is_active: false, lineup: [],
      address: '', capacity: '', equipment: '', price_info: '', business_hours: '', intro: '', image_url: '', contact_info: ''
    });
  };

  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0502] flex items-center justify-center p-4">
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

  const currentList = activeTab === 'bands' ? bands : activeTab === 'venues' ? venues : activeTab === 'events' ? events : activeTab === 'rehearsal_rooms' ? rehearsalRooms : spots;

  return (
    <div className="min-h-[100dvh] bg-[#0a0502] text-white p-8 font-sans">
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
        <div className="flex flex-wrap gap-4 mb-8">
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
          <button 
            onClick={() => { setActiveTab('rehearsal_rooms'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'rehearsal_rooms' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Mic2 size={18} /> Manage Rehearsal Rooms
          </button>
          <button 
            onClick={() => { setActiveTab('spots'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'spots' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Coffee size={18} /> Manage Spots
          </button>
          <button 
            onClick={() => { setActiveTab('events'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'events' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Calendar size={18} /> Manage Events
          </button>
          <button 
            onClick={() => { setActiveTab('settings'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'settings' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Lock size={18} /> Settings
          </button>
        </div>

        {activeTab === 'settings' ? (
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 max-w-md">
            <h2 className="text-xl mb-6 font-medium flex items-center gap-2">
              <Lock size={20} className="text-[#ff4e00]" />
              Change Password
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                required
                placeholder="Current Password"
                value={passwordForm.oldPassword}
                onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <input
                type="password"
                required
                placeholder="New Password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <input
                type="password"
                required
                placeholder="Confirm New Password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <button type="submit" className="w-full bg-[#ff4e00] text-white rounded py-2 text-sm font-medium hover:bg-[#ff4e00]/90">
                Update Password
              </button>
            </form>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 h-fit">
            <h2 className="text-xl mb-6 font-medium flex items-center gap-2">
              {isEditing ? <Edit2 size={20} className="text-[#ff4e00]" /> : <Plus size={20} className="text-[#ff4e00]" />}
              {isEditing ? `Edit ${activeTab === 'bands' ? 'Band' : activeTab === 'venues' ? 'Venue' : activeTab === 'events' ? 'Event' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Room' : 'Spot'}` : `Add New ${activeTab === 'bands' ? 'Band' : activeTab === 'venues' ? 'Venue' : activeTab === 'events' ? 'Event' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Room' : 'Spot'}`}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab !== 'events' && (
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
              )}

              {activeTab === 'bands' ? (
                <input required placeholder="Band ID (e.g. carsick-cars)" value={formData.band_id} onChange={e => setFormData({...formData, band_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              ) : activeTab === 'venues' ? (
                <input required placeholder="Venue ID (e.g. school-bar)" value={formData.venue_id} onChange={e => setFormData({...formData, venue_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              ) : activeTab === 'rehearsal_rooms' ? (
                <input required placeholder="Room ID (e.g. super-rehearsal)" value={formData.room_id} onChange={e => setFormData({...formData, room_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              ) : activeTab === 'spots' ? (
                <input required placeholder="Spot ID (e.g. fruityspace)" value={formData.spot_id} onChange={e => setFormData({...formData, spot_id: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
              ) : null}

              {activeTab === 'events' ? (
                <>
                  <input required placeholder="Event Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Date (e.g. 2026.4.3 - 4.5)" value={formData.date_str} onChange={e => setFormData({...formData, date_str: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <input required placeholder="Location Name (e.g. Mosh Space)" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  </div>
                  <input required placeholder="Full Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input placeholder="Ticket URL" value={formData.ticket_url} onChange={e => setFormData({...formData, ticket_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-white/10 bg-black/50 text-[#ff4e00] focus:ring-[#ff4e00]" />
                    Set as Active Featured Event
                  </label>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Name (副标题)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required placeholder="Name (主标题)" value={formData.name_zh} onChange={e => setFormData({...formData, name_zh: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                </div>
              )}

              {activeTab === 'bands' ? (
                <>
                  <input required placeholder="Genre (e.g. Indie Rock)" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="NetEase Cloud Music URL" value={formData.netease_url} onChange={e => setFormData({...formData, netease_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <input placeholder="Xiaohongshu URL" value={formData.xiaohongshu_url} onChange={e => setFormData({...formData, xiaohongshu_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  </div>
                </>
              ) : activeTab === 'venues' ? (
                <>
                  <input required placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input required type="number" placeholder="Capacity (e.g. 500)" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <input placeholder="Ticket URL (e.g. ShowStart)" value={formData.ticket_url} onChange={e => setFormData({...formData, ticket_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  </div>
                </>
              ) : activeTab === 'rehearsal_rooms' ? (
                <>
                  <input required placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required placeholder="Equipment (e.g. Marshall JCM900...)" value={formData.equipment} onChange={e => setFormData({...formData, equipment: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required placeholder="Price Info (e.g. 80元/小时)" value={formData.price_info} onChange={e => setFormData({...formData, price_info: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                </>
              ) : activeTab === 'spots' ? (
                <>
                  <input required placeholder="Type (e.g. 唱片店, 摇滚酒吧)" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Business Hours" value={formData.business_hours} onChange={e => setFormData({...formData, business_hours: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <input placeholder="Social URL (e.g. Xiaohongshu)" value={formData.social_url} onChange={e => setFormData({...formData, social_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  </div>
                </>
              ) : null}

              <textarea required placeholder={activeTab === 'events' ? "Event Description" : "Introduction"} value={formData.intro} onChange={e => setFormData({...formData, intro: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full h-24 resize-none" />
              
              {activeTab === 'events' && (
                <div className="space-y-4 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-white">Lineup Configuration</h3>
                    <button type="button" onClick={() => setFormData({...formData, lineup: [...formData.lineup, { day: `Day ${formData.lineup.length + 1}`, bandIds: [] }]})} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={14}/> Add Day</button>
                  </div>
                  {formData.lineup.map((dayObj, dayIndex) => (
                    <div key={dayIndex} className="space-y-2 border border-white/5 p-3 rounded-lg bg-black/40">
                      <div className="flex justify-between items-center">
                        <input value={dayObj.day} onChange={e => {
                          const newLineup = [...formData.lineup];
                          newLineup[dayIndex].day = e.target.value;
                          setFormData({...formData, lineup: newLineup});
                        }} className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-[#ff4e00] font-mono focus:outline-none focus:border-[#ff4e00] w-1/2" placeholder="e.g. Day 1 - Friday" />
                        <button type="button" onClick={() => {
                          const newLineup = formData.lineup.filter((_, i) => i !== dayIndex);
                          setFormData({...formData, lineup: newLineup});
                        }} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {dayObj.bandIds.map((bandId, bandIndex) => {
                          const band = bands.find(b => b.band_id === bandId);
                          return (
                            <div key={bandIndex} className="flex items-center gap-1 bg-white/10 text-xs px-2 py-1 rounded-full text-gray-300">
                              {band ? band.name_zh || band.name : bandId}
                              <button type="button" onClick={() => {
                                const newLineup = [...formData.lineup];
                                newLineup[dayIndex].bandIds = newLineup[dayIndex].bandIds.filter((_, i) => i !== bandIndex);
                                setFormData({...formData, lineup: newLineup});
                              }} className="hover:text-red-400 ml-1"><X size={12}/></button>
                            </div>
                          );
                        })}
                        <select onChange={e => {
                          if (!e.target.value) return;
                          const newLineup = [...formData.lineup];
                          if (!newLineup[dayIndex].bandIds.includes(e.target.value)) {
                            newLineup[dayIndex].bandIds.push(e.target.value);
                          }
                          setFormData({...formData, lineup: newLineup});
                          e.target.value = '';
                        }} className="bg-black/50 border border-white/10 rounded-full px-2 py-1 text-xs text-gray-400 focus:outline-none">
                          <option value="">+ Add Band</option>
                          {bands.map(b => (
                            <option key={b.band_id} value={b.band_id}>{b.name_zh || b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400 block">Image (Max 1MB)</label>
                  <div className="flex gap-2 bg-black/50 rounded-lg p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setImageInputType('upload')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputType === 'upload' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputType('url')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputType === 'url' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Image URL
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {imageInputType === 'upload' ? (
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20" />
                  ) : (
                    <input placeholder="Enter Image URL (e.g. https://...)" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  )}
                </div>
                {formData.image_url && (
                  <div className="mt-2 relative inline-block">
                    <img src={formData.image_url} alt="Preview" className="h-20 w-auto rounded border border-white/10 object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-lg transition-colors"
                      title="Remove Image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {activeTab !== 'events' && (
                <div className="flex gap-2">
                  <select 
                    value={contactType} 
                    onChange={e => setContactType(e.target.value as 'wechat' | 'email')}
                    className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-1/3 text-white"
                  >
                    <option value="wechat">WeChat</option>
                    <option value="email">Email</option>
                  </select>
                  <input 
                    placeholder="Contact Info (optional)" 
                    value={contactValue} 
                    onChange={e => setContactValue(e.target.value)} 
                    className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-2/3" 
                  />
                </div>
              )}
              
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
            <h2 className="text-xl mb-6 font-medium">Current {activeTab === 'bands' ? 'Bands' : activeTab === 'venues' ? 'Venues' : activeTab === 'events' ? 'Events' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Rooms' : 'Spots'} ({currentList.length})</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {currentList.map(item => (
                  <div key={item.id} className={`flex items-center justify-between bg-black/30 p-4 rounded-lg border ${item.is_active ? 'border-[#ff4e00]/50' : 'border-white/5'} hover:border-white/10 transition-colors`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">{activeTab === 'events' ? item.title : item.name_zh}</span>
                        {activeTab !== 'events' && <span className="text-xs text-gray-500">{item.name}</span>}
                        {item.is_active && <span className="text-[10px] bg-[#ff4e00] text-white px-1.5 py-0.5 rounded flex items-center gap-1"><Star size={10} /> Active</span>}
                      </div>
                      <div className="text-xs text-gray-400 flex gap-2">
                        {activeTab === 'events' ? (
                          <>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.date_str}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.location}</span>
                          </>
                        ) : (
                          <>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.province_zh} - {item.city_zh}</span>
                            {activeTab === 'bands' ? (
                              <span className="bg-[#ff4e00]/10 text-[#ff4e00] px-2 py-0.5 rounded">{item.genre}</span>
                            ) : activeTab === 'venues' ? (
                              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">容纳 {item.capacity} 人</span>
                            ) : activeTab === 'rehearsal_rooms' ? (
                              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">{item.price_info}</span>
                            ) : activeTab === 'spots' ? (
                              <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">{item.type}</span>
                            ) : null}
                            {item.contact_info && (
                              <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded">有联系方式</span>
                            )}
                          </>
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
        )}
      </div>
    </div>
  );
}

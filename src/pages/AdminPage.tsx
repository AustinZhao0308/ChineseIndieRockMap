import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Code2, Lock, LogOut, Plus, Trash2, Edit2, Music, MapPin, X, Calendar, Star, Mic2, Coffee, Search, Upload } from 'lucide-react';
import BulkImportModal from '../components/BulkImportModal';

type EventTicketForm = {
  label: string;
  url: string;
};

type EventRecapPhotoForm = {
  title: string;
  caption: string;
  image_url: string;
};

type EventRecapVideoForm = {
  title: string;
  url: string;
};

type EventStopForm = {
  id: string;
  label: string;
  start_at: string;
  venue_id: string;
  guestBandIds: string[];
  price_text: string;
  tickets: EventTicketForm[];
  recap_photos: EventRecapPhotoForm[];
  recap_video: EventRecapVideoForm;
};

type EventQrCodeForm = {
  title: string;
  image_url: string;
};

const createEmptyStop = (index: number): EventStopForm => ({
  id: '',
  label: `第 ${index + 1} 站`,
  start_at: '',
  venue_id: '',
  guestBandIds: [],
  price_text: '',
  tickets: [],
  recap_photos: [],
  recap_video: { title: '', url: '' }
});

const normalizeStopsForForm = (stops: any): EventStopForm[] => {
  const source = typeof stops === 'string' ? (() => {
    try { return JSON.parse(stops); } catch (e) { return []; }
  })() : stops;

  if (!Array.isArray(source)) return [];

  return source.map((stop, index) => ({
    id: stop.id || '',
    label: stop.label || `第 ${index + 1} 站`,
    start_at: stop.start_at || '',
    venue_id: stop.venue_id || '',
    guestBandIds: Array.isArray(stop.guestBandIds) ? stop.guestBandIds : [],
    price_text: stop.price_text || stop.priceText || '',
    tickets: Array.isArray(stop.tickets)
      ? stop.tickets.map((ticket: any) => ({
          label: ticket.label || '购票',
          url: ticket.url || ''
        }))
      : [],
    recap_photos: Array.isArray(stop.recap_photos || stop.recapPhotos)
      ? (stop.recap_photos || stop.recapPhotos).map((photo: any) => ({
          title: photo.title || '',
          caption: photo.caption || '',
          image_url: photo.image_url || photo.imageUrl || ''
        }))
      : [],
    recap_video: {
      title: stop.recap_video?.title || stop.recapVideo?.title || '',
      url: stop.recap_video?.url || stop.recapVideo?.url || ''
    }
  }));
};

const slugifySegment = (value: string, fallback: string) => {
  const segment = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return segment || fallback;
};

const toDateTimeLocalValue = (value: string) => {
  if (!value) return '';
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : value;
};

const fromDateTimeLocalValue = (value: string) => {
  if (!value) return '';
  if (value.length === 16) return `${value}:00+08:00`;
  if (value.length === 19 && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return `${value}+08:00`;
  return value;
};

const formatStopDateTime = (value: string) => {
  const match = value.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return value;
  return `${match[1]}.${match[2]} ${match[3]}:${match[4]}`;
};

const buildEventLegacyFields = (source: {
  date_str: string;
  location: string;
  address: string;
  stops: EventStopForm[];
}, venues: any[] = []) => {
  const getVenue = (stop: EventStopForm) => venues.find(venue => venue.venue_id === stop.venue_id);
  const getVenueName = (stop: EventStopForm) => {
    const venue = getVenue(stop);
    return venue ? (venue.name_zh || venue.name) : stop.venue_id;
  };
  const getVenueCity = (stop: EventStopForm) => {
    const venue = getVenue(stop);
    return venue?.city_zh || '';
  };
  const getVenueAddress = (stop: EventStopForm) => {
    const venue = getVenue(stop);
    return venue?.address || getVenueName(stop);
  };

  const stops = source.stops.filter(stop => stop.label || stop.start_at || stop.venue_id);
  if (stops.length === 0) {
    return {
      date_str: source.date_str,
      location: source.location,
      address: source.address
    };
  }

  return {
    date_str: stops
      .map(stop => [stop.label, formatStopDateTime(stop.start_at)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' / '),
    location: stops
      .map(stop => [getVenueCity(stop), getVenueName(stop)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' / '),
    address: stops
      .map(stop => {
        const label = stop.label || getVenueCity(stop) || getVenueName(stop);
        const place = getVenueAddress(stop);
        return [label, place].filter(Boolean).join('：');
      })
      .filter(Boolean)
      .join('；')
  };
};

const cleanEventStopsForSave = (stops: EventStopForm[]) => {
  return stops.map((stop, index) => {
    const recapPhotos = stop.recap_photos
      .map(photo => ({
        title: photo.title.trim(),
        caption: photo.caption.trim(),
        image_url: photo.image_url.trim()
      }))
      .filter(photo => photo.title || photo.caption || photo.image_url);
    const recapVideo = {
      title: stop.recap_video.title.trim(),
      url: stop.recap_video.url.trim()
    };

    return {
      id: stop.id || slugifySegment(stop.label, `stop-${index + 1}`),
      label: stop.label,
      start_at: stop.start_at,
      venue_id: stop.venue_id,
      guestBandIds: stop.guestBandIds || [],
      price_text: stop.price_text,
      tickets: stop.tickets,
      recap_photos: recapPhotos,
      recap_video: recapVideo.title || recapVideo.url ? recapVideo : undefined
    };
  });
};

const normalizeQrCodesForForm = (qrCodes: any): EventQrCodeForm[] => {
  const source = typeof qrCodes === 'string' ? (() => {
    try { return JSON.parse(qrCodes); } catch (e) { return []; }
  })() : qrCodes;

  if (!Array.isArray(source)) return [];

  return source.map(qrCode => ({
    title: qrCode.title || '',
    image_url: qrCode.image_url || qrCode.imageUrl || ''
  }));
};

const cleanQrCodesForSave = (qrCodes: EventQrCodeForm[]) => {
  return qrCodes
    .map(qrCode => ({
      title: qrCode.title.trim(),
      image_url: qrCode.image_url.trim()
    }))
    .filter(qrCode => qrCode.title || qrCode.image_url);
};

const adminTabs = ['bands', 'venues', 'events', 'rehearsal_rooms', 'spots', 'settings'] as const;
type AdminTab = typeof adminTabs[number];

export default function AdminPage() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedEdit = searchParams.get('edit');
  const initialTab: AdminTab = adminTabs.includes(requestedTab as AdminTab) ? requestedTab as AdminTab : 'bands';
  const autoEditKeyRef = useRef('');
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [bands, setBands] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rehearsalRooms, setRehearsalRooms] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [locations, setLocations] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');
  const [contactType, setContactType] = useState<'wechat' | 'email'>('wechat');
  const [contactValue, setContactValue] = useState('');
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [eventJsonInput, setEventJsonInput] = useState('');

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
    slug: '',
    title: '',
    date_str: '',
    location: '',
    organizer: '',
    status: 'on_sale',
    is_active: false,
    lineup: [] as { day: string, bandIds: string[] }[],
    stops: [] as EventStopForm[],
    qr_codes: [] as EventQrCodeForm[],
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
        if (data && data['地区']) {
          setLocations(data['地区']);
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
      if (activeTab === 'events') {
        const [eventsData, bandsData, venuesData] = await Promise.all([
          fetch('/api/featured_events').then(res => res.json()),
          fetch('/api/bands').then(res => res.json()),
          fetch('/api/venues').then(res => res.json())
        ]);
        setEvents(eventsData);
        setBands(bandsData);
        setVenues(venuesData);
        return;
      }

      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : '/api/spots';
      const res = await fetch(endpoint);
      const data = await res.json();
      if (activeTab === 'bands') setBands(data);
      else if (activeTab === 'venues') setVenues(data);
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

  const uploadImageFile = async (file: File, options?: { eventCategory?: 'poster' | 'qr' | 'recap'; stopId?: string }) => {
    if (file.size > 1024 * 1024) {
      showMessage('File size exceeds 1MB limit', 'error');
      return null;
    }

    const uploadData = new FormData();
    uploadData.append('image', file);

    const endpoint = options?.eventCategory
      ? `/api/events/${encodeURIComponent(slugifySegment(formData.slug, 'untitled-event'))}/upload/${options.eventCategory}${options.stopId ? `/${encodeURIComponent(slugifySegment(options.stopId, 'general'))}` : ''}`
      : '/api/upload';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: uploadData
    });

    if (res.status === 401 || res.status === 403) {
      handleLogout();
      showMessage('登录已过期，请重新登录', 'error');
      return null;
    }

    const data = await res.json();
    if (!res.ok) {
      showMessage(data.error || 'Failed to upload image');
      return null;
    }

    return data.url as string;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeTab === 'events' && !formData.slug.trim()) {
      showMessage('Please set event slug before uploading event images');
      return;
    }

    try {
      showMessage('Uploading image...', 'success');
      const url = await uploadImageFile(file, activeTab === 'events' ? { eventCategory: 'poster' } : undefined);
      if (url) {
        setFormData(prev => ({ ...prev, image_url: url }));
        showMessage('Image uploaded successfully', 'success');
      }
    } catch (err) {
      showMessage('Network error during upload');
    } finally {
      e.target.value = '';
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

  const getEventJsonPayload = (source = formData) => {
    return {
      slug: source.slug,
      title: source.title,
      description: source.intro,
      image_url: source.image_url,
      ticket_url: source.ticket_url,
      organizer: source.organizer,
      status: source.status,
      is_active: source.is_active,
      lineup: source.lineup,
      stops: cleanEventStopsForSave(source.stops),
      qr_codes: cleanQrCodesForSave(source.qr_codes)
    };
  };

  const refreshEventJson = () => {
    setEventJsonInput(JSON.stringify(getEventJsonPayload(), null, 2));
  };

  const applyEventJson = () => {
    try {
      const parsed = JSON.parse(eventJsonInput);
      const nextStops = normalizeStopsForForm(parsed.stops);
      setFormData(prev => ({
        ...prev,
        slug: parsed.slug || '',
        title: parsed.title || '',
        date_str: parsed.date_str || '',
        location: parsed.location || '',
        address: parsed.address || '',
        intro: parsed.description || parsed.intro || '',
        image_url: parsed.image_url || '',
        ticket_url: parsed.ticket_url || '',
        organizer: parsed.organizer || '',
        status: parsed.status || 'on_sale',
        is_active: !!parsed.is_active,
        lineup: Array.isArray(parsed.lineup) ? parsed.lineup.map((day: any) => ({
          day: day.day || '全站阵容',
          bandIds: day.bandIds || []
        })) : [],
        stops: nextStops,
        qr_codes: normalizeQrCodesForForm(parsed.qr_codes || parsed.qrCodes)
      }));
      setImageInputType(parsed.image_url && !parsed.image_url.startsWith('/uploads/') ? 'url' : 'upload');
      showMessage('Event JSON applied', 'success');
    } catch (err) {
      showMessage('Invalid JSON');
    }
  };

  const updateStop = (index: number, patch: Partial<EventStopForm>) => {
    const nextStops = [...formData.stops];
    nextStops[index] = { ...nextStops[index], ...patch };
    setFormData({ ...formData, stops: nextStops });
  };

  const updateTicket = (stopIndex: number, ticketIndex: number, patch: Partial<EventTicketForm>) => {
    const nextStops = [...formData.stops];
    const tickets = [...nextStops[stopIndex].tickets];
    tickets[ticketIndex] = { ...tickets[ticketIndex], ...patch };
    nextStops[stopIndex] = { ...nextStops[stopIndex], tickets };
    setFormData({ ...formData, stops: nextStops });
  };

  const updateQrCode = (index: number, patch: Partial<EventQrCodeForm>) => {
    const nextQrCodes = [...formData.qr_codes];
    nextQrCodes[index] = { ...nextQrCodes[index], ...patch };
    setFormData({ ...formData, qr_codes: nextQrCodes });
  };

  const updateRecapPhoto = (stopIndex: number, photoIndex: number, patch: Partial<EventRecapPhotoForm>) => {
    const nextStops = [...formData.stops];
    const photos = [...nextStops[stopIndex].recap_photos];
    photos[photoIndex] = { ...photos[photoIndex], ...patch };
    nextStops[stopIndex] = { ...nextStops[stopIndex], recap_photos: photos };
    setFormData({ ...formData, stops: nextStops });
  };

  const updateRecapVideo = (stopIndex: number, patch: Partial<EventRecapVideoForm>) => {
    const nextStops = [...formData.stops];
    nextStops[stopIndex] = {
      ...nextStops[stopIndex],
      recap_video: { ...nextStops[stopIndex].recap_video, ...patch }
    };
    setFormData({ ...formData, stops: nextStops });
  };

  const handleQrImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.slug.trim()) {
      showMessage('Please set event slug before uploading QR images');
      return;
    }

    try {
      showMessage('Uploading QR image...', 'success');
      const url = await uploadImageFile(file, { eventCategory: 'qr' });
      if (url) {
        updateQrCode(index, { image_url: url });
        showMessage('QR image uploaded successfully', 'success');
      }
    } catch (err) {
      showMessage('Network error during upload');
    } finally {
      e.target.value = '';
    }
  };

  const handleRecapPhotoUpload = async (stopIndex: number, photoIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.slug.trim()) {
      showMessage('Please set event slug before uploading recap photos');
      return;
    }

    const stop = formData.stops[stopIndex];
    const stopId = stop.id || stop.label || `stop-${stopIndex + 1}`;

    try {
      showMessage('Uploading recap photo...', 'success');
      const url = await uploadImageFile(file, { eventCategory: 'recap', stopId });
      if (url) {
        updateRecapPhoto(stopIndex, photoIndex, { image_url: url });
        showMessage('Recap photo uploaded successfully', 'success');
      }
    } catch (err) {
      showMessage('Network error during upload');
    } finally {
      e.target.value = '';
    }
  };

  const removeRecapPhoto = async (stopIndex: number, photoIndex: number) => {
    const photo = formData.stops[stopIndex].recap_photos[photoIndex];
    if (photo?.image_url?.startsWith('/uploads/')) {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: photo.image_url })
        });
      } catch (err) {
        console.error('Failed to delete recap photo from server', err);
      }
    }

    const nextStops = [...formData.stops];
    nextStops[stopIndex] = {
      ...nextStops[stopIndex],
      recap_photos: nextStops[stopIndex].recap_photos.filter((_, i) => i !== photoIndex)
    };
    setFormData({ ...formData, stops: nextStops });
  };

  const removeQrCode = async (index: number) => {
    const qrCode = formData.qr_codes[index];
    if (qrCode?.image_url?.startsWith('/uploads/')) {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: qrCode.image_url })
        });
      } catch (err) {
        console.error('Failed to delete QR image from server', err);
      }
    }

    setFormData({
      ...formData,
      qr_codes: formData.qr_codes.filter((_, i) => i !== index)
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
        const missingVenueStop = payload.stops.find((stop: EventStopForm) => !stop.venue_id || !venues.some(venue => venue.venue_id === stop.venue_id));
        if (missingVenueStop) {
          showMessage(`Invalid venue for stop: ${missingVenueStop.label || 'Unnamed stop'}`);
          return;
        }

        const unknownBandId = payload.lineup
          .flatMap((day: { bandIds: string[] }) => day.bandIds || [])
          .concat(payload.stops.flatMap((stop: EventStopForm) => stop.guestBandIds || []))
          .find((bandId: string) => !bands.some(band => band.band_id === bandId));
        if (unknownBandId) {
          showMessage(`Unknown band ID: ${unknownBandId}`);
          return;
        }

        payload.description = payload.intro;
        Object.assign(payload, buildEventLegacyFields(payload, venues));
        payload.stops = cleanEventStopsForSave(payload.stops);
        payload.qr_codes = cleanQrCodesForSave(payload.qr_codes);
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
          bandIds: dayObj.bandIds || []
        }));
      } catch (e) {
        parsedLineup = [];
      }
    }

    const parsedStops = normalizeStopsForForm(item.stops);
    const parsedQrCodes = normalizeQrCodesForForm(item.qr_codes);

    const nextFormData = {
      province_id: item.province_id || '',
      province_zh: item.province_zh || '',
      city_id: item.city_id || '',
      city_zh: item.city_zh || '',
      band_id: item.band_id || '',
      venue_id: item.venue_id || '',
      room_id: item.room_id || '',
      spot_id: item.spot_id || '',
      name: item.name || '',
      name_zh: item.name_zh || '',
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
      slug: item.slug || '',
      title: item.title || '',
      date_str: item.date_str || '',
      location: item.location || '',
      organizer: item.organizer || '',
      status: item.status || 'on_sale',
      is_active: !!item.is_active,
      lineup: parsedLineup,
      stops: parsedStops,
      qr_codes: parsedQrCodes,
      intro: item.intro || item.description || '',
      image_url: item.image_url || '',
      contact_info: item.contact_info || ''
    };

    setFormData(nextFormData);
    if (activeTab === 'events') {
      setEventJsonInput(JSON.stringify(getEventJsonPayload(nextFormData), null, 2));
    }
    setImageInputType(item.image_url && !item.image_url.startsWith('/uploads/') ? 'url' : 'upload');
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setContactType('wechat');
    setContactValue('');
    setImageInputType('upload');
    setSearchQuery('');
    setFormData({
      province_id: '', province_zh: '', city_id: '', city_zh: '',
      band_id: '', venue_id: '', room_id: '', spot_id: '', name: '', name_zh: '', genre: '', type: '',
      netease_url: '', xiaohongshu_url: '', social_url: '', ticket_url: '',
      slug: '', title: '', date_str: '', location: '', organizer: '', status: 'on_sale', is_active: false, lineup: [], stops: [], qr_codes: [],
      address: '', capacity: '', equipment: '', price_info: '', business_hours: '', intro: '', image_url: '', contact_info: ''
    });
    setEventJsonInput('');
  };

  useEffect(() => {
    if (!token || activeTab !== 'events' || !requestedEdit || events.length === 0) return;

    const target = events.find(event => event.slug === requestedEdit || String(event.id) === requestedEdit);
    if (!target) return;

    const editKey = `${target.id}:${target.slug || ''}`;
    if (autoEditKeyRef.current === editKey) return;

    autoEditKeyRef.current = editKey;
    handleEdit(target);
    setSearchQuery(target.title || target.slug || '');
  }, [token, activeTab, requestedEdit, events]);

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

  const filteredList = currentList.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (activeTab === 'events') {
      return item.title?.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query);
    } else {
      return item.name?.toLowerCase().includes(query) || 
             item.name_zh?.toLowerCase().includes(query) || 
             item.province_zh?.toLowerCase().includes(query) || 
             item.city_zh?.toLowerCase().includes(query);
    }
  });

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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium flex items-center gap-2">
                {isEditing ? <Edit2 size={20} className="text-[#ff4e00]" /> : <Plus size={20} className="text-[#ff4e00]" />}
                {isEditing ? `Edit ${activeTab === 'bands' ? 'Band' : activeTab === 'venues' ? 'Venue' : activeTab === 'events' ? 'Event' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Room' : 'Spot'}` : `Add New ${activeTab === 'bands' ? 'Band' : activeTab === 'venues' ? 'Venue' : activeTab === 'events' ? 'Event' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Room' : 'Spot'}`}
              </h2>
              {!isEditing && (
                <button 
                  onClick={() => setIsBulkImportOpen(true)}
                  className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Upload size={14} /> Bulk Import
                </button>
              )}
            </div>
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
                  <input required placeholder="Slug (e.g. tingkaozai-night-decides-acoustic-live)" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <input required placeholder="Event Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Organizer (e.g. 猫啤 Catbeer)" value={formData.organizer} onChange={e => setFormData({...formData, organizer: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white">
                      <option value="on_sale">售票中</option>
                      <option value="upcoming">即将开始</option>
                      <option value="sold_out">已售罄</option>
                      <option value="ended">已结束</option>
                      <option value="cancelled">已取消</option>
                      <option value="postponed">已延期</option>
                    </select>
                  </div>
                  <input placeholder="Legacy Ticket URL (optional)" value={formData.ticket_url} onChange={e => setFormData({...formData, ticket_url: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full" />
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-gray-400 space-y-1">
                    <div><span className="text-gray-500">Auto Date:</span> {buildEventLegacyFields(formData, venues).date_str || 'Will be generated from Tour Stops'}</div>
                    <div><span className="text-gray-500">Auto Location:</span> {buildEventLegacyFields(formData, venues).location || 'Will be generated from Tour Stops'}</div>
                    <div><span className="text-gray-500">Auto Address:</span> {buildEventLegacyFields(formData, venues).address || 'Will be generated from Tour Stops'}</div>
                  </div>
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
                  <textarea required placeholder="Equipment (e.g. Marshall JCM900...)" value={formData.equipment} onChange={e => setFormData({...formData, equipment: e.target.value})} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full h-24 resize-none" />
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

              {activeTab === 'events' && (
                <div className="space-y-4 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-white">Tour Stops</h3>
                    <button type="button" onClick={() => setFormData({...formData, stops: [...formData.stops, createEmptyStop(formData.stops.length)]})} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={14}/> Add Stop</button>
                  </div>

                  {formData.stops.map((stop, stopIndex) => (
                    <div key={stopIndex} className="space-y-3 border border-white/5 p-3 rounded-lg bg-black/40">
                      <div className="flex justify-between items-center gap-2">
                        <input value={stop.label} onChange={e => updateStop(stopIndex, { label: e.target.value })} className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-[#ff4e00] font-mono focus:outline-none focus:border-[#ff4e00] flex-1" placeholder="e.g. 宁波站" />
                        <button type="button" onClick={() => {
                          setFormData({...formData, stops: formData.stops.filter((_, i) => i !== stopIndex)});
                        }} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                      </div>

                      <input
                        placeholder="Stop ID for uploads (e.g. ningbo)"
                        value={stop.id}
                        onChange={e => updateStop(stopIndex, { id: e.target.value })}
                        className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full"
                      />

                      <div>
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalValue(stop.start_at)}
                          onChange={e => updateStop(stopIndex, { start_at: fromDateTimeLocalValue(e.target.value) })}
                          className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          required
                          value={stop.venue_id}
                          onChange={e => {
                            updateStop(stopIndex, {
                              venue_id: e.target.value
                            });
                          }}
                          className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full text-white"
                        >
                          <option value="">Select Venue</option>
                          {venues.map(v => (
                            <option key={v.venue_id} value={v.venue_id}>{v.name_zh || v.name}</option>
                          ))}
                        </select>
                        <div className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-gray-400 truncate">
                          {(() => {
                            const venue = venues.find(v => v.venue_id === stop.venue_id);
                            return venue ? `${venue.name_zh || venue.name} · ${venue.city_zh || ''}` : 'Select Venue ID to use venue database info';
                          })()}
                        </div>
                      </div>

                      <input placeholder="Price Text" value={stop.price_text} onChange={e => updateStop(stopIndex, { price_text: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />

                      <div className="space-y-2">
                        <span className="text-xs text-gray-400">Guest Bands</span>
                        <div className="flex flex-wrap gap-2">
                          {stop.guestBandIds.map((bandId, bandIndex) => {
                            const band = bands.find(b => b.band_id === bandId);
                            return (
                              <div key={bandId} className="flex items-center gap-1 bg-white/10 text-xs px-2 py-1 rounded-full text-gray-300">
                                {band ? band.name_zh || band.name : bandId}
                                <button type="button" onClick={() => {
                                  const nextStops = [...formData.stops];
                                  nextStops[stopIndex] = {
                                    ...nextStops[stopIndex],
                                    guestBandIds: nextStops[stopIndex].guestBandIds.filter((_, i) => i !== bandIndex)
                                  };
                                  setFormData({...formData, stops: nextStops});
                                }} className="hover:text-red-400 ml-1"><X size={12}/></button>
                              </div>
                            );
                          })}
                          <select onChange={e => {
                            if (!e.target.value) return;
                            const nextStops = [...formData.stops];
                            if (!nextStops[stopIndex].guestBandIds.includes(e.target.value)) {
                              nextStops[stopIndex] = {
                                ...nextStops[stopIndex],
                                guestBandIds: [...nextStops[stopIndex].guestBandIds, e.target.value]
                              };
                            }
                            setFormData({...formData, stops: nextStops});
                            e.target.value = '';
                          }} className="bg-black/50 border border-white/10 rounded-full px-2 py-1 text-xs text-gray-400 focus:outline-none">
                            <option value="">+ Add Guest</option>
                            {bands.map(b => (
                              <option key={b.band_id} value={b.band_id}>{b.name_zh || b.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Tickets</span>
                          <button type="button" onClick={() => {
                            const nextStops = [...formData.stops];
                            nextStops[stopIndex] = {
                              ...nextStops[stopIndex],
                              tickets: [...nextStops[stopIndex].tickets, { label: '购票', url: '' }]
                            };
                            setFormData({...formData, stops: nextStops});
                          }} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={12}/> Add Ticket</button>
                        </div>
                        {stop.tickets.map((ticket, ticketIndex) => (
                          <div key={ticketIndex} className="grid grid-cols-[0.35fr_1fr_auto] gap-2 items-center">
                            <input placeholder="Label" value={ticket.label} onChange={e => updateTicket(stopIndex, ticketIndex, { label: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                            <input placeholder="URL" value={ticket.url} onChange={e => updateTicket(stopIndex, ticketIndex, { url: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                            <button type="button" onClick={() => {
                              const nextStops = [...formData.stops];
                              nextStops[stopIndex] = {
                                ...nextStops[stopIndex],
                                tickets: nextStops[stopIndex].tickets.filter((_, i) => i !== ticketIndex)
                              };
                              setFormData({...formData, stops: nextStops});
                            }} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3 border-t border-white/10 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">Recap Photos</span>
                          <button type="button" onClick={() => {
                            const nextStops = [...formData.stops];
                            nextStops[stopIndex] = {
                              ...nextStops[stopIndex],
                              recap_photos: [...nextStops[stopIndex].recap_photos, { title: '', caption: '', image_url: '' }]
                            };
                            setFormData({...formData, stops: nextStops});
                          }} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={12}/> Add Photo</button>
                        </div>

                        {stop.recap_photos.map((photo, photoIndex) => (
                          <div key={photoIndex} className="space-y-2 rounded-lg border border-white/5 bg-black/30 p-3">
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                              <input placeholder="Photo Title" value={photo.title} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { title: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                              <button type="button" onClick={() => removeRecapPhoto(stopIndex, photoIndex)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                            </div>
                            <input placeholder="Caption" value={photo.caption} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { caption: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                              <input placeholder="Photo Image URL" value={photo.image_url} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { image_url: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                              <input type="file" accept="image/*" onChange={e => handleRecapPhotoUpload(stopIndex, photoIndex, e)} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full md:w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20" />
                            </div>
                            {photo.image_url && (
                              <img src={photo.image_url} alt={photo.title || 'Recap photo'} className="h-24 w-32 rounded-lg border border-white/10 object-cover" />
                            )}
                          </div>
                        ))}

                        <div className="space-y-2">
                          <span className="text-xs text-gray-400">Bilibili Recap Video</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input placeholder="Video Title" value={stop.recap_video.title} onChange={e => updateRecapVideo(stopIndex, { title: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                            <input placeholder="Bilibili URL" value={stop.recap_video.url} onChange={e => updateRecapVideo(stopIndex, { url: e.target.value })} className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-4 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-white">QR Codes</h3>
                    <button type="button" onClick={() => setFormData({...formData, qr_codes: [...formData.qr_codes, { title: '', image_url: '' }]})} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={14}/> Add QR</button>
                  </div>

                  {formData.qr_codes.map((qrCode, qrIndex) => (
                    <div key={qrIndex} className="space-y-3 border border-white/5 p-3 rounded-lg bg-black/40">
                      <div className="flex justify-between items-center gap-2">
                        <input
                          placeholder="Title (e.g. 厂牌微信 / 乐队微信)"
                          value={qrCode.title}
                          onChange={e => updateQrCode(qrIndex, { title: e.target.value })}
                          className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-[#ff4e00] font-mono focus:outline-none focus:border-[#ff4e00] flex-1"
                        />
                        <button type="button" onClick={() => removeQrCode(qrIndex)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <input
                          placeholder="QR Image URL"
                          value={qrCode.image_url}
                          onChange={e => updateQrCode(qrIndex, { image_url: e.target.value })}
                          className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleQrImageUpload(qrIndex, e)}
                          className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs w-full md:w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20"
                        />
                      </div>

                      {qrCode.image_url && (
                        <img
                          src={qrCode.image_url}
                          alt={qrCode.title || 'QR Code'}
                          className="h-24 w-24 rounded-lg border border-white/10 bg-white object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-3 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div className="flex justify-between items-center gap-3">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2"><Code2 size={15}/> Event JSON</h3>
                    <div className="flex gap-2">
                      <button type="button" onClick={refreshEventJson} className="text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded px-3 py-1 transition-colors">Generate</button>
                      <button type="button" onClick={applyEventJson} className="text-xs bg-[#ff4e00] hover:bg-[#ff6a2b] text-white rounded px-3 py-1 transition-colors">Apply</button>
                    </div>
                  </div>
                  <textarea
                    placeholder="Paste event JSON here, then click Apply."
                    value={eventJsonInput}
                    onChange={e => setEventJsonInput(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded px-3 py-2 text-xs font-mono w-full h-44 resize-y"
                  />
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
          <div className="lg:col-span-2 bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium">Current {activeTab === 'bands' ? 'Bands' : activeTab === 'venues' ? 'Venues' : activeTab === 'events' ? 'Events' : activeTab === 'rehearsal_rooms' ? 'Rehearsal Rooms' : 'Spots'} ({filteredList.length}/{currentList.length})</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00] w-64"
                />
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                {filteredList.map(item => (
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
                            {item.slug && <span className="bg-white/5 px-2 py-0.5 rounded">/{item.slug}</span>}
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

      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        activeTab={activeTab}
        currentList={currentList}
        locations={locations}
        token={token}
        onImportComplete={() => {
          setIsBulkImportOpen(false);
          fetchData();
          showMessage('Bulk import successful', 'success');
        }}
      />
    </div>
  );
}

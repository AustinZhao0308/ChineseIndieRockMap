import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Code2, KeyRound, Plus, Trash2, Edit2, Music, MapPin, X, Calendar, Star, Mic2, Coffee, Search, Upload, Image as ImageIcon, HardDrive, Link as LinkIcon, Users, Languages, Disc3 } from 'lucide-react';
import BulkImportModal from '../components/BulkImportModal';
import ImageAssetPicker from '../components/ImageAssetPicker';
import AlbumPlayersAdminPanel from '../components/AlbumPlayersAdminPanel';

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

type ImageAssetReference = {
  type: string;
  id: number | string;
  title: string;
  field: string;
};

type ImageAsset = {
  filename: string;
  path: string;
  url: string;
  size: number;
  modifiedAt: string;
  used: boolean;
  references: ImageAssetReference[];
};

type ImageAssetSummary = {
  totalCount: number;
  totalSize: number;
  usedCount: number;
  unusedCount: number;
  unusedSize: number;
};

type AdminLanguage = 'zh' | 'en';
type EventMode = 'single' | 'tour';

const createEmptyStop = (index: number, mode: EventMode = 'tour'): EventStopForm => ({
  id: '',
  label: mode === 'single' ? '' : `第 ${index + 1} 站`,
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
  const isTour = stops.length > 1;
  if (stops.length === 0) {
    return {
      date_str: source.date_str,
      location: source.location,
      address: source.address
    };
  }

  return {
    date_str: stops
      .map(stop => [isTour ? stop.label : '', formatStopDateTime(stop.start_at)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' / '),
    location: stops
      .map(stop => [getVenueCity(stop), getVenueName(stop)].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' / '),
    address: stops
      .map(stop => {
        const label = isTour ? (stop.label || getVenueCity(stop) || getVenueName(stop)) : '';
        const place = getVenueAddress(stop);
        return [label, place].filter(Boolean).join('：');
      })
      .filter(Boolean)
      .join('；')
  };
};

const cleanEventStopsForSave = (stops: EventStopForm[]) => {
  const isTour = stops.length > 1;
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
      label: stop.label || (isTour ? `第 ${index + 1} 站` : '演出现场'),
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

const adminTabs = ['bands', 'venues', 'events', 'rehearsal_rooms', 'spots', 'players', 'accounts', 'assets', 'settings'] as const;
type AdminTab = typeof adminTabs[number];
type CurrentUser = {
  role: 'admin' | 'label' | 'artist';
  username: string;
  displayName: string;
  accountId?: number;
  accountType?: string;
  logoUrl?: string;
};
const labelEditorTabs: AdminTab[] = ['bands', 'events'];

const inputClass = "bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm w-full text-white placeholder:text-gray-600 focus:outline-none focus:border-[#ff4e00]";
const compactInputClass = "bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs w-full text-white placeholder:text-gray-600 focus:outline-none focus:border-[#ff4e00]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-gray-400";
const emptyAssetSummary: ImageAssetSummary = { totalCount: 0, totalSize: 0, usedCount: 0, unusedCount: 0, unusedSize: 0 };
const sourceImageMaxBytes = 8 * 1024 * 1024;
const uploadImageMaxBytes = 300 * 1024;
const compressSkipBytes = uploadImageMaxBytes;
const compressTargetBytes = 260 * 1024;
const compressMaxDimension = 1800;
const unsupportedImageTypes = new Set(['image/svg+xml', 'image/gif']);

const adminCopy: Record<AdminLanguage, Record<string, string>> = {
  zh: {
    language: '中文',
    singleEvent: '单场演出',
    tourEvent: '多站巡演',
    eventType: '演出类型',
    eventInfo: '演出信息',
    tourStops: '巡演站点',
    addStop: '增加站点',
    stopName: '站点名称',
    stopId: '上传目录 ID',
    dateTime: '演出时间',
    venue: '演出场地',
    venueHint: '选择场地后自动使用场地库城市与地址',
    priceText: '票价 / 时间说明',
    guestBands: '嘉宾乐队',
    tickets: '购票链接',
    addTicket: '增加购票',
    recapPhotos: '回顾照片',
    addPhoto: '增加照片',
    recapVideo: 'B站回顾视频',
    mainLineup: '演出阵容',
    mainLineupHelp: '主要演出乐队在这里配置；嘉宾在演出信息中配置，多站巡演可按站点配置。',
    noMainLineup: '尚未选择主要阵容。',
    addBand: '+ 添加乐队',
    searchBand: '搜索乐队名称 / ID...',
    addGuest: '+ 添加嘉宾',
    searchGuest: '搜索嘉宾乐队...',
    autoDate: '自动日期',
    autoLocation: '自动地点',
    autoAddress: '自动地址',
    autoEmpty: '将由演出时间与场地自动生成',
    singleHelp: '适合只有一站的专场、联合演出或活动。前台会按单场信息展示，不出现巡演站点样式。',
    tourHelp: '适合多城市或多场次巡演。每一站可以独立配置场地、嘉宾、票务与回顾。',
    slug: '链接标识',
    eventTitle: '活动标题',
    label: '厂牌（可选）',
    status: '状态',
    legacyTicketUrl: '旧购票链接',
    optional: '可选',
    setActive: '设为首页主推演出',
    eventDescription: '活动介绍',
    introduction: '介绍',
    photoTitle: '照片标题',
    caption: '照片说明',
    photoImageUrl: '照片图片 URL',
    videoTitle: '视频标题',
    bilibiliUrl: 'B站链接',
    qrCodes: '二维码',
    addQr: '增加二维码',
    qrTitlePlaceholder: '标题（例如：厂牌微信 / 乐队微信）',
    qrImageUrl: '二维码图片 URL',
    eventJson: '演出 JSON',
    generate: '生成',
    apply: '应用',
    eventJsonPlaceholder: '在这里粘贴演出 JSON，然后点击应用。',
    imageMax: '图片（自动压缩，上传上限 300KB）',
    uploadFile: '上传文件',
    imageUrl: '图片 URL',
    chooseExisting: '选择已有图片',
    imageUrlPlaceholder: '输入图片 URL（例如 https://...）',
    eventJsonApplied: '演出 JSON 已应用',
    invalidJson: 'JSON 格式无效',
    sourceImageTooLarge: '源图片不能超过 8MB',
    compressedImageTooLarge: '图片压缩后仍超过 300KB，请换一张更小的图',
    imageCompressed: '图片已压缩至',
    unsupportedImageType: '暂不支持 SVG 或 GIF，请上传 JPG、PNG 或 WebP',
    dataManagement: '数据管理',
    manageBands: '管理乐队',
    manageVenues: '管理场地',
    manageRehearsalRooms: '管理排练室',
    manageSpots: '管理地点',
    manageEvents: '管理演出',
    manageAccounts: '管理账号',
    imageAssets: '图片资源',
    settings: '设置',
    changePassword: '修改密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmNewPassword: '确认新密码',
    updatePassword: '更新密码',
    addNew: '新增',
    edit: '编辑',
    current: '当前',
    bulkImport: '批量导入',
    province: '省份',
    city: '城市',
    selectProvince: '选择省份',
    selectCity: '选择城市',
    band: '乐队',
    venueEntity: '场地',
    eventEntity: '演出',
    rehearsalRoom: '排练室',
    account: '账号',
    spot: '地点',
    bandId: '乐队 ID',
    venueId: '场地 ID',
    roomId: '排练室 ID',
    spotId: '地点 ID',
    accountType: '账号类型',
    username: '登录名',
    initialPassword: '设置初始密码',
    newPasswordKeep: '重置密码（留空不修改）',
    displayName: '显示名称',
    logo: '标志（建议方形，自动压缩）',
    pasteLogoUrl: '或粘贴标志 URL',
    linkedEntityId: '关联艺人或厂牌 ID',
    contactPerson: '联系人',
    contactInfo: '联系方式',
    contactType: '联系方式类型',
    notes: '备注',
    notesPlaceholder: '申请来源、需管理的艺人、内部备注等',
    name: '名称',
    chineseName: '中文名',
    subtitleName: '副标题 / English name',
    primaryChineseName: '主标题 / 中文名',
    genre: '风格',
    neteaseUrl: '网易云链接',
    xiaohongshuUrl: '小红书链接',
    address: '地址',
    capacity: '容量',
    ticketUrl: '购票链接',
    equipment: '设备',
    priceInfo: '价格信息',
    type: '类型',
    businessHours: '营业时间',
    socialUrl: '社交链接',
    update: '更新',
    add: '添加',
    cancel: '取消',
    search: '搜索...',
    loading: '加载中...'
  },
  en: {
    language: 'English',
    singleEvent: 'Single Show',
    tourEvent: 'Tour',
    eventType: 'Event Type',
    eventInfo: 'Show Details',
    tourStops: 'Tour Stops',
    addStop: 'Add Stop',
    stopName: 'Stop Name',
    stopId: 'Upload Folder ID',
    dateTime: 'Date & Time',
    venue: 'Venue',
    venueHint: 'Venue city and address are pulled from the venue database.',
    priceText: 'Price / Time Notes',
    guestBands: 'Guest Bands',
    tickets: 'Tickets',
    addTicket: 'Add Ticket',
    recapPhotos: 'Recap Photos',
    addPhoto: 'Add Photo',
    recapVideo: 'Bilibili Recap Video',
    mainLineup: 'Lineup',
    mainLineupHelp: 'Configure main performers here. Guests live in show details, and tours can set guests per stop.',
    noMainLineup: 'No main lineup bands selected.',
    addBand: '+ Add Band',
    searchBand: 'Search band by name / ID...',
    addGuest: '+ Add Guest',
    searchGuest: 'Search guest band...',
    autoDate: 'Auto Date',
    autoLocation: 'Auto Location',
    autoAddress: 'Auto Address',
    autoEmpty: 'Generated from show time and venue',
    singleHelp: 'For one-off shows, showcases, and single-city events. The public page will avoid tour-style stop layouts.',
    tourHelp: 'For multi-city or multi-show tours. Each stop can have its own venue, guests, tickets, and recap.',
    slug: 'Slug',
    eventTitle: 'Event Title',
    label: 'Label (optional)',
    status: 'Status',
    legacyTicketUrl: 'Legacy Ticket URL',
    optional: 'Optional',
    setActive: 'Set as Active Featured Event',
    eventDescription: 'Event Description',
    introduction: 'Introduction',
    photoTitle: 'Photo Title',
    caption: 'Caption',
    photoImageUrl: 'Photo Image URL',
    videoTitle: 'Video Title',
    bilibiliUrl: 'Bilibili URL',
    qrCodes: 'QR Codes',
    addQr: 'Add QR',
    qrTitlePlaceholder: 'Title (e.g. Label WeChat / Band WeChat)',
    qrImageUrl: 'QR Image URL',
    eventJson: 'Event JSON',
    generate: 'Generate',
    apply: 'Apply',
    eventJsonPlaceholder: 'Paste event JSON here, then click Apply.',
    imageMax: 'Image (auto-compressed, 300KB upload limit)',
    uploadFile: 'Upload File',
    imageUrl: 'Image URL',
    chooseExisting: 'Choose Existing',
    imageUrlPlaceholder: 'Enter Image URL (e.g. https://...)',
    eventJsonApplied: 'Event JSON applied',
    invalidJson: 'Invalid JSON',
    sourceImageTooLarge: 'Source image must be under 8MB',
    compressedImageTooLarge: 'Image is still over 300KB after compression; please choose a smaller image',
    imageCompressed: 'Image compressed to',
    unsupportedImageType: 'SVG and GIF uploads are not supported. Please upload JPG, PNG, or WebP',
    dataManagement: 'Data Management',
    manageBands: 'Manage Bands',
    manageVenues: 'Manage Venues',
    manageRehearsalRooms: 'Manage Rehearsal Rooms',
    manageSpots: 'Manage Spots',
    manageEvents: 'Manage Events',
    manageAccounts: 'Manage Accounts',
    imageAssets: 'Image Assets',
    settings: 'Settings',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    updatePassword: 'Update Password',
    addNew: 'Add New',
    edit: 'Edit',
    current: 'Current',
    bulkImport: 'Bulk Import',
    province: 'Province',
    city: 'City',
    selectProvince: 'Select Province',
    selectCity: 'Select City',
    band: 'Band',
    venueEntity: 'Venue',
    eventEntity: 'Event',
    rehearsalRoom: 'Rehearsal Room',
    account: 'Account',
    spot: 'Spot',
    bandId: 'Band ID',
    venueId: 'Venue ID',
    roomId: 'Room ID',
    spotId: 'Spot ID',
    accountType: 'Account Type',
    username: 'Username',
    initialPassword: 'Set Initial Password',
    newPasswordKeep: 'Reset Password (leave blank to keep current)',
    displayName: 'Display Name',
    logo: 'Logo (square recommended, auto-compressed)',
    pasteLogoUrl: 'Or paste logo URL',
    linkedEntityId: 'Linked Entity ID',
    contactPerson: 'Contact Person',
    contactInfo: 'Contact Info',
    contactType: 'Contact Type',
    notes: 'Notes',
    notesPlaceholder: 'Application source, managed artists, internal notes, etc.',
    name: 'Name',
    chineseName: 'Chinese Name',
    subtitleName: 'Subtitle / English name',
    primaryChineseName: 'Primary / Chinese name',
    genre: 'Genre',
    neteaseUrl: 'NetEase URL',
    xiaohongshuUrl: 'Xiaohongshu URL',
    address: 'Address',
    capacity: 'Capacity',
    ticketUrl: 'Ticket URL',
    equipment: 'Equipment',
    priceInfo: 'Price Info',
    type: 'Type',
    businessHours: 'Business Hours',
    socialUrl: 'Social URL',
    update: 'Update',
    add: 'Add',
    cancel: 'Cancel',
    search: 'Search...',
    loading: 'Loading...'
  }
};

const blobFromCanvas = (canvas: HTMLCanvasElement, type: string, quality: number) => {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
};

const getCompressedFileName = (fileName: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.webp`;
};

const compressImageFile = async (file: File) => {
  if (!file.type.startsWith('image/') || file.size <= compressSkipBytes) {
    return file;
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  const initialScale = Math.min(1, compressMaxDimension / Math.max(bitmap.width, bitmap.height));
  let width = Math.max(1, Math.round(bitmap.width * initialScale));
  let height = Math.max(1, Math.round(bitmap.height * initialScale));
  let bestBlob: Blob | null = null;
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await blobFromCanvas(canvas, 'image/webp', quality);
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= compressSkipBytes && blob.size >= 180 * 1024) {
        bitmap.close();
        return new File([blob], getCompressedFileName(file.name), { type: 'image/webp', lastModified: Date.now() });
      }
      if (blob.size <= compressTargetBytes) {
        bitmap.close();
        return new File([blob], getCompressedFileName(file.name), { type: 'image/webp', lastModified: Date.now() });
      }
    }

    const shrinkRatio = bestBlob?.size ? Math.sqrt(compressTargetBytes / bestBlob.size) : 0.82;
    const nextScale = Math.max(0.72, Math.min(0.86, shrinkRatio * 0.96));
    width = Math.max(1, Math.round(width * nextScale));
    height = Math.max(1, Math.round(height * nextScale));
  }

  bitmap.close();
  if (!bestBlob || bestBlob.size >= file.size) return file;
  return new File([bestBlob], getCompressedFileName(file.name), { type: 'image/webp', lastModified: Date.now() });
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export default function AdminPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const requestedEdit = searchParams.get('edit');
  const initialTab: AdminTab = adminTabs.includes(requestedTab as AdminTab) ? requestedTab as AdminTab : 'bands';
  const autoEditKeyRef = useRef('');
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [bands, setBands] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [rehearsalRooms, setRehearsalRooms] = useState<any[]>([]);
  const [spots, setSpots] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
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
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [imageAssetSummary, setImageAssetSummary] = useState<ImageAssetSummary>(emptyAssetSummary);
  const [assetFilter, setAssetFilter] = useState<'all' | 'unused'>('all');
  const [imageAssetPicker, setImageAssetPicker] = useState<null | { onSelect: (url: string) => void }>(null);
  const [confirmDeleteAssetUrl, setConfirmDeleteAssetUrl] = useState<string | null>(null);
  const [lineupBandQuery, setLineupBandQuery] = useState('');
  const [guestBandQueries, setGuestBandQueries] = useState<Record<number, string>>({});
  const [adminLanguage, setAdminLanguage] = useState<AdminLanguage>(() => (localStorage.getItem('adminLanguage') === 'en' ? 'en' : 'zh'));
  const [eventMode, setEventModeState] = useState<EventMode>('single');
  const t = (key: string) => adminCopy[adminLanguage][key] || key;
  const isAdmin = currentUser?.role === 'admin';
  const isLabelEditor = currentUser?.role === 'label';
  const editableTabs = isAdmin ? [...adminTabs] : labelEditorTabs;

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
    label_account_id: '',
    // Account specific
    account_type: 'artist',
    username: '',
    password: '',
    display_name: '',
    logo_url: '',
    contact_name: '',
    linked_entity_id: '',
    notes: '',
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
    stops: [createEmptyStop(0, 'single')] as EventStopForm[],
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
    localStorage.setItem('adminLanguage', adminLanguage);
  }, [adminLanguage]);

  useEffect(() => {
    const syncToken = () => {
      const nextToken = localStorage.getItem('adminToken');
      setToken(nextToken);
      if (!nextToken) setCurrentUser(null);
    };
    window.addEventListener('storage', syncToken);
    window.addEventListener('authchange', syncToken);
    return () => {
      window.removeEventListener('storage', syncToken);
      window.removeEventListener('authchange', syncToken);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid session');
        return res.json();
      })
      .then(data => {
        setCurrentUser(data.user);
        if (data.user?.role !== 'admin' && !labelEditorTabs.includes(activeTab)) {
          setActiveTab('bands');
        }
      })
      .catch(() => handleLogout());
  }, [token]);

  useEffect(() => {
    if (token && currentUser) {
      if (!editableTabs.includes(activeTab)) {
        setActiveTab(editableTabs[0]);
        return;
      }
      fetchData();
    }
  }, [token, currentUser, activeTab]);

  useEffect(() => {
    if (!isLabelEditor || !currentUser?.accountId || isEditing) return;
    setFormData(prev => prev.label_account_id ? prev : {
      ...prev,
      label_account_id: String(currentUser.accountId)
    });
  }, [isLabelEditor, currentUser?.accountId, isEditing]);

  const fetchAdminAccounts = async () => {
    const res = await fetch('/api/accounts', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      showMessage('登录已过期，请重新登录', 'error');
      return [];
    }
    if (!res.ok) {
      const data = await res.json();
      showMessage(data.error || 'Failed to load accounts');
      return [];
    }
    return res.json();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'assets') {
        if (!isAdmin) return;
        const res = await fetch('/api/admin/assets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
          handleLogout();
          showMessage('登录已过期，请重新登录', 'error');
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          showMessage(data.error || 'Failed to load image assets');
          return;
        }

        setImageAssets(data.assets || []);
        setImageAssetSummary(data.summary || emptyAssetSummary);
        return;
      }

      if (activeTab === 'players') return;

      if (activeTab === 'events') {
        const [eventsData, bandsData, venuesData, accountsData] = await Promise.all([
          fetch('/api/featured_events').then(res => res.json()),
          fetch('/api/bands').then(res => res.json()),
          fetch('/api/venues').then(res => res.json()),
          isAdmin ? fetchAdminAccounts() : Promise.resolve(currentUser?.accountId ? [{
            id: currentUser.accountId,
            account_type: 'label',
            username: currentUser.username,
            display_name: currentUser.displayName
          }] : [])
        ]);
        setEvents(isLabelEditor ? eventsData.filter((event: any) => Number(event.label_account_id) === Number(currentUser?.accountId)) : eventsData);
        setBands(isLabelEditor ? bandsData.filter((band: any) => Number(band.label_account_id) === Number(currentUser?.accountId)) : bandsData);
        setVenues(venuesData);
        setAccounts(accountsData);
        return;
      }

      if (activeTab === 'bands') {
        const [bandsData, accountsData] = await Promise.all([
          fetch('/api/bands').then(res => res.json()),
          isAdmin ? fetchAdminAccounts() : Promise.resolve(currentUser?.accountId ? [{
            id: currentUser.accountId,
            account_type: 'label',
            username: currentUser.username,
            display_name: currentUser.displayName
          }] : [])
        ]);
        setBands(isLabelEditor ? bandsData.filter((band: any) => Number(band.label_account_id) === Number(currentUser?.accountId)) : bandsData);
        setAccounts(accountsData);
        return;
      }

      const endpoint = activeTab === 'venues' ? '/api/venues' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : activeTab === 'accounts' ? '/api/accounts' : '/api/spots';
      const res = await fetch(endpoint, activeTab === 'accounts' ? {
        headers: { 'Authorization': `Bearer ${token}` }
      } : undefined);
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        showMessage('登录已过期，请重新登录', 'error');
        return;
      }
      const data = await res.json();
      if (activeTab === 'venues') setVenues(data);
      else if (activeTab === 'rehearsal_rooms') setRehearsalRooms(data);
      else if (activeTab === 'accounts') setAccounts(data);
      else if (activeTab === 'spots') setSpots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    window.dispatchEvent(new Event('authchange'));
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
    if (unsupportedImageTypes.has(file.type)) {
      showMessage(t('unsupportedImageType'), 'error');
      return null;
    }

    if (file.size > sourceImageMaxBytes) {
      showMessage(t('sourceImageTooLarge'), 'error');
      return null;
    }

    const fileToUpload = await compressImageFile(file);
    if (fileToUpload.size > uploadImageMaxBytes) {
      showMessage(t('compressedImageTooLarge'), 'error');
      return null;
    }

    if (fileToUpload !== file) {
      showMessage(`${t('imageCompressed')} ${formatBytes(fileToUpload.size)}`, 'success');
    }

    const uploadData = new FormData();
    uploadData.append('image', fileToUpload);

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

  const openImageAssetPicker = (onSelect: (url: string) => void) => {
    setImageAssetPicker({ onSelect });
  };

  const handleDeleteUnusedAsset = async (asset: ImageAsset) => {
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: asset.url })
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        showMessage('登录已过期，请重新登录', 'error');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Failed to delete image asset');
        if (res.status === 409) fetchData();
        return;
      }

      setConfirmDeleteAssetUrl(null);
      showMessage('Image asset deleted', 'success');
      fetchData();
    } catch (err) {
      showMessage('Network error');
    }
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showMessage('Uploading logo...', 'success');
      const url = await uploadImageFile(file);
      if (url) {
        setFormData(prev => ({ ...prev, logo_url: url }));
        showMessage('Logo uploaded successfully', 'success');
      }
    } catch (err) {
      showMessage('Network error during upload');
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    const currentUrl = formData.logo_url;
    if (!currentUrl) return;

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
        console.error('Failed to delete logo from server', err);
      }
    }

    setFormData(prev => ({ ...prev, logo_url: '' }));
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
      label_account_id: source.label_account_id,
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
      setEventModeState(nextStops.length > 1 ? 'tour' : 'single');
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
        label_account_id: parsed.label_account_id || '',
        status: parsed.status || 'on_sale',
        is_active: !!parsed.is_active,
        lineup: Array.isArray(parsed.lineup) ? parsed.lineup.map((day: any) => ({
          day: day.day || '全站阵容',
          bandIds: day.bandIds || []
        })) : [],
        stops: nextStops.length ? nextStops : [createEmptyStop(0, 'single')],
        qr_codes: normalizeQrCodesForForm(parsed.qr_codes || parsed.qrCodes)
      }));
      setImageInputType(parsed.image_url && !parsed.image_url.startsWith('/uploads/') ? 'url' : 'upload');
      showMessage(t('eventJsonApplied'), 'success');
    } catch (err) {
      showMessage(t('invalidJson'));
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
      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'events' ? '/api/featured_events' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : activeTab === 'accounts' ? '/api/accounts' : '/api/spots';
      const url = isEditing ? `${endpoint}/${currentId}` : endpoint;
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload = { ...formData } as any;
      if (activeTab === 'accounts') {
        if (!isEditing && !payload.password.trim()) {
          showMessage('Initial password is required for new accounts');
          return;
        }
        if (isEditing && !payload.password.trim()) {
          delete payload.password;
        }
        payload.display_name = payload.display_name || payload.name_zh || payload.name;
        payload.account_type = payload.account_type === 'label' ? 'label' : 'artist';
      } else {
        payload.contact_info = contactValue ? `${contactType}:${contactValue}` : '';
        payload.label_account_id = isLabelEditor && currentUser?.accountId ? currentUser.accountId : payload.label_account_id || null;
      }
      if (activeTab === 'venues') {
        payload.capacity = parseInt(payload.capacity as string) || 0 as any;
      }
      if (activeTab === 'events') {
        const selectedLabel = accounts.find(account => String(account.id) === String(payload.label_account_id) && account.account_type === 'label');
        payload.organizer = selectedLabel ? selectedLabel.display_name : '';
        payload.stops = payload.stops.length ? payload.stops : [createEmptyStop(0, 'single')];
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
      const endpoint = activeTab === 'bands' ? '/api/bands' : activeTab === 'venues' ? '/api/venues' : activeTab === 'events' ? '/api/featured_events' : activeTab === 'rehearsal_rooms' ? '/api/rehearsal_rooms' : activeTab === 'accounts' ? '/api/accounts' : '/api/spots';
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
    if (activeTab === 'events') {
      setEventModeState(parsedStops.length > 1 ? 'tour' : 'single');
    }

    const nextFormData = {
      province_id: item.province_id || '',
      province_zh: item.province_zh || '',
      city_id: item.city_id || '',
      city_zh: item.city_zh || '',
      band_id: item.band_id || '',
      venue_id: item.venue_id || '',
      room_id: item.room_id || '',
      spot_id: item.spot_id || '',
      account_type: item.account_type || 'artist',
      username: item.username || '',
      password: '',
      display_name: item.display_name || '',
      logo_url: item.logo_url || '',
      contact_name: item.contact_name || '',
      linked_entity_id: item.linked_entity_id || '',
      notes: item.notes || '',
      name: item.name || '',
      name_zh: item.name_zh || '',
      genre: item.genre || '',
      type: item.type || '',
      netease_url: item.netease_url || '',
      xiaohongshu_url: item.xiaohongshu_url || '',
      label_account_id: item.label_account_id ? String(item.label_account_id) : item.labelAccountId ? String(item.labelAccountId) : '',
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
      status: activeTab === 'accounts' ? item.status || 'active' : item.status || 'on_sale',
      is_active: !!item.is_active,
      lineup: parsedLineup,
      stops: parsedStops.length ? parsedStops : [createEmptyStop(0, 'single')],
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
    setLineupBandQuery('');
    setGuestBandQueries({});
    setEventModeState('single');
    setFormData({
      province_id: '', province_zh: '', city_id: '', city_zh: '',
      band_id: '', venue_id: '', room_id: '', spot_id: '', name: '', name_zh: '', genre: '', type: '',
      label_account_id: isLabelEditor && currentUser?.accountId ? String(currentUser.accountId) : '',
      account_type: 'artist', username: '', password: '', display_name: '', logo_url: '', contact_name: '', linked_entity_id: '', notes: '',
      netease_url: '', xiaohongshu_url: '', social_url: '', ticket_url: '',
      slug: '', title: '', date_str: '', location: '', organizer: '', status: activeTab === 'accounts' ? 'active' : 'on_sale', is_active: false, lineup: [], stops: [createEmptyStop(0, 'single')], qr_codes: [],
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
    return <Navigate to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0502] flex items-center justify-center text-[#ff4e00] font-mono">
        Loading Account...
      </div>
    );
  }

  const currentList = activeTab === 'bands' ? bands : activeTab === 'venues' ? venues : activeTab === 'events' ? events : activeTab === 'rehearsal_rooms' ? rehearsalRooms : activeTab === 'accounts' ? accounts : activeTab === 'spots' ? spots : [];

  const filteredList = currentList.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (activeTab === 'events') {
      return item.title?.toLowerCase().includes(query) || item.location?.toLowerCase().includes(query);
    } else if (activeTab === 'accounts') {
      return item.username?.toLowerCase().includes(query) ||
        item.display_name?.toLowerCase().includes(query) ||
        item.contact_name?.toLowerCase().includes(query) ||
        item.contact_info?.toLowerCase().includes(query) ||
        item.linked_entity_id?.toLowerCase().includes(query);
    } else {
      return item.name?.toLowerCase().includes(query) || 
             item.name_zh?.toLowerCase().includes(query) || 
             item.province_zh?.toLowerCase().includes(query) || 
             item.city_zh?.toLowerCase().includes(query);
    }
  });

  const filteredAssets = imageAssets.filter(asset => {
    if (assetFilter === 'unused' && asset.used) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return asset.path.toLowerCase().includes(query) ||
      asset.url.toLowerCase().includes(query) ||
      asset.references.some(ref => ref.title.toLowerCase().includes(query) || ref.type.toLowerCase().includes(query));
  });

  const labelOptions = accounts
    .filter(account => account.account_type === 'label')
    .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '', 'zh-Hans-CN'));
  const visibleLabelOptions = isLabelEditor && currentUser?.accountId
    ? labelOptions.filter(account => Number(account.id) === Number(currentUser.accountId))
    : labelOptions;
  const mainLineupBandIds = Array.from(new Set(formData.lineup.flatMap(day => day.bandIds || [])));
  const filteredLineupBands = bands.filter(band => {
    if (mainLineupBandIds.includes(band.band_id)) return false;
    const query = lineupBandQuery.trim().toLowerCase();
    if (!query) return true;
    return band.band_id?.toLowerCase().includes(query) ||
      band.name?.toLowerCase().includes(query) ||
      band.name_zh?.toLowerCase().includes(query);
  });
  const setMainLineupBandIds = (bandIds: string[]) => {
    setFormData({
      ...formData,
      lineup: bandIds.length ? [{ day: '主要阵容', bandIds }] : []
    });
  };
  const getLabelName = (labelAccountId: any) => {
    if (!labelAccountId) return '';
    const label = labelOptions.find(account => String(account.id) === String(labelAccountId));
    return label?.display_name || '';
  };
  const entityName = (tab: AdminTab = activeTab) => {
    const keys: Record<AdminTab, string> = {
      bands: 'band',
      venues: 'venueEntity',
      events: 'eventEntity',
      rehearsal_rooms: 'rehearsalRoom',
      spots: 'spot',
      players: 'album player',
      accounts: 'account',
      assets: 'imageAssets',
      settings: 'settings'
    };
    return t(keys[tab]);
  };
  const eventStops = formData.stops.length ? formData.stops : [createEmptyStop(0, 'single')];
  const setEventMode = (mode: EventMode) => {
    setEventModeState(mode);
    if (mode === 'single') {
      const firstStop = formData.stops[0] || createEmptyStop(0, 'single');
      setFormData({
        ...formData,
        stops: [{ ...firstStop, label: firstStop.label.match(/^第 \d+ 站$/) ? '' : firstStop.label }]
      });
      setGuestBandQueries({});
      return;
    }

    const stops = formData.stops.length ? formData.stops : [createEmptyStop(0, 'tour')];
    setFormData({
      ...formData,
      stops: stops.map((stop, index) => ({
        ...stop,
        label: stop.label || `第 ${index + 1} 站`
      }))
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0502] text-white px-5 pb-5 pt-[calc(4.4rem+env(safe-area-inset-top))] sm:px-6 md:px-10 md:pb-8 md:pt-24 lg:px-12 xl:px-14 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif">{t('dataManagement')}</h1>
          <div className="flex items-center gap-4">
            {message && (
              <div className={`px-4 py-2 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAdminLanguage(adminLanguage === 'zh' ? 'en' : 'zh')}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              title="Switch language"
            >
              <Languages size={17} />
              {adminLanguage === 'zh' ? '中文' : 'EN'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button 
            onClick={() => { setActiveTab('bands'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'bands' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Music size={18} /> {t('manageBands')}
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => { setActiveTab('venues'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'venues' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <MapPin size={18} /> {t('manageVenues')}
              </button>
              <button 
                onClick={() => { setActiveTab('rehearsal_rooms'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'rehearsal_rooms' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Mic2 size={18} /> {t('manageRehearsalRooms')}
              </button>
              <button 
                onClick={() => { setActiveTab('spots'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'spots' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Coffee size={18} /> {t('manageSpots')}
              </button>
            </>
          )}
          <button 
            onClick={() => { setActiveTab('events'); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'events' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Calendar size={18} /> {t('manageEvents')}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => { setActiveTab('players'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'players' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Disc3 size={18} /> 专辑播放器
              </button>
              <button
                onClick={() => { setActiveTab('accounts'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'accounts' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Users size={18} /> {t('manageAccounts')}
              </button>
              <button
                onClick={() => { setActiveTab('assets'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'assets' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <ImageIcon size={18} /> {t('imageAssets')}
              </button>
              <button 
                onClick={() => { setActiveTab('settings'); resetForm(); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${activeTab === 'settings' ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <KeyRound size={18} /> {t('settings')}
              </button>
            </>
          )}
        </div>

        {activeTab === 'players' ? (
          <AlbumPlayersAdminPanel token={token || ''} />
        ) : activeTab === 'settings' ? (
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/10 max-w-md">
            <h2 className="text-xl mb-6 font-medium flex items-center gap-2">
              <KeyRound size={20} className="text-[#ff4e00]" />
              {t('changePassword')}
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input
                type="password"
                required
                placeholder={t('currentPassword')}
                value={passwordForm.oldPassword}
                onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <input
                type="password"
                required
                placeholder={t('newPassword')}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <input
                type="password"
                required
                placeholder={t('confirmNewPassword')}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                className="bg-black/50 border border-white/10 rounded px-3 py-2 text-sm w-full text-white focus:outline-none focus:border-[#ff4e00]"
              />
              <button type="submit" className="w-full bg-[#ff4e00] text-white rounded py-2 text-sm font-medium hover:bg-[#ff4e00]/90">
                {t('updatePassword')}
              </button>
            </form>
          </div>
        ) : activeTab === 'assets' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                  <ImageIcon size={15} /> Total Images
                </div>
                <div className="text-2xl font-semibold">{imageAssetSummary.totalCount}</div>
              </div>
              <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                  <HardDrive size={15} /> Total Size
                </div>
                <div className="text-2xl font-semibold">{formatBytes(imageAssetSummary.totalSize)}</div>
              </div>
              <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                  <LinkIcon size={15} /> Used
                </div>
                <div className="text-2xl font-semibold text-green-400">{imageAssetSummary.usedCount}</div>
              </div>
              <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-2">
                  <Trash2 size={15} /> Unused
                </div>
                <div className="text-2xl font-semibold text-yellow-400">{imageAssetSummary.unusedCount}</div>
                <div className="text-xs text-gray-500 mt-1">{formatBytes(imageAssetSummary.unusedSize)}</div>
              </div>
            </div>

            <div className="bg-[#1a1a1a] p-5 md:p-6 rounded-2xl border border-white/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-medium flex items-center gap-2">
                    <ImageIcon size={20} className="text-[#ff4e00]" />
                    Image Assets / 图片资源
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Sorted by file size. Only local /uploads images are audited.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex gap-2 bg-black/50 rounded-lg p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setAssetFilter('all')}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${assetFilter === 'all' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetFilter('unused')}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${assetFilter === 'unused' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Unused
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={fetchData}
                    className="px-4 py-2 text-sm rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="relative mb-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search path or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00] w-full"
                />
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading image assets...</div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No image assets found.</div>
              ) : (
                <div className="space-y-3">
                  {filteredAssets.map(asset => (
                    <div key={asset.url} className={`grid grid-cols-1 lg:grid-cols-[96px_minmax(0,1fr)_220px] gap-4 rounded-lg border p-4 bg-black/30 ${asset.used ? 'border-white/5' : 'border-yellow-500/30'}`}>
                      <a href={asset.url} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg border border-white/10 bg-black/50">
                        <img src={asset.url} alt={asset.filename} className="h-full w-full object-cover" />
                      </a>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-medium text-white truncate">{asset.filename}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${asset.used ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                            {asset.used ? 'Used' : 'Unused'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 font-mono break-all">{asset.url}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {asset.references.length > 0 ? asset.references.map((ref, index) => (
                            <span key={`${ref.field}-${index}`} className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded">
                              {ref.type}: {ref.title}
                            </span>
                          )) : (
                            <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-1 rounded">No database reference</span>
                          )}
                        </div>
                      </div>
                      <div className="lg:text-right text-sm">
                        <div className="text-lg font-semibold text-white">{formatBytes(asset.size)}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(asset.modifiedAt).toLocaleString()}</div>
                        <div className="text-xs text-gray-600 mt-2 font-mono break-all">{asset.path}</div>
                        {!asset.used && (
                          <div className="mt-4 flex justify-start lg:justify-end">
                            {confirmDeleteAssetUrl === asset.url ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUnusedAsset(asset)}
                                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAssetUrl(null)}
                                  className="px-2 py-1 text-xs bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAssetUrl(asset.url)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                <Trash2 size={13} /> Delete Unused
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)] gap-8 items-start">
          {/* Form */}
          <div className="bg-[#1a1a1a] p-5 md:p-7 rounded-2xl border border-white/10 h-fit">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-medium flex items-center gap-2">
                {isEditing ? <Edit2 size={20} className="text-[#ff4e00]" /> : <Plus size={20} className="text-[#ff4e00]" />}
                {isEditing ? `${t('edit')} ${entityName()}` : `${t('addNew')} ${entityName()}`}
              </h2>
              {!isEditing && activeTab !== 'accounts' && (
                <button 
                  onClick={() => setIsBulkImportOpen(true)}
                  className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Upload size={14} /> {t('bulkImport')}
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              {activeTab !== 'events' && activeTab !== 'accounts' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('province')}>
                    <select required value={formData.province_id} onChange={handleProvinceChange} className={inputClass}>
                      <option value="" disabled>{t('selectProvince')}</option>
                      {provinces.map(p => (
                        <option key={p.en} value={p.en}>{p.zh} ({p.en})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('city')}>
                    <select required value={formData.city_id} onChange={handleCityChange} disabled={!formData.province_id} className={`${inputClass} disabled:opacity-50`}>
                      <option value="" disabled>{t('selectCity')}</option>
                      {cities.map(c => (
                        <option key={c.en} value={c.en}>{c.zh} ({c.en})</option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              {activeTab === 'bands' ? (
                <Field label={t('bandId')}><input required placeholder="e.g. carsick-cars" value={formData.band_id} onChange={e => setFormData({...formData, band_id: e.target.value})} className={inputClass} /></Field>
              ) : activeTab === 'venues' ? (
                <Field label={t('venueId')}><input required placeholder="e.g. school-bar" value={formData.venue_id} onChange={e => setFormData({...formData, venue_id: e.target.value})} className={inputClass} /></Field>
              ) : activeTab === 'rehearsal_rooms' ? (
                <Field label={t('roomId')}><input required placeholder="e.g. super-rehearsal" value={formData.room_id} onChange={e => setFormData({...formData, room_id: e.target.value})} className={inputClass} /></Field>
              ) : activeTab === 'spots' ? (
                <Field label={t('spotId')}><input required placeholder="e.g. fruityspace" value={formData.spot_id} onChange={e => setFormData({...formData, spot_id: e.target.value})} className={inputClass} /></Field>
              ) : null}

              {activeTab === 'events' ? (
                <>
                  <Field label={t('slug')}>
                    <input required placeholder="e.g. tingkaozai-night-decides-acoustic-live" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className={inputClass} />
                  </Field>
                  <Field label={t('eventTitle')}>
                    <input required placeholder={t('eventTitle')} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className={inputClass} />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isAdmin ? (
                      <Field label={t('label')}>
                        <select
                          value={formData.label_account_id}
                          onChange={e => {
                            const selectedLabel = visibleLabelOptions.find(label => String(label.id) === e.target.value);
                            setFormData({
                              ...formData,
                              label_account_id: e.target.value,
                              organizer: selectedLabel?.display_name || ''
                            });
                          }}
                          className={inputClass}
                        >
                          <option value="">不绑定厂牌</option>
                          {visibleLabelOptions.map(label => (
                            <option key={label.id} value={label.id}>{label.display_name}</option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/72">
                        厂牌：{currentUser?.displayName}
                      </div>
                    )}
                    <Field label={t('status')}>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputClass}>
                        <option value="on_sale">售票中</option>
                        <option value="upcoming">即将开始</option>
                        <option value="sold_out">已售罄</option>
                        <option value="ended">已结束</option>
                        <option value="cancelled">已取消</option>
                        <option value="postponed">已延期</option>
                      </select>
                    </Field>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className={labelClass}>{t('eventType')}</span>
                      <div className="flex gap-2 rounded-lg border border-white/10 bg-black/50 p-1">
                        <button
                          type="button"
                          onClick={() => setEventMode('single')}
                          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${eventMode === 'single' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          {t('singleEvent')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEventMode('tour')}
                          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${eventMode === 'tour' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          {t('tourEvent')}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs leading-6 text-gray-500">
                      {eventMode === 'single' ? t('singleHelp') : t('tourHelp')}
                    </p>
                  </div>
                  <Field label={t('legacyTicketUrl')}>
                    <input placeholder={t('optional')} value={formData.ticket_url} onChange={e => setFormData({...formData, ticket_url: e.target.value})} className={inputClass} />
                  </Field>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-gray-400 space-y-1">
                    <div><span className="text-gray-500">{t('autoDate')}:</span> {buildEventLegacyFields(formData, venues).date_str || t('autoEmpty')}</div>
                    <div><span className="text-gray-500">{t('autoLocation')}:</span> {buildEventLegacyFields(formData, venues).location || t('autoEmpty')}</div>
                    <div><span className="text-gray-500">{t('autoAddress')}:</span> {buildEventLegacyFields(formData, venues).address || t('autoEmpty')}</div>
                  </div>
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="rounded border-white/10 bg-black/50 text-[#ff4e00] focus:ring-[#ff4e00]" />
                      {t('setActive')}
                    </label>
                  )}
                </>
              ) : activeTab === 'accounts' ? (
                <>
                  <div className="rounded-xl border border-[#ff4e00]/20 bg-[#ff4e00]/10 p-4 text-sm text-[#ffb18a]">
                    艺人账号和厂牌账号暂不支持自主注册，需要联系我们后由管理员创建。
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('accountType')}>
                      <select
                        required
                        value={formData.account_type}
                        onChange={e => setFormData({...formData, account_type: e.target.value})}
                        className={inputClass}
                      >
                        <option value="artist">艺人账号</option>
                        <option value="label">厂牌账号</option>
                      </select>
                    </Field>
                    <Field label={t('status')}>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value})}
                        className={inputClass}
                      >
                        <option value="active">启用</option>
                        <option value="pending">待确认</option>
                        <option value="disabled">停用</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('username')}>
                      <input required placeholder="e.g. maybe-mars" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className={inputClass} />
                    </Field>
                    <Field label={isEditing ? t('newPasswordKeep') : t('initialPassword')}>
                      <input type="password" required={!isEditing} placeholder={isEditing ? t('newPasswordKeep') : t('initialPassword')} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} autoComplete="new-password" className={inputClass} />
                    </Field>
                  </div>
                  <Field label={t('displayName')}>
                    <input required placeholder="e.g. Maybe Mars / 兵马司" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} className={inputClass} />
                  </Field>
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className={labelClass}>{t('logo')}</span>
                      {formData.logo_url && (
                        <button type="button" onClick={handleRemoveLogo} className="text-xs text-red-400 hover:text-red-300">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2">
                      <button
                        type="button"
                        onClick={() => openImageAssetPicker(url => setFormData(prev => ({ ...prev, logo_url: url })))}
                        className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                      >
                        {t('chooseExisting')}
                      </button>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className={`${inputClass} file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20`} />
                    </div>
                    <input placeholder={t('pasteLogoUrl')} value={formData.logo_url} onChange={e => setFormData({...formData, logo_url: e.target.value})} className={inputClass} />
                    {formData.logo_url && (
                      <img src={formData.logo_url} alt="Logo preview" className="h-20 w-20 rounded-xl border border-white/10 bg-white object-contain p-2" />
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('linkedEntityId')}>
                      <input placeholder={formData.account_type === 'label' ? "label slug, optional" : "band_id, optional"} value={formData.linked_entity_id} onChange={e => setFormData({...formData, linked_entity_id: e.target.value})} className={inputClass} />
                    </Field>
                    <Field label={t('contactPerson')}>
                      <input placeholder={t('optional')} value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})} className={inputClass} />
                    </Field>
                  </div>
                  <Field label={t('contactInfo')}>
                    <input placeholder="WeChat / Email / Phone" value={formData.contact_info} onChange={e => setFormData({...formData, contact_info: e.target.value})} className={inputClass} />
                  </Field>
                  <Field label={t('notes')}>
                    <textarea placeholder={t('notesPlaceholder')} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className={`${inputClass} min-h-28 resize-y`} />
                  </Field>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('name')}>
                    <input required placeholder={t('subtitleName')} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} />
                  </Field>
                  <Field label={t('chineseName')}>
                    <input required placeholder={t('primaryChineseName')} value={formData.name_zh} onChange={e => setFormData({...formData, name_zh: e.target.value})} className={inputClass} />
                  </Field>
                </div>
              )}

              {activeTab === 'bands' ? (
                <>
                  <Field label={t('genre')}><input required placeholder="e.g. Indie Rock" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className={inputClass} /></Field>
                  {isAdmin ? (
                    <Field label={t('label')}>
                      <select
                        value={formData.label_account_id}
                        onChange={e => setFormData({...formData, label_account_id: e.target.value})}
                        className={inputClass}
                      >
                        <option value="">不绑定厂牌</option>
                        {visibleLabelOptions.map(label => (
                          <option key={label.id} value={label.id}>{label.display_name}</option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/72">
                      厂牌：{currentUser?.displayName}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('neteaseUrl')}><input placeholder={t('neteaseUrl')} value={formData.netease_url} onChange={e => setFormData({...formData, netease_url: e.target.value})} className={inputClass} /></Field>
                    <Field label={t('xiaohongshuUrl')}><input placeholder={t('xiaohongshuUrl')} value={formData.xiaohongshu_url} onChange={e => setFormData({...formData, xiaohongshu_url: e.target.value})} className={inputClass} /></Field>
                  </div>
                </>
              ) : activeTab === 'venues' ? (
                <>
                  <Field label={t('address')}><input required placeholder={t('address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputClass} /></Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('capacity')}><input required type="number" placeholder="e.g. 500" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} className={inputClass} /></Field>
                    <Field label={t('ticketUrl')}><input placeholder="e.g. ShowStart" value={formData.ticket_url} onChange={e => setFormData({...formData, ticket_url: e.target.value})} className={inputClass} /></Field>
                  </div>
                </>
              ) : activeTab === 'rehearsal_rooms' ? (
                <>
                  <Field label={t('address')}><input required placeholder={t('address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputClass} /></Field>
                  <Field label={t('equipment')}><textarea required placeholder="e.g. Marshall JCM900..." value={formData.equipment} onChange={e => setFormData({...formData, equipment: e.target.value})} className={`${inputClass} min-h-28 resize-y`} /></Field>
                  <Field label={t('priceInfo')}><input required placeholder="e.g. 80元/小时" value={formData.price_info} onChange={e => setFormData({...formData, price_info: e.target.value})} className={inputClass} /></Field>
                </>
              ) : activeTab === 'spots' ? (
                <>
                  <Field label={t('type')}><input required placeholder="e.g. 唱片店, 摇滚酒吧" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className={inputClass} /></Field>
                  <Field label={t('address')}><input required placeholder={t('address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className={inputClass} /></Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label={t('businessHours')}><input required placeholder={t('businessHours')} value={formData.business_hours} onChange={e => setFormData({...formData, business_hours: e.target.value})} className={inputClass} /></Field>
                    <Field label={t('socialUrl')}><input placeholder="e.g. Xiaohongshu" value={formData.social_url} onChange={e => setFormData({...formData, social_url: e.target.value})} className={inputClass} /></Field>
                  </div>
                </>
              ) : null}

              {activeTab !== 'accounts' && (
                <Field label={activeTab === 'events' ? t('eventDescription') : t('introduction')}>
                  <textarea required placeholder={activeTab === 'events' ? t('eventDescription') : t('introduction')} value={formData.intro} onChange={e => setFormData({...formData, intro: e.target.value})} className={`${inputClass} min-h-32 resize-y`} />
                </Field>
              )}
              
              {activeTab === 'events' && (
                <div className="space-y-4 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div>
                    <h3 className="text-sm font-medium text-white">{t('mainLineup')}</h3>
                    <p className="mt-1 text-xs text-gray-500">{t('mainLineupHelp')}</p>
                  </div>

                  <div className="space-y-3 border border-white/5 p-3 rounded-lg bg-black/40">
                    <div className="flex flex-wrap gap-2">
                      {mainLineupBandIds.length > 0 ? mainLineupBandIds.map((bandId, bandIndex) => {
                        const band = bands.find(b => b.band_id === bandId);
                        return (
                          <div key={bandId} className="flex items-center gap-1 bg-white/10 text-xs px-2 py-1 rounded-full text-gray-300">
                            {band ? band.name_zh || band.name : bandId}
                            <button
                              type="button"
                              onClick={() => setMainLineupBandIds(mainLineupBandIds.filter((_, i) => i !== bandIndex))}
                              className="hover:text-red-400 ml-1"
                            >
                              <X size={12}/>
                            </button>
                          </div>
                        );
                      }) : (
                        <span className="text-xs text-gray-500">{t('noMainLineup')}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.5fr)] gap-2">
                      <input
                        value={lineupBandQuery}
                        onChange={e => setLineupBandQuery(e.target.value)}
                        placeholder={t('searchBand')}
                        className={compactInputClass}
                      />
                      <select
                        value=""
                        onChange={e => {
                          if (!e.target.value) return;
                          setMainLineupBandIds([...mainLineupBandIds, e.target.value]);
                          setLineupBandQuery('');
                        }}
                        className={compactInputClass}
                      >
                        <option value="">{t('addBand')}</option>
                        {filteredLineupBands.map(b => (
                          <option key={b.band_id} value={b.band_id}>{b.name_zh || b.name} ({b.band_id})</option>
                        ))}
                      </select>
                    </div>

                    {lineupBandQuery && filteredLineupBands.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {filteredLineupBands.slice(0, 8).map(band => (
                          <button
                            key={band.band_id}
                            type="button"
                            onClick={() => {
                              setMainLineupBandIds([...mainLineupBandIds, band.band_id]);
                              setLineupBandQuery('');
                            }}
                            className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            {band.name_zh || band.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'events' && (
                <div className="space-y-4 border border-white/10 p-4 rounded-xl bg-black/20">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-white">{eventMode === 'single' ? t('eventInfo') : t('tourStops')}</h3>
                    {eventMode === 'tour' && (
                      <button type="button" onClick={() => setFormData({...formData, stops: [...formData.stops, createEmptyStop(formData.stops.length, 'tour')]})} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={14}/> {t('addStop')}</button>
                    )}
                  </div>

                  {eventStops.map((stop, stopIndex) => (
                    <div key={stopIndex} className="space-y-3 border border-white/5 p-3 rounded-lg bg-black/40">
                      {eventMode === 'tour' && (
                        <div className="flex justify-between items-center gap-2">
                          <input value={stop.label} onChange={e => updateStop(stopIndex, { label: e.target.value })} className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-[#ff4e00] font-mono focus:outline-none focus:border-[#ff4e00] flex-1" placeholder={`${t('stopName')}，e.g. 宁波站`} />
                          <button type="button" onClick={() => {
                            setFormData({...formData, stops: formData.stops.filter((_, i) => i !== stopIndex)});
                          }} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                        </div>
                      )}

                      <input
                        placeholder={`${t('stopId')} (e.g. ningbo)`}
                        value={stop.id}
                        onChange={e => updateStop(stopIndex, { id: e.target.value })}
                        className={compactInputClass}
                      />

                      <div>
                        <input
                          type="datetime-local"
                          value={toDateTimeLocalValue(stop.start_at)}
                          onChange={e => updateStop(stopIndex, { start_at: fromDateTimeLocalValue(e.target.value) })}
                          className={compactInputClass}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select
                          required
                          value={stop.venue_id}
                          onChange={e => {
                            updateStop(stopIndex, {
                              venue_id: e.target.value
                            });
                          }}
                          className={compactInputClass}
                        >
                          <option value="">Select Venue</option>
                          {venues.map(v => (
                            <option key={v.venue_id} value={v.venue_id}>{v.name_zh || v.name}</option>
                          ))}
                        </select>
                        <div className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-gray-400 truncate">
                          {(() => {
                            const venue = venues.find(v => v.venue_id === stop.venue_id);
                            return venue ? `${venue.name_zh || venue.name} · ${venue.city_zh || ''}` : t('venueHint');
                          })()}
                        </div>
                      </div>

                      <input placeholder={t('priceText')} value={stop.price_text} onChange={e => updateStop(stopIndex, { price_text: e.target.value })} className={compactInputClass} />

                      <div className="space-y-2">
                        <span className="text-xs text-gray-400">{t('guestBands')}</span>
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
                        </div>
                        {(() => {
                          const guestQuery = (guestBandQueries[stopIndex] || '').trim().toLowerCase();
                          const guestOptions = bands.filter(band => {
                            if (stop.guestBandIds.includes(band.band_id)) return false;
                            if (!guestQuery) return true;
                            return band.band_id?.toLowerCase().includes(guestQuery) ||
                              band.name?.toLowerCase().includes(guestQuery) ||
                              band.name_zh?.toLowerCase().includes(guestQuery);
                          });

                          return (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.5fr)] gap-2">
                                <input
                                  value={guestBandQueries[stopIndex] || ''}
                                  onChange={e => setGuestBandQueries(prev => ({ ...prev, [stopIndex]: e.target.value }))}
                                  placeholder={t('searchGuest')}
                                  className={compactInputClass}
                                />
                                <select
                                  value=""
                                  onChange={e => {
                                    if (!e.target.value) return;
                                    const nextStops = [...formData.stops];
                                    if (!nextStops[stopIndex].guestBandIds.includes(e.target.value)) {
                                      nextStops[stopIndex] = {
                                        ...nextStops[stopIndex],
                                        guestBandIds: [...nextStops[stopIndex].guestBandIds, e.target.value]
                                      };
                                    }
                                    setFormData({...formData, stops: nextStops});
                                    setGuestBandQueries(prev => ({ ...prev, [stopIndex]: '' }));
                                  }}
                                  className={compactInputClass}
                                >
                                  <option value="">{t('addGuest')}</option>
                                  {guestOptions.map(b => (
                                    <option key={b.band_id} value={b.band_id}>{b.name_zh || b.name} ({b.band_id})</option>
                                  ))}
                                </select>
                              </div>

                              {guestQuery && guestOptions.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {guestOptions.slice(0, 8).map(band => (
                                    <button
                                      key={band.band_id}
                                      type="button"
                                      onClick={() => {
                                        const nextStops = [...formData.stops];
                                        if (!nextStops[stopIndex].guestBandIds.includes(band.band_id)) {
                                          nextStops[stopIndex] = {
                                            ...nextStops[stopIndex],
                                            guestBandIds: [...nextStops[stopIndex].guestBandIds, band.band_id]
                                          };
                                        }
                                        setFormData({...formData, stops: nextStops});
                                        setGuestBandQueries(prev => ({ ...prev, [stopIndex]: '' }));
                                      }}
                                      className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                      {band.name_zh || band.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400">{t('tickets')}</span>
                          <button type="button" onClick={() => {
                            const nextStops = [...formData.stops];
                            nextStops[stopIndex] = {
                              ...nextStops[stopIndex],
                              tickets: [...nextStops[stopIndex].tickets, { label: '购票', url: '' }]
                            };
                            setFormData({...formData, stops: nextStops});
                          }} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={12}/> {t('addTicket')}</button>
                        </div>
                        {stop.tickets.map((ticket, ticketIndex) => (
                          <div key={ticketIndex} className="grid grid-cols-1 md:grid-cols-[0.35fr_1fr_auto] gap-2 items-center">
                            <input placeholder="Label" value={ticket.label} onChange={e => updateTicket(stopIndex, ticketIndex, { label: e.target.value })} className={compactInputClass} />
                            <input placeholder="URL" value={ticket.url} onChange={e => updateTicket(stopIndex, ticketIndex, { url: e.target.value })} className={compactInputClass} />
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
                          <span className="text-xs text-gray-400">{t('recapPhotos')}</span>
                          <button type="button" onClick={() => {
                            const nextStops = [...formData.stops];
                            nextStops[stopIndex] = {
                              ...nextStops[stopIndex],
                              recap_photos: [...nextStops[stopIndex].recap_photos, { title: '', caption: '', image_url: '' }]
                            };
                            setFormData({...formData, stops: nextStops});
                          }} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={12}/> {t('addPhoto')}</button>
                        </div>

                        {stop.recap_photos.map((photo, photoIndex) => (
                          <div key={photoIndex} className="space-y-2 rounded-lg border border-white/5 bg-black/30 p-3">
                            <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                              <input placeholder={t('photoTitle')} value={photo.title} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { title: e.target.value })} className={compactInputClass} />
                              <button type="button" onClick={() => removeRecapPhoto(stopIndex, photoIndex)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                            </div>
                            <input placeholder={t('caption')} value={photo.caption} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { caption: e.target.value })} className={compactInputClass} />
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                              <input placeholder={t('photoImageUrl')} value={photo.image_url} onChange={e => updateRecapPhoto(stopIndex, photoIndex, { image_url: e.target.value })} className={compactInputClass} />
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={() => openImageAssetPicker(url => updateRecapPhoto(stopIndex, photoIndex, { image_url: url }))}
                                  className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-3 py-2 text-xs transition-colors whitespace-nowrap"
                                >
                                  {t('chooseExisting')}
                                </button>
                                <input type="file" accept="image/*" onChange={e => handleRecapPhotoUpload(stopIndex, photoIndex, e)} className={`${compactInputClass} md:w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20`} />
                              </div>
                            </div>
                            {photo.image_url && (
                              <img src={photo.image_url} alt={photo.title || 'Recap photo'} className="h-24 w-32 rounded-lg border border-white/10 object-cover" />
                            )}
                          </div>
                        ))}

                        <div className="space-y-2">
                          <span className="text-xs text-gray-400">{t('recapVideo')}</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input placeholder={t('videoTitle')} value={stop.recap_video.title} onChange={e => updateRecapVideo(stopIndex, { title: e.target.value })} className={compactInputClass} />
                            <input placeholder={t('bilibiliUrl')} value={stop.recap_video.url} onChange={e => updateRecapVideo(stopIndex, { url: e.target.value })} className={compactInputClass} />
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
                    <h3 className="text-sm font-medium text-white">{t('qrCodes')}</h3>
                    <button type="button" onClick={() => setFormData({...formData, qr_codes: [...formData.qr_codes, { title: '', image_url: '' }]})} className="text-xs text-[#ff4e00] hover:text-[#ff6a2b] flex items-center gap-1"><Plus size={14}/> {t('addQr')}</button>
                  </div>

                  {formData.qr_codes.map((qrCode, qrIndex) => (
                    <div key={qrIndex} className="space-y-3 border border-white/5 p-3 rounded-lg bg-black/40">
                      <div className="flex justify-between items-center gap-2">
                        <input
                          placeholder={t('qrTitlePlaceholder')}
                          value={qrCode.title}
                          onChange={e => updateQrCode(qrIndex, { title: e.target.value })}
                          className="bg-transparent border-b border-white/10 px-1 py-1 text-sm text-[#ff4e00] font-mono focus:outline-none focus:border-[#ff4e00] flex-1"
                        />
                        <button type="button" onClick={() => removeQrCode(qrIndex)} className="text-gray-500 hover:text-red-400"><X size={14}/></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                        <input
                          placeholder={t('qrImageUrl')}
                          value={qrCode.image_url}
                          onChange={e => updateQrCode(qrIndex, { image_url: e.target.value })}
                          className={compactInputClass}
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => openImageAssetPicker(url => updateQrCode(qrIndex, { image_url: url }))}
                            className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-3 py-2 text-xs transition-colors whitespace-nowrap"
                          >
                            {t('chooseExisting')}
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleQrImageUpload(qrIndex, e)}
                            className={`${compactInputClass} md:w-44 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20`}
                          />
                        </div>
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
                    <h3 className="text-sm font-medium text-white flex items-center gap-2"><Code2 size={15}/> {t('eventJson')}</h3>
                    <div className="flex gap-2">
                      <button type="button" onClick={refreshEventJson} className="text-xs bg-white/10 hover:bg-white/15 text-gray-200 rounded px-3 py-1 transition-colors">{t('generate')}</button>
                      <button type="button" onClick={applyEventJson} className="text-xs bg-[#ff4e00] hover:bg-[#ff6a2b] text-white rounded px-3 py-1 transition-colors">{t('apply')}</button>
                    </div>
                  </div>
                  <textarea
                    placeholder={t('eventJsonPlaceholder')}
                    value={eventJsonInput}
                    onChange={e => setEventJsonInput(e.target.value)}
                    className={`${compactInputClass} h-44 resize-y font-mono`}
                  />
                </div>
              )}

              {activeTab !== 'accounts' && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>{t('imageMax')}</span>
                  <div className="flex gap-2 bg-black/50 rounded-lg p-1 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setImageInputType('upload')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputType === 'upload' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {t('uploadFile')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputType('url')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageInputType === 'url' ? 'bg-[#ff4e00] text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {t('imageUrl')}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {imageInputType === 'upload' ? (
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2">
                      <button
                        type="button"
                        onClick={() => openImageAssetPicker(url => setFormData(prev => ({ ...prev, image_url: url })))}
                        className="bg-white/10 hover:bg-white/15 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                      >
                        {t('chooseExisting')}
                      </button>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className={`${inputClass} file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white hover:file:bg-white/20`} />
                    </div>
                  ) : (
                    <input placeholder={t('imageUrlPlaceholder')} value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className={inputClass} />
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
              )}

              {activeTab !== 'events' && activeTab !== 'accounts' && (
                <div className="grid grid-cols-1 md:grid-cols-[0.35fr_1fr] gap-4">
                  <Field label={t('contactType')}>
                    <select
                      value={contactType}
                      onChange={e => setContactType(e.target.value as 'wechat' | 'email')}
                      className={inputClass}
                    >
                      <option value="wechat">WeChat</option>
                      <option value="email">Email</option>
                    </select>
                  </Field>
                  <Field label={t('contactInfo')}>
                    <input
                      placeholder={t('optional')}
                      value={contactValue}
                      onChange={e => setContactValue(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-[#ff4e00] text-white rounded py-2 text-sm font-medium hover:bg-[#ff4e00]/90">
                  {isEditing ? t('update') : t('add')}
                </button>
                {isEditing && (
                  <button type="button" onClick={resetForm} className="flex-1 bg-white/10 text-white rounded py-2 text-sm font-medium hover:bg-white/20">
                    {t('cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="bg-[#1a1a1a] p-5 md:p-6 rounded-2xl border border-white/10 flex flex-col h-full">
            <div className="flex flex-col gap-4 mb-6">
              <h2 className="text-lg font-medium">{t('current')} {entityName()} ({filteredList.length}/{currentList.length})</h2>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder={t('search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff4e00] w-full"
                />
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">{t('loading')}</div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                {filteredList.map(item => (
                  <div key={item.id} className={`flex items-start justify-between gap-3 bg-black/30 p-4 rounded-lg border ${item.is_active ? 'border-[#ff4e00]/50' : 'border-white/5'} hover:border-white/10 transition-colors`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white truncate">{activeTab === 'events' ? item.title : activeTab === 'accounts' ? item.display_name : item.name_zh}</span>
                        {activeTab !== 'events' && activeTab !== 'accounts' && <span className="text-xs text-gray-500">{item.name}</span>}
                        {activeTab === 'accounts' && <span className="text-xs text-gray-500">@{item.username}</span>}
                        {item.is_active && <span className="text-[10px] bg-[#ff4e00] text-white px-1.5 py-0.5 rounded flex items-center gap-1"><Star size={10} /> Active</span>}
                      </div>
                      <div className="text-xs text-gray-400 flex flex-wrap gap-2">
                        {activeTab === 'events' ? (
                          <>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.date_str}</span>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.location}</span>
                            {getLabelName(item.label_account_id) && <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">厂牌 {getLabelName(item.label_account_id)}</span>}
                            {item.slug && <span className="bg-white/5 px-2 py-0.5 rounded">/{item.slug}</span>}
                          </>
                        ) : activeTab === 'accounts' ? (
                          <>
                            <span className={`px-2 py-0.5 rounded ${item.account_type === 'label' ? 'bg-blue-500/10 text-blue-400' : 'bg-[#ff4e00]/10 text-[#ff4e00]'}`}>
                              {item.account_type === 'label' ? '厂牌账号' : '艺人账号'}
                            </span>
                            <span className={`px-2 py-0.5 rounded ${item.status === 'active' ? 'bg-green-500/10 text-green-400' : item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                              {item.status === 'active' ? '启用' : item.status === 'pending' ? '待确认' : '停用'}
                            </span>
                            {item.linked_entity_id && <span className="bg-white/5 px-2 py-0.5 rounded">关联 {item.linked_entity_id}</span>}
                            {item.contact_info && <span className="bg-white/5 px-2 py-0.5 rounded">{item.contact_info}</span>}
                          </>
                        ) : (
                          <>
                            <span className="bg-white/5 px-2 py-0.5 rounded">{item.province_zh} - {item.city_zh}</span>
                            {activeTab === 'bands' ? (
                              <>
                                <span className="bg-[#ff4e00]/10 text-[#ff4e00] px-2 py-0.5 rounded">{item.genre}</span>
                                {getLabelName(item.label_account_id) && <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">厂牌 {getLabelName(item.label_account_id)}</span>}
                              </>
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

      <ImageAssetPicker
        isOpen={!!imageAssetPicker}
        token={token || ''}
        onClose={() => setImageAssetPicker(null)}
        onSelect={(url) => imageAssetPicker?.onSelect(url)}
      />
    </div>
  );
}

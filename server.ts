import express from 'express';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$xVBmUPJph0jgqqkqnLIt8e.4EhwN4NYUj1wqEazquAsPWtEazLvDO'; // Default hash for 'bercat2026'
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_indie_rock_map';

app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

const sanitizePathSegment = (value: any, fallback: string) => {
  const segment = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return segment || fallback;
};

// Configure multer for image uploads (max 1MB)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'));
    }
  }
});

const eventStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const slug = sanitizePathSegment(req.params.slug, 'untitled-event');
    const category = sanitizePathSegment(req.params.category, 'misc');
    const stopId = sanitizePathSegment(req.params.stopId, 'general');
    const allowedCategories = new Set(['poster', 'qr', 'recap']);
    const safeCategory = allowedCategories.has(category) ? category : 'misc';
    const parts = safeCategory === 'recap'
      ? [uploadsDir, 'events', slug, safeCategory, stopId]
      : [uploadsDir, 'events', slug, safeCategory];
    const destination = path.join(...parts);
    fs.mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const eventUpload = multer({
  storage: eventStorage,
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'));
    }
  }
});

// Initialize SQLite Database
const db = new Database('bands.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    province_zh TEXT NOT NULL,
    city_id TEXT NOT NULL,
    city_zh TEXT NOT NULL,
    band_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    genre TEXT NOT NULL,
    intro TEXT NOT NULL,
    image_url TEXT,
    contact_info TEXT,
    netease_url TEXT,
    xiaohongshu_url TEXT
  );

  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    province_zh TEXT NOT NULL,
    city_id TEXT NOT NULL,
    city_zh TEXT NOT NULL,
    venue_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    address TEXT NOT NULL,
    capacity INTEGER,
    intro TEXT NOT NULL,
    image_url TEXT,
    contact_info TEXT,
    ticket_url TEXT
  );

  CREATE TABLE IF NOT EXISTS featured_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    date_str TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    ticket_url TEXT,
    is_active INTEGER DEFAULT 0,
    lineup TEXT,
    organizer TEXT,
    status TEXT,
    stops TEXT,
    qr_codes TEXT
  );

  CREATE TABLE IF NOT EXISTS rehearsal_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    province_zh TEXT NOT NULL,
    city_id TEXT NOT NULL,
    city_zh TEXT NOT NULL,
    room_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    address TEXT NOT NULL,
    equipment TEXT NOT NULL,
    price_info TEXT NOT NULL,
    intro TEXT NOT NULL,
    image_url TEXT,
    contact_info TEXT
  );

  CREATE TABLE IF NOT EXISTS spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province_id TEXT NOT NULL,
    province_zh TEXT NOT NULL,
    city_id TEXT NOT NULL,
    city_zh TEXT NOT NULL,
    spot_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    type TEXT NOT NULL,
    address TEXT NOT NULL,
    business_hours TEXT NOT NULL,
    intro TEXT NOT NULL,
    image_url TEXT,
    contact_info TEXT,
    social_url TEXT
  );
`);

// Add columns to existing tables if they don't exist (migration)
try { db.exec('ALTER TABLE bands ADD COLUMN contact_info TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE bands ADD COLUMN netease_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE bands ADD COLUMN xiaohongshu_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE venues ADD COLUMN ticket_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN lineup TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN slug TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN organizer TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN status TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN stops TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN qr_codes TEXT;'); } catch (e) {}

// Seed initial data if empty
const countBands = db.prepare('SELECT COUNT(*) as count FROM bands').get() as { count: number };
if (countBands.count === 0) {
  console.log('Seeding initial band data...');
  const insert = db.prepare(`
    INSERT INTO bands (province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialData = [
    ['Beijing', '北京市', 'Beijing', '北京市', 'carsick-cars', 'Carsick Cars', 'Carsick Cars', 'Noise Rock / Indie Rock', '成立于2005年的北京，是地下摇滚的标志性乐队之一，以其极具破坏性和实验性的噪音吉他音墙闻名。', 'https://picsum.photos/seed/carsick/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'hedgehog', 'Hedgehog', '刺猬', 'Indie Rock / Noise Pop', '2005年成立于北京，由主唱/吉他手子健、鼓手石璐和贝斯手一帆组成。他们的音乐充满了青春的躁动与忧郁。', 'https://picsum.photos/seed/hedgehog/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'new-pants', 'New Pants', '新裤子', 'Synth-pop / Punk', '极具现场活力和创造性的偶像摇滚乐队。1996年成立，从朋克到新浪潮，始终引领独立音乐的潮流。', 'https://picsum.photos/seed/newpants/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'joyside', 'Joyside', 'Joyside', 'Punk Rock / Indie Rock', '2001年成立于北京，是极具代表性的朋克乐队之一，以其不羁的台风和浪漫的旋律著称。', 'https://picsum.photos/seed/joyside/400/300?grayscale'],
    ['Hebei', '河北省', 'Shijiazhuang', '石家庄', 'omnipotent-youth-society', 'Omnipotent Youth Society', '万能青年旅店', 'Indie Rock / Folk Rock', '来自石家庄的独立摇滚乐队，以其深沉的歌词、宏大的管乐编配和对时代变迁的深刻洞察而闻名。代表作《杀死那个石家庄人》。', 'https://picsum.photos/seed/oys/400/300?grayscale'],
    ['Hebei', '河北省', 'Shijiazhuang', '石家庄', 'click-15', 'Click#15', 'Click#15', 'Funk / R&B', '虽然主唱Ricky后来在北京发展，但他来自河北石家庄，乐队以极具律动感的Funk音乐在独立乐坛独树一帜。', 'https://picsum.photos/seed/click15/400/300?grayscale'],
    ['Shaanxi', '陕西省', "Xi'an", '西安', 'fazi', 'FAZI', '法兹', 'Post-Punk', '成立于古城西安的后朋克乐队，音乐中充满了西北的粗犷与克制，现场极具爆发力和感染力。', 'https://picsum.photos/seed/fazi/400/300?grayscale'],
    ['Shaanxi', '陕西省', "Xi'an", '西安', 'black-head', 'Black Head', '黑撒', 'Folk Rock / Rap', '用陕西方言演唱的乐队，将西安本土文化与现代摇滚、说唱结合，创造了独特的“陕派音乐”。', 'https://picsum.photos/seed/blackhead/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'soundtoy', 'Soundtoy', '声音玩具', 'Alternative Rock', '成都独立音乐的先驱之一，音乐旋律优美，歌词充满诗意，现场演出极具艺术气息。', 'https://picsum.photos/seed/soundtoy/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'stolen', 'Stolen', '秘密行动', 'Electronic Rock / Post-Punk', '将冷峻的电子乐与摇滚乐融合，现场视觉与听觉的双重冲击力极强，是近年来备受瞩目的乐队。', 'https://picsum.photos/seed/stolen/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'mosaic', 'Mosaic', '马赛克', 'Indie Pop / Disco', '来自成都的独立流行乐队，音乐充满复古的Disco节拍和浪漫的合成器旋律，现场极具感染力。', 'https://picsum.photos/seed/mosaic/400/300?grayscale'],
    ['Guangdong', '广东省', 'Guangzhou', '广州', 'zhaoze', 'Zhaoze', '沼泽', 'Post-Rock', '后摇滚的代表乐队之一，创新性地将古琴融入后摇滚中，创造出独特的“古琴后摇”。', 'https://picsum.photos/seed/zhaoze/400/300?grayscale'],
    ['Guangdong', '广东省', 'Haifeng', '海丰', 'wutiaoren', 'Wutiaoren', '五条人', 'Folk Rock', '来自广东海丰的民谣摇滚乐队，用方言歌唱市井生活，音乐中充满了泥土的气息和对底层人物的关怀。', 'https://picsum.photos/seed/wutiaoren/400/300?grayscale'],
    ['Guangdong', '广东省', 'Lianping', '连平', 'jiulian', 'Jiulian Zhenren', '九连真人', 'Alternative Rock / Folk', '来自广东连平，以客家话演唱，音乐生猛直接，融合了原生态的民间元素与硬朗的摇滚乐。', 'https://picsum.photos/seed/jiulian/400/300?grayscale'],
    ['Hubei', '湖北省', 'Wuhan', '武汉', 'smzb', 'SMZB', '生命之饼', 'Punk Rock', '武汉朋克音乐的奠基者，早期朋克乐队之一，以其直白、有力的音乐表达对社会的关注。', 'https://picsum.photos/seed/smzb/400/300?grayscale'],
    ['Hubei', '湖北省', 'Wuhan', '武汉', 'hiperson', 'Hiperson', '海朋森', 'Indie Rock / Post-Punk', '来自成都，但主唱陈思江在武汉求学期间深受武汉朋克场景影响。音乐充满诗意与力量。', 'https://picsum.photos/seed/hiperson/400/300?grayscale'],
    ['Hubei', '湖北省', 'Wuhan', '武汉', 'chinese-football', 'Chinese Football', 'Chinese Football', 'Math Rock / Emo', '武汉的独立摇滚乐队，深受90年代Emo和数字摇滚影响，吉他编配精巧，情绪真挚。', 'https://picsum.photos/seed/chinesefootball/400/300?grayscale'],
    ['Taiwan', '台湾省', 'Taipei', '台北', 'no-party-for-caodong', 'No Party For Cao Dong', '草东没有派对', 'Indie Rock / Grunge', '以其丧文化的歌词和极具爆发力的编曲，迅速席卷华语乐坛，深刻反映了当代年轻人的虚无与挣扎。', 'https://picsum.photos/seed/caodong/400/300?grayscale'],
    ['Taiwan', '台湾省', 'Taipei', '台北', 'sunset-rollercoaster', 'Sunset Rollercoaster', '落日飞车', 'Synth-pop / City Pop', '充满浪漫气息的城市流行乐队，以英文创作为主，音乐中弥漫着复古与迷幻的色彩。', 'https://picsum.photos/seed/sunset/400/300?grayscale'],
    ['Taiwan', '台湾省', 'Taipei', '台北', 'decadent', 'Deca Joins', 'Deca Joins', 'Indie Rock / Dream Pop', '音乐风格慵懒、迷幻，歌词充满对生活的无奈与自嘲，深受年轻一代喜爱。', 'https://picsum.photos/seed/decajoins/400/300?grayscale'],
    ['Henan', '河南省', 'Xinxiang', '新乡', 'the-fallacy', 'The Fallacy', '疯医', 'Post-Punk', '来自“摇滚之乡”新乡的后朋克乐队，音乐阴暗、冰冷，充满张力，是中原摇滚的代表力量。', 'https://picsum.photos/seed/fallacy/400/300?grayscale'],
    ['Guangxi', '广西壮族自治区', 'Qinzhou', '钦州', 'wutiaoren-gx', 'Bands of Guangxi', '回春丹', 'Indie Rock', '来自广西钦州的独立摇滚乐队，以其极具辨识度的吉他Riff和充满地域色彩的旋律迅速走红。', 'https://picsum.photos/seed/huichundan/400/300?grayscale']
  ];

  const insertMany = db.transaction((bands) => {
    for (const band of bands) insert.run(band);
  });
  insertMany(initialData);
}

const countVenues = db.prepare('SELECT COUNT(*) as count FROM venues').get() as { count: number };
if (countVenues.count === 0) {
  console.log('Seeding initial venue data...');
  const insert = db.prepare(`
    INSERT INTO venues (province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialData = [
    ['Beijing', '北京市', 'Beijing', '北京市', 'school-bar', 'School Bar', 'School酒吧', '东城区五道营胡同53号院', 200, '北京朋克和独立摇滚的圣地，无数年轻乐队从这里起步。', 'https://picsum.photos/seed/schoolbar/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'yugong-yishan', 'Yugong Yishan', '愚公移山', '东城区张自忠路3-2号段祺瑞执政府旧址西院', 800, '曾经北京最具标志性的Livehouse之一，承载了无数乐迷的青春记忆。', 'https://picsum.photos/seed/yugongyishan/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'omni-space', 'Omni Space', '疆进酒·OMNI SPACE', '西城区天桥南大街9号天桥艺术中心b103', 600, '设备精良的现代化Livehouse，是国内外知名乐队巡演的重要一站。', 'https://picsum.photos/seed/omnispace/400/300?grayscale'],
    ['Hebei', '河北省', 'Shijiazhuang', '石家庄', 'hongtang', 'Hong Tang Livehouse', '红糖Livehouse', '长安区翟营大街与跃进路交叉口东行100米路北', 400, '石家庄重要的独立音乐演出场地，见证了本地摇滚乐的发展。', 'https://picsum.photos/seed/hongtang/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'little-bar', 'Little Bar', '小酒馆 (芳沁店)', '武侯区芳沁街87号附5号', 300, '成都独立音乐的摇篮，赵雷《成都》中唱到的地方，无数乐队的起点。', 'https://picsum.photos/seed/littlebar/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'ch8', 'CH8', 'CH8冇独空间', '成华区完美文创公园', 800, '成都新晋的大型Livehouse，拥有极佳的声场和灯光设备。', 'https://picsum.photos/seed/ch8/400/300?grayscale'],
    ['Guangdong', '广东省', 'Guangzhou', '广州', 'tu-space', 'TU Space', 'TU凸空间', '越秀区广州大道中361-365号东方花苑首层', 600, '广州老牌Livehouse，见证了南方独立音乐的繁荣与发展。', 'https://picsum.photos/seed/tuspace/400/300?grayscale'],
    ['Guangdong', '广东省', 'Guangzhou', '广州', 'mao-livehouse-gz', 'MAO Livehouse', 'MAO Livehouse (广州)', '海珠区新港东路1088号六元素体验天地一楼', 1000, '全国连锁的知名Livehouse品牌，广州店是华南地区重要的演出场地。', 'https://picsum.photos/seed/maogz/400/300?grayscale'],
    ['Hubei', '湖北省', 'Wuhan', '武汉', 'vox-livehouse', 'VOX Livehouse', 'VOX Livehouse', '洪山区鲁磨路118号国光大厦', 500, '武汉乃至全国最具传奇色彩的Livehouse之一，被誉为“武汉摇滚的黄埔军校”。', 'https://picsum.photos/seed/vox/400/300?grayscale'],
    ['Taiwan', '台湾省', 'Taipei', '台北', 'legacy-taipei', 'Legacy Taipei', 'Legacy 传 音乐展演空间', '中正区八德路一段1号华山1914创意文化园区中5A馆', 1200, '台北最具指标性的中大型Livehouse，无数台湾独立乐团在这里举办重要专场。', 'https://picsum.photos/seed/legacy/400/300?grayscale'],
    ['Taiwan', '台湾省', 'Taipei', '台北', 'the-wall', 'The Wall', 'The Wall Live House', '文山区罗斯福路四段200号B1', 600, '台湾地下音乐的重镇，孕育了无数优秀的独立乐团和音乐人。', 'https://picsum.photos/seed/thewall/400/300?grayscale']
  ];

  const insertMany = db.transaction((venues) => {
    for (const venue of venues) insert.run(venue);
  });
  insertMany(initialData);
}

// Middleware to verify JWT
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error('JWT Verify Error:', err.message);
      return res.status(403).json({ error: err.message });
    }
    (req as any).user = user;
    next();
  });
};

const normalizeDisplayCity = (cityZh: string) => {
  return cityZh ? cityZh.replace(/(省|市|维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|地区|盟)$/, '') : '';
};

const toBandCard = (b: any) => {
  if (!b) return null;
  return {
    id: b.band_id,
    band_id: b.band_id,
    name: b.name,
    name_zh: b.name_zh,
    genre: b.genre,
    intro: b.intro,
    city: b.city_id,
    city_zh: normalizeDisplayCity(b.city_zh),
    imageUrl: b.image_url,
    contactInfo: b.contact_info,
    neteaseUrl: b.netease_url,
    xiaohongshuUrl: b.xiaohongshu_url,
    dbId: b.id
  };
};

const toVenueCard = (v: any) => {
  if (!v) return null;
  return {
    id: v.venue_id,
    venue_id: v.venue_id,
    name: v.name,
    name_zh: v.name_zh,
    address: v.address,
    capacity: v.capacity,
    intro: v.intro,
    city: v.city_id,
    city_zh: normalizeDisplayCity(v.city_zh),
    imageUrl: v.image_url,
    contactInfo: v.contact_info,
    ticketUrl: v.ticket_url,
    dbId: v.id
  };
};

const parseJsonArray = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const normalizeUploadUrl = (imageUrl: any) => {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/')) return '';
  return `/uploads/${decodeURIComponent(imageUrl.replace(/^\/uploads\//, '').split('?')[0]).split(path.sep).join('/')}`;
};

const collectUploadFiles = (dir: string, rootDir = dir): any[] => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectUploadFiles(fullPath, rootDir);
    if (!entry.isFile()) return [];

    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
    return [{
      filename: entry.name,
      path: relativePath,
      url: `/uploads/${relativePath}`,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString()
    }];
  });
};

const addImageReference = (
  refs: Map<string, any[]>,
  imageUrl: any,
  reference: { type: string; id: number | string; title: string; field: string }
) => {
  const normalizedUrl = normalizeUploadUrl(imageUrl);
  if (!normalizedUrl) return;
  const current = refs.get(normalizedUrl) || [];
  current.push(reference);
  refs.set(normalizedUrl, current);
};

const collectImageReferences = () => {
  const refs = new Map<string, any[]>();
  const entityTables = [
    { table: 'bands', type: 'Band', titleField: 'name_zh' },
    { table: 'venues', type: 'Venue', titleField: 'name_zh' },
    { table: 'rehearsal_rooms', type: 'Rehearsal Room', titleField: 'name_zh' },
    { table: 'spots', type: 'Spot', titleField: 'name_zh' }
  ];

  entityTables.forEach(({ table, type, titleField }) => {
    const rows = db.prepare(`SELECT id, ${titleField} AS title, name, image_url FROM ${table}`).all() as any[];
    rows.forEach(row => {
      addImageReference(refs, row.image_url, {
        type,
        id: row.id,
        title: row.title || row.name || `${type} #${row.id}`,
        field: 'image_url'
      });
    });
  });

  const events = db.prepare('SELECT id, title, image_url, qr_codes, stops FROM featured_events').all() as any[];
  events.forEach(event => {
    addImageReference(refs, event.image_url, {
      type: 'Event',
      id: event.id,
      title: event.title || `Event #${event.id}`,
      field: 'image_url'
    });

    parseJsonArray(event.qr_codes).forEach((qrCode: any, index: number) => {
      addImageReference(refs, qrCode?.image_url || qrCode?.imageUrl, {
        type: 'Event QR',
        id: event.id,
        title: `${event.title || `Event #${event.id}`} · ${qrCode?.title || `QR ${index + 1}`}`,
        field: `qr_codes[${index}].image_url`
      });
    });

    parseJsonArray(event.stops).forEach((stop: any, stopIndex: number) => {
      parseJsonArray(stop?.recap_photos || stop?.recapPhotos).forEach((photo: any, photoIndex: number) => {
        addImageReference(refs, photo?.image_url || photo?.imageUrl, {
          type: 'Event Recap',
          id: event.id,
          title: `${event.title || `Event #${event.id}`} · ${stop?.label || `Stop ${stopIndex + 1}`} · ${photo?.title || `Photo ${photoIndex + 1}`}`,
          field: `stops[${stopIndex}].recap_photos[${photoIndex}].image_url`
        });
      });
    });
  });

  return refs;
};

const populateEvent = (event: any) => {
  if (!event) return null;

  const parsedLineup = parseJsonArray(event.lineup);
  const lineup = parsedLineup.map((dayObj: any) => {
    const bandIds = dayObj.bandIds || [];
    const bands = bandIds.map((id: string) => {
      const b = db.prepare('SELECT * FROM bands WHERE band_id = ?').get(id) as any;
      return toBandCard(b);
    }).filter(Boolean);
    return { ...dayObj, bandIds, bands };
  });

  const stops = parseJsonArray(event.stops).map((stop: any) => {
    const venueId = stop.venue_id;
    const v = venueId ? db.prepare('SELECT * FROM venues WHERE venue_id = ?').get(venueId) as any : null;
    const guestBandIds = Array.isArray(stop.guestBandIds) ? stop.guestBandIds : [];
    const guestBands = guestBandIds.map((id: string) => {
      const b = db.prepare('SELECT * FROM bands WHERE band_id = ?').get(id) as any;
      return toBandCard(b);
    }).filter(Boolean);
    return {
      ...stop,
      venue_id: venueId || '',
      guestBandIds,
      guestBands,
      venue: toVenueCard(v)
    };
  });

  return {
    ...event,
    lineup,
    stops,
    qr_codes: parseJsonArray(event.qr_codes)
  };
};

const validateEventReferences = (lineup: any, stops: any) => {
  const parsedLineup = Array.isArray(lineup) ? lineup : [];
  const parsedStops = Array.isArray(stops) ? stops : [];

  for (const day of parsedLineup) {
    const bandIds = Array.isArray(day.bandIds) ? day.bandIds : [];
    for (const bandId of bandIds) {
      const band = db.prepare('SELECT id FROM bands WHERE band_id = ?').get(bandId);
      if (!band) {
        throw new Error(`Unknown band_id: ${bandId}`);
      }
    }
  }

  for (const stop of parsedStops) {
    if (!stop.venue_id) {
      throw new Error(`Missing venue_id for stop: ${stop.label || 'Unnamed stop'}`);
    }
    const venue = db.prepare('SELECT id FROM venues WHERE venue_id = ?').get(stop.venue_id);
    if (!venue) {
      throw new Error(`Unknown venue_id: ${stop.venue_id}`);
    }

    const guestBandIds = Array.isArray(stop.guestBandIds) ? stop.guestBandIds : [];
    for (const bandId of guestBandIds) {
      const band = db.prepare('SELECT id FROM bands WHERE band_id = ?').get(bandId);
      if (!band) {
        throw new Error(`Unknown guest band_id: ${bandId}`);
      }
    }
  }
};

// API Routes
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (isValid) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Helper to delete local image
const deleteLocalImage = (imageUrl: string) => {
  if (imageUrl && imageUrl.startsWith('/uploads/')) {
    const relativePath = decodeURIComponent(imageUrl.replace(/^\/uploads\//, '').split('?')[0]);
    const filepath = path.join(uploadsDir, relativePath);
    // Basic security check to prevent directory traversal
    if (filepath.startsWith(uploadsDir) && fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath);
      } catch (err) {
        console.error('Failed to delete image file:', err);
      }
    }
  }
};

// Image Upload API
app.post('/api/upload', authenticateToken, (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 1MB limit' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(400).json({ error: err.message });
    }

    // Everything went fine.
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the URL to the uploaded file
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });
});

const handleUploadError = (err: any, res: express.Response) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 1MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  return null;
};

const handleEventUpload = (req: express.Request, res: express.Response) => {
  eventUpload.single('image')(req, res, function (err) {
    const handled = handleUploadError(err, res);
    if (handled) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${path.relative(uploadsDir, req.file.path).split(path.sep).join('/')}`;
    res.json({ url: fileUrl });
  });
};

app.post('/api/events/:slug/upload/:category', authenticateToken, handleEventUpload);
app.post('/api/events/:slug/upload/:category/:stopId', authenticateToken, handleEventUpload);

app.get('/api/admin/assets', authenticateToken, (req, res) => {
  try {
    const references = collectImageReferences();
    const assets = collectUploadFiles(uploadsDir)
      .map(asset => {
        const refs = references.get(asset.url) || [];
        return {
          ...asset,
          used: refs.length > 0,
          references: refs
        };
      })
      .sort((a, b) => b.size - a.size);

    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
    const unusedAssets = assets.filter(asset => !asset.used);
    const unusedSize = unusedAssets.reduce((sum, asset) => sum + asset.size, 0);

    res.json({
      assets,
      summary: {
        totalCount: assets.length,
        totalSize,
        usedCount: assets.length - unusedAssets.length,
        unusedCount: unusedAssets.length,
        unusedSize
      }
    });
  } catch (err: any) {
    console.error('Failed to inspect assets:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/assets', authenticateToken, (req, res) => {
  const { url } = req.body;
  const normalizedUrl = normalizeUploadUrl(url);

  if (!normalizedUrl) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }

  try {
    const references = collectImageReferences();
    const refs = references.get(normalizedUrl) || [];
    if (refs.length > 0) {
      return res.status(409).json({ error: 'Image is still in use', references: refs });
    }

    const relativePath = normalizedUrl.replace(/^\/uploads\//, '');
    const filepath = path.join(uploadsDir, relativePath);
    if (!filepath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete unused asset:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/upload', authenticateToken, (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('/uploads/')) {
    return res.status(400).json({ error: 'Invalid image URL' });
  }
  try {
    deleteLocalImage(url);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bands API
app.get('/api/bands', (req, res) => {
  const bands = db.prepare('SELECT * FROM bands').all();
  res.json(bands);
});

app.post('/api/bands', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO bands (province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/bands/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url } = req.body;
  try {
    db.prepare(`
      UPDATE bands SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, band_id = ?, name = ?, name_zh = ?, genre = ?, intro = ?, image_url = ?, contact_info = ?, netease_url = ?, xiaohongshu_url = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/bands/:id', authenticateToken, (req, res) => {
  try {
    const band = db.prepare('SELECT image_url FROM bands WHERE id = ?').get(req.params.id) as any;
    if (band && band.image_url) {
      deleteLocalImage(band.image_url);
    }
    db.prepare('DELETE FROM bands WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Venues API
app.get('/api/venues', (req, res) => {
  const venues = db.prepare('SELECT * FROM venues').all();
  res.json(venues);
});

app.post('/api/venues', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, ticket_url } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO venues (province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, ticket_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, ticket_url);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/venues/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, ticket_url } = req.body;
  try {
    db.prepare(`
      UPDATE venues SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, venue_id = ?, name = ?, name_zh = ?, address = ?, capacity = ?, intro = ?, image_url = ?, contact_info = ?, ticket_url = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, ticket_url, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/venues/:id', authenticateToken, (req, res) => {
  try {
    const venue = db.prepare('SELECT image_url FROM venues WHERE id = ?').get(req.params.id) as any;
    if (venue && venue.image_url) {
      deleteLocalImage(venue.image_url);
    }
    db.prepare('DELETE FROM venues WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Featured Events API
app.get('/api/featured_events', (req, res) => {
  const events = db.prepare('SELECT * FROM featured_events ORDER BY id DESC').all();
  res.json(events);
});

app.get('/api/featured_events/active', (req, res) => {
  const event = db.prepare('SELECT * FROM featured_events WHERE is_active = 1 LIMIT 1').get() as any;
  res.json(populateEvent(event));
});

app.get('/api/featured_events/:slugOrId', (req, res) => {
  const { slugOrId } = req.params;
  const event = db.prepare('SELECT * FROM featured_events WHERE slug = ? OR id = ? LIMIT 1').get(slugOrId, slugOrId) as any;
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json(populateEvent(event));
});

app.post('/api/featured_events', authenticateToken, (req, res) => {
  const { slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes } = req.body;
  try {
    validateEventReferences(lineup, stops);
    if (is_active) {
      db.prepare('UPDATE featured_events SET is_active = 0').run();
    }
    const lineupStr = lineup ? JSON.stringify(lineup) : null;
    const stopsStr = stops ? JSON.stringify(stops) : null;
    const qrCodesStr = qr_codes ? JSON.stringify(qr_codes) : null;
    const info = db.prepare(`
      INSERT INTO featured_events (slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug || null, title, date_str, location, address, description, image_url, ticket_url, is_active ? 1 : 0, lineupStr, organizer || '', status || 'on_sale', stopsStr, qrCodesStr);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/featured_events/:id', authenticateToken, (req, res) => {
  const { slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes } = req.body;
  try {
    validateEventReferences(lineup, stops);
    if (is_active) {
      db.prepare('UPDATE featured_events SET is_active = 0').run();
    }
    const lineupStr = lineup ? JSON.stringify(lineup) : null;
    const stopsStr = stops ? JSON.stringify(stops) : null;
    const qrCodesStr = qr_codes ? JSON.stringify(qr_codes) : null;
    db.prepare(`
      UPDATE featured_events SET 
        slug = ?, title = ?, date_str = ?, location = ?, address = ?, description = ?, image_url = ?, ticket_url = ?, is_active = ?, lineup = ?, organizer = ?, status = ?, stops = ?, qr_codes = ?
      WHERE id = ?
    `).run(slug || null, title, date_str, location, address, description, image_url, ticket_url, is_active ? 1 : 0, lineupStr, organizer || '', status || 'on_sale', stopsStr, qrCodesStr, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/featured_events/:id', authenticateToken, (req, res) => {
  try {
    const event = db.prepare('SELECT image_url, qr_codes, stops FROM featured_events WHERE id = ?').get(req.params.id) as any;
    if (event && event.image_url) {
      deleteLocalImage(event.image_url);
    }
    parseJsonArray(event?.qr_codes).forEach((qrCode: any) => {
      if (qrCode?.image_url) deleteLocalImage(qrCode.image_url);
    });
    parseJsonArray(event?.stops).forEach((stop: any) => {
      if (Array.isArray(stop?.recap_photos)) {
        stop.recap_photos.forEach((photo: any) => {
          if (photo?.image_url) deleteLocalImage(photo.image_url);
        });
      }
    });
    db.prepare('DELETE FROM featured_events WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Rehearsal Rooms API
app.get('/api/rehearsal_rooms', (req, res) => {
  const rooms = db.prepare('SELECT * FROM rehearsal_rooms').all();
  res.json(rooms);
});

app.post('/api/rehearsal_rooms', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, room_id, name, name_zh, address, equipment, price_info, intro, image_url, contact_info } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO rehearsal_rooms (province_id, province_zh, city_id, city_zh, room_id, name, name_zh, address, equipment, price_info, intro, image_url, contact_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, room_id, name, name_zh, address, equipment, price_info, intro, image_url, contact_info);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/rehearsal_rooms/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, room_id, name, name_zh, address, equipment, price_info, intro, image_url, contact_info } = req.body;
  try {
    db.prepare(`
      UPDATE rehearsal_rooms SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, room_id = ?, name = ?, name_zh = ?, address = ?, equipment = ?, price_info = ?, intro = ?, image_url = ?, contact_info = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, room_id, name, name_zh, address, equipment, price_info, intro, image_url, contact_info, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/rehearsal_rooms/:id', authenticateToken, (req, res) => {
  try {
    const room = db.prepare('SELECT image_url FROM rehearsal_rooms WHERE id = ?').get(req.params.id) as any;
    if (room && room.image_url) {
      deleteLocalImage(room.image_url);
    }
    db.prepare('DELETE FROM rehearsal_rooms WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Spots API
app.get('/api/spots', (req, res) => {
  const spots = db.prepare('SELECT * FROM spots').all();
  res.json(spots);
});

app.post('/api/spots', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, spot_id, name, name_zh, type, address, business_hours, intro, image_url, contact_info, social_url } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO spots (province_id, province_zh, city_id, city_zh, spot_id, name, name_zh, type, address, business_hours, intro, image_url, contact_info, social_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, spot_id, name, name_zh, type, address, business_hours, intro, image_url, contact_info, social_url);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/spots/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, spot_id, name, name_zh, type, address, business_hours, intro, image_url, contact_info, social_url } = req.body;
  try {
    db.prepare(`
      UPDATE spots SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, spot_id = ?, name = ?, name_zh = ?, type = ?, address = ?, business_hours = ?, intro = ?, image_url = ?, contact_info = ?, social_url = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, spot_id, name, name_zh, type, address, business_hours, intro, image_url, contact_info, social_url, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/spots/:id', authenticateToken, (req, res) => {
  try {
    const spot = db.prepare('SELECT image_url FROM spots WHERE id = ?').get(req.params.id) as any;
    if (spot && spot.image_url) {
      deleteLocalImage(spot.image_url);
    }
    db.prepare('DELETE FROM spots WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

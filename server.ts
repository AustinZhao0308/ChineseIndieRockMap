import express from 'express';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { createPublicKey } from 'crypto';

dotenv.config();

const app = express();
const PORT = 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_ADMIN_PASSWORD_HASH = '$2b$10$xVBmUPJph0jgqqkqnLIt8e.4EhwN4NYUj1wqEazquAsPWtEazLvDO';
const DEFAULT_JWT_SECRET = 'super_secret_jwt_key_for_indie_rock_map';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Catbeer Admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? '' : DEFAULT_JWT_SECRET);
const USER_JWT_SECRET = process.env.USER_JWT_SECRET || (IS_PRODUCTION ? '' : JWT_SECRET);
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';

const productionConfigurationErrors = () => {
  if (!IS_PRODUCTION) return [];

  const errors: string[] = [];
  if (!JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET || JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be a unique production secret of at least 32 characters.');
  }
  if (!USER_JWT_SECRET || USER_JWT_SECRET === JWT_SECRET || USER_JWT_SECRET.length < 32) {
    errors.push('USER_JWT_SECRET must be a separate production secret of at least 32 characters.');
  }
  if (!APPLE_CLIENT_ID) errors.push('APPLE_CLIENT_ID is required for Sign in with Apple.');
  if (ADMIN_PASSWORD_HASH === DEFAULT_ADMIN_PASSWORD_HASH) {
    errors.push('ADMIN_PASSWORD_HASH must not use the development fallback hash.');
  }
  return errors;
};

const productionErrors = productionConfigurationErrors();
if (productionErrors.length) {
  throw new Error(`Invalid production configuration:\n- ${productionErrors.join('\n- ')}`);
}

type RateLimitEntry = { count: number; resetAt: number };
const rateLimit = (maxRequests: number, windowMs: number): express.RequestHandler => {
  const requests = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const existing = requests.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    entry.count += 1;
    requests.set(key, entry);
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
};

const adminLoginRateLimit = rateLimit(10, 10 * 60 * 1000);
const appLoginRateLimit = rateLimit(10, 10 * 60 * 1000);
const authenticatedMutationRateLimit = rateLimit(60, 60 * 1000);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
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
const db = new Database(process.env.DATABASE_PATH || 'bands.db');

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
    xiaohongshu_url TEXT,
    label_account_id INTEGER
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
    qr_codes TEXT,
    label_account_id INTEGER
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

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT NOT NULL CHECK(account_type IN ('artist', 'label')),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    logo_url TEXT,
    contact_name TEXT,
    contact_info TEXT,
    linked_entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name TEXT NOT NULL DEFAULT '猫啤乐迷',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'deleted')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auth_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('apple', 'phone')),
    provider_subject TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_subject),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_credentials (
    user_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    username_normalized TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK(content_type IN ('event', 'article', 'note')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    source_name TEXT,
    external_url TEXT,
    featured_event_id INTEGER,
    city_zh TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(featured_event_id) REFERENCES featured_events(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS user_saved_posts (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, post_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS band_cheers (
    user_id INTEGER NOT NULL,
    band_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, band_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(band_id) REFERENCES bands(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS album_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    github_url TEXT NOT NULL,
    site_url TEXT NOT NULL,
    cover_image_url TEXT,
    style_label TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_posts_public_feed ON posts(status, published_at DESC, sort_order DESC);
  CREATE INDEX IF NOT EXISTS idx_band_cheers_band_id ON band_cheers(band_id);
  CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_id ON user_saved_posts(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_album_players_public ON album_players(status, sort_order DESC, created_at DESC);
`);

// Add columns to existing tables if they don't exist (migration)
try { db.exec('ALTER TABLE bands ADD COLUMN contact_info TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE bands ADD COLUMN netease_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE bands ADD COLUMN xiaohongshu_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE bands ADD COLUMN label_account_id INTEGER;'); } catch (e) {}
try { db.exec('ALTER TABLE venues ADD COLUMN ticket_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN lineup TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN slug TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN organizer TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN status TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN stops TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN qr_codes TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE featured_events ADD COLUMN label_account_id INTEGER;'); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'artist';"); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN username TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN display_name TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN password_hash TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN logo_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN contact_name TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN contact_info TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN linked_entity_id TEXT;'); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active';"); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN notes TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;'); } catch (e) {}
try { db.exec('ALTER TABLE accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;'); } catch (e) {}

db.transaction(() => {
  if (ADMIN_PASSWORD_HASH !== DEFAULT_ADMIN_PASSWORD_HASH) {
    db.prepare(`
      UPDATE admin_users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE password_hash = ?
    `).run(ADMIN_PASSWORD_HASH, DEFAULT_ADMIN_PASSWORD_HASH);
  }
  db.prepare(`
    INSERT OR IGNORE INTO admin_users (username, display_name, password_hash, status, updated_at)
    VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
  `).run(ADMIN_USERNAME, ADMIN_DISPLAY_NAME, ADMIN_PASSWORD_HASH);
})();

const sampleAlbumPlayer = {
  slug: 'mrg32k3a-gameboy',
  title: 'mrg32k3a gameboy',
  artist: 'owen1820939655',
  description: 'A Game Boy inspired album-player website, published from GitHub Pages.',
  githubUrl: 'https://github.com/owen1820939655/mrg32k3a-gameboy',
  siteUrl: 'https://owen1820939655.github.io/mrg32k3a-gameboy/',
  styleLabel: 'Game Boy',
  status: 'published'
};

db.prepare(`
  INSERT OR IGNORE INTO album_players (slug, title, artist, description, github_url, site_url, style_label, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  sampleAlbumPlayer.slug,
  sampleAlbumPlayer.title,
  sampleAlbumPlayer.artist,
  sampleAlbumPlayer.description,
  sampleAlbumPlayer.githubUrl,
  sampleAlbumPlayer.siteUrl,
  sampleAlbumPlayer.styleLabel,
  sampleAlbumPlayer.status
);

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

type AppUserToken = {
  role: 'user';
  userId: number;
  username?: string;
  displayName?: string;
  onboarding?: boolean;
};

const getBearerToken = (req: express.Request) => {
  const value = req.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

const readAppUserToken = (req: express.Request): AppUserToken | null => {
  if (!USER_JWT_SECRET) return null;
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, USER_JWT_SECRET) as AppUserToken;
    return payload.role === 'user' ? payload : null;
  } catch {
    return null;
  }
};

const optionalAppUser = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const user = readAppUserToken(req);
  (req as any).appUser = user && getPublicAppUser(user.userId) ? user : null;
  next();
};

const requireAppUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!USER_JWT_SECRET) {
    return res.status(503).json({ error: 'Catbeer user authentication is not configured.' });
  }
  const user = readAppUserToken(req);
  if (!user || user.onboarding || !getPublicAppUser(user.userId)) {
    return res.status(401).json({ error: 'Catbeer user login required.' });
  }
  (req as any).appUser = user;
  next();
};

const requireOnboardingOrAppUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!USER_JWT_SECRET) {
    return res.status(503).json({ error: 'Catbeer user authentication is not configured.' });
  }
  const user = readAppUserToken(req);
  if (!user || !getPublicAppUser(user.userId)) {
    return res.status(401).json({ error: 'Catbeer user login required.' });
  }
  (req as any).appUser = user;
  next();
};

const normalizeUsername = (value: any) => String(value || '').trim().toLocaleLowerCase('zh-CN');

// User-facing nicknames double as login names. Keep the character set broad enough
// for Chinese names while excluding whitespace and punctuation that complicate login.
const validateUsername = (username: string) => /^[\p{L}\p{N}_-]{2,24}$/u.test(username);

const usernameIsReservedForMapAccount = (username: string) => Boolean(
  db.prepare('SELECT 1 FROM admin_users WHERE lower(username) = ? LIMIT 1').get(username) ||
  db.prepare('SELECT 1 FROM accounts WHERE lower(username) = ? LIMIT 1').get(username)
);

const getPublicAppUser = (userId: number) => {
  const user = db.prepare(`
    SELECT
      users.id,
      users.display_name,
      users.status,
      password_credentials.username,
      EXISTS(
        SELECT 1 FROM auth_identities
        WHERE auth_identities.user_id = users.id AND auth_identities.provider = 'apple'
      ) AS has_apple_identity
    FROM users
    LEFT JOIN password_credentials ON password_credentials.user_id = users.id
    WHERE users.id = ?
    LIMIT 1
  `).get(userId) as any;

  if (!user || user.status !== 'active') return null;
  return {
    id: user.id,
    displayName: user.display_name,
    username: user.username || null,
    hasAppleIdentity: Boolean(user.has_apple_identity)
  };
};

const issueAppUserToken = (userId: number, onboarding = false) => {
  if (!USER_JWT_SECRET) throw new Error('Catbeer user authentication is not configured.');
  const user = getPublicAppUser(userId);
  if (!user) throw new Error('User account is unavailable.');
  const payload: AppUserToken = {
    role: 'user',
    userId,
    displayName: user.displayName,
    username: user.username || undefined,
    onboarding
  };
  return jwt.sign(payload, USER_JWT_SECRET, { expiresIn: onboarding ? '15m' : '30d' });
};

let appleJWKS: any[] | null = null;
let appleJWKSExpiresAt = 0;

const getAppleKey = async (keyId: string) => {
  if (!appleJWKS || Date.now() >= appleJWKSExpiresAt) {
    const response = await fetch('https://appleid.apple.com/auth/keys');
    if (!response.ok) throw new Error('Unable to retrieve Apple signing keys.');
    const payload = await response.json() as { keys?: any[] };
    appleJWKS = payload.keys || [];
    appleJWKSExpiresAt = Date.now() + 60 * 60 * 1000;
  }
  const key = appleJWKS.find((item) => item.kid === keyId);
  if (!key) throw new Error('Apple signing key is unavailable.');
  return createPublicKey({ key, format: 'jwk' });
};

const verifyAppleIdentityToken = async (identityToken: string) => {
  if (!APPLE_CLIENT_ID) {
    throw new Error('Sign in with Apple is not configured on this server.');
  }
  const [headerPart] = identityToken.split('.');
  if (!headerPart) throw new Error('Invalid Apple identity token.');
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { kid?: string };
  if (!header.kid) throw new Error('Apple identity token has no signing key.');
  const key = await getAppleKey(header.kid);
  return jwt.verify(identityToken, key, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: APPLE_CLIENT_ID
  }) as jwt.JwtPayload;
};

const publicUserFromToken = (user: any) => ({
  role: user?.role,
  username: user?.username,
  displayName: user?.displayName,
  accountId: user?.accountId,
  accountType: user?.accountType,
  logoUrl: user?.logoUrl
});

const getCurrentPublicUser = (user: any) => {
  if (user?.role === 'admin') {
    return publicUserFromToken(user);
  }

  if (user?.accountId) {
    const account = db.prepare(`
      SELECT id, account_type, username, display_name, logo_url, status
      FROM accounts
      WHERE id = ?
      LIMIT 1
    `).get(user.accountId) as any;

    if (account) {
      return {
        role: account.account_type === 'label' ? 'label' : 'artist',
        accountId: account.id,
        accountType: account.account_type,
        username: account.username,
        displayName: account.display_name,
        logoUrl: account.logo_url,
        status: account.status
      };
    }
  }

  return publicUserFromToken(user);
};

const isAdminRequest = (req: express.Request) => (req as any).user?.role === 'admin';
const isLabelRequest = (req: express.Request) => (req as any).user?.role === 'label';

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Admin permission required.' });
  }
  next();
};

const normalizeDisplayCity = (cityZh: string) => {
  return cityZh ? cityZh.replace(/(省|市|维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|地区|盟)$/, '') : '';
};

const toLabelSummary = (label: any) => {
  if (!label) return null;
  return {
    id: label.id,
    display_name: label.display_name,
    username: label.username,
    logo_url: label.logo_url,
    status: label.status
  };
};

const getLabelAccount = (labelAccountId: any) => {
  if (!labelAccountId) return null;
  return db.prepare("SELECT id, display_name, username, logo_url, status FROM accounts WHERE id = ? AND account_type = 'label'").get(labelAccountId) as any;
};

const normalizeOptionalLabelAccountId = (value: any) => {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid label account.');
  }
  const label = getLabelAccount(id);
  if (!label) {
    throw new Error('Unknown label account.');
  }
  return id;
};

const normalizeScopedLabelAccountId = (req: express.Request, value: any) => {
  if (isAdminRequest(req)) return normalizeOptionalLabelAccountId(value);
  if (isLabelRequest(req)) {
    const accountId = Number((req as any).user.accountId);
    const requestedId = value === undefined || value === null || value === '' ? accountId : Number(value);
    if (requestedId !== accountId) {
      throw new Error('Label accounts can only manage their own label data.');
    }
    return accountId;
  }
  throw new Error('Label or admin permission required.');
};

const ensureLabelResourceAccess = (req: express.Request, table: 'bands' | 'featured_events', id: any) => {
  if (isAdminRequest(req)) return;
  if (!isLabelRequest(req)) {
    throw new Error('Label or admin permission required.');
  }

  const accountId = Number((req as any).user.accountId);
  const row = db.prepare(`SELECT label_account_id FROM ${table} WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new Error('Resource not found.');
  }
  if (Number(row.label_account_id) !== accountId) {
    throw new Error('You can only edit content owned by your label.');
  }
};

const toBandCard = (b: any) => {
  if (!b) return null;
  const label = getLabelAccount(b.label_account_id);
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
    labelAccountId: b.label_account_id,
    label: toLabelSummary(label),
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

  const accounts = db.prepare('SELECT id, display_name AS title, username, logo_url FROM accounts').all() as any[];
  accounts.forEach(account => {
    addImageReference(refs, account.logo_url, {
      type: 'Account Logo',
      id: account.id,
      title: account.title || account.username || `Account #${account.id}`,
      field: 'logo_url'
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

  const albumPlayers = db.prepare('SELECT id, title, cover_image_url FROM album_players').all() as any[];
  albumPlayers.forEach(player => {
    addImageReference(refs, player.cover_image_url, {
      type: 'Album Player',
      id: player.id,
      title: player.title || `Album Player #${player.id}`,
      field: 'cover_image_url'
    });
  });

  return refs;
};

const populateEvent = (event: any) => {
  if (!event) return null;
  const label = getLabelAccount(event.label_account_id);

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
    label: toLabelSummary(label),
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

const toPublicAccount = (account: any) => {
  return {
    id: account.id,
    account_type: account.account_type,
    username: account.username,
    display_name: account.display_name,
    logo_url: account.logo_url,
    contact_name: account.contact_name,
    contact_info: account.contact_info,
    linked_entity_id: account.linked_entity_id,
    status: account.status,
    notes: account.notes,
    created_at: account.created_at,
    updated_at: account.updated_at
  };
};

const normalizeAccountType = (value: any) => {
  return value === 'label' ? 'label' : 'artist';
};

// API Routes
app.post('/api/login', adminLoginRateLimit, async (req, res) => {
  const { username, password } = req.body;
  const normalizedUsername = String(username || '').trim();

  if (!password?.trim()) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const adminUser = normalizedUsername
    ? db.prepare('SELECT * FROM admin_users WHERE username = ? AND status = ?').get(normalizedUsername, 'active') as any
    : null;

  if (adminUser && await bcrypt.compare(password, adminUser.password_hash)) {
    const user = {
      role: 'admin',
      username: adminUser.username,
      displayName: adminUser.display_name
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user });
  }

  const account = normalizedUsername
    ? db.prepare('SELECT * FROM accounts WHERE username = ? AND status = ?').get(normalizedUsername, 'active') as any
    : null;

  if (account && await bcrypt.compare(password, account.password_hash)) {
    const role = account.account_type === 'label' ? 'label' : 'artist';
    const user = {
      role,
      accountId: account.id,
      accountType: account.account_type,
      username: account.username,
      displayName: account.display_name,
      logoUrl: account.logo_url
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user });
  }

  // Backward compatibility for the previous password-only admin login.
  if (!normalizedUsername && await bcrypt.compare(password, ADMIN_PASSWORD_HASH)) {
    const user = {
      role: 'admin',
      username: ADMIN_USERNAME,
      displayName: ADMIN_DISPLAY_NAME
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user });
  }

  res.status(401).json({ error: 'Invalid username or password.' });
});

app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ user: getCurrentPublicUser((req as any).user) });
});

const normalizePostTags = (value: any) => {
  const source = Array.isArray(value) ? value : parseJsonArray(value);
  return Array.from(new Set(source
    .map((tag: any) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 8)));
};

const toPublicPost = (post: any, includeEvent = true) => {
  const tags = normalizePostTags(post.tags_json);
  const result: any = {
    id: post.id,
    slug: post.slug,
    contentType: post.content_type,
    title: post.title,
    summary: post.summary,
    body: post.body,
    coverImageURL: post.cover_image_url,
    sourceName: post.source_name,
    externalURL: post.external_url,
    city: post.city_zh,
    tags,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    viewerHasSaved: Boolean(post.viewer_has_saved)
  };

  if (includeEvent && post.featured_event_id) {
    const event = db.prepare('SELECT * FROM featured_events WHERE id = ?').get(post.featured_event_id) as any;
    result.event = populateEvent(event);
  }

  return result;
};

const readPostPayload = (body: any) => {
  const contentType = ['event', 'article', 'note'].includes(body.contentType) ? body.contentType : 'note';
  const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft';
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required.');

  const rawSlug = String(body.slug || '').trim();
  const slug = sanitizePathSegment(rawSlug || title, 'post');
  const featuredEventId = body.featuredEventId ? Number(body.featuredEventId) : null;
  if (featuredEventId && !db.prepare('SELECT id FROM featured_events WHERE id = ?').get(featuredEventId)) {
    throw new Error('Linked event does not exist.');
  }

  return {
    slug,
    contentType,
    status,
    title,
    summary: String(body.summary || '').trim(),
    body: String(body.body || '').trim(),
    coverImageURL: String(body.coverImageURL || '').trim() || null,
    sourceName: String(body.sourceName || '').trim() || null,
    externalURL: String(body.externalURL || '').trim() || null,
    featuredEventId,
    city: String(body.city || '').trim() || null,
    tagsJSON: JSON.stringify(normalizePostTags(body.tags)),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    publishedAt: body.publishedAt ? String(body.publishedAt) : null
  };
};

app.post('/api/auth/apple', appLoginRateLimit, async (req, res) => {
  if (!USER_JWT_SECRET) {
    return res.status(503).json({ error: 'Catbeer user authentication is not configured.' });
  }
  try {
    const identityToken = String(req.body?.identityToken || '');
    if (!identityToken) return res.status(400).json({ error: 'Apple identity token is required.' });

    const claims = await verifyAppleIdentityToken(identityToken);
    const appleSubject = String(claims.sub || '');
    if (!appleSubject) return res.status(400).json({ error: 'Apple identity token has no user subject.' });

    const existingIdentity = db.prepare(`
      SELECT user_id FROM auth_identities
      WHERE provider = 'apple' AND provider_subject = ?
      LIMIT 1
    `).get(appleSubject) as any;

    let userId = existingIdentity?.user_id as number | undefined;
    if (!userId) {
      const firstName = String(req.body?.givenName || '').trim();
      const familyName = String(req.body?.familyName || '').trim();
      const displayName = [familyName, firstName].filter(Boolean).join('') || '猫啤乐迷';
      const result = db.transaction(() => {
        const user = db.prepare(`
          INSERT INTO users (display_name, updated_at)
          VALUES (?, CURRENT_TIMESTAMP)
        `).run(displayName);
        db.prepare(`
          INSERT INTO auth_identities (user_id, provider, provider_subject, email, updated_at)
          VALUES (?, 'apple', ?, ?, CURRENT_TIMESTAMP)
        `).run(user.lastInsertRowid, appleSubject, claims.email ? String(claims.email) : null);
        return Number(user.lastInsertRowid);
      })();
      userId = result;
    }

    const hasCredentials = Boolean(db.prepare('SELECT 1 FROM password_credentials WHERE user_id = ?').get(userId));
    const token = issueAppUserToken(userId, !hasCredentials);
    res.json({
      token,
      needsCredentials: !hasCredentials,
      user: getPublicAppUser(userId)
    });
  } catch (error: any) {
    console.error('Sign in with Apple failed:', error.message);
    res.status(401).json({ error: error.message || 'Unable to sign in with Apple.' });
  }
});

app.post('/api/auth/credentials', appLoginRateLimit, requireOnboardingOrAppUser, async (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim();

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Nickname must be 2-24 characters and use letters, numbers, underscores, or hyphens.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (db.prepare('SELECT 1 FROM password_credentials WHERE user_id = ?').get(appUser.userId)) {
    return res.status(409).json({ error: 'This account already has web credentials.' });
  }

  try {
    if (usernameIsReservedForMapAccount(username)) {
      return res.status(409).json({ error: 'This nickname is already in use.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    db.transaction(() => {
      db.prepare(`
        INSERT INTO password_credentials (user_id, username, username_normalized, password_hash, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(appUser.userId, username, username, passwordHash);
      if (displayName) {
        db.prepare('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(displayName, appUser.userId);
      }
    })();
    const token = issueAppUserToken(appUser.userId);
    res.status(201).json({ token, needsCredentials: false, user: getPublicAppUser(appUser.userId) });
  } catch (error: any) {
    const message = error?.code?.startsWith('SQLITE_CONSTRAINT')
      ? 'This username is already in use.'
      : error.message || 'Unable to save credentials.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/auth/password/register', appLoginRateLimit, async (req, res) => {
  if (!USER_JWT_SECRET) {
    return res.status(503).json({ error: 'Catbeer user authentication is not configured.' });
  }

  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Nickname must be 2-24 characters and use letters, numbers, underscores, or hyphens.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (usernameIsReservedForMapAccount(username)) {
    return res.status(409).json({ error: 'This nickname is already in use.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = db.transaction(() => {
      const user = db.prepare(`
        INSERT INTO users (display_name, updated_at)
        VALUES (?, CURRENT_TIMESTAMP)
      `).run(username);
      db.prepare(`
        INSERT INTO password_credentials (user_id, username, username_normalized, password_hash, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(user.lastInsertRowid, username, username, passwordHash);
      return Number(user.lastInsertRowid);
    })();
    res.status(201).json({ token: issueAppUserToken(userId), needsCredentials: false, user: getPublicAppUser(userId) });
  } catch (error: any) {
    const message = error?.code?.startsWith('SQLITE_CONSTRAINT')
      ? 'This nickname is already in use.'
      : error.message || 'Unable to create account.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/auth/password/login', appLoginRateLimit, async (req, res) => {
  if (!USER_JWT_SECRET) {
    return res.status(503).json({ error: 'Catbeer user authentication is not configured.' });
  }
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const credential = db.prepare(`
    SELECT password_credentials.password_hash, users.id AS user_id
    FROM password_credentials
    JOIN users ON users.id = password_credentials.user_id
    WHERE password_credentials.username_normalized = ? AND users.status = 'active'
    LIMIT 1
  `).get(username) as any;

  if (!credential || !(await bcrypt.compare(password, credential.password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  res.json({ token: issueAppUserToken(credential.user_id), needsCredentials: false, user: getPublicAppUser(credential.user_id) });
});

app.post('/api/auth/password/change', authenticatedMutationRateLimit, requireAppUser, async (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const credential = db.prepare('SELECT password_hash FROM password_credentials WHERE user_id = ?').get(appUser.userId) as any;
  if (!credential || !(await bcrypt.compare(currentPassword, credential.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE password_credentials SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(hash, appUser.userId);
  res.json({ success: true });
});

app.get('/api/account/me', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  res.json({ user: getPublicAppUser(appUser.userId) });
});

app.post('/api/auth/apple/bind', authenticatedMutationRateLimit, requireAppUser, async (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  try {
    const identityToken = String(req.body?.identityToken || '');
    if (!identityToken) return res.status(400).json({ error: 'Apple identity token is required.' });

    const claims = await verifyAppleIdentityToken(identityToken);
    const appleSubject = String(claims.sub || '');
    if (!appleSubject) return res.status(400).json({ error: 'Apple identity token has no user subject.' });

    const existing = db.prepare(`
      SELECT user_id FROM auth_identities
      WHERE provider = 'apple' AND provider_subject = ?
      LIMIT 1
    `).get(appleSubject) as any;
    if (existing && existing.user_id !== appUser.userId) {
      return res.status(409).json({ error: 'This Apple account is already linked to another Catbeer account.' });
    }
    if (!existing) {
      db.prepare(`
        INSERT INTO auth_identities (user_id, provider, provider_subject, email, updated_at)
        VALUES (?, 'apple', ?, ?, CURRENT_TIMESTAMP)
      `).run(appUser.userId, appleSubject, claims.email ? String(claims.email) : null);
    }
    res.json({ user: getPublicAppUser(appUser.userId) });
  } catch (error: any) {
    console.error('Apple account binding failed:', error.message);
    res.status(401).json({ error: error.message || 'Unable to bind Apple account.' });
  }
});

app.delete('/api/account', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  db.transaction(() => {
    db.prepare('DELETE FROM user_saved_posts WHERE user_id = ?').run(appUser.userId);
    db.prepare('DELETE FROM band_cheers WHERE user_id = ?').run(appUser.userId);
    db.prepare('DELETE FROM password_credentials WHERE user_id = ?').run(appUser.userId);
    db.prepare('DELETE FROM auth_identities WHERE user_id = ?').run(appUser.userId);
    db.prepare("UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(appUser.userId);
  })();
  res.json({ success: true });
});

app.get('/api/feed', optionalAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken | null;
  const contentType = ['event', 'article', 'note'].includes(String(req.query.type || '')) ? String(req.query.type) : null;
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
  const posts = db.prepare(`
    SELECT posts.*, EXISTS(
      SELECT 1 FROM user_saved_posts
      WHERE user_saved_posts.user_id = ? AND user_saved_posts.post_id = posts.id
    ) AS viewer_has_saved
    FROM posts
    WHERE posts.status = 'published'
      AND (posts.published_at IS NULL OR datetime(posts.published_at) <= CURRENT_TIMESTAMP)
      AND (? IS NULL OR posts.content_type = ?)
    ORDER BY posts.sort_order DESC, posts.published_at DESC, posts.id DESC
    LIMIT ?
  `).all(appUser?.userId || -1, contentType, contentType, limit) as any[];
  res.json({ posts: posts.map(post => toPublicPost(post)) });
});

app.get('/api/posts/:slugOrId', optionalAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken | null;
  const post = db.prepare(`
    SELECT posts.*, EXISTS(
      SELECT 1 FROM user_saved_posts
      WHERE user_saved_posts.user_id = ? AND user_saved_posts.post_id = posts.id
    ) AS viewer_has_saved
    FROM posts
    WHERE posts.status = 'published'
      AND (posts.published_at IS NULL OR datetime(posts.published_at) <= CURRENT_TIMESTAMP)
      AND (posts.slug = ? OR posts.id = ?)
    LIMIT 1
  `).get(appUser?.userId || -1, req.params.slugOrId, req.params.slugOrId) as any;
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json({ post: toPublicPost(post) });
});

app.get('/api/account/bookmarks', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const posts = db.prepare(`
    SELECT posts.*, 1 AS viewer_has_saved
    FROM user_saved_posts
    JOIN posts ON posts.id = user_saved_posts.post_id
    WHERE user_saved_posts.user_id = ? AND posts.status = 'published'
    ORDER BY user_saved_posts.created_at DESC
  `).all(appUser.userId) as any[];
  res.json({ posts: posts.map(post => toPublicPost(post)) });
});

app.post('/api/account/bookmarks/:postId', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const post = db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(req.params.postId) as any;
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  db.prepare('INSERT OR IGNORE INTO user_saved_posts (user_id, post_id) VALUES (?, ?)').run(appUser.userId, post.id);
  res.status(201).json({ saved: true });
});

app.delete('/api/account/bookmarks/:postId', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  db.prepare('DELETE FROM user_saved_posts WHERE user_id = ? AND post_id = ?').run(appUser.userId, req.params.postId);
  res.json({ saved: false });
});

app.get('/api/account/cheers', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const bands = db.prepare(`
    SELECT bands.id, bands.band_id, bands.name, bands.name_zh, bands.city_zh, bands.image_url,
      COUNT(all_cheers.user_id) AS cheer_count
    FROM band_cheers AS viewer_cheers
    JOIN bands ON bands.id = viewer_cheers.band_id
    LEFT JOIN band_cheers AS all_cheers ON all_cheers.band_id = bands.id
    WHERE viewer_cheers.user_id = ?
    GROUP BY bands.id
    ORDER BY viewer_cheers.created_at DESC, bands.id ASC
  `).all(appUser.userId) as any[];
  res.json({
    bands: bands.map(band => ({
      id: band.id,
      bandID: band.band_id,
      name: band.name,
      nameZh: band.name_zh,
      cityZh: band.city_zh,
      imageURL: band.image_url,
      cheerCount: Number(band.cheer_count || 0)
    }))
  });
});

app.get('/api/admin/posts', authenticateToken, requireAdmin, (_req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY updated_at DESC, id DESC').all() as any[];
  res.json({ posts: posts.map(post => ({ ...toPublicPost(post, false), status: post.status, sortOrder: post.sort_order, featuredEventId: post.featured_event_id })) });
});

app.get('/api/admin/posts/:id', authenticateToken, requireAdmin, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json({ post: { ...toPublicPost(post, false), status: post.status, sortOrder: post.sort_order, featuredEventId: post.featured_event_id } });
});

app.post('/api/admin/posts', authenticateToken, requireAdmin, (req, res) => {
  try {
    const post = readPostPayload(req.body);
    const publishedAt = post.status === 'published' ? (post.publishedAt || new Date().toISOString()) : post.publishedAt;
    const result = db.prepare(`
      INSERT INTO posts (slug, content_type, status, title, summary, body, cover_image_url, source_name, external_url, featured_event_id, city_zh, tags_json, sort_order, published_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(post.slug, post.contentType, post.status, post.title, post.summary, post.body, post.coverImageURL, post.sourceName, post.externalURL, post.featuredEventId, post.city, post.tagsJSON, post.sortOrder, publishedAt);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to create post.' });
  }
});

app.put('/api/admin/posts/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const post = readPostPayload(req.body);
    const existing = db.prepare('SELECT id, published_at FROM posts WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Post not found.' });
    const publishedAt = post.status === 'published' ? (post.publishedAt || existing.published_at || new Date().toISOString()) : post.publishedAt;
    db.prepare(`
      UPDATE posts SET slug = ?, content_type = ?, status = ?, title = ?, summary = ?, body = ?, cover_image_url = ?, source_name = ?, external_url = ?, featured_event_id = ?, city_zh = ?, tags_json = ?, sort_order = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(post.slug, post.contentType, post.status, post.title, post.summary, post.body, post.coverImageURL, post.sourceName, post.externalURL, post.featuredEventId, post.city, post.tagsJSON, post.sortOrder, publishedAt, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Unable to update post.' });
  }
});

app.delete('/api/admin/posts/:id', authenticateToken, requireAdmin, (req, res) => {
  const post = db.prepare('SELECT cover_image_url FROM posts WHERE id = ?').get(req.params.id) as any;
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.cover_image_url) deleteLocalImage(post.cover_image_url);
  db.transaction(() => {
    db.prepare('DELETE FROM user_saved_posts WHERE post_id = ?').run(req.params.id);
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

app.get('/api/labels/:username/archive', (req, res) => {
  try {
    const label = db.prepare(`
      SELECT id, username, display_name, logo_url, status, created_at
      FROM accounts
      WHERE username = ? AND account_type = 'label' AND status = 'active'
      LIMIT 1
    `).get(req.params.username) as any;

    if (!label) {
      return res.status(404).json({ error: 'Label not found' });
    }

    const events = (db.prepare(`
      SELECT *
      FROM featured_events
      WHERE label_account_id = ?
      ORDER BY id DESC
    `).all(label.id) as any[]).map(populateEvent);

    res.json({ label, events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/events/archive', (req, res) => {
  try {
    const events = (db.prepare(`
      SELECT *
      FROM featured_events
      ORDER BY id DESC
    `).all() as any[]).map(populateEvent);

    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/accounts', authenticateToken, requireAdmin, (req, res) => {
  const accounts = db
    .prepare(`
      SELECT id, account_type, username, display_name, logo_url, contact_name, contact_info, linked_entity_id, status, notes, created_at, updated_at
      FROM accounts
      ORDER BY updated_at DESC, id DESC
    `)
    .all()
    .map(toPublicAccount);
  res.json(accounts);
});

app.post('/api/accounts', authenticateToken, requireAdmin, async (req, res) => {
  const {
    account_type,
    username,
    display_name,
    password,
    logo_url,
    contact_name,
    contact_info,
    linked_entity_id,
    status,
    notes
  } = req.body;

  if (!username?.trim() || !display_name?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Username, display name, and initial password are required.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const info = db.prepare(`
      INSERT INTO accounts (account_type, username, display_name, password_hash, logo_url, contact_name, contact_info, linked_entity_id, status, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      normalizeAccountType(account_type),
      username.trim(),
      display_name.trim(),
      passwordHash,
      logo_url || '',
      contact_name || '',
      contact_info || '',
      linked_entity_id || '',
      status || 'active',
      notes || ''
    );
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  const {
    account_type,
    username,
    display_name,
    password,
    logo_url,
    contact_name,
    contact_info,
    linked_entity_id,
    status,
    notes
  } = req.body;

  if (!username?.trim() || !display_name?.trim()) {
    return res.status(400).json({ error: 'Username and display name are required.' });
  }

  try {
    if (password?.trim()) {
      const passwordHash = await bcrypt.hash(password, 10);
      db.prepare(`
        UPDATE accounts SET
          account_type = ?, username = ?, display_name = ?, password_hash = ?, logo_url = ?, contact_name = ?, contact_info = ?, linked_entity_id = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        normalizeAccountType(account_type),
        username.trim(),
        display_name.trim(),
        passwordHash,
        logo_url || '',
        contact_name || '',
        contact_info || '',
        linked_entity_id || '',
        status || 'active',
        notes || '',
        req.params.id
      );
    } else {
      db.prepare(`
        UPDATE accounts SET
          account_type = ?, username = ?, display_name = ?, logo_url = ?, contact_name = ?, contact_info = ?, linked_entity_id = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        normalizeAccountType(account_type),
        username.trim(),
        display_name.trim(),
        logo_url || '',
        contact_name || '',
        contact_info || '',
        linked_entity_id || '',
        status || 'active',
        notes || '',
        req.params.id
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }

  try {
    const user = (req as any).user;
    const table = user.role === 'admin' ? 'admin_users' : 'accounts';
    const row = user.role === 'admin'
      ? db.prepare('SELECT id, password_hash FROM admin_users WHERE username = ?').get(user.username) as any
      : db.prepare('SELECT id, password_hash FROM accounts WHERE id = ?').get(user.accountId) as any;

    if (!row || !await bcrypt.compare(oldPassword, row.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare(`UPDATE ${table} SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(passwordHash, row.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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

app.get('/api/admin/assets', authenticateToken, requireAdmin, (req, res) => {
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

app.delete('/api/admin/assets', authenticateToken, requireAdmin, (req, res) => {
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
app.get('/api/bands', optionalAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken | null;
  const bands = (db.prepare(`
    SELECT bands.*, COUNT(band_cheers.user_id) AS cheer_count,
      EXISTS(
        SELECT 1 FROM band_cheers AS current_user_cheers
        WHERE current_user_cheers.band_id = bands.id AND current_user_cheers.user_id = ?
      ) AS viewer_has_cheered
    FROM bands
    LEFT JOIN band_cheers ON band_cheers.band_id = bands.id
    GROUP BY bands.id
    ORDER BY bands.id ASC
  `).all(appUser?.userId || -1) as any[]).map(band => {
    const label = getLabelAccount(band.label_account_id);
    return {
      ...band,
      labelAccountId: band.label_account_id,
      label: toLabelSummary(label),
      cheerCount: Number(band.cheer_count || 0),
      viewerHasCheered: Boolean(band.viewer_has_cheered)
    };
  });
  res.json(bands);
});

app.post('/api/bands/:id/cheers', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const band = db.prepare('SELECT id FROM bands WHERE id = ?').get(req.params.id) as any;
  if (!band) return res.status(404).json({ error: 'Band not found.' });

  db.prepare('INSERT OR IGNORE INTO band_cheers (user_id, band_id) VALUES (?, ?)').run(appUser.userId, band.id);
  const cheerCount = Number((db.prepare('SELECT COUNT(*) AS count FROM band_cheers WHERE band_id = ?').get(band.id) as any).count);
  res.status(201).json({ cheered: true, cheerCount });
});

app.delete('/api/bands/:id/cheers', requireAppUser, (req, res) => {
  const appUser = (req as any).appUser as AppUserToken;
  const band = db.prepare('SELECT id FROM bands WHERE id = ?').get(req.params.id) as any;
  if (!band) return res.status(404).json({ error: 'Band not found.' });

  db.prepare('DELETE FROM band_cheers WHERE user_id = ? AND band_id = ?').run(appUser.userId, band.id);
  const cheerCount = Number((db.prepare('SELECT COUNT(*) AS count FROM band_cheers WHERE band_id = ?').get(band.id) as any).count);
  res.json({ cheered: false, cheerCount });
});

app.post('/api/bands', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, label_account_id } = req.body;
  try {
    const normalizedLabelAccountId = normalizeScopedLabelAccountId(req, label_account_id);
    const info = db.prepare(`
      INSERT INTO bands (province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, label_account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, normalizedLabelAccountId);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/bands/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, label_account_id } = req.body;
  try {
    ensureLabelResourceAccess(req, 'bands', req.params.id);
    const normalizedLabelAccountId = normalizeScopedLabelAccountId(req, label_account_id);
    db.prepare(`
      UPDATE bands SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, band_id = ?, name = ?, name_zh = ?, genre = ?, intro = ?, image_url = ?, contact_info = ?, netease_url = ?, xiaohongshu_url = ?, label_account_id = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, netease_url, xiaohongshu_url, normalizedLabelAccountId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/bands/:id', authenticateToken, (req, res) => {
  try {
    ensureLabelResourceAccess(req, 'bands', req.params.id);
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

app.post('/api/venues', authenticateToken, requireAdmin, (req, res) => {
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

app.put('/api/venues/:id', authenticateToken, requireAdmin, (req, res) => {
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

app.delete('/api/venues/:id', authenticateToken, requireAdmin, (req, res) => {
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
  const { slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes, label_account_id } = req.body;
  try {
    const normalizedLabelAccountId = normalizeScopedLabelAccountId(req, label_account_id);
    const label = getLabelAccount(normalizedLabelAccountId);
    validateEventReferences(lineup, stops);
    if (is_active && isAdminRequest(req)) {
      db.prepare('UPDATE featured_events SET is_active = 0').run();
    }
    const lineupStr = lineup ? JSON.stringify(lineup) : null;
    const stopsStr = stops ? JSON.stringify(stops) : null;
    const qrCodesStr = qr_codes ? JSON.stringify(qr_codes) : null;
    const info = db.prepare(`
      INSERT INTO featured_events (slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes, label_account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug || null, title, date_str, location, address, description, image_url, ticket_url, is_active && isAdminRequest(req) ? 1 : 0, lineupStr, label?.display_name || organizer || '', status || 'on_sale', stopsStr, qrCodesStr, normalizedLabelAccountId);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/featured_events/:id', authenticateToken, (req, res) => {
  const { slug, title, date_str, location, address, description, image_url, ticket_url, is_active, lineup, organizer, status, stops, qr_codes, label_account_id } = req.body;
  try {
    ensureLabelResourceAccess(req, 'featured_events', req.params.id);
    const normalizedLabelAccountId = normalizeScopedLabelAccountId(req, label_account_id);
    const label = getLabelAccount(normalizedLabelAccountId);
    validateEventReferences(lineup, stops);
    if (is_active && isAdminRequest(req)) {
      db.prepare('UPDATE featured_events SET is_active = 0').run();
    }
    const lineupStr = lineup ? JSON.stringify(lineup) : null;
    const stopsStr = stops ? JSON.stringify(stops) : null;
    const qrCodesStr = qr_codes ? JSON.stringify(qr_codes) : null;
    db.prepare(`
      UPDATE featured_events SET 
        slug = ?, title = ?, date_str = ?, location = ?, address = ?, description = ?, image_url = ?, ticket_url = ?, is_active = ?, lineup = ?, organizer = ?, status = ?, stops = ?, qr_codes = ?, label_account_id = ?
      WHERE id = ?
    `).run(slug || null, title, date_str, location, address, description, image_url, ticket_url, is_active && isAdminRequest(req) ? 1 : 0, lineupStr, label?.display_name || organizer || '', status || 'on_sale', stopsStr, qrCodesStr, normalizedLabelAccountId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/featured_events/:id', authenticateToken, (req, res) => {
  try {
    ensureLabelResourceAccess(req, 'featured_events', req.params.id);
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

const normalizeAlbumPlayerSlug = (value: any) => sanitizePathSegment(value, 'album-player');

const parseHttpUrl = (value: any, fieldName: string) => {
  const text = String(value || '').trim();
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid http(s) URL.`);
  }
};

const normalizeAlbumPlayerPayload = (body: any) => {
  const title = String(body.title || '').trim();
  const githubUrl = parseHttpUrl(body.github_url, 'GitHub URL');
  const siteUrl = parseHttpUrl(body.site_url, 'Player site URL');
  if (!title) throw new Error('Title is required.');
  if (new URL(githubUrl).hostname !== 'github.com') throw new Error('GitHub URL must point to github.com.');
  return {
    slug: normalizeAlbumPlayerSlug(body.slug || title),
    title,
    artist: String(body.artist || '').trim(),
    description: String(body.description || '').trim(),
    githubUrl,
    siteUrl,
    coverImageUrl: String(body.cover_image_url || '').trim() || null,
    styleLabel: String(body.style_label || '').trim(),
    status: ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft',
    sortOrder: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
  };
};

// Album Players API
app.get('/api/album_players', (req, res) => {
  const includeUnpublished = req.headers.authorization
    ? (() => {
        try {
          const token = getBearerToken(req);
          return token ? (jwt.verify(token, JWT_SECRET) as any)?.role === 'admin' : false;
        } catch {
          return false;
        }
      })()
    : false;
  const players = includeUnpublished
    ? db.prepare('SELECT * FROM album_players ORDER BY sort_order DESC, created_at DESC').all()
    : db.prepare(`
        SELECT id, slug, title, artist, description, site_url, cover_image_url, style_label, status, sort_order, created_at, updated_at
        FROM album_players
        WHERE status = 'published'
        ORDER BY sort_order DESC, created_at DESC
      `).all();
  res.json(players);
});

app.get('/api/album_players/:slugOrId', (req, res) => {
  const { slugOrId } = req.params;
  const player = db.prepare(`
    SELECT id, slug, title, artist, description, site_url, cover_image_url, style_label, status, sort_order, created_at, updated_at
    FROM album_players
    WHERE status = 'published' AND (slug = ? OR id = ?)
    LIMIT 1
  `).get(slugOrId, slugOrId);
  if (!player) return res.status(404).json({ error: 'Album player not found' });
  res.json(player);
});

app.post('/api/album_players', authenticateToken, requireAdmin, (req, res) => {
  try {
    const player = normalizeAlbumPlayerPayload(req.body);
    const result = db.prepare(`
      INSERT INTO album_players (slug, title, artist, description, github_url, site_url, cover_image_url, style_label, status, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(player.slug, player.title, player.artist, player.description, player.githubUrl, player.siteUrl, player.coverImageUrl, player.styleLabel, player.status, player.sortOrder);
    res.json({ id: result.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/album_players/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const player = normalizeAlbumPlayerPayload(req.body);
    db.prepare(`
      UPDATE album_players
      SET slug = ?, title = ?, artist = ?, description = ?, github_url = ?, site_url = ?, cover_image_url = ?, style_label = ?, status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(player.slug, player.title, player.artist, player.description, player.githubUrl, player.siteUrl, player.coverImageUrl, player.styleLabel, player.status, player.sortOrder, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/album_players/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM album_players WHERE id = ?').run(req.params.id);
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

app.post('/api/rehearsal_rooms', authenticateToken, requireAdmin, (req, res) => {
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

app.put('/api/rehearsal_rooms/:id', authenticateToken, requireAdmin, (req, res) => {
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

app.delete('/api/rehearsal_rooms/:id', authenticateToken, requireAdmin, (req, res) => {
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

app.post('/api/spots', authenticateToken, requireAdmin, (req, res) => {
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

app.put('/api/spots/:id', authenticateToken, requireAdmin, (req, res) => {
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

app.delete('/api/spots/:id', authenticateToken, requireAdmin, (req, res) => {
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

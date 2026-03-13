import express from 'express';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_indie_rock_map';

app.use(express.json());

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
    contact_info TEXT
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
    contact_info TEXT
  );
`);

// Add contact_info to existing bands table if it doesn't exist (migration)
try {
  db.exec('ALTER TABLE bands ADD COLUMN contact_info TEXT;');
} catch (e) {
  // Column already exists, ignore
}

// Seed initial data if empty
const countBands = db.prepare('SELECT COUNT(*) as count FROM bands').get() as { count: number };
if (countBands.count === 0) {
  console.log('Seeding initial band data...');
  const insert = db.prepare(`
    INSERT INTO bands (province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialData = [
    ['Beijing', '北京市', 'Beijing', '北京市', 'carsick-cars', 'Carsick Cars', 'Carsick Cars', 'Noise Rock / Indie Rock', '成立于2005年的北京，是中国地下摇滚的标志性乐队之一，以其极具破坏性和实验性的噪音吉他音墙闻名。', 'https://picsum.photos/seed/carsick/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'hedgehog', 'Hedgehog', '刺猬', 'Indie Rock / Noise Pop', '2005年成立于北京，由主唱/吉他手子健、鼓手石璐和贝斯手一帆组成。他们的音乐充满了青春的躁动与忧郁。', 'https://picsum.photos/seed/hedgehog/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'new-pants', 'New Pants', '新裤子', 'Synth-pop / Punk', '中国最具现场活力和创造性偶像摇滚乐队。1996年成立，从朋克到新浪潮，始终引领中国独立音乐的潮流。', 'https://picsum.photos/seed/newpants/400/300?grayscale'],
    ['Beijing', '北京市', 'Beijing', '北京市', 'joyside', 'Joyside', 'Joyside', 'Punk Rock / Indie Rock', '2001年成立于北京，是中国最具代表性的朋克乐队之一，以其不羁的台风和浪漫的旋律著称。', 'https://picsum.photos/seed/joyside/400/300?grayscale'],
    ['Hebei', '河北省', 'Shijiazhuang', '石家庄', 'omnipotent-youth-society', 'Omnipotent Youth Society', '万能青年旅店', 'Indie Rock / Folk Rock', '来自石家庄的独立摇滚乐队，以其深沉的歌词、宏大的管乐编配和对时代变迁的深刻洞察而闻名。代表作《杀死那个石家庄人》。', 'https://picsum.photos/seed/oys/400/300?grayscale'],
    ['Hebei', '河北省', 'Shijiazhuang', '石家庄', 'click-15', 'Click#15', 'Click#15', 'Funk / R&B', '虽然主唱Ricky后来在北京发展，但他来自河北石家庄，乐队以极具律动感的Funk音乐在独立乐坛独树一帜。', 'https://picsum.photos/seed/click15/400/300?grayscale'],
    ['Shaanxi', '陕西省', "Xi'an", '西安', 'fazi', 'FAZI', '法兹', 'Post-Punk', '成立于古城西安的后朋克乐队，音乐中充满了西北的粗犷与克制，现场极具爆发力和感染力。', 'https://picsum.photos/seed/fazi/400/300?grayscale'],
    ['Shaanxi', '陕西省', "Xi'an", '西安', 'black-head', 'Black Head', '黑撒', 'Folk Rock / Rap', '用陕西方言演唱的乐队，将西安本土文化与现代摇滚、说唱结合，创造了独特的“陕派音乐”。', 'https://picsum.photos/seed/blackhead/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'soundtoy', 'Soundtoy', '声音玩具', 'Alternative Rock', '成都独立音乐的先驱之一，音乐旋律优美，歌词充满诗意，现场演出极具艺术气息。', 'https://picsum.photos/seed/soundtoy/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'stolen', 'Stolen', '秘密行动', 'Electronic Rock / Post-Punk', '将冷峻的电子乐与摇滚乐融合，现场视觉与听觉的双重冲击力极强，是近年来备受瞩目的乐队。', 'https://picsum.photos/seed/stolen/400/300?grayscale'],
    ['Sichuan', '四川省', 'Chengdu', '成都', 'mosaic', 'Mosaic', '马赛克', 'Indie Pop / Disco', '来自成都的独立流行乐队，音乐充满复古的Disco节拍和浪漫的合成器旋律，现场极具感染力。', 'https://picsum.photos/seed/mosaic/400/300?grayscale'],
    ['Guangdong', '广东省', 'Guangzhou', '广州', 'zhaoze', 'Zhaoze', '沼泽', 'Post-Rock', '中国后摇滚的代表乐队之一，创新性地将古琴融入后摇滚中，创造出独特的“古琴后摇”。', 'https://picsum.photos/seed/zhaoze/400/300?grayscale'],
    ['Guangdong', '广东省', 'Haifeng', '海丰', 'wutiaoren', 'Wutiaoren', '五条人', 'Folk Rock', '来自广东海丰的民谣摇滚乐队，用方言歌唱市井生活，音乐中充满了泥土的气息和对底层人物的关怀。', 'https://picsum.photos/seed/wutiaoren/400/300?grayscale'],
    ['Guangdong', '广东省', 'Lianping', '连平', 'jiulian', 'Jiulian Zhenren', '九连真人', 'Alternative Rock / Folk', '来自广东连平，以客家话演唱，音乐生猛直接，融合了原生态的民间元素与硬朗的摇滚乐。', 'https://picsum.photos/seed/jiulian/400/300?grayscale'],
    ['Hubei', '湖北省', 'Wuhan', '武汉', 'smzb', 'SMZB', '生命之饼', 'Punk Rock', '武汉朋克音乐的奠基者，中国最早的朋克乐队之一，以其直白、有力的音乐表达对社会的关注。', 'https://picsum.photos/seed/smzb/400/300?grayscale'],
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
    if (err) return res.sendStatus(403);
    (req as any).user = user;
    next();
  });
};

// API Routes
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Bands API
app.get('/api/bands', (req, res) => {
  const bands = db.prepare('SELECT * FROM bands').all();
  res.json(bands);
});

app.post('/api/bands', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO bands (province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/bands/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info } = req.body;
  try {
    db.prepare(`
      UPDATE bands SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, band_id = ?, name = ?, name_zh = ?, genre = ?, intro = ?, image_url = ?, contact_info = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, band_id, name, name_zh, genre, intro, image_url, contact_info, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/bands/:id', authenticateToken, (req, res) => {
  try {
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
  const { province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO venues (province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/venues/:id', authenticateToken, (req, res) => {
  const { province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info } = req.body;
  try {
    db.prepare(`
      UPDATE venues SET 
        province_id = ?, province_zh = ?, city_id = ?, city_zh = ?, venue_id = ?, name = ?, name_zh = ?, address = ?, capacity = ?, intro = ?, image_url = ?, contact_info = ?
      WHERE id = ?
    `).run(province_id, province_zh, city_id, city_zh, venue_id, name, name_zh, address, capacity, intro, image_url, contact_info, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/venues/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM venues WHERE id = ?').run(req.params.id);
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

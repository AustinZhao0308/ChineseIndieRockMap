export interface Band {
  id: string;
  name: string;
  name_zh: string;
  genre: string;
  intro: string;
  city: string;
  city_zh: string;
  audioUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
  neteaseUrl?: string;
  xiaohongshuUrl?: string;
  contactInfo?: string;
  dbId?: number;
}

export interface Venue {
  id: string;
  name: string;
  name_zh: string;
  address: string;
  capacity: number;
  intro: string;
  city: string;
  city_zh: string;
  imageUrl?: string;
  contactInfo?: string;
  ticketUrl?: string;
  dbId?: number;
}

export interface City {
  name: string;
  name_zh: string;
  bands: Band[];
  venues?: Venue[];
}

export interface Province {
  id: string;
  name: string;
  name_zh: string;
  cities: City[];
}

export const provinceData: Record<string, Province> = {
  "北京": {
    id: "Beijing",
    name: "Beijing",
    name_zh: "北京",
    cities: [
      {
        name: "Beijing",
        name_zh: "北京",
        bands: [
          {
            id: "carsick-cars",
            name: "Carsick Cars",
            name_zh: "Carsick Cars",
            genre: "Noise Rock / Indie Rock",
            intro: "成立于2005年的北京，是中国地下摇滚的标志性乐队之一，以其极具破坏性和实验性的噪音吉他音墙闻名。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/carsick/400/300?grayscale"
          },
          {
            id: "hedgehog",
            name: "Hedgehog",
            name_zh: "刺猬",
            genre: "Indie Rock / Noise Pop",
            intro: "2005年成立于北京，由主唱/吉他手子健、鼓手石璐和贝斯手一帆组成。他们的音乐充满了青春的躁动与忧郁。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/hedgehog/400/300?grayscale"
          },
          {
            id: "new-pants",
            name: "New Pants",
            name_zh: "新裤子",
            genre: "Synth-pop / Punk",
            intro: "中国最具现场活力和创造性偶像摇滚乐队。1996年成立，从朋克到新浪潮，始终引领中国独立音乐的潮流。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/newpants/400/300?grayscale"
          },
          {
            id: "joyside",
            name: "Joyside",
            name_zh: "Joyside",
            genre: "Punk Rock / Indie Rock",
            intro: "2001年成立于北京，是中国最具代表性的朋克乐队之一，以其不羁的台风和浪漫的旋律著称。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/joyside/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "school-bar",
            name: "School Bar",
            name_zh: "School酒吧",
            address: "东城区五道营胡同53号院",
            capacity: 200,
            intro: "北京朋克和独立摇滚的圣地，无数年轻乐队从这里起步。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/schoolbar/400/300?grayscale"
          },
          {
            id: "yugong-yishan",
            name: "Yugong Yishan",
            name_zh: "愚公移山",
            address: "东城区张自忠路3-2号段祺瑞执政府旧址西院",
            capacity: 800,
            intro: "曾经北京最具标志性的Livehouse之一，承载了无数乐迷的青春记忆。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/yugongyishan/400/300?grayscale"
          },
          {
            id: "omni-space",
            name: "Omni Space",
            name_zh: "疆进酒·OMNI SPACE",
            address: "西城区天桥南大街9号天桥艺术中心b103",
            capacity: 600,
            intro: "设备精良的现代化Livehouse，是国内外知名乐队巡演的重要一站。",
            city: "Beijing",
            city_zh: "北京",
            imageUrl: "https://picsum.photos/seed/omnispace/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "河北": {
    id: "Hebei",
    name: "Hebei",
    name_zh: "河北",
    cities: [
      {
        name: "Shijiazhuang",
        name_zh: "石家庄",
        bands: [
          {
            id: "omnipotent-youth-society",
            name: "Omnipotent Youth Society",
            name_zh: "万能青年旅店",
            genre: "Indie Rock / Folk Rock",
            intro: "来自石家庄的独立摇滚乐队，以其深沉的歌词、宏大的管乐编配和对时代变迁的深刻洞察而闻名。代表作《杀死那个石家庄人》。",
            city: "Shijiazhuang",
            city_zh: "石家庄",
            imageUrl: "https://picsum.photos/seed/oys/400/300?grayscale"
          },
          {
            id: "click-15",
            name: "Click#15",
            name_zh: "Click#15",
            genre: "Funk / R&B",
            intro: "虽然主唱Ricky后来在北京发展，但他来自河北石家庄，乐队以极具律动感的Funk音乐在独立乐坛独树一帜。",
            city: "Shijiazhuang",
            city_zh: "石家庄",
            imageUrl: "https://picsum.photos/seed/click15/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "hongtang",
            name: "Hong Tang Livehouse",
            name_zh: "红糖Livehouse",
            address: "长安区翟营大街与跃进路交叉口东行100米路北",
            capacity: 400,
            intro: "石家庄重要的独立音乐演出场地，见证了本地摇滚乐的发展。",
            city: "Shijiazhuang",
            city_zh: "石家庄",
            imageUrl: "https://picsum.photos/seed/hongtang/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "陕西": {
    id: "Shaanxi",
    name: "Shaanxi",
    name_zh: "陕西",
    cities: [
      {
        name: "Xi'an",
        name_zh: "西安",
        bands: [
          {
            id: "fazi",
            name: "FAZI",
            name_zh: "法兹",
            genre: "Post-Punk",
            intro: "成立于古城西安的后朋克乐队，音乐中充满了西北的粗犷与克制，现场极具爆发力和感染力。",
            city: "Xi'an",
            city_zh: "西安",
            imageUrl: "https://picsum.photos/seed/fazi/400/300?grayscale"
          },
          {
            id: "black-head",
            name: "Black Head",
            name_zh: "黑撒",
            genre: "Folk Rock / Rap",
            intro: "用陕西方言演唱的乐队，将西安本土文化与现代摇滚、说唱结合，创造了独特的“陕派音乐”。",
            city: "Xi'an",
            city_zh: "西安",
            imageUrl: "https://picsum.photos/seed/blackhead/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "四川": {
    id: "Sichuan",
    name: "Sichuan",
    name_zh: "四川",
    cities: [
      {
        name: "Chengdu",
        name_zh: "成都",
        bands: [
          {
            id: "soundtoy",
            name: "Soundtoy",
            name_zh: "声音玩具",
            genre: "Alternative Rock",
            intro: "成都独立音乐的先驱之一，音乐旋律优美，歌词充满诗意，现场演出极具艺术气息。",
            city: "Chengdu",
            city_zh: "成都",
            imageUrl: "https://picsum.photos/seed/soundtoy/400/300?grayscale"
          },
          {
            id: "stolen",
            name: "Stolen",
            name_zh: "秘密行动",
            genre: "Electronic Rock / Post-Punk",
            intro: "将冷峻的电子乐与摇滚乐融合，现场视觉与听觉的双重冲击力极强，是近年来备受瞩目的乐队。",
            city: "Chengdu",
            city_zh: "成都",
            imageUrl: "https://picsum.photos/seed/stolen/400/300?grayscale"
          },
          {
            id: "mosaic",
            name: "Mosaic",
            name_zh: "马赛克",
            genre: "Indie Pop / Disco",
            intro: "来自成都的独立流行乐队，音乐充满复古的Disco节拍和浪漫的合成器旋律，现场极具感染力。",
            city: "Chengdu",
            city_zh: "成都",
            imageUrl: "https://picsum.photos/seed/mosaic/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "little-bar",
            name: "Little Bar",
            name_zh: "小酒馆 (芳沁店)",
            address: "武侯区芳沁街87号附5号",
            capacity: 300,
            intro: "成都独立音乐的摇篮，赵雷《成都》中唱到的地方，无数乐队的起点。",
            city: "Chengdu",
            city_zh: "成都",
            imageUrl: "https://picsum.photos/seed/littlebar/400/300?grayscale"
          },
          {
            id: "ch8",
            name: "CH8",
            name_zh: "CH8冇独空间",
            address: "成华区完美文创公园",
            capacity: 800,
            intro: "成都新晋的大型Livehouse，拥有极佳的声场和灯光设备。",
            city: "Chengdu",
            city_zh: "成都",
            imageUrl: "https://picsum.photos/seed/ch8/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "广东": {
    id: "Guangdong",
    name: "Guangdong",
    name_zh: "广东",
    cities: [
      {
        name: "Guangzhou",
        name_zh: "广州",
        bands: [
          {
            id: "zhaoze",
            name: "Zhaoze",
            name_zh: "沼泽",
            genre: "Post-Rock",
            intro: "中国后摇滚的代表乐队之一，创新性地将古琴融入后摇滚中，创造出独特的“古琴后摇”。",
            city: "Guangzhou",
            city_zh: "广州",
            imageUrl: "https://picsum.photos/seed/zhaoze/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "tu-space",
            name: "TU Space",
            name_zh: "TU凸空间",
            address: "越秀区广州大道中361-365号东方花苑首层",
            capacity: 600,
            intro: "广州老牌Livehouse，见证了南方独立音乐的繁荣与发展。",
            city: "Guangzhou",
            city_zh: "广州",
            imageUrl: "https://picsum.photos/seed/tuspace/400/300?grayscale"
          },
          {
            id: "mao-livehouse-gz",
            name: "MAO Livehouse",
            name_zh: "MAO Livehouse (广州)",
            address: "海珠区新港东路1088号六元素体验天地一楼",
            capacity: 1000,
            intro: "全国连锁的知名Livehouse品牌，广州店是华南地区重要的演出场地。",
            city: "Guangzhou",
            city_zh: "广州",
            imageUrl: "https://picsum.photos/seed/maogz/400/300?grayscale"
          }
        ]
      },
      {
        name: "Haifeng",
        name_zh: "海丰",
        bands: [
          {
            id: "wutiaoren",
            name: "Wutiaoren",
            name_zh: "五条人",
            genre: "Folk Rock",
            intro: "来自广东海丰的民谣摇滚乐队，用方言歌唱市井生活，音乐中充满了泥土的气息和对底层人物的关怀。",
            city: "Haifeng",
            city_zh: "海丰",
            imageUrl: "https://picsum.photos/seed/wutiaoren/400/300?grayscale"
          }
        ]
      },
      {
        name: "Lianping",
        name_zh: "连平",
        bands: [
          {
            id: "jiulian",
            name: "Jiulian Zhenren",
            name_zh: "九连真人",
            genre: "Alternative Rock / Folk",
            intro: "来自广东连平，以客家话演唱，音乐生猛直接，融合了原生态的民间元素与硬朗的摇滚乐。",
            city: "Lianping",
            city_zh: "连平",
            imageUrl: "https://picsum.photos/seed/jiulian/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "湖北": {
    id: "Hubei",
    name: "Hubei",
    name_zh: "湖北",
    cities: [
      {
        name: "Wuhan",
        name_zh: "武汉",
        bands: [
          {
            id: "smzb",
            name: "SMZB",
            name_zh: "生命之饼",
            genre: "Punk Rock",
            intro: "武汉朋克音乐的奠基者，中国最早的朋克乐队之一，以其直白、有力的音乐表达对社会的关注。",
            city: "Wuhan",
            city_zh: "武汉",
            imageUrl: "https://picsum.photos/seed/smzb/400/300?grayscale"
          },
          {
            id: "hiperson",
            name: "Hiperson",
            name_zh: "海朋森",
            genre: "Indie Rock / Post-Punk",
            intro: "来自成都，但主唱陈思江在武汉求学期间深受武汉朋克场景影响。音乐充满诗意与力量。",
            city: "Wuhan",
            city_zh: "武汉",
            imageUrl: "https://picsum.photos/seed/hiperson/400/300?grayscale"
          },
          {
            id: "chinese-football",
            name: "Chinese Football",
            name_zh: "Chinese Football",
            genre: "Math Rock / Emo",
            intro: "武汉的独立摇滚乐队，深受90年代Emo和数字摇滚影响，吉他编配精巧，情绪真挚。",
            city: "Wuhan",
            city_zh: "武汉",
            imageUrl: "https://picsum.photos/seed/chinesefootball/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "vox-livehouse",
            name: "VOX Livehouse",
            name_zh: "VOX Livehouse",
            address: "洪山区鲁磨路118号国光大厦",
            capacity: 500,
            intro: "武汉乃至全国最具传奇色彩的Livehouse之一，被誉为“武汉摇滚的黄埔军校”。",
            city: "Wuhan",
            city_zh: "武汉",
            imageUrl: "https://picsum.photos/seed/vox/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "台湾": {
    id: "Taiwan",
    name: "Taiwan",
    name_zh: "台湾",
    cities: [
      {
        name: "Taipei",
        name_zh: "台北",
        bands: [
          {
            id: "no-party-for-caodong",
            name: "No Party For Cao Dong",
            name_zh: "草东没有派对",
            genre: "Indie Rock / Grunge",
            intro: "以其丧文化的歌词和极具爆发力的编曲，迅速席卷华语乐坛，深刻反映了当代年轻人的虚无与挣扎。",
            city: "Taipei",
            city_zh: "台北",
            imageUrl: "https://picsum.photos/seed/caodong/400/300?grayscale"
          },
          {
            id: "sunset-rollercoaster",
            name: "Sunset Rollercoaster",
            name_zh: "落日飞车",
            genre: "Synth-pop / City Pop",
            intro: "充满浪漫气息的城市流行乐队，以英文创作为主，音乐中弥漫着复古与迷幻的色彩。",
            city: "Taipei",
            city_zh: "台北",
            imageUrl: "https://picsum.photos/seed/sunset/400/300?grayscale"
          },
          {
            id: "decadent",
            name: "Deca Joins",
            name_zh: "Deca Joins",
            genre: "Indie Rock / Dream Pop",
            intro: "音乐风格慵懒、迷幻，歌词充满对生活的无奈与自嘲，深受年轻一代喜爱。",
            city: "Taipei",
            city_zh: "台北",
            imageUrl: "https://picsum.photos/seed/decajoins/400/300?grayscale"
          }
        ],
        venues: [
          {
            id: "legacy-taipei",
            name: "Legacy Taipei",
            name_zh: "Legacy 传 音乐展演空间",
            address: "中正区八德路一段1号华山1914创意文化园区中5A馆",
            capacity: 1200,
            intro: "台北最具指标性的中大型Livehouse，无数台湾独立乐团在这里举办重要专场。",
            city: "Taipei",
            city_zh: "台北",
            imageUrl: "https://picsum.photos/seed/legacy/400/300?grayscale"
          },
          {
            id: "the-wall",
            name: "The Wall",
            name_zh: "The Wall Live House",
            address: "文山区罗斯福路四段200号B1",
            capacity: 600,
            intro: "台湾地下音乐的重镇，孕育了无数优秀的独立乐团和音乐人。",
            city: "Taipei",
            city_zh: "台北",
            imageUrl: "https://picsum.photos/seed/thewall/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "河南": {
    id: "Henan",
    name: "Henan",
    name_zh: "河南",
    cities: [
      {
        name: "Xinxiang",
        name_zh: "新乡",
        bands: [
          {
            id: "the-fallacy",
            name: "The Fallacy",
            name_zh: "疯医",
            genre: "Post-Punk",
            intro: "来自“摇滚之乡”新乡的后朋克乐队，音乐阴暗、冰冷，充满张力，是中原摇滚的代表力量。",
            city: "Xinxiang",
            city_zh: "新乡",
            imageUrl: "https://picsum.photos/seed/fallacy/400/300?grayscale"
          }
        ]
      }
    ]
  },
  "广西": {
    id: "Guangxi",
    name: "Guangxi",
    name_zh: "广西",
    cities: [
      {
        name: "Qinzhou",
        name_zh: "钦州",
        bands: [
          {
            id: "wutiaoren-gx",
            name: "Bands of Guangxi",
            name_zh: "回春丹",
            genre: "Indie Rock",
            intro: "来自广西钦州的独立摇滚乐队，以其极具辨识度的吉他Riff和充满地域色彩的旋律迅速走红。",
            city: "Qinzhou",
            city_zh: "钦州",
            imageUrl: "https://picsum.photos/seed/huichundan/400/300?grayscale"
          }
        ]
      }
    ]
  }
};

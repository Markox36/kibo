export type StationCategory =
  | 'lofi'
  | 'electronic'
  | 'ambient'
  | 'jazz'
  | 'rock'
  | 'eclectic'
  | 'classical';

export interface Station {
  id: string;
  name: string;
  tag: string;
  category: StationCategory;
  url: string;
  source?: 'somafm' | 'radioparadise' | 'other';
}

export const CATEGORY_LABEL: Record<StationCategory, string> = {
  lofi: 'LoFi & Chill',
  electronic: 'Electrónica',
  ambient: 'Ambient',
  jazz: 'Jazz & Lounge',
  rock: 'Rock & Indie',
  eclectic: 'Ecléctica',
  classical: 'Clásica',
};

export const STATIONS: Station[] = [
  // LoFi & Chill
  {
    id: 'groove-salad',
    name: 'Groove Salad',
    tag: 'downtempo & chill grooves',
    category: 'lofi',
    url: 'https://ice1.somafm.com/groovesalad-128-mp3',
    source: 'somafm',
  },
  {
    id: 'groove-salad-classic',
    name: 'Groove Salad Classic',
    tag: 'classic beats & grooves',
    category: 'lofi',
    url: 'https://ice1.somafm.com/gsclassic-128-mp3',
    source: 'somafm',
  },
  {
    id: 'fluid',
    name: 'Fluid',
    tag: 'liquid trip-hop',
    category: 'lofi',
    url: 'https://ice1.somafm.com/fluid-128-mp3',
    source: 'somafm',
  },
  {
    id: 'lush',
    name: 'Lush',
    tag: 'sensual vocals',
    category: 'lofi',
    url: 'https://ice1.somafm.com/lush-128-mp3',
    source: 'somafm',
  },
  {
    id: 'chillits',
    name: 'ChillOvers',
    tag: 'downtempo chillout',
    category: 'lofi',
    url: 'https://ice1.somafm.com/chillits-128-mp3',
    source: 'somafm',
  },

  // Electronic
  {
    id: 'beat-blender',
    name: 'Beat Blender',
    tag: 'deep house',
    category: 'electronic',
    url: 'https://ice1.somafm.com/beatblender-128-mp3',
    source: 'somafm',
  },
  {
    id: 'sonic-universe',
    name: 'Sonic Universe',
    tag: 'jazz fusion + electro',
    category: 'electronic',
    url: 'https://ice1.somafm.com/sonicuniverse-128-mp3',
    source: 'somafm',
  },
  {
    id: 'space-station',
    name: 'Space Station',
    tag: 'space music',
    category: 'electronic',
    url: 'https://ice1.somafm.com/spacestation-128-mp3',
    source: 'somafm',
  },
  {
    id: 'defcon',
    name: 'DEF CON Radio',
    tag: 'music from hacker con',
    category: 'electronic',
    url: 'https://ice1.somafm.com/defcon-128-mp3',
    source: 'somafm',
  },
  {
    id: 'underground-80s',
    name: 'Underground 80s',
    tag: 'new wave · post-punk',
    category: 'electronic',
    url: 'https://ice1.somafm.com/u80s-128-mp3',
    source: 'somafm',
  },
  {
    id: 'dubstep',
    name: 'Dub Step Beyond',
    tag: 'dubstep · beats',
    category: 'electronic',
    url: 'https://ice1.somafm.com/dubstep-128-mp3',
    source: 'somafm',
  },

  // Ambient
  {
    id: 'drone-zone',
    name: 'Drone Zone',
    tag: 'ambient · atmospheric',
    category: 'ambient',
    url: 'https://ice1.somafm.com/dronezone-128-mp3',
    source: 'somafm',
  },
  {
    id: 'deep-space-one',
    name: 'Deep Space One',
    tag: 'deep space ambient',
    category: 'ambient',
    url: 'https://ice1.somafm.com/deepspaceone-128-mp3',
    source: 'somafm',
  },
  {
    id: 'mission-control',
    name: 'Mission Control',
    tag: 'NASA + space ambient',
    category: 'ambient',
    url: 'https://ice1.somafm.com/missioncontrol-128-mp3',
    source: 'somafm',
  },
  {
    id: 'earwaves',
    name: 'EarWaves',
    tag: 'experimental',
    category: 'ambient',
    url: 'https://ice1.somafm.com/earwaves-128-mp3',
    source: 'somafm',
  },

  // Jazz & Lounge
  {
    id: 'illinois-lounge',
    name: 'Illinois Street Lounge',
    tag: 'classic bachelor pad',
    category: 'jazz',
    url: 'https://ice1.somafm.com/illstreet-128-mp3',
    source: 'somafm',
  },
  {
    id: 'secret-agent',
    name: 'Secret Agent',
    tag: 'lounge · exotica',
    category: 'jazz',
    url: 'https://ice1.somafm.com/secretagent-128-mp3',
    source: 'somafm',
  },
  {
    id: 'seven-inch-soul',
    name: 'Seven Inch Soul',
    tag: 'vintage soul',
    category: 'jazz',
    url: 'https://ice1.somafm.com/7soul-128-mp3',
    source: 'somafm',
  },

  // Rock & Indie
  {
    id: 'indie-pop-rocks',
    name: 'Indie Pop Rocks!',
    tag: 'indie pop',
    category: 'rock',
    url: 'https://ice1.somafm.com/indiepop-128-mp3',
    source: 'somafm',
  },
  {
    id: 'left-coast-70s',
    name: 'Left Coast 70s',
    tag: 'mellow 70s classics',
    category: 'rock',
    url: 'https://ice1.somafm.com/seventies-128-mp3',
    source: 'somafm',
  },
  {
    id: 'metal-detector',
    name: 'Metal Detector',
    tag: 'metal · progressive',
    category: 'rock',
    url: 'https://ice1.somafm.com/metal-128-mp3',
    source: 'somafm',
  },

  // Eclectic
  {
    id: 'rp-main',
    name: 'Radio Paradise · Main',
    tag: 'eclectic mix',
    category: 'eclectic',
    url: 'https://stream.radioparadise.com/mp3-192',
    source: 'radioparadise',
  },
  {
    id: 'rp-mellow',
    name: 'Radio Paradise · Mellow',
    tag: 'mellow mix',
    category: 'eclectic',
    url: 'https://stream.radioparadise.com/mellow-192',
    source: 'radioparadise',
  },
  {
    id: 'rp-rock',
    name: 'Radio Paradise · Rock',
    tag: 'rock mix',
    category: 'eclectic',
    url: 'https://stream.radioparadise.com/rock-192',
    source: 'radioparadise',
  },
  {
    id: 'rp-global',
    name: 'Radio Paradise · Global',
    tag: 'world mix',
    category: 'eclectic',
    url: 'https://stream.radioparadise.com/global-192',
    source: 'radioparadise',
  },
  {
    id: 'thistle',
    name: 'ThistleRadio',
    tag: 'celtic · folk',
    category: 'eclectic',
    url: 'https://ice1.somafm.com/thistle-128-mp3',
    source: 'somafm',
  },
  {
    id: 'boot-liquor',
    name: 'Boot Liquor',
    tag: 'americana · country',
    category: 'eclectic',
    url: 'https://ice1.somafm.com/bootliquor-128-mp3',
    source: 'somafm',
  },

  // Classical
  {
    id: 'venice-classical',
    name: 'Venice Classical',
    tag: 'classical',
    category: 'classical',
    url: 'https://uk2.streamingpulse.com/ssl/vcr1',
    source: 'other',
  },
];

export function findStation(id: string | null | undefined): Station | undefined {
  if (!id) return undefined;
  return STATIONS.find((s) => s.id === id);
}

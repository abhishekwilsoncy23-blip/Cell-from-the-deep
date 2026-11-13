(() => {
'use strict';

/* =====================================================================
   EVOLVE: THE DEEP  -  Yandex Games release build (15 Levels + Hazards)
   Logical resolution 1280x720 (landscape), scaled to fit any screen.
   ===================================================================== */

const W = 1280, H = 720;
const JOY_R = 90;          // joystick full-deflection radius (world px)
const HOLE_PULL = 240;     // black hole gravity radius
const TUT_COUNT = 5;
const BASE_SPEED = 290;

/* ---------- tiny helpers ---------- */
const $c = {};
const el = id => $c[id] || ($c[id] = document.getElementById(id));
const setText = (id, v) => { const n = el(id), s = String(v); if (n.textContent !== s) n.textContent = s; };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (a, n) => ((a % n) + n) % n;

/* ---------- YANDEX GAMES SDK WRAPPER ---------- */
const Yandex = (() => {
  let ysdk = null;
  let safeStorage = null;
  let initPromise = null;
  let readyCalled = false;
  let gameplayActive = false;
  let pauseHandler = null;
  let resumeHandler = null;
  let lang = 'en';

  const withTimeout = (p, ms, fallback) => new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(fallback), ms);
    Promise.resolve(p).then(
      v => { clearTimeout(timer); finish(v); },
      () => { clearTimeout(timer); finish(fallback); }
    );
  });

  function init(onPause, onResume) {
    pauseHandler = onPause;
    resumeHandler = onResume;
    if (initPromise) return initPromise;

    if (typeof window.YaGames === 'undefined' || typeof window.YaGames.init !== 'function') {
      initPromise = Promise.resolve(null);
      return initPromise;
    }

    initPromise = window.YaGames.init().then(sdk => {
      ysdk = sdk;

      // Requirement 2.14: read portal language from ysdk.environment.i18n.lang
      try {
        const raw = ysdk && ysdk.environment && ysdk.environment.i18n ? ysdk.environment.i18n.lang : 'en';
        if (raw) lang = String(raw).toLowerCase();
      } catch (_) {}

      // Requirements 1.3 & 4.7: handle platform pause / resume events
      try {
        if (typeof ysdk.on === 'function') {
          ysdk.on('game_api_pause', () => { if (pauseHandler) pauseHandler(); });
          ysdk.on('game_api_resume', () => { if (resumeHandler) resumeHandler(); });
        }
      } catch (_) {}

      if (typeof ysdk.getStorage === 'function') {
        return withTimeout(
          ysdk.getStorage().then(s => { safeStorage = s; }).catch(() => {}),
          2000,
          undefined
        ).then(() => ysdk);
      }
      return ysdk;
    }).catch(() => null);

    return initPromise;
  }

  function loadingReady() {
    if (readyCalled || !ysdk) return;
    readyCalled = true;
    try {
      ysdk.features && ysdk.features.LoadingAPI && ysdk.features.LoadingAPI.ready();
    } catch (_) {}
  }

  function gameplayStart() {
    if (gameplayActive) return;
    gameplayActive = true;
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.start();
    } catch (_) {}
  }

  function gameplayStop() {
    if (!gameplayActive) return;
    gameplayActive = false;
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
    } catch (_) {}
  }

  function showFullscreenAdv() {
    sfx.adMuted = true;
    sfx.sync();

    return withTimeout(init(pauseHandler, resumeHandler), 3000, null).then(sdk => {
      if (!sdk || !sdk.adv || typeof sdk.adv.showFullscreenAdv !== 'function') {
        sfx.adMuted = false;
        sfx.sync();
        return false;
      }

      return new Promise(resolve => {
        let done = false;
        const finish = shown => {
          if (done) return;
          done = true;
          clearTimeout(guardTimer);
          sfx.adMuted = false;
          sfx.sync();
          try { window.focus(); } catch (_) {}
          resolve(!!shown);
        };
        const guardTimer = setTimeout(() => finish(false), 60000);

        try {
          sdk.adv.showFullscreenAdv({
            callbacks: {
              onOpen: () => {
                sfx.adMuted = true;
                sfx.sync();
              },
              onClose: wasShown => finish(wasShown),
              onError: () => finish(false)
            }
          });
        } catch (_) {
          finish(false);
        }
      });
    });
  }

  function showRewardedVideo() {
    sfx.adMuted = true;
    sfx.sync();

    return withTimeout(init(pauseHandler, resumeHandler), 3000, null).then(sdk => {
      if (!sdk || !sdk.adv || typeof sdk.adv.showRewardedVideo !== 'function') {
        sfx.adMuted = false;
        sfx.sync();
        return false;
      }

      return new Promise(resolve => {
        let done = false;
        let rewarded = false;
        const finish = ok => {
          if (done) return;
          done = true;
          clearTimeout(guardTimer);
          sfx.adMuted = false;
          sfx.sync();
          try { window.focus(); } catch (_) {}
          resolve(!!ok);
        };
        const guardTimer = setTimeout(() => finish(false), 90000);

        try {
          sdk.adv.showRewardedVideo({
            callbacks: {
              onOpen: () => {
                sfx.adMuted = true;
                sfx.sync();
              },
              onRewarded: () => {
                rewarded = true;
              },
              onClose: () => finish(rewarded),
              onError: () => finish(false)
            }
          });
        } catch (_) {
          finish(false);
        }
      });
    });
  }

  return {
    init,
    loadingReady,
    gameplayStart,
    gameplayStop,
    showFullscreenAdv,
    showRewardedVideo,
    storage: () => safeStorage,
    getLang: () => lang
  };
})();

/* ---------- STORAGE (safeStorage + localStorage fallback) ---------- */
const store = {
  get(k, d) {
    try {
      const s = Yandex.storage();
      if (s) {
        const v = s.getItem(k);
        if (v !== null && v !== undefined) return v;
      }
    } catch (_) {}
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : v;
    } catch (_) { return d; }
  },
  set(k, v) {
    const val = String(v);
    try {
      const s = Yandex.storage();
      if (s) s.setItem(k, val);
    } catch (_) {}
    try { localStorage.setItem(k, val); } catch (_) {}
  },
  remove(k) {
    try {
      const s = Yandex.storage();
      if (s && typeof s.removeItem === 'function') s.removeItem(k);
    } catch (_) {}
    try { localStorage.removeItem(k); } catch (_) {}
  }
};

/* ---------- SOUND (Web Audio synth, zero external files) ---------- */
const sfx = {
  ac: null,
  master: null,
  muted: store.get('evolve_mute', '0') === '1',
  adMuted: false,
  platformMuted: false,
  hiddenMuted: !!document.hidden,
  pausedMuted: false,

  init() {
    if (!this.ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = this.isSilent ? 0 : 1;
        this.master.connect(this.ac.destination);
      } catch (_) { return; }
    }
    this.sync();
  },

  get isSilent() {
    return this.muted || this.adMuted || this.platformMuted || this.hiddenMuted || this.pausedMuted;
  },

  get on() {
    return !!this.ac && !!this.master && !this.isSilent;
  },

  sync() {
    if (!this.ac) return;
    if (this.master) {
      try {
        this.master.gain.setValueAtTime(this.isSilent ? 0 : 1, this.ac.currentTime);
      } catch (_) {}
    }
    if (this.isSilent) {
      if (this.ac.state === 'running') this.ac.suspend().catch(() => {});
    } else {
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    }
  },

  tone(f, d, type = 'sine', v = 0.05, slide = 0, delay = 0) {
    if (!this.on) return;
    try {
      const ac = this.ac, t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide > 0) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + d + 0.02);
    } catch (_) {}
  },

  shoot()   { this.tone(520, 0.08, 'square', 0.012, 160); },
  hit()     { this.tone(160, 0.25, 'sawtooth', 0.06, 60); },
  eat()     { this.tone(680, 0.07, 'sine', 0.03); },
  kill()    { this.tone(300, 0.15, 'triangle', 0.05, 120); },
  suck()    { this.tone(210, 0.35, 'sine', 0.05, 40); },
  shock()   { this.tone(420, 0.22, 'sawtooth', 0.05, 110); },
  thunder() { this.tone(180, 0.32, 'sawtooth', 0.07, 45); this.tone(760, 0.12, 'square', 0.04, 180); },
  dash()    { this.tone(260, 0.14, 'triangle', 0.04, 480); },
  relic()   { this.tone(880, 0.16, 'sine', 0.05); this.tone(1320, 0.24, 'sine', 0.04, 0, 0.08); },
  pickup()  { this.tone(600, 0.12, 'triangle', 0.05, 900); },
  warn()    { this.tone(90, 0.5, 'sawtooth', 0.07); this.tone(90, 0.5, 'sawtooth', 0.05, 0, 0.6); },
  win()     { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, 0, i * 0.12)); },
  lose()    { this.tone(420, 0.6, 'sawtooth', 0.06, 80); }
};

/* ---------- DNA MUTATIONS (9 permanent stackable traits — Magnet is temporary 10s only) ---------- */
const MUTATIONS = [
  { id: 'speed',  icon: '💨', name: 'Swift Fins',     desc: '+15% swim speed',             max: 5 },
  { id: 'multi',  icon: '🔱', name: 'Split Venom',    desc: '+1 extra shot per volley',    max: 3 },
  { id: 'damage', icon: '🔥', name: 'Hyper Plasma',   desc: '+50% bullet damage & speed',  max: 4 },
  { id: 'fire',   icon: '⚡', name: 'Adrenal Surge',  desc: '+18% faster auto-fire',       max: 5 },
  { id: 'pierce', icon: '💠', name: 'Piercing Spine', desc: 'Shots pierce +1 creature',    max: 3 },
  { id: 'vital',  icon: '🦴', name: 'Chitin Plating', desc: '+25 Max HP & full recovery',  max: 5 },
  { id: 'regen',  icon: '💖', name: 'Regen Tissue',   desc: '+1.5 HP/sec regeneration',    max: 4 },
  { id: 'ammo',   icon: '🔋', name: 'Deep Battery',   desc: '+30 Max Ammo & faster regen', max: 4 },
  { id: 'feast',  icon: '🟢', name: 'Apex Digestion', desc: '+25% biomass from all food',  max: 4 }
];
const MUT_MAP = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));

/* ---------- LEVEL DATA: 15 evolutions (5, 10, 15 ... 75 relics; Lv 11+ toughness spike) ---------- */
const LEVELS = [
  { name: 'Primordial Cell', tip: 'Absorb green biomass and collect 5 diamonds to evolve.',
    bg: ['#031a2b', '#0b4f6c'], time: 55, bio: 45, relics: 5,
    pool: ['drifter'], spawn: 2.1, holes: 0, currents: false, storm: null, boss: null, enemy: '#ff6b6b' },

  { name: 'Multi-Cell', tip: 'Hunters chase you now. Collect 10 diamonds and watch for 10s Magnet drops!',
    bg: ['#052235', '#0d6378'], time: 65, bio: 80, relics: 10,
    pool: ['drifter', 'drifter', 'hunter'], spawn: 1.9, holes: 0, currents: false, storm: null, boss: null, enemy: '#ff7f50' },

  { name: 'Trilobite', tip: 'Moving Black Holes & Chargers appear! Grab 15 diamonds and face the Leviathan.',
    bg: ['#082c3e', '#107685'], time: 75, bio: 115, relics: 15,
    pool: ['drifter', 'hunter', 'charger'], spawn: 1.75, holes: 1, currents: false, storm: null,
    boss: { name: 'LEVIATHAN', style: 'spread' }, enemy: '#feca57' },

  { name: 'Ocean Fish', tip: 'Lightning Strikes begin! Dodge the glowing storm rings while gathering 20 diamonds.',
    bg: ['#0a3346', '#148e96'], time: 85, bio: 145, relics: 20,
    pool: ['drifter', 'hunter', 'spitter'], spawn: 1.6, holes: 1, currents: true,
    storm: { interval: 7.5, count: 1 }, boss: null, enemy: '#ff9ff3' },

  { name: 'Coelacanth', tip: 'Brood Spores split when shot—lure them into moving black holes or lightning!',
    bg: ['#0e3848', '#229999'], time: 90, bio: 175, relics: 25,
    pool: ['hunter', 'spitter', 'charger', 'splitter'], spawn: 1.5, holes: 1, currents: true,
    storm: { interval: 6.8, count: 1 }, boss: null, enemy: '#70a1ff' },

  { name: 'Amphibian', tip: 'Volt Jellies shock nearby swimmers. Collect 30 diamonds and survive the Kraken!',
    bg: ['#123c4a', '#37a8a8'], time: 95, bio: 210, relics: 30,
    pool: ['hunter', 'spitter', 'shocker', 'drifter'], spawn: 1.4, holes: 2, currents: true,
    storm: { interval: 6.2, count: 1 }, boss: { name: 'ABYSSAL KRAKEN', style: 'radial' }, enemy: '#54a0ff' },

  { name: 'Reptile', tip: 'Two moving black holes roam the reef. 35 diamonds needed to evolve.',
    bg: ['#163b28', '#6fae5b'], time: 105, bio: 245, relics: 35,
    pool: ['hunter', 'spitter', 'splitter', 'charger'], spawn: 1.35, holes: 2, currents: true,
    storm: { interval: 5.6, count: 1 }, boss: null, enemy: '#f368e0' },

  { name: 'Sea Serpent', tip: 'Double lightning strikes erupt! Stay calm and gather 40 diamonds.',
    bg: ['#143b30', '#4eb883'], time: 110, bio: 280, relics: 40,
    pool: ['hunter', 'charger', 'splitter', 'shocker'], spawn: 1.28, holes: 2, currents: true,
    storm: { interval: 5.2, count: 2 }, boss: null, enemy: '#00d2d3' },

  { name: 'Raptor', tip: '45 diamonds to pass. Keep moving to outmaneuver the Dread Hydra!',
    bg: ['#1a3a2a', '#7cbf6a'], time: 120, bio: 315, relics: 45,
    pool: ['hunter', 'spitter', 'charger', 'splitter'], spawn: 1.2, holes: 2, currents: true,
    storm: { interval: 4.8, count: 2 }, boss: { name: 'DREAD HYDRA', style: 'hydra' }, enemy: '#ee5253' },

  { name: 'Mammal', tip: '50 diamonds to reach the Abyssal Depth. Brace yourself for Level 11!',
    bg: ['#1c3d22', '#89bc5e'], time: 130, bio: 350, relics: 50,
    pool: ['hunter', 'spitter', 'shocker', 'charger'], spawn: 1.15, holes: 2, currents: true,
    storm: { interval: 4.5, count: 2 }, boss: null, enemy: '#ff9f43' },

  /* --- AFTER LEVEL 10: Toughness spike, achievable through patience --- */
  { name: 'Dire Wolf', tip: 'TOUGHNESS SURGE! Stay patient, dodge hazards & grab 55 diamonds carefully.',
    bg: ['#1b2f24', '#6d9444'], time: 145, bio: 410, relics: 55,
    pool: ['hunter', 'charger', 'splitter', 'shocker', 'spitter'], spawn: 0.96, holes: 3, currents: true,
    storm: { interval: 3.9, count: 2 }, boss: null, enemy: '#0abde3' },

  { name: 'Primate', tip: '3 moving black holes & Megalodon ahead! Kite patiently to collect 60 diamonds.',
    bg: ['#222b26', '#7b8e48'], time: 155, bio: 460, relics: 60,
    pool: ['hunter', 'spitter', 'charger', 'splitter', 'shocker'], spawn: 0.90, holes: 3, currents: true,
    storm: { interval: 3.6, count: 2 }, boss: { name: 'MEGALODON', style: 'titan' }, enemy: '#c8d6e5' },

  { name: 'Early Human', tip: 'Triple lightning storms! Time your dashes between bolts to collect 65 diamonds.',
    bg: ['#262920', '#9e8e48'], time: 165, bio: 510, relics: 65,
    pool: ['hunter', 'spitter', 'charger', 'splitter', 'shocker'], spawn: 0.85, holes: 3, currents: true,
    storm: { interval: 3.4, count: 3 }, boss: null, enemy: '#1dd1a1' },

  { name: 'Human', tip: '70 diamonds & the Apex Titan stand between you and Apocalypse. Play smart!',
    bg: ['#2d2420', '#a96b45'], time: 180, bio: 560, relics: 70,
    pool: ['spitter', 'charger', 'splitter', 'shocker', 'hunter'], spawn: 0.80, holes: 3, currents: true,
    storm: { interval: 3.1, count: 3 }, boss: { name: 'APEX TITAN', style: 'hydra' }, enemy: '#ff6b81' },

  { name: 'Apocalypse', tip: 'FINAL STAGE! Gather 75 diamonds and endure Omega Extinction with patience & skill!',
    bg: ['#1a0407', '#541016'], time: 200, bio: 620, relics: 75,
    pool: ['hunter', 'spitter', 'charger', 'splitter', 'shocker'], spawn: 0.74, holes: 4, currents: true,
    storm: { interval: 2.8, count: 3 }, boss: { name: 'OMEGA EXTINCTION', style: 'omega' }, enemy: '#ffffff' }
];

const ENEMY = {
  drifter:  { r: [14, 18], spd: 72,  dmg: 12, pts: 15,  bio: 6 },
  swarmer:  { r: [10, 12], spd: 170, dmg: 10, pts: 12,  bio: 4 },
  hunter:   { r: [15, 18], spd: 145, dmg: 16, pts: 25,  bio: 8 },
  spitter:  { r: [18, 22], spd: 62,  dmg: 12, pts: 35,  bio: 10, fire: 2.5 },
  charger:  { r: [17, 21], spd: 100, dmg: 20, pts: 40,  bio: 12 },
  shocker:  { r: [19, 23], spd: 82,  dmg: 14, pts: 42,  bio: 12 },
  splitter: { r: [24, 28], spd: 66,  dmg: 18, pts: 45,  bio: 12 },
  boss:     { r: [64, 64], spd: 70,  dmg: 28, pts: 600, bio: 45, fire: 1.65 }
};

const enemyHp = (type, lv) => {
  const toughBonus = lv >= 10 ? (lv - 9) : 0; // steeper toughness after level 10
  if (type === 'boss')     return 14 + lv * 5 + toughBonus * 6;
  if (type === 'swarmer')  return 1 + Math.floor(lv / 6) + (lv >= 12 ? 1 : 0);
  if (type === 'drifter')  return 1 + Math.floor(lv / 4) + Math.floor(toughBonus / 2);
  if (type === 'hunter')   return 2 + Math.floor(lv / 3) + Math.floor(toughBonus / 2);
  if (type === 'spitter')  return 2 + Math.floor(lv / 3) + Math.floor(toughBonus / 2);
  if (type === 'charger')  return 3 + Math.floor(lv / 3) + toughBonus;
  if (type === 'shocker')  return 3 + Math.floor(lv / 3) + toughBonus;
  return 4 + Math.floor(lv / 2) + toughBonus; // splitter
};

const PUP_INFO = {
  shield:  { icon: '🛡️', col: '#48dbfb', label: 'SHIELD' },
  rapid:   { icon: '⚡', col: '#ffa502', label: 'RAPID FIRE' },
  multi:   { icon: '🔱', col: '#ff9ff3', label: 'SPLIT SHOT' },
  magnet:  { icon: '🧲', col: '#54a0ff', label: 'MAGNET 10s' },
  heal:    { icon: '❤️', col: '#ff6b81', label: '+35 HP' },
  mutagen: { icon: '🧬', col: '#7bed9f', label: 'MUTAGEN +20 BIO' }
};

/* ---------- GAME STATE ---------- */
const state = {
  phase: 'menu',            // menu | playing | paused | levelup | dead | won
  level: 0, time: 55, bio: 0, relics: 0, score: 0,
  levelStartScore: 0, levelStartMuts: {}, attemptLevel: 0,
  muts: {},
  clock: 0, shake: 0, flash: 0, bannerT: 0, reviveUsed: false,
  bossSpawned: false, bossAlive: false, currentAng: 0, currentT: 3,
  spawnT: 1, holeT: 3, relicT: 0.4, pupT: 6.5, stormT: 5,
  enemies: [], bullets: [], eBullets: [], holes: [], lightnings: [],
  foods: [], relicItems: [], pups: [], orbs: [], parts: [], pops: []
};

const P = { x: W / 2, y: H / 2, r: 16, hp: 100, ammo: 100, fireT: 0, invuln: 0,
            shieldT: 0, rapidT: 0, multiT: 0, magnetT: 0, wob: 0, dir: 1 };

let nextEnemyId = 1;
const codes = {};
let joy = null;
let best = parseInt(store.get('evolve_best', '0'), 10) || 0;
let busy = false;
let screenName = 'title';
let screenEnteredAt = 0;
let tutIdx = 0, tutFromTitle = false;
let isPortrait = false;
let pausedByPlatform = false;
let mutChoices = [];
let selectedMutIdx = 0;

/* ---------- COMPUTED STATS ---------- */
const mutRank = id => state.muts[id] || 0;

function getStats() {
  const maxHp = 100 + mutRank('vital') * 25;
  const maxAmmo = 100 + mutRank('ammo') * 30;
  return {
    maxHp,
    maxAmmo,
    ammoRegen: 5 * (1 + mutRank('ammo') * 0.35),
    speed: BASE_SPEED * (1 + mutRank('speed') * 0.15),
    shots: 1 + mutRank('multi') + (P.multiT > 0 ? 2 : 0),
    bulletDmg: 1 + mutRank('damage') * 0.5,
    bulletSpeed: 640 * (1 + mutRank('damage') * 0.18),
    fireDelay: (P.rapidT > 0 ? 0.11 : 0.24) / (1 + mutRank('fire') * 0.18),
    pierce: mutRank('pierce'),
    // Magnetic power is temporary only (10s duration)
    pullRange: P.magnetT > 0 ? 360 : 100,
    bioMult: 1 + mutRank('feast') * 0.25,
    hpRegen: mutRank('regen') * 1.5
  };
}

function sanitizeMuts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const m of MUTATIONS) {
    const v = raw[m.id];
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) {
      out[m.id] = Math.min(v, m.max);
    }
  }
  return out;
}

/* ---------- RUN PROGRESS PERSISTENCE ---------- */
function loadRun() {
  try {
    const raw = store.get('evolve_run', '');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.level !== 'number' || !Number.isInteger(data.level)) return null;
    if (data.level < 1 || data.level >= LEVELS.length) return null;
    const score = (typeof data.score === 'number' && Number.isFinite(data.score) && data.score >= 0)
      ? Math.floor(data.score) : 0;
    return { level: data.level, score, muts: sanitizeMuts(data.muts) };
  } catch (_) {
    return null;
  }
}

function saveRun(level, score, muts) {
  if (level >= 1 && level < LEVELS.length) {
    store.set('evolve_run', JSON.stringify({
      level,
      score: Math.max(0, Math.floor(score)),
      muts: sanitizeMuts(muts)
    }));
  } else {
    store.remove('evolve_run');
  }
}

function clearRun() {
  store.remove('evolve_run');
}

/* ---------- CANVAS & SCALING ---------- */
const stage = document.getElementById('stage');
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
let scale = 1;

function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches ||
      ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  } catch (_) {
    return 'ontouchstart' in window;
  }
}

function layout() {
  const ww = Math.max(1, window.innerWidth), wh = Math.max(1, window.innerHeight);
  scale = Math.min(ww / W, wh / H);
  const ox = (ww - W * scale) / 2, oy = (wh - H * scale) / 2;
  stage.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;

  const dpr = clamp((window.devicePixelRatio || 1) * scale, 0.5, 2);
  const tw = Math.round(W * dpr), th = Math.round(H * dpr);
  if (cvs.width !== tw || cvs.height !== th) {
    cvs.width = tw;
    cvs.height = th;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  isPortrait = wh > ww && isTouchDevice();
  el('rotate').classList.toggle('show', isPortrait);
  if (isPortrait && state.phase === 'playing') pauseGame(false);
}

function toWorld(cx, cy) {
  const r = stage.getBoundingClientRect();
  return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
}

function clearInputs() {
  for (const k in codes) delete codes[k];
  joy = null;
}

function blurActiveButton() {
  try {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  } catch (_) {}
}

/* ---------- SCREENS ---------- */
const SCREEN_IDS = { title: 's-title', tutorial: 's-tutorial', levelup: 's-levelup',
                     dead: 's-dead', won: 's-won', pause: 's-pause' };
const PRIMARY = { title: 'btn-play', tutorial: 'btn-tut-next', levelup: 'btn-next',
                  dead: 'btn-retry', won: 'btn-again', pause: 'btn-resume' };

function showScreen(name) {
  screenName = name;
  screenEnteredAt = performance.now();
  for (const k in SCREEN_IDS) el(SCREEN_IDS[k]).classList.toggle('on', k === name);
  if (name === 'title') refreshTitle();
}

function showBanner(title, sub, kind) {
  const b = el('banner');
  el('banner-t').textContent = title;
  el('banner-s').textContent = sub || '';
  b.classList.toggle('warn', kind === 'warn');
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
  state.bannerT = kind === 'warn' ? 4.4 : 3.4;
}

function refreshTitle() {
  el('best').textContent = `Best score: ${best}`;
  const saved = loadRun();
  const btnCont = el('btn-continue');
  const btnPlay = el('btn-play');
  if (saved) {
    btnCont.style.display = '';
    btnCont.textContent = `Continue · ${saved.level + 1}/${LEVELS.length} ${LEVELS[saved.level].name}`;
    btnPlay.textContent = 'New Game';
    PRIMARY.title = 'btn-continue';
  } else {
    btnCont.style.display = 'none';
    btnPlay.textContent = 'Play';
    PRIMARY.title = 'btn-play';
  }
}

function saveBest() {
  if (state.score > best) {
    best = state.score;
    store.set('evolve_best', best);
  }
}

function syncFromStorage() {
  const storedBest = parseInt(store.get('evolve_best', '0'), 10) || 0;
  if (storedBest > best) best = storedBest;
  sfx.muted = store.get('evolve_mute', '0') === '1';
  el('btn-mute').textContent = sfx.muted ? '🔇' : '🔊';
  sfx.sync();
  if (screenName === 'title') refreshTitle();
}

/* ---------- MUTATION PICKER ---------- */
function buildMutationChoices() {
  const available = MUTATIONS.filter(m => mutRank(m.id) < m.max);
  const pool = [...available];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  mutChoices = pool.slice(0, 3);
  selectedMutIdx = 0;

  const wrap = el('mut-choices');
  const label = el('mut-label');
  wrap.innerHTML = '';

  if (mutChoices.length === 0) {
    label.textContent = 'All DNA Mutations Maxed!';
    return;
  }

  label.textContent = 'Choose a DNA Mutation (Keys 1 / 2 / 3)';
  mutChoices.forEach((m, idx) => {
    const cur = mutRank(m.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcard' + (idx === 0 ? ' sel' : '');
    btn.innerHTML =
      `<div class="m-ico">${m.icon}</div>` +
      `<div class="m-name">${m.name}</div>` +
      `<div class="m-desc">${m.desc}</div>` +
      `<div class="m-rank">${cur === 0 ? 'NEW' : `Lv ${cur} → ${cur + 1}`} / ${m.max}</div>`;
    btn.addEventListener('click', () => selectMutation(idx));
    wrap.appendChild(btn);
  });
}

function selectMutation(idx) {
  if (idx < 0 || idx >= mutChoices.length) return;
  selectedMutIdx = idx;
  const cards = el('mut-choices').querySelectorAll('.mcard');
  cards.forEach((c, i) => c.classList.toggle('sel', i === idx));
  sfx.eat();
}

function applySelectedMutation() {
  const m = mutChoices[selectedMutIdx];
  if (!m) return;
  state.muts[m.id] = Math.min(m.max, mutRank(m.id) + 1);
  mutChoices = [];
}

/* ---------- TUTORIAL ---------- */
function showTutorial(fromTitle) {
  tutFromTitle = fromTitle;
  tutIdx = 0;
  renderTutorial();
  state.phase = 'menu';
  showScreen('tutorial');
}

function renderTutorial() {
  document.querySelectorAll('.tcard').forEach((c, i) => c.classList.toggle('on', i === tutIdx));
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('on', i === tutIdx));
  el('btn-tut-next').textContent = tutIdx === TUT_COUNT - 1 ? "Let's Evolve!" : 'Next';
}

function tutNext() {
  tutIdx++;
  if (tutIdx < TUT_COUNT) { renderTutorial(); return; }
  tutDone();
}

function tutDone() {
  store.set('evolve_seen', '1');
  if (tutFromTitle) {
    state.phase = 'menu';
    showScreen('title');
  } else {
    startLevel(0);
  }
}

/* ---------- SERIALISED ACTIONS (ads + transitions) ---------- */
function run(fn) {
  if (busy) return;
  busy = true;
  Promise.resolve().then(fn).finally(() => { busy = false; });
}

function onPlay() {
  sfx.hiddenMuted = !!document.hidden;
  sfx.init();
  clearRun();
  state.score = 0;
  state.muts = {};
  run(() => Yandex.showFullscreenAdv().then(() => {
    if (store.get('evolve_seen', '0') === '1') startLevel(0);
    else showTutorial(false);
  }));
}

function onContinue() {
  const saved = loadRun();
  if (!saved) { onPlay(); return; }
  sfx.hiddenMuted = !!document.hidden;
  sfx.init();
  state.score = saved.score;
  state.muts = { ...saved.muts };
  run(() => Yandex.showFullscreenAdv().then(() => startLevel(saved.level)));
}

function nextLevel() {
  if (state.phase !== 'levelup') return;
  const nxt = state.level + 1;
  applySelectedMutation();
  run(() => (nxt % 2 === 0 ? Yandex.showFullscreenAdv() : Promise.resolve())
    .then(() => startLevel(nxt)));
}

function retryLevel() {
  if (state.phase !== 'dead') return;
  state.score = state.levelStartScore;
  state.muts = { ...state.levelStartMuts };
  run(() => Yandex.showFullscreenAdv().then(() => startLevel(state.attemptLevel)));
}

function startOver() {
  if (state.phase !== 'dead' && state.phase !== 'won') return;
  clearRun();
  state.score = 0;
  state.muts = {};
  run(() => Yandex.showFullscreenAdv().then(() => startLevel(0)));
}

function reviveWithAd() {
  if (state.phase !== 'dead' || state.reviveUsed) return;
  el('dead-note').textContent = '';
  run(() => Yandex.showRewardedVideo().then(ok => {
    if (ok) {
      revive();
    } else {
      el('dead-note').textContent = 'Ad not completed or unavailable right now.';
    }
  }));
}

/* ---------- LEVEL FLOW ---------- */
function startLevel(i) {
  const L = LEVELS[i];
  state.level = i;
  state.time = L.time;
  state.bio = 0;
  state.relics = 0;
  state.levelStartScore = state.score;
  state.levelStartMuts = { ...state.muts };
  state.attemptLevel = i;
  state.reviveUsed = false;
  state.bossSpawned = false;
  state.bossAlive = false;
  state.holeT = 2.5;
  state.spawnT = 1;
  state.relicT = 0.25;
  state.pupT = 6;
  state.stormT = L.storm ? L.storm.interval * 0.75 : 99;
  state.currentT = 2;
  state.shake = 0;
  state.flash = 0;
  state.enemies = []; state.bullets = []; state.eBullets = []; state.holes = [];
  state.lightnings = []; state.foods = []; state.relicItems = []; state.pups = [];
  state.orbs = []; state.parts = []; state.pops = [];

  if (i > 0) saveRun(i, state.levelStartScore, state.muts);

  const st = getStats();
  Object.assign(P, {
    x: W / 2, y: H / 2, hp: st.maxHp, ammo: st.maxAmmo,
    fireT: 0, invuln: 1.5, shieldT: 0, rapidT: 0, multiT: 0, magnetT: 0
  });
  clearInputs();
  blurActiveButton();
  for (let k = 0; k < 26; k++) spawnFood();

  pausedByPlatform = false;
  sfx.pausedMuted = false;
  sfx.hiddenMuted = !!document.hidden;
  sfx.init();

  state.phase = 'playing';
  showScreen(null);
  Yandex.gameplayStart();
  showBanner(`${i + 1}/${LEVELS.length}. ${L.name}`, L.tip, i === 10 ? 'warn' : null);
}

function revive() {
  if (state.phase !== 'dead' || state.reviveUsed) return;
  state.reviveUsed = true;
  const st = getStats();
  P.hp = st.maxHp;
  P.ammo = st.maxAmmo;
  P.invuln = 2.5;
  state.enemies = state.enemies.filter(e => Math.hypot(e.x - P.x, e.y - P.y) > 220);
  state.eBullets = [];
  state.lightnings = [];
  state.holes = state.holes.filter(h => Math.hypot(h.x - P.x, h.y - P.y) > 220);
  clearInputs();
  blurActiveButton();

  pausedByPlatform = false;
  sfx.pausedMuted = false;
  sfx.hiddenMuted = !!document.hidden;
  sfx.sync();

  state.phase = 'playing';
  showScreen(null);
  sfx.pickup();
  Yandex.gameplayStart();
}

function die(msg, canRevive) {
  if (state.phase !== 'playing') return;
  state.phase = 'dead';
  clearInputs();
  Yandex.gameplayStop();
  sfx.lose();
  saveBest();
  el('dead-text').textContent = msg;
  el('dead-score').textContent = `Stage ${state.level + 1}/${LEVELS.length}   ·   Score ${state.score}   ·   Best ${best}`;
  el('dead-note').textContent = '';
  el('btn-revive').style.display = canRevive && !state.reviveUsed ? '' : 'none';
  showScreen('dead');
}

function checkObjectives() {
  const L = LEVELS[state.level];
  if (state.bio < L.bio || state.relics < L.relics) return;
  const bonus = Math.floor(state.time) * 10;
  state.score += bonus;
  saveBest();
  clearInputs();
  Yandex.gameplayStop();
  sfx.win();
  const stats = `Time bonus +${bonus}   ·   Score ${state.score}`;
  if (state.level === LEVELS.length - 1) {
    clearRun();
    state.phase = 'won';
    el('won-text').textContent = 'You conquered Omega Extinction and survived all 15 stages of evolution!';
    el('won-stats').textContent = stats;
    showScreen('won');
  } else {
    saveRun(state.level + 1, state.score, state.muts);
    state.phase = 'levelup';
    el('lu-title').textContent = 'EVOLVED!';
    el('lu-text').textContent = `You became a ${LEVELS[state.level + 1].name}.`;
    el('lu-stats').textContent = stats;
    buildMutationChoices();
    el('btn-next').textContent = `Continue to ${LEVELS[state.level + 1].name}`;
    showScreen('levelup');
  }
}

/* ---------- PAUSE & PLATFORM EVENTS ---------- */
function pauseGame(byPlatform = false) {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  if (!byPlatform) pausedByPlatform = false;
  clearInputs();
  Yandex.gameplayStop();
  sfx.pausedMuted = true;
  sfx.sync();
  showScreen('pause');
}

function resumeGame() {
  if (state.phase !== 'paused' || isPortrait) return;
  pausedByPlatform = false;
  blurActiveButton();
  state.phase = 'playing';
  sfx.pausedMuted = false;
  sfx.hiddenMuted = !!document.hidden;
  sfx.sync();
  Yandex.gameplayStart();
  showScreen(null);
}

function togglePause() {
  if (state.phase === 'playing') pauseGame(false);
  else if (state.phase === 'paused') resumeGame();
}

function onPlatformPause() {
  sfx.platformMuted = true;
  sfx.sync();
  if (state.phase === 'playing') {
    pausedByPlatform = true;
    pauseGame(true);
  }
}

function onPlatformResume() {
  sfx.platformMuted = false;
  sfx.sync();
  if (pausedByPlatform) {
    pausedByPlatform = false;
    if (state.phase === 'paused' && !isPortrait) resumeGame();
  }
}

function toggleMute() {
  sfx.muted = !sfx.muted;
  el('btn-mute').textContent = sfx.muted ? '🔇' : '🔊';
  store.set('evolve_mute', sfx.muted ? '1' : '0');
  sfx.sync();
}

/* ---------- SPAWNING ---------- */
function edgePoint() {
  const m = 40, s = Math.floor(Math.random() * 4);
  if (s === 0) return { x: -m, y: rand(0, H) };
  if (s === 1) return { x: W + m, y: rand(0, H) };
  if (s === 2) return { x: rand(0, W), y: -m };
  return { x: rand(0, W), y: H + m };
}

function safePoint(minD) {
  let bestP = { x: rand(60, W - 60), y: rand(60, H - 60) };
  let bestD = Math.hypot(bestP.x - P.x, bestP.y - P.y);
  for (let t = 0; t < 30 && bestD < minD; t++) {
    const p = { x: rand(60, W - 60), y: rand(60, H - 60) };
    const d = Math.hypot(p.x - P.x, p.y - P.y);
    if (d > bestD) { bestP = p; bestD = d; }
  }
  return bestP;
}

function makeEnemy(type, x, y, extra = null) {
  const lv = state.level, def = ENEMY[type], hp = enemyHp(type, lv);
  const toughSpd = lv >= 10 ? (lv - 9) * 0.032 : 0;
  return Object.assign({
    id: nextEnemyId++,
    type, x, y, r: rand(def.r[0], def.r[1]),
    hp, maxHp: hp, spd: def.spd * (1 + lv * 0.04 + toughSpd),
    phase: rand(0, 6.28),
    fireT: def.fire ? def.fire * rand(0.8, 1.5) : (type === 'charger' ? rand(1.4, 2.5) : 0),
    shockT: type === 'shocker' ? rand(1.8, 3.2) : 0,
    shockFlash: 0,
    subState: 'stalk', subT: 0, dashVx: 0, dashVy: 0, aimAng: 0,
    bossStyle: 'spread',
    hitT: 0
  }, extra);
}

function spawnEnemy(type, extra = null) {
  const p = edgePoint();
  state.enemies.push(makeEnemy(type, p.x, p.y, extra));
}

function spawnFood() {
  const p = safePoint(110);
  state.foods.push({ x: p.x, y: p.y, vx: rand(-10, 10), vy: rand(-10, 10), r: rand(5, 8) });
}

function spawnHole() {
  const p = safePoint(300);
  const ang = rand(0, Math.PI * 2);
  const spd = state.level >= 10 ? rand(68, 105) : rand(42, 68);
  state.holes.push({
    x: p.x, y: p.y,
    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    r: 0, maxR: rand(50, 60), life: 12.5,
    turnT: rand(2.5, 4.5)
  });
}

function spawnLightning(isTough, delayOffset = 0) {
  const ang = rand(0, Math.PI * 2);
  const dist = rand(50, 310);
  const x = clamp(P.x + Math.cos(ang) * dist, 75, W - 75);
  const y = clamp(P.y + Math.sin(ang) * dist, 75, H - 75);
  const maxWarn = (isTough ? 1.25 : 1.45) + delayOffset;
  state.lightnings.push({
    x, y,
    r: isTough ? 82 : 74,
    warnT: maxWarn,
    maxWarn,
    flashT: 0,
    struck: false,
    dmg: isTough ? 24 : 18,
    seed: Math.random() * 100
  });
}

function spawnRelic() {
  const p = safePoint(140);
  state.relicItems.push({ x: p.x, y: p.y, r: 14, bob: Math.random() * 6 });
}

function spawnPup() {
  const p = safePoint(160);
  const type = pick(['shield', 'rapid', 'multi', 'magnet', 'heal', 'mutagen']);
  state.pups.push({ x: p.x, y: p.y, r: 16, t: 0, type });
}

function burst(x, y, col, n) {
  if (state.parts.length > 320) return;
  for (let i = 0; i < n; i++) {
    state.parts.push({ x, y, vx: rand(-180, 180), vy: rand(-180, 180),
                       life: rand(0.4, 0.8), col, s: rand(2, 5) });
  }
}

function addPop(x, y, text, col) { state.pops.push({ x, y, text, col, life: 1.1 }); }

function addOrb(x, y) {
  state.orbs.push({ x, y, vx: rand(-160, 160), vy: rand(-160, 160), r: 5, life: 9 });
}

function shakeScreen(v) { state.shake = Math.max(state.shake, v); }

function updateSpawns(dt, L) {
  const isTough = state.level >= 10;

  state.spawnT -= dt;
  const maxEnemies = isTough
    ? Math.min(30, 18 + (state.level - 9) * 2)
    : Math.min(20, 10 + state.level);
  if (state.spawnT <= 0) {
    if (state.enemies.length < maxEnemies) spawnEnemy(pick(L.pool));
    state.spawnT = L.spawn * rand(0.72, 1.18);
  }

  if (L.boss && !state.bossSpawned && state.time <= L.time * 0.62) {
    state.bossSpawned = true;
    state.bossAlive = true;
    spawnEnemy('boss', { bossStyle: L.boss.style });
    showBanner(`⚠ ${L.boss.name} APPROACHING`, 'Stay patient, dodge its volleys & use hazards!', 'warn');
    sfx.warn();
    shakeScreen(0.5);
  }

  // Moving Black Holes
  if (L.holes > 0) {
    state.holeT -= dt;
    if (state.holeT <= 0) {
      if (state.holes.length < L.holes) spawnHole();
      state.holeT = rand(4.5, 7.5);
    }
  }

  // Lightning Storms
  if (L.storm) {
    state.stormT -= dt;
    if (state.stormT <= 0) {
      for (let k = 0; k < L.storm.count; k++) {
        spawnLightning(isTough, k * 0.22);
      }
      state.stormT = L.storm.interval * rand(0.85, 1.15);
    }
  }

  while (state.foods.length < 26) spawnFood();

  // Keep enough diamonds active so 5..75 relic targets feel brisk & achievable
  const maxRelicsOnMap = Math.min(8, 2 + Math.floor(L.relics / 10));
  const remainingRelics = L.relics - state.relics - state.relicItems.length;
  if (remainingRelics > 0 && state.relicItems.length < maxRelicsOnMap) {
    state.relicT -= dt;
    if (state.relicT <= 0) { spawnRelic(); state.relicT = 0.22; }
  }

  const maxPups = isTough ? 2 : 1;
  if (state.pups.length < maxPups) {
    state.pupT -= dt;
    if (state.pupT <= 0) { spawnPup(); state.pupT = isTough ? rand(7, 10.5) : rand(8.5, 12); }
  }
}

/* ---------- PLAYER ---------- */
function movePlayer(dt, L, st) {
  let kx = 0, ky = 0;
  if (codes.KeyW || codes.ArrowUp) ky -= 1;
  if (codes.KeyS || codes.ArrowDown) ky += 1;
  if (codes.KeyA || codes.ArrowLeft) kx -= 1;
  if (codes.KeyD || codes.ArrowRight) kx += 1;
  if (joy) {
    kx += clamp((joy.x - joy.ox) / JOY_R, -1, 1);
    ky += clamp((joy.y - joy.oy) / JOY_R, -1, 1);
  }
  const m = Math.hypot(kx, ky);
  if (m > 1) { kx /= m; ky /= m; }
  if (kx > 0.2) P.dir = 1; else if (kx < -0.2) P.dir = -1;

  P.x += kx * st.speed * dt;
  P.y += ky * st.speed * dt;

  if (L.currents) {
    state.currentT -= dt;
    if (state.currentT <= 0) { state.currentAng = rand(0, Math.PI * 2); state.currentT = rand(4, 7); }
    const curSpd = state.level >= 10 ? 85 : 60;
    P.x += Math.cos(state.currentAng) * curSpd * dt;
    P.y += Math.sin(state.currentAng) * curSpd * dt;
  }
  P.x = clamp(P.x, P.r, W - P.r);
  P.y = clamp(P.y, P.r, H - P.r);

  if (st.hpRegen > 0 && P.hp > 0 && P.hp < st.maxHp) {
    P.hp = Math.min(st.maxHp, P.hp + st.hpRegen * dt);
  }

  P.invuln = Math.max(0, P.invuln - dt);
  P.shieldT = Math.max(0, P.shieldT - dt);
  P.rapidT = Math.max(0, P.rapidT - dt);
  P.multiT = Math.max(0, P.multiT - dt);
  P.magnetT = Math.max(0, P.magnetT - dt);
  P.ammo = Math.min(st.maxAmmo, P.ammo + st.ammoRegen * dt);
  P.wob += dt;
}

function hurt(dmg, cause) {
  if (state.phase !== 'playing' || P.invuln > 0) return;
  if (P.shieldT > 0) {
    P.shieldT = 0;
    P.invuln = 0.6;
    sfx.pickup();
    addPop(P.x, P.y - 30, 'BLOCKED!', '#48dbfb');
    return;
  }
  P.hp -= dmg;
  P.invuln = 0.7;
  shakeScreen(0.35);
  state.flash = 0.35;
  sfx.hit();
  addPop(P.x, P.y - 30, `-${dmg}`, '#ff6b6b');
  if (P.hp <= 0) { P.hp = 0; die(cause, true); }
}

function applyPup(type, st) {
  if (type === 'shield') P.shieldT = 6;
  else if (type === 'rapid') P.rapidT = 7;
  else if (type === 'multi') P.multiT = 8;
  else if (type === 'magnet') P.magnetT = 10; // strictly 10 seconds
  else if (type === 'heal') P.hp = Math.min(st.maxHp, P.hp + 35);
  else if (type === 'mutagen') {
    state.bio += Math.round(20 * st.bioMult);
    state.score += 100;
    P.hp = Math.min(st.maxHp, P.hp + 15);
  }
  addPop(P.x, P.y - 40, PUP_INFO[type].label, PUP_INFO[type].col);
}

function updateShooting(dt, st) {
  P.fireT -= dt;
  if (P.fireT > 0) return;
  let best_ = null, bd = 780;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d < bd) { bd = d; best_ = e; }
  }
  if (best_ && P.ammo >= 2) {
    const baseA = Math.atan2(best_.y - P.y, best_.x - P.x);
    const n = st.shots;
    const spread = 0.13;
    for (let i = 0; i < n; i++) {
      const a = baseA + (i - (n - 1) / 2) * spread;
      state.bullets.push({
        x: P.x, y: P.y,
        vx: Math.cos(a) * st.bulletSpeed,
        vy: Math.sin(a) * st.bulletSpeed,
        dmg: st.bulletDmg,
        pierce: st.pierce,
        hit: new Set(),
        life: 1.35
      });
    }
    P.ammo -= 2;
    P.fireT = st.fireDelay;
    sfx.shoot();
  } else {
    P.fireT = 0.08;
  }
}

/* ---------- WORLD UPDATE ---------- */
function update(dt) {
  const L = LEVELS[state.level];
  const st = getStats();

  state.time -= dt;
  if (state.time <= 0) { state.time = 0; die('Time ran out before you could evolve!', false); return; }

  movePlayer(dt, L, st);
  updateSpawns(dt, L);
  updateHoles(dt);
  if (state.phase !== 'playing') return;
  updateLightnings(dt, st);
  if (state.phase !== 'playing') return;
  updateFood(dt, st);
  updateItems(dt, st);
  updateEnemies(dt, st);
  if (state.phase !== 'playing') return;
  updateShooting(dt, st);
  updateBullets(dt, st);
  updateEnemyBullets(dt);
  if (state.phase !== 'playing') return;
  updateOrbs(dt, st);
  updateFx(dt);
  checkObjectives();
}

function updateHoles(dt) {
  const H_ = state.holes;
  for (let i = H_.length - 1; i >= 0; i--) {
    const h = H_[i];
    h.life -= dt;
    h.r = Math.min(h.maxR, h.r + 36 * dt);
    if (h.life <= 0) { H_.splice(i, 1); continue; }

    // Moving black hole patrol + gentle steering shifts
    h.turnT -= dt;
    if (h.turnT <= 0) {
      h.turnT = rand(2.5, 4.5);
      const curA = Math.atan2(h.vy, h.vx) + rand(-0.7, 0.7);
      const spd = Math.hypot(h.vx, h.vy);
      h.vx = Math.cos(curA) * spd;
      h.vy = Math.sin(curA) * spd;
    }
    h.x += h.vx * dt;
    h.y += h.vy * dt;

    const margin = 72;
    if (h.x < margin)     { h.x = margin;     h.vx = Math.abs(h.vx); }
    if (h.x > W - margin) { h.x = W - margin; h.vx = -Math.abs(h.vx); }
    if (h.y < margin)     { h.y = margin;     h.vy = Math.abs(h.vy); }
    if (h.y > H - margin) { h.y = H - margin; h.vy = -Math.abs(h.vy); }

    const grow = clamp(h.r / h.maxR, 0.1, 1);
    const dx = h.x - P.x, dy = h.y - P.y, d = Math.max(1, Math.hypot(dx, dy));
    if (d < HOLE_PULL) {
      const pull = 200 * grow * (1 - d / HOLE_PULL);
      P.x += (dx / d) * pull * dt;
      P.y += (dy / d) * pull * dt;
    }
    if (P.invuln <= 0 && h.r >= h.maxR * 0.55 && Math.hypot(h.x - P.x, h.y - P.y) < h.r * 0.58) {
      die('Swallowed by a moving black hole!', true);
      return;
    }
  }
}

function updateLightnings(dt, st) {
  const LT = state.lightnings;
  for (let i = LT.length - 1; i >= 0; i--) {
    const l = LT[i];
    if (!l.struck) {
      l.warnT -= dt;
      if (l.warnT <= 0) {
        l.struck = true;
        l.flashT = 0.36;
        sfx.thunder();
        shakeScreen(0.28);
        burst(l.x, l.y, '#aaf6ff', 18);

        if (Math.hypot(P.x - l.x, P.y - l.y) < l.r + P.r * 0.45) {
          hurt(l.dmg, 'Struck by abyssal lightning!');
          if (state.phase !== 'playing') return;
        }

        // Lightning also damages enemies caught inside the strike zone
        const boltDmg = state.level >= 10 ? 5 : 4;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const e = state.enemies[j];
          if (Math.hypot(e.x - l.x, e.y - l.y) < l.r + e.r) {
            e.hp -= boltDmg;
            e.hitT = 0.16;
            if (e.hp <= 0) killEnemy(j, 'shot', st);
          }
        }
      }
    } else {
      l.flashT -= dt;
      if (l.flashT <= 0) LT.splice(i, 1);
    }
  }
}

function updateFood(dt, st) {
  const F = state.foods;
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i];
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.x < -30 || f.x > W + 30 || f.y < -30 || f.y > H + 30) { F.splice(i, 1); continue; }
    const dx = P.x - f.x, dy = P.y - f.y, d0 = Math.max(1, Math.hypot(dx, dy));
    if (d0 < st.pullRange) {
      const pullSpd = P.magnetT > 0 ? 390 : 180;
      f.x += (dx / d0) * pullSpd * dt;
      f.y += (dy / d0) * pullSpd * dt;
    }
    if (Math.hypot(P.x - f.x, P.y - f.y) < P.r + f.r + 2) {
      state.bio += Math.round(6 * st.bioMult);
      state.score += 10;
      sfx.eat();
      burst(f.x, f.y, '#7bed9f', 6);
      F.splice(i, 1);
    }
  }
}

function updateItems(dt, st) {
  const R = state.relicItems;
  for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    // Temporary 10s magnet gently attracts diamonds too
    if (P.magnetT > 0) {
      const dx = P.x - r.x, dy = P.y - r.y, d = Math.max(1, Math.hypot(dx, dy));
      if (d < st.pullRange) {
        r.x += (dx / d) * 260 * dt;
        r.y += (dy / d) * 260 * dt;
      }
    }
    if (Math.hypot(r.x - P.x, r.y - P.y) < P.r + 16) {
      state.relics++;
      state.score += 40;
      sfx.relic();
      burst(r.x, r.y, '#ffd700', 10);
      addPop(r.x, r.y - 14, '💎 +1', '#ffd700');
      R.splice(i, 1);
      state.relicT = 0.22;
    }
  }
  const U = state.pups;
  for (let i = U.length - 1; i >= 0; i--) {
    const p = U[i];
    p.t += dt;
    if (p.t > 12) { U.splice(i, 1); continue; }
    if (Math.hypot(p.x - P.x, p.y - P.y) < P.r + p.r + 4) {
      applyPup(p.type, st);
      burst(p.x, p.y, PUP_INFO[p.type].col, 12);
      sfx.pickup();
      U.splice(i, 1);
    }
  }
}

function updateEnemies(dt, st) {
  const E = state.enemies;
  for (let i = E.length - 1; i >= 0; i--) {
    const e = E[i], def = ENEMY[e.type];
    e.phase += dt;
    e.hitT = Math.max(0, e.hitT - dt);
    e.shockFlash = Math.max(0, e.shockFlash - dt);

    const dx = P.x - e.x, dy = P.y - e.y, d = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / d, uy = dy / d;
    let vx = 0, vy = 0;

    if (e.type === 'drifter') {
      const w = Math.sin(e.phase * 2.2) * 55;
      vx = ux * e.spd - uy * w;
      vy = uy * e.spd + ux * w;
    } else if (e.type === 'spitter') {
      if (d < 260)      { vx = -ux * e.spd;        vy = -uy * e.spd; }
      else if (d > 420) { vx = ux * e.spd;         vy = uy * e.spd; }
      else              { vx = -uy * e.spd * 0.9;  vy = ux * e.spd * 0.9; }
    } else if (e.type === 'charger') {
      if (e.subState === 'stalk') {
        vx = ux * e.spd; vy = uy * e.spd;
        e.fireT -= dt;
        if (e.fireT <= 0 && d < 360) {
          e.subState = 'aim';
          e.subT = 0.68;
          e.aimAng = Math.atan2(dy, dx);
        }
      } else if (e.subState === 'aim') {
        e.subT -= dt;
        if (e.subT > 0.3) e.aimAng = Math.atan2(dy, dx);
        vx = ux * 12; vy = uy * 12;
        if (e.subT <= 0) {
          e.subState = 'dash';
          e.subT = 0.45;
          const dashSpd = state.level >= 10 ? 485 : 445;
          e.dashVx = Math.cos(e.aimAng) * dashSpd;
          e.dashVy = Math.sin(e.aimAng) * dashSpd;
          sfx.dash();
        }
      } else {
        vx = e.dashVx; vy = e.dashVy;
        e.subT -= dt;
        if (e.subT <= 0) {
          e.subState = 'stalk';
          e.fireT = rand(2.2, 3.0);
        }
      }
    } else {
      vx = ux * e.spd;
      vy = uy * e.spd;
    }

    e.x += vx * dt;
    e.y += vy * dt;

    if (e.type === 'shocker') {
      e.shockT -= dt;
      if (e.shockT <= 0) {
        e.shockT = rand(3.1, 3.8);
        e.shockFlash = 0.28;
        sfx.shock();
        if (Math.hypot(P.x - e.x, P.y - e.y) < 115 + P.r * 0.5) {
          hurt(def.dmg, 'Electrocuted by a Volt Jelly!');
          if (state.phase !== 'playing') return;
        }
      }
    }

    if (def.fire) {
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 760) {
        e.fireT = def.fire * rand(0.8, 1.2);
        fireEnemy(e);
      }
    }

    let gone = false;
    for (const h of state.holes) {
      const hx = h.x - e.x, hy = h.y - e.y, hd = Math.hypot(hx, hy);
      if (hd < HOLE_PULL) {
        const pull = 190 * (1 - hd / HOLE_PULL);
        e.x += (hx / Math.max(hd, 1)) * pull * dt;
        e.y += (hy / Math.max(hd, 1)) * pull * dt;
      }
      if (hd < h.r * 0.9 && e.type !== 'boss') {
        killEnemy(i, 'hole', st);
        gone = true;
        break;
      }
    }
    if (gone) continue;

    const cdx = P.x - e.x, cdy = P.y - e.y, cd = Math.max(0.001, Math.hypot(cdx, cdy));
    if (cd < P.r + e.r * 0.85) {
      e.x -= (cdx / cd) * 30;
      e.y -= (cdy / cd) * 30;
      const cause = e.type === 'boss' ? 'The Boss crushed you!' :
                    e.type === 'charger' ? 'Ram-charged by an Abyssal Charger!' : 'You were eaten!';
      hurt(def.dmg, cause);
      if (state.phase !== 'playing') return;
    }
  }
}

function fireEnemy(e) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  if (e.type !== 'boss') {
    state.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, r: 6, life: 4 });
    return;
  }

  const style = e.bossStyle;
  let angles;
  if (style === 'radial') {
    angles = [0, 1, 2, 3, 4, 5].map(k => e.phase + k * (Math.PI / 3));
  } else if (style === 'hydra') {
    angles = [-0.36, -0.12, 0.12, 0.36].map(o => a + o);
  } else if (style === 'titan') {
    angles = [-0.45, -0.22, 0, 0.22, 0.45].map(o => a + o);
    if (state.enemies.length < 24 && Math.random() < 0.45) {
      state.enemies.push(makeEnemy('swarmer', clamp(e.x - 40, 30, W - 30), clamp(e.y, 30, H - 30)));
      state.enemies.push(makeEnemy('swarmer', clamp(e.x + 40, 30, W - 30), clamp(e.y, 30, H - 30)));
    }
  } else if (style === 'omega') {
    if (Math.floor(e.phase) % 2 === 0) {
      angles = [0, 1, 2, 3, 4, 5, 6, 7].map(k => e.phase * 0.7 + k * (Math.PI / 4));
    } else {
      angles = [-0.42, -0.21, 0, 0.21, 0.42].map(o => a + o);
    }
    if (state.enemies.length < 26 && Math.random() < 0.4) {
      state.enemies.push(makeEnemy('swarmer', clamp(e.x + rand(-50, 50), 30, W - 30), clamp(e.y + rand(-50, 50), 30, H - 30)));
    }
  } else {
    angles = [-0.3, 0, 0.3].map(o => a + o);
  }

  const spd = style === 'omega' ? 255 : 230;
  for (const ang of angles) {
    state.eBullets.push({
      x: e.x, y: e.y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      r: 9, life: 4.2
    });
  }
}

function killEnemy(idx, how, st) {
  const e = state.enemies[idx], def = ENEMY[e.type];
  state.enemies.splice(idx, 1);
  const swallowed = how === 'hole';
  const pts = swallowed ? Math.round(def.pts / 2) : def.pts;
  const rawBio = swallowed ? Math.round(def.bio / 2) : def.bio;
  state.score += pts;
  state.bio += Math.round(rawBio * st.bioMult);

  if (e.type === 'splitter' && !swallowed) {
    for (const off of [-20, 20]) {
      const sx = clamp(e.x + off, 24, W - 24);
      const sy = clamp(e.y + rand(-16, 16), 24, H - 24);
      state.enemies.push(makeEnemy('swarmer', sx, sy));
    }
    addPop(e.x, e.y - 30, 'SPLIT!', '#70a1ff');
  }

  if (e.type === 'boss') {
    state.bossAlive = false;
    state.score += 350;
    const bossName = LEVELS[state.level].boss ? LEVELS[state.level].boss.name : 'BOSS';
    sfx.win();
    shakeScreen(0.6);
    addPop(e.x, e.y - 90, `${bossName} DEFEATED! +350`, '#ffd700');
  } else if (swallowed) {
    sfx.suck();
  } else {
    sfx.kill();
  }

  burst(e.x, e.y, LEVELS[state.level].enemy, e.type === 'boss' ? 50 : 14);
  const orbs = e.type === 'swarmer' ? 1 : swallowed ? 5 : 3;
  for (let k = 0; k < orbs; k++) addOrb(e.x, e.y);
  addPop(e.x, e.y - e.r - 6, swallowed ? `Swallowed +${pts}` : `+${pts}`,
         swallowed ? '#b983ff' : '#ffffff');
}

function updateBullets(dt, st) {
  const B = state.bullets;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { B.splice(i, 1); continue; }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (b.hit.has(e.id)) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 5) {
        b.hit.add(e.id);
        e.hp -= b.dmg;
        e.hitT = 0.12;
        burst(b.x, b.y, '#ffffff', 3);
        if (e.hp <= 0) killEnemy(j, 'shot', st);

        if (b.pierce > 0) {
          b.pierce--;
        } else {
          B.splice(i, 1);
          break;
        }
      }
    }
  }
}

function updateEnemyBullets(dt) {
  const B = state.eBullets;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { B.splice(i, 1); continue; }
    if (Math.hypot(b.x - P.x, b.y - P.y) < P.r + b.r) {
      B.splice(i, 1);
      hurt(12, 'Hit by a toxic spine!');
      if (state.phase !== 'playing') return;
    }
  }
}

function updateOrbs(dt, st) {
  const O = state.orbs;
  for (let i = O.length - 1; i >= 0; i--) {
    const o = O[i];
    o.life -= dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.vx *= 0.94;
    o.vy *= 0.94;
    const dx = P.x - o.x, dy = P.y - o.y, d0 = Math.max(1, Math.hypot(dx, dy));
    const orbRange = st.pullRange + 15;
    if (d0 < orbRange) {
      o.x += (dx / d0) * 410 * dt;
      o.y += (dy / d0) * 410 * dt;
    }
    if (o.life <= 0) { O.splice(i, 1); continue; }
    if (Math.hypot(P.x - o.x, P.y - o.y) < P.r + o.r + 2) {
      P.ammo = Math.min(st.maxAmmo, P.ammo + 12);
      sfx.eat();
      O.splice(i, 1);
    }
  }
}

function updateFx(dt) {
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) state.parts.splice(i, 1);
  }
  for (let i = state.pops.length - 1; i >= 0; i--) {
    const p = state.pops[i];
    p.y -= 35 * dt;
    p.life -= dt;
    if (p.life <= 0) state.pops.splice(i, 1);
  }
}

/* ---------- RENDER ---------- */
function drawLightnings(t) {
  for (const l of state.lightnings) {
    ctx.save();
    if (!l.struck) {
      const p = clamp(1 - l.warnT / l.maxWarn, 0, 1);
      // Danger zone fill
      ctx.fillStyle = `rgba(120,235,255,${0.08 + p * 0.22})`;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();

      // Outer dashed ring
      ctx.strokeStyle = `rgba(170,246,255,${0.45 + p * 0.55})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 7]);
      ctx.lineDashOffset = -t * 70;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // Contracting timing ring
      ctx.strokeStyle = p > 0.72 ? '#ffffff' : '#54e8ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r * (1 - p), 0, Math.PI * 2); ctx.stroke();

      // Center bolt warning icon
      ctx.fillStyle = p > 0.7 ? '#fff' : '#8ef4ff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚡', l.x, l.y);
    } else {
      const alpha = clamp(l.flashT / 0.36, 0, 1);
      // Ground impact burst
      const rg = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r * 1.15);
      rg.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
      rg.addColorStop(0.5, `rgba(100,235,255,${alpha * 0.55})`);
      rg.addColorStop(1, 'rgba(80,200,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r * 1.15, 0, Math.PI * 2); ctx.fill();

      // Jagged sky-to-water lightning bolt
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.shadowColor = '#6ef3ff';
      ctx.shadowBlur = 22;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(l.x + Math.sin(l.seed) * 30, -20);
      const segs = 7;
      for (let s = 1; s < segs; s++) {
        const py = (-20) + ((l.y + 20) * s) / segs;
        const px = l.x + Math.sin(l.seed * 7 + s * 4.3 + t * 50) * 26;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEnemy(e, L, t) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'shocker') {
    if (e.shockT < 0.8) {
      const p = 1 - e.shockT / 0.8;
      ctx.strokeStyle = `rgba(0,245,255,${0.35 + p * 0.55})`;
      ctx.lineWidth = 2 + p * 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, 115, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.shockFlash > 0) {
      ctx.fillStyle = `rgba(0,245,255,${e.shockFlash * 0.9})`;
      ctx.beginPath(); ctx.arc(0, 0, 115, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (e.type === 'charger' && e.subState === 'aim') {
    ctx.strokeStyle = 'rgba(255,75,90,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(e.aimAng) * 260, Math.sin(e.aimAng) * 260);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.shadowColor = e.type === 'shocker' ? '#00f5ff' : L.enemy;
  ctx.shadowBlur = e.type === 'boss' ? 30 : 14;
  ctx.fillStyle = e.hitT > 0 ? '#ffffff' : (e.type === 'charger' && e.subState === 'aim' ? '#ff4757' : L.enemy);

  if (e.type === 'drifter') {
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.45 + Math.sin(e.phase * 3) * 2, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'hunter' || e.type === 'swarmer') {
    ctx.rotate(Math.atan2(P.y - e.y, P.x - e.x));
    ctx.beginPath();
    ctx.moveTo(e.r * 1.25, 0);
    ctx.lineTo(-e.r * 0.8, e.r * 0.85);
    ctx.lineTo(-e.r * 0.4, 0);
    ctx.lineTo(-e.r * 0.8, -e.r * 0.85);
    ctx.closePath(); ctx.fill();
  } else if (e.type === 'spitter') {
    ctx.rotate(t * 1.5);
    ctx.beginPath();
    ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0);
    ctx.closePath(); ctx.fill();
    ctx.rotate(-t * 1.5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.15, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'charger') {
    const ang = e.subState === 'stalk' ? Math.atan2(P.y - e.y, P.x - e.x) : e.aimAng;
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(e.r * 1.45, 0);
    ctx.lineTo(0, e.r * 0.85);
    ctx.lineTo(-e.r * 1.0, e.r * 0.45);
    ctx.lineTo(-e.r * 0.7, 0);
    ctx.lineTo(-e.r * 1.0, -e.r * 0.45);
    ctx.lineTo(0, -e.r * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e.r * 0.35, -e.r * 0.25, 3, 0, Math.PI * 2); ctx.arc(e.r * 0.35, e.r * 0.25, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'shocker') {
    ctx.fillStyle = e.hitT > 0 ? '#ffffff' : '#00e5ff';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = t * 2.5 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? e.r * 1.1 : e.r * 0.55;
      if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#033';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (e.type === 'splitter') {
    const wob = Math.sin(e.phase * 4) * 2;
    ctx.beginPath();
    ctx.arc(-e.r * 0.32, 0, e.r * 0.68 + wob * 0.4, 0, Math.PI * 2);
    ctx.arc(e.r * 0.32, 0, e.r * 0.68 - wob * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(-e.r * 0.32, 0, e.r * 0.26, 0, Math.PI * 2);
    ctx.arc(e.r * 0.32, 0, e.r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  } else {
    if (e.bossStyle === 'radial') {
      ctx.strokeStyle = L.enemy;
      ctx.lineWidth = 8;
      for (let k = 0; k < 6; k++) {
        const a = t * 1.2 + k * (Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(a + 0.3) * e.r * 1.1, Math.sin(a + 0.3) * e.r * 1.1,
                             Math.cos(a) * e.r * 1.5, Math.sin(a) * e.r * 1.5);
        ctx.stroke();
      }
    } else if (e.bossStyle === 'omega') {
      ctx.strokeStyle = 'rgba(255,71,87,0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = t * 2 + k * (Math.PI / 6);
        ctx.moveTo(Math.cos(a) * e.r * 0.9, Math.sin(a) * e.r * 0.9);
        ctx.lineTo(Math.cos(a) * e.r * 1.38, Math.sin(a) * e.r * 1.38);
      }
      ctx.stroke();
    }

    ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.72 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-e.r * 0.3, -e.r * 0.1, e.r * 0.14, 0, Math.PI * 2);
    ctx.arc(e.r * 0.3, -e.r * 0.1, e.r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-64, -e.r - 22, 128, 9);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(-64, -e.r - 22, 128 * clamp(e.hp / e.maxHp, 0, 1), 9);
  }
  ctx.restore();
}

function drawPlayer(t) {
  if (state.phase === 'playing' && P.invuln > 0 && Math.floor(t * 16) % 2 === 0) return;
  const st = state.level, s = 1 + st * 0.025;
  const bob = Math.sin(P.wob * 5) * 2;
  const leg = Math.sin(P.wob * 10) * 4;

  ctx.save();
  ctx.translate(P.x, P.y + bob);

  if (P.shieldT > 0) {
    ctx.strokeStyle = `rgba(72,219,251,${0.55 + Math.sin(t * 9) * 0.25})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, P.r * 2.2 + Math.sin(t * 6) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (P.magnetT > 0) {
    ctx.strokeStyle = `rgba(84,160,255,${0.38 + Math.sin(t * 10) * 0.2})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 8]);
    ctx.lineDashOffset = -t * 50;
    ctx.beginPath(); ctx.arc(0, 0, 48 + Math.sin(t * 7) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (P.rapidT > 0 || P.multiT > 0) {
    ctx.fillStyle = P.multiT > 0 ? '#ff9ff3' : '#ffa502';
    for (let k = 0; k < 4; k++) {
      const a = t * 6 + k * Math.PI / 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (mutRank('vital') > 0) {
    ctx.strokeStyle = 'rgba(255,215,120,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, P.r * 1.45, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.scale(s * P.dir, s);

  if (st === 0) {
    ctx.fillStyle = '#8ff7d0';
    ctx.beginPath(); ctx.arc(0, 0, 15 + Math.sin(P.wob * 5) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f8a7a';
    ctx.beginPath(); ctx.arc(3, 2, 5, 0, Math.PI * 2); ctx.fill();
  } else if (st === 1) {
    ctx.fillStyle = '#9ff0e0';
    for (const [x, y] of [[-7, -4], [8, -2], [1, 8], [-4, 6]]) {
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    }
  } else if (st === 2) {
    ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, -5); ctx.lineTo(25, -11); ctx.moveTo(14, 5); ctx.lineTo(25, 11); ctx.stroke();
    ctx.fillStyle = '#c89b6e';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b4226'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, 12); ctx.moveTo(4, -12); ctx.lineTo(4, 12); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(10, -4, 2.5, 0, Math.PI * 2); ctx.arc(10, 4, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (st === 3) {
    const tail = Math.sin(P.wob * 12) * 5;
    ctx.fillStyle = '#00ffff';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-29, -10 + tail); ctx.lineTo(-29, 10 + tail); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(8, -3, 3, 0, Math.PI * 2); ctx.fill();
  } else if (st === 4) {
    const tail = Math.sin(P.wob * 10) * 5;
    ctx.fillStyle = '#3dc1d3';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-32, -12 + tail); ctx.lineTo(-26, tail); ctx.lineTo(-32, 12 + tail); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#227093';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ed6df';
    ctx.beginPath(); ctx.arc(-4, -3, 3, 0, Math.PI * 2); ctx.arc(4, 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(11, -3, 3, 0, Math.PI * 2); ctx.fill();
  } else if (st === 5) {
    ctx.fillStyle = '#2ed573';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-10, 10, 5, 10 + leg * 0.3);
    ctx.fillRect(5, 10, 5, 10 - leg * 0.3);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.arc(-8, -5, 3, 0, Math.PI * 2); ctx.fill();
  } else if (st === 6) {
    ctx.strokeStyle = '#a2d149'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-30, -8 + leg, -40, 4 + leg); ctx.stroke();
    ctx.fillStyle = '#a2d149';
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-10, 8, 5, 9 + leg * 0.4); ctx.fillRect(5, 8, 5, 9 - leg * 0.4);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(8, -3, 3, 0, Math.PI * 2); ctx.fill();
  } else if (st === 7) {
    const w = Math.sin(P.wob * 10) * 6;
    ctx.strokeStyle = '#00d2d3'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(-8, -10 + w, -24, 4 - w); ctx.lineTo(-38, -2 + w); ctx.stroke();
    ctx.fillStyle = '#48dbfb';
    ctx.beginPath(); ctx.ellipse(12, 0, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(2, -16); ctx.lineTo(14, -8); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(16, -2, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (st === 8) {
    ctx.fillStyle = '#ff793f';
    ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-34, -4 + leg * 0.5); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 11, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -12, 11, 7, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffda79';
    ctx.beginPath(); ctx.moveTo(6, -18); ctx.lineTo(0, -25); ctx.lineTo(12, -18); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(15, -13, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (st === 9) {
    ctx.fillStyle = '#f0c070';
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-9, -30, 5, 0, Math.PI * 2); ctx.arc(9, -30, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(4, -22, 2, 0, Math.PI * 2); ctx.arc(-4, -22, 2, 0, Math.PI * 2); ctx.fill();
  } else if (st === 10) {
    ctx.fillStyle = '#a4b0be';
    ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-34, -4 + leg * 0.6); ctx.lineTo(-16, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 2, 19, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -7, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(8, -24); ctx.lineTo(16, -16); ctx.fill();
    ctx.fillStyle = '#70a1ff';
    ctx.beginPath(); ctx.arc(18, -8, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (st === 11) {
    ctx.fillStyle = '#f0a060';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -20, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f0a060'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-22, 8 + leg); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -4); ctx.lineTo(22, 8 - leg); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(4, -22, 2, 0, Math.PI * 2); ctx.arc(-4, -22, 2, 0, Math.PI * 2); ctx.fill();
  } else if (st === 12) {
    ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(18, -22); ctx.stroke();
    ctx.fillStyle = '#a47148';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6b89c';
    ctx.beginPath(); ctx.arc(0, -23, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(-8, 15 + leg * 0.3, 6, 14);
    ctx.fillRect(2, 15 - leg * 0.3, 6, 14);
  } else if (st === 13) {
    ctx.fillStyle = '#f0c0a0';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -24, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#38ada9';
    ctx.fillRect(-10, -14, 20, 22);
    ctx.fillStyle = '#2d3a5a';
    ctx.fillRect(-8, 15 + leg * 0.3, 6, 15);
    ctx.fillRect(2, 15 - leg * 0.3, 6, 15);
  } else {
    ctx.shadowColor = '#ff4757'; ctx.shadowBlur = 26;
    ctx.fillStyle = '#b71540';
    ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-32, 26 + leg); ctx.lineTo(20, 26 - leg); ctx.lineTo(6, -14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -37, 13, 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fafafa';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -24, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4757';
    ctx.beginPath(); ctx.arc(4, -24, 2.2, 0, Math.PI * 2); ctx.arc(-4, -24, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, 15 + leg * 0.3, 6, 15);
    ctx.fillRect(2, 15 - leg * 0.3, 6, 15);
  }

  ctx.restore();
}

function render() {
  const L = LEVELS[state.level], t = state.clock;
  ctx.save();
  if (state.shake > 0) {
    ctx.translate(rand(-10, 10) * state.shake, rand(-10, 10) * state.shake);
  }

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.bg[0]);
  g.addColorStop(1, L.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (let i = 0; i < 40; i++) {
    const sp = 18 + (i % 5) * 10;
    const y = H - mod(t * sp + i * 97, H + 40) + 20;
    const x = (i * 211) % W + Math.sin(t * 0.7 + i) * 16;
    ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2); ctx.fill();
  }

  if (L.currents) {
    const cx = Math.cos(state.currentAng), cy = Math.sin(state.currentAng);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const off = mod(t * 180 + i * 53, 260);
      const x = mod(i * 157 + cx * off, W), y = mod(i * 271 + cy * off, H);
      ctx.moveTo(x, y); ctx.lineTo(x + cx * 34, y + cy * 34);
    }
    ctx.stroke();
  }

  // Moving Black Holes (with faint motion wake)
  for (const h of state.holes) {
    ctx.save();
    ctx.translate(h.x, h.y);
    const vAng = Math.atan2(h.vy, h.vx);
    ctx.fillStyle = 'rgba(130,40,255,0.14)';
    ctx.beginPath();
    ctx.arc(-Math.cos(vAng) * 26, -Math.sin(vAng) * 26, h.r * 0.85, 0, Math.PI * 2);
    ctx.fill();

    const rg = ctx.createRadialGradient(0, 0, h.r * 0.2, 0, 0, h.r * 1.6 + 1);
    rg.addColorStop(0, '#000');
    rg.addColorStop(0.55, 'rgba(40,0,70,0.95)');
    rg.addColorStop(1, 'rgba(120,0,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, h.r * 1.6 + 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(190,120,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.lineDashOffset = -t * 70;
    ctx.beginPath(); ctx.arc(0, 0, h.r * 1.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // Lightning warnings & strikes
  drawLightnings(t);

  ctx.fillStyle = '#7bed9f';
  for (const f of state.foods) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (const f of state.foods) { ctx.beginPath(); ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.35, 0, Math.PI * 2); ctx.fill(); }

  for (const r of state.relicItems) {
    ctx.save();
    ctx.translate(r.x, r.y + Math.sin(r.bob + t * 3) * 3);
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(0, -15); ctx.lineTo(12, 0); ctx.lineTo(0, 15); ctx.lineTo(-12, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  for (const p of state.pups) {
    const info = PUP_INFO[p.type], pulse = 1 + Math.sin(t * 6) * 0.08;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = 0.35; ctx.fillStyle = info.col;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.icon, 0, 1);
    ctx.restore();
  }

  ctx.fillStyle = '#0abde3';
  for (const o of state.orbs) { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); }

  for (const e of state.enemies) drawEnemy(e, L, t);

  ctx.fillStyle = '#ff4757'; ctx.shadowColor = '#ff4757'; ctx.shadowBlur = 10;
  for (const b of state.eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;

  ctx.fillStyle = mutRank('damage') > 0 ? '#ffeaa7' : '#e8fbff';
  ctx.shadowColor = mutRank('damage') > 0 ? '#ffa502' : '#7fdfff';
  ctx.shadowBlur = 10;
  for (const b of state.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, mutRank('pierce') > 0 ? 5 : 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;

  drawPlayer(t);

  for (const p of state.parts) {
    ctx.globalAlpha = clamp(p.life / 0.8, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x, p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;

  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  for (const p of state.pops) {
    ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.col;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255,40,60,${state.flash * 0.45})`;
    ctx.fillRect(-30, -30, W + 60, H + 60);
  }

  ctx.restore();
}

/* ---------- HUD ---------- */
function updateHUD() {
  const L = LEVELS[state.level];
  const st = getStats();
  setText('lvl-name', `${state.level + 1}/${LEVELS.length} · ${L.name}`);
  const t = Math.max(0, Math.ceil(state.time));
  setText('timer', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  el('timer').classList.toggle('danger', t <= 10 && state.phase === 'playing');
  setText('o-bio', `🟢 ${Math.min(Math.floor(state.bio), L.bio)}/${L.bio}`);
  setText('o-relic', `💎 ${Math.min(state.relics, L.relics)}/${L.relics}`);
  setText('score', state.score);

  el('hp-fill').style.width = clamp((P.hp / st.maxHp) * 100, 0, 100) + '%';
  el('ammo-fill').style.width = clamp((P.ammo / st.maxAmmo) * 100, 0, 100) + '%';

  let pw = '';
  if (P.shieldT > 0) pw += `🛡️ ${Math.ceil(P.shieldT)}s  `;
  if (P.rapidT > 0)  pw += `⚡ ${Math.ceil(P.rapidT)}s  `;
  if (P.multiT > 0)  pw += `🔱 ${Math.ceil(P.multiT)}s  `;
  if (P.magnetT > 0) pw += `🧲 ${Math.ceil(P.magnetT)}s`;
  setText('pow', pw.trim());

  const mutSummary = Object.keys(state.muts)
    .filter(k => state.muts[k] > 0 && MUT_MAP[k])
    .map(k => `${MUT_MAP[k].icon}${state.muts[k]}`)
    .join('  ');
  setText('mut-hud', mutSummary);
}

function updateJoyVisual() {
  const ring = el('joy-ring'), knob = el('joy-knob');
  if (joy && state.phase === 'playing') {
    ring.classList.add('on');
    ring.style.left = joy.ox + 'px';
    ring.style.top = joy.oy + 'px';
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy;
    const m = Math.hypot(dx, dy);
    if (m > JOY_R) { dx = (dx / m) * JOY_R; dy = (dy / m) * JOY_R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  } else {
    ring.classList.remove('on');
  }
}

function animate(dt) {
  state.clock += dt;
  state.shake = Math.max(0, state.shake - dt * 2.2);
  state.flash = Math.max(0, state.flash - dt * 2.5);
  if (state.bannerT > 0) {
    state.bannerT -= dt;
    if (state.bannerT <= 0) el('banner').classList.remove('show');
  }
  const inGame = state.phase !== 'menu';
  el('hud').classList.toggle('on', inGame);
  if (inGame) updateHUD();
  updateJoyVisual();
}

/* ---------- INPUT (layout-independent via e.code) ---------- */
const NAV_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

window.addEventListener('keydown', e => {
  const c = e.code;
  if (NAV_CODES.has(c)) e.preventDefault();

  sfx.hiddenMuted = !!document.hidden;
  sfx.init();
  codes[c] = true;

  if (e.repeat) return;
  if (c === 'KeyP' || c === 'Escape') togglePause();
  if (c === 'KeyM') toggleMute();

  if (screenName === 'levelup' && mutChoices.length > 0) {
    if (c === 'Digit1' || c === 'Numpad1') selectMutation(0);
    else if (c === 'Digit2' || c === 'Numpad2') selectMutation(1);
    else if (c === 'Digit3' || c === 'Numpad3') selectMutation(2);
    else if (c === 'ArrowLeft')  selectMutation((selectedMutIdx - 1 + mutChoices.length) % mutChoices.length);
    else if (c === 'ArrowRight') selectMutation((selectedMutIdx + 1) % mutChoices.length);
  }

  if ((c === 'Enter' || c === 'Space') && screenName && PRIMARY[screenName] &&
      !(e.target instanceof HTMLButtonElement) && performance.now() - screenEnteredAt > 350) {
    e.preventDefault();
    el(PRIMARY[screenName]).click();
  }
});

window.addEventListener('keyup', e => { codes[e.code] = false; });

stage.addEventListener('pointerdown', e => {
  sfx.hiddenMuted = !!document.hidden;
  sfx.init();
  if (state.phase !== 'playing' || isPortrait || joy !== null) return;
  if (e.target.closest && e.target.closest('button')) return;
  const p = toWorld(e.clientX, e.clientY);
  joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
  if (stage.setPointerCapture) {
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  }
});

stage.addEventListener('pointermove', e => {
  if (!joy || e.pointerId !== joy.id) return;
  const p = toWorld(e.clientX, e.clientY);
  joy.x = p.x; joy.y = p.y;
});

const endJoy = e => {
  if (joy && e.pointerId === joy.id) joy = null;
};
stage.addEventListener('pointerup', endJoy);
stage.addEventListener('pointercancel', endJoy);
stage.addEventListener('lostpointercapture', endJoy);

/* ---------- LIFECYCLE, FOCUS & BROWSER PROTECTIONS ---------- */
const onBlurOrHide = () => {
  sfx.hiddenMuted = true;
  sfx.sync();
  clearInputs();
  if (state.phase === 'playing') pauseGame(false);
};

const onFocusOrShow = () => {
  sfx.hiddenMuted = !!document.hidden;
  sfx.sync();
};

window.addEventListener('blur', onBlurOrHide);
window.addEventListener('focus', onFocusOrShow);
window.addEventListener('pagehide', onBlurOrHide);
window.addEventListener('pageshow', onFocusOrShow);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onBlurOrHide();
  else onFocusOrShow();
});

window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });

/* ---------- BUTTON WIRING ---------- */
const on = (id, fn) => el(id).addEventListener('click', fn);
on('btn-continue', onContinue);
on('btn-play', onPlay);
on('btn-how', () => showTutorial(true));
on('btn-tut-next', tutNext);
on('btn-tut-skip', tutDone);
on('btn-next', nextLevel);
on('btn-revive', reviveWithAd);
on('btn-retry', retryLevel);
on('btn-restart', startOver);
on('btn-again', startOver);
on('btn-pause', () => pauseGame(false));
on('btn-resume', resumeGame);
on('btn-quit', () => {
  clearInputs();
  pausedByPlatform = false;
  sfx.pausedMuted = false;
  sfx.sync();
  state.phase = 'menu';
  showScreen('title');
});
on('btn-mute', toggleMute);

/* ---------- LOOP & BOOT ---------- */
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.033);
  last = now;
  if (state.phase === 'playing' && !isPortrait) update(dt);
  animate(dt);
  render();
  requestAnimationFrame(frame);
}

el('btn-mute').textContent = sfx.muted ? '🔇' : '🔊';
showScreen('title');
layout();
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 250));
requestAnimationFrame(frame);

Yandex.init(onPlatformPause, onPlatformResume).then(() => {
  syncFromStorage();
  requestAnimationFrame(() => Yandex.loadingReady());
});

})();

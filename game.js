(() => {
'use strict';

/* ============================================================
   EVOLVE — Cell → Human  (final itch.io edition)
   Two files: index.html + game.js. No assets. No dependencies.
   ============================================================ */

/* ---------- 1. CANVAS & ADAPTIVE SCALING ---------- */
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
let VW = 0, VH = 0, DPR = 1, ES = 1;

const world = { w: 3200, h: 3200 };
const cam   = { x: 0, y: 0 };
const shake = { x: 0, y: 0, mag: 0 };

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth;
  VH = window.innerHeight;
  cvs.width  = Math.floor(VW * DPR);
  cvs.height = Math.floor(VH * DPR);
  cvs.style.width  = VW + 'px';
  cvs.style.height = VH + 'px';
  ES = Math.max(0.85, Math.min(1.5, Math.min(VW, VH) / 900));
  world.w = Math.max(world.w, VW * 1.5);
  world.h = Math.max(world.h, VH * 1.5);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

/* ---------- 2. CSS + DOM INJECTION ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
  .ui-layer {
    position: fixed; inset: 0; pointer-events: none;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #cfe9ff; user-select: none; -webkit-user-select: none;
    z-index: 10;
  }

  /* ---- HUD top-left ---- */
  #hud {
    position: absolute; top: 14px; left: 14px;
    font-size: 14px; line-height: 1.5; text-shadow: 0 1px 6px #000;
  }
  #hud b { font-size: 22px; color: #8ef3c8; font-variant-numeric: tabular-nums; }
  #hud .label { opacity: .7; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; }
  #hud .bar { width: 200px; height: 7px; background: #0d2233; border: 1px solid #24486a;
              border-radius: 4px; margin: 3px 0 8px; overflow: hidden; }
  #hud .bar > i { display: block; height: 100%; width: 0; border-radius: 4px;
                  transition: width .18s ease; }
  #hpFill   { background: linear-gradient(90deg, #ff5f6d, #ffc371); }
  #progFill { background: linear-gradient(90deg, #39d0ff, #7CFFB2); }
  #pips { display: flex; gap: 5px; align-items: center; margin-top: 8px; min-height: 14px; }
  #pips .pip { width: 9px; height: 9px; border-radius: 50%;
               transition: width .2s, height .2s, opacity .2s;
               box-shadow: 0 0 6px currentColor; }

  /* ---- Score top-center ---- */
  #score-wrap {
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    text-align: center; text-shadow: 0 2px 10px #000, 0 0 24px #2af;
  }
  #score {
    font-size: 32px; font-weight: 800; letter-spacing: .04em;
    color: #e8f8ff; font-variant-numeric: tabular-nums;
  }
  #combo {
    font-size: 15px; font-weight: 700; margin-top: 2px;
    color: #ffe07a; opacity: 0; transition: opacity .2s;
    font-variant-numeric: tabular-nums;
  }
  #combo.on { opacity: 1; }

  /* ---- Toast ---- */
  #toast {
    position: absolute; left: 50%; top: 18%; transform: translateX(-50%);
    text-align: center; pointer-events: none;
    font-size: clamp(16px, 3vw, 26px); font-weight: 700;
    opacity: 0; transition: opacity .4s ease;
    text-shadow: 0 2px 18px #000, 0 0 40px #2af; white-space: nowrap;
  }
  #toast small {
    display: block; font-size: clamp(11px, 1.6vw, 14px);
    font-weight: 400; opacity: .9; margin-top: 6px; color: #9fd;
  }

  /* ---- Top-right buttons ---- */
  #mute {
    position: absolute; top: 14px; right: 14px;
    width: 38px; height: 38px; border-radius: 50%;
    background: rgba(9, 26, 42, .8); border: 1px solid #24486a;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; cursor: pointer; pointer-events: auto;
    transition: transform .1s, background .1s;
    -webkit-tap-highlight-color: transparent;
  }
  #mute:hover { background: rgba(20, 50, 80, .9); }
  #mute:active { transform: scale(.94); }

  #fullscreen {
    position: absolute; top: 14px; right: 62px;
    width: 38px; height: 38px; border-radius: 50%;
    background: rgba(9, 26, 42, .8); border: 1px solid #24486a;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; cursor: pointer; pointer-events: auto;
    transition: transform .1s, background .1s;
    -webkit-tap-highlight-color: transparent;
  }
  #fullscreen:hover { background: rgba(20, 50, 80, .9); }
  #fullscreen:active { transform: scale(.94); }

  /* ---- Hint ---- */
  #hint {
    position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
    font-size: clamp(10px, 1.4vw, 12px); color: #6b96b8; text-align: center;
    text-shadow: 0 1px 4px #000; max-width: 90vw;
    transition: opacity .4s; opacity: .85;
  }

  /* ---- Full-screen overlays ---- */
  .screen {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center; padding: 20px;
    background: rgba(2, 8, 16, .72);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    pointer-events: auto; cursor: pointer;
    transition: opacity .35s ease;
    overflow-y: auto;
  }
  .screen.hidden { opacity: 0; pointer-events: none; }

  .screen h1 {
    margin: 0; font-size: clamp(36px, 9vw, 74px); font-weight: 900;
    letter-spacing: .06em; color: #8ef3c8;
    text-shadow: 0 0 30px #2af, 0 4px 20px #000;
  }
  .screen h2 {
    margin: 0 0 4px; font-size: clamp(24px, 6vw, 42px); font-weight: 800;
    color: #ffe89a; text-shadow: 0 0 24px #fc0, 0 2px 12px #000;
  }
  .screen .tagline {
    font-size: clamp(12px, 2vw, 17px); opacity: .8; margin: 12px 0 24px;
    color: #9fd; max-width: 480px; line-height: 1.5;
  }
  .screen .best {
    font-size: clamp(11px, 1.6vw, 14px); opacity: .7; margin-top: 20px;
    letter-spacing: .05em; text-transform: uppercase;
  }
  .screen .best b { color: #ffe07a; font-size: 1.2em; }
  .screen button, .screen .btn {
    display: inline-block; margin-top: 18px;
    background: linear-gradient(135deg, #2d6b9a, #1a3a5a);
    color: #e8f8ff; border: 1px solid #4aa3ff;
    padding: 14px 32px; border-radius: 10px;
    font-size: clamp(15px, 2.4vw, 18px); font-weight: 700;
    cursor: pointer; letter-spacing: .06em;
    box-shadow: 0 4px 20px rgba(60, 160, 240, .3);
    transition: transform .1s, box-shadow .15s;
    -webkit-tap-highlight-color: transparent;
    font-family: inherit;
  }
  .screen button:hover, .screen .btn:hover {
    box-shadow: 0 6px 28px rgba(80, 180, 255, .5);
  }
  .screen button:active, .screen .btn:active { transform: scale(.97); }

  .screen .stats {
    background: rgba(9, 26, 42, .7);
    border: 1px solid #24486a; border-radius: 12px;
    padding: 18px 26px; margin: 12px 0;
    font-size: clamp(12px, 1.8vw, 15px);
    display: flex; flex-direction: column; gap: 6px;
    min-width: 240px;
  }
  .screen .stats .row {
    display: flex; justify-content: space-between; gap: 20px;
  }
  .screen .stats .row .k { opacity: .7; }
  .screen .stats .row .v { font-weight: 700; color: #e8f8ff; font-variant-numeric: tabular-nums; }
  .screen .stats .row.highlight .v { color: #ffe07a; }
  .screen .newbest {
    font-size: clamp(14px, 2.4vw, 20px); font-weight: 800;
    color: #ffe07a; letter-spacing: .1em; margin-bottom: 8px;
    text-shadow: 0 0 16px #fc0;
    display: none;
  }
  .screen.newbest .newbest { display: block; }

  .screen .runs {
    margin-top: 14px; font-size: 11px; opacity: .65;
    letter-spacing: .04em;
  }
  .screen .runs .r {
    display: inline-block; margin: 0 6px;
    font-variant-numeric: tabular-nums;
  }

  /* Mobile tweaks */
  @media (max-width: 700px){
    #hud { font-size: 12px; top: 10px; left: 10px; }
    #hud b { font-size: 18px; }
    #hud .bar { width: 140px; height: 6px; }
    #score-wrap { top: 10px; }
    #score { font-size: 22px; }
    #combo { font-size: 12px; }
    #mute { top: 10px; right: 10px; width: 34px; height: 34px; font-size: 16px; }
    #fullscreen { top: 10px; right: 52px; width: 34px; height: 34px; font-size: 16px; }
    #hint { display: none; }
  }
</style>`);

document.body.insertAdjacentHTML('beforeend', `
  <div class="ui-layer">
    <div id="hud">
      <div class="label">Biomass</div>
      <b id="bio">0</b>
      <div class="label" style="margin-top:6px">Health</div>
      <div class="bar"><i id="hpFill"></i></div>
      <div id="stageName" style="font-weight:600">Primordial Ocean</div>
      <div class="bar"><i id="progFill"></i></div>
      <div id="pips"></div>
    </div>

    <div id="score-wrap">
      <div id="score">0</div>
      <div id="combo">×1 COMBO</div>
    </div>

    <div id="fullscreen" title="Fullscreen">⛶</div>
    <div id="mute" title="Mute">🔊</div>
    <div id="toast"></div>
    <div id="hint">Hold anywhere to swim · collect relics to evolve</div>

    <div class="screen" id="s-title">
      <h1>EVOLVE</h1>
      <div class="tagline">From a single cell to a human.<br>Eat, grow, find relics — become what you are meant to be.</div>
      <button id="btn-start">Tap to Start</button>
      <div class="best">Best score &nbsp;<b id="title-best">—</b></div>
    </div>

    <div class="screen hidden" id="s-dead">
      <div class="newbest">★ NEW BEST ★</div>
      <h2>You were eaten</h2>
      <div class="stats" id="dead-stats"></div>
      <button id="btn-restart">Play Again</button>
      <div class="runs" id="dead-runs"></div>
    </div>

    <div class="screen hidden" id="s-won">
      <div class="newbest">★ NEW BEST ★</div>
      <h2>YOU ARE HUMAN</h2>
      <div class="tagline">From a single cell to civilization.</div>
      <div class="stats" id="won-stats"></div>
      <button id="btn-again">Play Again</button>
      <div class="runs" id="won-runs"></div>
    </div>
  </div>
`);

/* ---------- 3. GAME DATA ---------- */

const STAGES = [
  { name:'Primordial Ocean', depth:'−4000 m', need:0,    preds:0,
    bg:['#04121f','#073a52'], body:['#8ff7d0','#0e6b52'], amb:'bubble' },
  { name:'Coral Reef',       depth:'−200 m',  need:40,   preds:1,
    bg:['#062033','#0a5568'], body:['#9ff0e0','#0a6b62'], amb:'bubble' },
  { name:'Tidal Shallows',   depth:'−20 m',   need:110,  preds:2,
    bg:['#0a3346','#148e96'], body:['#a0f0d0','#0a7b4a'], amb:'bubble' },
  { name:'Shoreline',        depth:'0 m',     need:220,  preds:3,
    bg:['#123c4a','#37a8a8'], body:['#b0f0b0','#3a7b2a'], amb:'bubble' },
  { name:'First Land',       depth:'+10 m',   need:380,  preds:4,
    bg:['#163b28','#6fae5b'], body:['#c8f0a0','#5a7b1a'], amb:'leaf'   },
  { name:'Amphibian',        depth:'Swamp',   need:600,  preds:5,
    bg:['#1a3a2a','#7cbf6a'], body:['#d8f090','#6a6b1a'], amb:'firefly'},
  { name:'Reptile',          depth:'Jungle',  need:900,  preds:6,
    bg:['#1e3a1e','#8fbf5a'], body:['#e8e080','#7a5b1a'], amb:'firefly'},
  { name:'Mammal',           depth:'Plains',  need:1300, preds:7,
    bg:['#2a3a20','#c9b96a'], body:['#f0c070','#8a4b1a'], amb:'leaf'   },
  { name:'Primate',          depth:'Forest',  need:1800, preds:8,
    bg:['#243520','#a8a04a'], body:['#f0a060','#7a3b1a'], amb:'leaf'   },
  { name:'Human',            depth:'Civil.',  need:2400, preds:9,
    bg:['#1a2a3a','#b8a870'], body:['#f0c0a0','#6a3b2a'], amb:'ember'  },
];

const MUT_LIST = [
  { key:'flagellum', name:'Flagellum',    desc:'Swim faster',      max:5 },
  { key:'membrane',  name:'Membrane',     desc:'Tougher body',     max:5 },
  { key:'eyespot',   name:'Eye Spot',     desc:'Bigger magnet',    max:5 },
  { key:'mito',      name:'Mitochondria', desc:'More biomass',     max:5 },
  { key:'chloro',    name:'Chloroplast',  desc:'Passive biomass',  max:5 },
  { key:'wall',      name:'Cell Wall',    desc:'Take less damage', max:5 },
  { key:'jaws',      name:'Jaws',         desc:'Bite predators',   max:5 },
];
const MUT = Object.fromEntries(MUT_LIST.map(m => [m.key, m]));

const MUT_COLOR = {
  flagellum:'#4ee5d0', membrane:'#ff8fb8', eyespot:'#ffe89a',
  mito:'#ff9a5a',      chloro:'#8af07a',  wall:'#7fbfff', jaws:'#ff6b6b',
};
const RELIC_TEXT = {
  flagellum:'A whip-like tail. You can swim faster.',
  membrane:'A protective skin. Tougher body.',
  eyespot:'Light sensitivity. Sense food further.',
  mito:'The powerhouse. Extract more energy.',
  chloro:'Harvest light. Passive biomass.',
  wall:'A rigid shell. Take less damage.',
  jaws:'Fight back. Bite predators.',
};

/* ---------- 4. SOUND (procedural, no files) ---------- */

const sfx = {
  ctx: null, enabled: false, muted: false,
  init(){
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch(e){ this.enabled = false; }
  },
  resume(){ if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{}); },
  tone(freq, dur, type, vol, slideTo){
    if (!this.enabled || this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.07, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    } catch(e){}
  },
  eat(combo){ this.tone(600 + combo * 70, 0.07, 'sine', 0.055); },
  hit(){ this.tone(160, 0.14, 'sawtooth', 0.09, 70); },
  relic(){ this.tone(800, 0.1, 'sine', 0.07); setTimeout(()=>this.tone(1200, 0.14, 'sine', 0.07), 70); },
  stage(){ this.tone(400, 0.13, 'triangle', 0.09); setTimeout(()=>this.tone(600, 0.13, 'triangle', 0.09), 90); setTimeout(()=>this.tone(900, 0.22, 'triangle', 0.1), 180); },
  death(){ this.tone(320, 0.5, 'sawtooth', 0.11, 50); },
  nearMiss(){ this.tone(500, 0.06, 'sine', 0.045, 720); },
  click(){ this.tone(700, 0.05, 'sine', 0.055); },
  win(){ [523, 659, 784, 1046].forEach((f,i)=> setTimeout(()=>this.tone(f, 0.3, 'triangle', 0.09), i*140)); },
};

/* ---------- 5. SAVE / LOAD ---------- */

const SAVE_KEY = 'evolve_save_v1';
const save = { bestScore:0, bestTime:0, top5:[], muted:false };

function loadSave(){
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw){
      const d = JSON.parse(raw);
      save.bestScore = d.bestScore || 0;
      save.bestTime  = d.bestTime  || 0;
      save.top5      = Array.isArray(d.top5) ? d.top5 : [];
      save.muted     = !!d.muted;
    }
  } catch(e){}
  sfx.muted = save.muted;
}
function persist(){
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch(e){}
}
loadSave();

/* ---------- 6. STATE ---------- */

const player = {
  x: world.w/2, y: world.h/2, vx:0, vy:0, r:13,
  hp:100, maxHp:100,
  levels: Object.fromEntries(MUT_LIST.map(m => [m.key, 0])),
  unlocked: {},
  invuln: 0, flash: 0,
  fx: 0, fy: 1, alpha: 1,
};

const state = {
  phase: 'title',
  t: 0, startT: 0,
  timeScale: 1, timeScaleTarget: 1,
  phaseTimer: 0,
  biomass: 0, totalEarned: 0,
  score: 0,
  stage: 0,
  comboCount: 0, comboTimer: 0, maxCombo: 0,
  nearMisses: 0,
  newBestThisRun: false,
  foods: [], predators: [], relics: [], fx: [], popups: [],
  amb: { near:[], mid:[], far:[] },
  milestones: {},
  victory: false,
};

const mouse = { x:0, y:0, down:false };
let predTimer = 0, toastTimer = 0, uiDirty = true;
const nearMissCooldown = new Map();

/* ---------- 7. HELPERS ---------- */
const rnd   = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;

function getStats(){
  const L = player.levels;
  return {
    speed:  150 + 38 * L.flagellum,
    maxHp:  100 + 45 * L.membrane,
    digest: 1 + 0.25 * L.mito,
    chloro: 0.7 * L.chloro,
    magnet: 55 + 55 * L.eyespot,
    armor:  1 - 0.12 * L.wall,
    jaws:   22 * L.jaws,
  };
}
function comboMult(){ return 1 + Math.min(state.comboCount, 8) * 0.5; }

const toScreen = (x,y) => [x - cam.x + VW/2 + shake.x, y - cam.y + VH/2 + shake.y];
const toWorld  = (sx,sy) => [sx + cam.x - VW/2, sy + cam.y - VH/2];

function toast(title, sub){
  const el = document.getElementById('toast');
  el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
  el.style.opacity = 1;
  toastTimer = 2.8;
}

function burst(x, y, n, hue, spd=160){
  for (let i=0;i<n;i++){
    const a = Math.random()*Math.PI*2;
    const s = rnd(spd*0.3, spd);
    state.fx.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                    life: rnd(.35,.8), max:.8, r: rnd(1.5,3.5), hue });
  }
}
function addPopup(x, y, text, color){
  state.popups.push({ x, y, text, color: color||'#e8f8ff',
                      life: 1.1, max: 1.1, vy: -55 });
}
function doShake(mag){
  shake.mag = Math.max(shake.mag, mag);
}

/* ---------- 8. SPAWNING ---------- */

function spawnFood(){
  const st = state.stage;
  state.foods.push({
    x: rnd(60, world.w-60), y: rnd(60, world.h-60),
    r: rnd(3.5, 6.5) * ES,
    v: (1.5 + Math.random()*3) * (1 + st*0.35),
    hue: [140,175,190,95][Math.floor(Math.random()*4)],
    ph: Math.random()*6.28,
  });
}
function spawnPredator(){
  const st = state.stage;
  let x,y,tries=0;
  do {
    x = rnd(80, world.w-80); y = rnd(80, world.h-80); tries++;
  } while (Math.hypot(x-player.x, y-player.y) < 550 && tries < 40);
  state.predators.push({
    x, y, vx:0, vy:0,
    r: (16 + st*2.2 + Math.random()*7) * ES,
    hp: 30 + st*18, maxHp: 30 + st*18,
    speed: (60 + st*22 + Math.random()*25) * ES,
    hue: 350 - st*6,
    ph: Math.random()*6.28,
    id: Math.random().toString(36).slice(2),
  });
}
function spawnRelic(){
  const pool = MUT_LIST.filter(m => player.levels[m.key] < m.max);
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random()*pool.length)];
  let x,y,tries=0,ok=false;
  while (tries < 80){
    x = rnd(200, world.w-200); y = rnd(200, world.h-200);
    const near = Math.hypot(x-player.x, y-player.y) < 450;
    let nearPred = false;
    for (const q of state.predators){
      if (Math.hypot(q.x - x, q.y - y) < 300){ nearPred = true; break; }
    }
    if (!near && !nearPred){ ok = true; break; }
    tries++;
  }
  if (!ok) return;
  state.relics.push({
    x, y, key: pick.key, name: pick.name, ph: Math.random()*6.28,
  });
}

/* ---------- 9. AMBIENT BACKGROUND ---------- */

function initAmbient(){
  const type = STAGES[state.stage].amb;
  state.amb = { near:[], mid:[], far:[] };
  const total = Math.floor((VW * VH) / 16000);
  const n = {
    near: Math.floor(total * 0.35),
    mid:  Math.floor(total * 0.35),
    far:  Math.floor(total * 0.30),
  };
  for (const layer of ['far','mid','near']){
    for (let i = 0; i < n[layer]; i++) state.amb[layer].push(makeAmb(type, layer));
  }
}
function makeAmb(type, layer){
  const size = layer === 'near' ? rnd(2.5,4.5) : layer === 'mid' ? rnd(1.5,3) : rnd(0.8,1.8);
  const base = { type, layer, x: Math.random()*2*Math.max(VW,VH), y: Math.random()*2*Math.max(VH,VW),
                 r: size, ph: Math.random()*6.28, vx: rnd(-8,8), vy: rnd(-8,8), blink: 0 };
  if (type === 'bubble'){ base.vy = -rnd(15,45); base.vx = rnd(-8,8); }
  if (type === 'leaf'){ base.vy = rnd(15,35); base.vx = rnd(-25,25); base.ph = Math.random()*6.28; }
  if (type === 'firefly'){ base.blink = Math.random()*6.28; base.vy = rnd(-6,6); base.vx = rnd(-6,6); }
  if (type === 'ember'){ base.vy = -rnd(20,50); base.vx = rnd(-12,12); }
  return base;
}
function updateAmbient(dt){
  const wrap = Math.max(VW, VH) * 2;
  for (const layer of ['far','mid','near']){
    for (const p of state.amb[layer]){
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ph += dt * 1.5;
      if (p.x < -40) p.x = wrap - 40;
      if (p.x > wrap - 40) p.x = -40;
      if (p.y < -40) p.y = wrap - 40;
      if (p.y > wrap - 40) p.y = -40;
      if (p.type === 'bubble'){
        p.vx += Math.sin(p.ph) * 8 * dt;
      } else if (p.type === 'leaf'){
        p.vx += Math.sin(p.ph * 1.3) * 20 * dt;
        p.vy += Math.cos(p.ph) * 6 * dt;
      } else if (p.type === 'firefly'){
        p.vx += Math.cos(p.ph * 0.7) * 4 * dt;
        p.vy += Math.sin(p.ph * 1.1) * 4 * dt;
        p.vx *= 0.98; p.vy *= 0.98;
        p.blink += dt * 4;
      }
    }
  }
}
function drawAmbient(){
  const stage = state.stage;
  const parallax = { far: 0.15, mid: 0.35, near: 0.6 };
  const alpha    = { far: 0.35, mid: 0.5,  near: 0.75 };
  const color    = {
    bubble:  { far:'#2a6b8f', mid:'#4a9fbf', near:'#8fdfff' },
    leaf:    { far:'#3a5a2a', mid:'#5a8f3a', near:'#8fcf5a' },
    firefly: { far:'#4a6b20', mid:'#8fd04a', near:'#e8ff6a' },
    ember:   { far:'#5a2a1a', mid:'#9f4a1a', near:'#ffb04a' },
  }[STAGES[stage].amb] || { far:'#2a5faf', mid:'#3f8fcf', near:'#8fcfff' };

  const type = STAGES[stage].amb;

  for (const layer of ['far','mid','near']){
    const px = parallax[layer];
    const al = alpha[layer];
    const col = color[layer];
    ctx.save();
    ctx.globalAlpha = al;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    const wrapW = Math.max(VW, VH) * 2;

    for (const p of state.amb[layer]){
      const sx = ((p.x - cam.x * px) % wrapW + wrapW) % wrapW - 100;
      const sy = ((p.y - cam.y * px) % wrapW + wrapW) % wrapW - 100;
      if (sx < -50 || sx > VW + 50 || sy < -50 || sy > VH + 50) continue;

      if (type === 'bubble'){
        ctx.lineWidth = Math.max(1, p.r * 0.4);
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, 6.2832);
        ctx.stroke();
      } else if (type === 'firefly'){
        const blink = (Math.sin(p.blink) + 1) / 2;
        ctx.globalAlpha = al * (0.3 + blink * 0.7);
        ctx.beginPath();
        ctx.arc(sx, sy, p.r * (0.7 + blink * 0.6), 0, 6.2832);
        ctx.fill();
        ctx.globalAlpha = al;
      } else if (type === 'leaf'){
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.ph + Math.sin(p.ph) * 0.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 1.4, p.r * 0.55, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/* ---------- 10. UPDATE ---------- */

function update(realDt){
  state.t += realDt;

  state.timeScale += (state.timeScaleTarget - state.timeScale) * Math.min(1, realDt * 8);
  const dt = realDt * state.timeScale;

  updateAmbient(realDt);
  for (let i = state.fx.length - 1; i >= 0; i--){
    const f = state.fx[i];
    f.life -= realDt;
    f.x += f.vx * realDt; f.y += f.vy * realDt;
    f.vx *= 0.94; f.vy *= 0.94;
    if (f.life <= 0) state.fx.splice(i, 1);
  }
  for (let i = state.popups.length - 1; i >= 0; i--){
    const p = state.popups[i];
    p.life -= realDt;
    p.y += p.vy * realDt;
    p.vy *= 0.96;
    if (p.life <= 0) state.popups.splice(i, 1);
  }

  shake.mag *= Math.pow(0.001, realDt);
  if (shake.mag < 0.15){ shake.mag = 0; shake.x = 0; shake.y = 0; }
  else {
    shake.x = (Math.random()*2-1) * shake.mag;
    shake.y = (Math.random()*2-1) * shake.mag;
  }

  if (toastTimer > 0){
    toastTimer -= realDt;
    if (toastTimer <= 0) document.getElementById('toast').style.opacity = 0;
  }

  if (state.phase === 'dying'){
    state.phaseTimer -= realDt;
    player.alpha = Math.max(0, state.phaseTimer / 1.0);
    if (state.phaseTimer <= 0){
      finishRun(false);
    }
    return;
  }

  if (state.phase !== 'playing') return;

  const p = player;
  const S = getStats();

  p.maxHp = S.maxHp;
  const baseR = 13 + Math.min(20, Math.sqrt(state.totalEarned) * 0.6);
  p.r = baseR * ES;
  p.invuln = Math.max(0, p.invuln - dt);
  p.flash  = Math.max(0, p.flash  - dt);

  let ix = 0, iy = 0;
  if (mouse.down){
    const [wx, wy] = toWorld(mouse.x, mouse.y);
    const dx = wx - p.x, dy = wy - p.y;
    const d  = Math.hypot(dx, dy);
    if (d > 15){ ix = dx/d; iy = dy/d; }
  }
  p.vx += (ix * S.speed * ES - p.vx) * Math.min(1, dt*9);
  p.vy += (iy * S.speed * ES - p.vy) * Math.min(1, dt*9);
  p.x = clamp(p.x + p.vx*dt, p.r, world.w - p.r);
  p.y = clamp(p.y + p.vy*dt, p.r, world.h - p.r);

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 6){
    p.fx += (p.vx/sp - p.fx) * Math.min(1, dt*10);
    p.fy += (p.vy/sp - p.fy) * Math.min(1, dt*10);
    const fl = Math.hypot(p.fx, p.fy) || 1;
    p.fx /= fl; p.fy /= fl;
  }

  cam.x = world.w > VW ? clamp(p.x, VW/2, world.w - VW/2) : world.w/2;
  cam.y = world.h > VH ? clamp(p.y, VH/2, world.h - VH/2) : world.h/2;

  if (state.comboTimer > 0){
    state.comboTimer -= realDt;
    if (state.comboTimer <= 0){
      state.comboCount = 0;
      uiDirty = true;
    }
  }

  if (S.chloro > 0){
    const gain = S.chloro * dt;
    state.biomass += gain;
    state.totalEarned += gain;
  }

  const targetFood = Math.floor(world.w * world.h / 55000);
  while (state.foods.length < targetFood) spawnFood();

  for (let i = state.foods.length - 1; i >= 0; i--){
    const f = state.foods[i];
    const dx = p.x - f.x, dy = p.y - f.y;
    const d  = Math.hypot(dx, dy) || 0.001;

    if (d < p.r + S.magnet * ES){
      const pull = (1 - d/(p.r + S.magnet*ES)) * 420 * ES;
      f.x += (dx/d) * pull * dt;
      f.y += (dy/d) * pull * dt;
    }
    if (d < p.r + f.r + 2){
      const mult = comboMult();
      const gain = f.v * S.digest;
      const scoreGain = Math.floor(gain * mult * 10);
      state.biomass += gain;
      state.totalEarned += gain;
      state.score += scoreGain;
      p.hp = Math.min(p.maxHp, p.hp + 1.4);
      state.comboCount = Math.min(state.comboCount + 1, 8);
      state.comboTimer = 2.0;
      state.maxCombo = Math.max(state.maxCombo, state.comboCount);

      burst(f.x, f.y, 5, f.hue, 90);
      addPopup(f.x, f.y, '+'+scoreGain, mult > 1 ? '#ffe07a' : '#9fe8ff');
      sfx.eat(state.comboCount);

      state.foods.splice(i, 1);
      uiDirty = true;
    }
  }

  const targetPreds = STAGES[state.stage].preds;
  predTimer -= realDt;
  if (state.predators.length < targetPreds && predTimer <= 0){
    predTimer = 1.8;
    spawnPredator();
  }

  for (let i = state.predators.length - 1; i >= 0; i--){
    const q = state.predators[i];
    const dx = p.x - q.x, dy = p.y - q.y;
    const d  = Math.hypot(dx, dy) || 0.001;

    if (d < 560 * ES){
      q.vx += (dx/d) * q.speed * dt * 3;
      q.vy += (dy/d) * q.speed * dt * 3;
    } else {
      q.vx += Math.cos(state.t*0.7 + q.ph) * 40 * dt * ES;
      q.vy += Math.sin(state.t*0.9 + q.ph) * 40 * dt * ES;
    }
    const qs = Math.hypot(q.vx, q.vy);
    if (qs > q.speed){ q.vx = q.vx/qs*q.speed; q.vy = q.vy/qs*q.speed; }
    q.vx *= 0.985; q.vy *= 0.985;
    q.x = clamp(q.x + q.vx*dt, q.r, world.w - q.r);
    q.y = clamp(q.y + q.vy*dt, q.r, world.h - q.r);

    if (d < q.r + p.r){
      if (p.invuln <= 0){
        p.hp -= (16 + state.stage*5) * S.armor * dt;
        p.flash = 0.12;
        state.comboCount = 0;
        state.comboTimer = 0;
        doShake(4);
        sfx.hit();
        if (Math.random() < dt*8) burst(p.x, p.y, 2, 0, 70);
      }
      if (S.jaws > 0){
        q.hp -= S.jaws * dt;
        if (Math.random() < dt*14) burst(q.x, q.y, 2, 10, 80);
      }
      const push = 120 * dt * ES;
      q.x -= (dx/d)*push; q.y -= (dy/d)*push;
      p.x += (dx/d)*push*0.6; p.y += (dy/d)*push*0.6;
    } else if (d < q.r + p.r + 25*ES){
      const key = q.id;
      const now = state.t;
      if (!nearMissCooldown.has(key) || now - nearMissCooldown.get(key) > 1.5){
        nearMissCooldown.set(key, now);
        state.nearMisses++;
        state.score += 15;
        addPopup(p.x, p.y - 20, 'NEAR MISS +15', '#ff9a5a');
        sfx.nearMiss();
        state.comboCount = Math.min(state.comboCount + 1, 8);
        state.comboTimer = 2.0;
      }
    }

    if (q.hp <= 0){
      burst(q.x, q.y, 22, q.hue, 200);
      addPopup(q.x, q.y, '+50', '#ff8fb8');
      state.score += 50;
      for (let k=0;k<4;k++){
        state.foods.push({
          x: q.x + rnd(-20,20), y: q.y + rnd(-20,20),
          r: rnd(4,7)*ES, v: rnd(3,6), hue: 30, ph: Math.random()*6.28,
        });
      }
      state.predators.splice(i, 1);
    }
  }

  if (p.hp <= 0 && state.phase === 'playing'){
    state.phase = 'dying';
    state.phaseTimer = 1.0;
    state.timeScaleTarget = 0.15;
    doShake(22);
    burst(p.x, p.y, 60, 0, 320);
    sfx.death();
  }

  for (let i = state.relics.length - 1; i >= 0; i--){
    const rl = state.relics[i];
    if (Math.hypot(p.x - rl.x, p.y - rl.y) < p.r + 30*ES){
      state.relics.splice(i, 1);
      if (player.levels[rl.key] >= MUT[rl.key].max){
        burst(rl.x, rl.y, 10, 50, 140);
        continue;
      }
      const wasNew = !player.unlocked[rl.key];
      player.unlocked[rl.key] = true;
      player.levels[rl.key]++;
      const lvl = player.levels[rl.key];
      const m = MUT[rl.key];
      burst(rl.x, rl.y, 30, 150, 240);
      addPopup(rl.x, rl.y, m.name + ' Lv'+lvl, MUT_COLOR[rl.key]);
      sfx.relic();
      if (wasNew) toast(`Discovered: ${m.name}`, RELIC_TEXT[rl.key]);
      else if (lvl >= m.max) toast(`${m.name} MAXED`, 'Fully evolved');
      else toast(`${m.name}  Lv ${lvl}`, m.desc);
      uiDirty = true;

      const maxed = MUT_LIST.filter(mm => player.levels[mm.key] >= mm.max).length;
      if (maxed >= 3 && !state.milestones.maxed3){
        state.milestones.maxed3 = true;
        setTimeout(()=>toast('Milestone', '3 mutations maxed'), 1200);
      }
    }
  }
  while (state.relics.length < 4){
    const before = state.relics.length;
    spawnRelic();
    if (state.relics.length === before) break;
  }

  let s = state.stage;
  while (s + 1 < STAGES.length && state.totalEarned >= STAGES[s+1].need) s++;
  if (s !== state.stage){
    state.stage = s;
    world.w = Math.max(world.w, 3200 + s*200);
    world.h = Math.max(world.h, 3200 + s*200);
    state.timeScaleTarget = 0.35;
    setTimeout(()=>{ state.timeScaleTarget = 1; }, 400);
    doShake(10);
    toast(STAGES[s].name, 'You have evolved — ' + STAGES[s].depth);
    burst(p.x, p.y, 50, 180, 340);
    sfx.stage();
    initAmbient();
    uiDirty = true;

    if (s === 7 && (state.t - state.startT) < 180 && !state.milestones.mammal3min){
      state.milestones.mammal3min = true;
      setTimeout(()=>toast('Milestone', 'Mammal in under 3 minutes'), 1200);
    }

    if (s === STAGES.length - 1 && !state.victory){
      state.victory = true;
      state.phase = 'won';
      state.timeScaleTarget = 0.2;
      doShake(18);
      sfx.win();
      setTimeout(()=>finishRun(true), 800);
    }
  }

  if (!state.milestones.survived60 && (state.t - state.startT) >= 60){
    state.milestones.survived60 = true;
    toast('Milestone', 'Survived 60 seconds');
  }

  if (!state.newBestThisRun && state.score > save.bestScore){
    state.newBestThisRun = true;
    addPopup(p.x, p.y - 50, 'NEW BEST!', '#ffe07a');
  }
}

/* ---------- 11. RENDER ---------- */

function radialBody(w, h, c1, c2){
  const g = ctx.createRadialGradient(-w*0.3, -h*0.3, Math.min(w,h)*0.1, 0, 0, Math.max(w,h));
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawCell(r, t, c1, c2, stage){
  ctx.beginPath();
  const N = 26;
  for (let i = 0; i <= N; i++){
    const a = (i/N)*Math.PI*2;
    const wobble = 0.06 + stage*0.015;
    const rr = r*(1 + wobble*Math.sin(a*3 + t*2) + 0.04*Math.sin(a*5 - t*1.6));
    const px = Math.cos(a)*rr, py = Math.sin(a)*rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r*0.35, -r*0.35, r*0.1, 0, 0, r*1.15);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = Math.max(1, r*0.06);
  ctx.stroke();

  const nucR = r*(0.32 - stage*0.03);
  ctx.beginPath();
  ctx.arc(-r*0.15, -r*0.15, nucR, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(200,255,235,.85)';
  ctx.fill();

  ctx.fillStyle = 'rgba(180,255,220,.65)';
  for (let i = 0; i < stage; i++){
    const a = (i/Math.max(1,stage))*Math.PI*2 + t*0.3;
    const rr = r*0.55;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, r*0.12, 0, Math.PI*2);
    ctx.fill();
  }
  if (player.levels.eyespot > 0){
    ctx.beginPath();
    ctx.arc(r*0.25, -r*0.1, r*0.15, 0, Math.PI*2);
    ctx.fillStyle = '#0a0a14';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r*0.29, -r*0.14, r*0.05, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function drawQuadruped(r, t, c1, c2, stage, ang){
  ctx.save();
  ctx.rotate(ang);
  const hasEars = stage >= 7;
  const bodyW = r*(1.15 + (stage-4)*0.12);
  const bodyH = r*(0.75 + (stage-4)*0.06);
  const legLen = r*(0.55 + (stage-4)*0.08);
  const legW = Math.max(2, r*0.22);
  const headR = r*(0.55 + (stage-4)*0.02);

  ctx.beginPath();
  ctx.moveTo(-bodyW*0.85, 0);
  const tailWob = Math.sin(t*4) * r*0.12;
  const tailLen = r*(0.5 + (stage-4)*0.15);
  ctx.quadraticCurveTo(-bodyW*1.2, -r*0.15 + tailWob, -bodyW*1.1 - tailLen, tailWob);
  ctx.lineWidth = Math.max(2, r*0.28);
  ctx.lineCap = 'round';
  ctx.strokeStyle = c2;
  ctx.stroke();

  const swing = Math.sin(t*8) * 0.25;
  ctx.fillStyle = c2;
  for (const [lx,sgn] of [[-bodyW*0.55,-1], [-bodyW*0.35,1]]){
    ctx.save(); ctx.translate(lx, sgn*bodyH*0.35); ctx.rotate(swing*sgn);
    ctx.fillRect(-legW/2, 0, legW, legLen); ctx.restore();
  }
  radialBody(bodyW, bodyH, c1, c2);
  for (const [lx,sgn] of [[bodyW*0.35,-1], [bodyW*0.55,1]]){
    ctx.save(); ctx.translate(lx, sgn*bodyH*0.35); ctx.rotate(-swing*sgn);
    ctx.fillRect(-legW/2, 0, legW, legLen); ctx.restore();
  }

  const headX = bodyW*0.95, headY = -bodyH*0.25;
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI*2);
  ctx.fillStyle = c1;
  ctx.fill();

  if (stage >= 6){
    ctx.beginPath();
    ctx.ellipse(headX + headR*0.55, headY + headR*0.1, headR*0.55, headR*0.35, 0, 0, Math.PI*2);
    ctx.fill();
  }
  if (hasEars){
    ctx.fillStyle = c2;
    for (const sgn of [-1,1]){
      ctx.beginPath();
      ctx.arc(headX + headR*0.1*sgn, headY - headR*0.85, headR*0.28, 0, Math.PI*2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1,1]){
    ctx.beginPath();
    ctx.arc(headX + headR*0.35, headY + headR*0.1*sgn, headR*0.14, 0, Math.PI*2);
    ctx.fill();
  }
  if (stage >= 6){
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = Math.max(1, r*0.05);
    ctx.beginPath();
    ctx.arc(headX + headR*0.6, headY + headR*0.15, headR*0.2, 0.3, Math.PI-0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPrimate(r, t, c1, c2, facingLeft){
  ctx.save();
  ctx.scale(facingLeft ? -1 : 1, 1);
  const legPhase = Math.sin(t*8)*0.25;
  ctx.fillStyle = c2;
  for (const sgn of [-1,1]){
    ctx.save(); ctx.translate(sgn*r*0.35, r*0.55); ctx.rotate(sgn*legPhase);
    ctx.fillRect(-r*0.13, 0, r*0.26, r*0.75); ctx.restore();
  }
  radialBody(r*0.6, r*0.85, c1, c2);
  const armPhase = Math.sin(t*8 + Math.PI)*0.25;
  ctx.fillStyle = c2;
  for (const sgn of [-1,1]){
    ctx.save(); ctx.translate(sgn*r*0.55, -r*0.1); ctx.rotate(sgn*armPhase);
    ctx.fillRect(-r*0.1, 0, r*0.2, r*0.75); ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, -r*1.05, r*0.5, 0, Math.PI*2);
  ctx.fillStyle = c1;
  ctx.fill();
  ctx.fillStyle = c2;
  for (const sgn of [-1,1]){
    ctx.beginPath();
    ctx.arc(sgn*r*0.5, -r*1.05, r*0.18, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1,1]){
    ctx.beginPath();
    ctx.arc(sgn*r*0.15, -r*1.1, r*0.07, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(1, r*0.05);
  ctx.beginPath();
  ctx.arc(0, -r*0.95, r*0.18, 0.2, Math.PI-0.2);
  ctx.stroke();
  ctx.restore();
}

function drawHuman(r, t, c1, c2, facingLeft){
  ctx.save();
  ctx.scale(facingLeft ? -1 : 1, 1);
  const legPhase = Math.sin(t*8)*0.3;
  ctx.fillStyle = '#2d3a5a';
  for (const sgn of [-1,1]){
    ctx.save(); ctx.translate(sgn*r*0.3, r*0.6); ctx.rotate(sgn*legPhase);
    ctx.fillRect(-r*0.12, 0, r*0.24, r*0.9); ctx.restore();
  }
  const g = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r*0.9);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r*0.55, r*0.8, 0, 0, Math.PI*2);
  ctx.fill();
  const armPhase = Math.sin(t*8 + Math.PI)*0.3;
  ctx.fillStyle = c2;
  for (const sgn of [-1,1]){
    ctx.save(); ctx.translate(sgn*r*0.55, -r*0.15); ctx.rotate(sgn*armPhase);
    ctx.fillRect(-r*0.1, 0, r*0.2, r*0.75); ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, -r*1.0, r*0.48, 0, Math.PI*2);
  ctx.fillStyle = c1;
  ctx.fill();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(0, -r*1.05, r*0.5, Math.PI*1.02, Math.PI*2.02);
  ctx.fill();
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1,1]){
    ctx.beginPath();
    ctx.arc(sgn*r*0.16, -r*1.0, r*0.06, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(1, r*0.05);
  ctx.beginPath();
  ctx.arc(0, -r*0.9, r*0.15, 0.2, Math.PI-0.2);
  ctx.stroke();
  ctx.restore();
}

function drawCreature(cx, cy, r, stage, t, dir, colors, flashing){
  const [c1, c2] = flashing ? ['#ffb0b0', '#b03030'] : colors;
  const ang = Math.atan2(dir.y, dir.x);
  ctx.save();
  ctx.translate(cx, cy);
  if (stage <= 3) drawCell(r, t, c1, c2, stage);
  else if (stage <= 7) drawQuadruped(r, t, c1, c2, stage, ang);
  else if (stage === 8) drawPrimate(r, t, c1, c2, dir.x < 0);
  else drawHuman(r, t, c1, c2, dir.x < 0);
  ctx.restore();
}

function drawEdgeHint(x, y, color){
  const [sx, sy] = toScreen(x, y);
  const m = 46;
  if (sx > m && sx < VW-m && sy > m && sy < VH-m) return;
  const cx = VW/2, cy = VH/2;
  let dx = sx - cx, dy = sy - cy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  const t = Math.min((VW/2-m)/Math.abs(dx||1e-6), (VH/2-m)/Math.abs(dy||1e-6));
  const px = cx + dx*t, py = cy + dy*t;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.beginPath();
  ctx.moveTo(13, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowBlur = 16; ctx.shadowColor = color;
  ctx.fill();
  ctx.restore();
}

function render(){
  const st = STAGES[state.stage];
  const p = player;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VW, VH);

  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, st.bg[0]);
  bg.addColorStop(1, st.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  drawAmbient();

  if (state.phase !== 'title'){
    const [bx, by] = toScreen(0, 0);
    ctx.strokeStyle = 'rgba(120,220,255,.20)';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, world.w, world.h);

    for (const f of state.foods){
      const [sx, sy] = toScreen(f.x, f.y);
      if (sx < -20 || sy < -20 || sx > VW+20 || sy > VH+20) continue;
      const pulse = 1 + 0.16*Math.sin(state.t*3 + f.ph);
      ctx.beginPath();
      ctx.arc(sx, sy, f.r*pulse, 0, 6.2832);
      ctx.fillStyle = `hsla(${f.hue},90%,66%,.95)`;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `hsla(${f.hue},95%,60%,.9)`;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    for (const rl of state.relics){
      const [sx, sy] = toScreen(rl.x, rl.y);
      const pulse = 1 + 0.2*Math.sin(state.t*2.6 + rl.ph);
      const col = MUT_COLOR[rl.key] || '#ffd45e';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(state.t*0.7);
      ctx.shadowBlur = 26; ctx.shadowColor = col;
      ctx.strokeStyle = col; ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 20*pulse, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 30*pulse, 0.4, 2.2); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI/4);
      const sd = 8*pulse;
      ctx.shadowBlur = 22; ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.fillRect(-sd/2, -sd/2, sd, sd);
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    for (const q of state.predators){
      const [sx, sy] = toScreen(q.x, q.y);
      if (sx < -80 || sy < -80 || sx > VW+80 || sy > VH+80) continue;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsla(${q.hue},90%,55%,.8)`;
      ctx.beginPath();
      const N = 20;
      for (let i = 0; i <= N; i++){
        const a = (i/N)*Math.PI*2;
        const wobble = 0.08*Math.sin(a*3 + state.t*2 + q.ph) + 0.05*Math.sin(a*5 - state.t*1.6);
        const spike = Math.abs(Math.sin(a*7 + state.t*3)) * 0.18;
        const rr = q.r*(1 + wobble + spike);
        const px = sx + Math.cos(a)*rr, py = sy + Math.sin(a)*rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(sx - q.r*0.35, sy - q.r*0.35, q.r*0.1, sx, sy, q.r*1.15);
      g.addColorStop(0, `hsl(${q.hue},85%,62%)`);
      g.addColorStop(1, `hsl(${q.hue},80%,28%)`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sx + q.r*0.25, sy - q.r*0.15, q.r*0.22, 0, 6.2832);
      ctx.fillStyle = '#12040a';
      ctx.fill();
    }

    if (state.phase !== 'dead' && state.phase !== 'won'){
      const [px, py] = toScreen(p.x, p.y);
      const flick = p.invuln > 0 && Math.floor(state.t*12) % 2 === 0;
      if (!flick && p.alpha > 0.02){
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 30;
        ctx.shadowColor = p.flash > 0 ? '#ff5566' : st.body[0];

        if (state.stage <= 3 && p.levels.flagellum > 0){
          ctx.strokeStyle = 'rgba(140,255,210,.55)';
          ctx.lineWidth = 2.2;
          for (let i = 0; i < 1 + p.levels.flagellum; i++){
            const off = (i - p.levels.flagellum/2) * 6;
            const dir = Math.atan2(p.vy, p.vx) || 0;
            ctx.beginPath();
            for (let s = 0; s < 14; s++){
              const f = s/13;
              const wob = Math.sin(state.t*9 - s*0.7 + i) * 7 * f;
              const x = px - Math.cos(dir)*(p.r + f*34) - Math.sin(dir)*(off + wob);
              const y = py - Math.sin(dir)*(p.r + f*34) + Math.cos(dir)*(off + wob);
              s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
        }
        drawCreature(px, py, p.r, state.stage, state.t,
                     { x: p.fx, y: p.fy }, st.body, p.flash > 0);
        ctx.restore();
      }
    }
  } else {
    const cx = VW/2, cy = VH/2 + 80;
    drawCreature(cx, cy, 26 * ES, 0, state.t, { x: 0, y: 1 }, st.body, false);
  }

  for (const f of state.fx){
    const [sx, sy] = toScreen(f.x, f.y);
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.hue === 0 ? '#ff6b81' : `hsl(${f.hue},95%,68%)`;
    ctx.beginPath();
    ctx.arc(sx, sy, f.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const pu of state.popups){
    const [sx, sy] = toScreen(pu.x, pu.y);
    const a = Math.max(0, pu.life / pu.max);
    ctx.globalAlpha = a;
    ctx.font = 'bold ' + Math.round(14 * ES) + 'px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = pu.color;
    ctx.shadowBlur = 8; ctx.shadowColor = '#000';
    ctx.fillText(pu.text, sx, sy);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  if (state.phase === 'playing' || state.phase === 'dying'){
    for (const rl of state.relics){
      drawEdgeHint(rl.x, rl.y, MUT_COLOR[rl.key] || 'rgba(255,212,94,.9)');
    }
  }

  const v = ctx.createRadialGradient(VW/2, VH/2, Math.min(VW,VH)*0.35,
                                     VW/2, VH/2, Math.max(VW,VH)*0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VW, VH);

  if (state.phase === 'playing' && p.hp < p.maxHp * 0.35){
    const a = (1 - p.hp/(p.maxHp*0.35)) * 0.25 * (0.6 + 0.4*Math.sin(state.t*6));
    ctx.fillStyle = `rgba(255,40,60,${a})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}

/* ---------- 12. UI ---------- */

function updateUI(){
  document.getElementById('bio').textContent = Math.floor(state.biomass);
  document.getElementById('hpFill').style.width = clamp(player.hp/player.maxHp*100, 0, 100) + '%';
  document.getElementById('stageName').textContent = STAGES[state.stage].name;
  document.getElementById('score').textContent = Math.floor(state.score);

  const cur = STAGES[state.stage].need;
  const nxt = STAGES[state.stage+1] ? STAGES[state.stage+1].need : null;
  document.getElementById('progFill').style.width =
    nxt ? clamp((state.totalEarned - cur)/(nxt - cur)*100, 0, 100) + '%' : '100%';

  const cEl = document.getElementById('combo');
  const mult = comboMult();
  if (mult > 1){
    cEl.textContent = '×' + mult.toFixed(1) + ' COMBO';
    cEl.classList.add('on');
  } else {
    cEl.classList.remove('on');
  }

  const pips = document.getElementById('pips');
  pips.innerHTML = '';
  for (const m of MUT_LIST){
    if (!player.unlocked[m.key]) continue;
    const lvl = player.levels[m.key];
    const el = document.createElement('div');
    el.className = 'pip';
    const size = 7 + lvl*1.6;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.background = MUT_COLOR[m.key];
    el.style.color = MUT_COLOR[m.key];
    el.style.opacity = 0.45 + lvl*0.11;
    pips.appendChild(el);
  }
}

/* ---------- 13. SCREEN MANAGEMENT ---------- */

const sTitle = document.getElementById('s-title');
const sDead  = document.getElementById('s-dead');
const sWon   = document.getElementById('s-won');

function showScreen(which){
  sTitle.classList.toggle('hidden', which !== 'title');
  sDead.classList.toggle('hidden', which !== 'dead');
  sWon.classList.toggle('hidden', which !== 'won');
}

function resetGame(){
  state.phase = 'playing';
  state.t = 0;
  state.startT = 0;
  state.timeScale = 1;
  state.timeScaleTarget = 1;
  state.phaseTimer = 0;
  state.biomass = 0;
  state.totalEarned = 0;
  state.score = 0;
  state.stage = 0;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.maxCombo = 0;
  state.nearMisses = 0;
  state.newBestThisRun = false;
  state.foods = [];
  state.predators = [];
  state.relics = [];
  state.fx = [];
  state.popups = [];
  state.milestones = {};
  state.victory = false;

  player.x = world.w/2; player.y = world.h/2;
  player.vx = player.vy = 0;
  player.hp = 100; player.maxHp = 100; player.r = 13;
  player.invuln = 0; player.flash = 0;
  player.fx = 0; player.fy = 1; player.alpha = 1;
  player.levels = Object.fromEntries(MUT_LIST.map(m => [m.key, 0]));
  player.unlocked = {};

  world.w = 3200; world.h = 3200;
  cam.x = player.x; cam.y = player.y;
  shake.mag = 0; shake.x = 0; shake.y = 0;
  nearMissCooldown.clear();
  predTimer = 0;

  for (let i = 0; i < 90; i++) spawnFood();
  for (let i = 0; i < 4; i++) spawnRelic();
  initAmbient();
  mouse.down = false;
  showScreen(null);
  uiDirty = true;
}

function startGame(){
  sfx.init(); sfx.resume(); sfx.click();
  resetGame();
}

function finishRun(won){
  state.timeScaleTarget = 1;
  state.timeScale = 1;
  const runTime = Math.max(0, state.t - state.startT);
  const finalScore = Math.floor(state.score);
  const isBest = finalScore > save.bestScore;

  if (isBest) save.bestScore = finalScore;
  if (won && (save.bestTime === 0 || runTime < save.bestTime)) save.bestTime = runTime;

  const entry = { score: finalScore, time: runTime, stage: state.stage, won };
  save.top5.push(entry);
  save.top5.sort((a,b) => b.score - a.score);
  save.top5 = save.top5.slice(0, 5);
  persist();

  const statsHTML = `
    <div class="row"><span class="k">Score</span><span class="v">${finalScore.toLocaleString()}</span></div>
    <div class="row"><span class="k">Time</span><span class="v">${runTime.toFixed(1)}s</span></div>
    <div class="row"><span class="k">Stage reached</span><span class="v">${STAGES[state.stage].name}</span></div>
    <div class="row"><span class="k">Max combo</span><span class="v">×${(1 + state.maxCombo*0.5).toFixed(1)}</span></div>
    <div class="row"><span class="k">Near misses</span><span class="v">${state.nearMisses}</span></div>
    <div class="row highlight"><span class="k">Best score</span><span class="v">${save.bestScore.toLocaleString()}</span></div>
  `;
  const runsHTML = 'Recent: ' + save.top5
    .map(r => `<span class="r">${r.score.toLocaleString()}${r.won ? ' ✓' : ''}</span>`)
    .join('');

  if (won){
    state.phase = 'won';
    document.getElementById('won-stats').innerHTML = statsHTML;
    document.getElementById('won-runs').innerHTML = runsHTML;
    sWon.classList.toggle('newbest', isBest);
    showScreen('won');
  } else {
    state.phase = 'dead';
    document.getElementById('dead-stats').innerHTML = statsHTML;
    document.getElementById('dead-runs').innerHTML = runsHTML;
    sDead.classList.toggle('newbest', isBest);
    showScreen('dead');
  }
  document.getElementById('title-best').textContent = save.bestScore.toLocaleString();
}

sTitle.addEventListener('pointerup', startGame);
sDead.addEventListener('pointerup', (e) => {
  if (e.target.tagName !== 'BUTTON') startGame();
});
sWon.addEventListener('pointerup', (e) => {
  if (e.target.tagName !== 'BUTTON') startGame();
});
document.getElementById('btn-start').addEventListener('pointerup', (e) => {
  e.stopPropagation(); startGame();
});
document.getElementById('btn-restart').addEventListener('pointerup', (e) => {
  e.stopPropagation(); startGame();
});
document.getElementById('btn-again').addEventListener('pointerup', (e) => {
  e.stopPropagation(); startGame();
});

/* ---------- 14. MUTE + FULLSCREEN ---------- */

const muteBtn = document.getElementById('mute');
function updateMuteIcon(){
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
}
updateMuteIcon();
muteBtn.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  sfx.muted = !sfx.muted;
  save.muted = sfx.muted;
  persist();
  updateMuteIcon();
  sfx.click();
});

/* Fullscreen */
const fsBtn = document.getElementById('fullscreen');

function isFullscreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement ||
            document.msFullscreenElement);
}

function updateFsIcon(){
  fsBtn.textContent = isFullscreen() ? '⊠' : '⛶';
}

function fsFallback(){
  toast('Fullscreen unavailable', 'Use your browser or itch.io fullscreen button');
}

function toggleFullscreen(){
  const doc = document;
  const el  = doc.documentElement;

  if (!isFullscreen()){
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!req){ fsFallback(); return; }
    try {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(fsFallback);
    } catch(e){ fsFallback(); }
  } else {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (exit){
      try { exit.call(doc).catch(()=>{}); } catch(e){}
    }
  }
}

fsBtn.addEventListener('pointerup', (e) => {
  e.stopPropagation();
  sfx.init(); sfx.resume(); sfx.click();
  toggleFullscreen();
});

document.addEventListener('fullscreenchange',       () => setTimeout(resize, 120));
document.addEventListener('webkitfullscreenchange', () => setTimeout(resize, 120));
document.addEventListener('msfullscreenchange',     () => setTimeout(resize, 120));

updateFsIcon();

/* ---------- 15. INPUT ---------- */

cvs.addEventListener('pointerdown', e => {
  if (state.phase !== 'playing') return;
  e.preventDefault();
  cvs.setPointerCapture?.(e.pointerId);
  const r = cvs.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  mouse.down = true;
  sfx.init(); sfx.resume();
});
cvs.addEventListener('pointermove', e => {
  const r = cvs.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});
function pointerUp(){ mouse.down = false; }
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);
window.addEventListener('blur', pointerUp);
document.addEventListener('gesturestart', e => e.preventDefault());

addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r'){
    if (state.phase === 'dead' || state.phase === 'won') startGame();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) mouse.down = false;
});

/* ---------- 16. BOOT & LOOP ---------- */

let last = performance.now();
let uiTimer = 0;

function frame(now){
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.2) dt = 0.05;

  update(dt);
  render();

  uiTimer -= dt;
  if (uiDirty || uiTimer <= 0){ updateUI(); uiDirty = false; uiTimer = 0.12; }

  requestAnimationFrame(frame);
}

resize();
document.getElementById('title-best').textContent =
  save.bestScore > 0 ? save.bestScore.toLocaleString() : '—';
initAmbient();
showScreen('title');
requestAnimationFrame(frame);

})();

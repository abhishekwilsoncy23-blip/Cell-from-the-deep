(() => {
'use strict';

/* ============================================================
   EVOLVE — Cell → Human
   Everything lives in this file: scaling, CSS, HUD, rendering,
   gameplay, creature sprites. Edit DESIGN values only here.
   ============================================================ */

/* ---------- 1. CANVAS & ADAPTIVE SCALING ---------- */

const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');

let VW = 0;                 // viewport width  (CSS px)
let VH = 0;                 // viewport height (CSS px)
let DPR = 1;                // device pixel ratio (capped at 2)
let ES  = 1;                // entity scale — grows on big screens

// Called on every resize. Cheap; safe to call often.
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW  = window.innerWidth;
  VH  = window.innerHeight;

  cvs.width  = Math.floor(VW * DPR);
  cvs.height = Math.floor(VH * DPR);
  cvs.style.width  = VW + 'px';
  cvs.style.height = VH + 'px';

  // On very large screens entities look tiny → scale them up.
  // On mobile keep them readable (min 0.85).
  ES = Math.max(0.85, Math.min(1.5, Math.min(VW, VH) / 900));

  // Keep the world at least 1.5× the viewport so there's room to move.
  world.w = Math.max(world.w, VW * 1.5);
  world.h = Math.max(world.h, VH * 1.5);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

/* ---------- 2. CSS + HUD DOM (injected from JS) ---------- */

document.head.insertAdjacentHTML('beforeend', `<style>
  /* All UI is absolutely positioned over the canvas. Nothing blocks
     pointer events on the canvas EXCEPT the shop. */
  .ui-layer { position: fixed; inset: 0; pointer-events: none;
              font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
              color:#cfe9ff; user-select:none; -webkit-user-select:none;
              z-index: 10; }

  #hud { position:absolute; top:14px; left:14px;
         font-size:14px; line-height:1.5; text-shadow:0 1px 6px #000; }
  #hud b { font-size:22px; color:#8ef3c8; font-variant-numeric:tabular-nums; }
  #hud .label { opacity:.7; font-size:12px; letter-spacing:.05em; text-transform:uppercase; }
  #hud .bar { width:200px; height:7px; background:#0d2233; border:1px solid #24486a;
              border-radius:4px; margin:3px 0 8px; overflow:hidden; }
  #hud .bar > i { display:block; height:100%; width:0; border-radius:4px;
                  transition:width .18s ease; }
  #hpFill   { background: linear-gradient(90deg,#ff5f6d,#ffc371); }
  #progFill { background: linear-gradient(90deg,#39d0ff,#7CFFB2); }

  #shop { position:absolute; top:14px; right:14px; width:260px;
          font-size:12px; pointer-events:auto; }
  #shop h3 { margin:0 0 8px; font-size:11px; letter-spacing:.16em;
             text-transform:uppercase; color:#5f8fb8; font-weight:600; }
  .mut { background:rgba(9,26,42,.9); border:1px solid #24466a; border-radius:9px;
         padding:8px 10px; margin-bottom:6px; cursor:pointer;
         transition: transform .1s, border-color .1s; -webkit-tap-highlight-color:transparent; }
  .mut:hover { border-color:#4aa3ff; transform:translateX(-2px); }
  .mut:active { transform:scale(.98); }
  .mut.locked { opacity:.32; cursor:not-allowed; filter:grayscale(1); }
  .mut.locked:hover { transform:none; border-color:#24466a; }
  .mut.max  { opacity:.55; cursor:default; border-color:#2f6b4a; }
  .mut.poor .cost { color:#a5656b; }
  .mut .name { font-weight:600; color:#9fe8ff; font-size:13px; }
  .mut .cost { float:right; color:#8ef3c8; font-variant-numeric:tabular-nums; font-weight:600; }
  .mut .desc { color:#7fa4c0; font-size:11px; margin-top:2px; }
  .mut .lv   { color:#4f7fa8; font-size:10px; margin-top:2px;
               letter-spacing:.06em; text-transform:uppercase; }

  #toast { position:absolute; left:50%; top:16%; transform:translateX(-50%);
           text-align:center; pointer-events:none;
           font-size:clamp(16px, 3vw, 26px); font-weight:700;
           opacity:0; transition:opacity .4s ease;
           text-shadow:0 2px 18px #000, 0 0 40px #2af; white-space:nowrap; }
  #toast small { display:block; font-size:clamp(11px, 1.6vw, 14px);
                 font-weight:400; opacity:.9; margin-top:6px; color:#9fd; }

  #win { position:absolute; left:50%; top:40%;
         transform:translate(-50%,-50%); text-align:center;
         font-size:clamp(24px, 6vw, 48px); font-weight:800;
         color:#ffe89a; text-shadow:0 0 40px #fc0, 0 2px 20px #000;
         opacity:0; transition:opacity .6s ease; pointer-events:none; }
  #win small { display:block; font-size:clamp(12px, 1.8vw, 16px);
               color:#cfe9ff; margin-top:10px; font-weight:400; }

  #hint { position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
          font-size:clamp(10px, 1.4vw, 12px); color:#4c7699; text-align:center;
          text-shadow:0 1px 4px #000; max-width:90vw; }

  /* --- Mobile: shrink the shop, hide descriptions --- */
  @media (max-width: 700px){
    #hud { font-size:12px; }
    #hud b { font-size:18px; }
    #hud .bar { width:140px; height:6px; }
    #shop { width:170px; font-size:11px; top:10px; right:10px; }
    .mut { padding:6px 8px; }
    .mut .desc { display:none; }
    .mut .name { font-size:11px; }
    #hud { top:10px; left:10px; }
  }
  @media (max-width: 380px){
    #shop { width:150px; }
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
    </div>
    <div id="shop"><h3>Mutations</h3><div id="shopList"></div></div>
    <div id="toast"></div>
    <div id="win"></div>
    <div id="hint">Hold mouse / touch to swim toward that point · find glowing relics</div>
  </div>
`);

/* ---------- 3. GAME DATA ---------- */

// 10 evolution stages. `body` = [light, dark] colour of the sprite.
// Each stage has a distinct creature sprite (see drawCreature).
const STAGES = [
  { name:'Primordial Ocean', depth:'−4000 m', need:0,    preds:0,
    bg:['#04121f','#073a52'], body:['#8ff7d0','#0e6b52'] },
  { name:'Coral Reef',       depth:'−200 m',  need:40,   preds:1,
    bg:['#062033','#0a5568'], body:['#9ff0e0','#0a6b62'] },
  { name:'Tidal Shallows',   depth:'−20 m',   need:110,  preds:2,
    bg:['#0a3346','#148e96'], body:['#a0f0d0','#0a7b4a'] },
  { name:'Shoreline',        depth:'0 m',     need:220,  preds:3,
    bg:['#123c4a','#37a8a8'], body:['#b0f0b0','#3a7b2a'] },
  { name:'First Land',       depth:'+10 m',   need:380,  preds:4,
    bg:['#163b28','#6fae5b'], body:['#c8f0a0','#5a7b1a'] },
  { name:'Amphibian',        depth:'Swamp',   need:600,  preds:5,
    bg:['#1a3a2a','#7cbf6a'], body:['#d8f090','#6a6b1a'] },
  { name:'Reptile',          depth:'Jungle',  need:900,  preds:6,
    bg:['#1e3a1e','#8fbf5a'], body:['#e8e080','#7a5b1a'] },
  { name:'Mammal',           depth:'Plains',  need:1300, preds:7,
    bg:['#2a3a20','#c9b96a'], body:['#f0c070','#8a4b1a'] },
  { name:'Primate',          depth:'Forest',  need:1800, preds:8,
    bg:['#243520','#a8a04a'], body:['#f0a060','#7a3b1a'] },
  { name:'Human',            depth:'Civil.',  need:2400, preds:9,
    bg:['#1a2a3a','#b8a870'], body:['#f0c0a0','#6a3b2a'] },
];

const MUT_LIST = [
  { key:'flagellum', name:'Flagellum',    desc:'+38 swim speed',     base:8,  max:5 },
  { key:'membrane',  name:'Membrane',     desc:'+45 max health',     base:10, max:5 },
  { key:'eyespot',   name:'Eye Spot',     desc:'+55 pickup range',   base:9,  max:5 },
  { key:'mito',      name:'Mitochondria', desc:'+25% biomass',       base:12, max:5 },
  { key:'chloro',    name:'Chloroplast',  desc:'+0.7 biomass / sec', base:15, max:5 },
  { key:'wall',      name:'Cell Wall',    desc:'−12% damage taken',  base:14, max:5 },
  { key:'jaws',      name:'Jaws',         desc:'Bite predators',     base:18, max:5 },
];
const MUT = Object.fromEntries(MUT_LIST.map(m => [m.key, m]));

const RELICS = [
  { key:'flagellum', name:'Flagellum',    text:'A whip-like tail. You can swim faster.' },
  { key:'membrane',  name:'Membrane',     text:'A protective skin. Tougher body.' },
  { key:'eyespot',   name:'Eye Spot',     text:'Light sensitivity. Sense food further.' },
  { key:'mito',      name:'Mitochondria', text:'The powerhouse. Extract more energy.' },
  { key:'chloro',    name:'Chloroplast',  text:'Harvest light. Passive biomass.' },
  { key:'wall',      name:'Cell Wall',    text:'A rigid shell. Take less damage.' },
  { key:'jaws',      name:'Jaws',         text:'Fight back. Bite predators.' },
];

/* ---------- 4. STATE ---------- */

const world  = { w: 3200, h: 3200 };
const cam    = { x: 0, y: 0 };

const player = {
  x: world.w / 2, y: world.h / 2,
  vx: 0, vy: 0, r: 13,
  hp: 100, maxHp: 100,
  levels: Object.fromEntries(MUT_LIST.map(m => [m.key, 0])),
  unlocked: {},
  invuln: 0, flash: 0,
  fx: 0, fy: 1,             // smoothed facing direction
};

const state = {
  t: 0,
  biomass: 0, totalEarned: 0,
  stage: 0,
  foods: [], predators: [], relics: [], fx: [],
  victory: false,
};

const keys  = {};                                   // kept, but only touch/mouse used
const mouse = { x: 0, y: 0, down: false };          // x/y are CSS-pixel coords
let predTimer = 0, toastTimer = 0, uiDirty = true;

/* ---------- 5. HELPERS ---------- */

const rnd   = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Player stats — derived live from mutation levels.
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

// World → screen
const toScreen = (x, y) => [x - cam.x + VW / 2, y - cam.y + VH / 2];

// Screen (CSS px) → world
const toWorld = (sx, sy) => [sx + cam.x - VW / 2, sy + cam.y - VH / 2];

function toast(title, sub){
  const el = document.getElementById('toast');
  el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
  el.style.opacity = 1;
  toastTimer = 2.8;
}

function burst(x, y, n, hue, spd = 160){
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2;
    const s = rnd(spd * 0.3, spd);
    state.fx.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
                    life: rnd(.35,.8), max: .8, r: rnd(1.5, 3.5), hue });
  }
}

/* ---------- 6. SPAWNING ---------- */

function spawnFood(){
  const st = state.stage;
  state.foods.push({
    x: rnd(60, world.w - 60),
    y: rnd(60, world.h - 60),
    r: rnd(3.5, 6.5) * ES,
    v: (1.5 + Math.random() * 3) * (1 + st * 0.35),
    hue: [140, 175, 190, 95][Math.floor(Math.random() * 4)],
    ph: Math.random() * 6.28,
  });
}

function spawnPredator(){
  const st = state.stage;
  let x, y, tries = 0;
  do {
    x = rnd(80, world.w - 80);
    y = rnd(80, world.h - 80);
    tries++;
  } while (Math.hypot(x - player.x, y - player.y) < 550 && tries < 40);

  state.predators.push({
    x, y, vx: 0, vy: 0,
    r: (16 + st * 2.2 + Math.random() * 7) * ES,
    hp: 30 + st * 18, maxHp: 30 + st * 18,
    speed: (60 + st * 22 + Math.random() * 25) * ES,
    hue: 350 - st * 6,
    ph: Math.random() * 6.28,
  });
}

function spawnRelic(){
  const have = new Set(state.relics.map(r => r.key));
  const pool = RELICS.filter(d => !player.unlocked[d.key] && !have.has(d.key));
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  // FIX: avoid spawning under the shop (top-right of the screen)
  // and too close to the player.
  let x, y, tries = 0, ok = false;
  while (tries < 80){
    x = rnd(200, world.w - 200);
    y = rnd(200, world.h - 200);
    const [sx, sy] = toScreen(x, y);
    const underShop = sx > VW - 320 && sy < 420;
    const nearPlayer = Math.hypot(x - player.x, y - player.y) < 500;
    if (!underShop && !nearPlayer){ ok = true; break; }
    tries++;
  }
  if (!ok) return;

  state.relics.push({
    x, y, key: pick.key, name: pick.name, text: pick.text,
    ph: Math.random() * 6.28,
  });
}

/* ---------- 7. ECONOMY ---------- */

const costOf = key => Math.round(MUT[key].base * Math.pow(1.55, player.levels[key]));

function buy(key){
  if (!player.unlocked[key]) return;
  const lvl = player.levels[key];
  if (lvl >= MUT[key].max) return;
  const cost = costOf(key);
  if (state.biomass < cost) return;

  state.biomass -= cost;
  player.levels[key] = lvl + 1;
  if (key === 'membrane') player.hp += 45;
  burst(player.x, player.y, 14, 170, 120);
  uiDirty = true;
}

/* ---------- 8. UPDATE ---------- */

function update(dt){
  state.t += dt;
  const p = player;
  const S = getStats();

  p.maxHp = S.maxHp;
  const baseR = 13 + Math.min(20, Math.sqrt(state.totalEarned) * 0.6);
  p.r = baseR * ES;
  p.invuln = Math.max(0, p.invuln - dt);
  p.flash  = Math.max(0, p.flash  - dt);

  /* --- movement: pointer steering only --- */
  let ix = 0, iy = 0;
  if (mouse.down){
    const [wx, wy] = toWorld(mouse.x, mouse.y);
    const dx = wx - p.x, dy = wy - p.y;
    const d  = Math.hypot(dx, dy);
    if (d > 15){ ix = dx / d; iy = dy / d; }
  }

  p.vx += (ix * S.speed * ES - p.vx) * Math.min(1, dt * 9);
  p.vy += (iy * S.speed * ES - p.vy) * Math.min(1, dt * 9);
  p.x = clamp(p.x + p.vx * dt, p.r, world.w - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, world.h - p.r);

  // Smooth facing
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 6){
    p.fx += (p.vx / sp - p.fx) * Math.min(1, dt * 10);
    p.fy += (p.vy / sp - p.fy) * Math.min(1, dt * 10);
    const fl = Math.hypot(p.fx, p.fy) || 1;
    p.fx /= fl; p.fy /= fl;
  }

  /* --- camera --- */
  cam.x = world.w > VW ? clamp(p.x, VW / 2, world.w - VW / 2) : world.w / 2;
  cam.y = world.h > VH ? clamp(p.y, VH / 2, world.h - VH / 2) : world.h / 2;

  /* --- passive biomass --- */
  if (S.chloro > 0){
    state.biomass     += S.chloro * dt;
    state.totalEarned += S.chloro * dt;
  }

  /* --- food --- */
  const targetFood = Math.floor(world.w * world.h / 55000);
  while (state.foods.length < targetFood) spawnFood();

  for (let i = state.foods.length - 1; i >= 0; i--){
    const f = state.foods[i];
    const dx = p.x - f.x, dy = p.y - f.y;
    const d  = Math.hypot(dx, dy) || 0.001;

    if (d < p.r + S.magnet * ES){
      const pull = (1 - d / (p.r + S.magnet * ES)) * 420 * ES;
      f.x += (dx / d) * pull * dt;
      f.y += (dy / d) * pull * dt;
    }
    if (d < p.r + f.r + 2){
      const gain = f.v * S.digest;
      state.biomass     += gain;
      state.totalEarned += gain;
      p.hp = Math.min(p.maxHp, p.hp + 1.4);
      burst(f.x, f.y, 5, f.hue, 90);
      state.foods.splice(i, 1);
      uiDirty = true;
    }
  }

  /* --- predators --- */
  const targetPreds = STAGES[state.stage].preds;
  predTimer -= dt;
  if (state.predators.length < targetPreds && predTimer <= 0){
    predTimer = 1.8;
    spawnPredator();
  }

  for (let i = state.predators.length - 1; i >= 0; i--){
    const q = state.predators[i];
    const dx = p.x - q.x, dy = p.y - q.y;
    const d  = Math.hypot(dx, dy) || 0.001;

    if (d < 560 * ES){
      q.vx += (dx / d) * q.speed * dt * 3;
      q.vy += (dy / d) * q.speed * dt * 3;
    } else {
      q.vx += Math.cos(state.t * 0.7 + q.ph) * 40 * dt * ES;
      q.vy += Math.sin(state.t * 0.9 + q.ph) * 40 * dt * ES;
    }
    const qs = Math.hypot(q.vx, q.vy);
    if (qs > q.speed){ q.vx = q.vx / qs * q.speed; q.vy = q.vy / qs * q.speed; }
    q.vx *= 0.985; q.vy *= 0.985;
    q.x = clamp(q.x + q.vx * dt, q.r, world.w - q.r);
    q.y = clamp(q.y + q.vy * dt, q.r, world.h - q.r);

    if (d < q.r + p.r){
      if (p.invuln <= 0){
        p.hp -= (16 + state.stage * 5) * S.armor * dt;
        p.flash = 0.12;
        if (Math.random() < dt * 8) burst(p.x, p.y, 2, 0, 70);
      }
      if (S.jaws > 0){
        q.hp -= S.jaws * dt;
        if (Math.random() < dt * 14) burst(q.x, q.y, 2, 10, 80);
      }
      const push = 120 * dt * ES;
      q.x -= (dx / d) * push; q.y -= (dy / d) * push;
      p.x += (dx / d) * push * 0.6; p.y += (dy / d) * push * 0.6;
    }

    if (q.hp <= 0){
      burst(q.x, q.y, 22, q.hue, 200);
      for (let k = 0; k < 4; k++){
        state.foods.push({
          x: q.x + rnd(-20, 20), y: q.y + rnd(-20, 20),
          r: rnd(4, 7) * ES, v: rnd(3, 6), hue: 30, ph: Math.random() * 6.28,
        });
      }
      state.predators.splice(i, 1);
    }
  }

  /* --- death --- */
  if (p.hp <= 0){
    const lost = Math.floor(state.biomass * 0.25);
    state.biomass -= lost;
    p.hp = p.maxHp;
    p.x = world.w / 2; p.y = world.h / 2;
    p.vx = p.vy = 0;
    p.invuln = 2.5;
    state.predators.length = 0;
    toast('You were eaten', `Lost ${lost} biomass — regrow and try again`);
    uiDirty = true;
  }

  /* --- relics --- */
  for (let i = state.relics.length - 1; i >= 0; i--){
    const rl = state.relics[i];
    if (Math.hypot(p.x - rl.x, p.y - rl.y) < p.r + 30 * ES){
      player.unlocked[rl.key] = true;
      burst(rl.x, rl.y, 40, 50, 260);
      toast('Discovered: ' + rl.name, rl.text);
      state.relics.splice(i, 1);
      uiDirty = true;
    }
  }
  // Keep 2 relics on the map while any remain to discover
  while (state.relics.length < 2 &&
         state.relics.length < RELICS.length - Object.keys(player.unlocked).length){
    const before = state.relics.length;
    spawnRelic();
    if (state.relics.length === before) break;
  }

  /* --- stage progression --- */
  let s = state.stage;
  while (s + 1 < STAGES.length && state.totalEarned >= STAGES[s + 1].need) s++;
  if (s !== state.stage){
    state.stage = s;
    world.w = Math.max(world.w, 3200 + s * 200);
    world.h = Math.max(world.h, 3200 + s * 200);
    toast(STAGES[s].name, 'You have evolved — ' + STAGES[s].depth);
    burst(p.x, p.y, 50, 180, 340);
    uiDirty = true;

    if (s === STAGES.length - 1 && !state.victory){
      state.victory = true;
      const w = document.getElementById('win');
      w.innerHTML = 'YOU ARE HUMAN<small>From a single cell to civilization.</small>';
      w.style.opacity = 1;
    }
  }

  /* --- fx --- */
  for (let i = state.fx.length - 1; i >= 0; i--){
    const f = state.fx[i];
    f.life -= dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.vx *= 0.94; f.vy *= 0.94;
    if (f.life <= 0) state.fx.splice(i, 1);
  }

  if (toastTimer > 0){
    toastTimer -= dt;
    if (toastTimer <= 0) document.getElementById('toast').style.opacity = 0;
  }
}

/* ---------- 9. RENDERING ---------- */

// Parallax "plankton" dots
const plankton = [];
for (let i = 0; i < 200; i++){
  plankton.push({ x: Math.random() * 4000, y: Math.random() * 4000,
                  r: rnd(0.5, 2.1), a: rnd(0.08, 0.42) });
}

/* --- shared body helper --- */
function radialBody(w, h, c1, c2){
  const g = ctx.createRadialGradient(-w*0.3, -h*0.3, Math.min(w,h)*0.1, 0, 0, Math.max(w,h));
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* --- stage 0–3: single cell --- */
function drawCell(r, t, c1, c2, stage){
  // organic wobbling blob
  ctx.beginPath();
  const N = 26;
  for (let i = 0; i <= N; i++){
    const a = (i / N) * Math.PI * 2;
    const wobble = 0.06 + stage * 0.015;
    const rr = r * (1 + wobble * Math.sin(a * 3 + t * 2) + 0.04 * Math.sin(a * 5 - t * 1.6));
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r*0.35, -r*0.35, r*0.1, 0, 0, r*1.15);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();

  // nucleus — big at stage 0, smaller as organelles appear
  const nucR = r * (0.32 - stage * 0.03);
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.15, nucR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(200,255,235,.85)';
  ctx.fill();

  // organelles — one more per stage
  ctx.fillStyle = 'rgba(180,255,220,.65)';
  for (let i = 0; i < stage; i++){
    const a = (i / Math.max(1, stage)) * Math.PI * 2 + t * 0.3;
    const rr = r * 0.55;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyespot accessory (small eye-looking dot if unlocked)
  if (player.levels.eyespot > 0){
    ctx.beginPath();
    ctx.arc(r * 0.25, -r * 0.1, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a14';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.29, -r * 0.14, r * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

/* --- stages 4–7: four-legged creatures, rotated to face direction --- */
function drawQuadruped(r, t, c1, c2, stage, ang){
  ctx.save();
  ctx.rotate(ang);

  const upright   = false;
  const hasEars   = stage >= 7;
  const bodyW     = r * (1.15 + (stage - 4) * 0.12);
  const bodyH     = r * (0.75 + (stage - 4) * 0.06);
  const legLen    = r * (0.55 + (stage - 4) * 0.08);
  const legW      = Math.max(2, r * 0.22);
  const headR     = r * (0.55 + (stage - 4) * 0.02);

  // tail (stages 4–7 all have one, gets longer)
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.85, 0);
  const tailWob = Math.sin(t * 4) * r * 0.12;
  const tailLen = r * (0.5 + (stage - 4) * 0.15);
  ctx.quadraticCurveTo(-bodyW * 1.2, -r * 0.15 + tailWob,
                       -bodyW * 1.1 - tailLen, tailWob);
  ctx.lineWidth = Math.max(2, r * 0.28);
  ctx.lineCap = 'round';
  ctx.strokeStyle = c2;
  ctx.stroke();

  // back legs
  const swing = Math.sin(t * 8) * 0.25;
  ctx.fillStyle = c2;
  for (const [lx, sgn] of [[-bodyW*0.55, -1], [-bodyW*0.35, 1]]){
    ctx.save();
    ctx.translate(lx, sgn * bodyH * 0.35);
    ctx.rotate(swing * sgn);
    ctx.fillRect(-legW/2, 0, legW, legLen);
    ctx.restore();
  }

  // body
  radialBody(bodyW, bodyH, c1, c2);

  // front legs
  for (const [lx, sgn] of [[bodyW*0.35, -1], [bodyW*0.55, 1]]){
    ctx.save();
    ctx.translate(lx, sgn * bodyH * 0.35);
    ctx.rotate(-swing * sgn);
    ctx.fillRect(-legW/2, 0, legW, legLen);
    ctx.restore();
  }

  // head
  const headX = bodyW * 0.95;
  const headY = -bodyH * 0.25;
  ctx.beginPath();
  ctx.arc(headX, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = c1;
  ctx.fill();

  // snout (reptile+)
  if (stage >= 6){
    ctx.beginPath();
    ctx.ellipse(headX + headR * 0.55, headY + headR * 0.1,
                headR * 0.55, headR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ears (mammal)
  if (hasEars){
    ctx.fillStyle = c2;
    for (const sgn of [-1, 1]){
      ctx.beginPath();
      ctx.arc(headX + headR * 0.1 * sgn, headY - headR * 0.85,
              headR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // eyes
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1, 1]){
    ctx.beginPath();
    ctx.arc(headX + headR * 0.35, headY + headR * 0.1 * sgn,
            headR * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  // mouth (reptile+)
  if (stage >= 6){
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.arc(headX + headR * 0.6, headY + headR * 0.15,
            headR * 0.2, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  ctx.restore();
}

/* --- stage 8: upright primate --- */
function drawPrimate(r, t, c1, c2, facingLeft){
  ctx.save();
  ctx.scale(facingLeft ? -1 : 1, 1);

  // legs
  const legPhase = Math.sin(t * 8) * 0.25;
  ctx.fillStyle = c2;
  for (const sgn of [-1, 1]){
    ctx.save();
    ctx.translate(sgn * r * 0.35, r * 0.55);
    ctx.rotate(sgn * legPhase);
    ctx.fillRect(-r * 0.13, 0, r * 0.26, r * 0.75);
    ctx.restore();
  }

  // torso
  radialBody(r * 0.6, r * 0.85, c1, c2);

  // arms
  const armPhase = Math.sin(t * 8 + Math.PI) * 0.25;
  ctx.fillStyle = c2;
  for (const sgn of [-1, 1]){
    ctx.save();
    ctx.translate(sgn * r * 0.55, -r * 0.1);
    ctx.rotate(sgn * armPhase);
    ctx.fillRect(-r * 0.1, 0, r * 0.2, r * 0.75);
    ctx.restore();
  }

  // head
  ctx.beginPath();
  ctx.arc(0, -r * 1.05, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = c1;
  ctx.fill();

  // ears
  ctx.fillStyle = c2;
  for (const sgn of [-1, 1]){
    ctx.beginPath();
    ctx.arc(sgn * r * 0.5, -r * 1.05, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyes + mouth
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1, 1]){
    ctx.beginPath();
    ctx.arc(sgn * r * 0.15, -r * 1.1, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, -r * 0.95, r * 0.18, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

/* --- stage 9: human --- */
function drawHuman(r, t, c1, c2, facingLeft){
  ctx.save();
  ctx.scale(facingLeft ? -1 : 1, 1);

  // legs (walking)
  const legPhase = Math.sin(t * 8) * 0.3;
  ctx.fillStyle = '#2d3a5a';
  for (const sgn of [-1, 1]){
    ctx.save();
    ctx.translate(sgn * r * 0.3, r * 0.6);
    ctx.rotate(sgn * legPhase);
    ctx.fillRect(-r * 0.12, 0, r * 0.24, r * 0.9);
    ctx.restore();
  }

  // torso
  const g = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r*0.9);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.55, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // arms
  const armPhase = Math.sin(t * 8 + Math.PI) * 0.3;
  ctx.fillStyle = c2;
  for (const sgn of [-1, 1]){
    ctx.save();
    ctx.translate(sgn * r * 0.55, -r * 0.15);
    ctx.rotate(sgn * armPhase);
    ctx.fillRect(-r * 0.1, 0, r * 0.2, r * 0.75);
    ctx.restore();
  }

  // head
  ctx.beginPath();
  ctx.arc(0, -r * 1.0, r * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = c1;
  ctx.fill();

  // hair
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(0, -r * 1.05, r * 0.5, Math.PI * 1.02, Math.PI * 2.02);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#0a0a14';
  for (const sgn of [-1, 1]){
    ctx.beginPath();
    ctx.arc(sgn * r * 0.16, -r * 1.0, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // smile
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(0, -r * 0.9, r * 0.15, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

/* --- master dispatcher: pick the sprite for the current stage --- */
function drawCreature(cx, cy, r, stage, t, dir, colors, flashing){
  const [c1, c2] = flashing ? ['#ffb0b0', '#b03030'] : colors;
  const ang = Math.atan2(dir.y, dir.x);

  ctx.save();
  ctx.translate(cx, cy);

  if (stage <= 3){
    // Single cell — no orientation
    drawCell(r, t, c1, c2, stage);
  } else if (stage <= 7){
    // Quadruped — rotated to face direction
    drawQuadruped(r, t, c1, c2, stage, ang);
  } else if (stage === 8){
    // Primate — upright, mirrored to face direction
    drawPrimate(r, t, c1, c2, dir.x < 0);
  } else {
    // Human — upright, mirrored
    drawHuman(r, t, c1, c2, dir.x < 0);
  }

  ctx.restore();
}

/* --- rest of rendering --- */
function drawEdgeHint(x, y, color){
  const [sx, sy] = toScreen(x, y);
  const m = 46;
  if (sx > m && sx < VW - m && sy > m && sy < VH - m) return;

  const cx = VW / 2, cy = VH / 2;
  let dx = sx - cx, dy = sy - cy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;

  const t = Math.min((VW / 2 - m) / Math.abs(dx || 1e-6),
                     (VH / 2 - m) / Math.abs(dy || 1e-6));
  const px = cx + dx * t, py = cy + dy * t;

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
  const p  = player;

  // clear screen (no letterbox — the canvas is full-viewport)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VW, VH);

  // background gradient per stage
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, st.bg[0]);
  bg.addColorStop(1, st.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  // parallax plankton
  ctx.save();
  for (const q of plankton){
    const px = ((q.x - cam.x * 0.45) % VW + VW) % VW;
    const py = ((q.y - cam.y * 0.45) % VH + VH) % VH;
    ctx.globalAlpha = q.a;
    ctx.fillStyle = '#bdf0ff';
    ctx.beginPath();
    ctx.arc(px, py, q.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.restore();

  // world bounds
  const [bx, by] = toScreen(0, 0);
  ctx.strokeStyle = 'rgba(120,220,255,.20)';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, world.w, world.h);

  // food
  for (const f of state.foods){
    const [sx, sy] = toScreen(f.x, f.y);
    if (sx < -20 || sy < -20 || sx > VW + 20 || sy > VH + 20) continue;
    const pulse = 1 + 0.16 * Math.sin(state.t * 3 + f.ph);
    ctx.beginPath();
    ctx.arc(sx, sy, f.r * pulse, 0, 6.2832);
    ctx.fillStyle = `hsla(${f.hue},90%,66%,.95)`;
    ctx.shadowBlur = 14;
    ctx.shadowColor = `hsla(${f.hue},95%,60%,.9)`;
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // relics
  for (const rl of state.relics){
    const [sx, sy] = toScreen(rl.x, rl.y);
    const pulse = 1 + 0.2 * Math.sin(state.t * 2.6 + rl.ph);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(state.t * 0.7);
    ctx.shadowBlur = 26; ctx.shadowColor = '#ffd45e';
    ctx.strokeStyle = 'rgba(255,212,94,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 20 * pulse, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0.4, 2.2); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    const sd = 8 * pulse;
    ctx.shadowBlur = 22; ctx.shadowColor = '#ffd45e';
    ctx.fillStyle = '#ffe89a';
    ctx.fillRect(-sd / 2, -sd / 2, sd, sd);
    ctx.restore();

    // label
    ctx.font = 'bold 13px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,232,154,.95)';
    ctx.shadowBlur = 8; ctx.shadowColor = '#000';
    ctx.fillText(rl.name, sx, sy + 52);
    ctx.shadowBlur = 0;
  }

  // predators
  for (const q of state.predators){
    const [sx, sy] = toScreen(q.x, q.y);
    if (sx < -80 || sy < -80 || sx > VW + 80 || sy > VH + 80) continue;

    // Simple blob body + spikes
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = `hsla(${q.hue},90%,55%,.8)`;
    ctx.beginPath();
    const N = 20;
    for (let i = 0; i <= N; i++){
      const a = (i / N) * Math.PI * 2;
      const wobble = 0.08 * Math.sin(a * 3 + state.t * 2 + q.ph)
                   + 0.05 * Math.sin(a * 5 - state.t * 1.6);
      const spike = Math.abs(Math.sin(a * 7 + state.t * 3)) * 0.18;
      const rr = q.r * (1 + wobble + spike);
      const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
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
    ctx.arc(sx + q.r * 0.25, sy - q.r * 0.15, q.r * 0.22, 0, 6.2832);
    ctx.fillStyle = '#12040a';
    ctx.fill();
  }

  // player
  const [px, py] = toScreen(p.x, p.y);
  const flick = p.invuln > 0 && Math.floor(state.t * 12) % 2 === 0;
  if (!flick){
    // Outer glow
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = p.flash > 0 ? '#ff5566' : st.body[0];

    // Flagellum tail (extra flair on stages 0–3)
    if (state.stage <= 3 && p.levels.flagellum > 0){
      ctx.strokeStyle = 'rgba(140,255,210,.55)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 1 + p.levels.flagellum; i++){
        const off = (i - p.levels.flagellum / 2) * 6;
        const dir = Math.atan2(p.vy, p.vx) || 0;
        ctx.beginPath();
        for (let s = 0; s < 14; s++){
          const f = s / 13;
          const wob = Math.sin(state.t * 9 - s * 0.7 + i) * 7 * f;
          const x = px - Math.cos(dir) * (p.r + f * 34) - Math.sin(dir) * (off + wob);
          const y = py - Math.sin(dir) * (p.r + f * 34) + Math.cos(dir) * (off + wob);
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }

    // The actual creature — the sprite evolves every stage
    drawCreature(px, py, p.r, state.stage, state.t, { x: p.fx, y: p.fy },
                 st.body, p.flash > 0);

    ctx.restore();
  }

  // particles
  for (const f of state.fx){
    const [sx, sy] = toScreen(f.x, f.y);
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    ctx.fillStyle = f.hue === 0 ? '#ff6b81' : `hsl(${f.hue},95%,68%)`;
    ctx.beginPath();
    ctx.arc(sx, sy, f.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // edge arrows for off-screen relics
  for (const rl of state.relics) drawEdgeHint(rl.x, rl.y, 'rgba(255,212,94,.9)');

  // vignette
  const v = ctx.createRadialGradient(VW/2, VH/2, Math.min(VW,VH)*0.35,
                                     VW/2, VH/2, Math.max(VW,VH)*0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VW, VH);

  // damage vignette
  if (p.hp < p.maxHp * 0.35){
    const a = (1 - p.hp / (p.maxHp * 0.35)) * 0.25 * (0.6 + 0.4 * Math.sin(state.t * 6));
    ctx.fillStyle = `rgba(255,40,60,${a})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}

/* ---------- 10. UI ---------- */

const shopList = document.getElementById('shopList');
const rows = {};

(function buildShop(){
  for (const m of MUT_LIST){
    const el = document.createElement('div');
    el.className = 'mut locked';
    el.innerHTML = `
      <span class="cost"></span>
      <div class="name">${m.name}</div>
      <div class="desc">${m.desc}</div>
      <div class="lv"></div>`;
    // pointerup instead of click → touch-friendly on mobile
    el.addEventListener('pointerup', e => { e.stopPropagation(); buy(m.key); });
    shopList.appendChild(el);
    rows[m.key] = {
      el,
      cost: el.querySelector('.cost'),
      name: el.querySelector('.name'),
      desc: el.querySelector('.desc'),
      lv:   el.querySelector('.lv'),
    };
  }
})();

function updateUI(){
  document.getElementById('bio').textContent = Math.floor(state.biomass);
  document.getElementById('hpFill').style.width =
    clamp(player.hp / player.maxHp * 100, 0, 100) + '%';
  document.getElementById('stageName').textContent = STAGES[state.stage].name;

  const cur = STAGES[state.stage].need;
  const nxt = STAGES[state.stage + 1] ? STAGES[state.stage + 1].need : null;
  document.getElementById('progFill').style.width =
    nxt ? clamp((state.totalEarned - cur) / (nxt - cur) * 100, 0, 100) + '%' : '100%';

  for (const m of MUT_LIST){
    const r = rows[m.key];
    const unlocked = !!player.unlocked[m.key];
    const lvl      = player.levels[m.key];
    const maxed    = lvl >= m.max;
    const cost     = costOf(m.key);

    r.el.classList.toggle('locked', !unlocked);
    r.el.classList.toggle('max',    unlocked && maxed);
    r.el.classList.toggle('poor',   unlocked && !maxed && state.biomass < cost);

    if (!unlocked){
      r.name.textContent = '???';
      r.desc.textContent = 'Find the relic';
      r.cost.textContent = '';
      r.lv.textContent   = '';
    } else {
      r.name.textContent = m.name;
      r.desc.textContent = m.desc;
      r.cost.textContent = maxed ? '' : cost;
      r.lv.textContent   = `LV ${lvl} / ${m.max}`;
    }
  }
}

/* ---------- 11. INPUT (pointer only — works with mouse AND touch) ---------- */

// Track the pointer in CSS pixels; convert to world coords in update().
cvs.addEventListener('pointerdown', e => {
  e.preventDefault();
  cvs.setPointerCapture?.(e.pointerId);
  const r = cvs.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  mouse.down = true;
});

cvs.addEventListener('pointermove', e => {
  const r = cvs.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});

// window-level up/cancel so a release outside the canvas still stops.
function pointerUp(){ mouse.down = false; }
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);
window.addEventListener('blur', pointerUp);

// Prevent iOS from turning quick drags into scroll gestures.
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------- 12. LOOP & BOOT ---------- */

let last = performance.now();
let uiTimer = 0;

function frame(now){
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05);           // clamp after tab switch

  update(dt);
  render();

  uiTimer -= dt;
  if (uiDirty || uiTimer <= 0){ updateUI(); uiDirty = false; uiTimer = 0.12; }

  requestAnimationFrame(frame);
}

// First-time init
resize();
for (let i = 0; i < 90; i++) spawnFood();
spawnRelic();
spawnRelic();
toast('You are a single cell', 'Hold anywhere to swim · find the glowing relics');

requestAnimationFrame(frame);

})();

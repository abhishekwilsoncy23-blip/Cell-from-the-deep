(() => {
  'use strict';

  /* ============================================================
     EVOLVE — single cell → human
     Two-file structure:
       index.html  → minimal shell (canvas + <script src>)
       game.js     → EVERYTHING: scaling, CSS, HUD, background, logic

     To change the base resolution / aspect, edit only DESIGN below.
     ============================================================ */

  /* ---------- 1. DESIGN RESOLUTION ---------- */
  // All gameplay & drawing uses a fixed logical space (1600×900).
  // The canvas + DOM HUD are scaled to fit the window.
  const DESIGN = { w: 1600, h: 900 };
  const VW = DESIGN.w;
  const VH = DESIGN.h;

  const cvs = document.getElementById('c');
  const ctx = cvs.getContext('2d');

  // View info computed by resize()
  const view = { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 };

  /* ---------- 2. CSS + DOM injected from JS ---------- */
  document.head.insertAdjacentHTML('beforeend', `<style>
    #ui {
      position: fixed; left: 0; top: 0;
      width: ${DESIGN.w}px; height: ${DESIGN.h}px;
      transform-origin: 0 0;
      pointer-events: none;           /* clicks pass through to canvas */
      font-family: ui-sans-serif, system-ui, sans-serif;
      color: #cfe9ff;
      user-select: none;
    }
    /* Only the shop receives pointer events */
    #shop, #shop * { pointer-events: auto; }

    #hud {
      position: absolute; top: 14px; left: 14px;
      font-size: 15px; line-height: 1.55;
      text-shadow: 0 1px 6px #000;
    }
    #hud b { font-size: 24px; color: #8ef3c8; }
    .bar {
      width: 230px; height: 8px;
      background: #0d2233;
      border: 1px solid #24486a;
      border-radius: 5px;
      margin: 5px 0 10px;
      overflow: hidden;
    }
    .bar > i {
      display: block; height: 100%; width: 0;
      border-radius: 5px; transition: width .18s;
    }
    #hpFill   { background: linear-gradient(90deg,#ff5f6d,#ffc371); }
    #progFill { background: linear-gradient(90deg,#39d0ff,#7CFFB2); }

    #shop {
      position: absolute; top: 14px; right: 14px;
      width: 270px; font-size: 13px;
    }
    #shop h3 {
      margin: 0 0 8px;
      font-size: 13px; letter-spacing: .14em;
      text-transform: uppercase; color: #5f8fb8; font-weight: 600;
    }
    .mut {
      background: rgba(9,26,42,.86);
      border: 1px solid #24466a;
      border-radius: 9px;
      padding: 8px 10px; margin-bottom: 6px;
      cursor: pointer; transition: .12s;
    }
    .mut:hover { border-color: #4aa3ff; transform: translateX(-2px); }
    .mut.locked { opacity: .32; cursor: not-allowed; filter: grayscale(1); }
    .mut.locked:hover { transform: none; border-color: #24466a; }
    .mut.max  { opacity: .55; cursor: default; border-color: #2f6b4a; }
    .mut.poor .cost { color: #a5656b; }
    .mut .name { font-weight: 600; color: #9fe8ff; }
    .mut .cost { float: right; color: #8ef3c8; font-variant-numeric: tabular-nums; }
    .mut .desc { color: #7fa4c0; font-size: 12px; margin-top: 2px; }
    .mut .lv   { color: #4f7fa8; font-size: 11px; margin-top: 2px; letter-spacing: .06em; }

    #toast {
      position: absolute; left: 50%; top: 20%;
      transform: translateX(-50%);
      text-align: center;
      pointer-events: none;
      font-size: 28px; font-weight: 700;
      opacity: 0; transition: opacity .45s;
      text-shadow: 0 2px 18px #000, 0 0 40px #2af;
      white-space: nowrap;
    }
    #toast small {
      display: block; font-size: 15px; font-weight: 400;
      opacity: .9; margin-top: 6px; color: #9fd;
    }

    #hint {
      position: absolute; bottom: 14px; left: 50%;
      transform: translateX(-50%);
      font-size: 13px; color: #6b96b8; text-align: center;
      text-shadow: 0 1px 4px #000;
    }

    /* Victory banner shown when reaching Human */
    #win {
      position: absolute; left: 50%; top: 42%;
      transform: translate(-50%,-50%);
      text-align: center;
      font-size: 40px; font-weight: 800;
      color: #ffe89a;
      text-shadow: 0 0 40px #fc0, 0 2px 20px #000;
      opacity: 0; transition: opacity .6s;
      pointer-events: none;
    }
    #win small {
      display: block; font-size: 16px;
      color: #cfe9ff; margin-top: 10px; font-weight: 400;
    }
  </style>`);

  // HUD / shop / toasts live inside #ui so they scale as one block.
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ui">
      <div id="hud">
        <div>Biomass <b id="bio">0</b></div>
        <div>Health</div>
        <div class="bar"><i id="hpFill"></i></div>
        <div id="stageName">Primordial Ocean</div>
        <div class="bar"><i id="progFill"></i></div>
      </div>
      <div id="shop"><h3>Mutations</h3><div id="shopList"></div></div>
      <div id="toast"></div>
      <div id="win"></div>
      <div id="hint">WASD / Arrows to swim · hold mouse to steer · find glowing relics</div>
    </div>
  `);

  /* ---------- 3. SCALING ---------- */
  // Fits the 1600×900 design inside the window (letterbox), and
  // applies the same transform to the DOM HUD.
  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Physical canvas size
    cvs.width  = Math.floor(w * dpr);
    cvs.height = Math.floor(h * dpr);
    cvs.style.width  = w + 'px';
    cvs.style.height = h + 'px';

    // Fit scale + centering offsets
    view.w = w; view.h = h; view.dpr = dpr;
    view.scale = Math.min(w / DESIGN.w, h / DESIGN.h);
    view.ox = (w - DESIGN.w * view.scale) / 2;
    view.oy = (h - DESIGN.h * view.scale) / 2;

    // Scale the DOM HUD identically
    const ui = document.getElementById('ui');
    ui.style.width  = DESIGN.w + 'px';
    ui.style.height = DESIGN.h + 'px';
    ui.style.transform = `translate(${view.ox}px, ${view.oy}px) scale(${view.scale})`;
  }
  window.addEventListener('resize', resize);
  resize();

  // Convert a client (screen) coordinate → design coordinate.
  // Use this for any mouse / touch input.
  function screenToDesign(clientX, clientY){
    return [
      (clientX - view.ox) / view.scale,
      (clientY - view.oy) / view.scale,
    ];
  }

  /* ---------- 4. GAME DATA ---------- */

  // 10 evolution stages. Low thresholds → reach Human in a few minutes.
  // `body` drives the player sprite colour; `bg` is the backdrop.
  const STAGES = [
    { name:'Primordial Ocean', depth:'−4000 m',      need:0,    bg:['#04121f','#073a52'], preds:0, body:['#8ff7d0','#0e6b52'] },
    { name:'Coral Reef',       depth:'−200 m',       need:40,   bg:['#062033','#0a5568'], preds:1, body:['#9ff0e0','#0a6b62'] },
    { name:'Tidal Shallows',   depth:'−20 m',        need:110,  bg:['#0a3346','#148e96'], preds:2, body:['#b0f0d0','#0a7b4a'] },
    { name:'Shoreline',        depth:'0 m',          need:220,  bg:['#123c4a','#37a8a8'], preds:3, body:['#c0f0b0','#3a7b2a'] },
    { name:'First Land',       depth:'+10 m',        need:380,  bg:['#163b28','#6fae5b'], preds:4, body:['#d0f0a0','#5a7b1a'] },
    { name:'Amphibian',        depth:'Swamp',        need:600,  bg:['#1a3a2a','#7cbf6a'], preds:5, body:['#e0f090','#6a6b1a'] },
    { name:'Reptile',          depth:'Jungle',       need:900,  bg:['#1e3a1e','#8fbf5a'], preds:6, body:['#f0e080','#7a5b1a'] },
    { name:'Mammal',           depth:'Plains',       need:1300, bg:['#2a3a20','#c9b96a'], preds:7, body:['#f0c070','#8a4b1a'] },
    { name:'Primate',          depth:'Forest',       need:1800, bg:['#243520','#a8a04a'], preds:8, body:['#f0a060','#7a3b1a'] },
    { name:'Human',            depth:'Civilization', need:2400, bg:['#1a2a3a','#b8a870'], preds:9, body:['#f0c0a0','#6a3b2a'] },
  ];

  // 7 mutation lines — cheap, fast to max (5 levels).
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

  // Relics spawn in the world. Picking one unlocks the matching mutation line.
  const RELICS = [
    { key:'flagellum', name:'Flagellum',    text:'A whip-like tail. You can swim faster.' },
    { key:'membrane',  name:'Membrane',     text:'A protective skin. Tougher body.' },
    { key:'eyespot',   name:'Eye Spot',     text:'Light sensitivity. Sense food further.' },
    { key:'mito',      name:'Mitochondria', text:'The powerhouse. Extract more energy.' },
    { key:'chloro',    name:'Chloroplast',  text:'Harvest light. Passive biomass.' },
    { key:'wall',      name:'Cell Wall',    text:'A rigid shell. Take less damage.' },
    { key:'jaws',      name:'Jaws',         text:'Fight back. Bite predators.' },
  ];

  /* ---------- 5. STATE ---------- */
  const world = { w: 2600, h: 2600 };
  const cam   = { x: 0, y: 0 };

  const player = {
    x: world.w / 2, y: world.h / 2,
    vx: 0, vy: 0, r: 13,
    hp: 100, maxHp: 100,
    levels: Object.fromEntries(MUT_LIST.map(m => [m.key, 0])),
    unlocked: {},
    invuln: 0, flash: 0,
    // Smoothed facing direction (used for eyes)
    fx: 0, fy: 1,
  };

  const state = {
    t: 0,
    biomass: 0,
    totalEarned: 0,
    stage: 0,
    foods: [],
    predators: [],
    relics: [],
    fx: [],
    victory: false,
  };

  const keys  = {};
  const mouse = { x: 0, y: 0, down: false };   // x/y are in DESIGN coords
  let predTimer = 0;
  let toastTimer = 0;
  let uiDirty = true;

  /* ---------- 6. HELPERS ---------- */
  const rnd   = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Stats derived from current mutation levels.
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

  // World → screen (design space)
  const toScreen = (x, y) => [x - cam.x + VW / 2, y - cam.y + VH / 2];

  // Centered toast message for ~2.8 s.
  function toast(title, sub){
    const el = document.getElementById('toast');
    el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    el.style.opacity = 1;
    toastTimer = 2.8;
  }

  // Particle burst.
  function burst(x, y, n, hue, spd = 160){
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2;
      const s = rnd(spd * 0.3, spd);
      state.fx.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rnd(.35, .8), max: .8,
        r: rnd(1.5, 3.5), hue,
      });
    }
  }

  /* ---------- 7. SPAWNING ---------- */

  function spawnFood(){
    const st = state.stage;
    state.foods.push({
      x: rnd(60, world.w - 60),
      y: rnd(60, world.h - 60),
      r: rnd(3.5, 6.5),
      // Higher stages give more valuable food
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
    } while (Math.hypot(x - player.x, y - player.y) < 600 && tries < 40);

    state.predators.push({
      x, y, vx: 0, vy: 0,
      r: 16 + st * 2.5 + Math.random() * 7,
      hp: 30 + st * 18, maxHp: 30 + st * 18,
      speed: 60 + st * 22 + Math.random() * 25,
      hue: 350 - st * 6,
      ph: Math.random() * 6.28,
    });
  }

  function spawnRelic(){
    const have = new Set(state.relics.map(r => r.key));
    const pool = RELICS.filter(d => !player.unlocked[d.key] && !have.has(d.key));
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    let x, y, tries = 0;
    do {
      x = rnd(150, world.w - 150);
      y = rnd(150, world.h - 150);
      tries++;
    } while (Math.hypot(x - player.x, y - player.y) < 600 && tries < 60);

    state.relics.push({
      x, y, key: pick.key,
      name: pick.name, text: pick.text,
      ph: Math.random() * 6.28,
    });
  }

  /* ---------- 8. ECONOMY ---------- */

  // Cost grows 1.55^lv from a small base → fast to level early.
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

  /* ---------- 9. UPDATE ---------- */
  function update(dt){
    state.t += dt;
    const p = player;
    const S = getStats();

    p.maxHp = S.maxHp;
    p.r = 13 + Math.min(20, Math.sqrt(state.totalEarned) * 0.6);
    p.invuln = Math.max(0, p.invuln - dt);
    p.flash  = Math.max(0, p.flash  - dt);

    /* --- input → desired direction --- */
    let ix = 0, iy = 0;
    if (keys['w'] || keys['arrowup'])    iy--;
    if (keys['s'] || keys['arrowdown'])  iy++;
    if (keys['a'] || keys['arrowleft'])  ix--;
    if (keys['d'] || keys['arrowright']) ix++;

    // Mouse steering (only when no keyboard input)
    if (ix === 0 && iy === 0 && mouse.down){
      const wx = mouse.x - VW / 2 + cam.x;   // convert to world coords
      const wy = mouse.y - VH / 2 + cam.y;
      const dx = wx - p.x, dy = wy - p.y, d = Math.hypot(dx, dy);
      if (d > 10){ ix = dx / d; iy = dy / d; }
    }
    const il = Math.hypot(ix, iy);
    if (il > 0){ ix /= il; iy /= il; }

    /* --- velocity with smoothing --- */
    p.vx += (ix * S.speed - p.vx) * Math.min(1, dt * 9);
    p.vy += (iy * S.speed - p.vy) * Math.min(1, dt * 9);
    p.x = clamp(p.x + p.vx * dt, p.r, world.w - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, world.h - p.r);

    // Update facing direction (for eyes)
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 6){
      p.fx += (p.vx / sp - p.fx) * Math.min(1, dt * 10);
      p.fy += (p.vy / sp - p.fy) * Math.min(1, dt * 10);
      const fl = Math.hypot(p.fx, p.fy) || 1;
      p.fx /= fl; p.fy /= fl;
    }

    /* --- camera follows player, clamped to world --- */
    cam.x = world.w > VW ? clamp(p.x, VW / 2, world.w - VW / 2) : world.w / 2;
    cam.y = world.h > VH ? clamp(p.y, VH / 2, world.h - VH / 2) : world.h / 2;

    /* --- passive biomass from chloroplast --- */
    if (S.chloro > 0){
      state.biomass     += S.chloro * dt;
      state.totalEarned += S.chloro * dt;
    }

    /* --- food --- */
    const targetFood = 80 + state.stage * 20;
    while (state.foods.length < targetFood) spawnFood();

    for (let i = state.foods.length - 1; i >= 0; i--){
      const f = state.foods[i];
      const dx = p.x - f.x, dy = p.y - f.y;
      const d  = Math.hypot(dx, dy) || 0.001;

      // Magnet pull toward player
      if (d < p.r + S.magnet){
        const pull = (1 - d / (p.r + S.magnet)) * 420;
        f.x += (dx / d) * pull * dt;
        f.y += (dy / d) * pull * dt;
      }

      // Eat
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

      // Chase if near, otherwise drift
      if (d < 560){
        q.vx += (dx / d) * q.speed * dt * 3;
        q.vy += (dy / d) * q.speed * dt * 3;
      } else {
        q.vx += Math.cos(state.t * 0.7 + q.ph) * 40 * dt;
        q.vy += Math.sin(state.t * 0.9 + q.ph) * 40 * dt;
      }
      const qs = Math.hypot(q.vx, q.vy);
      if (qs > q.speed){ q.vx = q.vx / qs * q.speed; q.vy = q.vy / qs * q.speed; }
      q.vx *= 0.985; q.vy *= 0.985;
      q.x = clamp(q.x + q.vx * dt, q.r, world.w - q.r);
      q.y = clamp(q.y + q.vy * dt, q.r, world.h - q.r);

      // Contact
      if (d < q.r + p.r){
        if (p.invuln <= 0){
          const dmg = (16 + state.stage * 5) * S.armor * dt;
          p.hp -= dmg;
          p.flash = 0.12;
          if (Math.random() < dt * 8) burst(p.x, p.y, 2, 0, 70);
        }
        if (S.jaws > 0){
          q.hp -= S.jaws * dt;
          if (Math.random() < dt * 14) burst(q.x, q.y, 2, 10, 80);
        }
        // Push apart
        const push = 120 * dt;
        q.x -= (dx / d) * push; q.y -= (dy / d) * push;
        p.x += (dx / d) * push * 0.6; p.y += (dy / d) * push * 0.6;
      }

      // Predator dies → drops food
      if (q.hp <= 0){
        burst(q.x, q.y, 22, q.hue, 200);
        for (let k = 0; k < 4; k++){
          state.foods.push({
            x: q.x + rnd(-20, 20), y: q.y + rnd(-20, 20),
            r: rnd(4, 7), v: rnd(3, 6), hue: 30, ph: Math.random() * 6.28,
          });
        }
        state.predators.splice(i, 1);
      }
    }

    /* --- player death --- */
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

    /* --- relic pickups --- */
    for (let i = state.relics.length - 1; i >= 0; i--){
      const rl = state.relics[i];
      if (Math.hypot(p.x - rl.x, p.y - rl.y) < p.r + 30){
        player.unlocked[rl.key] = true;
        burst(rl.x, rl.y, 40, 50, 260);
        toast('Discovered: ' + rl.name, rl.text);
        state.relics.splice(i, 1);
        uiDirty = true;
      }
    }
    // Keep 2 relics on the map while any remain to discover
    while (
      state.relics.length < 2 &&
      state.relics.length < RELICS.length - Object.keys(player.unlocked).length
    ){
      const before = state.relics.length;
      spawnRelic();
      if (state.relics.length === before) break;
    }

    /* --- stage progression (→ Human) --- */
    let s = state.stage;
    while (s + 1 < STAGES.length && state.totalEarned >= STAGES[s + 1].need) s++;
    if (s !== state.stage){
      state.stage = s;
      // Grow the world each stage
      world.w = 2600 + s * 420;
      world.h = 2600 + s * 420;
      toast(STAGES[s].name, 'You have evolved — ' + STAGES[s].depth);
      burst(p.x, p.y, 50, 180, 340);
      uiDirty = true;

      // Final stage = Human → victory banner
      if (s === STAGES.length - 1 && !state.victory){
        state.victory = true;
        const win = document.getElementById('win');
        win.innerHTML = 'YOU ARE HUMAN<small>From a single cell to civilization.</small>';
        win.style.opacity = 1;
      }
    }

    /* --- particle fx --- */
    for (let i = state.fx.length - 1; i >= 0; i--){
      const f = state.fx[i];
      f.life -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vx *= 0.94; f.vy *= 0.94;
      if (f.life <= 0) state.fx.splice(i, 1);
    }

    /* --- toast timer --- */
    if (toastTimer > 0){
      toastTimer -= dt;
      if (toastTimer <= 0) document.getElementById('toast').style.opacity = 0;
    }
  }

  /* ---------- 10. RENDER ---------- */

  // Parallax "plankton" dots for background depth.
  const plankton = [];
  for (let i = 0; i < 160; i++){
    plankton.push({
      x: Math.random() * 2000, y: Math.random() * 2000,
      r: rnd(0.5, 2.1), a: rnd(0.08, 0.42), s: rnd(0.2, 0.8),
    });
  }

  // Wobbly organic blob used for player + predators.
  function drawBlob(x, y, r, t, c1, c2, spikes = 0){
    ctx.beginPath();
    const N = 26;
    for (let i = 0; i <= N; i++){
      const a = (i / N) * Math.PI * 2;
      let rr = r * (1 + 0.06 * Math.sin(a * 3 + t * 2) + 0.045 * Math.sin(a * 5 - t * 1.6));
      if (spikes) rr += Math.abs(Math.sin(a * spikes + t * 3)) * r * 0.22;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.15);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Arrow at the edge of the screen pointing toward an off-screen relic.
  function drawEdgeHint(x, y, color){
    const [sx, sy] = toScreen(x, y);
    const m = 46;
    if (sx > m && sx < VW - m && sy > m && sy < VH - m) return;

    const cx = VW / 2, cy = VH / 2;
    let dx = sx - cx, dy = sy - cy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;

    const t = Math.min(
      (VW / 2 - m) / Math.abs(dx || 1e-6),
      (VH / 2 - m) / Math.abs(dy || 1e-6)
    );
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
    /* ---- clear full physical canvas (letterbox color) ---- */
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, view.w, view.h);

    /* ---- apply design-space transform ---- */
    const s = view.dpr * view.scale;
    ctx.setTransform(s, 0, 0, s, view.dpr * view.ox, view.dpr * view.oy);

    const st = STAGES[state.stage];
    const p  = player;

    /* background gradient (per stage) */
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, st.bg[0]);
    g.addColorStop(1, st.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    /* parallax plankton */
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

    /* world bounds outline */
    const [bx, by] = toScreen(0, 0);
    ctx.strokeStyle = 'rgba(120,220,255,.20)';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, world.w, world.h);

    /* food */
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
      ctx.shadowBlur = 0;
    }

    /* relics */
    for (const rl of state.relics){
      const [sx, sy] = toScreen(rl.x, rl.y);
      const pulse = 1 + 0.2 * Math.sin(state.t * 2.6 + rl.ph);

      // rotating rings
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(state.t * 0.7);
      ctx.shadowBlur = 26;
      ctx.shadowColor = '#ffd45e';
      ctx.strokeStyle = 'rgba(255,212,94,.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20 * pulse, 0, 6.2832);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 30 * pulse, 0.4, 2.2);
      ctx.stroke();
      ctx.restore();

      // diamond core
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      const sd = 8 * pulse;
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ffd45e';
      ctx.fillStyle = '#ffe89a';
      ctx.fillRect(-sd / 2, -sd / 2, sd, sd);
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    /* predators */
    for (const q of state.predators){
      const [sx, sy] = toScreen(q.x, q.y);
      if (sx < -80 || sy < -80 || sx > VW + 80 || sy > VH + 80) continue;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsla(${q.hue},90%,55%,.8)`;
      drawBlob(sx, sy, q.r, state.t + q.ph,
               `hsl(${q.hue},85%,62%)`, `hsl(${q.hue},80%,28%)`, 7);
      ctx.restore();

      // single eye
      ctx.beginPath();
      ctx.arc(sx + q.r * 0.28, sy - q.r * 0.18, q.r * 0.2, 0, 6.2832);
      ctx.fillStyle = '#12040a';
      ctx.fill();
    }

    /* player */
    const [px, py] = toScreen(p.x, p.y);
    const flick = p.invuln > 0 && Math.floor(state.t * 12) % 2 === 0;
    if (!flick){
      ctx.save();

      // flagellum tails (one strand per mutation level)
      const L = p.levels.flagellum;
      if (L > 0){
        ctx.strokeStyle = 'rgba(140,255,210,.55)';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 1 + L; i++){
          const off = (i - L / 2) * 6;
          const dir = Math.atan2(p.vy, p.vx) || 0;
          ctx.beginPath();
          for (let sIdx = 0; sIdx < 14; sIdx++){
            const f = sIdx / 13;
            const wob = Math.sin(state.t * 9 - sIdx * 0.7 + i) * 7 * f;
            const x = px - Math.cos(dir) * (p.r + f * 34) - Math.sin(dir) * (off + wob);
            const y = py - Math.sin(dir) * (p.r + f * 34) + Math.cos(dir) * (off + wob);
            sIdx ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
      }

      // body — colour is driven by the current stage
      const glow = p.flash > 0 ? 'hsl(0,90%,70%)' : st.body[0];
      ctx.shadowBlur = 28;
      ctx.shadowColor = p.flash > 0 ? '#ff5566' : st.body[0];
      drawBlob(px, py, p.r, state.t, glow, st.body[1]);
      ctx.restore();

      // Ocean stages: nucleus. Land stages: forward-facing eyes.
      if (state.stage < 4){
        ctx.beginPath();
        ctx.arc(px - p.r * 0.2, py - p.r * 0.2, p.r * 0.3, 0, 6.2832);
        ctx.fillStyle = 'rgba(190,255,235,.85)';
        ctx.fill();
      } else {
        const perpX = -p.fy, perpY = p.fx;
        const eoff  = p.r * 0.38;
        const edist = p.r * 0.32;
        for (const side of [-1, 1]){
          const ex = px + p.fx * edist + perpX * eoff * side;
          const ey = py + p.fy * edist + perpY * eoff * side;
          ctx.beginPath();
          ctx.arc(ex, ey, p.r * 0.17, 0, 6.2832);
          ctx.fillStyle = '#0a0a14';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ex + p.fx * 1.5, ey + p.fy * 1.5, p.r * 0.07, 0, 6.2832);
          ctx.fillStyle = '#fff';
          ctx.fill();
        }
      }
    }

    /* fx particles */
    for (const f of state.fx){
      const [sx, sy] = toScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.hue === 0 ? '#ff6b81' : `hsl(${f.hue},95%,68%)`;
      ctx.beginPath();
      ctx.arc(sx, sy, f.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* off-screen relic hints */
    for (const rl of state.relics){
      drawEdgeHint(rl.x, rl.y, 'rgba(255,212,94,.9)');
    }

    /* vignette */
    const v = ctx.createRadialGradient(
      VW / 2, VH / 2, Math.min(VW, VH) * 0.35,
      VW / 2, VH / 2, Math.max(VW, VH) * 0.78
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VW, VH);

    /* red damage vignette when low HP */
    if (p.hp < p.maxHp * 0.35){
      const a = (1 - p.hp / (p.maxHp * 0.35)) * 0.25 * (0.6 + 0.4 * Math.sin(state.t * 6));
      ctx.fillStyle = `rgba(255,40,60,${a})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  /* ---------- 11. UI ---------- */

  const shopList = document.getElementById('shopList');
  const rows = {};

  // Build the shop from MUT_LIST once.
  (function buildShop(){
    for (const m of MUT_LIST){
      const el = document.createElement('div');
      el.className = 'mut locked';
      el.innerHTML = `
        <span class="cost"></span>
        <div class="name">${m.name}</div>
        <div class="desc">${m.desc}</div>
        <div class="lv"></div>`;
      el.addEventListener('click', () => buy(m.key));
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

  // Refresh HUD + shop every ~0.12 s, or immediately after changes.
  function updateUI(){
    document.getElementById('bio').textContent = Math.floor(state.biomass);
    document.getElementById('hpFill').style.width =
      clamp(player.hp / player.maxHp * 100, 0, 100) + '%';
    document.getElementById('stageName').textContent = STAGES[state.stage].name;

    // Progress bar toward the next stage
    const cur = STAGES[state.stage].need;
    const nxt = STAGES[state.stage + 1] ? STAGES[state.stage + 1].need : null;
    document.getElementById('progFill').style.width =
      nxt ? clamp((state.totalEarned - cur) / (nxt - cur) * 100, 0, 100) + '%' : '100%';

    // Mutation rows
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

  /* ---------- 12. INPUT ---------- */
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false;
  });

  // Pointer input is converted to design coords via screenToDesign.
  cvs.addEventListener('pointerdown', e => {
    mouse.down = true;
    const [x, y] = screenToDesign(e.clientX, e.clientY);
    mouse.x = x; mouse.y = y;
  });
  cvs.addEventListener('pointermove', e => {
    const [x, y] = screenToDesign(e.clientX, e.clientY);
    mouse.x = x; mouse.y = y;
  });
  addEventListener('pointerup', () => { mouse.down = false; });

  /* ---------- 13. LOOP ---------- */
  let last = performance.now();
  let uiTimer = 0;

  function frame(now){
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);        // clamp after tab switch

    update(dt);
    render();

    uiTimer -= dt;
    if (uiDirty || uiTimer <= 0){ updateUI(); uiDirty = false; uiTimer = 0.12; }

    requestAnimationFrame(frame);
  }

  /* ---------- 14. SEED ---------- */
  for (let i = 0; i < 90; i++) spawnFood();
  spawnRelic();
  spawnRelic();
  toast('You are a single cell', 'Eat drifting nutrients · find the glowing relics');

  requestAnimationFrame(frame);
})();

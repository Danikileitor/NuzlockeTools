(() => {
'use strict';
const {G: GAMES, P} = NZ;
const GM = Object.fromEntries(GAMES.map(g => [g.id, g]));
const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  kids.forEach(k => e.append(k));
  return e;
};
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/* ---------- i18n ---------- */
const I18N = {
  es: {game:'Juego', mode:'Parámetros', custom:'Personalizado', random:'Aleatorio', evo2:'Básico aleatorio con 2 evoluciones',
       generate:'Generar', again:'Generar de nuevo', pick:n => `Pokémon ${n}`, searchPh:'Buscar Pokémon…', noRes:'Sin resultados',
       hintCustom:'Elige los 3 Pokémon que aparecerán.', hintRandom:'Los 3 Pokémon serán completamente aleatorios.', hintEvo2:'Los 3 serán Pokémon básicos que evolucionan 2 veces en este juego.',
       missing:'Elige los 3 Pokémon para poder generar.', dupes:'Elige 3 Pokémon distintos.', tooFew:'No hay suficientes Pokémon que cumplan este parámetro en este juego.',
       clickBall:'Pulsa Generar (o una Poké Ball) para ver tus 3 opciones.', choose:'Elige a tu Pokémon inicial · arrastra para girar la escena', loading:'Cargando modelos 3D…',
       confirm:n => `¿Quieres elegir a ${n}?`, yes:'Sí', no:'No', chosen:n => `¡Tu Pokémon inicial es ${n}!`,
       save:'Guardar en el Nuzlocke', saved:'Guardado como Pokémon inicial en el Nuzlocke de este juego.', open:'Abrir Nuzlocke',
       nogl:'Tu navegador no puede mostrar gráficos 3D (WebGL). Prueba con otro navegador o activa la aceleración por hardware.',
       foot:'Gráficos 3D con Three.js · Modelos 3D de Pokemon-3D-api (proyecto de fans sin ánimo de lucro; los modelos son propiedad de Nintendo, Creatures Inc. y GAME FREAK inc.) · Datos de PokeAPI.'},
  en: {game:'Game', mode:'Parameters', custom:'Custom', random:'Random', evo2:'Random basic Pokémon with 2 evolutions',
       generate:'Generate', again:'Generate again', pick:n => `Pokémon ${n}`, searchPh:'Search Pokémon…', noRes:'No results',
       hintCustom:'Choose the 3 Pokémon that will appear.', hintRandom:'The 3 Pokémon will be completely random.', hintEvo2:'All 3 will be basic Pokémon that evolve twice in this game.',
       missing:'Choose all 3 Pokémon to generate.', dupes:'Choose 3 different Pokémon.', tooFew:'Not enough Pokémon match this parameter in this game.',
       clickBall:'Press Generate (or a Poké Ball) to see your 3 options.', choose:'Choose your starter Pokémon · drag to rotate the scene', loading:'Loading 3D models…',
       confirm:n => `Do you want to choose ${n}?`, yes:'Yes', no:'No', chosen:n => `Your starter Pokémon is ${n}!`,
       save:'Save to Nuzlocke', saved:'Saved as the starter Pokémon in this game\'s Nuzlocke.', open:'Open Nuzlocke',
       nogl:'Your browser cannot display 3D graphics (WebGL). Try another browser or enable hardware acceleration.',
       foot:'3D graphics with Three.js · 3D models from Pokemon-3D-api (non-commercial fan project; models are property of Nintendo, Creatures Inc. and GAME FREAK inc.) · Data from PokeAPI.'}
};
let lang = 'es';
try { lang = JSON.parse(localStorage.getItem('pm-lang')) || 'es'; } catch (e) {}
const t = k => I18N[lang][k];
const pn = p => P[p][lang === 'es' ? 0 : 1];
const gname = g => 'Pokémon ' + (lang === 'es' ? g.es : g.en);

/* ---------- Preferencias ---------- */
const PK = 'starter-prefs-v2';
const prefs = {game:'red', mode:'evo2', custom:['', '', '']};
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PK) || '{}')); } catch (e) {}
if (!GM[prefs.game]) prefs.game = 'red';
const savePrefs = () => { try { localStorage.setItem(PK, JSON.stringify(prefs)); } catch (e) {} };

// Modelos 3D (GLB con Draco): https://github.com/Pokemon-3D-api/assets  (por número de Pokédex)
const modelUrl = PokeModel.modelUrl;   // URL del modelo GLB (ver starter-model.js)
const art = p => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p}.png`;
const front = p => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p}.png`;

/* ---------- Reglas de generación ---------- */
const game = () => GM[prefs.game];
const ZYG_FORMS = new Set([10118, 10120]);   // Zygarde 10% y Completo: las únicas formas que cuentan como Pokémon aparte
const dexNum = p => ZYG_FORMS.has(p) ? 718 : p;
const species = () => game().dex.filter(p => p < 10000 || ZYG_FORMS.has(p));
function evo2Pool() {
  const inDex = new Set(species());
  const kids = {};
  for (const p of inDex) { const pre = EVO_PRE[p]; if (pre && inDex.has(pre)) (kids[pre] ||= []).push(p); }
  // básico (sin preevolución disponible) con al menos una cadena de 2 evoluciones
  return [...inDex].filter(p => !(EVO_PRE[p] && inDex.has(EVO_PRE[p])) && (kids[p] || []).some(c => (kids[c] || []).length));
}
const sample = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
function currentPool() { return prefs.mode === 'evo2' ? evo2Pool() : species(); }

/* ---------- UI de parámetros ---------- */
function combo(idx) {
  const wrap = el('div', {class:'cb'});
  const pv = el('img', {class:'pv', alt:''}); pv.onerror = () => { pv.style.visibility = 'hidden'; };
  const input = el('input', {type:'text', placeholder:t('searchPh'), autocomplete:'off'});
  const dd = el('div', {class:'dd'});
  wrap.append(pv, input, dd);
  let list = [], act = 0;
  const label = el('label', {text:t('pick')(idx + 1)});
  const show = () => {
    const p = prefs.custom[idx];
    input.value = p ? pn(p) : '';
    if (p) { pv.src = front(p); pv.style.visibility = ''; } else pv.removeAttribute('src');
  };
  const draw = () => {
    const q = norm(input.dataset.q || '');
    list = game().dex.filter(p => !q || norm(P[p][0] + ' ' + P[p][1]).includes(q));
    act = Math.min(act, Math.max(list.length - 1, 0));
    dd.replaceChildren();
    if (!list.length) { dd.append(el('div', {class:'empty', text:t('noRes')})); return; }
    list.slice(0, 400).forEach((p, i) => {
      const img = el('img', {src:front(p), alt:'', loading:'lazy'}); img.onerror = () => { img.style.visibility = 'hidden'; };
      const isSel = p === prefs.custom[idx];
      const row = el('div', {class: (i === act ? 'act' : '') + (isSel ? ' sel' : '')}, el('span', {}, img, el('span', {text:(isSel ? '✓ ' : '') + pn(p)})), el('small', {text:'#' + (ZYG_FORMS.has(p) ? 718 : p < 10000 ? p : '')}));
      const pick = e => { e.preventDefault(); choose(p); };
      row.addEventListener('mousedown', e => e.preventDefault());   // evita que el input pierda el foco antes de elegir
      row.addEventListener('pointerdown', pick);
      row.addEventListener('click', pick);
      dd.append(row);
    });
  };
  const open = () => { clearTimeout(closeT); dd.classList.add('open'); draw(); };
  let closeT;
  const close = () => dd.classList.remove('open');
  const choose = p => { prefs.custom[idx] = p; savePrefs(); clearTimeout(closeT); close(); show(); updateHint(); input.blur(); };
  input.addEventListener('focus', () => {
    input.dataset.q = ''; input.select();
    act = Math.max(0, game().dex.indexOf(prefs.custom[idx]));   // empieza en el Pokémon ya elegido
    open(); dd.querySelector('.sel')?.scrollIntoView({block:'center'});
  });
  input.addEventListener('input', () => { input.dataset.q = input.value; act = 0; open(); });
  input.addEventListener('blur', () => { closeT = setTimeout(close, 150); if (!input.value.trim() && prefs.custom[idx]) { prefs.custom[idx] = ''; savePrefs(); updateHint(); } show(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, Math.min(list.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); draw(); dd.querySelector('.act')?.scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[act] != null) choose(list[act]); }
    else if (e.key === 'Escape') input.blur();
  });
  show();
  return el('div', {}, label, wrap);
}
function renderParams() {
  document.documentElement.lang = lang; $('lang').value = lang;
  $('lblGame').textContent = t('game'); $('lblMode').textContent = t('mode'); $('foot').textContent = t('foot');
  const sel = $('game'); sel.replaceChildren();
  for (const g of GAMES) sel.append(el('option', {value:g.id, text:gname(g), ...(g.id === prefs.game ? {selected:''} : {})}));
  const modes = $('modes'); modes.replaceChildren();
  for (const m of ['custom', 'random', 'evo2'])
    modes.append(el('button', {class:'teambtn' + (prefs.mode === m ? ' on' : ''), type:'button', text:t(m), onclick:() => { prefs.mode = m; savePrefs(); renderParams(); }}));
  const cu = $('custom'); cu.hidden = prefs.mode !== 'custom'; cu.replaceChildren();
  if (prefs.mode === 'custom') for (let i = 0; i < 3; i++) cu.append(combo(i));
  $('gen').textContent = t('generate');
  $('dlgYes').textContent = t('yes'); $('dlgNo').textContent = t('no');
  $('resSave').textContent = t('save'); $('resOpen').textContent = t('open'); $('resAgain').textContent = t('again');
  $('resOpen').href = 'nuzlocke.html#' + prefs.game;
  updateHint();
  stage && stage.relabel();
}
function updateHint() {
  const h = $('hint'); h.classList.remove('warn');
  h.textContent = t({custom:'hintCustom', random:'hintRandom', evo2:'hintEvo2'}[prefs.mode]);
}
function warn(msg) { const h = $('hint'); h.textContent = msg; h.classList.add('warn'); }

/* ---------- Escena 3D ---------- */
const SLOT_X = [-3.4, 0, 3.4], R = 0.8, BALL_Y = 0.25 + R;
const ease = x => 1 - Math.pow(1 - x, 3);
let stage = null;

function createStage() {
  const cv = $('cv');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true}); } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;   // colores hex en sRGB (r149)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const draco = new THREE.DRACOLoader();
  draco.setDecoderPath(location.protocol === 'file:' ? 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/' : 'js/vendor/draco/');
  const gltfLoader = new THREE.GLTFLoader(); gltfLoader.setDRACOLoader(draco); gltfLoader.setCrossOrigin('anonymous');
  // rotación con ratón / dedo (sin zoom ni desplazamiento)
  const controls = new THREE.OrbitControls(camera, cv);
  Object.assign(controls, {enableZoom:false, enablePan:false, enableDamping:true, dampingFactor:0.08, rotateSpeed:0.8, minPolarAngle:0.55, maxPolarAngle:1.5});
  controls.target.set(0, 1.5, 0);

  // luces y escenario
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8a7bff, 0.6); rim.position.set(-6, 4, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({color:0x12141f, roughness:.8, metalness:.15}));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ringFloor = new THREE.Mesh(new THREE.RingGeometry(8.6, 8.8, 96), new THREE.MeshBasicMaterial({color:0xffcb47, transparent:true, opacity:.5, side:THREE.DoubleSide}));
  ringFloor.rotation.x = -Math.PI / 2; ringFloor.position.y = 0.01; scene.add(ringFloor);

  // textura de sombra
  const sc = document.createElement('canvas'); sc.width = sc.height = 64;
  const sx = sc.getContext('2d'), gr = sx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  const shadowTex = new THREE.CanvasTexture(sc);

  const mats = {
    red: new THREE.MeshStandardMaterial({color:0xe53935, roughness:.25, metalness:.15, side:THREE.DoubleSide}),
    white: new THREE.MeshStandardMaterial({color:0xf4f4f4, roughness:.3, metalness:.1, side:THREE.DoubleSide}),
    black: new THREE.MeshStandardMaterial({color:0x1b1b1b, roughness:.4, metalness:.3}),
    glow: new THREE.MeshBasicMaterial({color:0xfff2b0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide})
  };

  function makeSlot(i) {
    const s = {i, x:SLOT_X[i]};
    const group = new THREE.Group(); group.position.set(s.x, 0, 0); scene.add(group);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.25, 40), new THREE.MeshStandardMaterial({color:0x2a2f45, roughness:.4, metalness:.5}));
    base.position.y = 0.125; group.add(base);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.03, 8, 64), new THREE.MeshBasicMaterial({color:0xffcb47}));
    baseRing.rotation.x = Math.PI / 2; baseRing.position.y = 0.26; group.add(baseRing);
    const ball = new THREE.Group(); ball.position.y = BALL_Y; group.add(ball);
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.white); ball.add(bottom);
    const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.04, 12, 64), mats.black); band.rotation.x = Math.PI / 2; ball.add(band);
    const lid = new THREE.Group(); lid.position.set(0, 0, -R); ball.add(lid);
    const top = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mats.red); top.position.z = R; lid.add(top);
    const btn = new THREE.Group(); btn.position.set(0, 0, 2 * R); lid.add(btn);
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 32), mats.black); b1.rotation.x = Math.PI / 2; b1.position.z = -0.04; btn.add(b1);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 32), mats.white); b2.rotation.x = Math.PI / 2; b2.position.z = -0.03; btn.add(b2);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 32), mats.glow.clone()); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; ball.add(glow);
    const light = new THREE.PointLight(0xfff2b0, 0, 8); light.position.set(0, 1.4, 1); group.add(light);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({map:shadowTex, transparent:true, depthWrite:false}));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.03, 0); group.add(shadow);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 12), new THREE.MeshBasicMaterial({visible:false}));
    hit.position.y = 1.4; hit.userData.slot = i; group.add(hit);
    Object.assign(s, {group, ball, lid, glow, light, shadow, hit, mon:null, pid:0,
      lidV:0, lidT:0, prog:0, progT:0, hov:0, mx:0, mxT:0, gs:1, gsT:1, big:1, bigT:1, up:0, upT:0, burst:0, delay:0, pending:null});
    return s;
  }
  const slots = [0, 1, 2].map(makeSlot);

  // etiquetas HTML
  const labels = $('labels'); labels.replaceChildren();
  const lblEls = slots.map(() => { const d = el('div', {class:'lbl'}, el('b'), el('small')); labels.append(d); return d; });

  // partículas de celebración
  const N = 140, ppos = new Float32Array(N * 3), pvel = new Float32Array(N * 3), plife = new Float32Array(N);
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const dc = document.createElement('canvas'); dc.width = dc.height = 32; const dx = dc.getContext('2d'), dg = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
  dg.addColorStop(0, 'rgba(255,255,255,1)'); dg.addColorStop(.4, 'rgba(255,226,122,.8)'); dg.addColorStop(1, 'rgba(255,226,122,0)'); dx.fillStyle = dg; dx.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({map:new THREE.CanvasTexture(dc), color:0xffe27a, size:0.35, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false}));
  pts.frustumCulled = false; scene.add(pts);
  function burst(x, y) {
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      ppos.set([x, y, 0], i * 3); pvel.set([Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp * .6], i * 3); plife[i] = 1 + Math.random() * .8;
    }
  }
  for (let i = 0; i < N; i++) ppos[i * 3 + 1] = -50;

  // textura de respaldo con el nombre
  function textTexture(name) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#232837'; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.fill();
    g.fillStyle = '#e8ebf4'; g.font = 'bold 28px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 128);
    const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; return tx;
  }
  function loadTex(pid) {
    return new Promise(res => {
      const urls = [art(pid), front(pid)]; let i = 0;
      const next = () => {
        if (i >= urls.length) return res(textTexture(pn(pid)));
        loader.load(urls[i++], tx => { tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; res(tx); }, undefined, next);
      };
      next();
    });
  }

  const loadGltf = url => new Promise((res, rej) => gltfLoader.load(url, res, undefined, rej));
  // devuelve {obj} (modelo 3D centrado, de 2.6 de alto máx.) o {tex} (ilustración plana de respaldo)
  async function loadMon(pid) {
    const url = modelUrl(pid);
    if (url) {
      try {
        return PokeModel.prep(await loadGltf(url), pid);
      } catch (e) { /* sin modelo: usa la ilustración */ }
    }
    return {tex: await loadTex(pid)};
  }
  let state = 'idle', hoverIdx = -1, token = 0, onPick = null, onIdleClick = null, chosen = -1;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9);

  function clearMon(s) {
    if (s.mon) {
      s.mixer?.stopAllAction(); s.mixer?.uncacheRoot(s.mon); s.mixer = s.acts = null;
      s.group.remove(s.mon);
      s.mon.traverse(o => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
      });
      s.mon = null;
    }
  }
  function resetSlots() {
    slots.forEach(s => { clearMon(s); Object.assign(s, {lidT:0, progT:0, prog:0, mx:0, mxT:0, gs:1, gsT:1, bigT:1, big:1, up:0, upT:0, burst:0, pid:0, pending:null}); s.group.scale.setScalar(1); delete lblEls[s.i].dataset.pid; });
    chosen = -1; hoverIdx = -1;
  }
  async function reveal(pids, pickCb) {
    const my = ++token; state = 'loading'; onPick = pickCb;
    resetSlots(); lblEls.forEach(l => l.classList.add('off'));
    resetView();
    const loaded = await Promise.all(pids.map(loadMon));
    if (my !== token) return false;
    slots.forEach((s, i) => {
      s.pid = pids[i];
      let m;
      if (loaded[i].obj) m = loaded[i].obj;
      else {
        m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({map:loaded[i].tex, transparent:true, depthWrite:false, side:THREE.DoubleSide}));
        m.userData.billboard = true; m.renderOrder = 5;
      }
      m.scale.setScalar(0.01); m.position.y = BALL_Y; s.mon = m; s.spin = Math.random() * 6; s.group.add(m);
      s.mixer = loaded[i].mixer || null; s.acts = loaded[i].acts || null; s.cur = 'idle';
      s.delay = 0.35 + i * 0.45; s.pending = true;
    });
    state = 'revealing';
    return true;
  }
  function choose(i) {
    chosen = i; state = 'chosen';
    slots.forEach((s, k) => {
      s.lidT = 0;
      if (k === i) { s.mxT = -s.x; s.bigT = 1.2; s.upT = 0.55; s.burst = 4; burst(0, 2.8); }
      else { s.progT = 0; s.gsT = 0.001; }
    });
    lblEls.forEach((l, k) => l.classList.toggle('off', k !== i));
  }
  function idle() { token++; state = 'idle'; resetSlots(); lblEls.forEach(l => l.classList.add('off')); }

  function relabel() {
    slots.forEach((s, i) => {
      const l = lblEls[i];
      if (s.pid) { l.firstChild.textContent = pn(s.pid); l.lastChild.textContent = '#' + dexNum(s.pid); }
    });
  }

  // tamaño y cámara adaptables
  const home = new THREE.Vector3(); let placed = false;
  function resize() {
    const w = cv.clientWidth || 800, h = cv.clientHeight || 450;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const halfW = 5.6, fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.max(10, halfW / (Math.tan(fov / 2) * camera.aspect));
    home.set(0, 3.1 + dist * 0.12, dist);
    if (!placed) { camera.position.copy(home); placed = true; }
    else camera.position.sub(controls.target).setLength(home.clone().sub(controls.target).length()).add(controls.target);
    camera.updateProjectionMatrix(); controls.update();
  }
  function resetView() { camera.position.copy(home); controls.update(); }
  new ResizeObserver(resize).observe(cv); resize();

  function setPointer(e) {
    const r = cv.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function pickSlot() {
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(slots.map(s => s.hit), false)[0];
    return hit ? hit.object.userData.slot : -1;
  }
  cv.addEventListener('pointermove', e => { setPointer(e); const i = pickSlot(); hoverIdx = i; cv.classList.toggle('hot', i >= 0 && state !== 'loading' && state !== 'chosen'); });
  cv.addEventListener('pointerleave', () => { hoverIdx = -1; mouse.set(-9, -9); cv.classList.remove('hot'); });
  let down = null;
  cv.addEventListener('pointerdown', e => { down = {x:e.clientX, y:e.clientY}; });
  cv.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 6) return;   // fue un arrastre (rotación), no un clic
    setPointer(e); const i = pickSlot(); if (i < 0) return;
    if (state === 'idle') onIdleClick && onIdleClick();
    else if (state === 'reveal' && onPick) onPick(i);
  });

  const v3 = new THREE.Vector3(), clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, k = 1 - Math.exp(-dt * 7);
    let allDone = state === 'revealing';
    slots.forEach((s, i) => {
      if (s.pending) {
        s.delay -= dt;
        if (s.delay <= 0) { s.pending = false; s.lidT = 1.25; s.burst = 3; s.progT = 1; }
        else allDone = false;
      } else if (state === 'revealing' && s.prog < 0.97) allDone = false;
      s.lidV += (s.lidT - s.lidV) * k;
      s.lid.rotation.x = -s.lidV;
      const open = Math.min(1, s.lidV / 1.25);
      s.lid.scale.setScalar(Math.max(0.001, 1 - Math.max(0, open - 0.4) / 0.6));   // la tapa se encoge al abrirse para no tapar al Pokémon
      s.glow.material.opacity = open * 0.55 + (s.burst > 0 ? 0.3 : 0);
      s.burst = Math.max(0, s.burst - dt * 2.2);
      s.light.intensity = s.burst * 1.4 + open * 0.6;
      s.prog += (s.progT - s.prog) * (1 - Math.exp(-dt * 4.5));
      s.hov += ((hoverIdx === i && state === 'reveal' ? 1 : 0) - s.hov) * k;
      s.big += (s.bigT - s.big) * (1 - Math.exp(-dt * 4));
      s.mx += (s.mxT - s.mx) * (1 - Math.exp(-dt * 3.5)); s.up += (s.upT - s.up) * (1 - Math.exp(-dt * 3.5));
      s.gs += (s.gsT - s.gs) * (1 - Math.exp(-dt * 5)); s.group.scale.setScalar(Math.max(0.001, s.gs));
      // pelota: balanceo suave
      const idleWob = state === 'idle' || state === 'loading';
      s.ball.rotation.z = idleWob ? Math.sin(t * 2 + i) * 0.08 : s.ball.rotation.z * 0.9;
      s.ball.position.y = BALL_Y + (idleWob ? Math.sin(t * 1.6 + i * 1.3) * 0.05 : 0) + s.hov * 0.04;
      if (s.mon) {
        const e = ease(Math.max(0, Math.min(1, s.prog)));
        s.mon.position.set(s.mx / Math.max(0.001, s.gs), BALL_Y + e * (0.35 + (s.mon.userData.half || 1.35)) + s.up * 1.0 + Math.sin(t * 2.2 + i) * 0.09 * e + s.hov * 0.15, 0.2);
        const sc = Math.max(0.01, e * s.big * (1 + s.hov * 0.12));
        if (s.mixer || s.mon.userData.billboard) s.mon.scale.setScalar(sc);
        else {   // sin animación propia (p. ej. Mew): respiración, balanceo y saltitos al pasar el ratón / elegirlo
          const act = (hoverIdx === i && state === 'reveal') || (state === 'chosen' && chosen === i), br = Math.sin(t * 3 + i * 2) * 0.035;
          s.mon.scale.set(sc * (1 - br * 0.6), sc * (1 + br), sc * (1 - br * 0.6));
          s.mon.rotation.z = Math.sin(t * 1.7 + i) * 0.05;
          if (act) s.mon.position.y += Math.abs(Math.sin(t * 6)) * 0.28 * e;
        }
        if (s.mixer) {
          const want = state === 'chosen' && chosen === i ? 'win' : (hoverIdx === i && state === 'reveal') ? 'hover' : 'idle';
          if (want !== s.cur) {
            const next = s.acts[want] || s.acts.idle, prev = s.acts[s.cur] || s.acts.idle;
            if (next !== prev) { next.reset().fadeIn(0.25).play(); prev.fadeOut(0.25); }
            s.cur = want;
          }
          s.mixer.update(dt * (e > 0.05 ? 1 : 0));
        }
        if (s.mon.userData.billboard) s.mon.quaternion.copy(camera.quaternion);
        else { s.spin += dt * (hoverIdx === i ? 0.3 : 0.8); s.mon.rotation.y = s.spin; }
        s.shadow.scale.setScalar(0.5 + e * 0.8 * s.big); s.shadow.material.opacity = 0.35 + e * 0.5;
      }
      s.shadow.visible = !!s.mon;
      // etiqueta
      v3.set(s.x + s.mx, 0, 1.4).project(camera);
      const l = lblEls[i];
      l.style.left = ((v3.x + 1) / 2 * cv.clientWidth) + 'px'; l.style.top = ((1 - v3.y) / 2 * cv.clientHeight) + 'px';
      if (s.pid && s.prog > 0.6 && state !== 'loading') {
        if (!l.dataset.pid || +l.dataset.pid !== s.pid) { l.dataset.pid = s.pid; l.firstChild.textContent = pn(s.pid); l.lastChild.textContent = '#' + dexNum(s.pid); }
        l.classList.toggle('off', state === 'chosen' && chosen !== i);
        l.classList.toggle('hover', hoverIdx === i && state === 'reveal');
      }
    });
    if (allDone) { state = 'reveal'; onRevealed && onRevealed(); }
    // partículas
    for (let i = 0; i < N; i++) {
      if (plife[i] > 0) {
        plife[i] -= dt; pvel[i * 3 + 1] -= 7 * dt;
        ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
        if (plife[i] <= 0) ppos[i * 3 + 1] = -50;
      }
    }
    pgeo.attributes.position.needsUpdate = true;
    ringFloor.rotation.z = t * 0.1;
    controls.update();
    renderer.render(scene, camera);
  }
  let onRevealed = null;
  frame();
  idle();
  return {reveal, choose, idle, relabel, set onRevealed(f) { onRevealed = f; }, set onIdleClick(f) { onIdleClick = f; },
          get state() { return state; }, anims: () => slots.map(s => s.mixer ? {t:+s.mixer.time.toFixed(2), cur:s.cur, n:Object.values(s.acts).filter(Boolean).length} : null), kinds: () => slots.map(s => !s.mon ? 'none' : s.mon.userData.billboard ? 'flat' : '3d'), pidAt: i => slots[i].pid, resize};
}

/* ---------- Flujo ---------- */
let current = null, selected = -1;
function hideAll() { $('dialog').hidden = true; $('result').hidden = true; }
function generate() {
  if (!stage) return;
  let pids;
  if (prefs.mode === 'custom') {
    const c = prefs.custom;
    if (c.some(p => !p)) return warn(t('missing'));
    if (new Set(c).size < 3) return warn(t('dupes'));
    pids = c.slice();
  } else {
    const pool = currentPool();
    if (pool.length < 3) return warn(t('tooFew'));
    pids = sample(pool, 3);
  }
  updateHint(); hideAll(); current = pids; selected = -1;
  $('hint').textContent = t('loading');
  stage.reveal(pids, i => {
    selected = i; $('dlgText').textContent = t('confirm')(pn(pids[i])); $('dialog').hidden = false;
  }).then(ok => { if (ok) $('hint').textContent = t('choose'); });
}
function bind() {
  $('gen').onclick = generate;
  $('game').onchange = e => { prefs.game = e.target.value; prefs.custom = prefs.custom.map(p => game().dex.includes(p) ? p : ''); savePrefs(); renderParams(); if (stage) { hideAll(); stage.idle(); } };
  $('lang').onchange = e => { lang = e.target.value; try { localStorage.setItem('pm-lang', JSON.stringify(lang)); } catch (_) {} renderParams(); };
  $('dlgNo').onclick = () => { $('dialog').hidden = true; selected = -1; };
  $('dlgYes').onclick = () => {
    $('dialog').hidden = true; if (selected < 0) return;
    stage.choose(selected);
    $('resTitle').textContent = t('chosen')(pn(current[selected])); $('resMsg').textContent = ''; $('result').hidden = false;
  };
  $('resAgain').onclick = generate;
  $('resSave').onclick = () => {
    const pid = current[selected]; let db = {};
    try { db = JSON.parse(localStorage.getItem('nuzlocke-v1') || '{}') || {}; } catch (e) {}
    const g = db[prefs.game] || (db[prefs.game] = {c:{}, custom:[], random:false});
    g.c.starter = Object.assign({p:'', n:'', s:''}, g.c.starter, {p:pid, s:'caught'});
    try { localStorage.setItem('nuzlocke-v1', JSON.stringify(db)); $('resMsg').textContent = t('saved'); } catch (e) {}
  };
}

stage = createStage();
if (!stage) { $('nogl').hidden = false; $('nogl').textContent = t('nogl'); $('cv').hidden = true; }
else { stage.onIdleClick = generate; }
bind(); renderParams();
if (stage) $('hint').textContent = t('clickBall');
window.__stage = stage;   // útil para depurar
})();

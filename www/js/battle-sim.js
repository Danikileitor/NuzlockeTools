/* Simulador de combate 3D (popup). Usa el cálculo de daño de la calculadora y modelos GLB como el Starter Randomizer.
   BattleSim.open(api) · api = {lang, gen, sides:[{name, num, sprite, types, maxHP, curHP, speed, status, moves:[{n, label, type, acc}]}],
   trickRoom, calc(att, moveIdx, pcts, crit) → {rolls, eff, type, priority}|null, typeColors, typeLabel(type)} */
const BattleSim = (() => {
  'use strict';
  const L = {
    es: {title:'Simulación de combate', start:'Iniciar', pause:'Pausa', resume:'Continuar', step:'Siguiente turno', restart:'Reiniciar', close:'Cerrar', speed:'Velocidad', loading:'Cargando modelos…', turn:n => `Turno ${n}`,
      use:(a, m) => `${a} usa ${m}.`, se:'¡Es súper eficaz!', nve:'No es muy eficaz…', imm:d => `No afecta a ${d}…`, crit:'¡Golpe crítico!', miss:a => `¡${a} falla el ataque!`,
      faint:x => `¡${x} se ha debilitado!`, win:x => `¡${x} gana el combate!`, draw:'Empate: el combate se alarga demasiado.', nomove:a => `${a} no tiene movimientos que hagan daño.`,
      par:a => `¡${a} está paralizado y no se puede mover!`, slp:a => `${a} está dormido.`, wake:a => `¡${a} se ha despertado!`, frz:a => `${a} está congelado.`, thaw:a => `¡${a} se ha descongelado!`,
      brn:a => `${a} sufre daño por la quemadura.`, psn:a => `${a} sufre daño por el veneno.`, dmg:(d, p) => `−${d} PS (${p}%)`, hint:'Combate automático con las tiradas de daño de la calculadora; el resultado varía en cada simulación.', fallback:'Sin modelo 3D: se usa su ilustración.'},
    en: {title:'Battle simulation', start:'Start', pause:'Pause', resume:'Resume', step:'Next turn', restart:'Restart', close:'Close', speed:'Speed', loading:'Loading models…', turn:n => `Turn ${n}`,
      use:(a, m) => `${a} used ${m}.`, se:"It's super effective!", nve:"It's not very effective…", imm:d => `It doesn't affect ${d}…`, crit:'A critical hit!', miss:a => `${a}'s attack missed!`,
      faint:x => `${x} fainted!`, win:x => `${x} wins the battle!`, draw:'Draw: the battle drags on too long.', nomove:a => `${a} has no damaging moves.`,
      par:a => `${a} is paralyzed and can't move!`, slp:a => `${a} is fast asleep.`, wake:a => `${a} woke up!`, frz:a => `${a} is frozen solid.`, thaw:a => `${a} thawed out!`,
      brn:a => `${a} was hurt by its burn.`, psn:a => `${a} was hurt by poison.`, dmg:(d, p) => `−${d} HP (${p}%)`, hint:"Automatic battle using the calculator's damage rolls; the outcome changes every run.", fallback:'No 3D model: using its artwork.'}
  };
  const loaded = {};
  const loadScript = src => new Promise((res, rej) => {
    if (loaded[src]) return res();
    const s = document.createElement('script'); s.src = src; s.onload = () => { loaded[src] = 1; res(); }; s.onerror = () => rej(new Error('script ' + src)); document.head.append(s);
  });
  const ensureLibs = async () => { for (const s of ['js/vendor/three.min.js', 'js/vendor/GLTFLoader.js', 'js/vendor/DRACOLoader.js', 'js/starter-model.js']) await loadScript(s); };
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } kids.forEach(c => c && e.append(c)); return e; };
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let ui = null, three = null, run = null;

  function buildUI() {
    const back = el('div', {class:'simback', hidden:''});
    const box = el('div', {class:'simbox', role:'dialog', 'aria-modal':'true'});
    const head = el('div', {class:'simhead'}, el('h2'), el('button', {class:'btn small simx', type:'button'}));
    const stage = el('div', {class:'simstage'});
    const cv = el('canvas', {class:'simcv'});
    const hud = [0, 1].map(i => {
      const nm = el('b'), st = el('span', {class:'simst'}), hp = el('i'), num = el('small');
      const card = el('div', {class:'simcard c' + i}, el('div', {class:'simnm'}, nm, st), el('div', {class:'simbar'}, hp), num);
      return {card, nm, st, hp, num};
    });
    const banner = el('div', {class:'simbanner'});
    const load = el('div', {class:'simload'});
    stage.append(cv, hud[0].card, hud[1].card, banner, load);
    const ctr = el('div', {class:'simctr'});
    const bStart = el('button', {class:'btn', type:'button'}), bStep = el('button', {class:'btn', type:'button'}), bRe = el('button', {class:'btn', type:'button'});
    const spd = el('select', {class:'simspd'}, ...[['0.5', '0.5×'], ['1', '1×'], ['2', '2×'], ['4', '4×']].map(([v, l]) => { const o = el('option', {value:v, text:l}); return o; }));
    spd.value = '1';
    const lblSpd = el('label', {class:'simlbl'}), turn = el('span', {class:'simturn'});
    lblSpd.append(el('span'), spd);
    ctr.append(bStart, bStep, bRe, lblSpd, turn);
    const log = el('div', {class:'simlog', 'aria-live':'polite'});
    const hint = el('p', {class:'simhint'});
    box.append(head, stage, ctr, log, hint); back.append(box); document.body.append(back);
    ui = {back, box, head, title:head.firstChild, bClose:head.lastChild, stage, cv, hud, banner, load, bStart, bStep, bRe, spd, lblSpd, turn, log, hint};
    ui.bClose.onclick = close;
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !ui.back.hidden) close(); });
  }

  /* ---------- Escena 3D ---------- */
  function radialTex(rgb, a) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function initThree() {
    const renderer = new THREE.WebGLRenderer({canvas:ui.cv, antialias:true});
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x121827); scene.fog = new THREE.Fog(0x121827, 15, 34);
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a3048, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(4, 9, 7); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7aa2ff, 0.5); rim.position.set(-6, 4, -6); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(11, 72), new THREE.MeshStandardMaterial({color:0x141a30, roughness:1, metalness:0}));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(10.4, 10.7, 72), new THREE.MeshBasicMaterial({color:0x3b4a7d})); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 7), new THREE.MeshBasicMaterial({color:0x2f3b66, transparent:true, opacity:.55})); line.rotation.x = -Math.PI / 2; line.position.y = 0.012; scene.add(line);
    const draco = new THREE.DRACOLoader();
    draco.setDecoderPath(location.protocol === 'file:' ? 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/' : 'js/vendor/draco/');
    const gltf = new THREE.GLTFLoader(); gltf.setDRACOLoader(draco); gltf.setCrossOrigin('anonymous');
    const texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin('anonymous');
    three = {renderer, scene, camera, ground, gltf, draco, texLoader, slots:[], fx:[], tweens:[], clock:new THREE.Clock(), raf:0, tex:{pad:radialTex('120,150,255', .55), shadow:radialTex('0,0,0', .55)}};
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
      g.position.set(i ? 3.6 : -3.6, 0, i ? -0.6 : 0.6); g.rotation.y = i ? -Math.PI / 2 + 0.5 : Math.PI / 2 - 0.5;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({map:three.tex.pad, transparent:true, depthWrite:false})); pad.rotation.x = -Math.PI / 2; pad.position.set(g.position.x, 0.02, g.position.z); scene.add(pad);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({map:three.tex.shadow, transparent:true, depthWrite:false})); sh.rotation.x = -Math.PI / 2; sh.position.set(g.position.x, 0.03, g.position.z); scene.add(sh);
      scene.add(g); three.slots.push({g, body, pad, sh, home:g.position.clone(), model:null, mixer:null, acts:null, hit:0, off:new THREE.Vector3(), scl:1, rotZ:0, alpha:1, hop:0, phase:Math.random() * 6});
    }
    resize();
  }
  function resize() {
    if (!three) return;
    const w = ui.stage.clientWidth || 800, h = ui.stage.clientHeight || 450;
    three.renderer.setSize(w, h, false); three.camera.aspect = w / h;
    const fov = THREE.MathUtils.degToRad(three.camera.fov), halfW = 6.6;
    const dist = Math.max(12, halfW / (Math.tan(fov / 2) * three.camera.aspect));
    three.camera.position.set(0, 3.4 + dist * 0.14, dist); three.camera.lookAt(0, 1.2, 0); three.camera.updateProjectionMatrix();
  }
  function disposeObj(o) {
    o.traverse(n => { n.geometry?.dispose(); for (const m of [].concat(n.material || [])) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); } });
  }
  function disposeThree() {
    if (!three) return;
    cancelAnimationFrame(three.raf);
    three.scene.traverse(n => { n.geometry?.dispose(); for (const m of [].concat(n.material || [])) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose && m.dispose(); } });
    Object.values(three.tex).forEach(t => t.dispose()); three.draco.dispose(); three.renderer.dispose(); three.renderer.forceContextLoss?.();
    three = null;
  }

  async function loadModel(side) {
    const url = PokeModel.modelUrl(side.num);
    if (url) {
      try {
        const g = await new Promise((res, rej) => three.gltf.load(url, res, undefined, rej));
        const m = PokeModel.prep(g, side.num); m.kind = 'glb'; return m;
      } catch (e) { /* sin modelo */ }
    }
    if (side.sprite) {
      try {
        const tx = await new Promise((res, rej) => three.texLoader.load(side.sprite, res, undefined, rej)); tx.encoding = THREE.sRGBEncoding;
        const img = tx.image, ar = img && img.width ? img.width / img.height : 1, h = Math.min(3.2, Math.max(1.6, (img ? img.height : 96) / 48));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(h * ar, h), new THREE.MeshBasicMaterial({map:tx, transparent:true, depthWrite:false, side:THREE.DoubleSide}));
        const grp = new THREE.Group(); grp.add(m); grp.userData.half = h / 2; grp.userData.billboard = true;
        return {obj:grp, kind:'sprite'};
      } catch (e) { /* sin imagen */ }
    }
    const col = new THREE.Color(side.color || '#8899cc');
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.0, 6, 16), new THREE.MeshStandardMaterial({color:col, roughness:.6}));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), new THREE.MeshBasicMaterial({color:0xffffff})); eye.position.set(0.22, 0.65, 0.62);
    const eye2 = eye.clone(); eye2.position.x = -0.22; const grp = new THREE.Group(); grp.add(cap, eye, eye2); grp.userData.half = 1.2;
    return {obj:grp, kind:'capsule'};
  }
  function place(i, m) {
    const s = three.slots[i];
    if (s.model) { s.body.remove(s.model); disposeObj(s.model); }
    s.model = m.obj; s.mixer = m.mixer || null; s.acts = m.acts || null; s.kind = m.kind;
    m.obj.position.y = m.obj.userData.half || 1.2; s.body.add(m.obj); s.baseY = m.obj.position.y;
    if (s.acts && s.acts.idle) s.acts.idle.play();
  }

  /* ---------- Animación ---------- */
  const T = () => run.speed;
  function anim(dur, fn) {
    return new Promise(res => { three.tweens.push({t:0, dur:dur / T(), fn, res}); });
  }
  function frame() {
    if (!three) return;
    three.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, three.clock.getDelta()), time = three.clock.elapsedTime, sp = run ? run.speed : 1;
    for (const tw of three.tweens.slice()) {
      tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
      if (k >= 1) { three.tweens.splice(three.tweens.indexOf(tw), 1); tw.res(); }
    }
    three.slots.forEach((s, i) => {
      if (!s.model) return;
      if (s.mixer) s.mixer.update(dt * sp);
      else if (s.kind === 'glb') { /* rígido: respiración procedural */ }
      const br = 1 + 0.018 * Math.sin(time * 2.2 + s.phase);
      s.body.position.set(s.off.x, s.off.y + s.hop, s.off.z);
      s.body.scale.set(s.scl, s.scl * br, s.scl); s.body.rotation.z = s.rotZ;
      if (s.model.userData.billboard) s.model.rotation.y = -s.g.rotation.y;
      s.sh.material.opacity = s.alpha * 0.9; s.sh.scale.setScalar(Math.max(.2, s.scl) * (1 - Math.min(.4, s.hop * .12)));
    });
    for (const f of three.fx.slice()) {
      f.t += dt * sp; const k = f.t / f.life;
      if (k >= 1) { three.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); three.fx.splice(three.fx.indexOf(f), 1); continue; }
      f.m.position.addScaledVector(f.v, dt * sp); f.v.y -= f.g * dt * sp; f.m.material.opacity = (1 - k) * f.a; f.m.scale.setScalar(f.s0 * (1 + k * (f.grow || 0)));
    }
    three.renderer.render(three.scene, three.camera);
    if (run) {
      three.slots.forEach((s, i) => {
        const v = new THREE.Vector3(); s.g.getWorldPosition(v); v.y += (s.model ? (s.model.userData.half || 1.2) * 2.1 : 2);
        v.project(three.camera); run.anchor[i] = {x:(v.x * .5 + .5) * ui.stage.clientWidth, y:(-v.y * .5 + .5) * ui.stage.clientHeight};
      });
    }
  }
  function burst(pos, color, n = 22, power = 4) {
    const col = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.08, 8, 8), new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false}));
      m.position.copy(pos); const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), sp = power * (0.4 + Math.random() * .8);
      three.scene.add(m); three.fx.push({m, v:new THREE.Vector3(Math.cos(a) * r * sp, Math.abs(u) * sp * .8 + 1, Math.sin(a) * r * sp), life:0.7 + Math.random() * .4, t:0, g:6, a:1, s0:1, grow:-0.5});
    }
    const ringM = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.7, blending:THREE.AdditiveBlending, depthWrite:false}));
    ringM.position.copy(pos); three.scene.add(ringM); three.fx.push({m:ringM, v:new THREE.Vector3(), life:.45, t:0, g:0, a:.7, s0:1, grow:3.5});
  }
  const bodyPos = (i, k = 1) => { const s = three.slots[i], v = new THREE.Vector3(); s.g.getWorldPosition(v); v.y += (s.model ? (s.model.userData.half || 1.2) : 1.2) * k; return v; };
  function flash(i, on) {
    const s = three.slots[i]; if (!s.model) return;
    s.model.traverse(o => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material || [])) {
        if (!m.emissive) continue;
        if (on) { if (!m.userData.e0) m.userData.e0 = {c:m.emissive.clone(), i:m.emissiveIntensity}; m.emissive.set(0xff4444); m.emissiveIntensity = 0.9; }
        else if (m.userData.e0) { m.emissive.copy(m.userData.e0.c); m.emissiveIntensity = m.userData.e0.i; }
      }
    });
  }
  function playClip(i, name) {
    const s = three.slots[i], a = s.acts && s.acts[name]; if (!a || !s.acts.idle) return;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.crossFadeFrom(s.acts.idle, 0.12, false).play();
    setTimeout(() => { if (!three) return; s.acts.idle.reset(); s.acts.idle.crossFadeFrom(a, 0.25, false).play(); }, 1100 / T());
  }
  const fade = (i, a) => { const s = three.slots[i]; s.alpha = a; s.model && s.model.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material || [])) { m.transparent = true; m.opacity = a; } }); };

  /* ---------- UI auxiliar ---------- */
  const tt = () => L[run.api.lang] || L.es;
  const logLine = (txt, cls) => { const p = el('p', {text:txt, class:cls || ''}); ui.log.append(p); ui.log.scrollTop = ui.log.scrollHeight; };
  function showBanner(txt, color, ms) {
    ui.banner.textContent = txt; ui.banner.style.setProperty('--c', color || '#fff'); ui.banner.classList.add('on');
    clearTimeout(run.bt); run.bt = setTimeout(() => ui.banner.classList.remove('on'), ms / T());
  }
  function floatText(i, txt, cls) {
    const a = run.anchor[i] || {x:ui.stage.clientWidth / 2, y:80}, d = el('div', {class:'simfloat ' + (cls || ''), text:txt});
    d.style.left = a.x + 'px'; d.style.top = a.y + 'px'; ui.stage.append(d); setTimeout(() => d.remove(), 1400 / T());
  }
  function paintHud(i) {
    const r = run, h = ui.hud[i], pct = Math.max(0, r.hp[i] / r.max[i] * 100);
    h.hp.style.width = pct + '%'; h.hp.className = pct > 50 ? '' : pct > 20 ? 'mid' : 'low';
    h.num.textContent = `${Math.max(0, Math.round(r.hp[i]))} / ${r.max[i]}`;
    const stNames = {brn:'BRN', psn:'PSN', tox:'TOX', par:'PAR', slp:'SLP', frz:'FRZ'};
    h.st.textContent = r.status[i] ? stNames[r.status[i]] : ''; h.st.className = 'simst ' + (r.status[i] || '');
  }
  function setHp(i, to) {
    const from = run.hp[i]; to = Math.max(0, to);
    return anim(0.55, k => { run.hp[i] = from + (to - from) * ease(k); paintHud(i); }).then(() => { run.hp[i] = to; paintHud(i); });
  }

  /* ---------- Reglas del combate ---------- */
  const pcts = () => run.hp.map((h, i) => Math.max(1, Math.round(h / run.max[i] * 100)));
  function pickMove(i) {
    const api = run.api, side = api.sides[i]; let best = null, bestScore = 0;
    side.moves.forEach((m, j) => {
      const o = api.calc(i, j, pcts(), false); if (!o) return;
      const avg = o.rolls.reduce((a, b) => a + b, 0) / o.rolls.length, acc = (!m.acc || m.acc === true || m.acc >= 100) ? 1 : m.acc / 100;
      const sc = avg * acc * (0.97 + Math.random() * 0.06);
      if (sc > bestScore) { bestScore = sc; best = {j, o, m}; }
    });
    return best;
  }
  const order = () => {
    const api = run.api, c = [0, 1].map(i => { const pm = pickMove(i); return {i, pm, pri:pm ? pm.o.priority || 0 : 0, spd:api.sides[i].speed}; });
    c.sort((a, b) => b.pri - a.pri || (api.trickRoom ? a.spd - b.spd : b.spd - a.spd) || Math.random() - .5);
    return c;
  };
  async function faint(i) {
    const s = three.slots[i]; run.fainted[i] = true;
    logLine(tt().faint(run.api.sides[i].name), 'faint');
    await anim(0.9, k => { s.rotZ = (i ? -1 : 1) * ease(k) * Math.PI / 2.2; s.off.y = -ease(k) * 0.5; fade(i, 1 - k); s.scl = 1 - k * .15; });
    if (s.model) s.model.visible = false; s.sh.visible = false;
  }
  async function attack(a, pm) {
    const api = run.api, d = 1 - a, sa = three.slots[a], sd = three.slots[d], mv = api.sides[a].moves[pm.j], A = api.sides[a].name, D = api.sides[d].name, col = api.typeColors[pm.o.type] || api.typeColors[mv.type] || '#fff';
    logLine(tt().use(A, mv.label));
    showBanner(mv.label, col, 1100);
    const crit = Math.random() < (api.gen >= 6 ? 1 / 24 : api.gen >= 3 ? 1 / 16 : 1 / 8);
    const out = crit ? (api.calc(a, pm.j, pcts(), true) || pm.o) : pm.o;
    const acc = (!mv.acc || mv.acc === true || mv.acc >= 100) ? 1 : mv.acc / 100;
    const hits = Math.random() < acc;
    const dir = new THREE.Vector3().subVectors(sd.g.position, sa.g.position); const dist = dir.length(); dir.normalize();
    const physical = mv.cat === 'P';
    playClip(a, physical ? 'win' : 'hover');
    if (physical) {
      await anim(0.28, k => { const e = ease(k); sa.off.copy(dir).multiplyScalar((dist - 2.2) * e); sa.off.y = Math.sin(k * Math.PI) * .25; });
    } else {
      await anim(0.3, k => { sa.hop = Math.sin(k * Math.PI) * .6; sa.scl = 1 + .08 * Math.sin(k * Math.PI); });
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false}));
      three.scene.add(p); const from = bodyPos(a, 1.1), to = bodyPos(d, 1.0);
      await anim(0.42, k => { p.position.lerpVectors(from, to, ease(k)); p.position.y += Math.sin(k * Math.PI) * .7; p.scale.setScalar(1 + .3 * Math.sin(k * 14)); });
      three.scene.remove(p); p.geometry.dispose(); p.material.dispose();
    }
    const rolls = out.rolls, dmgMax = rolls[rolls.length - 1];
    if (!hits) {
      logLine(tt().miss(A), 'miss'); floatText(d, 'MISS', 'miss');
      await Promise.all([anim(0.35, k => { sd.off.x = Math.sin(k * Math.PI) * 1.1 * (d ? 1 : -1) * 0 + Math.sin(k * Math.PI) * (d ? .9 : -.9); sd.hop = Math.sin(k * Math.PI) * .5; }), physical ? anim(0.3, k => { sa.off.copy(dir).multiplyScalar((dist - 2.2) * (1 - ease(k))); sa.off.y = 0; }) : anim(0.15, () => {})]);
      sd.off.set(0, 0, 0); sd.hop = 0; sa.off.set(0, 0, 0); sa.hop = 0; sa.scl = 1; return;
    }
    if (dmgMax <= 0) {
      logLine(tt().imm(D), 'imm'); floatText(d, '0', 'miss'); showBanner(tt().imm(D), '#9aa4c4', 1100);
      if (physical) await anim(0.3, k => { sa.off.copy(dir).multiplyScalar((dist - 2.2) * (1 - ease(k))); }); sa.off.set(0, 0, 0); sa.hop = 0; sa.scl = 1; return;
    }
    const dmg = Math.min(run.hp[d], rolls[Math.floor(Math.random() * rolls.length)]);
    burst(bodyPos(d, 1.0), col, 26, out.eff > 1 ? 6 : 4);
    flash(d, true);
    const retreat = physical ? anim(0.34, k => { sa.off.copy(dir).multiplyScalar((dist - 2.2) * (1 - ease(k))); sa.off.y = 0; }) : anim(0.2, () => {});
    const shake = anim(0.4, k => { const a2 = (1 - k) * .35; sd.off.set((Math.random() - .5) * a2, 0, (Math.random() - .5) * a2); sd.hop = Math.sin(k * Math.PI) * .18; });
    const hpP = setHp(d, run.hp[d] - dmg);
    floatText(d, '−' + Math.round(dmg), crit ? 'crit' : out.eff > 1 ? 'se' : out.eff < 1 ? 'nve' : '');
    await Promise.all([retreat, shake, hpP]); flash(d, false); sd.off.set(0, 0, 0); sd.hop = 0; sa.off.set(0, 0, 0); sa.hop = 0; sa.scl = 1;
    const pct = Math.round(dmg / run.max[d] * 1000) / 10;
    logLine(tt().dmg(Math.round(dmg), pct) + ' · ' + D, 'dmg');
    if (crit) logLine(tt().crit, 'crit');
    if (out.eff > 1) logLine(tt().se, 'se'); else if (out.eff < 1) logLine(tt().nve, 'nve');
    if (run.hp[d] <= 0) await faint(d);
  }
  async function canAct(i) {
    const n = run.api.sides[i].name, st = run.status[i];
    if (st === 'slp') { if (run.sleep[i] <= 0) { run.status[i] = ''; paintHud(i); logLine(tt().wake(n)); return true; } run.sleep[i]--; logLine(tt().slp(n)); return false; }
    if (st === 'frz') { if (Math.random() < .2) { run.status[i] = ''; paintHud(i); logLine(tt().thaw(n)); return true; } logLine(tt().frz(n)); return false; }
    if (st === 'par' && Math.random() < .25) { logLine(tt().par(n)); floatText(i, 'PAR', 'miss'); return false; }
    return true;
  }
  async function residual(i) {
    const st = run.status[i], n = run.api.sides[i].name; if (!st || run.fainted[i]) return;
    let d = 0;
    if (st === 'brn') { d = Math.max(1, Math.floor(run.max[i] / (run.api.gen >= 7 ? 16 : 8))); logLine(tt().brn(n)); }
    else if (st === 'psn') { d = Math.max(1, Math.floor(run.max[i] / 8)); logLine(tt().psn(n)); }
    else if (st === 'tox') { run.tox[i]++; d = Math.max(1, Math.floor(run.max[i] * Math.min(15, run.tox[i]) / 16)); logLine(tt().psn(n)); }
    if (!d) return;
    flash(i, true); floatText(i, '−' + d, 'nve'); await setHp(i, run.hp[i] - d); flash(i, false);
    if (run.hp[i] <= 0) await faint(i);
  }
  async function doTurn() {
    run.turn++; ui.turn.textContent = tt().turn(run.turn); logLine('— ' + tt().turn(run.turn) + ' —', 'turn');
    for (const c of order()) {
      if (run.fainted[0] || run.fainted[1]) break;
      if (!(await canAct(c.i))) continue;
      const pm = pickMove(c.i);                 // se vuelve a elegir con los PS actuales
      if (!pm) { logLine(tt().nomove(run.api.sides[c.i].name)); continue; }
      await attack(c.i, pm);
      await sleep(260 / T());
    }
    if (!run.fainted[0] && !run.fainted[1]) { for (const i of [0, 1]) await residual(i); }
    if (run.fainted[0] || run.fainted[1]) {
      const w = run.fainted[0] && run.fainted[1] ? -1 : run.fainted[0] ? 1 : 0; run.over = true;
      if (w < 0) { logLine(tt().draw, 'win'); showBanner(tt().draw, '#f5c542', 99999); }
      else {
        const n = run.api.sides[w].name; logLine(tt().win(n), 'win'); showBanner(tt().win(n), '#f5c542', 99999);
        three.slots[w].acts && playClip(w, 'win'); anim(0.7, k => { three.slots[w].hop = Math.abs(Math.sin(k * Math.PI * 2)) * .5; });
      }
      setAuto(false);
    } else if (run.turn >= 40) { run.over = true; logLine(tt().draw, 'win'); showBanner(tt().draw, '#f5c542', 99999); setAuto(false); }
  }
  function setAuto(v) {
    run.auto = v; ui.bStart.textContent = v ? tt().pause : (run.turn ? tt().resume : tt().start); ui.bStart.classList.toggle('on', v);
    ui.bStart.disabled = ui.bStep.disabled = !!run.over && !v ? true : false; ui.bStart.disabled = run.over; ui.bStep.disabled = run.over || v;
    if (v && !run.busy) loop();
  }
  async function loop() {
    if (run.busy) return; run.busy = true; const my = run.id;
    while (run && run.id === my && run.auto && !run.over) { await doTurn(); if (!run || run.id !== my) return; await sleep(520 / T()); }
    if (run && run.id === my) { run.busy = false; ui.bStep.disabled = run.over || run.auto; }
  }
  async function stepOnce() {
    if (run.busy || run.over) return; run.busy = true; const my = run.id; ui.bStep.disabled = ui.bStart.disabled = true;
    await doTurn(); if (!run || run.id !== my) return; run.busy = false; ui.bStart.disabled = ui.bStep.disabled = run.over; ui.bStart.textContent = run.over ? tt().start : tt().resume;
  }

  /* ---------- API pública ---------- */
  function resetState() {
    const api = run.api;
    run.hp = api.sides.map(s => s.curHP); run.max = api.sides.map(s => s.maxHP); run.status = api.sides.map(s => s.status || ''); run.tox = [0, 0]; run.sleep = [1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)];
    run.fainted = [false, false]; run.turn = 0; run.over = false; run.auto = false; run.busy = false; run.id = (run.id || 0) + 1; run.anchor = run.anchor || [];
    ui.log.replaceChildren(); ui.banner.classList.remove('on'); ui.turn.textContent = '';
    three.tweens.length = 0;
    three.slots.forEach((s, i) => { s.off.set(0, 0, 0); s.scl = 1; s.rotZ = 0; s.hop = 0; fade(i, 1); s.alpha = 1; if (s.model) s.model.visible = true; s.sh.visible = true; flash(i, false); });
    [0, 1].forEach(paintHud);
    ui.bStart.textContent = tt().start; ui.bStart.disabled = false; ui.bStep.disabled = false; ui.bStart.classList.remove('on');
  }
  function texts() {
    const t = tt(); ui.title.textContent = t.title; ui.bClose.textContent = '✕'; ui.bClose.title = t.close; ui.bClose.setAttribute('aria-label', t.close);
    ui.bStep.textContent = t.step; ui.bRe.textContent = t.restart; ui.lblSpd.firstChild.textContent = t.speed + ' '; ui.hint.textContent = t.hint; ui.load.textContent = t.loading;
  }
  async function open(api) {
    if (!ui) buildUI();
    run = {api, speed:1, anchor:[], id:(run ? run.id : 0) + 1};
    ui.back.hidden = false; document.body.classList.add('simopen'); texts();
    api.sides.forEach((s, i) => { ui.hud[i].nm.textContent = s.name; ui.hud[i].card.style.setProperty('--c', (api.typeColors[s.types[0]] || '#8899cc')); });
    ui.load.classList.add('on'); ui.bStart.disabled = ui.bStep.disabled = ui.bRe.disabled = true;
    try { await ensureLibs(); } catch (e) { ui.load.textContent = 'No se pudo cargar three.js'; return; }
    if (ui.back.hidden) return;
    if (three) disposeThree();
    initThree(); resize();
    ui.spd.value = '1';
    const my = run.id;
    const sides = api.sides.map(s => Object.assign({color:api.typeColors[s.types[0]]}, s));
    const mons = await Promise.all(sides.map(loadModel));
    if (!run || run.id !== my || ui.back.hidden || !three) return;
    mons.forEach((m, i) => place(i, m));
    ui.load.classList.remove('on'); ui.bRe.disabled = false;
    resetState(); three.clock.start(); frame();
    ui.bStart.onclick = () => { if (run.over) return; setAuto(!run.auto); };
    ui.bStep.onclick = stepOnce;
    ui.bRe.onclick = () => { if (!three) return; run.id++; resetState(); };
    ui.spd.onchange = () => { run.speed = +ui.spd.value; };
    if (mons.some(m => m.kind !== 'glb')) logLine(tt().fallback, 'hint');
  }
  function close() {
    if (!ui || ui.back.hidden) return;
    if (run) { run.id++; run.over = true; run.auto = false; }
    ui.back.hidden = true; document.body.classList.remove('simopen');
    disposeThree(); ui.log.replaceChildren();
  }
  window.addEventListener('resize', () => { if (ui && !ui.back.hidden) resize(); });
  return {open, close};
})();

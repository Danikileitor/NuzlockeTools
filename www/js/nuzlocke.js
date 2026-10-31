(() => {
'use strict';
const {G: GAMES, P, M: METHODS} = NZ;
const GM = Object.fromEntries(GAMES.map(g => [g.id, g]));
const LS = 'nuzlocke-v1', LANG = 'pm-lang';
const ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX'];

/* ---------- i18n ---------- */
const I18N = {
  es: {back:'← Juegos', pickGame:'Elige el juego de tu partida', gen:'Generación', zones:'zonas', noZones:'Sin datos de zonas',
       rnd:'Randomlocke', rndOn:'Randomlocke activado: puedes elegir cualquier Pokémon que exista en este juego', rndOff:'Randomlocke: elegir cualquier Pokémon del juego, no solo los de la zona',
       reset:'Reiniciar partida', confirmReset:'¿Borrar TODAS las capturas de este juego? No se puede deshacer.',
       caught:'Capturados', dead:'Caídos', failed:'Fallidos', pending:'Pendientes', all:'Todas', search:'Buscar zona…',
       addPh:'Nuevo punto de captura…', add:'Añadir', pokemon:'Pokémon', nick:'Mote', status:'Estado', pokePh:'Buscar Pokémon…',
       sPend:'— Pendiente —', sCaught:'Capturado', sFailed:'Fallido (huyó / sin Poké Balls)', sDead:'Caído (KO)',
       possible:n => `${n} posibles aquí`, anyHere:'Cualquier Pokémon del juego', dup:'⚠ Repetido: ya lo tienes en otra zona', lvl:'Nv',
       noRes:'Sin resultados', more:'…escribe para filtrar', custom:'Personal', dlc:'DLC', del:'Eliminar punto',
       nodata:'Este juego aún no tiene datos de zonas. Añade tus propios puntos de captura (Ruta 1, Bosque…) y elige cualquier Pokémon del juego.',
       none:'No hay zonas con este filtro.',
       partial:'Datos de Paldea incompletos: en las zonas más grandes faltan algunos hábitats (roca, ruinas, nieve…). Si no encuentras un Pokémon en la zona, usa Randomlocke. Los DLC (Kitakami y Arándano) no están incluidos.',
       resetOrder:'Restablecer orden', up:'Subir', down:'Bajar', grip:'Arrastra para reordenar', gripOff:'Quita filtros y búsqueda para reordenar',
       foot:'Zonas y encuentros de PokeAPI · Sprites de PokeAPI/sprites · Los datos pueden no ser exactos al 100%: usa Randomlocke o puntos personales para regalos, legendarios y eventos. Se guarda automáticamente en tu navegador.'},
  en: {back:'← Games', pickGame:'Choose your playthrough game', gen:'Generation', zones:'areas', noZones:'No area data',
       rnd:'Randomlocke', rndOn:'Randomlocke on: you can pick any Pokémon that exists in this game', rndOff:'Randomlocke: pick any Pokémon in the game, not just the area\'s',
       reset:'Reset run', confirmReset:'Delete ALL captures for this game? This cannot be undone.',
       caught:'Caught', dead:'Fainted', failed:'Failed', pending:'Pending', all:'All', search:'Search area…',
       addPh:'New capture point…', add:'Add', pokemon:'Pokémon', nick:'Nickname', status:'Status', pokePh:'Search Pokémon…',
       sPend:'— Pending —', sCaught:'Caught', sFailed:'Failed (fled / out of balls)', sDead:'Fainted (dead)',
       possible:n => `${n} possible here`, anyHere:'Any Pokémon in the game', dup:'⚠ Duplicate: already owned from another area', lvl:'Lv',
       noRes:'No results', more:'…type to filter', custom:'Custom', dlc:'DLC', del:'Remove point',
       nodata:'This game has no area data yet. Add your own capture points (Route 1, Forest…) and pick any Pokémon from the game.',
       none:'No areas match this filter.',
       partial:'Paldea data is incomplete: the biggest areas miss some habitats (rocky, ruins, snow…). If a Pokémon is missing from an area, use Randomlocke. DLC (Kitakami and Blueberry) is not included.',
       resetOrder:'Reset order', up:'Move up', down:'Move down', grip:'Drag to reorder', gripOff:'Clear filters and search to reorder',
       foot:'Areas and encounters from PokeAPI · Sprites from PokeAPI/sprites · Data may not be 100% exact: use Randomlocke or custom points for gifts, legendaries and events. Saved automatically in your browser.'}
};
const MN = {
  es:{walk:'Hierba',surf:'Surf','old-rod':'Caña vieja','good-rod':'Caña buena','super-rod':'Supercaña',gift:'Regalo','gift-egg':'Huevo',static:'Estático','npc-trade':'Intercambio',
      'rock-smash':'Golpe roca',headbutt:'Golpe cabeza','headbutt-low':'Golpe cabeza','headbutt-normal':'Golpe cabeza','headbutt-high':'Golpe cabeza','roaming-grass':'Errante','roaming-water':'Errante',
      'dark-grass':'Hierba oscura','cave-spots':'Cueva','grass-spots':'Hierba','bridge-spots':'Puente','surf-spots':'Surf','super-rod-spots':'Supercaña',horde:'Horda',
      'yellow-flowers':'Flores amarillas','red-flowers':'Flores rojas','purple-flowers':'Flores moradas','rough-terrain':'Terreno','hidden-grotto':'Gruta oculta',
      'berry-trees':'Árbol de bayas','pokeflute':'Poké Flauta','squirt-bottle':'Regadera','wailmer-pail':'Wailmer','seaweed':'Algas','devon-scope':'Devon Scope',
      'feebas-tile-fishing':'Pesca (Feebas)','honey-tree':'Árbol de miel','island-scan':'Escáner','sos':'SOS','overworld':'Mundo abierto','overworld-water':'Mundo (agua)',
      'overworld-flying':'Mundo (aire)','overworld-special':'Mundo','wanderer':'Errante','max-raid':'Incursión Dynamax','dynamax-adventure':'Aventura Dynamax'},
  en:{walk:'Grass','old-rod':'Old Rod','good-rod':'Good Rod','super-rod':'Super Rod',gift:'Gift','gift-egg':'Egg',static:'Static','npc-trade':'Trade','rock-smash':'Rock Smash',
      headbutt:'Headbutt','headbutt-low':'Headbutt','headbutt-normal':'Headbutt','headbutt-high':'Headbutt','roaming-grass':'Roaming','roaming-water':'Roaming'}
};
const pretty = s => s.replace(/-/g,' ').replace(/^./, c => c.toUpperCase());
const HAB = {es:{Beach:'Playa',Ocean:'Mar',River:'Río',Cave:'Cueva',Forest:'Bosque',Grass:'Hierba',Lake:'Lago','Flower Patch':'Flores','Near Town':'Cerca del pueblo',Rocky:'Roca',Ruins:'Ruinas',Snow:'Nieve',Swamp:'Pantano',Desert:'Desierto',Mountain:'Montaña',Static:'Estático',Interact:'Estático',Underground:'Subterráneo',Main:'Estático',Watchtower:'Torre',Gift:'Regalo','Leaking Tower':'Torre'},en:{}};
const mname = i => { const id = METHODS[i]; if (id.startsWith('hab:')) { const h = id.slice(4); return (HAB[lang] || {})[h] || h; } return MN[lang][id] || (lang === 'en' ? pretty(id) : MN.es[id] || pretty(id)); };

let lang = 'es';
try { lang = JSON.parse(localStorage.getItem(LANG)) || 'es'; } catch(e) {}
const t = k => I18N[lang][k];
const pn = pid => P[pid][lang === 'es' ? 0 : 1];
const ln = l => l[lang === 'es' ? 'es' : 'en'];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
const NORM = {};   // pid -> nombres normalizados (es + en), evita recalcular en cada tecla
const normName = p => NORM[p] || (NORM[p] = norm(P[p][0] + ' ' + P[p][1]));
const spriteUrl = pid => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pid}.png`;
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.forEach(k => e.append(k));
  return e;
};
const img = pid => {
  const i = el('img', {src: spriteUrl(pid), alt: '', loading: 'lazy', decoding: 'async'});
  i.onerror = () => i.style.visibility = 'hidden';
  return i;
};
const $ = id => document.getElementById(id);

/* ---------- Estado ---------- */
let db = {};
try { db = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch(e) { db = {}; }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(db)); } catch(e) {} };
const gstate = id => db[id] || (db[id] = {c:{}, custom:[], random:false});
const view = {gid:null, filter:'all', q:''};

/* ---------- Lista de juegos ---------- */
function renderGames() {
  const app = $('app'); app.replaceChildren();
  app.append(el('p', {class:'sub', text:t('pickGame'), style:'font-size:14px;margin:6px 0 0'}));
  for (let gen = 1; gen <= 9; gen++) {
    const list = GAMES.filter(g => g.gen === gen);
    if (!list.length) continue;
    app.append(el('div', {class:'gensec', text:`${t('gen')} ${ROMAN[gen]}`}));
    const grid = el('div', {class:'games'});
    for (const g of list) {
      const st = db[g.id], recs = st ? Object.values(st.c) : [];
      const c = recs.filter(r => r.s === 'caught').length, d = recs.filter(r => r.s === 'dead').length;
      const card = el('button', {class:'game', style:`--c:${g.col}`, type:'button', onclick:() => location.hash = '#' + g.id},
        el('b', {text: lang === 'es' ? g.es : g.en}),
        el('small', {text: g.nodata ? t('noZones') : `${g.loc.length} ${t('zones')}`}),
        el('div', {class:'prog'}, ...(recs.length ? [el('span', {text:`✔ ${c}`, style:'color:var(--ok)'}), el('span', {text:`☠ ${d}`, style:'color:var(--dead)'})] : [])));
      grid.append(card);
    }
    app.append(grid);
  }
}

/* ---------- Combobox ---------- */
function combo(loc, G, rec, onPick) {
  const wrap = el('div', {class:'cb'});
  const input = el('input', {type:'text', placeholder:t('pokePh'), autocomplete:'off'});
  const dd = el('div', {class:'dd'});
  wrap.append(input, dd);
  const game = GM[view.gid];
  let list = [], act = 0;
  input.value = rec.p ? pn(rec.p) : '';
  const options = () => {
    const any = G.random || !loc.e.length;
    const q = norm(input.dataset.q || '');
    let out;
    if (any) out = game.dex.map(p => ({p, s:''}));
    else out = loc.e.map(e => ({p:e[0], s:`${[...new Set(e[1].map(mname))].join('/')} · ${t('lvl')} ${!e[2] ? '?' : e[2] === e[3] ? e[2] : e[2] + '–' + e[3]}`}));
    return q ? out.filter(o => normName(o.p).includes(q)) : out;
  };
  const draw = () => {
    list = options(); act = Math.min(act, Math.max(list.length - 1, 0));
    dd.replaceChildren();
    if (!list.length) { dd.append(el('div', {class:'empty', text:t('noRes')})); return; }
    list.slice(0, 120).forEach((o, i) => {
      const row = el('div', {class: i === act ? 'act' : ''}, el('span', {}, img(o.p), el('span', {text:pn(o.p)})), el('small', {text:o.s}));
      row.addEventListener('mousedown', e => { e.preventDefault(); choose(o.p); });
      dd.append(row);
    });
    if (list.length > 120) dd.append(el('div', {class:'empty', text:t('more')}));
  };
  const open = () => { dd.classList.add('open'); draw(); const a = dd.querySelector('.act'); if (a) a.scrollIntoView({block:'nearest'}); };
  const close = () => dd.classList.remove('open');
  const choose = p => { close(); input.blur(); onPick(p); };
  input.addEventListener('focus', () => { input.dataset.q = ''; input.select(); act = 0; open(); });
  input.addEventListener('input', () => { input.dataset.q = input.value; act = 0; open(); });
  input.addEventListener('blur', () => {
    close();
    if (input.value.trim() === '' && rec.p) onPick('');
    else input.value = rec.p ? pn(rec.p) : '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!dd.classList.contains('open')) open();
      act = Math.max(0, Math.min(list.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); draw();
      const a = dd.querySelector('.act'); if (a) a.scrollIntoView({block:'nearest'});
    } else if (e.key === 'Enter') { e.preventDefault(); if (list[act]) choose(list[act].p); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  return wrap;
}

/* ---------- Tarjeta de zona ---------- */
let dragKey = null;
const clearMarks = () => document.querySelectorAll('.slot[class*=mk-]').forEach(c => c.classList.remove('mk-l', 'mk-r', 'mk-t', 'mk-b'));
function dropSide(card, e) {
  const r = card.getBoundingClientRect(), board = card.parentElement;
  const twoCols = r.width < board.clientWidth * 0.7;
  const before = twoCols ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
  return {before, cls: twoCols ? (before ? 'mk-l' : 'mk-r') : (before ? 'mk-t' : 'mk-b')};
}
function moveLoc(G, k, delta) {
  const keys = allLocs(G).map(l => String(l.k)), i = keys.indexOf(String(k)), j = i + delta;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]]; G.order = keys; save(); renderBoard();
  const c = document.querySelector(`.slot[data-k="${CSS.escape(String(k))}"]`); if (c) c.scrollIntoView({block:'nearest'});
}
document.addEventListener('mouseup', () => document.querySelectorAll('.slot[draggable=true]').forEach(c => { if (dragKey == null) c.draggable = false; }));
const blank = () => ({p:'', n:'', s:''});
function upd(G, k, patch) {
  const r = Object.assign(blank(), G.c[k], patch);
  if (!r.p && !r.n && !r.s) delete G.c[k]; else G.c[k] = r;
  save(); renderSummary();
}
function buildCard(loc, G) {
  const rec = Object.assign(blank(), G.c[loc.k]);
  const st = rec.s ? 'st-' + rec.s : '';
  const card = el('div', {class:`slot ${st}`});
  const redo = () => { const n = buildCard(loc, G); card.replaceWith(n); };
  const sprite = el('div', {class:'sprite'});
  if (rec.p) sprite.append(img(rec.p)); else sprite.append(el('span', {class:'ph', text:'?'}));
  const any = G.random || !loc.e.length;
  const dup = rec.p && Object.entries(G.c).some(([k, r]) => String(k) !== String(loc.k) && r.p === rec.p && r.s !== 'failed');
  const sub = dup ? t('dup') : any ? t('anyHere') : t('possible')(new Set(loc.e.map(e => e[0])).size);
  const title = el('div', {class:'loc', text: loc.custom ? loc.n : ln(loc)});
  if (loc.dlc) title.append(el('span', {class:'tag', text:t('dlc')}));
  if (loc.custom) title.append(el('span', {class:'tag', text:t('custom')}));
  const stSel = el('select');
  [['', 'sPend'], ['caught', 'sCaught'], ['failed', 'sFailed'], ['dead', 'sDead']].forEach(([v, k]) =>
    stSel.append(el('option', {value:v, text:t(k), ...(v === rec.s ? {selected:''} : {})})));
  stSel.onchange = () => { upd(G, loc.k, {s:stSel.value}); redo(); };
  const nick = el('input', {type:'text', placeholder:t('nick'), value:rec.n, maxlength:'20'});
  nick.oninput = () => upd(G, loc.k, {n:nick.value});
  const cb = combo(loc, G, rec, p => { upd(G, loc.k, p ? {p, s: rec.s || 'caught'} : {p:'', s: rec.s === 'caught' ? '' : rec.s}); redo(); });
  card.append(
    el('div', {class:'top'}, sprite, el('div', {class:'info'}, title, el('div', {class: dup ? 'sub warn' : 'sub', text:sub}),
      el('div', {class:'fields'},
        el('div', {class:'full'}, el('label', {text:t('pokemon')}), cb),
        el('div', {}, el('label', {text:t('nick')}), nick),
        el('div', {}, el('label', {text:t('status')}), stSel)))));
  // controles de orden: subir / bajar / arrastrar (+ eliminar si es personal)
  card.dataset.k = loc.k;
  const canOrder = !view.q && view.filter === 'all';
  const ctl = el('div', {class:'ctl'},
    el('button', {type:'button', title:t('up'), text:'▲', ...(canOrder ? {} : {disabled:''}), onclick:() => moveLoc(G, loc.k, -1)}),
    el('button', {type:'button', title:t('down'), text:'▼', ...(canOrder ? {} : {disabled:''}), onclick:() => moveLoc(G, loc.k, 1)}),
    el('span', {class:'grip' + (canOrder ? '' : ' off'), title:t(canOrder ? 'grip' : 'gripOff'), text:'⠿'}));
  if (loc.custom) ctl.append(el('button', {class:'x', type:'button', title:t('del'), text:'✕', onclick:() => {
    G.custom = G.custom.filter(c => c.k !== loc.k); delete G.c[loc.k]; if (G.order) G.order = G.order.filter(k => String(k) !== String(loc.k)); save(); renderBoard(); renderSummary();
  }}));
  card.append(ctl);
  if (canOrder) {
    ctl.querySelector('.grip').addEventListener('mousedown', () => { card.draggable = true; });
    card.addEventListener('dragstart', e => {
      if (!card.draggable) { e.preventDefault(); return; }
      dragKey = String(loc.k); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragKey);
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => { dragKey = null; card.draggable = false; card.classList.remove('dragging'); clearMarks(); });
    card.addEventListener('dragover', e => {
      if (dragKey == null || dragKey === String(loc.k)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      clearMarks(); card.classList.add(dropSide(card, e).cls);
    });
    card.addEventListener('drop', e => {
      if (dragKey == null || dragKey === String(loc.k)) return;
      e.preventDefault();
      const before = dropSide(card, e).before; clearMarks();
      const keys = allLocs(G).map(l => String(l.k)).filter(k => k !== dragKey);
      const i = keys.indexOf(String(loc.k)) + (before ? 0 : 1);
      keys.splice(i, 0, dragKey); dragKey = null;
      G.order = keys; save(); renderBoard();
    });
  }
  // atajos con los Pokémon de la zona
  if (!rec.p && !any) {
    const picks = el('div', {class:'picks'});
    [...new Set(loc.e.map(e => e[0]))].forEach(p => {
      const b = el('button', {class:'pick', type:'button', title:pn(p), onclick:() => { upd(G, loc.k, {p, s: rec.s || 'caught'}); redo(); }}, img(p));
      picks.append(b);
    });
    card.append(picks);
  }
  return card;
}

/* ---------- Vista de juego ---------- */
const allLocs = G => {
  const list = [...GM[view.gid].loc, ...G.custom.map(c => ({k:c.k, n:c.n, e:[], custom:true}))];
  if (!G.order) return list;
  const pos = new Map(G.order.map((k, i) => [String(k), i]));
  return list.map((l, i) => [l, pos.has(String(l.k)) ? pos.get(String(l.k)) : l.k === 'starter' ? -1 : 1e6 + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
};
function renderSummary() {
  const box = $('sum'); if (!box) return;
  const G = gstate(view.gid), locs = allLocs(G);
  const cnt = s => locs.filter(l => (G.c[l.k] || {}).s === s).length;
  const pend = locs.filter(l => !(G.c[l.k] || {}).s).length;
  box.replaceChildren(
    el('span', {class:'chip ok', text:`✔ ${t('caught')}: ${cnt('caught')}`}),
    el('span', {class:'chip dead', text:`☠ ${t('dead')}: ${cnt('dead')}`}),
    el('span', {class:'chip warn', text:`✖ ${t('failed')}: ${cnt('failed')}`}),
    el('span', {class:'chip mut', text:`${t('pending')}: ${pend}`}));
}
function renderBoard() {
  const G = gstate(view.gid), board = $('board'); if (!board) return;
  const q = norm(view.q);
  const locs = allLocs(G).filter(l => {
    const s = (G.c[l.k] || {}).s || '';
    if (view.filter === 'pending' && s) return false;
    if (['caught', 'failed', 'dead'].includes(view.filter) && s !== view.filter) return false;
    return !q || norm(l.custom ? l.n : l.es + l.en).includes(q);
  });
  board.replaceChildren(...(locs.length ? locs.map(l => buildCard(l, G)) : [el('div', {class:'empty-board', text:t('none')})]));
  if (!locs.length) board.style.display = 'block'; else board.style.display = '';
}
function renderGame() {
  const g = GM[view.gid], G = gstate(view.gid), app = $('app');
  app.replaceChildren();
  if (g.nodata) app.append(el('div', {class:'notice', text:t('nodata')}));
  if (g.partial) app.append(el('div', {class:'notice', text:t('partial')}));
  app.append(el('div', {class:'bar', id:'sum'}));
  const filt = el('div', {style:'display:flex;gap:6px;flex-wrap:wrap'});
  [['all','all'], ['pending','pending'], ['caught','caught'], ['failed','failed'], ['dead','dead']].forEach(([v, k]) =>
    filt.append(el('button', {class:'teambtn' + (view.filter === v ? ' on' : ''), type:'button', text:t(k), onclick:() => { view.filter = v; renderGame(); }})));
  const search = el('input', {class:'search', type:'search', placeholder:t('search'), value:view.q});
  let timer; search.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { view.q = search.value; renderBoard(); }, 120); };
  const addIn = el('input', {type:'text', placeholder:t('addPh'), maxlength:'40'});
  const doAdd = () => {
    const n = addIn.value.trim(); if (!n) return;
    G.custom.push({k:'c' + Date.now(), n}); save(); addIn.value = ''; renderBoard(); renderSummary();
  };
  addIn.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  const rst = el('button', {class:'btn', type:'button', text:t('resetOrder'), ...(G.order ? {} : {disabled:''}), onclick:() => { G.order = null; save(); renderGame(); }});
  app.append(el('div', {class:'tools'}, filt, search, rst, el('div', {class:'add'}, addIn, el('button', {class:'btn', type:'button', text:t('add'), onclick:doAdd}))));
  app.append(el('div', {class:'board', id:'board'}));
  renderSummary(); renderBoard();
}

/* ---------- Router y cabecera ---------- */
function paintChrome() {
  document.documentElement.lang = lang; $('lang').value = lang;
  $('back').textContent = t('back'); $('back').href = '#';
  $('reset').textContent = t('reset'); $('foot').textContent = t('foot');
  const inGame = !!view.gid, g = inGame && GM[view.gid];
  $('back').hidden = $('rnd').hidden = $('reset').hidden = $('gname').hidden = !inGame;
  if (inGame) {
    $('gname').textContent = 'Pokémon ' + (lang === 'es' ? g.es : g.en); $('gname').style.setProperty('--c', g.col);
    const on = gstate(view.gid).random;
    $('rnd').classList.toggle('on', on); $('rnd').setAttribute('aria-pressed', on); $('rnd').title = on ? t('rndOn') : t('rndOff');
    $('rnd').textContent = t('rnd');
  }
}
function route() {
  const id = location.hash.slice(1);
  view.gid = GM[id] ? id : null; view.filter = 'all'; view.q = '';
  document.title = view.gid ? `Nuzlocke · ${GM[id].en}` : 'Pokémon Nuzlocke';
  paintChrome();
  view.gid ? renderGame() : renderGames();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('lang').onchange = e => { lang = e.target.value; try { localStorage.setItem(LANG, JSON.stringify(lang)); } catch(_) {} paintChrome(); view.gid ? renderGame() : renderGames(); };
$('rnd').onclick = () => { const G = gstate(view.gid); G.random = !G.random; save(); paintChrome(); renderBoard(); };
$('reset').onclick = () => { if (confirm(t('confirmReset'))) { delete db[view.gid]; save(); paintChrome(); renderGame(); } };
route();
})();

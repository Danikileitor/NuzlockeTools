(() => {
'use strict';
const {gens: GENS, es: ES} = DATA;
let species, moves, items, natures, SP, MV, speciesOpts, allAbilities, learnBits, ALLM;
const STAT_NAMES = ['PS','Ataque','Defensa','At. Esp.','Def. Esp.','Velocidad'];
const statName = i => prefs.gen === 1 && i === 3 ? t('special') : t('stat' + i);
const STAT_KEYS  = ['HP','Atk','Def','SpA','SpD','Spe'];
const TYPE_COLORS = {Normal:'#9fa19f',Fire:'#e8622c',Water:'#3a8de0',Electric:'#e8b90c',Grass:'#4fae3d',Ice:'#4cc7c0',Fighting:'#d0364e',Poison:'#a350cc',Ground:'#b9743a',Flying:'#7d9fe0',Psychic:'#f0577b',Bug:'#90a516',Rock:'#b5a76a',Ghost:'#5a6bb5',Dragon:'#0d6ac0',Dark:'#5a5266',Steel:'#4f8aa2',Fairy:'#ee7ccf',Stellar:'#44bdb0'};
const CAT_ES = {P:'Fís.',S:'Esp.',T:'Est.'}, CAT_EN = {P:'Phys.',S:'Spec.',T:'Stat.'};
const catName = c => (prefs.lang === 'es' ? CAT_ES : CAT_EN)[c];
const TYPE_ES = {Normal:'Normal',Fire:'Fuego',Water:'Agua',Electric:'Eléctrico',Grass:'Planta',Ice:'Hielo',Fighting:'Lucha',Poison:'Veneno',Ground:'Tierra',Flying:'Volador',Psychic:'Psíquico',Bug:'Bicho',Rock:'Roca',Ghost:'Fantasma',Dragon:'Dragón',Dark:'Siniestro',Steel:'Acero',Fairy:'Hada',Stellar:'Astral'};
const trType = t => (prefs.lang === 'es' && TYPE_ES[t]) || t;
const KEY = 'rival-team-gen9-v1';   // formato antiguo (solo Gen 9)
const KEY2 = 'pokemon-teamsheet-v2';   // pestaña Rival
const KEYS = {rival: KEY2, own: 'pokemon-teamsheet-own-v1'};   // una lista independiente por pestaña
const PREF = 'rival-team-gen9-prefs';
let prefs = {lang:'es', random:false, gen:9, view:'rival', side:'rival'};
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch(e) {}
if (!['rival','own','cmp'].includes(prefs.view)) prefs.view = 'rival';
if (!KEYS[prefs.side]) prefs.side = 'rival';
if (prefs.view !== 'cmp') prefs.side = prefs.view;   // 'cmp' no tiene datos propios: conserva la última lista editada
prefs.random = PMRandom.get();   // Randomlocke compartido entre páginas
const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch(e) {} };
// k: 'a' habilidad, 'm' movimiento, 'i' objeto
const NAT_ES = {Adamant:'Firme',Bashful:'Tímida',Bold:'Osada',Brave:'Audaz',Calm:'Serena',Careful:'Cauta',Docile:'Dócil',Gentle:'Amable',Hardy:'Fuerte',Hasty:'Activa',Impish:'Agitada',Jolly:'Alegre',Lax:'Floja',Lonely:'Huraña',Mild:'Afable',Modest:'Modesta',Naive:'Ingenua',Naughty:'Pícara',Quiet:'Mansa',Quirky:'Rara',Rash:'Alocada',Relaxed:'Plácida',Sassy:'Grosera',Serious:'Seria',Timid:'Miedosa'};
const trNat = n => (prefs.lang === 'es' && NAT_ES[n]) || n;
const tr = (k, n) => {
  if (!n || prefs.lang !== 'es') return n;
  if (ES[k][n]) return ES[k][n];
  if (k === 'm' && n.startsWith('Hidden Power ')) return 'Poder Oculto ' + trType(n.slice(13));
  return n;
};

const I18N = {
  es: {resetAll:'Liberar todo', clear:'Liberar', pokemon:'Pokémon', nick:'Mote', ability:'Habilidad', item:'Objeto', nature:'Naturaleza',
       baseStats:'Stats base', moves:'Movimientos', total:'Total', searchPh:'Buscar Pokémon…', itemPh:'Sin objeto', movePh:'Movimiento',
       none:'No existe en esta gen', pickNat:'— Naturaleza —', pickAb:'— Habilidad —', own:'Del Pokémon', allAb:'Todas las habilidades',
       neutral:'neutra', wipe:'Borrar todos los equipos', confirmWipe:'¿Borrar TODOS los equipos de TODAS las generaciones de la pestaña «%s»? Esta acción no se puede deshacer.', tabRival:'Rival', tabOwn:'Propio', tabCmp:'Comparar', tabTitle:'Equipo del rival, equipo propio o comparación entre ambos', copy:'Copiar', paste:'Pegar', copied:'¡Copiado!', team:'Equipo', illegal:'Este Pokémon no aprende este movimiento en esta gen', noRes:'Sin resultados', confirmReset:'¿Liberar los 6 Pokémon?', genTitle:'Generación', langTitle:'Idioma',
       rndOn:'Randomlocke: permite elegir cualquier habilidad y cualquier movimiento de cualquier generación', rndOff:'Las habilidades existen a partir de la Gen 3',
       stat0:'PS', stat1:'Ataque', stat2:'Defensa', stat3:'At. Esp.', stat4:'Def. Esp.', stat5:'Velocidad', special:'Especial',
       ab:['Atq','Def','AtE','DfE','Vel'],
       foot:(g,n,m,mega) => `Datos de la Gen ${g} de Pokémon Showdown (${n} Pokémon, ${m} movimientos${mega ? ', incluye megaevoluciones' : ''}) · Sprites de play.pokemonshowdown.com · Se guarda automáticamente en tu navegador, un equipo por generación.`},
  en: {resetAll:'Release all', clear:'Release', pokemon:'Pokémon', nick:'Nickname', ability:'Ability', item:'Item', nature:'Nature',
       baseStats:'Base stats', moves:'Moves', total:'Total', searchPh:'Search Pokémon…', itemPh:'No item', movePh:'Move',
       none:'Not available in this gen', pickNat:'— Nature —', pickAb:'— Ability —', own:"Pokémon's own", allAb:'All abilities',
       neutral:'neutral', wipe:'Delete all teams', confirmWipe:'Delete ALL teams from ALL generations in the «%s» tab? This cannot be undone.', tabRival:'Rival', tabOwn:'Own', tabCmp:'Compare', tabTitle:'Opponent team, your own team or a comparison of both', copy:'Copy', paste:'Paste', copied:'Copied!', team:'Team', illegal:"This Pokémon can't learn this move in this gen", noRes:'No results', confirmReset:'Release all 6 Pokémon?', genTitle:'Generation', langTitle:'Language',
       rndOn:'Randomlocke: allows any ability and any move from any generation', rndOff:'Abilities exist from Gen 3 onwards',
       stat0:'HP', stat1:'Attack', stat2:'Defense', stat3:'Sp. Atk', stat4:'Sp. Def', stat5:'Speed', special:'Special',
       ab:['Atk','Def','SpA','SpD','Spe'],
       foot:(g,n,m,mega) => `Gen ${g} data from Pokémon Showdown (${n} Pokémon, ${m} moves${mega ? ', includes Mega Evolutions' : ''}) · Sprites from play.pokemonshowdown.com · Saved automatically in your browser, one team per generation.`}
};
const t = k => I18N[prefs.lang][k];
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
const el = (tag, attrs={}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k,v);
  }
  kids.forEach(k => e.append(k));
  return e;
};

/* ---------- Estado ---------- */
const blank = () => ({sp:'', ab:'', item:'', nat:'', nick:'', mv:['','','','']});
const clean = arr => Array.from({length:6}, (_, i) => { const x = (arr && arr[i]) || {}; return Object.assign(blank(), x, {mv:[0,1,2,3].map(j => (x.mv||[])[j] || '')}); });
let alls = {rival:{}, own:{}};   // datos de cada pestaña
let all = {};   // (pestaña activa) por generación: {a: equipo activo, t: [equipo1, equipo2, equipo3]} (cada equipo = 6 huecos)
let team = 0;
try {
  alls.rival = JSON.parse(localStorage.getItem(KEYS.rival) || 'null') || {};
  if (!alls.rival[9]) { const old = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(old)) alls.rival[9] = old; }
} catch(e) { alls.rival = {}; }
try { alls.own = JSON.parse(localStorage.getItem(KEYS.own) || 'null') || {}; } catch(e) { alls.own = {}; }
all = alls[prefs.side];
const normOf = (all, g) => {
  let x = all[g];
  if (Array.isArray(x)) x = {a:0, t:[x]};            // formato anterior: un solo equipo
  if (!x || !Array.isArray(x.t)) x = {a:0, t:[]};
  while (x.t.length < 3) x.t.push(null);
  if (!(x.a >= 0 && x.a < 3)) x.a = 0;
  return all[g] = x;
};
const normGen = g => normOf(all, g);
let state = [];
const save = () => { const gd = normGen(prefs.gen); gd.a = team; gd.t[team] = state; try { localStorage.setItem(KEYS[prefs.side], JSON.stringify(all)); } catch(e) {} };

/* ---------- Combobox ---------- */
// Miniatura para las listas de resultados (sprite de dex, con respaldo al sprite gen5)
function thumb(id) {
  const urls = [spriteUrls(id)[1], spriteUrls(id)[2]];
  const img = el('img', {class:'thumb', alt:'', loading:'lazy', decoding:'async', src:urls[0]});
  let n = 0;
  img.onerror = () => { if (++n < urls.length) img.src = urls[n]; else img.style.visibility = 'hidden'; };
  return img;
}

function combobox(input, getOpts, onPick) {
  // getOpts() -> [{v: valor, l: etiqueta, s: texto secundario}]
  const dd = el('div', {class:'dd'});
  input.parentElement.append(dd);
  let list = [], act = -1;
  const render = () => {
    const q = norm(input.value);
    const all = getOpts();
    let r;
    if (!q || input.dataset.fresh === '1') r = all;
    else {
      const starts = [], inc = [];
      for (const o of all) {
        const n = norm(o.l), a = o.alt ? norm(o.alt) : '';
        if (n.startsWith(q) || (a && a.startsWith(q))) starts.push(o); else if (n.includes(q) || (a && a.includes(q))) inc.push(o);
      }
      r = starts.concat(inc);
    }
    list = r.slice(0, 2000); act = list.length && q ? 0 : -1;
    dd.replaceChildren();
    if (!list.length) dd.append(el('div', {class:'empty', text:t('noRes')}));
    list.forEach((o,i) => {
      const label = el('span', {class:'opt'});
      if (o.i) label.append(thumb(o.i));
      label.append(el('span', {text:o.l}));
      const d = el('div', {}, label, o.s ? el('small', {text:o.s}) : '');
      d.addEventListener('mousedown', ev => { ev.preventDefault(); pick(o); });
      if (i === act) d.classList.add('act');
      dd.append(d);
    });
    dd.classList.add('open');
  };
  const close = () => dd.classList.remove('open');
  const pick = o => { close(); onPick(o.v); input.blur(); };
  const mark = () => {
    [...dd.children].forEach((c,i) => c.classList.toggle('act', i === act));
    dd.children[act]?.scrollIntoView({block:'nearest'});
  };
  input.addEventListener('focus', () => { input.dataset.fresh = '1'; input.select(); render(); });
  input.addEventListener('input', () => { input.dataset.fresh = '0'; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!dd.classList.contains('open')) render(); act = Math.min(list.length-1, act+1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act-1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (list[act]) pick(list[act]); else input.blur(); }
    else if (e.key === 'Escape') { input.blur(); }
  });
  input.addEventListener('blur', () => {
    close();
    const t = input.value.trim();
    if (!t) { onPick(''); return; }
    const exact = getOpts().find(o => norm(o.l) === norm(t) || (o.alt && norm(o.alt) === norm(t)));
    if (exact) onPick(exact.v); else onPick(undefined); // undefined = revertir
  });
}

/* ---------- Opciones ---------- */
const sortEs = arr => prefs.lang === 'es' ? arr.slice().sort((a,b) => a.l.localeCompare(b.l, 'es')) : arr;
const itemOpts = () => sortEs(items.map(n => ({v:n, l:tr('i',n), alt:n})));
const hasAb = () => prefs.gen >= 3, hasNat = () => prefs.gen >= 3, hasItem = () => prefs.gen >= 2;
const canLearn = (sp, i) => { const b = learnBits(sp); return !!(b[i >> 3] & (1 << (i & 7))); };
// Movimientos disponibles: los que aprende el Pokémon en la gen elegida (todos si Randomlocke o sin Pokémon)
const moveOptsFor = idx => {
  const sp = SP[state[idx].sp], all = prefs.random || !sp;
  const out = [];
  (prefs.random ? ALLM : moves).forEach((m, i) => {
    if (all || canLearn(sp, i)) out.push({v:m[0], l:tr('m',m[0]), alt:m[0], s:`${trType(m[1])} · ${catName(m[2])}${m[3] ? ' · ' + m[3] : ''}`});
  });
  return sortEs(out);
};

const LOCAL_SPRITES = {'zygarde-mega':'sprites/zygarde-mega.png'};   // sin sprite en Showdown: generado desde el modelo 3D
const spriteUrls = id => LOCAL_SPRITES[id] ? [LOCAL_SPRITES[id], LOCAL_SPRITES[id], LOCAL_SPRITES[id]] : [
  `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`,
  `https://play.pokemonshowdown.com/sprites/dex/${id}.png`,
  `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`
];
const UNION = {};
for (let g = 1; g <= 9; g++) GENS[g].moves.forEach(m => { UNION[m[0]] = m; });   // gens altas sobrescriben a las bajas
function setGen(g) {
  prefs.gen = g;
  ({species, moves, items, natures} = GENS[g]);
  SP = Object.fromEntries(species.map(s => [s.n, s]));
  MV = Object.assign({}, UNION, Object.fromEntries(moves.map(m => [m[0], m])));   // la gen actual manda sobre el resto
  ALLM = Object.values(MV).sort((a, b) => a[0].localeCompare(b[0]));
  speciesOpts = species.map(s => ({v:s.n, l:s.n, s:'#' + s.num, i:s.i}));
  allAbilities = [...new Set(species.flatMap(s => s.a))].sort();
  const gd = normGen(g); team = gd.a; state = clean(gd.t[team]);
  const bitsCache = {}, SPI = Object.fromEntries(species.map((s, i) => [s.n, i]));
  learnBits = sp => bitsCache[sp.n] || (bitsCache[sp.n] = Uint8Array.from(atob(GENS[g].learn[SPI[sp.n]]), c => c.charCodeAt(0)));
}
const statColor = v => v < 50 ? '#e5534b' : v < 80 ? '#e8a23a' : v < 100 ? '#d6cf3a' : v < 130 ? '#5cc15c' : '#35c9c0';
const typeChip = t => { const c = el('span', {class:'type', text:trType(t)}); c.style.background = TYPE_COLORS[t] || '#666'; return c; };

/* ---------- Construcción de huecos ---------- */
const board = document.getElementById('board');
const slots = [];
let clip = null;                 // hueco copiado (en memoria)
const pasteBtns = [];
const updatePaste = () => pasteBtns.forEach(b => { b.disabled = !clip; });
// Adapta un hueco copiado a la generación actual (descarta lo que no exista aquí)
const sanitize = c => {
  const o = clean([c])[0];
  if (!SP[o.sp]) return blank();
  if (!hasAb() || !allAbilities.includes(o.ab)) o.ab = '';
  if (!items.includes(o.item)) o.item = '';
  if (!natures.some(n => n[0] === o.nat)) o.nat = '';
  o.mv = o.mv.map(m => MV[m] ? m : '');
  return o;
};

function buildSlot(idx) {
  const root = el('section', {class:'slot'});
  const bCopy = el('button', {type:'button', 'data-i':'copy', text:t('copy')});
  const bPaste = el('button', {type:'button', 'data-i':'paste', text:t('paste')});
  const bClear = el('button', {type:'button', 'data-i':'clear', text:t('clear')});
  const num = el('div', {class:'num'}, bCopy, bPaste, bClear, el('span', {text:'#' + (idx+1)}));
  bClear.onclick = () => { state[idx] = blank(); save(); refresh(); };
  bCopy.onclick = () => {
    clip = clean([state[idx]])[0]; updatePaste();
    bCopy.removeAttribute('data-i'); bCopy.textContent = t('copied');
    setTimeout(() => { bCopy.dataset.i = 'copy'; bCopy.textContent = t('copy'); }, 900);
  };
  bPaste.onclick = () => { if (!clip) return; state[idx] = sanitize(clip); save(); refresh(); };
  pasteBtns.push(bPaste);

  // sprite
  const sprite = el('div', {class:'sprite'});
  const types = el('div', {class:'types'});

  // campos
  const inSp = el('input', {type:'text', 'data-ph':'searchPh', placeholder:t('searchPh'), autocomplete:'off', spellcheck:'false'});
  const inNick = el('input', {type:'text', 'data-ph':'nick', placeholder:t('nick'), maxlength:'12', autocomplete:'off'});
  const selAb = el('select');
  const inItem = el('input', {type:'text', placeholder:t('itemPh'), autocomplete:'off', spellcheck:'false'});
  const selNat = el('select');
  const SN = {Atk:0,Def:1,SpA:2,SpD:3,Spe:4}, sn = k => t('ab')[SN[k]];
  const fillNat = () => {
    selNat.replaceChildren(el('option', {value:'', text: hasNat() ? t('pickNat') : t('none')}));
    natures.forEach(([n,p,m]) => selNat.append(el('option', {value:n, text: p ? `${trNat(n)} (+${sn(p)} −${sn(m)})` : `${trNat(n)} (${t('neutral')})`})));
  };

  const f = (key, node, cls='') => el('div', {class:cls}, el('label', {'data-i':key, text:t(key)}), node);
  const wrap = n => el('div', {class:'cb'}, n);
  const fields = el('div', {class:'fields'},
    f('pokemon', wrap(inSp), 'full'),
    f('nick', inNick),
    f('ability', selAb),
    f('item', wrap(inItem)),
    f('nature', selNat));
  root.append(num, el('div', {class:'top'}, el('div', {class:'spcol'}, sprite, types), fields));

  // stats
  const statsBox = el('div', {class:'stats'});
  const rows = STAT_NAMES.map((n,i) => {
    const l = el('span', {class:'l'}), v = el('span', {class:'v', text:'–'}), bi = el('i'), df = el('i', {class:'df'});
    const box = el('div', {class:'stat'}, l, v, el('div', {class:'bar'}, bi, df));
    statsBox.append(box);
    return {box, l, v, bi, df};
  });
  const bst = el('div', {class:'bst'}, el('span', {'data-i':'total', text:t('total')}), el('b', {text:'–'}));
  statsBox.append(bst);

  // movimientos
  const mvBox = el('div', {class:'moves'});
  const mvEls = [0,1,2,3].map(i => {
    const input = el('input', {type:'text', placeholder:`${t('movePh')} ${i+1}`, autocomplete:'off', spellcheck:'false'});
    const dot = el('span', {class:'dot'}), meta = el('span', {class:'mm'});
    const box = el('div', {class:'mv cb'}, input, dot, meta);
    mvBox.append(box);
    return {input, dot, meta};
  });
  root.append(el('div', {class:'bottom'}, el('div', {}, el('label', {'data-i':'baseStats', text:t('baseStats')}), statsBox), el('div', {}, el('label', {'data-i':'moves', text:t('moves')}), mvBox)));

  /* --- render --- */
  const render = () => {
    const s = state[idx], sp = SP[s.sp];
    // sprite
    sprite.replaceChildren();
    if (sp) {
      const urls = spriteUrls(sp.i); let k = 0;
      const img = el('img', {alt:sp.n, src:urls[0]});
      img.onerror = () => { k++; if (k < urls.length) img.src = urls[k]; else { img.remove(); sprite.append(el('span', {class:'ph', text:'?'})); } };
      sprite.append(img);
    } else sprite.append(el('span', {class:'ph', text:'?'}));
    types.replaceChildren(...(sp ? sp.t.map(typeChip) : []));
    // campos
    inSp.value = s.sp; inNick.value = s.nick; inItem.value = tr('i', s.item); fillNat(); selNat.value = s.nat;
    inItem.disabled = !hasItem(); inItem.placeholder = hasItem() ? t('itemPh') : t('none');
    selNat.disabled = !hasNat();
    selAb.replaceChildren();
    if (!hasAb()) { selAb.append(el('option', {value:'', text:t('none')})); selAb.disabled = true; s.ab = ''; }
    else if (!sp) { selAb.append(el('option', {value:'', text:'—'})); selAb.disabled = true; }
    else {
      selAb.disabled = false;
      const own = sp.a.slice();
      const byName = (a,b) => tr('a',a).localeCompare(tr('a',b), prefs.lang);
      if (own.length > 1 || prefs.random) selAb.append(el('option', {value:'', text:t('pickAb')}));
      if (prefs.random) {
        const g1 = el('optgroup', {label:t('own')}), g2 = el('optgroup', {label:t('allAb')});
        own.forEach(a => g1.append(el('option', {value:a, text:tr('a',a)})));
        allAbilities.filter(a => !own.includes(a)).sort(byName).forEach(a => g2.append(el('option', {value:a, text:tr('a',a)})));
        selAb.append(g1, g2);
      } else own.forEach(a => selAb.append(el('option', {value:a, text:tr('a',a)})));
      const valid = prefs.random ? allAbilities.includes(s.ab) : own.includes(s.ab);
      selAb.value = valid ? s.ab : (!prefs.random && own.length === 1 ? own[0] : '');
      s.ab = selAb.value;
    }
    // stats
    const nat = hasNat() ? natures.find(n => n[0] === s.nat) : null;
    rows.forEach((r,i) => {
      r.box.style.display = prefs.gen === 1 && i === 4 ? 'none' : '';
      const val = sp ? sp.s[i] : null;
      const tag = nat && nat[1] && i > 0 ? (STAT_KEYS[i] === nat[1] ? '<span class="up"> ▲</span>' : STAT_KEYS[i] === nat[2] ? '<span class="dn"> ▼</span>' : '') : '';
      r.l.innerHTML = statName(i) + tag;
      const dir = nat && nat[1] && i > 0 ? (STAT_KEYS[i] === nat[1] ? 1 : STAT_KEYS[i] === nat[2] ? -1 : 0) : 0;
      const mod = val ? (dir > 0 ? Math.floor(val * 1.1) : dir < 0 ? Math.floor(val * 0.9) : val) : null;
      const pct = x => Math.min(100, x / 180 * 100);
      r.v.textContent = mod ?? '–';
      r.v.className = 'v' + (dir > 0 ? ' up' : dir < 0 ? ' dn' : '');
      // barra: parte común + diferencia superpuesta (roja si sube, azul si baja)
      const lo = val ? Math.min(val, mod) : 0;
      r.bi.style.width = val ? pct(lo) + '%' : '0';
      r.bi.style.background = val ? statColor(val) : 'transparent';
      r.df.className = 'df' + (dir > 0 ? ' up' : dir < 0 ? ' dn' : '');
      r.df.style.left = pct(lo) + '%';
      r.df.style.width = dir ? (pct(Math.max(val, mod)) - pct(lo)) + '%' : '0';
    });
    bst.lastChild.textContent = sp ? sp.s.reduce((a,b,i) => a + (prefs.gen === 1 && i === 4 ? 0 : b), 0) : '–';
    // movimientos
    mvEls.forEach((m,i) => {
      const mv = MV[s.mv[i]];
      m.input.value = tr('m', s.mv[i]);
      m.dot.style.background = mv ? (TYPE_COLORS[mv[1]] || '#666') : 'var(--line)';
      m.meta.textContent = mv ? `${catName(mv[2])}${mv[3] ? ' ' + mv[3] : ''}` : '';
      m.input.classList.toggle('has-meta', !!mv);
      const bad = !!(mv && sp && !prefs.random && !canLearn(sp, moves.indexOf(mv)));
      m.input.classList.toggle('illegal', bad);
      m.input.title = bad ? t('illegal') : '';
    });
  };

  /* --- eventos --- */
  const commit = () => { save(); render(); };
  combobox(inSp, () => speciesOpts, v => {
    if (v === undefined) return render();
    const s = state[idx];
    if (v !== s.sp) {
      s.sp = v; s.ab = '';
      const sp = SP[v];
      if (sp && sp.m && sp.ri && !s.item) s.item = sp.ri; // sugerir megapiedra
    }
    commit();
  });
  combobox(inItem, itemOpts, v => { if (v !== undefined) state[idx].item = v; commit(); });
  inNick.addEventListener('input', () => { state[idx].nick = inNick.value; save(); });
  selAb.addEventListener('change', () => { state[idx].ab = selAb.value; save(); });
  selNat.addEventListener('change', () => commit.call(null, state[idx].nat = selNat.value));
  mvEls.forEach((m,i) => combobox(m.input, () => moveOptsFor(idx), v => { if (v !== undefined) state[idx].mv[i] = v; commit(); }));

  board.append(root);
  const r = () => render(); r.mvPh = () => mvEls.forEach((m,i) => { m.input.placeholder = `${t('movePh')} ${i+1}`; });
  return r;
}

setGen(GENS[prefs.gen] ? prefs.gen : 9);
for (let i = 0; i < 6; i++) slots.push(buildSlot(i));
const cmpBox = el('section', {id:'cmp', class:'cmp'});
document.getElementById('board').after(cmpBox);
const refresh = () => {
  slots.forEach(r => r());
  const c = prefs.view === 'cmp';
  document.getElementById('board').hidden = c; cmpBox.hidden = !c;
  if (c) renderCompare();
};

/* ---------- Pestaña Comparar ---------- */
const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const CHART = {   // atacante: [superefectivo, poco eficaz, inmune]
  Normal:[[],['Rock','Steel'],['Ghost']], Fire:[['Grass','Ice','Bug','Steel'],['Fire','Water','Rock','Dragon'],[]],
  Water:[['Fire','Ground','Rock'],['Water','Grass','Dragon'],[]], Electric:[['Water','Flying'],['Electric','Grass','Dragon'],['Ground']],
  Grass:[['Water','Ground','Rock'],['Fire','Grass','Poison','Flying','Bug','Dragon','Steel'],[]], Ice:[['Grass','Ground','Flying','Dragon'],['Fire','Water','Ice','Steel'],[]],
  Fighting:[['Normal','Ice','Rock','Dark','Steel'],['Poison','Flying','Psychic','Bug','Fairy'],['Ghost']], Poison:[['Grass','Fairy'],['Poison','Ground','Rock','Ghost'],['Steel']],
  Ground:[['Fire','Electric','Poison','Rock','Steel'],['Grass','Bug'],['Flying']], Flying:[['Grass','Fighting','Bug'],['Electric','Rock','Steel'],[]],
  Psychic:[['Fighting','Poison'],['Psychic','Steel'],['Dark']], Bug:[['Grass','Psychic','Dark'],['Fire','Fighting','Poison','Flying','Ghost','Steel','Fairy'],[]],
  Rock:[['Fire','Ice','Flying','Bug'],['Fighting','Ground','Steel'],[]], Ghost:[['Psychic','Ghost'],['Dark'],['Normal']],
  Dragon:[['Dragon'],['Steel'],['Fairy']], Dark:[['Psychic','Ghost'],['Fighting','Dark','Fairy'],[]],
  Steel:[['Ice','Rock','Fairy'],['Fire','Water','Electric','Steel'],[]], Fairy:[['Fighting','Dragon','Dark'],['Fire','Poison','Steel'],[]]
};
const tmul = (a, d) => {
  const g = prefs.gen, c = CHART[a]; if (!c) return 1;
  if (g <= 5 && d === 'Steel' && (a === 'Ghost' || a === 'Dark')) return 0.5;     // el Acero resistía Fantasma y Siniestro
  if (g === 1) {
    if (a === 'Ghost' && d === 'Psychic') return 0;
    if ((a === 'Bug' && d === 'Poison') || (a === 'Poison' && d === 'Bug')) return 2;
    if (a === 'Ice' && d === 'Fire') return 1;
  }
  return c[0].includes(d) ? 2 : c[1].includes(d) ? 0.5 : c[2].includes(d) ? 0 : 1;
};
const AB_IMM = {Levitate:'Ground', 'Flash Fire':'Fire', 'Water Absorb':'Water', 'Storm Drain':'Water', 'Dry Skin':'Water', 'Volt Absorb':'Electric', 'Lightning Rod':'Electric', 'Motor Drive':'Electric', 'Sap Sipper':'Grass', 'Earth Eater':'Ground'};
const CMP = {
  es: {mode:'Modo', teamOwn:'Propio', teamRival:'Rival', team:'Equipo', empty:'Rellena al menos un Pokémon en cada equipo (pestañas Propio y Rival) para compararlos.',
       lineup:'Equipos', pick2:'Elige 2 Pokémon de cada equipo pulsando sobre ellos', matrix:'Enfrentamientos', matrixHelp:'Cada casilla: tu mejor ataque contra él (↗) y su mejor ataque contra ti (↘); ⚡ indica quién es más rápido.',
       you:'Tú', foe:'Rival', faster:'más rápido', tie:'empate de velocidad', speed:'Velocidad', speedHelp:'Velocidad base con la naturaleza elegida (sin EVs, IVs ni nivel).',
       types:'Tipos', typesHelp:'Cuántos Pokémon de cada equipo son débiles (▲) o resisten/son inmunes (▼) a cada tipo, y cuántos atacantes tiene cada lado de ese tipo (por movimientos o, si no hay, por tipo propio).',
       type:'Tipo', weakYou:'Débiles tuyos', resYou:'Resisten tuyos', weakFoe:'Débiles rival', resFoe:'Resisten rival', atkYou:'Tus atacantes', atkFoe:'Atacantes rival',
       summary:'Resumen', threats:'Amenazas para tu equipo', opps:'Oportunidades', gaps:'Te falta cobertura', none:'—', bst:'Total de stats base', se:'Ataques superefectivos', fastest:'Duelos en los que eres más rápido',
       vsOf:'de', approx:'Sin movimientos ofensivos asignados se usa el tipo del Pokémon (STAB).', ability:'Se tienen en cuenta las habilidades que dan inmunidad (Levitación, Absorbe Agua…).',
       best2:'Mejores parejas contra la pareja rival', best2Help:'Puntuación orientativa: suma de los 4 duelos (daño por tipos y velocidad) menos penalización por debilidades compartidas.',
       pair:'Pareja', shared:'Debilidades compartidas', cover:'Cobertura', order:'Orden de velocidad', score:'Puntos', noShared:'ninguna', yourPair:'Tu pareja', foePair:'Pareja rival',
       m1:'1v1', m2:'2v2', noMove:'sin movimientos', stab:'tipo propio', openCalc:'Abrir en la calculadora de daño', noEffect:'sin efecto', dmgNote:'El daño es % de los PS del defensor, calculado con el motor de Smogon a nivel 50, 31 IV y 0 EV (en los movimientos asignados); pasa el ratón para ver el detalle. Pulsa una celda para abrirla en la calculadora.'},
  en: {mode:'Mode', teamOwn:'Own', teamRival:'Rival', team:'Team', empty:'Fill in at least one Pokémon on each team (Own and Rival tabs) to compare them.',
       lineup:'Teams', pick2:'Pick 2 Pokémon from each team by clicking them', matrix:'Matchups', matrixHelp:'Each cell: your best attack against it (↗) and its best attack against you (↘); ⚡ marks the faster one.',
       you:'You', foe:'Foe', faster:'faster', tie:'speed tie', speed:'Speed', speedHelp:'Base Speed with the chosen nature (no EVs, IVs or level).',
       types:'Types', typesHelp:'How many Pokémon on each team are weak (▲) or resist/are immune (▼) to each type, and how many attackers each side has of that type (by moves, or by own type if none).',
       type:'Type', weakYou:'Yours weak', resYou:'Yours resist', weakFoe:'Foe weak', resFoe:'Foe resist', atkYou:'Your attackers', atkFoe:'Foe attackers',
       summary:'Summary', threats:'Threats to your team', opps:'Opportunities', gaps:'Missing coverage', none:'—', bst:'Total base stats', se:'Super-effective attacks', fastest:'Matchups where you are faster',
       vsOf:'of', approx:'Without offensive moves set, the Pokémon’s own type (STAB) is used.', ability:'Immunity abilities are taken into account (Levitate, Water Absorb…).',
       best2:'Best pairs against the rival pair', best2Help:'Rough score: sum of the 4 matchups (type damage and speed) minus a penalty for shared weaknesses.',
       pair:'Pair', shared:'Shared weaknesses', cover:'Coverage', order:'Speed order', score:'Score', noShared:'none', yourPair:'Your pair', foePair:'Rival pair',
       m1:'1v1', m2:'2v2', noMove:'no moves', stab:'own type', openCalc:'Open in the damage calculator', noEffect:'no effect', dmgNote:'Damage is % of the defender’s HP, computed with the Smogon engine at level 50, 31 IVs and 0 EVs (for assigned moves); hover for details. Click a cell to open it in the calculator.'}
};
const ct = k => CMP[prefs.lang][k];
const cmpSel = {own:[], rival:[]};          // pareja elegida en 2v2 (índices de hueco)
const cmpTeam = {};                          // equipo mostrado por lado (se guarda en cada lista)
const members = sd => {
  const gd = normOf(alls[sd], prefs.gen), tm = clean(gd.t[gd.a]), out = [];
  tm.forEach((s, i) => {
    const sp = SP[s.sp]; if (!sp) return;
    const nat = natures.find(n => n[0] === s.nat);
    const val = (k) => { const v = sp.s[k]; if (!nat || !nat[1] || k === 0) return v; return STAT_KEYS[k] === nat[1] ? Math.floor(v * 1.1) : STAT_KEYS[k] === nat[2] ? Math.floor(v * 0.9) : v; };
    const dmg = s.mv.map(n => MV[n]).filter(m => m && m[2] !== 'T').map(m => ({n:m[0], t:m[1], m}));
    out.push({i, s, sp, natO:nat, types:sp.t, ab:prefs.gen >= 3 ? s.ab : '', spe:val(5), bst:sp.s.reduce((a, b, k) => a + (prefs.gen === 1 && k === 4 ? 0 : b), 0),
              opts:dmg.length ? dmg : sp.t.map(t => ({n:null, t})), stab:!dmg.length, atk:val(1), spa:val(3)});
  });
  return out;
};
const hitMul = (att, m) => {
  let x = 1; m.types.forEach(d => { x *= tmul(att, d); });
  if (m.ab && AB_IMM[m.ab] === att) x = 0;
  if (m.ab === 'Thick Fat' && (att === 'Fire' || att === 'Ice')) x *= 0.5;
  return x;
};
/* Daño real con el motor de Smogon (nivel 50, 31 IV, 0 EV; en Gen 1-2 15 DV y exp. máxima). Devuelve null si no se puede calcular. */
const monM = m => {
  const g = prefs.gen, old = g <= 2, iv = Array(6).fill(old ? 15 : 31), ev = Array(6).fill(old ? 65535 : 0);
  if (old) iv[0] = CalcEngine.hpDV(iv);
  const stats = CalcEngine.calcStats(g, m.sp.s, {lvl:50, iv, ev, nat:g >= 3 && m.natO ? m.natO : null});
  return {sp:m.sp, stats, lvl:50, stages:[0,0,0,0,0], gender:'', tera:'', nat:g >= 3 ? m.s.nat : '', ab:g >= 3 ? m.s.ab : '', abOn:false, item:g >= 2 ? m.s.item : '', status:'', hpPct:100, dmax:false,
          iv:old ? null : iv, ev:old ? null : ev, reflect:false, lscreen:false, fx:{}, alliesFainted:0, hitsTaken:0, boostedStat:'', evo:!!(typeof EVO_PRE !== 'undefined' && m.sp.num && EVO_PRE[m.sp.num])};
};
const dmgOf = (a, d, o) => {
  if (!o.m || typeof CalcBridge === 'undefined') return null;
  try {
    const r = CalcBridge.calc(prefs.gen, monM(a), monM(d), {n:o.n, type:o.m[1], cat:o.m[2], bp:o.m[3], bpUser:false, hits:'', crit:false, z:false, stellar:true}, {});
    if (!r) return null;
    const mn = r.rolls[0], mx = r.rolls[r.rolls.length - 1], hp = r.hp;
    return {mn, mx, hp, pmin:Math.round(mn * 1000 / hp) / 10, pmax:Math.round(mx * 1000 / hp) / 10, desc:r.full || r.desc || ''};
  } catch (e) { return null; }
};
const hitCache = new Map();   // se vacía en cada renderCompare
const bestHit = (a, d) => {
  const key = a.i + '|' + a.sp.n + '|' + a.s.mv.join() + '>' + d.i + '|' + d.sp.n, hit = hitCache.get(key); if (hit) return hit;
  let b = {mult:-1, dmg:null, score:-1};
  a.opts.forEach(o => {
    const dm = a.stab ? null : dmgOf(a, d, o);
    let x = hitMul(o.t, d); if (dm && dm.mx <= 0) x = 0;
    const sc = dm ? dm.mx : -1;
    if (dm ? (sc > b.score || (sc === b.score && x > b.mult)) : (b.score < 0 && x > b.mult)) b = {mult:x, n:o.n, t:o.t, stab:a.stab, dmg:dm, score:sc};
  });
  hitCache.set(key, b);
  return b;
};
const lg = x => Math.log2(x || 0.125);
const fmtMul = x => x === 0 ? '0' : x === 0.25 ? '¼' : x === 0.5 ? '½' : String(x);
const net = (a, b) => { const me = bestHit(a, b), th = bestHit(b, a); return lg(me.mult) - lg(th.mult) + (a.spe > b.spe ? 0.5 : a.spe < b.spe ? -0.5 : 0); };
const mulCls = x => x === 0 ? 'm0' : x >= 4 ? 'm4' : x >= 2 ? 'm2' : x < 1 ? 'mh' : 'm1';
const bigThumb = id => { const i = thumb(id); i.classList.add('big'); return i; };

function renderCompare() {
  hitCache.clear();
  const g = prefs.gen, box = cmpBox;
  box.replaceChildren();
  // selector de modo 1v1 / 2v2 y de equipo activo de cada lado
  const mode = prefs.cmpMode === '2' ? '2' : '1';
  const bar = el('div', {class:'cmpbar'});
  const seg = el('div', {class:'seg'});
  [['1','m1'], ['2','m2']].forEach(([v, k]) => {
    const b = el('button', {type:'button', class:'segbtn' + (mode === v ? ' on neutral' : ''), text:ct(k)});
    b.onclick = () => { prefs.cmpMode = v; savePrefs(); renderCompare(); };
    seg.append(b);
  });
  bar.append(el('span', {class:'lbl', text:ct('mode')}), seg);
  [['own','teamOwn'], ['rival','teamRival']].forEach(([sd, k]) => {
    const gd = normOf(alls[sd], g), grp = el('div', {class:'teams'});
    [0,1,2].forEach(i => {
      const b = el('button', {type:'button', class:'teambtn' + (gd.a === i ? ' on' : ''), text:String(i + 1)});
      b.onclick = () => {
        if (gd.a === i) return;
        gd.a = i; cmpSel[sd] = [];
        if (sd === prefs.side) { team = i; state = clean(gd.t[i]); }      // mantiene sincronizada la lista que se edita en su pestaña
        try { localStorage.setItem(KEYS[sd], JSON.stringify(alls[sd])); } catch(e) {}
        renderCompare();
      };
      grp.append(b);
    });
    bar.append(el('span', {class:'lbl ' + sd, text:ct(k) + ' · ' + ct('team')}), grp);
  });
  box.append(bar);

  const A = members('own'), B = members('rival');
  if (!A.length || !B.length) { box.append(el('p', {class:'cmpempty', text:ct('empty')})); return; }
  const card = (m, sd) => {
    const c = el('div', {class:'mini ' + sd});
    c.append(bigThumb(m.sp.i), el('b', {text:m.s.nick || m.sp.n}), el('div', {class:'types'}, ...m.sp.t.map(typeChip)), el('small', {text:`${t('stat5')} ${m.spe}`}));
    return c;
  };
  const sect = (title, help) => { const s2 = el('section', {class:'panel'}, el('h2', {text:title})); if (help) s2.append(el('p', {class:'help', text:help})); box.append(s2); return s2; };

  /* ---- Equipos / selección ---- */
  const L = sect(ct('lineup'), mode === '2' ? ct('pick2') : '');
  let selA = A, selB = B;
  if (mode === '2') {
    ['own','rival'].forEach(sd => {
      const list = sd === 'own' ? A : B;
      cmpSel[sd] = cmpSel[sd].filter(i => list.some(m => m.i === i));
      if (cmpSel[sd].length < 2) list.forEach(m => { if (cmpSel[sd].length < 2 && !cmpSel[sd].includes(m.i)) cmpSel[sd].push(m.i); });
      cmpSel[sd] = cmpSel[sd].slice(-2);
    });
    selA = A.filter(m => cmpSel.own.includes(m.i)); selB = B.filter(m => cmpSel.rival.includes(m.i));
  }
  const row = (list, sd) => {
    const r = el('div', {class:'lineup ' + sd});
    list.forEach(m => {
      const c = card(m, sd);
      if (mode === '2') {
        c.classList.add('pickable'); c.classList.toggle('sel', cmpSel[sd].includes(m.i));
        c.onclick = () => { const s3 = cmpSel[sd], k = s3.indexOf(m.i); if (k >= 0) { if (s3.length > 1) s3.splice(k, 1); } else { s3.push(m.i); if (s3.length > 2) s3.shift(); } renderCompare(); };
      }
      r.append(c);
    });
    return r;
  };
  L.append(el('div', {class:'twocol'}, el('div', {}, el('h3', {class:'own', text:ct('teamOwn')}), row(A, 'own')), el('div', {}, el('h3', {class:'rival', text:ct('teamRival')}), row(B, 'rival'))));

  /* ---- Matriz de enfrentamientos ---- */
  const koTxt = dm => { const n1 = Math.ceil(dm.hp / Math.max(1, dm.mn)), n2 = Math.ceil(dm.hp / Math.max(1, dm.mx)); return n1 > 4 ? (n2 > 4 ? '5+HKO' : n2 + '-5+HKO') : n1 === n2 ? n1 + 'HKO' : n2 + '-' + n1 + 'HKO'; };
  const toCalc = (a, b) => {   // abre la calculadora de daño con este enfrentamiento (tú = Pokémon 1, rival = Pokémon 2)
    const g = prefs.gen, old = g <= 2;
    const side = m => ({sp:m.sp.n, lvl:50, nat:g >= 3 ? m.s.nat : '', ab:g >= 3 ? m.s.ab : '', abOn:false, item:g >= 2 ? m.s.item : '', status:'', hpPct:100, gender:'', tera:'', teraOn:false, dmax:false,
      iv:Array(6).fill(old ? 15 : 31), ev:Array(6).fill(old ? 65535 : 0), stages:[0,0,0,0,0], reflect:false, lscreen:false, fx:{}, alliesFainted:0, hitsTaken:0, preset:null, boostedStat:'',
      mv:[0,1,2,3].map(j => ({n:m.s.mv[j] || '', bp:'', hits:'', crit:false, z:false, stellar:true}))});
    try { localStorage.setItem('dmgcalc-v1', JSON.stringify({gen:g, random:prefs.random, weather:'', terrain:'', fx:{}, sides:[side(a), side(b)]})); } catch (e) {}
    location.href = 'damage-calculator.html';
  };
  const cell = (a, b) => {
    const me = bestHit(a, b), th = bestHit(b, a), n = net(a, b);
    const c = el('td', {class:'cell link ' + (n >= 1 ? 'good' : n <= -1 ? 'bad' : 'even'), tabindex:'0', role:'link', title:ct('openCalc')});
    c.onclick = () => toCalc(a, b);
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toCalc(a, b); } };
    const line = (cls, sym, x) => {
      const d = el('div', {class:'ln ' + cls}, el('span', {text:sym}), el('em', {class:'mvn', text:x.n ? tr('m', x.n) : (x.t ? trType(x.t) + ' (STAB)' : '')}), el('b', {class:mulCls(x.mult), text:'×' + fmtMul(x.mult)}));
      const w = el('div', {class:'lnw'}, d);
      if (x.dmg && x.dmg.mx > 0) { const q = el('div', {class:'dm'}, el('span', {text:`${x.dmg.pmin}–${x.dmg.pmax}%`}), el('small', {text:koTxt(x.dmg)})); w.append(q); w.title = x.dmg.desc; }
      else if (x.dmg) w.append(el('div', {class:'dm'}, el('span', {text:ct('noEffect')})));
      else if (!w.title) w.title = x.n ? tr('m', x.n) : ct('stab');
      return w;
    };
    c.append(line('me', '↗', me), line('th', '↘', th));
    const f = a.spe > b.spe ? ct('you') : a.spe < b.spe ? ct('foe') : '=';
    c.append(el('div', {class:'spd ' + (a.spe > b.spe ? 'you' : a.spe < b.spe ? 'foe' : 'tie'), text:'⚡ ' + f, title:a.spe === b.spe ? ct('tie') : f + ' ' + ct('faster')}));
    return c;
  };
  const M = sect(ct('matrix'), ct('matrixHelp') + ' ' + ct('dmgNote') + ' ' + ct('approx') + ' ' + ct('ability'));
  const tbl = el('table', {class:'mx'});
  const head = el('tr', {}, el('th'));
  selB.forEach(b => { const th = el('th', {class:'rival'}); th.append(bigThumb(b.sp.i), el('div', {text:b.s.nick || b.sp.n})); head.append(th); });
  tbl.append(head);
  selA.forEach(a => { const tr_ = el('tr'); const th = el('th', {class:'own'}); th.append(bigThumb(a.sp.i), el('div', {text:a.s.nick || a.sp.n})); tr_.append(th); selB.forEach(b => tr_.append(cell(a, b))); tbl.append(tr_); });
  M.append(el('div', {class:'scroll'}, tbl));

  /* ---- Velocidad ---- */
  const S = sect(ct('speed'), ct('speedHelp'));
  const all12 = [...selA.map(m => ({m, sd:'own'})), ...selB.map(m => ({m, sd:'rival'}))].sort((x, y) => y.m.spe - x.m.spe);
  const mx = Math.max(...all12.map(x => x.m.spe), 1);
  const sl = el('div', {class:'spdlist'});
  all12.forEach(({m, sd}) => {
    const r = el('div', {class:'sprow ' + sd}, bigThumb(m.sp.i), el('span', {class:'nm', text:m.s.nick || m.sp.n}), el('div', {class:'sbar'}, Object.assign(el('i'), {style:`width:${m.spe / mx * 100}%`})), el('b', {text:m.spe}));
    sl.append(r);
  });
  S.append(sl);

  /* ---- Tipos ---- */
  const cnt = (list, ty, dir) => list.filter(m => dir > 0 ? hitMul(ty, m) > 1 : hitMul(ty, m) < 1).length;
  const atk = (list, ty) => list.filter(m => m.opts.some(o => o.t === ty)).length;
  const rows = TYPES.filter(ty => g >= 6 || ty !== 'Fairy').filter(ty => g >= 2 || (ty !== 'Dark' && ty !== 'Steel')).map(ty => ({ty, wy:cnt(selA, ty, 1), ry:cnt(selA, ty, -1), wf:cnt(selB, ty, 1), rf:cnt(selB, ty, -1), ay:atk(selA, ty), af:atk(selB, ty)}));
  const threats = rows.filter(r => r.wy >= (selA.length > 2 ? 2 : 1) && r.af > 0 && r.wy > r.ry), opps = rows.filter(r => r.wf >= (selB.length > 2 ? 2 : 1) && r.ay > 0 && r.wf > r.rf), gaps = rows.filter(r => r.wf >= (selB.length > 2 ? 2 : 1) && r.ay === 0);
  const chips = (list, f) => list.length ? el('div', {class:'chips'}, ...list.map(r => { const c = typeChip(r.ty); c.title = f(r); c.append(' ' + f(r)); return c; })) : el('span', {class:'muted', text:ct('none')});
  const Y = sect(ct('summary'));
  const g3 = el('div', {class:'cards'});
  const pairs = selA.length * selB.length;
  let seY = 0, seF = 0, fast = 0;
  selA.forEach(a => selB.forEach(b => { if (bestHit(a, b).mult >= 2) seY++; if (bestHit(b, a).mult >= 2) seF++; if (a.spe > b.spe) fast++; }));
  const stat = (k, v1, v2) => el('div', {class:'sc'}, el('small', {text:ct(k)}), el('div', {class:'pair'}, el('b', {class:'own', text:v1}), el('span', {text:'vs'}), el('b', {class:'rival', text:v2})));
  g3.append(stat('bst', selA.reduce((a, m) => a + m.bst, 0), selB.reduce((a, m) => a + m.bst, 0)),
            stat('se', `${seY}/${pairs}`, `${seF}/${pairs}`),
            stat('fastest', `${fast}/${pairs}`, `${selA.reduce((n, a) => n + selB.filter(b => b.spe > a.spe).length, 0)}/${pairs}`));
  Y.append(g3,
    el('div', {class:'trio'}, el('div', {}, el('h4', {text:ct('threats')}), chips(threats, r => `▲${r.wy}`)), el('div', {}, el('h4', {text:ct('opps')}), chips(opps, r => `▲${r.wf}`)), el('div', {}, el('h4', {text:ct('gaps')}), chips(gaps, r => `▲${r.wf}`))));

  const T = sect(ct('types'), ct('typesHelp'));
  const tt = el('table', {class:'tt'}, el('tr', {}, ...['type','weakYou','resYou','weakFoe','resFoe','atkYou','atkFoe'].map(k => el('th', {text:ct(k)}))));
  rows.forEach(r => {
    const tr_ = el('tr', {class:threats.includes(r) ? 'danger' : opps.includes(r) ? 'opp' : gaps.includes(r) ? 'gap' : ''});
    tr_.append(el('td', {}, typeChip(r.ty)));
    [r.wy, r.ry, r.wf, r.rf, r.ay, r.af].forEach((v, i) => tr_.append(el('td', {class:v ? (i === 0 || i === 2 ? 'w' : i === 1 || i === 3 ? 'r' : 'a') : 'z', text:v || '·'})));
    tt.append(tr_);
  });
  T.append(el('div', {class:'scroll'}, tt));

  /* ---- 2v2: mejores parejas ---- */
  if (mode === '2' && selA.length === 2 && selB.length === 2) {
    const sharedW = pair => rows.filter(r => pair.every(m => hitMul(r.ty, m) > 1));
    const P = sect(ct('foePair') + ' / ' + ct('yourPair'));
    const info = (pair, other, label, cls) => {
      const sw = sharedW(pair);
      return el('div', {class:'pairinfo ' + cls}, el('h4', {text:label}),
        el('div', {}, el('small', {text:ct('shared') + ': '}), sw.length ? el('span', {class:'chips'}, ...sw.map(r => typeChip(r.ty))) : el('span', {class:'muted', text:ct('noShared')})),
        el('div', {}, el('small', {text:ct('cover') + ': '}), el('span', {class:'chips'}, ...[...new Set(pair.flatMap(m => m.opts.map(o => o.t)))].map(typeChip))));
    };
    P.append(el('div', {class:'twocol'}, info(selA, selB, ct('yourPair'), 'own'), info(selB, selA, ct('foePair'), 'rival')));
    const B2 = sect(ct('best2'), ct('best2Help'));
    const combos = []; for (let x = 0; x < A.length; x++) for (let y = x + 1; y < A.length; y++) combos.push([A[x], A[y]]);
    const scored = combos.map(p => {
      let sc = 0; p.forEach(a => selB.forEach(b => { sc += net(a, b); }));
      const sw = sharedW(p).filter(r => selB.some(b => b.opts.some(o => o.t === r.ty)));
      return {p, sc:sc - sw.length, sw};
    }).sort((x, y) => y.sc - x.sc).slice(0, 5);
    const bl = el('div', {class:'best'});
    scored.forEach((x, k) => {
      const r = el('div', {class:'brow'}, el('b', {class:'rk', text:'#' + (k + 1)}), ...x.p.map(m => el('span', {class:'bm'}, bigThumb(m.sp.i), el('span', {text:m.s.nick || m.sp.n}))), el('span', {class:'sc2', text:`${ct('score')} ${x.sc.toFixed(1)}`}));
      bl.append(r);
    });
    B2.append(bl);
  }
}

const genSel = document.getElementById('gen'), foot = document.getElementById('foot'), teamsBox = document.getElementById('teams');
const teamBtns = [0,1,2].map(i => {
  const b = el('button', {type:'button', class:'teambtn', text:String(i+1)});
  b.onclick = () => { if (i === team) return; save(); team = i; state = clean(normGen(prefs.gen).t[i]); save(); syncPrefs(); refresh(); };
  teamsBox.append(b);
  return b;
});
const sideBox = document.getElementById('side');
const sideBtns = ['rival','own','cmp'].map(v => {
  const b = el('button', {type:'button', class:'segbtn', role:'tab'});
  b.dataset.v = v;
  b.onclick = () => {
    if (prefs.view === v) return;
    save(); prefs.view = v;
    if (v !== 'cmp') { prefs.side = v; all = alls[v]; setGen(prefs.gen); }
    savePrefs(); syncPrefs(); refresh();
  };
  sideBox.append(b);
  return b;
});
for (let g = 1; g <= 9; g++) genSel.append(el('option', {value:g, text:'Gen ' + g}));
const langSel = document.getElementById('lang'), rndBtn = document.getElementById('randomlocke');
const syncPrefs = () => {
  genSel.value = prefs.gen;
  teamBtns.forEach((b,i) => { b.classList.toggle('on', i === team); b.setAttribute('aria-pressed', i === team); b.title = `${t('team')} ${i+1}`; });
  sideBtns.forEach(b => { const on = b.dataset.v === prefs.view; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.textContent = t({rival:'tabRival', own:'tabOwn', cmp:'tabCmp'}[b.dataset.v]); });
  sideBox.title = t('tabTitle'); sideBox.dataset.view = prefs.view; document.body.dataset.view = prefs.view;
  langSel.value = prefs.lang;
  rndBtn.classList.toggle('on', prefs.random);
  rndBtn.setAttribute('aria-pressed', prefs.random);
  rndBtn.title = t('rndOn');
  document.documentElement.lang = prefs.lang;
  const g = prefs.gen;
  foot.textContent = t('foot')(g, species.length, moves.length, g >= 6 && g !== 8);
  genSel.title = t('genTitle'); langSel.title = t('langTitle');
  document.getElementById('resetAll').textContent = t('resetAll');
  document.getElementById('wipe').textContent = t('wipe');
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  document.querySelectorAll('[data-ph]').forEach(e => { e.placeholder = t(e.dataset.ph); });
  slots.forEach(sl => sl.mvPh());
};
genSel.onchange = () => { save(); setGen(+genSel.value); savePrefs(); syncPrefs(); refresh(); };
langSel.onchange = () => { prefs.lang = langSel.value; savePrefs(); syncPrefs(); refresh(); };
rndBtn.onclick = () => { prefs.random = !prefs.random; PMRandom.set(prefs.random); savePrefs(); syncPrefs(); refresh(); };
PMRandom.onChange(v => { prefs.random = v; syncPrefs(); refresh(); });
syncPrefs();
updatePaste();
refresh();

document.getElementById('wipe').onclick = () => {
  if (!confirm(t('confirmWipe').replace('%s', t(prefs.side === 'own' ? 'tabOwn' : 'tabRival')))) return;
  all = alls[prefs.side] = {}; team = 0;
  try { localStorage.removeItem(KEYS[prefs.side]); if (prefs.side === 'rival') localStorage.removeItem(KEY); } catch(e) {}
  state = clean(); save(); syncPrefs(); refresh();
};
document.getElementById('resetAll').onclick = () => {
  if (state.some(s => s.sp || s.nick || s.item || s.nat || s.mv.some(Boolean)) && !confirm(t('confirmReset'))) return;
  state = clean(); save(); refresh();
};
})();

/* Motor de cálculo de daño por generación (sin DOM). Usado por calc.js y probado desde Node. */
const CalcEngine = (() => {
  'use strict';
  const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];

  /* ---------- Tabla de tipos (Gen 6+) y variantes de generaciones anteriores ---------- */
  const CHART = {
    Normal:{Rock:.5,Steel:.5,Ghost:0},
    Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},
    Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},
    Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},
    Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},
    Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},
    Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},
    Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},
    Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},
    Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},
    Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},
    Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},
    Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},
    Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5},
    Dragon:{Dragon:2,Steel:.5,Fairy:0},
    Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},
    Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},
    Fairy:{Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5}
  };
  const typesIn = gen => gen === 1 ? TYPES.slice(0, 15).filter(t => t !== 'Steel' && t !== 'Dark') : gen <= 5 ? TYPES.filter(t => t !== 'Fairy') : TYPES;
  function eff1(gen, atk, def) {
    if (gen <= 5 && (atk === 'Fairy' || def === 'Fairy')) return 1;
    if (gen === 1) {
      if (atk === 'Dark' || atk === 'Steel' || def === 'Dark' || def === 'Steel') return 1;
      if (atk === 'Bug' && def === 'Poison') return 2;
      if (atk === 'Poison' && def === 'Bug') return 2;
      if (atk === 'Ghost' && def === 'Psychic') return 0;
      if (atk === 'Ice' && def === 'Fire') return 1;
    }
    if (gen <= 5 && def === 'Steel' && (atk === 'Ghost' || atk === 'Dark')) return .5;
    const v = (CHART[atk] || {})[def];
    return v === undefined ? 1 : v;
  }
  // multiplicador total contra una lista de tipos
  const typeEff = (gen, atk, defTypes) => defTypes.reduce((m, d) => m * eff1(gen, atk, d), 1);

  /* ---------- Estadísticas ---------- */
  const NATURE_MOD = (nat, i) => !nat ? 1 : (nat[1] === ['', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'][i] ? 1.1 : nat[2] === ['', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'][i] ? 0.9 : 1);
  // st: {lvl, iv:[6], ev:[6], nat:[nombre,+,-]|null}. Gen 1-2: iv = DV (0-15), ev = exp. de stats (0-65535)
  function calcStats(gen, base, st) {
    const L = st.lvl, out = [];
    for (let i = 0; i < 6; i++) {
      let v, b = base[i];
      if (gen <= 2) {
        const dv = gen === 1 && i === 4 ? st.iv[3] : st.iv[i];
        const se = gen === 1 && i === 4 ? st.ev[3] : st.ev[i];
        if (gen === 1 && i === 4) b = base[3];
        const bonus = Math.floor(Math.ceil(Math.sqrt(se)) / 4);
        // el DV de PS sale de los otros 4 (se calcula aparte en la interfaz); aquí se usa el valor dado
        v = Math.floor((((b + dv) * 2 + bonus) * L) / 100) + (i === 0 ? L + 10 : 5);
      } else if (i === 0) {
        v = b === 1 ? 1 : Math.floor(((2 * b + st.iv[0] + Math.floor(st.ev[0] / 4)) * L) / 100) + L + 10;   // Shedinja
      } else {
        v = Math.floor((Math.floor(((2 * b + st.iv[i] + Math.floor(st.ev[i] / 4)) * L) / 100) + 5) * NATURE_MOD(st.nat, i));
      }
      out.push(v);
    }
    return out;
  }
  // DV de PS (Gen 1-2) a partir de los otros DV
  const hpDV = iv => ((iv[1] & 1) << 3) | ((iv[2] & 1) << 2) | ((iv[5] & 1) << 1) | (iv[3] & 1);

  /* ---------- Modificadores ---------- */
  const STAGE_OLD = [25, 28, 33, 40, 50, 66, 100, 150, 200, 250, 300, 350, 400];
  const stageMul = (gen, n) => gen <= 2 ? STAGE_OLD[n + 6] / 100 : n >= 0 ? (2 + n) / 2 : 2 / (2 - n);
  const modify = (v, m) => Math.floor((v * m + 2047) / 4096);           // redondeo estilo juego (mitad hacia abajo)
  const chain = (a, b) => (a * b + 2048) >> 12;
  const M = x => Math.round(x * 4096);

  const TYPE_ITEMS = {
    Charcoal:'Fire','Mystic Water':'Water',Magnet:'Electric','Miracle Seed':'Grass','Never-Melt Ice':'Ice','NeverMeltIce':'Ice','Black Belt':'Fighting','Poison Barb':'Poison','Soft Sand':'Ground','Sharp Beak':'Flying','Twisted Spoon':'Psychic','TwistedSpoon':'Psychic','Silver Powder':'Bug','Hard Stone':'Rock','Spell Tag':'Ghost','Dragon Fang':'Dragon','Black Glasses':'Dark','Metal Coat':'Steel','Silk Scarf':'Normal','Pink Bow':'Normal','Polkadot Bow':'Normal','Fairy Feather':'Fairy',
    'Sea Incense':'Water','Wave Incense':'Water','Odd Incense':'Psychic','Rock Incense':'Rock','Rose Incense':'Grass','Dragon Scale':'Dragon',
    'Flame Plate':'Fire','Splash Plate':'Water','Zap Plate':'Electric','Meadow Plate':'Grass','Icicle Plate':'Ice','Fist Plate':'Fighting','Toxic Plate':'Poison','Earth Plate':'Ground','Sky Plate':'Flying','Mind Plate':'Psychic','Insect Plate':'Bug','Stone Plate':'Rock','Spooky Plate':'Ghost','Draco Plate':'Dragon','Dread Plate':'Dark','Iron Plate':'Steel','Pixie Plate':'Fairy'
  };
  const RESIST_BERRY = {'Occa Berry':'Fire','Passho Berry':'Water','Wacan Berry':'Electric','Rindo Berry':'Grass','Yache Berry':'Ice','Chople Berry':'Fighting','Kebia Berry':'Poison','Shuca Berry':'Ground','Coba Berry':'Flying','Payapa Berry':'Psychic','Tanga Berry':'Bug','Charti Berry':'Rock','Kasib Berry':'Ghost','Haban Berry':'Dragon','Colbur Berry':'Dark','Babiri Berry':'Steel','Roseli Berry':'Fairy'};
  // habilidades que anulan un tipo (y a veces curan); [tipo]
  const IMMUNE_AB = {Levitate:'Ground','Volt Absorb':'Electric','Lightning Rod':'Electric','Motor Drive':'Electric','Water Absorb':'Water','Storm Drain':'Water','Dry Skin':'Water','Flash Fire':'Fire','Sap Sipper':'Grass','Earth Eater':'Ground','Well-Baked Body':'Fire','Wind Rider':null};
  const SPREAD = new Set(['Earthquake', 'Surf', 'Rock Slide', 'Heat Wave', 'Blizzard', 'Discharge', 'Dazzling Gleam', 'Muddy Water', 'Razor Leaf', 'Icy Wind', 'Bulldoze', 'Eruption', 'Water Spout', 'Hyper Voice', 'Boomburst', 'Snarl', 'Sludge Wave', 'Lava Plume', 'Parabolic Charge', 'Petal Blizzard', 'Make It Rain', 'Breaking Swipe', 'Glacial Lance', 'Astral Barrage', 'Origin Pulse', 'Precipice Blades', 'Sparkling Aria', 'Mortal Spin', 'Electroweb', 'Struggle Bug', 'Magnitude', 'Twister', 'Swift', 'Powder Snow', 'Hurricane Wind', 'Misty Explosion', 'Self-Destruct', 'Explosion', 'Core Enforcer', 'Land\'s Wrath', 'Thousand Arrows', 'Diamond Storm', 'Bleakwind Storm', 'Wildbolt Storm', 'Sandsear Storm', 'Springtide Storm', 'Clangorous Soulblaze', 'Burning Jealousy', 'Teatime', 'Corrosive Gas', 'Syrup Bomb', 'Dragon Darts']);
  // Potencia (y tipo) de los movimientos cuyo daño depende de la situación
  const SW = ['Brine'];
  function dynBp(gen, a, d, mv, f, bp, curHP, maxHP) {
    const aMax = a.stats[0], aHP = Math.max(1, Math.round(aMax * (a.hpPct == null ? 100 : a.hpPct) / 100));
    const pos = m => (m.stages || []).reduce((s, v) => s + Math.max(0, v || 0), 0);
    const ds = !!d.status, dpsn = d.status === 'psn' || d.status === 'tox';
    switch (mv.n) {
      case 'Eruption': case 'Water Spout': case 'Dragon Energy': return {bp: Math.max(1, Math.floor(150 * aHP / aMax))};
      case 'Flail': case 'Reversal': { const p = Math.floor(48 * aHP / aMax); return {bp: p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20}; }
      case 'Facade': return gen >= 3 && ['brn', 'par', 'psn', 'tox'].includes(a.status) ? {bp: bp * 2} : null;
      case 'Hex': return ds ? {bp: bp * 2} : null;
      case 'Venoshock': return dpsn ? {bp: bp * 2} : null;
      case 'Acrobatics': return !a.item ? {bp: bp * 2} : null;
      case 'Knock Off': return gen >= 6 && d.item ? {bp: Math.floor(bp * 1.5)} : null;
      case 'Brine': return curHP * 2 <= maxHP ? {bp: bp * 2} : null;
      case 'Hard Press': case 'Wring Out': case 'Crush Grip': return {bp: Math.max(1, Math.floor((mv.n === 'Hard Press' ? 100 : 120) * curHP / maxHP))};
      case 'Weather Ball': {
        const w = f.weather, t = (w === 'Sun' || w === 'Harsh Sun') ? 'Fire' : (w === 'Rain' || w === 'Heavy Rain') ? 'Water' : w === 'Sand' ? 'Rock' : (w === 'Hail' || w === 'Snow') ? 'Ice' : null;
        return t ? {bp: 100, type: t} : null;
      }
      case 'Gyro Ball': return a.spe && d.spe ? {bp: Math.min(150, Math.floor(25 * d.spe / a.spe) + 1)} : null;
      case 'Electro Ball': { if (!a.spe || !d.spe) return null; const r = a.spe / d.spe; return {bp: r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40}; }
      case 'Stored Power': case 'Power Trip': return {bp: 20 + 20 * pos(a)};
      case 'Punishment': return {bp: Math.min(200, 60 + 20 * pos(d))};
      case 'Return': case 'Frustration': return {bp: 102};
    }
    return null;
  }
  const E_stage = (gen, n) => stageMul(gen, Math.max(-6, Math.min(6, n || 0)));
  const MOLD = new Set(['Mold Breaker','Teravolt','Turboblaze']);
  const PUNCH = /Punch|Plasma Fists|Meteor Mash|Sky Uppercut|Comet Punch|Dynamic Punch|Mach Punch/i, BITE = /Bite|Fang|Crunch|Jaw Lock/i, PULSE = /Pulse|Aura Sphere/i;
  const SLICE = new Set(['Slash','Cut','Night Slash','Leaf Blade','Psycho Cut','X-Scissor','Air Slash','Aerial Ace','Sacred Sword','Razor Shell','Cross Poison','Fury Cutter','Solar Blade','Stone Axe','Ceaseless Edge','Kowtow Cleave','Secret Sword','Behemoth Blade','Population Bomb','Tachyon Cutter','Psyblade','Air Cutter','Razor Leaf','Mighty Cleave','Bitter Blade','Aqua Cutter','Smart Strike']);
  const RECOIL = new Set(['Double-Edge','Take Down','Brave Bird','Flare Blitz','Wood Hammer','Head Smash','Submission','Volt Tackle','Wild Charge','Head Charge','Wave Crash','High Jump Kick','Jump Kick','Struggle','Light of Ruin','Steel Beam','Mind Blown','Chloroblast']);
  const FIXED = {'Seismic Toss':'lvl','Night Shade':'lvl','Dragon Rage':40,'Sonic Boom':20,'Super Fang':'half','Nature\'s Madness':'half','Ruination':'half'};
  const MULTI = {'Double Kick':2,'Dual Chop':2,'Bonemerang':2,'Double Hit':2,'Gear Grind':2,'Twineedle':2,'Dual Wingbeat':2,'Double Iron Bash':2,'Triple Kick':3,'Surging Strikes':3,'Triple Axel':3,'Water Shuriken':3,'Population Bomb':10,'Bullet Seed':5,'Rock Blast':5,'Icicle Spear':5,'Pin Missile':5,'Arm Thrust':5,'Fury Attack':5,'Fury Swipes':5,'Spike Cannon':5,'Barrage':5,'Bone Rush':5,'Comet Punch':5,'Double Slap':5,'Tail Slap':5,'Scale Shot':5,'Tachyon Cutter':2};
  const DEF_STAT_ATK = new Set(['Psyshock','Psystrike','Secret Sword']);   // especiales que golpean a la Defensa

  /* ---------- Cálculo ---------- */
  /*
   a / d: {sp:{t:[tipos], s:[6 base]}, lvl, stats:[6 finales], stages:[atk,def,spa,spd,spe], ab, abOn, item, status, hpPct, reflect, lscreen}
   mv: {n, type, cat:'P'|'S'|'T', bp, hits, crit}
   f:  {weather}
   Devuelve {rolls:[...], eff, note:[...], fixed?:bool} o null si no hace daño
  */
  function calc(gen, a, d, mv, f) {
    f = f || {};
    const notes = [];
    const maxHP = d.stats[0], curHP = Math.max(1, Math.round(maxHP * (d.hpPct == null ? 100 : d.hpPct) / 100));
    let bp = mv.bp || 0, type = mv.type, cat = mv.cat;
    const crit = !!mv.crit, hits = Math.max(1, mv.hits || 1);
    const abA = gen >= 3 ? (a.ab || '') : '', abD = gen >= 3 ? (d.ab || '') : '';
    const abDef = MOLD.has(abA) ? '' : abD;                 // Mold Breaker ignora la habilidad rival
    const itA = gen >= 2 ? (a.item || '') : '', itD = gen >= 2 ? (d.item || '') : '';
    const stellar = gen >= 9 && a.tera === 'Stellar';
    if (mv.n === 'Tera Blast' && a.tera) {
      type = a.tera; if (stellar) bp = 100;
      cat = (a.stats[1] * E_stage(gen, a.stages[0])) > (a.stats[3] * E_stage(gen, a.stages[2])) ? 'P' : 'S';
    }
    if (cat === 'T') return null;
    const dTypes = d.tera && d.tera !== 'Stellar' ? [d.tera] : d.sp.t.slice();

    // tipo del movimiento (habilidades que lo cambian)
    let abTypeBoost = 1;
    if (gen >= 6 && type === 'Normal') {
      const ch = {Aerilate:'Flying', Pixilate:'Fairy', Refrigerate:'Ice', Galvanize:'Electric'}[abA];
      if (ch) { type = ch; abTypeBoost = gen >= 7 ? 1.2 : 1.3; }
    }
    if (abA === 'Normalize' && gen >= 4) { type = 'Normal'; abTypeBoost = gen >= 7 ? 1.2 : 1; }

    // daño fijo
    const fx = FIXED[mv.n];
    if (fx !== undefined && !(gen === 1 && mv.n === 'Seismic Toss' && false)) {
      const immune = typeEff(gen, type, dTypes) === 0;
      if (immune) return {rolls:[0], eff:0, notes:['immune'], fixed:true, hits:1};
      const v = fx === 'lvl' ? a.lvl : fx === 'half' ? Math.max(1, Math.floor(curHP / 2)) : fx;
      return {rolls:[v], eff:1, notes:[], fixed:true, hits:1};
    }
    if (!mv.bpFixed) {
      const dy = dynBp(gen, a, d, mv, f, bp, curHP, maxHP);
      if (dy) { if (dy.bp != null) bp = dy.bp; if (dy.type) type = dy.type; }
    }
    if (!bp) return null;

    // efectividad
    let eff = typeEff(gen, type, dTypes);
    if (mv.n === 'Freeze-Dry' && dTypes.includes('Water')) eff = typeEff(gen, type, dTypes.filter(t => t !== 'Water')) * 2;
    if (mv.n === 'Flying Press') eff *= typeEff(gen, 'Flying', dTypes);
    if (f.gravity && gen >= 4 && type === 'Ground') eff = typeEff(gen, type, dTypes.filter(t => t !== 'Flying'));
    if (f.weather === 'Strong Winds' && gen >= 6 && dTypes.includes('Flying') && ['Electric', 'Ice', 'Rock'].includes(type) && eff1(gen, type, 'Flying') > 1) eff /= 2;
    // inmunidades por habilidad / objeto
    if (gen >= 3 && abDef) {
      const it = IMMUNE_AB[abDef];
      if (it && it === type && !(abDef === 'Levitate' && (itD === 'Iron Ball' || f.gravity))) { return {rolls:[0], eff:0, notes:['ab:' + abDef], hits:1}; }
      if (abDef === 'Wonder Guard' && eff <= 1) return {rolls:[0], eff:0, notes:['ab:Wonder Guard'], hits:1};
    }
    if (itD === 'Air Balloon' && type === 'Ground' && !f.gravity) return {rolls:[0], eff:0, notes:['item:Air Balloon'], hits:1};
    if (eff === 0) return {rolls:[0], eff:0, notes:['immune'], hits:1};

    // Solar Beam / Blade sin sol
    if ((mv.n === 'Solar Beam' || mv.n === 'Solar Blade') && gen >= 3 && ['Rain','Sand','Hail','Snow','Heavy Rain'].includes(f.weather)) bp = Math.floor(bp / 2);

    // Teracristalización: los movimientos del teratipo de menos de 60 de poder suben a 60
    if (gen >= 9 && a.tera && !stellar && type === a.tera && bp < 60 && hits === 1 && !mv.noTeraBoost) bp = 60;
    // estadísticas de ataque y defensa
    const phys = cat === 'P';
    let atkI = phys ? 1 : 3, defI = phys ? 2 : 4;
    let atkMon = a, defMon = d;
    if (mv.n === 'Foul Play') atkMon = d;
    if (mv.n === 'Body Press') atkI = 2;
    if (DEF_STAT_ATK.has(mv.n)) defI = 2;
    if (gen === 1) { atkI = phys ? 1 : 3; defI = phys ? 2 : 3; }
    const stI = i => i - 1;                 // índice en stages[atk,def,spa,spd,spe]
    let A = atkMon.stats[atkI], D = defMon.stats[defI];
    let sa = atkMon.stages[stI(atkI)] || 0, sd = defMon.stages[stI(defI)] || 0;
    if (gen === 1 && defI === 3) sd = defMon.stages[2] || 0;             // Especial único
    if (gen === 1) { sa = atkI === 3 ? (atkMon.stages[2] || 0) : sa; }
    if (crit) { if (gen === 1) { sa = 0; sd = 0; } else { sa = Math.max(0, sa); sd = Math.min(0, sd); } }
    if (!(gen >= 3 && abDef === 'Unaware') || true) { /* Unaware: el defensor ignora el estadio del atacante */ }
    if (abDef === 'Unaware' && gen >= 4) sa = 0;
    if (abA === 'Unaware' && gen >= 4) sd = 0;
    if (gen >= 3 && abA === 'Simple') sa *= 2;
    A = Math.floor(A * stageMul(gen, Math.max(-6, Math.min(6, sa))));
    D = Math.floor(D * stageMul(gen, Math.max(-6, Math.min(6, sd))));

    // modificadores de ataque / defensa (4096)
    let atM = 4096, dfM = 4096, bpM = 4096, finM = 4096;
    const isMold = MOLD.has(abA);
    const st = !!a.status && a.status !== '';
    if (gen >= 3) {
      if ((abA === 'Huge Power' || abA === 'Pure Power') && phys) atM = chain(atM, M(2));
      if (abA === 'Hustle' && phys) atM = chain(atM, M(1.5));
      if (abA === 'Guts' && st && phys) atM = chain(atM, M(1.5));
      if (abA === 'Gorilla Tactics' && phys) atM = chain(atM, M(1.5));
      if (abA === 'Solar Power' && f.weather === 'Sun' && !phys) atM = chain(atM, M(1.5));
      if (abA === 'Flower Gift' && f.weather === 'Sun' && phys) atM = chain(atM, M(1.5));
      if (abA === 'Defeatist' && a.hpPct != null && a.hpPct <= 50) atM = chain(atM, M(.5));
      if (abA === 'Slow Start' && a.abOn && phys) atM = chain(atM, M(.5));
      if (a.abOn) {
        if ((abA === 'Overgrow' && type === 'Grass') || (abA === 'Blaze' && type === 'Fire') || (abA === 'Torrent' && type === 'Water') || (abA === 'Swarm' && type === 'Bug')) atM = chain(atM, M(1.5));
        if (abA === 'Flash Fire' && type === 'Fire') atM = chain(atM, M(1.5));
        if (abA === 'Plus' || abA === 'Minus') { if (!phys) atM = chain(atM, M(1.5)); }
        if (abA === 'Sand Force' && f.weather === 'Sand' && ['Rock', 'Ground', 'Steel'].includes(type)) bpM = chain(bpM, M(1.3));
        if (abA === 'Toxic Boost' && phys && /psn|tox/.test(a.status || '')) atM = chain(atM, M(1.5));
        if (abA === 'Flare Boost' && !phys && a.status === 'brn') atM = chain(atM, M(1.5));
        if (abA === 'Analytic') bpM = chain(bpM, M(1.3));
        if (abA === 'Sheer Force') bpM = chain(bpM, M(1.3));
        if (abA === 'Supreme Overlord') bpM = chain(bpM, M(1.1));
      }
      if (abA === 'Rivalry' && a.gender && d.gender) bpM = chain(bpM, M(a.gender === d.gender ? 1.25 : 0.75));
      if (abA === 'Technician' && bp <= 60) bpM = chain(bpM, M(1.5));
      if (abA === 'Iron Fist' && PUNCH.test(mv.n)) bpM = chain(bpM, M(1.2));
      if (abA === 'Strong Jaw' && BITE.test(mv.n)) bpM = chain(bpM, M(1.5));
      if (abA === 'Mega Launcher' && PULSE.test(mv.n)) bpM = chain(bpM, M(1.5));
      if (abA === 'Sharpness' && SLICE.has(mv.n)) bpM = chain(bpM, M(1.5));
      if (abA === 'Reckless' && RECOIL.has(mv.n)) bpM = chain(bpM, M(1.2));
      if (abA === 'Tough Claws' && phys && !PUNCH.test('x') && !['Earthquake','Rock Slide','Surf','Bulldoze','Explosion','Self-Destruct'].includes(mv.n)) bpM = chain(bpM, M(1.3));
      if (abA === 'Steelworker' && type === 'Steel') atM = chain(atM, M(1.5));
      if (abA === 'Transistor' && type === 'Electric') atM = chain(atM, M(gen >= 9 ? 1.3 : 1.5));
      if (abA === "Dragon's Maw" && type === 'Dragon') atM = chain(atM, M(1.5));
      if (abA === 'Water Bubble' && type === 'Water') atM = chain(atM, M(2));
      if (abA === 'Rocky Payload' && type === 'Rock') atM = chain(atM, M(1.5));
      if (abA === 'Punk Rock' && /Sound|Boom|Screech|Hyper Voice|Bug Buzz|Uproar|Snarl|Echoed Voice|Relic Song|Sparkling Aria|Round|Chatter|Overdrive|Disarming Voice|Boomburst|Clanging Scales|Clangorous Soul/i.test(mv.n)) bpM = chain(bpM, M(1.3));
      // defensor
      if (!isMold) {
        if (abD === 'Thick Fat' && (type === 'Fire' || type === 'Ice')) atM = chain(atM, M(.5));
        if (abD === 'Heatproof' && type === 'Fire') atM = chain(atM, M(.5));
        if (abD === 'Water Bubble' && type === 'Fire') atM = chain(atM, M(.5));
        if (abD === 'Dry Skin' && type === 'Fire') bpM = chain(bpM, M(1.25));
        if (abD === 'Fluffy' && type === 'Fire') finM = chain(finM, M(2));
        if (abD === 'Purifying Salt' && type === 'Ghost') atM = chain(atM, M(.5));
        if (abD === 'Marvel Scale' && d.status && phys) dfM = chain(dfM, M(1.5));
        if (abD === 'Fur Coat' && phys) dfM = chain(dfM, M(2));
        if (abD === 'Grass Pelt' && d.abOn && phys) dfM = chain(dfM, M(1.5));
        if (abD === 'Ice Scales' && !phys) finM = chain(finM, M(.5));
        if ((abD === 'Multiscale' || abD === 'Shadow Shield') && (d.hpPct == null || d.hpPct >= 100)) finM = chain(finM, M(.5));
        if ((abD === 'Filter' || abD === 'Solid Rock' || abD === 'Prism Armor') && eff > 1) finM = chain(finM, M(.75));
        if (abD === 'Tinted Lens') { /* es del atacante */ }
        if (abD === 'Fluffy' && phys) finM = chain(finM, M(.5));
      }
      if (abA === 'Tinted Lens' && eff < 1) finM = chain(finM, M(2));
      if (abA === 'Neuroforce' && eff > 1) finM = chain(finM, M(1.25));
      if (abA === 'Sniper' && crit) finM = chain(finM, M(1.5));
    }
    // objetos
    if (gen >= 2) {
      if (itA === 'Choice Band' && phys) atM = chain(atM, M(1.5));
      if (itA === 'Choice Specs' && !phys) atM = chain(atM, M(1.5));
      if (itA === 'Light Ball' && a.sp.n && /^Pikachu/.test(a.sp.n) && (gen >= 4 || true)) atM = chain(atM, M(2));
      if (itA === 'Thick Club' && /^(Cubone|Marowak)/.test(a.sp.n || '') && phys) atM = chain(atM, M(2));
      if ((itA === 'Soul Dew') && /^(Latios|Latias)/.test(a.sp.n || '') && !phys && gen >= 3 && gen <= 6) atM = chain(atM, M(1.5));
      if (itA === 'Deep Sea Tooth' && /^Clamperl/.test(a.sp.n || '') && !phys) atM = chain(atM, M(2));
      if (itA === 'Adamant Orb' && /^Dialga/.test(a.sp.n || '') && (type === 'Steel' || type === 'Dragon')) bpM = chain(bpM, M(1.2));
      if (itA === 'Lustrous Orb' && /^Palkia/.test(a.sp.n || '') && (type === 'Water' || type === 'Dragon')) bpM = chain(bpM, M(1.2));
      if (itA === 'Griseous Orb' && /^Giratina/.test(a.sp.n || '') && (type === 'Ghost' || type === 'Dragon')) bpM = chain(bpM, M(1.2));
      if (itA === 'Muscle Band' && phys) bpM = chain(bpM, M(1.1));
      if (itA === 'Wise Glasses' && !phys) bpM = chain(bpM, M(1.1));
      const ti = TYPE_ITEMS[itA];
      if (ti && ti === type && gen >= 2 && !(itA === 'Dragon Scale' && gen >= 4)) {
        const inc = itA.includes('Incense') && gen === 3 ? 1.05 : 0;
        bpM = chain(bpM, M(inc || (gen <= 3 ? 1.1 : 1.2)));
      }
      const gem = /^(\w+) Gem$/.exec(itA);
      if (gem && gem[1] === type && gen >= 5) bpM = chain(bpM, M(gen === 5 ? 1.5 : 1.3));
      if (itD === 'Assault Vest' && !phys) dfM = chain(dfM, M(1.5));
      if (itD === 'Metal Powder' && /^Ditto/.test(d.sp.n || '') && phys) dfM = chain(dfM, M(gen === 2 ? 1.5 : 2));
      if (itD === 'Soul Dew' && /^(Latios|Latias)/.test(d.sp.n || '') && !phys && gen >= 3 && gen <= 6) dfM = chain(dfM, M(1.5));
      if (itD === 'Deep Sea Scale' && /^Clamperl/.test(d.sp.n || '') && !phys) dfM = chain(dfM, M(2));
      if (itD === 'Eviolite' && d.evo) dfM = chain(dfM, M(1.5));
      if (itA === 'Life Orb' && gen >= 4) finM = chain(finM, M(1.3));
      if (itA === 'Expert Belt' && eff > 1 && gen >= 4) finM = chain(finM, M(1.2));
      if (RESIST_BERRY[itD] === type && (eff > 1 || type === 'Normal') && gen >= 4) finM = chain(finM, M(.5));
      if (itD === 'Chilan Berry' && type === 'Normal' && gen >= 4) finM = chain(finM, M(.5));
    }
    // efectos del equipo atacante / del campo
    if (mv.helpingHand || a.helpingHand) bpM = chain(bpM, M(1.5));
    if (gen >= 7 && a.battery && !phys) bpM = chain(bpM, M(1.3));
    if (gen >= 8 && a.powerSpot) bpM = chain(bpM, M(1.3));
    if (gen >= 8 && a.steelySpirit && type === 'Steel') bpM = chain(bpM, M(1.5));
    if (gen >= 3 && a.charge && type === 'Electric') bpM = chain(bpM, M(2));
    if (gen >= 3 && f.mudSport && type === 'Electric') bpM = chain(bpM, gen >= 5 ? 1352 : M(.5));
    if (gen >= 3 && f.waterSport && type === 'Fire') bpM = chain(bpM, gen >= 5 ? 1352 : M(.5));
    if (gen >= 6 && ((f.fairyAura && type === 'Fairy') || (f.darkAura && type === 'Dark'))) bpM = chain(bpM, f.auraBreak ? M(.75) : 5448);
    if (gen >= 9) {
      if (f.sword && phys && !(abA === 'Sword of Ruin')) dfM = chain(dfM, M(.75));
      if (f.beads && !phys && !(abA === 'Beads of Ruin')) dfM = chain(dfM, M(.75));
      if (f.tablets && phys && !(abD === 'Tablets of Ruin')) atM = chain(atM, M(.75));
      if (f.vessel && !phys && !(abD === 'Vessel of Ruin')) atM = chain(atM, M(.75));
    }
    if (gen >= 5 && d.friendGuard) finM = chain(finM, M(.75));
    const spread = !!f.doubles && gen >= 3 && SPREAD.has(mv.n);
    // terrenos (Gen 6+)
    if (gen >= 6 && f.terrain) {
      const grounded = (m, ab, it, types) => !types.includes('Flying') && ab !== 'Levitate' && it !== 'Air Balloon';
      const gA = grounded(a, abA, itA, a.tera ? [a.tera] : a.sp.t), gD = grounded(d, abD, itD, dTypes);
      const tb = gen >= 8 ? 1.3 : 1.5;
      if (gA && ((f.terrain === 'Electric' && type === 'Electric') || (f.terrain === 'Grassy' && type === 'Grass') || (f.terrain === 'Psychic' && type === 'Psychic'))) bpM = chain(bpM, M(tb));
      if (f.terrain === 'Misty' && type === 'Dragon' && gD) bpM = chain(bpM, M(.5));
      if (f.terrain === 'Grassy' && gD && ['Earthquake', 'Bulldoze', 'Magnitude'].includes(mv.n)) bpM = chain(bpM, M(.5));
    }
    // clima sobre defensa
    if (f.weather === 'Sand' && gen >= 4 && !phys && dTypes.includes('Rock')) dfM = chain(dfM, M(1.5));
    if (f.weather === 'Snow' && gen >= 9 && phys && dTypes.includes('Ice')) dfM = chain(dfM, M(1.5));
    // Pantallas: Gen 1 duplica la defensa
    const screen = (phys && d.reflect) || (!phys && d.lscreen) || (gen >= 7 && d.veil);
    if (gen === 1 && screen) { D = D * 2; }

    if (gen >= 3) { A = modify(A, atM); D = modify(D, dfM); bp = modify(bp, bpM); bp = Math.max(1, bp); }
    else if (gen === 2) {
      const ti = TYPE_ITEMS[itA];
      if (ti && ti === type) bp = bp;    // en Gen 2 el objeto multiplica el daño base (más abajo)
      if (itA === 'Light Ball' && /^Pikachu/.test(a.sp.n || '') && !phys) A *= 2;
      if (itA === 'Thick Club' && /^(Cubone|Marowak)/.test(a.sp.n || '') && phys) A *= 2;
      if (itA === 'Metal Powder' && /^Ditto/.test(d.sp.n || '')) D = Math.floor(D * 1.5);
    }
    // Gen 1/2: si algún valor pasa de 255 se divide entre 4
    if (gen <= 2) {
      if (A > 255 || D > 255) { A = Math.floor(A / 4) % 256; D = Math.floor(D / 4) % 256; }
      if (D < 1) D = 1; if (A < 1) A = 1;
    }
    if (D < 1) D = 1;

    // quemadura en Gen 1 reduce el ataque físico a la mitad
    if (gen === 1 && a.status === 'brn' && phys) A = Math.max(1, Math.floor(A / 2));

    // daño base
    let L = a.lvl;
    if (gen === 1 && crit) L *= 2;
    let base = Math.floor(Math.floor(Math.floor(2 * L / 5 + 2) * bp * A / D) / 50);
    const origStab = a.sp.t.includes(type), teraStab = !!a.tera && a.tera === type && gen >= 9;
    const stab = origStab || teraStab || stellar;
    const weather = f.weather;
    const wMod = (() => {
      if (gen < 2) return 1;
      const sun = weather === 'Sun' || weather === 'Harsh Sun', rain = weather === 'Rain' || weather === 'Heavy Rain';
      if (type === 'Fire') return sun ? 1.5 : rain ? .5 : 1;
      if (type === 'Water') return rain ? 1.5 : sun ? .5 : 1;
      return 1;
    })();
    if (gen >= 6) {
      if (weather === 'Harsh Sun' && type === 'Water') return {rolls:[0], eff, notes:['weather'], hits:1};
      if (weather === 'Heavy Rain' && type === 'Fire') return {rolls:[0], eff, notes:['weather'], hits:1};
    }
    const burn = a.status === 'brn' && phys && !(abA === 'Guts' && gen >= 3) && mv.n !== 'Facade' && gen >= 2;
    const adap = gen >= 4 && abA === 'Adaptability';
    const stabMod = !stab ? 1 : stellar ? (origStab ? (adap ? 2.25 : 2) : 1.2) : (teraStab && origStab) ? (adap ? 2.25 : 2) : adap ? 2 : 1.5;
    const stabMod2 = (!stab && abA === 'Protean' && gen >= 6) ? 1.5 : stabMod;
    const critMod = !crit ? 1 : gen <= 5 ? 2 : 1.5;
    const applyEff = dmg => {
      let m = eff;
      while (m > 1) { dmg *= 2; m /= 2; }
      while (m < 1) { dmg = Math.floor(dmg / 2); m *= 2; }
      return dmg;
    };
    const rolls = [];
    const R = gen <= 2 ? Array.from({length: 39}, (_, i) => 217 + i) : Array.from({length: 16}, (_, i) => 85 + i);
    const itemBoost2 = gen === 2 && TYPE_ITEMS[itA] === type ? 1.1 : 1;

    for (const r of R) {
      let dmg;
      if (gen === 1) {
        dmg = Math.min(997, base) + 2;
        if (stabMod2 > 1) dmg = Math.floor(dmg * 1.5);
        dmg = applyEff(dmg);
        dmg = Math.floor(dmg * r / 255);
        if (dmg < 1 && eff > 0) dmg = 1;
      } else if (gen === 2) {
        dmg = base;
        if (itemBoost2 > 1) dmg = Math.floor(dmg * itemBoost2);
        if (crit) dmg *= 2;
        dmg = Math.min(997, dmg) + 2;
        if (wMod !== 1) dmg = Math.floor(dmg * wMod);
        if (stabMod2 > 1) dmg = Math.floor(dmg * 1.5);
        dmg = applyEff(dmg);
        if (burn) dmg = Math.floor(dmg / 2);
        if (screen && !crit) dmg = Math.floor(dmg / 2);
        dmg = Math.floor(dmg * r / 255);
        if (dmg < 1 && eff > 0) dmg = 1;
      } else if (gen <= 4) {
        dmg = base;
        if (burn) dmg = Math.floor(dmg / 2);
        if (screen && !crit) dmg = f.doubles ? Math.floor(dmg * 2 / 3) : Math.floor(dmg / 2);
        if (spread) dmg = Math.floor(dmg * (gen === 3 ? .5 : .75));
        if (wMod !== 1) dmg = Math.floor(dmg * wMod);
        dmg += 2;
        if (crit) dmg *= 2;
        if (finM !== 4096 && gen === 4) { dmg = modify(dmg, finM); }       // Life Orb, Expert Belt, resistencias
        dmg = Math.floor(dmg * r / 100);
        if (stabMod2 > 1) dmg = Math.floor(dmg * stabMod2);
        dmg = applyEff(dmg);
        if (gen === 3 && finM !== 4096) dmg = modify(dmg, finM);
        if (dmg < 1 && eff > 0) dmg = 1;
      } else {
        dmg = base + 2;
        if (spread) dmg = modify(dmg, 3072);
        if (wMod !== 1) dmg = modify(dmg, M(wMod));
        if (crit) dmg = Math.floor(dmg * critMod);
        dmg = Math.floor(dmg * r / 100);
        if (stabMod2 > 1) dmg = modify(dmg, M(stabMod2));
        dmg = applyEff(dmg);
        if (burn) dmg = Math.floor(dmg / 2);
        let fm = finM;
        if (screen && !crit) fm = chain(fm, f.doubles ? 2732 : 2048);
        if (abTypeBoost !== 1) { /* el aumento de las habilidades *-ate se aplica al poder base */ }
        dmg = modify(dmg, fm);
        if (dmg < 1 && eff > 0) dmg = 1;
      }
      rolls.push(dmg * hits);
    }
    // *-ate: ×1.2 / 1.3 al poder base (ya incluido por separado)
    if (abTypeBoost !== 1) {
      for (let i = 0; i < rolls.length; i++) rolls[i] = Math.floor(rolls[i] * abTypeBoost);
    }
    return {rolls, eff, notes, hits, bp, A, D, stab, crit};
  }

  /* Probabilidad de KO en n golpes iguales con tiradas equiprobables */
  function koChance(rolls, hp, n) {
    if (!rolls.length || rolls[rolls.length - 1] <= 0) return 0;
    if (n === 1) return rolls.filter(x => x >= hp).length / rolls.length;
    let dist = new Map([[0, 1]]);
    for (let i = 0; i < n; i++) {
      const nx = new Map();
      for (const [s, c] of dist) for (const r of rolls) { const k = Math.min(hp, s + r); nx.set(k, (nx.get(k) || 0) + c); }
      dist = nx;
    }
    return (dist.get(hp) || 0) / Math.pow(rolls.length, n);
  }
  /* Mínimo de golpes con probabilidad >0 y garantizados. Devuelve {n, chance} */
  function koSummary(rolls, hp) {
    const max = rolls[rolls.length - 1], min = rolls[0];
    if (max <= 0) return {n: 0, chance: 0};
    for (let n = 1; n <= 6; n++) {
      if (max * n >= hp) {
        const c = n <= 4 ? koChance(rolls, hp, n) : (min * n >= hp ? 1 : null);
        return {n, chance: c == null ? 0.5 : c};
      }
    }
    return {n: 7, chance: 0};
  }

  // Potencia de los movimientos Z (Gen 7) y Max (Gen 8, Dynamax)
  const zPower = bp => bp <= 0 ? 0 : bp <= 55 ? 100 : bp <= 65 ? 120 : bp <= 75 ? 140 : bp <= 85 ? 160 : bp <= 95 ? 175 : bp <= 105 ? 180 : bp <= 115 ? 185 : bp <= 125 ? 190 : bp <= 135 ? 195 : 200;
  const maxPower = (bp, type) => {
    if (bp <= 0) return 0;
    const fp = type === 'Fighting' || type === 'Poison';
    const i = bp <= 40 ? 0 : bp <= 50 ? 1 : bp <= 60 ? 2 : bp <= 70 ? 3 : bp <= 100 ? 4 : bp <= 140 ? 5 : 6;
    return (fp ? [70, 75, 80, 85, 90, 95, 100] : [90, 100, 110, 120, 130, 140, 150])[i];
  };
  return {zPower, maxPower, TYPES, typesIn, typeEff, eff1, calcStats, hpDV, calc, koChance, koSummary, stageMul, TYPE_ITEMS, RESIST_BERRY, MULTI, FIXED};
})();
if (typeof module !== 'undefined') module.exports = CalcEngine;

/* Tablas de tipos por generación y fórmulas de estadísticas (sin DOM). El daño lo calcula el motor oficial de Smogon (js/vendor/smogon-calc) mediante js/calc-bridge.js. */
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
  const NATURE_MOD = (nat, i) => !nat || nat[1] === nat[2] ? 1 : (nat[1] === ['', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'][i] ? 1.1 : nat[2] === ['', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'][i] ? 0.9 : 1);
  // st: {lvl, iv:[6], ev:[6], nat:[nombre,+,-]|null}. Gen 1-2: iv = DV (0-15), ev = exp. de stats (0-65535)
  function calcStats(gen, base, st) {
    const L = st.lvl, out = [];
    for (let i = 0; i < 6; i++) {
      let v, b = base[i];
      if (gen <= 2) {
        const dv = i === 4 ? st.iv[3] : st.iv[i];       // un único DV Especial en Gen 1 y 2
        const se = gen === 1 && i === 4 ? st.ev[3] : st.ev[i];
        if (gen === 1 && i === 4) b = base[3];
        const bonus = Math.floor(Math.min(255, Math.ceil(Math.sqrt(se))) / 4);
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

  return {TYPES, typesIn, typeEff, eff1, calcStats, hpDV, stageMul};
})();
if (typeof module !== 'undefined') module.exports = CalcEngine;

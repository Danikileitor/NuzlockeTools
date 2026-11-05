/* Preparación de modelos GLB de Pokémon: pose, tamaño y animaciones. Usado por starter.js */
const PokeModel = (() => {
  const norm = n => (n || '').toLowerCase().replace(/^\d+[\s_]+/, '').replace(/^valvebiped\.bip01_/, '').replace(/^mixamorig:?/, '').replace(/_?\d+$/, '');
  const ARM = /^(l|r|left|right)[_ .]?(upper)?arm(_?0?1)?$/, HAND = /^(l|r|left|right)[_ .]?hand$/;

  // Los modelos sin animación llegan en T-pose: baja los brazos (rota el hueso del brazo hacia abajo)
  function lowerArms(root) {
    root.updateMatrixWorld(true);
    const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
    const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), D = new THREE.Vector3(), T = new THREE.Vector3(), Q = new THREE.Quaternion(), WQ = new THREE.Quaternion(), PQ = new THREE.Quaternion();
    const report = [];
    for (const arm of bones) {
      const side = (ARM.exec(norm(arm.name)) || [])[1]; if (!side) continue;
      let hand = null, fore = null;
      for (let q = arm.parent; q && !hand; q = q.parent) if (q.isBone && ARM.test(norm(q.name))) hand = 0;   // ya cubierto por su hueso padre
      if (hand === 0) continue;
      arm.traverse(o => { if (o === arm || !o.isBone) return; const n = norm(o.name); if (!hand && HAND.test(n)) hand = o; if (!fore && /forearm$/.test(n)) fore = o; });
      hand = hand || fore;
      if (!hand) continue;
      arm.getWorldPosition(P0); hand.getWorldPosition(P1); D.subVectors(P1, P0);
      const len = D.length(); if (len < 1e-6) continue;
      D.divideScalar(len);
      report.push(+D.y.toFixed(2));
      if (D.y < -0.55) continue;                                   // ya cae hacia abajo
      const hl = Math.hypot(D.x, D.z) || 1;
      T.set(D.x / hl * 0.32, -1, D.z / hl * 0.32).normalize();     // abajo y un poco hacia fuera
      Q.setFromUnitVectors(D, T);
      arm.getWorldQuaternion(WQ); WQ.premultiply(Q);
      arm.parent.getWorldQuaternion(PQ);
      arm.quaternion.copy(PQ.invert().multiply(WQ));
      arm.updateMatrixWorld(true);
    }
    return report;
  }

  const HIDE = {914:/gel_mesh/, 288:/^Sphere$/, 1000:/^Object_(253|255|257|259|261)$/};   // 1000: monedas sueltas de Gholdengo   // mallas que en la pose base salen estiradas decenas de veces
  // Modelos rígidos (sin esqueleto) exportados en T-pose: baja los brazos deformando la malla alrededor del hombro
  const TPOSE = new Set([740,97,106,125,126,185,186,190,239,272,288,294,308,354,360,390,391,453,504,505,511,512,513,514,515,516,532,533,534,538,539,552,559,562,592,611,612,614,624,629,765]);
  // Gholdengo (1000): en la serie 0xxxx su cuerpo flota separado de la tabla; en la 1xxxx va sobre ella
  const CLIP_OVERRIDE = {1000:{idle:/_10000_defaultwait01_loop/, hover:/_10400_attack01/, win:/_10300_roar01/}};
  const LAT_X = new Set([612,190,505,539,552,611,504,513,515,532,559]);       // modelos con cola/cuello largos hacia delante: el eje de los brazos es siempre X
  function dropArms(scene, deg, pid) {
    scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.visible) meshes.push(o); });
    if (!meshes.length) return false;
    const v = new THREE.Vector3(), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    const each = fn => { for (const m of meshes) { const pos = m.geometry.attributes.position; for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); fn(v); } } };
    each(p => { for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.getComponent(i)); mx[i] = Math.max(mx[i], p.getComponent(i)); } });
    const LA = !LAT_X.has(pid) && (mx[2] - mn[2]) > (mx[0] - mn[0]) ? 2 : 0;            // eje lateral = el de los brazos (suele ser X)
    const cx = (mn[LA] + mx[LA]) / 2, S = (mx[LA] - mn[LA]) / 2, H = mx[1] - mn[1];
    let sy = 0, sn = 0;
    each(p => { if (Math.abs(p.getComponent(LA) - cx) > 0.8 * S) { sy += p.y; sn++; } });   // altura de las manos
    if (!sn) return false;
    const ys = sy / sn, xs = 0.3 * S, th = (deg || 70) * Math.PI / 180, band = 0.2 * H;
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), n = new THREE.Vector3();
    for (const m of meshes) {
      m.geometry = m.geometry.clone();                              // las geometrías pueden compartirse
      const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
      inv.copy(m.matrixWorld).invert(); nm.getNormalMatrix(m.matrixWorld);
      const nInv = new THREE.Matrix3().getNormalMatrix(inv);
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld);
        const dx = v.getComponent(LA) - cx, side = dx < 0 ? -1 : 1, ax = Math.abs(dx), dy = v.y - ys;
        const w = sm(xs, xs + 0.15 * S, ax) * (1 - sm(band, band * 1.7, Math.abs(dy)));
        if (w <= 0) continue;
        const a = th * w, c = Math.cos(a), s2 = Math.sin(a), px = ax - xs;
        v.setComponent(LA, cx + side * (xs + px * c + dy * s2)); v.y = ys - px * s2 + dy * c;   // gira hacia abajo respecto al hombro
        v.applyMatrix4(inv); pos.setXYZ(k, v.x, v.y, v.z);
        if (nor) {
          n.fromBufferAttribute(nor, k).applyMatrix3(nm);
          const nl = n.getComponent(LA) * side;
          n.setComponent(LA, (nl * c + n.y * s2) * side); n.y = -nl * s2 + n.y * c;
          n.applyMatrix3(nInv).normalize(); nor.setXYZ(k, n.x, n.y, n.z);
        }
      }
      pos.needsUpdate = true; if (nor) nor.needsUpdate = true;
      m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere();
    }
    return true;
  }

  // vértices (ya deformados por el esqueleto) en el espacio de wrap
  function points(wrap) {
    wrap.updateMatrixWorld(true);
    const out = [], v = new THREE.Vector3();
    wrap.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const pos = o.geometry.attributes.position, sk = o.isSkinnedMesh && (o.applyBoneTransform || o.boneTransform);
      if (o.isSkinnedMesh) o.skeleton.update();
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k); if (sk) sk.call(o, k, v);
        v.applyMatrix4(o.matrixWorld); out.push(v.x, v.y, v.z);
      }
    });
    return out;
  }
  // caja completa y caja "robusta" (sin el 0,5 % de vértices más extremos: puntas sueltas, huesos auxiliares...)
  function measure(wrap) {
    const p = points(wrap), n = p.length / 3, full = new THREE.Box3(), rob = new THREE.Box3();
    if (!n) return {full, rob};
    const lo = [], hi = [];
    for (let ax = 0; ax < 3; ax++) {
      const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = p[i * 3 + ax];
      a.sort(); lo.push(a[Math.floor(n * 0.005)]); hi.push(a[Math.min(n - 1, Math.ceil(n * 0.995))]);
      full.min.setComponent(ax, a[0]); full.max.setComponent(ax, a[n - 1]);
    }
    rob.min.fromArray(lo); rob.max.fromArray(hi);
    return {full, rob};
  }

  // devuelve {obj, mixer, acts, info}; el modelo queda centrado y con ~2.6 de alto máx.
  function prep(g, pid) {
    const wrap = new THREE.Group(); wrap.add(g.scene);
    // oculta mallas auxiliares: versiones LOD superpuestas y mallas totalmente transparentes
    let hasMain = false;
    g.scene.traverse(o => { if (o.isMesh && !/lod[1-9]/i.test(o.name) && !(HIDE[pid] && HIDE[pid].test(o.name))) hasMain = true; });
    g.scene.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      // metalness 1 sin mapa de entorno deja el modelo casi negro
      ms.forEach(m => { if (m && m.metalness > 0.3) m.metalness = 0.1; });
      if ((hasMain && /lod[1-9]/i.test(o.name)) || (HIDE[pid] && HIDE[pid].test(o.name)) || ms.every(m => m.transparent && m.opacity === 0)) o.visible = false;
    });
    const clips = (g.animations || []).filter(c => !/eye|mouth|blink/i.test(c.name));
    let mixer = null, acts = null, arms = [];
    if (clips.length) {
      mixer = new THREE.AnimationMixer(g.scene);
      const find = re => clips.find(c => re.test(c.name)), act = c => c && mixer.clipAction(c);
      const ov = CLIP_OVERRIDE[pid];     // modelos con varias series de animaciones: elegir la que mantiene las piezas unidas
      if (ov) {
        acts = {idle:act(find(ov.idle)) || null, hover:act(find(ov.hover || ov.idle)), win:act(find(ov.win || ov.hover || ov.idle))};
        if (acts.idle) { acts.idle.play(); mixer.update(0); } else acts = null;
      }
      if (!acts) {
      const idle = find(/defaultwait01_loop|aidle|wait.*loop|idle|idol|stand|wait|base layer|armatureaction|^animation$|take 001/i) || clips[0];
      acts = {idle:act(idle), hover:act(find(/glad|happy|jump_s|fight_b|attack01|attack/i)), win:act(find(/glad|happy|jump_e|roar|attack01|attack|fight_d/i))};
      acts.idle.play(); mixer.update(0);
      }
    } else { arms = lowerArms(g.scene); if (!arms.length && TPOSE.has(pid)) arms = [dropArms(g.scene, undefined, pid) ? 'malla' : 'no']; }
    let m = measure(wrap), size = m.rob.getSize(new THREE.Vector3()), fs = m.full.getSize(new THREE.Vector3());
    const raw = fs.toArray().map(x => +x.toFixed(3));
    let k = 2.6 / Math.max(size.y, 0.75 * Math.max(size.x, size.z), 0.001);
    k = Math.min(k, 4.6 / Math.max(fs.x, fs.y, fs.z, 0.001));      // sin que ninguna parte se salga de la escena
    g.scene.scale.multiplyScalar(k);
    const box = measure(wrap).full;
    g.scene.position.sub(box.getCenter(new THREE.Vector3()));
    const dims = box.getSize(new THREE.Vector3());
    wrap.userData.half = dims.y / 2;   // para apoyarlo justo sobre la Poké Ball
    if (pid === 802) wrap.traverse(o => { if (o.isMesh && o.name === 'Object_39') o.visible = false; });   // mancha negra plana (ya medida)
    // la esfera de recorte de un modelo con esqueleto usa la pose base (muy distinta): sin esto partes como los ojos desaparecen
    wrap.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    return {obj:wrap, mixer, acts, info:{clips:clips.length, arms, raw, dims:dims.toArray().map(x => +x.toFixed(2))}};
  }
  const MODEL_BASE = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/';
  const NO_3D = new Set([850,851,852,853,854,859,860,861,863,864,866,868,873,878,879,882,883,918,919,931,935,936,938,939,940,944,950,951,952,953,954,955,956,961,963,964,968,969,970,971,972,976,977,986,988,989,991,992,993,1011,1012,1013,1022,1024]);
  const GENDER = new Set([521, 668, 916]);   // solo existen como -M / -F
  const MODEL_ROOT = MODEL_BASE.replace('regular/', '');
  // Zygarde: el modelo "regular" es solo una Célula; las formas reales están en multiform / mega
  const zygarde = name => /mega/i.test(name || '') ? 'mega/718' : /10/.test(name || '') ? 'multiform/718_1' : /complete/i.test(name || '') ? 'multiform/718_3' : 'multiform/718_2';
  const modelUrl = (p, name) => (p >= 10000 || NO_3D.has(p)) ? null : p === 718 ? MODEL_ROOT + zygarde(name) + '.glb' : MODEL_BASE + p + (GENDER.has(p) ? '-M' : '') + '.glb';
  return {prep, measure, TPOSE, modelUrl};
})();

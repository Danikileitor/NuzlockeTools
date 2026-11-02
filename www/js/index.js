const I={
 es:{lead:'Herramientas para gestionar tus partidas de Pokémon.',t1:'Nuzlocke',d1:'Elige un juego y apunta el Pokémon capturado en cada zona. Incluye modo Randomlocke.',t2:'TeamSheet',d2:'Apunta los Pokémon, habilidades, movimientos y stats del equipo de tus rivales.',t3:'Starter Randomizer',d3:'Genera 3 Pokémon iniciales en una escena 3D y elige el que más te guste.',go:'Abrir →',foot:'Los datos se guardan en tu navegador.'},
 en:{lead:'Tools to manage your Pokémon playthroughs.',t1:'Nuzlocke',d1:'Pick a game and log the Pokémon caught in each area. Randomlocke mode included.',t2:'TeamSheet',d2:'Log your rivals\' Pokémon, abilities, moves and stats.',t3:'Starter Randomizer',d3:'Generate 3 starter Pokémon in a 3D scene and pick your favourite.',go:'Open →',foot:'Data is saved in your browser.'}};
let lang='es';
try{lang=JSON.parse(localStorage.getItem('pm-lang'))||'es'}catch(e){}
const $=id=>document.getElementById(id);
function paint(){const t=I[lang];document.documentElement.lang=lang;$('lang').value=lang;
 ['lead','t1','d1','t2','d2','t3','d3','foot'].forEach(k=>$(k).textContent=t[k]);$('g1').textContent=$('g2').textContent=$('g3').textContent=t.go;}
$('lang').onchange=e=>{lang=e.target.value;try{localStorage.setItem('pm-lang',JSON.stringify(lang))}catch(_){}paint()};
paint();


// --- Core math helpers ---
function interp1(x, xs, ys){
  if(xs.length===0) return NaN;
  if(x<=xs[0]) return ys[0];
  if(x>=xs[xs.length-1]) return ys[ys.length-1];
  for(let i=1;i<xs.length;i++){
    if(x<=xs[i]){
      const x0=xs[i-1], x1=xs[i], y0=ys[i-1], y1=ys[i];
      return y0 + (y1-y0)*(x-x0)/(x1-x0);
    }
  } return NaN;
}
function interp2(oat, alt, oats, alts, grid){
  const colVals = alts.map((a,ri)=>interp1(oat, oats, grid[ri]));
  return interp1(alt, alts, colVals);
}
const S97 = {
  20: {10:[10,2],20:[9,3],30:[9,5],40:[8,6],50:[6,8],60:[5,9],70:[3,9],80:[2,10],90:[0,10]},
  25: {10:[15,3],20:[14,5],30:[13,8],40:[11,10],50:[10,11],55:[14,20]},
  30: {10:[20,3],20:[19,7],30:[17,10],40:[15,13],50:[13,15],60:[10,17],70:[7,19],80:[3,20],90:[0,20]},
  35: {10:[25,4],20:[23,9],30:[22,13],40:[19,16],50:[16,19]},
  40: {10:[30,5],20:[28,10],30:[26,15],40:[23,19],43:[22,20]}
};
function headFrom(wind, wra, mode){
  if(mode==="s97"){
    const speeds = Object.keys(S97).map(k=>+k);
    let nearest = speeds[0], dmin=1e9;
    speeds.forEach(s=>{ const d=Math.abs(s-wind); if(d<dmin){dmin=d; nearest=s;} });
    const table = S97[nearest];
    const angles = Object.keys(table).map(k=>+k);
    let best=angles[0], ad=1e9;
    angles.forEach(a=>{ const d=Math.abs(a-wra); if(d<ad){ad=d; best=a;} });
    return table[best][0];
  } else {
    return wind*Math.cos(wra*Math.PI/180);
  }
}
function nearestWeightTable(map, gw){
  const ks = Object.keys(map).map(k=>+k).sort((a,b)=>a-b);
  if(ks.length===0) return null;
  let best=ks[0], md=1e9;
  ks.forEach(k=>{ const d=Math.abs(k-gw); if(d<md){md=d; best=k;} });
  return map[best];
}

// --- DB load ---
let DB=null;
async function loadDB(){
  if(DB) return DB;
  try{ DB = await fetch("./db.json").then(r=>r.json()); }
  catch(e){ DB = {"conv":{},"enh":{},"rto":{}}; }
  return DB;
}

// --- UI Helpers ---
function $(id){ return document.getElementById(id); }
function setMode(m){
  // toggle tabs
  ["conv","enh","rto"].forEach(x => {
    const b = $("tab-"+x);
    if(b){ b.classList.toggle("active", x===m); b.setAttribute("aria-selected", x===m ? "true":"false"); }
  });
  // advanced groups
  const convEnh = $("group-conv-enh"), desc=$("group-desc"), r1=$("group-rto-1"), r2=$("group-rto-2");
  if(m==="rto"){ convEnh.style.display="none"; desc.style.display="none"; r1.style.display="block"; r2.style.display="block"; $("adv-hint").textContent="RTO: usa fator ( ) e filtro (EAPS/IBF)"; }
  else { convEnh.style.display="block"; desc.style.display="block"; r1.style.display="none"; r2.style.display="none"; $("adv-hint").textContent="DropDown: vento ft/kt e descendente (+15 ft)"; }
  $("mode").value = m; // hidden input to keep compatibility if needed
  calculate();
}

// --- Calculation ---
async function calculate(){
  const mode = document.querySelector(".seg button.active").dataset.mode;
  const gw   = +$("gw").value;
  const oat  = +$("oat").value;
  const alt  = +$("alt").value;
  const wind = +$("wind").value;
  const wra  = +$("wra").value;
  const windMode = $("windMode").value;
  const desc = ($("descending").value==="Sim");
  const ftPerKt = +$("ftPerKt").value;
  const rtoDiv  = +$("rtoDiv").value;
  const filter  = +$("filter").value;

  const db = await loadDB();
  const head = headFrom(wind, wra, windMode);

  if(mode==="conv" || mode==="enh"){
    const map = mode==="conv" ? db.conv : db.enh;
    const tbl = nearestWeightTable(map, gw);
    if(!tbl){ $("result").textContent="—"; $("unit").textContent="Base não carregada"; $("note").textContent=""; return; }
    const base = interp2(oat, alt, tbl.oats, tbl.alts, tbl.grid);
    let dd = base + head*ftPerKt;
    if(mode==="conv" && desc) dd += 15;
    $("result").textContent = Math.round(dd) + " ft";
    $("unit").textContent = (mode==="conv" ? "Drop Down Convencional" : "Drop Down Enhanced");
    $("note").textContent = "Headwind usado: " + Math.round(head) + " kt";
  } else {
    const tbl = nearestWeightTable(db.rto, gw);
    if(!tbl){ $("result").textContent="—"; $("unit").textContent="Base não carregada"; $("note").textContent=""; return; }
    const dist = interp2(oat, alt, tbl.oats, tbl.alts, tbl.dist);
    const fac  = interp2(oat, alt, tbl.oats, tbl.alts, tbl.fac);
    const windBenefit = (head / rtoDiv) * fac;
    const total = dist + windBenefit + filter;
    $("result").textContent = Math.round(total) + " m";
    $("unit").textContent = "RTO Clear Area";
    $("note").textContent = "Benefício vento: "+Math.round(windBenefit)+" m  •  EAPS/IBF: "+filter+" m";
  }
}

// --- Bindings ---
window.addEventListener("DOMContentLoaded", () => {
  // hidden mode input for compatibility
  const hidden = document.createElement("input");
  hidden.type="hidden"; hidden.id="mode"; hidden.value="conv";
  document.body.appendChild(hidden);

  // tabs
  ["conv","enh","rto"].forEach(m => {
    $("tab-"+m).addEventListener("click", () => setMode(m));
  });

  // live input
  ["gw","oat","alt","wind","wra","windMode","descending","ftPerKt","rtoDiv","filter"].forEach(id => {
    const el = $(id); if(el){ el.addEventListener("input", calculate); el.addEventListener("change", calculate); }
  });
  $("calcBtn").addEventListener("click", (e)=>{ e.preventDefault(); calculate(); });
  // db import/export
  $("exportBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    const payload = JSON.stringify(DB||{"conv":{},"enh":{},"rto":{}}, null, 2);
    const blob = new Blob([payload], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "db.json"; a.click();
  });
  $("fileInput").addEventListener("change", async e=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    try{ DB = JSON.parse(text); alert("Base de dados carregada!"); calculate(); }
    catch(err){ alert("JSON inválido."); }
  });

  // pseudo-install helper (guia)
  $("installBtn").addEventListener("click", ()=>{
    alert("Para instalar no iPhone: publique a pasta em uma URL (GitHub Pages/Netlify), abra no Safari e use Compartilhar → 'Adicionar à Tela de Início'.");
  });

  // initial state
  setMode("conv");
});

/* Project Mapping Tool — Fernhollow Development (fictional demo company) */
(function(){
const G = PMTGeo, I = PMTIcons, B = PMTBasemaps, Roads = PMTRoads;
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const LS_LIB = 'pmt.maps', LS_WORK = 'pmt.working';
const OREGON = [[41.99, -124.6], [46.29, -116.46]];
/* Callout color presets (brand palette only): background, icon block, border, name text, subtitle text */
const CALLOUT_STYLES = [
  {id:'pine',   name:'Pine',        bg:'#1F553C', ic:'#338960', bd:'#98C8B0', tx:'#FFFFFF', sub:'#D6EAE0'},
  {id:'forest', name:'Forest',      bg:'#338960', ic:'#1F553C', bd:'#98C8B0', tx:'#FFFFFF', sub:'#D6EAE0'},
  {id:'night',  name:'Evergreen',   bg:'#0D2218', ic:'#338960', bd:'#98C8B0', tx:'#FFFFFF', sub:'#98C8B0'},
  {id:'white',  name:'White',       bg:'#FFFFFF', ic:'#338960', bd:'#98C8B0', tx:'#0D2218', sub:'#5E5E5E'},
  {id:'mint',   name:'Mint',        bg:'#D6EAE0', ic:'#1F553C', bd:'#98C8B0', tx:'#0D2218', sub:'#1F553C'},
  {id:'sage',   name:'Sage',        bg:'#98C8B0', ic:'#1F553C', bd:'#1F553C', tx:'#0D2218', sub:'#1F553C'}
];
const styleOf = id => CALLOUT_STYLES.find(c => c.id === id) || CALLOUT_STYLES[0];
const poiStyle = p => styleOf(p.style || doc.calloutStyle);
const styleVars = c => `--c-bg:${c.bg};--c-ic:${c.ic};--c-bd:${c.bd};--c-tx:${c.tx};--c-sub:${c.sub}`;
const swatch = c => `<i style="background:linear-gradient(90deg,${c.ic} 0 38%,${c.bg} 38%);border-color:${c.bd}"></i>`;
const FILLS = [['#338960','Forest'], ['#1F553C','Pine'], ['#98C8B0','Sage'], ['#D6EAE0','Mint'], ['#0D2218','Evergreen']];

const LAYERS = [
  ['site', 'boundary', 'Site boundary'], ['site', 'siteLabel', 'Site label'], ['site', 'rings', 'Distance rings'], ['site', 'ringLabels', 'Ring labels'],
  ['places', 'pois', 'Place callouts'], ['places', 'distances', 'Distances in callouts'], ['places', 'leaders', 'Leader lines'],
  ['roads', 'roadLabels', 'Road names', 'Oregon public roads'], ['roads', 'roadLines', 'Road highlight lines', 'Shown over satellite imagery; hover a road for its name'],
  ['chrome', 'north', 'North arrow'], ['chrome', 'scale', 'Scale bar'], ['chrome', 'logo', 'Logo']
];
const DEFAULT_LAYERS = Object.fromEntries(LAYERS.map(l => [l[1], true]));

/* ================= Storage ================= */
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

function blankDoc(){
  const now = new Date().toISOString();
  return {app:'pmt-project-map', version:1, id:uid(), name:'Untitled map', created:now, modified:now,
    basemap:'fern-light', shade:.18, view:null,
    site:{name:'', sub:'Development Site', geojson:null, point:null, dx:-170, dy:-60, fill:'#338960', opacity:.75},
    rings:{miles:[0.25, 0.5], pos:{}}, pois:[], calloutStyle:'pine', layers:{...DEFAULT_LAYERS}};
}
function normalize(d){
  const b = blankDoc();
  d = {...b, ...d, site:{...b.site, ...(d.site || {})}, rings:{...b.rings, ...(d.rings || {})}, layers:{...b.layers, ...(d.layers || {})}};
  d.rings.pos = d.rings.pos || {};
  d.pois = (d.pois || []).map(p => ({id:uid(), name:'', sub:'', dx:140, dy:-40, ...p, icon: I.valid(p.icon) ? p.icon : I.guess(p.name + ' ' + (p.sub || ''))}));
  if (!B.LIST.some(x => x.id === d.basemap)) d.basemap = 'fern-light';
  if (!CALLOUT_STYLES.some(c => c.id === d.calloutStyle)) d.calloutStyle = 'pine';
  d.pois.forEach(p => { if (!CALLOUT_STYLES.some(c => c.id === p.style)) delete p.style; });
  d.app = 'pmt-project-map';
  return d;
}

let doc = blankDoc(), dirty = false, fileHandle = null;

/* ================= Map ================= */
const map = L.map('map', {zoomControl:true, zoomSnap:.25, zoomDelta:.5, wheelPxPerZoomLevel:90, maxZoom:21, attributionControl:true});
map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank">Leaflet</a>');
L.control.scale({imperial:true, metric:false, position:'bottomright', maxWidth:140}).addTo(map);
map.createPane('sitePane').style.zIndex = 420;
map.fitBounds(OREGON);

Roads.init(map, {onStatus: renderRoadStatus});

/* ---------- Basemap ---------- */
let baseLayer = null, baseReq = 0, tone = 'light';
async function setBasemap(id, fromUser){
  const def = B.get(id), req = ++baseReq;
  doc.basemap = def.id;
  renderBasemapPicker();
  let layer;
  try { layer = await B.makeLayer(def); }
  catch (e) { console.error(e); if (req === baseReq) toast('Could not load the ' + def.name + ' basemap. Check your internet connection.', {error:true}); return; }
  if (req !== baseReq) return;
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = layer.addTo(map);
  if (baseLayer.bringToBack) baseLayer.bringToBack();
  tone = def.tone;
  document.body.classList.toggle('tone-light', tone === 'light');
  Roads.setTone(def.shade ? 'dark' : 'light');     // visible road lines only over imagery; other maps draw their own roads
  applyShade();
  renderSite();
  if (fromUser) {
    if (def.labels && doc.layers.roadLabels) {
      doc.layers.roadLabels = false; applyLayers();
      toast('Road names are off because this basemap shows its own. You can turn them back on in Layers.');
    } else if (!def.labels && !doc.layers.roadLabels) {
      doc.layers.roadLabels = true; applyLayers();
    }
    touch();
  }
}
function applyShade(){
  const def = B.get(doc.basemap), pane = map.getPane('tilePane');
  pane.style.filter = def.shade && doc.shade > 0 ? `brightness(${(1 - doc.shade).toFixed(2)})` : '';
  $('#shadeBox').hidden = !def.shade;
  $('#shade').value = doc.shade;
}

/* ---------- Draggable callouts ---------- */
function callout(ll, html, o){
  const wrap = document.createElement('div'); wrap.className = 'poi poi-' + o.cls;
  wrap.innerHTML = '<svg class="leader" width="1" height="1"><line x1="0" y1="0"/></svg><div class="dot"></div>';
  const lab = document.createElement('div'); lab.className = o.cls; lab.innerHTML = html; wrap.appendChild(lab);
  if (o.style) lab.style.cssText = styleVars(o.style);
  const line = wrap.querySelector('line');
  let dx = o.dx, dy = o.dy;
  // End the leader at the label's edge so it never crosses the text
  const place = () => {
    lab.style.left = dx + 'px'; lab.style.top = dy + 'px';
    const hw = (lab.offsetWidth || 160) / 2, hh = (lab.offsetHeight || 40) / 2;
    const s = Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, 1e-6);
    const k = s > 1 ? 1 - 1 / s : 0;
    line.setAttribute('x2', dx * k); line.setAttribute('y2', dy * k);
  };
  place();
  const m = L.marker(ll, {icon:L.divIcon({className:'', html:wrap, iconSize:[0, 0]}), interactive:false, keyboard:false, zIndexOffset:o.z || 0}).addTo(map);
  requestAnimationFrame(place); document.fonts && document.fonts.ready.then(place);
  lab.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation(); map.dragging.disable();
    const sx = ev.clientX, sy = ev.clientY, ox = dx, oy = dy; lab.setPointerCapture(ev.pointerId);
    const mv = e => { dx = ox + e.clientX - sx; dy = oy + e.clientY - sy; place(); };
    const up = () => {
      lab.removeEventListener('pointermove', mv); lab.removeEventListener('pointerup', up); map.dragging.enable();
      if (dx !== ox || dy !== oy) { o.onMove && o.onMove(Math.round(dx), Math.round(dy)); Roads.drawLabels(); }
    };
    lab.addEventListener('pointermove', mv); lab.addEventListener('pointerup', up);
  });
  lab.addEventListener('dblclick', e => { e.stopPropagation(); o.onDbl && o.onDbl(); });
  return {marker:m, place};
}

/* ---------- Site ---------- */
let siteLayer = null, siteCallout = null, ringLayers = [];
function siteAnchor(){
  if (doc.site.geojson) return G.centroid(doc.site.geojson);
  return doc.site.point;
}
function renderSite(){
  if (siteLayer) map.removeLayer(siteLayer);
  if (siteCallout) map.removeLayer(siteCallout.marker);
  siteLayer = siteCallout = null;
  const s = doc.site;
  if (s.geojson && doc.layers.boundary) {
    const stroke = tone === 'dark' ? '#D6EAE0' : '#1F553C';
    siteLayer = L.geoJSON(s.geojson, {pane:'sitePane', interactive:false,
      style:{color:stroke, weight:3, fillColor:s.fill, fillOpacity:s.opacity},
      pointToLayer:(f, ll) => L.circleMarker(ll, {pane:'sitePane', radius:6})}).addTo(map);
  }
  const a = siteAnchor();
  if (a && (s.name || s.sub)) {
    siteCallout = callout(a, `<div class="t">${esc(s.name || 'Project Site')}</div><div class="s">${esc(s.sub)}</div>`,
      {dx:s.dx, dy:s.dy, cls:'site', z:1000, onMove:(dx, dy) => { s.dx = dx; s.dy = dy; touch(); }, onDbl:() => showTab('site')});
  }
  renderRings();
  renderSiteStat();
}
function fmtMi(mi){
  const w = Math.floor(mi), f = +(mi - w).toFixed(3);
  const frac = {0.25:'¼', 0.5:'½', 0.75:'¾'}[f];
  if (frac) return (w ? w : '') + frac + ' MI';
  return (+mi.toFixed(2)) + ' MI';
}
function renderRings(){
  ringLayers.forEach(l => map.removeLayer(l)); ringLayers = [];
  const a = siteAnchor();
  if (!a || !doc.layers.rings) return;
  const col = tone === 'dark' ? '#D6EAE0' : '#1F553C';
  doc.rings.miles.forEach(mi => {
    const r = mi * G.MI;
    ringLayers.push(L.circle(a, {pane:'sitePane', radius:r, color:col, weight:1.5, opacity:.85, dashArray:'6 6', fill:false, interactive:false}).addTo(map));
    const key = String(mi), pos = doc.rings.pos[key] || [a[0] + r / 111320, a[1]];
    const m = L.marker(pos, {icon:L.divIcon({className:'', html:`<div class="ring-label">${fmtMi(mi)}</div>`, iconSize:[0, 0]}), draggable:true, keyboard:false}).addTo(map);
    m.on('dragend', () => { const p = m.getLatLng(); doc.rings.pos[key] = [+p.lat.toFixed(6), +p.lng.toFixed(6)]; touch(); });
    ringLayers.push(m);
  });
}
function renderSiteStat(){
  const s = doc.site, el = $('#siteStat');
  $('#siteClear').hidden = !(s.geojson || s.point);
  if (s.geojson) {
    const n = s.geojson.features.length, ac = G.areaAcres(s.geojson);
    el.innerHTML = `<span class="ms" style="color:var(--forest)">pentagon</span><span>Boundary · <b>${ac < 10 ? ac.toFixed(2) : ac.toFixed(1)} acres</b>${n > 1 ? ' · ' + n + ' parcels' : ''}</span>`;
  } else if (s.point) {
    el.innerHTML = `<span class="ms" style="color:var(--forest)">location_on</span><span>Point · <b>${s.point[0].toFixed(5)}, ${s.point[1].toFixed(5)}</b></span>`;
  } else el.innerHTML = '<span>No site yet. Draw it, drop a point, load a file or paste coordinates.</span>';
}
function setSiteFromFC(fc){
  const polys = fc.features.filter(f => G.polygons(f.geometry).length);
  if (polys.length) {
    doc.site.geojson = {type:'FeatureCollection', features:polys.map(f => ({type:'Feature', properties:f.properties || {}, geometry:f.geometry}))};
    doc.site.point = null;
  } else {
    const pt = fc.features.find(f => f.geometry.type === 'Point');
    if (!pt) throw new Error('No boundary (polygon) or point was found.');
    doc.site.geojson = null;
    doc.site.point = [pt.geometry.coordinates[1], pt.geometry.coordinates[0]];
  }
  if (!doc.site.name && fc.features[0]) { const g = G.guessName(fc.features[0].properties); if (g.name) doc.site.name = g.name; }
  doc.rings.pos = {};
  renderSiteForm(); renderSite(); renderPois(); renderPoiList(); fitAll(); touch();
}
function renderSiteForm(){
  $('#siteName').value = doc.site.name;
  $('#siteSub').value = doc.site.sub;
  $('#siteOpacity').value = doc.site.opacity;
  $('#ringMiles').value = doc.rings.miles.join(', ');
  $('#siteFill').innerHTML = FILLS.map(([c, n]) =>
    `<button class="bm${doc.site.fill === c ? ' on' : ''}" data-fill="${c}" title="${n}" style="padding:5px 8px"><i style="background:${c}"></i>${n}</button>`).join('');
}

/* ---------- Places ---------- */
let poiCallouts = [];
function poiHtml(p){
  const a = siteAnchor();
  const dist = a ? `<span class="d">${G.miles(a, p.ll).toFixed(1)} mi</span>` : '';
  const sub = esc(p.sub);
  const line = sub && dist ? `${sub}<span class="sep"> &nbsp;·&nbsp; </span>${dist}` : sub || dist;
  return `<div class="ic"><span class="ms">${esc(p.icon)}</span></div><div class="tx"><div class="nm">${esc(p.name || 'Untitled place')}</div><div class="sub">${line}</div></div>`;
}
function renderPois(){
  poiCallouts.forEach(c => map.removeLayer(c.marker)); poiCallouts = [];
  doc.pois.filter(p => !p.hidden).forEach(p => {
    poiCallouts.push(callout(p.ll, poiHtml(p), {dx:p.dx, dy:p.dy, cls:'callout', style:poiStyle(p),
      onMove:(dx, dy) => { p.dx = dx; p.dy = dy; touch(); }, onDbl:() => { showTab('places'); openPoiForm(p); }}));
  });
  setTimeout(Roads.drawLabels, 50);
}
function renderPoiList(){
  const a = siteAnchor();
  $('#poiCount').textContent = doc.pois.length ? `(${doc.pois.length})` : '';
  $('#poiList').innerHTML = doc.pois.length ? doc.pois.map(p => `
    <div class="item${p.hidden ? ' hidden' : ''}" data-id="${p.id}">
      <div class="badge" style="background:${poiStyle(p).ic}"><span class="ms">${esc(p.icon)}</span></div>
      <div class="t"><b>${esc(p.name || 'Untitled place')}</b><small>${esc(p.sub)}${a ? (p.sub ? ' · ' : '') + G.miles(a, p.ll).toFixed(1) + ' mi' : ''}</small></div>
      <button class="iconbtn${p.hidden ? ' off' : ''}" data-act="vis" title="${p.hidden ? 'Show' : 'Hide'}"><span class="ms">${p.hidden ? 'visibility_off' : 'visibility'}</span></button>
      <button class="iconbtn" data-act="edit" title="Edit"><span class="ms">edit</span></button>
      <button class="iconbtn" data-act="del" title="Delete"><span class="ms">delete</span></button>
    </div>`).join('') : '<div class="empty">No places yet. Add one, import a file or paste a list.</div>';
}
function renderCalloutStyle(){
  $('#calloutStyle').innerHTML = CALLOUT_STYLES.map(c =>
    `<button class="bm${doc.calloutStyle === c.id ? ' on' : ''}" data-style="${c.id}">${swatch(c)}${c.name}</button>`).join('');
}
/* Start the label on the side of the point away from the site */
function defaultOffset(ll){
  const a = siteAnchor();
  if (!a) return [140, -40];
  const pa = map.latLngToContainerPoint(a), pp = map.latLngToContainerPoint(ll);
  let vx = pp.x - pa.x, vy = pp.y - pa.y; const n = Math.hypot(vx, vy);
  if (n < 1) return [140, -40];
  vx /= n; vy /= n;
  return [Math.round(vx * 150), Math.round(vy * 60)];
}
function addPlaces(list){
  const added = list.filter(p => p.ll && isFinite(p.ll[0]) && isFinite(p.ll[1])).map(p => {
    const [dx, dy] = defaultOffset(p.ll);
    return {id:uid(), name:p.name || '', sub:p.sub || '', icon: I.valid(p.icon) ? p.icon : I.guess((p.name || '') + ' ' + (p.sub || '')),
      ll:[+(+p.ll[0]).toFixed(6), +(+p.ll[1]).toFixed(6)], dx, dy};
  });
  doc.pois.push(...added);
  renderPois(); renderPoiList(); touch();
  return added.length;
}
function placesFromFC(fc){
  return fc.features.map(f => {
    const g = f.geometry; let ll = null;
    if (g.type === 'Point') ll = [g.coordinates[1], g.coordinates[0]];
    else if (g.type === 'MultiPoint') ll = [g.coordinates[0][1], g.coordinates[0][0]];
    else { const c = G.centroid({features:[f]}); if (c) ll = c; }
    return ll && {...G.guessName(f.properties), ll};
  }).filter(Boolean);
}

/* Place form */
let editing = null, iconPick = I.DEFAULT, iconTouched = false, stylePick = '';
function openPoiForm(p){
  editing = p || null;
  $('#poiFormTitle').textContent = p ? 'Edit place' : 'New place';
  $('#poiName').value = p ? p.name : '';
  $('#poiSub').value = p ? p.sub : '';
  $('#poiLL').value = p ? p.ll.join(', ') : '';
  $('#poiSearch').value = ''; $('#poiResults').innerHTML = '';
  iconPick = p ? p.icon : I.DEFAULT; iconTouched = !!p;
  stylePick = p && p.style || '';
  renderIconGrid(); renderStylePick();
  $('#poiForm').hidden = false; $('#poiPaste').hidden = true;
  $('#poiName').focus();
}
function closePoiForm(){ $('#poiForm').hidden = true; editing = null; cancelMode(); }
function renderIconGrid(){
  $('#iconGrid').innerHTML = I.ICONS.map(i => `<button type="button" data-icon="${i.id}" title="${i.label}" class="${i.id === iconPick ? 'on' : ''}"><span class="ms">${i.id}</span></button>`).join('');
  const cur = I.ICONS.find(i => i.id === iconPick);
  $('#iconName').textContent = cur ? cur.label : '';
}
function renderStylePick(){
  const def = styleOf(doc.calloutStyle);
  $('#poiStyle').innerHTML = `<button type="button" class="bm${stylePick ? '' : ' on'}" data-style="">${swatch(def)}Map default</button>` +
    CALLOUT_STYLES.map(c => `<button type="button" class="bm${stylePick === c.id ? ' on' : ''}" data-style="${c.id}">${swatch(c)}${c.name}</button>`).join('');
}
function parseLL(text){
  const n = (text.match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number);
  if (n.length !== 2) return null;
  return Math.abs(n[0]) > 90 ? [n[1], n[0]] : n;
}
function savePoiForm(){
  const ll = parseLL($('#poiLL').value);
  if (!ll) { toast('Enter a location as "latitude, longitude", pick it on the map, or search for an address.', {error:true}); return; }
  const vals = {name:$('#poiName').value.trim(), sub:$('#poiSub').value.trim(), icon:iconPick, ll};
  if (stylePick) vals.style = stylePick;
  if (editing) { Object.assign(editing, vals); if (!stylePick) delete editing.style; }
  else { const [dx, dy] = defaultOffset(ll); doc.pois.push({id:uid(), dx, dy, ...vals}); }
  closePoiForm(); renderPois(); renderPoiList(); touch();
  if (!map.getBounds().contains(ll)) map.panTo(ll);
}

/* ---------- Esri address / place search ---------- */
function wireSearch(input, btn, results, onPick){
  let found = [];
  const run = async () => {
    const q = input.value.trim(); if (!q) return;
    results.innerHTML = '<div><small>Searching…</small></div>';
    const c = map.getCenter();
    const url = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=6' +
      '&outFields=PlaceName,Place_addr,Type&location=' + c.lng.toFixed(4) + ',' + c.lat.toFixed(4) + '&singleLine=' + encodeURIComponent(q);
    try {
      const r = await fetch(url).then(r => r.json());
      found = (r.candidates || []).map(k => ({name:k.attributes.PlaceName || k.address.split(',')[0], sub:k.attributes.Place_addr || k.address, ll:[+k.location.y.toFixed(6), +k.location.x.toFixed(6)]}));
      results.innerHTML = found.length ? found.map((f, i) => `<div data-i="${i}"><b>${esc(f.name)}</b><br><small>${esc(f.sub)}</small></div>`).join('') : '<div><small>No matches.</small></div>';
    } catch (e) { results.innerHTML = '<div><small>Search failed. Check your internet connection.</small></div>'; }
  };
  btn.onclick = run;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  results.addEventListener('click', e => {
    const d = e.target.closest('[data-i]'); if (!d) return;
    onPick(found[+d.dataset.i]); results.innerHTML = '';
  });
}

/* ---------- Draw / pick modes ---------- */
let mode = null;
function showHint(text, btns){
  $('#modeText').textContent = text;
  $('#modeBtns').innerHTML = '';
  btns.forEach(([label, fn]) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = fn; $('#modeBtns').appendChild(b); });
  $('#modeHint').classList.add('on');
  map.getContainer().classList.add('picking');
}
function cancelMode(){
  if (!mode) return;
  mode.cleanup && mode.cleanup();
  mode = null;
  $('#modeHint').classList.remove('on');
  map.getContainer().classList.remove('picking');
  map.doubleClickZoom.enable();
}
function pickPoint(text, cb){
  cancelMode();
  const onClick = e => { const ll = [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]; cancelMode(); cb(ll); };
  map.on('click', onClick);
  mode = {type:'pick', cleanup:() => map.off('click', onClick)};
  showHint(text, [['Cancel', cancelMode]]);
}
function drawBoundary(){
  cancelMode();
  const pts = [], group = L.layerGroup().addTo(map);
  const shape = L.polygon([], {pane:'sitePane', color:'#338960', weight:2, dashArray:'5 5', fillColor:'#338960', fillOpacity:.2, interactive:false}).addTo(group);
  const verts = L.layerGroup().addTo(group);
  let cursor = null;
  const redraw = () => {
    shape.setLatLngs(cursor ? pts.concat([cursor]) : pts);
    verts.clearLayers();
    pts.forEach((p, i) => {
      const m = L.marker(p, {icon:L.divIcon({className:'', html:`<div class="vtx${i === 0 ? ' first' : ''}"></div>`, iconSize:[0, 0]}), interactive:i === 0, keyboard:false}).addTo(verts);
      if (i === 0) m.on('click', e => { L.DomEvent.stopPropagation(e); finish(); });
    });
  };
  const finish = () => {
    if (pts.length < 3) { toast('Add at least three corners.', {error:true}); return; }
    const ring = pts.map(p => [+p.lng.toFixed(7), +p.lat.toFixed(7)]); ring.push(ring[0].slice());
    cancelMode();
    setSiteFromFC({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[ring]}}]});
  };
  const undo = () => { pts.pop(); redraw(); };
  const onClick = e => { pts.push(e.latlng); redraw(); };
  const onMove = e => { cursor = e.latlng; if (pts.length) shape.setLatLngs(pts.concat([cursor])); };
  const onKey = e => { if (e.key === 'Enter') finish(); else if (e.key === 'Backspace' && document.activeElement === document.body) { e.preventDefault(); undo(); } };
  map.on('click', onClick); map.on('mousemove', onMove); document.addEventListener('keydown', onKey);
  map.doubleClickZoom.disable();
  mode = {type:'draw', cleanup:() => { map.off('click', onClick); map.off('mousemove', onMove); document.removeEventListener('keydown', onKey); map.removeLayer(group); }};
  showHint('Click the map to add corners. Click the first corner or press Finish to close the boundary.', [['Undo', undo], ['Finish', finish], ['Cancel', cancelMode]]);
}

/* ---------- Layers ---------- */
function applyLayers(){
  const L_ = doc.layers, cls = document.body.classList;
  cls.toggle('hide-sitelabel', !L_.siteLabel);
  cls.toggle('hide-ringlabels', !L_.ringLabels);
  cls.toggle('hide-pois', !L_.pois);
  cls.toggle('hide-dist', !L_.distances);
  cls.toggle('hide-leaders', !L_.leaders);
  cls.toggle('hide-north', !L_.north);
  cls.toggle('hide-scale', !L_.scale);
  cls.toggle('hide-logo', !L_.logo);
  Roads.setVisible(L_.roadLines, L_.roadLabels);
  renderLayerToggles();
}
function renderLayerToggles(){
  ['site', 'places', 'roads', 'chrome'].forEach(g => {
    const el = $('#layers' + {site:'Site', places:'Places', roads:'Roads', chrome:'Chrome'}[g]);
    el.innerHTML = LAYERS.filter(l => l[0] === g).map(([, k, label, hint]) =>
      `<label class="toggle"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" data-layer="${k}"${doc.layers[k] ? ' checked' : ''}></label>`).join('');
  });
}
function renderRoadStatus(s){
  const el = $('#roadStatus'); if (!el) return;
  const info = Roads.info();
  let msg;
  if (s.manifest === 'missing') msg = 'Road data was not found in app/roads. Run tools/build_roads.py to build it.';
  else if (s.manifest !== 'ready') msg = 'Loading road data…';
  else if (s.zoom < s.minZoom) msg = 'Zoom in closer to load road names.';
  else msg = `${s.loaded} area${s.loaded === 1 ? '' : 's'} loaded${s.loading ? `, ${s.loading} loading…` : ''}.`;
  el.innerHTML = `<span class="ms" style="color:var(--forest)">route</span><span>${msg}${info ? `<br><small>Oregon public roads, built ${info.built}</small>` : ''}</span>`;
}

/* ---------- Basemap picker ---------- */
function renderBasemapPicker(){
  const groups = [...new Set(B.LIST.map(b => b.group))];
  $('#bmList').innerHTML = groups.map(g => `<h3>${g}</h3><div class="bm-grid">` +
    B.LIST.filter(b => b.group === g).map(b => `<button class="bm${b.id === doc.basemap ? ' on' : ''}" data-bm="${b.id}"><i style="background:${b.swatch}"></i>${b.name}</button>`).join('') +
    '</div>').join('');
}

/* ---------- Fit ---------- */
function fitAll(){
  const pts = [];
  const a = siteAnchor(); if (a) pts.push(a);
  if (doc.site.geojson) { const b = L.geoJSON(doc.site.geojson).getBounds(); pts.push(b.getSouthWest(), b.getNorthEast()); }
  doc.pois.filter(p => !p.hidden).forEach(p => pts.push(p.ll));
  if (!pts.length) { map.fitBounds(OREGON); return; }
  if (pts.length === 1 || (doc.pois.length === 0 && !doc.site.geojson)) { map.setView(pts[0], 16); return; }
  const b = L.latLngBounds(pts);
  if (doc.layers.rings && a && doc.rings.miles.length) {
    const r = Math.max(...doc.rings.miles) * G.MI;
    b.extend(L.latLng(a).toBounds(r * 2));
  }
  map.fitBounds(b, {padding:[60, 120], maxZoom:17});
}

/* ================= Documents ================= */
function updateSaveState(){
  const el = $('#saveState');
  el.textContent = dirty ? 'Unsaved changes' : doc.demo ? 'Demo map' : (fileHandle ? 'Saved · ' + fileHandle.name : 'Saved');
  el.classList.toggle('dirty', dirty);
  document.title = (dirty ? '• ' : '') + doc.name + ' | Project Mapping Tool';
}
let workTimer = null;
function touch(){
  dirty = true; doc.modified = new Date().toISOString();
  updateSaveState();
  clearTimeout(workTimer);
  workTimer = setTimeout(saveWorking, 400);
}
function currentView(){ const c = map.getCenter(); return {center:[+c.lat.toFixed(6), +c.lng.toFixed(6)], zoom:map.getZoom()}; }
function saveWorking(){ store.set(LS_WORK, {doc:{...doc, view:currentView()}, dirty}); }

function library(){ return store.get(LS_LIB, {}); }
async function saveDoc(){
  delete doc.demo;
  doc.view = currentView(); doc.modified = new Date().toISOString();
  const lib = library(); lib[doc.id] = clone(doc);
  const ok = store.set(LS_LIB, lib);
  if (fileHandle) { try { await writeHandle(fileHandle); } catch (e) { toast('Could not write ' + fileHandle.name + '. Use Save to file.', {error:true}); return; } }
  if (!ok && !fileHandle) { toast('This browser\'s storage is full or blocked. Use Save to file instead.', {error:true}); return; }
  dirty = false; updateSaveState(); saveWorking(); renderMapList();
  toast('Saved “' + doc.name + '”' + (fileHandle ? ' to ' + fileHandle.name : ''));
}
function fileText(){ return JSON.stringify({...doc, view:currentView()}, null, 1); }
function safeName(){ return (doc.name || 'map').replace(/[\\/:*?"<>|]+/g, '').trim() || 'map'; }
async function writeHandle(h){ const w = await h.createWritable(); await w.write(fileText()); await w.close(); }
async function saveFile(){
  doc.view = currentView();
  if (window.showSaveFilePicker) {
    try {
      const h = await showSaveFilePicker({suggestedName: safeName() + '.pmap.json', types:[{description:'Project map', accept:{'application/json':['.json']}}]});
      await writeHandle(h); fileHandle = h;
      const lib = library(); lib[doc.id] = clone(doc); store.set(LS_LIB, lib);
      dirty = false; updateSaveState(); saveWorking(); renderMapList();
      toast('Saved to ' + h.name); return;
    } catch (e) { if (e.name === 'AbortError') return; console.warn(e); }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([fileText()], {type:'application/json'}));
  a.download = safeName() + '.pmap.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Downloaded ' + a.download);
}

/* PNG export: everything on the map except the zoom buttons and toolbar, at twice screen resolution */
async function exportPng(){
  cancelMode();
  const name = safeName() + '.png', btn = $('#tbExport');
  let handle = null;
  // Ask where to save first, while the click still counts as the user's action
  if (window.showSaveFilePicker) {
    try { handle = await showSaveFilePicker({suggestedName:name, types:[{description:'PNG image', accept:{'image/png':['.png']}}]}); }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  btn.disabled = true;
  try {
    if (document.fonts) await document.fonts.ready;
    const {canvas, skipped} = PMTExport.render($('#stage'), Math.max(2, window.devicePixelRatio || 1));
    const blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('No image data')), 'image/png'));
    if (handle) { const w = await handle.createWritable(); await w.write(blob); await w.close(); }
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    toast((handle ? 'Saved ' + handle.name : 'Downloaded ' + name) +
      (skipped.length ? '. The logo was left out: it can only be included from the single-file version of the tool.' : ''));
  } catch (e) {
    console.error(e);
    toast('Could not export the image. Try again once the map has finished loading.', {error:true});
  } finally { btn.disabled = false; }
}

async function confirmDiscard(){
  if (!dirty) return true;
  const r = await ask('Save changes?', `“${doc.name}” has unsaved changes.`, [['cancel', 'Cancel', 'ghost'], ['discard', 'Don\'t save', ''], ['save', 'Save', 'primary']]);
  if (r === 'save') { await saveDoc(); return true; }
  return r === 'discard';
}
function loadDoc(d, opts = {}){
  cancelMode(); closePoiForm();
  doc = normalize(clone(d));
  dirty = !!opts.dirty; fileHandle = opts.handle || null;
  $('#mapName').value = doc.name;
  renderSiteForm(); renderCalloutStyle(); applyLayers(); setBasemap(doc.basemap);
  renderSite(); renderPois(); renderPoiList(); renderMapList();
  if (doc.view && doc.view.center) map.setView(doc.view.center, doc.view.zoom); else fitAll();
  updateSaveState(); saveWorking();
}
async function openFile(file, handle){
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'pmt-project-map') throw new Error('not a map');
    if (!(await confirmDiscard())) return;
    // Opening a file someone else saved: keep its id unless it would overwrite a different map here
    loadDoc(d, {handle});
    toast('Opened ' + file.name);
  } catch (e) {
    toast('“' + file.name + '” is not a saved project map. To add its features, use Load file on the Site or Places tab.', {error:true});
  }
}

function renderMapList(){
  const lib = Object.values(library()).sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
  $('#mapList').innerHTML = lib.length ? lib.map(m => `
    <div class="item${m.id === doc.id ? ' current' : ''}" data-map="${m.id}">
      <div class="badge"><span class="ms">map</span></div>
      <div class="t"><b>${esc(m.name)}</b><small>${new Date(m.modified).toLocaleString([], {dateStyle:'medium', timeStyle:'short'})} · ${(m.pois || []).length} places</small></div>
      <button class="iconbtn" data-act="copy" title="Duplicate"><span class="ms">content_copy</span></button>
      <button class="iconbtn" data-act="file" title="Save to file"><span class="ms">download</span></button>
      <button class="iconbtn" data-act="del" title="Delete"><span class="ms">delete</span></button>
    </div>`).join('') : '<div class="empty">No saved maps yet.</div>';
}
function renderDemoList(){
  $('#demoList').innerHTML = I.EXAMPLES.map((m, i) => `
    <div class="item" data-demo="${i}">
      <div class="badge"><span class="ms">auto_awesome</span></div>
      <div class="t"><b>${esc(m.name)}</b><small>${esc(m.site.sub)} · ${m.pois.length} places</small></div>
    </div>`).join('');
}
function demoDoc(i){
  const now = new Date().toISOString();
  return {...clone(I.EXAMPLES[i]), id:uid(), created:now, modified:now, demo:true};
}

/* ================= UI helpers ================= */
let toastTimer;
function toast(msg, o = {}){
  const el = $('#toast');
  el.innerHTML = esc(msg) + (o.action ? ` <button class="btn" style="margin-left:10px;padding:2px 8px;background:transparent;color:#fff;border-color:#98C8B0">${esc(o.action)}</button>` : '');
  el.classList.toggle('err', !!o.error);
  el.style.pointerEvents = o.action ? 'auto' : 'none';
  if (o.action) el.querySelector('button').onclick = () => { el.classList.remove('on'); o.fn(); };
  el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), o.action ? 7000 : o.error ? 6000 : 3000);
}
function ask(title, text, buttons){
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="box"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row">${buttons.map(([v, l, c]) => `<button class="btn ${c}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
    m.onclick = e => { const b = e.target.closest('[data-v]'); if (b || e.target === m) { m.remove(); res(b ? b.dataset.v : 'cancel'); } };
    document.body.appendChild(m);
    m.querySelector('.btn.primary, .btn.danger, .btn').focus();
  });
}
function showTab(t){
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  if (document.body.classList.contains('panel-hidden')) togglePanel(true);
}
function togglePanel(show){
  document.body.classList.toggle('panel-hidden', show === undefined ? undefined : !show);
  $('#tbPanel .ms').textContent = document.body.classList.contains('panel-hidden') ? 'left_panel_open' : 'left_panel_close';
  map.invalidateSize();
}
function readFile(input, cb){
  input.onchange = async () => { const f = input.files[0]; input.value = ''; if (f) cb(f, await f.text()); };
  input.click();
}

/* ================= Wire up ================= */
document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); };

// Map name + save
$('#mapName').addEventListener('input', e => { doc.name = e.target.value || 'Untitled map'; touch(); });
$('#btnSave').onclick = saveDoc;
$('#btnSaveFile').onclick = saveFile;
$('#btnNew').onclick = async () => { if (await confirmDiscard()) { loadDoc(blankDoc()); map.fitBounds(OREGON); showTab('site'); } };

// Site
$('#siteName').addEventListener('input', e => { doc.site.name = e.target.value; renderSite(); touch(); });
$('#siteSub').addEventListener('input', e => { doc.site.sub = e.target.value; renderSite(); touch(); });
$('#siteDraw').onclick = drawBoundary;
$('#sitePoint').onclick = () => pickPoint('Click the map to place the project site.', ll => {
  setSiteFromFC({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type:'Point', coordinates:[ll[1], ll[0]]}}]});
});
$('#siteLoad').onclick = () => readFile($('#fileSite'), (f, text) => {
  try { const r = G.parseAny(text, f.name); if (r.places) throw new Error('This file is a list of places. Import it on the Places tab.'); setSiteFromFC(r); toast('Loaded site from ' + f.name); }
  catch (e) { toast(e.message, {error:true}); }
});
$('#sitePasteBtn').onclick = () => { $('#sitePaste').hidden = !$('#sitePaste').hidden; $('#siteCoords').focus(); };
$('#siteCoordsCancel').onclick = () => { $('#sitePaste').hidden = true; };
$('#siteCoordsApply').onclick = () => {
  try { setSiteFromFC(G.parseCoordsText($('#siteCoords').value)); $('#sitePaste').hidden = true; $('#siteCoords').value = ''; }
  catch (e) { toast(e.message, {error:true}); }
};
$('#siteClear').onclick = async () => {
  if (await ask('Remove the site?', 'The boundary and site label position will be removed. Places stay on the map.', [['cancel', 'Cancel', 'ghost'], ['ok', 'Remove', 'primary']]) !== 'ok') return;
  doc.site.geojson = null; doc.site.point = null; doc.rings.pos = {};
  renderSite(); renderPois(); renderPoiList(); touch();
};
wireSearch($('#siteSearch'), $('#siteSearchBtn'), $('#siteResults'), r => {
  setSiteFromFC({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type:'Point', coordinates:[r.ll[1], r.ll[0]]}}]});
  map.setView(r.ll, 17);
  toast('Site placed. Use Draw to trace the parcel boundary if you need it highlighted.');
});
$('#siteFill').onclick = e => { const b = e.target.closest('[data-fill]'); if (!b) return; doc.site.fill = b.dataset.fill; renderSiteForm(); renderSite(); touch(); };
$('#siteOpacity').addEventListener('input', e => { doc.site.opacity = +e.target.value; renderSite(); touch(); });
$('#ringMiles').addEventListener('change', e => {
  doc.rings.miles = (e.target.value.match(/\d*\.?\d+/g) || []).map(Number).filter(n => n > 0 && n <= 50).sort((a, b) => a - b);
  doc.rings.pos = {}; e.target.value = doc.rings.miles.join(', ');
  renderRings(); touch();
});

// Places
$('#poiAdd').onclick = () => openPoiForm(null);
$('#poiCancel').onclick = closePoiForm;
$('#poiSave').onclick = savePoiForm;
$('#poiForm').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'search') savePoiForm(); });
$('#poiName').addEventListener('input', () => {
  if (iconTouched) return;
  iconPick = I.guess($('#poiName').value + ' ' + $('#poiSub').value); renderIconGrid();
});
$('#poiPick').onclick = () => pickPoint('Click the map where this place is.', ll => { $('#poiLL').value = ll.join(', '); });
$('#poiStyle').onclick = e => { const b = e.target.closest('[data-style]'); if (!b) return; stylePick = b.dataset.style; renderStylePick(); };
$('#calloutStyle').onclick = e => {
  const b = e.target.closest('[data-style]'); if (!b) return;
  doc.calloutStyle = b.dataset.style;
  renderCalloutStyle(); if (!$('#poiForm').hidden) renderStylePick();
  renderPois(); renderPoiList(); touch();
};
$('#iconGrid').onclick = e => { const b = e.target.closest('[data-icon]'); if (!b) return; iconPick = b.dataset.icon; iconTouched = true; renderIconGrid(); };
wireSearch($('#poiSearch'), $('#poiSearchBtn'), $('#poiResults'), r => {
  $('#poiLL').value = r.ll.join(', ');
  if (!$('#poiName').value) $('#poiName').value = r.name;
  if (!$('#poiSub').value) $('#poiSub').value = r.sub;
  if (!iconTouched) { iconPick = I.guess(r.name + ' ' + r.sub); renderIconGrid(); }
  map.panTo(r.ll);
});
$('#poiLoad').onclick = () => readFile($('#filePoi'), (f, text) => {
  try {
    const r = G.parseAny(text, f.name);
    const n = addPlaces(r.places || placesFromFC(r));
    if (!n) throw new Error('No places with coordinates were found in ' + f.name + '.');
    fitAll(); toast(`Added ${n} place${n === 1 ? '' : 's'} from ${f.name}`);
  } catch (e) { toast(e.message, {error:true}); }
});
$('#poiPasteBtn').onclick = () => { $('#poiPaste').hidden = !$('#poiPaste').hidden; $('#poiForm').hidden = true; $('#poiText').focus(); };
$('#poiPasteCancel').onclick = () => { $('#poiPaste').hidden = true; };
$('#poiPasteApply').onclick = () => {
  const n = addPlaces(G.parsePlacesText($('#poiText').value));
  if (!n) { toast('No places found. Use one per line: name, latitude, longitude, subtitle', {error:true}); return; }
  $('#poiPaste').hidden = true; $('#poiText').value = ''; fitAll();
  toast(`Added ${n} place${n === 1 ? '' : 's'}`);
};
$('#poiList').onclick = e => {
  const row = e.target.closest('[data-id]'); if (!row) return;
  const i = doc.pois.findIndex(p => p.id === row.dataset.id), p = doc.pois[i];
  const act = e.target.closest('[data-act]');
  if (!act) { map.panTo(p.ll); return; }
  if (act.dataset.act === 'vis') { p.hidden = !p.hidden; renderPois(); renderPoiList(); touch(); }
  if (act.dataset.act === 'edit') openPoiForm(p);
  if (act.dataset.act === 'del') {
    doc.pois.splice(i, 1); renderPois(); renderPoiList(); touch();
    toast('Deleted ' + (p.name || 'place'), {action:'Undo', fn:() => { doc.pois.splice(i, 0, p); renderPois(); renderPoiList(); touch(); }});
  }
};

// Basemap
$('#bmList').onclick = e => { const b = e.target.closest('[data-bm]'); if (b && b.dataset.bm !== doc.basemap) setBasemap(b.dataset.bm, true); };
$('#shade').addEventListener('input', e => { doc.shade = +e.target.value; applyShade(); touch(); });

// Layers
$('#tab-layers').addEventListener('change', e => {
  const k = e.target.dataset.layer; if (!k) return;
  doc.layers[k] = e.target.checked;
  applyLayers();
  if (k === 'boundary' || k === 'rings') renderSite();
  touch();
});

// Maps
$('#mapOpenFile').onclick = async () => {
  if (window.showOpenFilePicker) {
    try { const [h] = await showOpenFilePicker({types:[{description:'Project map', accept:{'application/json':['.json']}}]}); openFile(await h.getFile(), h); }
    catch (e) { if (e.name !== 'AbortError') toast(e.message, {error:true}); }
    return;
  }
  readFile($('#fileMap'), f => openFile(f));
};
$('#demoList').onclick = async e => {
  const row = e.target.closest('[data-demo]'); if (!row) return;
  if (!(await confirmDiscard())) return;
  loadDoc(demoDoc(+row.dataset.demo));
  fitAll(); showTab('places');
};
$('#mapList').onclick = async e => {
  const row = e.target.closest('[data-map]'); if (!row) return;
  const lib = library(), m = lib[row.dataset.map], act = e.target.closest('[data-act]');
  if (!act) {
    if (m.id === doc.id) return;
    if (await confirmDiscard()) { loadDoc(m); toast('Opened “' + m.name + '”'); }
    return;
  }
  if (act.dataset.act === 'copy') {
    const c = {...clone(m), id:uid(), name:m.name + ' (copy)', modified:new Date().toISOString()};
    lib[c.id] = c; store.set(LS_LIB, lib); renderMapList(); toast('Duplicated “' + m.name + '”');
  }
  if (act.dataset.act === 'file') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(m, null, 1)], {type:'application/json'}));
    a.download = (m.name || 'map').replace(/[\\/:*?"<>|]+/g, '') + '.pmap.json'; a.click();
  }
  if (act.dataset.act === 'del') {
    if (await ask('Delete this map?', `“${m.name}” will be removed from this browser. Files you saved are not affected.`, [['cancel', 'Cancel', 'ghost'], ['ok', 'Delete', 'primary']]) !== 'ok') return;
    delete lib[m.id]; store.set(LS_LIB, lib);
    if (m.id === doc.id) { dirty = true; updateSaveState(); }
    renderMapList();
  }
};

// Toolbar
$('#tbFit').onclick = fitAll;
$('#tbExport').onclick = exportPng;
$('#tbClean').onclick = () => { cancelMode(); document.body.classList.add('clean'); map.invalidateSize(); toast('Clean view: press Esc to bring the controls back.'); };
$('#tbPanel').onclick = () => togglePanel();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.body.classList.contains('clean')) { document.body.classList.remove('clean'); map.invalidateSize(); }
    cancelMode();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveDoc(); }
});
window.addEventListener('beforeunload', () => saveWorking());

/* ================= Start ================= */
const work = store.get(LS_WORK, null);
renderDemoList();
if (work && work.doc) loadDoc(work.doc, {dirty: work.dirty});
else loadDoc(demoDoc(0));   // first visit: open a demo map
})();

/* Oregon public roads — loaded tile by tile for the area on screen.
   Tiles are built by tools/build_roads.py from All_Public_Roads.geojson.
   Each tile is a <script> that calls PMTRoads.tile(key, data), which works from file://. */
(function(){
const BASE = 'app/roads/';
const MIN_ZOOM = 11;          // below this, no tiles are loaded
const MAX_TILES = 48;         // loaded tiles kept in memory
const LABEL_SIZE = [12, 11, 10];
const SPACING = 480, H = 16;

// Line styles by tier: state highway, major road, local street, ramp
const STYLE_DARK = [
  {color:'#FFFFFF', weight:4,   opacity:.9},
  {color:'#D6EAE0', weight:2.5, opacity:.85},
  {color:'#98C8B0', weight:1.2, opacity:.7},
  {color:'#98C8B0', weight:1,   opacity:.6}
];
// Street-style basemaps draw their own roads, so ours are invisible but still show the name on hover
const STYLE_LIGHT = [0,1,2,3].map(i => ({color:'#1F553C', weight:6 - i, opacity:0}));

let map, manifest = null, manifestState = 'idle', embedded = null;
let tone = 'dark', linesOn = true, labelsOn = true, onStatus = () => {};
const tiles = new Map();      // key -> {state, layer, chains, used, script}
let renderer, labelBox, measureCtx;
const widthCache = {};

function status(){
  const loaded = [...tiles.values()].filter(t => t.state === 'ready').length;
  const loading = [...tiles.values()].filter(t => t.state === 'loading').length;
  onStatus({manifest: manifestState, loaded, loading, zoom: map ? map.getZoom() : 0, minZoom: MIN_ZOOM});
}

function loadScript(src, onerror){
  const s = document.createElement('script');
  s.src = src; s.async = true; s.onerror = onerror;
  document.head.appendChild(s);
  return s;
}

function init(m, opts){
  map = m; onStatus = opts.onStatus || onStatus;
  renderer = L.canvas({padding:.5, tolerance:4});
  map.createPane('roadLabels').style.zIndex = 450;           // above roads, below callouts
  labelBox = L.DomUtil.create('div', '', map.getPane('roadLabels'));
  measureCtx = document.createElement('canvas').getContext('2d');
  manifestState = 'loading';
  // Single-file build: road tiles are embedded in the page as gzipped base64 (see tools/build_single.py)
  const emb = document.getElementById('pmt-roads');
  if (emb) {
    embedded = JSON.parse(emb.textContent);
    emb.remove();
    window.PMTRoads.manifest(embedded.manifest);
  } else loadScript(BASE + 'manifest.js', () => { manifestState = 'missing'; status(); });
  map.on('moveend zoomend resize', refresh);
  map.on('zoomstart', () => { labelBox.innerHTML = ''; });
  document.fonts && document.fonts.ready.then(drawLabels);
}

function neededKeys(){
  const b = map.getBounds(), c = manifest.cell, keys = [];
  const x0 = Math.floor((b.getWest() + 180) / c) - 1, x1 = Math.floor((b.getEast() + 180) / c) + 1;
  const y0 = Math.floor((b.getSouth() + 90) / c) - 1, y1 = Math.floor((b.getNorth() + 90) / c) + 1;
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 120) return [];          // too far out
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const k = x + '_' + y; if (manifest.tiles[k]) keys.push(k);
  }
  return keys;
}

function refresh(){
  if (!map) return;
  if (manifest && (linesOn || labelsOn) && map.getZoom() >= MIN_ZOOM) {
    const need = neededKeys(), now = Date.now();
    need.forEach(k => {
      const t = tiles.get(k);
      if (t) { t.used = now; return; }
      if (embedded) { tiles.set(k, {state:'loading', used:now}); unpack(k); return; }
      tiles.set(k, {state:'loading', used:now, script: loadScript(BASE + 'tiles/' + k + '.js', () => {
        const tt = tiles.get(k); if (tt) tt.state = 'error'; status();
      })});
    });
    // Drop the least recently used tiles once there are too many
    if (tiles.size > MAX_TILES) {
      const keep = new Set(need);
      [...tiles.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1].used - b[1].used)
        .slice(0, tiles.size - MAX_TILES).forEach(([k, t]) => unload(k, t));
    }
  }
  syncLines();
  drawLabels();
  status();
}

async function unpack(k){
  try {
    const bin = Uint8Array.from(atob(embedded.tiles[k]), c => c.charCodeAt(0));
    const text = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    if (tiles.has(k)) tile(k, JSON.parse(text));        // skip if it was unloaded meanwhile
  } catch (e) {
    console.error('Road tile ' + k + ' failed to unpack', e);
    const t = tiles.get(k); if (t) t.state = 'error'; status();
  }
}

function unload(k, t){
  if (t.layer) map.removeLayer(t.layer);
  if (t.script) t.script.remove();
  tiles.delete(k);
}

/* Called by each tile script */
function tile(key, data){
  const t = tiles.get(key) || {used: Date.now()};
  const S = (window.PMTRoads._scale) || 100000;
  const feats = data.f.map(([ni, oi, tier, c]) => {
    const ll = []; let x = 0, y = 0;
    for (let i = 0; i < c.length; i += 2) { x += c[i]; y += c[i+1]; ll.push(L.latLng(y / S, x / S)); }
    return {name: data.s[ni], owner: data.s[oi], tier, ll};
  });
  const layer = L.layerGroup();
  feats.forEach(f => {
    const pl = L.polyline(f.ll, {renderer, interactive:true, ...styleFor(f.tier)});
    pl._tier = f.tier;
    pl.bindTooltip(`<b>${esc(f.name)}</b><br>${esc(f.owner)}`, {sticky:true});
    layer.addLayer(pl);
  });
  t.layer = layer; t.chains = buildChains(feats); t.state = 'ready';
  tiles.set(key, t);
  syncLines(); drawLabels(); status();
}

function esc(s){ return String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function styleFor(tier){ return (tone === 'dark' ? STYLE_DARK : STYLE_LIGHT)[tier]; }

function syncLines(){
  const show = linesOn && map.getZoom() >= MIN_ZOOM;
  tiles.forEach(t => {
    if (!t.layer) return;
    const on = map.hasLayer(t.layer);
    if (show && !on) t.layer.addTo(map);
    if (!show && on) map.removeLayer(t.layer);
  });
}

// Join each road's segments end-to-end so labels can sit on longer stretches
function buildChains(feats){
  const groups = {};
  feats.forEach(f => {
    if (f.tier > 2) return;                                   // ramps get no label
    const g = groups[f.name] || (groups[f.name] = {text:f.name, tier:f.tier, parts:[]});
    g.tier = Math.min(g.tier, f.tier);
    g.parts.push(f.ll.slice());
  });
  const key = c => c.lat.toFixed(5) + ',' + c.lng.toFixed(5);
  const chains = [];
  Object.values(groups).forEach(g => {
    const parts = g.parts;
    while (parts.length) {
      let line = parts.pop(), grew = true;
      while (grew) {
        grew = false;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i], a = key(line[0]), b = key(line[line.length-1]), pa = key(p[0]), pb = key(p[p.length-1]);
          if (b === pa) line = line.concat(p.slice(1));
          else if (b === pb) line = line.concat(p.slice(0, -1).reverse());
          else if (a === pb) line = p.concat(line.slice(1));
          else if (a === pa) line = p.slice(1).reverse().concat(line);
          else continue;
          parts.splice(i, 1); grew = true; break;
        }
      }
      chains.push({text:g.text, tier:g.tier, ll:line, bounds:L.latLngBounds(line)});
    }
  });
  return chains;
}

function textWidth(t, size){
  const k = size + '|' + t;
  if (widthCache[k]) return widthCache[k];
  measureCtx.font = `700 ${size}px "Open Sans", Arial, sans-serif`;
  return (widthCache[k] = measureCtx.measureText(t).width + t.length * size * 0.12);
}

// Road name labels, re-placed on every pan/zoom so they never overlap
function drawLabels(){
  if (!labelBox) return;
  labelBox.innerHTML = '';
  const z = map.getZoom();
  if (!labelsOn || z < 12) return;
  const maxTier = z < 13 ? 0 : z < 14.5 ? 1 : 2;
  const vb = map.getBounds();
  const view = map.getPixelBounds(), origin = map.getPixelOrigin();
  const vx0 = view.min.x - origin.x, vy0 = view.min.y - origin.y, vx1 = view.max.x - origin.x, vy1 = view.max.y - origin.y;
  const placed = [], byName = {};
  const hits = b => placed.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  // Avoid placing names under the site label and callouts
  document.querySelectorAll('.callout, .site').forEach(el => {
    if (!el.offsetParent) return;
    const r = el.getBoundingClientRect(), mr = map.getContainer().getBoundingClientRect();
    const p0 = map.containerPointToLayerPoint([r.left - mr.left, r.top - mr.top]);
    placed.push({x0:p0.x - 4, y0:p0.y - 4, x1:p0.x + r.width + 4, y1:p0.y + r.height + 4});
  });

  const all = [];
  tiles.forEach(t => t.chains && t.chains.forEach(c => { if (c.tier <= maxTier && vb.intersects(c.bounds)) all.push(c); }));
  const chains = all.map(c => {
    const pts = c.ll.map(ll => map.latLngToLayerPoint(ll)), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + pts[i].distanceTo(pts[i-1]));
    return {...c, pts, cum, len: cum[cum.length-1]};
  }).sort((a, b) => a.tier - b.tier || b.len - a.len);
  const at = (c, d) => { let i = 1; while (i < c.cum.length-1 && c.cum[i] < d) i++;
    const s = (d - c.cum[i-1]) / ((c.cum[i] - c.cum[i-1]) || 1);
    return L.point(c.pts[i-1].x + (c.pts[i].x - c.pts[i-1].x)*s, c.pts[i-1].y + (c.pts[i].y - c.pts[i-1].y)*s); };
  const boxOf = (m, w, ang) => { const r = ang * Math.PI / 180,
    hx = Math.abs(Math.cos(r))*w/2 + Math.abs(Math.sin(r))*H/2, hy = Math.abs(Math.sin(r))*w/2 + Math.abs(Math.cos(r))*H/2;
    return {x0:m.x-hx, x1:m.x+hx, y0:m.y-hy, y1:m.y+hy}; };

  const frag = document.createDocumentFragment();
  chains.forEach(c => {
    const size = LABEL_SIZE[c.tier], w = textWidth(c.text, size) + 14;
    if (c.len < w) return;
    const ds = [];
    if (c.len < SPACING * 1.5) ds.push(c.len / 2);
    else for (let d = SPACING / 2; d <= c.len - w / 2; d += SPACING) ds.push(d);
    ds.forEach(d => {
      const s = d - w/2, e = d + w/2; if (s < 0 || e > c.len) return;
      const p1 = at(c, s), p2 = at(c, e), m = at(c, d);
      if (m.x < vx0 + 10 || m.x > vx1 - 10 || m.y < vy0 + 10 || m.y > vy1 - 10) return;
      // Skip curvy stretches where straight text would drift off the road
      const dx = p2.x - p1.x, dy = p2.y - p1.y, L2 = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < c.pts.length; i++) if (c.cum[i] > s && c.cum[i] < e &&
        Math.abs((c.pts[i].x - p1.x)*dy - (c.pts[i].y - p1.y)*dx) / L2 > 5) return;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI;
      if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const box = boxOf(m, w, ang);
      if (hits(box)) return;
      if ((byName[c.text] || []).some(q => q.distanceTo(m) < SPACING * 0.6)) return;
      placed.push(box); (byName[c.text] = byName[c.text] || []).push(m);
      const el = document.createElement('div');
      el.className = 'road-label t' + c.tier;
      el.textContent = c.text;
      el.style.left = m.x + 'px'; el.style.top = m.y + 'px';
      el.style.transform = `translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)`;
      frag.appendChild(el);
    });
  });
  labelBox.appendChild(frag);
}

function setTone(t){
  tone = t;
  tiles.forEach(tt => tt.layer && tt.layer.eachLayer(l => l.setStyle(styleFor(l._tier))));
}
function setVisible(lines, labels){ linesOn = lines; labelsOn = labels; refresh(); }

window.PMTRoads = {
  init, refresh, setTone, setVisible, drawLabels, tile,
  manifest(m){ manifest = m; window.PMTRoads._scale = m.scale; manifestState = 'ready'; refresh(); },
  info: () => manifest
};
})();

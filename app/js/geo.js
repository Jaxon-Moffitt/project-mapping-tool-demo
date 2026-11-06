/* Geometry helpers and importers.
   Everything is normalised to GeoJSON in WGS84 longitude/latitude.
   Accepts: GeoJSON, Esri JSON (ArcGIS FeatureSet / query results), a JSON array of
   {name, lat, lng}, CSV / tab-separated text, plain coordinate lists and WKT. */
(function(){

/* ---------- Projections common in Oregon GIS exports ---------- */
const PROJ = {
  3857:  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs',
  102100:'+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs',
  2992:  '+proj=lcc +lat_1=43 +lat_2=45.5 +lat_0=41.75 +lon_0=-120.5 +x_0=399999.9999984 +y_0=0 +ellps=GRS80 +units=ft +no_defs',   // Oregon Lambert (ft)
  2994:  '+proj=lcc +lat_1=43 +lat_2=45.5 +lat_0=41.75 +lon_0=-120.5 +x_0=399999.9999984 +y_0=0 +ellps=GRS80 +units=ft +no_defs',   // HARN Oregon Lambert (ft)
  2269:  '+proj=lcc +lat_1=46 +lat_2=44.33333333333334 +lat_0=43.66666666666666 +lon_0=-120.5 +x_0=2500000.0001424 +y_0=0 +ellps=GRS80 +units=ft +no_defs', // Oregon North (ft)
  2913:  '+proj=lcc +lat_1=46 +lat_2=44.33333333333334 +lat_0=43.66666666666666 +lon_0=-120.5 +x_0=2500000.0001424 +y_0=0 +ellps=GRS80 +units=ft +no_defs', // HARN Oregon North (ft)
  2270:  '+proj=lcc +lat_1=44 +lat_2=42.33333333333334 +lat_0=41.66666666666666 +lon_0=-120.5 +x_0=1500000.0001464 +y_0=0 +ellps=GRS80 +units=ft +no_defs', // Oregon South (ft)
  2914:  '+proj=lcc +lat_1=44 +lat_2=42.33333333333334 +lat_0=41.66666666666666 +lon_0=-120.5 +x_0=1500000.0001464 +y_0=0 +ellps=GRS80 +units=ft +no_defs', // HARN Oregon South (ft)
  2838:  '+proj=lcc +lat_1=46 +lat_2=44.33333333333334 +lat_0=43.66666666666666 +lon_0=-120.5 +x_0=2500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',  // HARN Oregon North (m)
  2839:  '+proj=lcc +lat_1=44 +lat_2=42.33333333333334 +lat_0=41.66666666666666 +lon_0=-120.5 +x_0=1500000 +y_0=0 +ellps=GRS80 +units=m +no_defs',  // HARN Oregon South (m)
  26910: '+proj=utm +zone=10 +ellps=GRS80 +units=m +no_defs',
  26911: '+proj=utm +zone=11 +ellps=GRS80 +units=m +no_defs',
  32610: '+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs',
  32611: '+proj=utm +zone=11 +datum=WGS84 +units=m +no_defs'
};
const WGS = [4326, 4269, 4152, 6318, 4258];

function wkidOf(x){
  if (x == null) return null;
  if (typeof x === 'number') return x;
  if (x.latestWkid && PROJ[x.latestWkid]) return x.latestWkid;
  if (x.wkid) return x.wkid;
  const m = String(x).match(/(\d{4,6})\s*$/) || String(x).match(/EPSG::?(\d+)/i);
  if (/CRS84/i.test(String(x))) return 4326;
  return m ? +m[1] : null;
}

function projector(wkid){
  if (!wkid || WGS.includes(wkid)) return null;
  if (!PROJ[wkid]) throw new Error(`The file uses coordinate system EPSG:${wkid}, which this tool can't convert. Re-export it as WGS84 (EPSG:4326).`);
  const p = proj4(PROJ[wkid], 'EPSG:4326');
  return c => p.forward([c[0], c[1]]);
}

function mapCoords(geom, fn){
  const walk = a => typeof a[0] === 'number' ? fn(a) : a.map(walk);
  if (geom.type === 'GeometryCollection') return {...geom, geometries: geom.geometries.map(g => mapCoords(g, fn))};
  return {...geom, coordinates: walk(geom.coordinates)};
}

function firstCoord(geom){
  let a = geom.type === 'GeometryCollection' ? geom.geometries[0].coordinates : geom.coordinates;
  while (Array.isArray(a) && typeof a[0] !== 'number') a = a[0];
  return a;
}

function looksProjected(fc){
  const f = fc.features.find(f => f.geometry);
  if (!f) return false;
  const c = firstCoord(f.geometry);
  return Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90;
}

/* Guess a projection from coordinate ranges when the file doesn't say */
function guessWkid(fc){
  const c = firstCoord(fc.features.find(f => f.geometry).geometry);
  const [x, y] = c;
  if (Math.abs(x) > 1e7 || (x < -1.2e7 && x > -1.5e7)) return 3857;              // web mercator (Oregon x ≈ -1.38e7)
  if (x > 300000 && x < 900000 && y > 4.6e6 && y < 5.2e6) return 26910;         // UTM 10N metres
  if (x > 0 && x < 2.6e6 && y > 0 && y < 1.6e6) return 2992;                    // Oregon Lambert feet
  return null;
}

function reproject(fc, wkid){
  if (!looksProjected(fc)) return fc;
  wkid = wkid && !WGS.includes(wkid) ? wkid : guessWkid(fc);
  const fn = projector(wkid);
  if (!fn) throw new Error('Coordinates are not latitude/longitude and the coordinate system could not be detected. Re-export as WGS84 (EPSG:4326).');
  fc.features.forEach(f => { if (f.geometry) f.geometry = mapCoords(f.geometry, c => fn(c).map(v => +v.toFixed(7))); });
  return fc;
}

/* Strip Z/M values and drop features without geometry */
function clean(fc){
  fc.features = fc.features.filter(f => f && f.geometry && f.geometry.coordinates !== undefined || (f && f.geometry && f.geometry.geometries));
  fc.features.forEach(f => { f.properties = f.properties || {}; f.geometry = mapCoords(f.geometry, c => [c[0], c[1]]); });
  return fc;
}

/* ---------- Esri JSON ---------- */
function ringIsClockwise(r){ let s = 0; for (let i = 0; i < r.length - 1; i++) s += (r[i+1][0] - r[i][0]) * (r[i+1][1] + r[i][1]); return s > 0; }
function esriGeom(g){
  if (!g) return null;
  if ('x' in g && 'y' in g) return {type:'Point', coordinates:[g.x, g.y]};
  if (g.points) return {type:'MultiPoint', coordinates:g.points};
  if (g.paths) return g.paths.length === 1 ? {type:'LineString', coordinates:g.paths[0]} : {type:'MultiLineString', coordinates:g.paths};
  if (g.rings) {
    // Esri: outer rings clockwise, holes counter-clockwise
    const polys = [];
    g.rings.forEach(r => { if (ringIsClockwise(r) || !polys.length) polys.push([r]); else polys[polys.length-1].push(r); });
    return polys.length === 1 ? {type:'Polygon', coordinates:polys[0]} : {type:'MultiPolygon', coordinates:polys};
  }
  return null;
}
function fromEsri(o){
  const feats = o.features || (o.geometry ? [o] : []);
  const sr = o.spatialReference || (feats[0] && feats[0].geometry && feats[0].geometry.spatialReference);
  const fc = {type:'FeatureCollection', features: feats.map(f => ({type:'Feature', properties: f.attributes || {}, geometry: esriGeom(f.geometry)}))};
  return reproject(clean(fc), wkidOf(sr));
}

/* ---------- GeoJSON ---------- */
const GEOM_TYPES = ['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'];
function fromGeoJSON(o){
  let fc;
  if (o.type === 'FeatureCollection') fc = {type:'FeatureCollection', features: o.features || []};
  else if (o.type === 'Feature') fc = {type:'FeatureCollection', features:[o]};
  else fc = {type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:o}]};
  const crs = o.crs && o.crs.properties && o.crs.properties.name;
  return reproject(clean(fc), wkidOf(crs));
}

/* ---------- Text: CSV, coordinate lists, WKT ---------- */
const NUM = /^\s*[-+]?\d+(\.\d+)?\s*$/;
function pairToLngLat(a, b){
  // "lat, lng" is the default; swap when the first value can't be a latitude
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) return [a, b];
  return [b, a];
}
function parseWKT(text){
  const m = text.match(/^\s*(MULTIPOLYGON|POLYGON|POINT|LINESTRING)\s*(Z|M|ZM)?\s*(\(.*\))\s*$/is);
  if (!m) return null;
  const type = {MULTIPOLYGON:'MultiPolygon', POLYGON:'Polygon', POINT:'Point', LINESTRING:'LineString'}[m[1].toUpperCase()];
  const json = m[3].replace(/(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?)(?:\s+(-?\d+(?:\.\d+)?(?:e[-+]?\d+)?))+/gi, s => '[' + s.trim().split(/\s+/).slice(0, 2).join(',') + ']')
    .replace(/\(/g, '[').replace(/\)/g, ']');
  let coords = JSON.parse(json);
  if (type === 'Point') coords = coords[0];
  return {type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry:{type, coordinates:coords}}]};
}

function splitRow(line){
  if (line.includes('\t')) return line.split('\t').map(s => s.trim());
  // comma split that respects "quoted, values"
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/* Rows of places. Accepts a header row (name, lat, lng/lon/long/longitude, subtitle, icon)
   or headerless rows like: Name, 45.48, -122.57, Subtitle, icon */
function parsePlacesText(text){
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const head = splitRow(lines[0]).map(h => h.toLowerCase());
  const latI = head.findIndex(h => /^(lat|latitude|y)$/.test(h)), lngI = head.findIndex(h => /^(lng|lon|long|longitude|x)$/.test(h));
  const out = [];
  if (latI >= 0 && lngI >= 0) {
    const col = re => head.findIndex(h => re.test(h));
    const nameI = col(/name|title|label|place/), subI = col(/sub|desc|address|addr|note|category|type/), iconI = col(/^icon$/);
    lines.slice(1).forEach(l => {
      const r = splitRow(l), lat = parseFloat(r[latI]), lng = parseFloat(r[lngI]);
      if (isFinite(lat) && isFinite(lng)) out.push({name: r[nameI] || '', sub: subI >= 0 ? r[subI] || '' : '', icon: iconI >= 0 ? r[iconI] : '', ll:[lat, lng]});
    });
    return out;
  }
  lines.forEach(l => {
    const r = splitRow(l);
    const i = r.findIndex((v, k) => NUM.test(v) && NUM.test(r[k+1] || ''));
    if (i < 0) return;
    const [lng, lat] = pairToLngLat(parseFloat(r[i]), parseFloat(r[i+1]));
    const before = r.slice(0, i).filter(Boolean), after = r.slice(i + 2).filter(Boolean);
    out.push({name: before.join(', '), sub: after[0] || '', icon: after[1] || '', ll:[lat, lng]});
  });
  return out;
}

/* A list of coordinates → Point (one pair) or Polygon (three or more) */
function parseCoordsText(text){
  const wkt = parseWKT(text);
  if (wkt) return reproject(wkt, null);
  const nums = (text.match(/[-+]?\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length < 2 || nums.length % 2) throw new Error('Enter coordinates as pairs, one per line, e.g. 45.4771, -122.5600');
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push(pairToLngLat(nums[i], nums[i+1]));
  let geometry;
  if (pts.length === 1) geometry = {type:'Point', coordinates:pts[0]};
  else if (pts.length >= 3) {
    const ring = pts.slice();
    const a = ring[0], b = ring[ring.length-1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push(a.slice());
    geometry = {type:'Polygon', coordinates:[ring]};
  } else throw new Error('Two points is not enough for a boundary. Enter one point or three or more corners.');
  return reproject({type:'FeatureCollection', features:[{type:'Feature', properties:{}, geometry}]}, null);
}

/* Any file or pasted text → FeatureCollection (or {places:[...]} for tabular data) */
function parseAny(text, filename){
  const t = text.trim().replace(/^﻿/, '');
  if (t.startsWith('{') || t.startsWith('[')) {
    let o;
    try { o = JSON.parse(t); } catch (e) { throw new Error('The file is not valid JSON: ' + e.message); }
    if (Array.isArray(o)) {
      // [{name, lat, lng}] or [[lat,lng], ...]
      if (o.length && typeof o[0] === 'object' && !Array.isArray(o[0])) {
        const k = obj => key => Object.keys(obj).find(x => key.test(x));
        return {places: o.map(r => {
          const f = k(r);
          const lat = parseFloat(r[f(/^(lat|latitude|y)$/i)]), lng = parseFloat(r[f(/^(lng|lon|long|longitude|x)$/i)]);
          return {name: r[f(/name|title|label/i)] || '', sub: r[f(/^(sub|subtitle|desc|description|address)$/i)] || '', icon: r.icon || '', ll:[lat, lng]};
        }).filter(p => isFinite(p.ll[0]) && isFinite(p.ll[1]))};
      }
      return parseCoordsText(t);
    }
    if (o.app === 'pmt-project-map') throw new Error('This is a saved map file. Open it from the Maps tab.');
    if (o.features && o.features.length && o.features[0].attributes !== undefined) return fromEsri(o);
    if (o.geometry && (o.geometry.rings || o.geometry.x !== undefined || o.geometry.paths)) return fromEsri(o);
    if (o.rings || o.paths || (o.x !== undefined && o.y !== undefined)) return fromEsri({features:[{attributes:{}, geometry:o}], spatialReference:o.spatialReference});
    if (o.type === 'FeatureCollection' || o.type === 'Feature' || GEOM_TYPES.includes(o.type)) return fromGeoJSON(o);
    throw new Error('Could not find any map features in this JSON.');
  }
  if (/\.(kml|kmz|shp|zip|gpkg)$/i.test(filename || '')) throw new Error('This file type isn\'t supported. Export it as GeoJSON (.geojson) or Esri JSON first.');
  const wkt = parseWKT(t);
  if (wkt) return wkt;
  const places = parsePlacesText(t);
  if (places.length && places.some(p => p.name)) return {places};
  return parseCoordsText(t);
}

/* ---------- Measurements ---------- */
const R = 6378137, MI = 1609.344;
function ringArea(r){            // m², spherical approximation (same as Leaflet.draw)
  let a = 0; const d = Math.PI / 180;
  for (let i = 0; i < r.length; i++) {
    const p1 = r[i], p2 = r[(i + 1) % r.length];
    a += (p2[0] - p1[0]) * d * (2 + Math.sin(p1[1] * d) + Math.sin(p2[1] * d));
  }
  return Math.abs(a * R * R / 2);
}
function polygons(geom){
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  if (geom.type === 'GeometryCollection') return geom.geometries.flatMap(polygons);
  return [];
}
function areaAcres(fc){
  let m2 = 0;
  fc.features.forEach(f => polygons(f.geometry).forEach(p => { m2 += ringArea(p[0]); p.slice(1).forEach(h => m2 -= ringArea(h)); }));
  return m2 / 4046.8564224;
}
/* Area-weighted centroid of all polygons, else the mean of all points: returns [lat, lng] */
function centroid(fc){
  let A = 0, X = 0, Y = 0;
  fc.features.forEach(f => polygons(f.geometry).forEach(p => {
    const r = p[0];
    for (let i = 0; i < r.length - 1; i++) {
      const c = r[i][0] * r[i+1][1] - r[i+1][0] * r[i][1];
      A += c; X += (r[i][0] + r[i+1][0]) * c; Y += (r[i][1] + r[i+1][1]) * c;
    }
  }));
  if (Math.abs(A) > 1e-14) return [Y / (3 * A), X / (3 * A)];
  const pts = [];
  fc.features.forEach(f => mapCoords(f.geometry, c => { pts.push(c); return c; }));
  if (!pts.length) return null;
  return [pts.reduce((s, c) => s + c[1], 0) / pts.length, pts.reduce((s, c) => s + c[0], 0) / pts.length];
}
function miles(a, b){
  const r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r;
  const h = Math.sin(dl/2)**2 + Math.cos(a[0]*r) * Math.cos(b[0]*r) * Math.sin(dn/2)**2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/* Pull a likely name / subtitle out of a feature's attributes */
function guessName(props){
  const keys = Object.keys(props || {});
  const pick = re => { const k = keys.find(k => re.test(k) && props[k] != null && String(props[k]).trim()); return k ? String(props[k]).trim() : ''; };
  return {
    name: pick(/^name$/i) || pick(/name|title|label|facility|place/i) || '',
    sub: pick(/^(sub|subtitle)$/i) || pick(/desc|address|addr|category|type|class/i) || '',
    icon: props && typeof props.icon === 'string' ? props.icon : ''
  };
}

window.PMTGeo = { parseAny, parseCoordsText, parsePlacesText, areaAcres, centroid, miles, polygons, guessName, MI };
})();

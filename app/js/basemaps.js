/* Basemaps — every one comes from ArcGIS (Esri). None of them need an API key.
   raster: Esri tile services stacked bottom to top
   vector: Esri vector basemap styles (drawn with MapLibre), optionally restyled to the Fernhollow palette
   tone:   'dark' or 'light' — picks road-label colors and which logo is shown
   labels: the basemap draws its own road names, so ours start switched off on it */
(function(){
const AGO = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const t = s => AGO + s + '/MapServer/tile/{z}/{y}/{x}';
const ESRI = 'Esri';
const IMAGERY_ATTR = 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const VECTOR_ATTR = 'Basemap © Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community';

const LIST = [
  // Fernhollow branded
  {id:'fern-light', group:'Fernhollow', name:'Fernhollow Light', kind:'vector', item:'63c47b7177f946b49902c24129b87252', brand:'light', tone:'light', swatch:'#D6EAE0'},
  {id:'fern-dark',  group:'Fernhollow', name:'Fernhollow Dark',  kind:'vector', item:'63c47b7177f946b49902c24129b87252', brand:'dark',  tone:'dark',  swatch:'#1F553C'},
  {id:'fern-imagery', group:'Fernhollow', name:'Fernhollow Imagery', kind:'raster', layers:[t('World_Imagery')], tone:'dark', shade:true, defaultShade:.18, attr:IMAGERY_ATTR, swatch:'#3C4A3A'},

  // Imagery
  {id:'imagery', group:'Imagery', name:'Imagery', kind:'raster', layers:[t('World_Imagery')], tone:'dark', shade:true, attr:IMAGERY_ATTR, swatch:'#4B5A40'},
  {id:'imagery-hybrid', group:'Imagery', name:'Imagery Hybrid', kind:'vector', item:'30d6b8271e1849cd9c3042060001f425', under:t('World_Imagery'), tone:'dark', shade:true, labels:true, attr:IMAGERY_ATTR, swatch:'#5B6A4E'},
  {id:'imagery-firefly', group:'Imagery', name:'Imagery Firefly', kind:'raster',
    layers:['https://fly.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Firefly/MapServer/tile/{z}/{y}/{x}'], tone:'dark', shade:true, attr:IMAGERY_ATTR, swatch:'#3F5E3A'},
  {id:'imagery-clarity', group:'Imagery', name:'Imagery Clarity', kind:'raster',
    layers:['https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tone:'dark', shade:true, attr:IMAGERY_ATTR, swatch:'#50603F'},

  // Esri vector basemaps
  {id:'v-streets', group:'Esri vector', name:'Streets', kind:'vector', item:'de26a3cf4cc9451298ea173c4b324736', tone:'light', labels:true, swatch:'#F2EFE9'},
  {id:'v-navigation', group:'Esri vector', name:'Navigation', kind:'vector', item:'63c47b7177f946b49902c24129b87252', tone:'light', labels:true, swatch:'#F4F1EA'},
  {id:'v-topo', group:'Esri vector', name:'Topographic', kind:'vector', item:'7dc6cea0b1764a1f9af2e679f642f0f5', tone:'light', labels:true, swatch:'#E9EBD7'},
  {id:'v-relief', group:'Esri vector', name:'Streets with Relief', kind:'vector', item:'b266e6d17fc345b498345613930fbd76', tone:'light', labels:true, swatch:'#E5E1D5'},
  {id:'v-lightgray', group:'Esri vector', name:'Light Gray Canvas', kind:'vector', item:'291da5eab3a0412593b66d384379f89f', tone:'light', labels:true, swatch:'#E8E8E8'},
  {id:'v-darkgray', group:'Esri vector', name:'Dark Gray Canvas', kind:'vector', item:'5e9b3685f4c24d8781073dd928ebda50', tone:'dark', labels:true, swatch:'#333'},
  {id:'v-night', group:'Esri vector', name:'Streets Night', kind:'vector', item:'86f556a2d1fd468181855a35e344567f', tone:'dark', labels:true, swatch:'#1D2733'},

  // Esri raster (tile) basemaps
  {id:'r-streets', group:'Esri raster', name:'World Street Map', kind:'raster', layers:[t('World_Street_Map')], tone:'light', labels:true, swatch:'#EFEBE2'},
  {id:'r-topo', group:'Esri raster', name:'World Topo Map', kind:'raster', layers:[t('World_Topo_Map')], tone:'light', labels:true, swatch:'#E3E6CF'},
  {id:'r-natgeo', group:'Esri raster', name:'National Geographic', kind:'raster', layers:[t('NatGeo_World_Map')], tone:'light', labels:true, swatch:'#E8DFC3'},
  {id:'r-lightgray', group:'Esri raster', name:'Light Gray', kind:'raster', layers:[t('Canvas/World_Light_Gray_Base'), t('Canvas/World_Light_Gray_Reference')], tone:'light', labels:true, swatch:'#DADADA'},
  {id:'r-darkgray', group:'Esri raster', name:'Dark Gray', kind:'raster', layers:[t('Canvas/World_Dark_Gray_Base'), t('Canvas/World_Dark_Gray_Reference')], tone:'dark', labels:true, swatch:'#444'},
  {id:'r-terrain', group:'Esri raster', name:'Terrain', kind:'raster', layers:[t('World_Terrain_Base'), t('Reference/World_Reference_Overlay')], tone:'light', max:13, swatch:'#D8D2B8'},
  {id:'r-relief', group:'Esri raster', name:'Shaded Relief', kind:'raster', layers:[t('World_Shaded_Relief')], tone:'light', max:13, swatch:'#C9C9C9'},
  {id:'r-hillshade', group:'Esri raster', name:'Hillshade', kind:'raster', layers:[t('Elevation/World_Hillshade')], tone:'light', max:16, swatch:'#BDBDBD'},
  {id:'r-hillshade-dark', group:'Esri raster', name:'Hillshade Dark', kind:'raster', layers:[t('Elevation/World_Hillshade_Dark')], tone:'dark', max:16, swatch:'#2B2B2B'},
  {id:'r-physical', group:'Esri raster', name:'Physical', kind:'raster', layers:[t('World_Physical_Map')], tone:'light', max:8, swatch:'#B7C9A6'},
  {id:'r-oceans', group:'Esri raster', name:'Oceans', kind:'raster', layers:[t('Ocean/World_Ocean_Base'), t('Ocean/World_Ocean_Reference')], tone:'light', max:13, swatch:'#A9C6DA'}
];

/* ---- Fernhollow restyle of the Esri Navigation map ---- */
const BRAND = {
  light: {
    land:'#F7FBF9', urban:'#F2F7F5', civic:'#EAF4EF', paved:'#E6EFEB', park:'#D6EAE0', water:'#98C8B0',
    building:'#DDDDDD', buildingLine:'#CFDBD6', rail:'#C9D6D0', boundary:'#98C8B0', trail:'#FFFFFF',
    road:{freeway:['#1F553C','#338960'], major:['#338960','#FFFFFF'], minor:['#98C8B0','#FFFFFF'], local:['#DDDDDD','#FFFFFF']},
    text:'#5E5E5E', waterText:'#338960', parkText:'#1F553C', halo:'#FFFFFF'
  },
  dark: {
    land:'#0D2218', urban:'#112B1E', civic:'#133022', paved:'#143224', park:'#153A28', water:'#1F553C',
    building:'#1A3D2C', buildingLine:'#224B37', rail:'#2B5842', boundary:'#338960', trail:'#2B5842',
    road:{freeway:['#0D2218','#98C8B0'], major:['#0D2218','#338960'], minor:['#0D2218','#2B694B'], local:['#0D2218','#1F553C']},
    text:'#98C8B0', waterText:'#98C8B0', parkText:'#D6EAE0', halo:'#0D2218'
  }
};

function brandStyle(style, B){
  const fillFor = sl =>
    /Water|Marine|Bathymetry/.test(sl) ? B.water :
    /forest|park|Park|Vegetation|Zoo|Golf|Cemetery|Beach|Openspace/.test(sl) ? B.park :
    /^Building/.test(sl) ? B.building :
    /Urban/.test(sl) ? B.urban :
    /Medical|Education|Emergency|Landmark|Government|Retail|Finance|Indigenous/.test(sl) ? B.civic :
    /Military|Airport|Pedestrian|Port|Transportation|Industry|Freight|wastewater|Special area/.test(sl) ? B.paved :
    B.land;
  const roadClass = id => /Freeway|Highway/.test(id) ? 'freeway' : /Major/.test(id) ? 'major' : /Minor/.test(id) ? 'minor' : 'local';
  // Business / point-of-interest icons are fixed-color images, so drop them; keep water, land and area names.
  // Esri's road names are dropped too: the tool draws its own from the Oregon public roads data.
  const POI = / place$/;
  style.layers = style.layers.filter(l => !(l.type === 'symbol' && (
    (POI.test(l['source-layer'] || '') && !/^(Water|Land) Feature place$/.test(l['source-layer'])) ||
    l['source-layer'] === 'Point of interest' || /^Road/.test(l['source-layer'] || ''))));
  style.layers.forEach(l => {
    const sl = l['source-layer'] || '', p = l.paint = l.paint || {};
    if (l.type === 'background') p['background-color'] = B.water;
    else if (l.type === 'fill') {
      delete p['fill-pattern'];
      p['fill-color'] = fillFor(sl);
      if (p['fill-outline-color']) p['fill-outline-color'] = /^Building/.test(sl) ? B.buildingLine : p['fill-color'];
    } else if (l.type === 'line') {
      if (/^Road/.test(sl)) { const c = B.road[roadClass(l.id)]; p['line-color'] = /\/1$/.test(l.id) ? c[0] : c[1]; }
      else if (/Water|Ferry/.test(sl)) p['line-color'] = B.water;
      else if (/Railroad/.test(sl)) p['line-color'] = B.rail;
      else if (/Boundary/.test(sl)) p['line-color'] = B.boundary;
      else if (/Trail|Special area/.test(sl)) p['line-color'] = B.trail;
      delete p['line-pattern'];
    } else if (l.type === 'symbol' && p['text-color'] !== undefined) {
      const white = typeof p['text-color'] === 'string' && /^#fff(fff)?$/i.test(p['text-color']);
      if (!white || B === BRAND.dark) {
        p['text-color'] = /Water|Marine/.test(sl) ? B.waterText : /forest|park|Park|Openspace/.test(sl) ? B.parkText : B.text;
        p['text-halo-color'] = B.halo;
      }
    }
  });
}

const styleCache = {};
async function loadStyle(def){
  const key = def.item + (def.brand || '') + (def.under || '');
  if (styleCache[key]) return styleCache[key];
  const url = `https://www.arcgis.com/sharing/rest/content/items/${def.item}/resources/styles/root.json?f=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Basemap style failed to load (' + res.status + ')');
  const style = await res.json();
  // Point each source straight at its tiles (the TileJSON lookups don't work for MapLibre)
  Object.values(style.sources).forEach(s => {
    if (!s.url) return;
    if (s.type === 'vector') { s.tiles = [s.url + '/tile/{z}/{y}/{x}.pbf']; s.maxzoom = s.maxzoom || 16; }
    else if (s.type === 'raster') { s.tiles = [s.url + '/tile/{z}/{y}/{x}']; s.tileSize = 256; }
    delete s.url;
  });
  if (def.brand) brandStyle(style, BRAND[def.brand]);
  if (def.under) {
    style.sources.under = {type:'raster', tiles:[def.under], tileSize:256, maxzoom:19};
    const bg = style.layers.findIndex(l => l.type !== 'background');
    style.layers.splice(Math.max(bg, 0), 0, {id:'under-raster', type:'raster', source:'under'});
  }
  return (styleCache[key] = style);
}

/* Build the Leaflet layer for a basemap. Returns a Promise<L.Layer>. */
async function makeLayer(def){
  if (def.kind === 'raster') {
    const g = L.layerGroup();
    def.layers.forEach((u, i) => L.tileLayer(u, {
      maxNativeZoom: def.max || 19, maxZoom: 21, crossOrigin: true,
      attribution: i === 0 ? (def.attr || 'Basemap © ' + ESRI + ' and its data providers') : ''
    }).addTo(g));
    return g;
  }
  const style = await loadStyle(def);
  // preserveDrawingBuffer keeps the drawn map readable for PNG export
  return L.maplibreGL({style, preserveDrawingBuffer:true, attribution: def.attr ? def.attr + ' | ' + VECTOR_ATTR : VECTOR_ATTR, interactive:false});
}

window.PMTBasemaps = { LIST, get: id => LIST.find(b => b.id === id) || LIST[0], makeLayer };
})();

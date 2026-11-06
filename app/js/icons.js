/* Callout icons (Material Symbols Rounded, bundled in app/fonts so they work offline).
   id = Material Symbols name, label = what the picker shows, k = words used to guess an icon from a place name. */
(function(){
const ICONS = [
  {id:'local_hospital', label:'Hospital', k:'hospital medical center emergency'},
  {id:'medical_services', label:'Clinic', k:'clinic medical urgent care doctor health annex'},
  {id:'local_pharmacy', label:'Pharmacy', k:'pharmacy drug rx walgreens cvs rite aid'},
  {id:'elderly', label:'Senior services', k:'senior elderly assisted retirement'},
  {id:'school', label:'School', k:'school elementary middle high academy'},
  {id:'account_balance', label:'University / civic', k:'university college campus city hall courthouse capitol government'},
  {id:'local_library', label:'Library', k:'library'},
  {id:'child_care', label:'Child care', k:'child care daycare preschool early learning'},
  {id:'park', label:'Park', k:'park'},
  {id:'forest', label:'Natural area', k:'forest natural area nature reserve wildlife woods'},
  {id:'hiking', label:'Trail', k:'trail path hike greenway'},
  {id:'directions_bike', label:'Bike route', k:'bike bicycle cycle'},
  {id:'waves', label:'River / water', k:'river creek lake water ferry landing boat slough'},
  {id:'pool', label:'Pool', k:'pool aquatic swim'},
  {id:'sports_soccer', label:'Sports field', k:'field sports soccer baseball ballfield complex'},
  {id:'fitness_center', label:'Fitness', k:'gym fitness ymca crossfit'},
  {id:'golf_course', label:'Golf', k:'golf'},
  {id:'stadium', label:'Stadium / arena', k:'stadium arena fairgrounds'},
  {id:'shopping_cart', label:'Grocery', k:'grocery market safeway fred meyer winco albertsons trader whole foods costco'},
  {id:'local_mall', label:'Shopping', k:'shop shopping mall shoppes plaza center outlet target walmart'},
  {id:'storefront', label:'Retail', k:'store retail'},
  {id:'restaurant', label:'Restaurant', k:'restaurant dining grill kitchen eatery'},
  {id:'local_cafe', label:'Coffee', k:'coffee cafe espresso starbucks dutch bros'},
  {id:'sports_bar', label:'Bar / brewery', k:'bar pub brewery brewing tavern taproom'},
  {id:'directions_bus', label:'Bus / transit', k:'bus transit station stop ltd trimet cherriots emx'},
  {id:'train', label:'Rail', k:'rail train amtrak max station'},
  {id:'flight', label:'Airport', k:'airport airfield'},
  {id:'local_parking', label:'Parking', k:'parking garage'},
  {id:'local_gas_station', label:'Gas station', k:'gas fuel station chevron shell'},
  {id:'ev_station', label:'EV charging', k:'ev charging charger'},
  {id:'work', label:'Employer', k:'employer headquarters hq jobs'},
  {id:'business', label:'Office', k:'office business tower'},
  {id:'factory', label:'Industrial', k:'industrial factory plant manufacturing warehouse'},
  {id:'apartment', label:'Apartments', k:'apartments apartment multifamily residences lofts'},
  {id:'home', label:'Housing', k:'housing homes home neighborhood subdivision'},
  {id:'hotel', label:'Hotel', k:'hotel inn motel lodge suites'},
  {id:'church', label:'Place of worship', k:'church chapel temple mosque synagogue parish'},
  {id:'museum', label:'Museum', k:'museum gallery'},
  {id:'theater_comedy', label:'Arts / theater', k:'theater theatre arts performing cinema'},
  {id:'local_police', label:'Police', k:'police sheriff'},
  {id:'local_fire_department', label:'Fire station', k:'fire'},
  {id:'local_post_office', label:'Post office', k:'post office usps'},
  {id:'local_atm', label:'Bank', k:'bank credit union atm'},
  {id:'pets', label:'Pets / vet', k:'vet veterinary pet animal dog'},
  {id:'agriculture', label:'Farm', k:'farm orchard vineyard winery agriculture'},
  {id:'landscape', label:'Landmark', k:'mountain butte landmark viewpoint'},
  {id:'star', label:'Highlight', k:''},
  {id:'flag', label:'Flag', k:''},
  {id:'location_on', label:'Place', k:''}
];
const DEFAULT = 'location_on';
const valid = id => ICONS.some(i => i.id === id);

/* Pick an icon from the words in a place's name / subtitle */
function guess(text){
  const words = String(text || '').toLowerCase();
  let best = null, score = 0;
  ICONS.forEach(i => i.k.split(' ').filter(Boolean).forEach(w => {
    const re = new RegExp('\\b' + w.replace(/[^a-z]/g, '') + '\\b');
    if (re.test(words) && w.length > score) { best = i.id; score = w.length; }
  }));
  return best || DEFAULT;
}

/* Demo maps: five fictional project sites around Oregon. Sites are made up; nearby places are real. */
const EXAMPLES = [
  {"app":"pmt-project-map","version":1,"name":"Foster Yards · Portland","basemap":"fern-light","shade":0.18,"calloutStyle":"pine","site":{"name":"Foster Yards","sub":"Mixed-use redevelopment","dx":-170,"dy":-60,"fill":"#338960","opacity":0.75,"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"demo":true},"geometry":{"type":"Polygon","coordinates":[[[-122.560037,45.477142],[-122.558243,45.477142],[-122.558243,45.476238],[-122.560037,45.476238],[-122.560037,45.477142]]]}}]}},"rings":{"miles":[0.25,0.5,1],"pos":{}},"pois":[{"name":"Lents Park","sub":"Community park","icon":"park","ll":[45.48738,-122.57046],"dx":-129,"dy":-64},{"name":"Lents Town Center/Foster Rd","sub":"MAX Green Line","icon":"train","ll":[45.4808,-122.57107],"dx":-175,"dy":-35},{"name":"Kelly Elementary","sub":"Portland Public Schools","icon":"school","ll":[45.47305,-122.57024],"dx":-176,"dy":34},{"name":"Springwater Corridor","sub":"Regional trail at SE 92nd","icon":"hiking","ll":[45.47086,-122.56862],"dx":-153,"dy":53},{"name":"Holgate Library","sub":"Multnomah County Library","icon":"local_library","ll":[45.49051,-122.58225],"dx":-180,"dy":-30},{"name":"Eastport Plaza","sub":"Shopping | Dining","icon":"local_mall","ll":[45.49158,-122.57654],"dx":130,"dy":-60},{"name":"Portland Mercado","sub":"Food carts and market","icon":"restaurant","ll":[45.48594,-122.58852],"dx":-177,"dy":-33}]},
  {"app":"pmt-project-map","version":1,"name":"Mill Creek Lofts · Salem","basemap":"fern-imagery","shade":0.18,"calloutStyle":"pine","site":{"name":"Mill Creek Lofts","sub":"Adaptive reuse site","dx":190,"dy":40,"fill":"#338960","opacity":0.75,"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"demo":true},"geometry":{"type":"Polygon","coordinates":[[[-123.026261,44.930907],[-123.024739,44.930907],[-123.024739,44.930093],[-123.026261,44.930093],[-123.026261,44.930907]]]}}]}},"rings":{"miles":[0.25,0.5],"pos":{}},"pois":[{"name":"Salem Hospital","sub":"Salem Health","icon":"local_hospital","ll":[44.93254,-123.03412],"dx":-210,"dy":45},{"name":"Willamette University","sub":"Campus","icon":"account_balance","ll":[44.93605,-123.03108],"dx":-127,"dy":-65},{"name":"Oregon State Capitol","sub":"Capitol Mall","icon":"account_balance","ll":[44.9385,-123.0303],"dx":-99,"dy":-74},{"name":"Salem Station","sub":"Amtrak Cascades","icon":"train","ll":[44.93233,-123.02833],"dx":-151,"dy":-54},{"name":"Bush's Pasture Park","sub":"City park","icon":"park","ll":[44.92731,-123.03675],"dx":-179,"dy":30},{"name":"Riverfront Park","sub":"Willamette River","icon":"waves","ll":[44.94273,-123.0423],"dx":-145,"dy":-57},{"name":"Salem Saturday Market","sub":"Seasonal farmers market","icon":"agriculture","ll":[44.94307,-123.02909],"dx":-70,"dy":-78}]},
  {"app":"pmt-project-map","version":1,"name":"Pine Nursery Commons · Bend","basemap":"fern-dark","shade":0.18,"calloutStyle":"forest","site":{"name":"Pine Nursery Commons","sub":"Workforce housing","dx":-170,"dy":-60,"fill":"#338960","opacity":0.75,"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"demo":true},"geometry":{"type":"Polygon","coordinates":[[[-121.267613,44.087287],[-121.265987,44.087287],[-121.265987,44.086473],[-121.267613,44.086473],[-121.267613,44.087287]]]}}]}},"rings":{"miles":[0.5,1],"pos":{}},"pois":[{"name":"Pine Nursery Park","sub":"Sports fields | Off-leash area","icon":"sports_soccer","ll":[44.09479,-121.26577],"dx":54,"dy":-80},{"name":"Mountain View High School","sub":"Bend-La Pine Schools","icon":"school","ll":[44.07721,-121.26623],"dx":46,"dy":80},{"name":"St. Charles Bend","sub":"Medical center","icon":"local_hospital","ll":[44.06738,-121.26894],"dx":-52,"dy":80},{"name":"Cascade Village","sub":"Shopping center","icon":"local_mall","ll":[44.10124,-121.3029],"dx":-171,"dy":-39},{"name":"Juniper Elementary","sub":"Bend-La Pine Schools","icon":"school","ll":[44.06387,-121.28847],"dx":-124,"dy":66}]},
  {"app":"pmt-project-map","version":1,"name":"Bear Creek Commons · Medford","basemap":"fern-light","shade":0.18,"calloutStyle":"night","site":{"name":"Bear Creek Commons","sub":"Downtown infill","dx":200,"dy":-50,"fill":"#338960","opacity":0.75,"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"demo":true},"geometry":{"type":"Polygon","coordinates":[[[-122.862518,42.327821],[-122.861302,42.327821],[-122.861302,42.327279],[-122.862518,42.327279],[-122.862518,42.327821]]]}}]}},"rings":{"miles":[0.25,0.5,1],"pos":{}},"pois":[{"name":"Hawthorne Park","sub":"City park | Pool","icon":"park","ll":[42.32959,-122.86812],"dx":70,"dy":95},{"name":"Medford Library","sub":"Jackson County Library","icon":"local_library","ll":[42.32478,-122.86986],"dx":-210,"dy":50},{"name":"Rogue Community College","sub":"Riverside Campus","icon":"account_balance","ll":[42.32605,-122.87009],"dx":-210,"dy":-15},{"name":"Vogel Plaza","sub":"Downtown plaza","icon":"storefront","ll":[42.32644,-122.87186],"dx":-210,"dy":-80},{"name":"Medford Center","sub":"Shopping | Cinema","icon":"local_mall","ll":[42.33198,-122.86854],"dx":-151,"dy":-54},{"name":"Bear Creek Park","sub":"Park | Bear Creek Greenway","icon":"hiking","ll":[42.32018,-122.85281],"dx":141,"dy":59},{"name":"Asante Rogue Regional","sub":"Medical center","icon":"local_hospital","ll":[42.31817,-122.83054],"dx":179,"dy":30}]},
  {"app":"pmt-project-map","version":1,"name":"Monroe Green · Corvallis","basemap":"fern-imagery","shade":0.18,"calloutStyle":"white","site":{"name":"Monroe Green","sub":"Townhome community","dx":-170,"dy":-60,"fill":"#338960","opacity":0.75,"geojson":{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"demo":true},"geometry":{"type":"Polygon","coordinates":[[[-123.261946,44.571747],[-123.26091,44.571548],[-123.261334,44.570413],[-123.26237,44.570612],[-123.261946,44.571747]]]}}]}},"rings":{"miles":[0.25,0.5],"pos":{}},"pois":[{"name":"Oregon State University","sub":"Campus","icon":"account_balance","ll":[44.55962,-123.27497],"dx":-136,"dy":62},{"name":"Central Park","sub":"City park","icon":"park","ll":[44.56524,-123.26496],"dx":-230,"dy":5},{"name":"Corvallis-Benton County Library","sub":"Main library","icon":"local_library","ll":[44.56568,-123.26441],"dx":-230,"dy":-70},{"name":"Downtown Transit Center","sub":"Corvallis Transit System","icon":"directions_bus","ll":[44.56488,-123.263],"dx":40,"dy":75},{"name":"Riverfront Park","sub":"Willamette River","icon":"waves","ll":[44.56318,-123.25899],"dx":75,"dy":78},{"name":"First Alternative Co-op","sub":"Grocery","icon":"shopping_cart","ll":[44.57898,-123.28239],"dx":-172,"dy":-38}]}
];

window.PMTIcons = { ICONS, DEFAULT, valid, guess, EXAMPLES };
})();

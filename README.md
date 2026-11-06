# Project Mapping Tool (demo)

A lightweight map maker for development project sites, branded here for **Fernhollow Development**, a fictional demo company.

**Try it:** https://jaxon-moffitt.github.io/project-mapping-tool-demo/

It runs entirely in the browser, with no install or server. You can also download the repo and double-click **`Project Mapping Tool.html`**. An internet connection is needed for the ArcGIS basemaps and address search.

## Demo maps

The **Maps** tab has five sample projects. The first one opens automatically on your first visit.

| Map | City | Basemap |
|---|---|---|
| Foster Yards | Portland | Fernhollow Light |
| Mill Creek Lofts | Salem | Fernhollow Imagery |
| Pine Nursery Commons | Bend | Fernhollow Dark |
| Bear Creek Commons | Medford | Fernhollow Light |
| Monroe Green | Corvallis | Fernhollow Imagery |

The project sites and their boundaries are made up. The schools, parks, hospitals and other places around them are real.

## Sharing it: one file

To hand the tool to someone, build the single-file version:

```
python tools/build_single.py
```

This writes **`dist/Project Mapping Tool.html`** (about 19 MB), with everything inside it: code, fonts, logos and the statewide road data. Email it, put it on a shared drive or on a desktop, and double-click it to run. Nothing else is needed.

Rebuild it after any change to the app or the road data. The project folder stays as the editable source.

## What it does

| | |
|---|---|
| **Site** | Draw the boundary, drop a point, load a GeoJSON / Esri JSON file, paste coordinates or WKT, or search an address. The site gets a highlight fill, a branded label callout, acreage, and distance rings. |
| **Places** | Add points of interest one at a time (with address search or by clicking the map), import a file, or paste a list. Each gets a draggable callout with an icon (49 to choose from, guessed from the name) and its distance from the site. |
| **Basemaps** | Fernhollow Light, Fernhollow Dark and Fernhollow Imagery (branded), plus ArcGIS imagery, vector and raster basemaps. |
| **Road names** | Labels from the Oregon public roads data, statewide. Tiles for the area on screen load as you zoom in (zoom 12+). |
| **Layers** | Toggle the boundary, labels, rings, callouts, distances, leader lines, road names/lines, north arrow, scale bar and logo. |
| **Save** | **Save** keeps maps in this browser (Maps tab). **Save to file** writes a `.pmap.json` file you can back up, email, or open on another computer. Work in progress is kept automatically between sessions. |
| **Export PNG** | **Export PNG** in the map toolbar saves the map as a PNG at twice screen resolution: basemap, boundary, rings, callouts, road names, north arrow, scale bar, logo and attribution. The zoom buttons and toolbar are left out. The logo is included when the tool runs from a web address (like the demo link) or from the single-file version. Browsers won't let a page read back images opened straight from the project folder. |
| **Screenshots** | **Clean view** hides the controls. Press Esc to bring them back. |

### Import formats

- **GeoJSON** (`.geojson` / `.json`): Feature, FeatureCollection or bare geometry.
- **Esri JSON**: ArcGIS REST query results / feature sets (`rings`, `paths`, `x/y`).
- **Coordinates** pasted as `lat, lng` one per line. One pair is a point; three or more make a boundary. `lng, lat` is detected automatically.
- **WKT**: `POLYGON ((...))`, `MULTIPOLYGON`, `POINT`.
- **Place lists**: CSV/tab text (from Excel) with `name, lat, lng, subtitle, icon` columns, with or without a header row, or a JSON array of `{name, lat, lng}`.

Coordinates in Oregon Lambert (EPSG:2992/2994), Oregon State Plane North/South (2269/2270/2913/2914/2838/2839), UTM 10N/11N and Web Mercator are converted to lat/long automatically.

## Rebuilding the road data

`app/roads/` is generated from `All_Public_Roads.geojson` (ODOT's statewide public roads). When a new version comes out, drop it in the project folder and run:

```
python tools/build_roads.py
```

This keeps the ~417,000 named roads (unnamed BLM/forest tracks are skipped), simplifies them to about 1 m accuracy, and writes ~760 small tiles (about 36 MB in total, 1.6 MB for the largest, downtown Portland). State highways are labelled by route number (I-5, HWY 101) where ODOT provides one.

## Files

```
Project Mapping Tool.html   the app
app/css, app/js             app code
app/vendor                  Leaflet 1.9.4, MapLibre GL 4.7.1, maplibre-gl-leaflet, proj4 (local copies)
app/fonts                   Open Sans, Material Symbols (callout icons)
app/img                     Fernhollow logos (fictional brand)
app/roads                   generated road-name tiles
app/js/export.js            PNG export (paints the map onto a canvas)
tools/build_roads.py        builds app/roads from the statewide GeoJSON
tools/build_single.py       packs everything into dist/Project Mapping Tool.html
index.html                  sends the site's home page to the tool
```

## Brand notes

Fernhollow Development is invented for this demo; any resemblance to a real company is unintended. Headers use Georgia and everything else uses Open Sans. The palette is Forest `#338960`, Sage `#98C8B0`, Mint `#D6EAE0`, Pine `#1F553C` and Evergreen `#0D2218`, plus greys.

To rebrand the tool for another company, change the colors in `app/css/app.css` (`:root`), the callout and fill presets at the top of `app/js/app.js`, the basemap palette in `app/js/basemaps.js`, and the images in `app/img`.

"""
Build the road-name tiles the mapping tool loads on demand.

Reads the statewide Oregon public roads GeoJSON (one feature per line, as exported
by ODOT / ArcGIS) and writes small JavaScript tiles to app/roads/. The app loads
only the tiles for the area on screen, so the whole state is available without
loading the 1.5 GB source file.

    python tools/build_roads.py [path/to/All_Public_Roads.geojson]

What it does:
  * keeps only roads that have a name (unnamed BLM / forest tracks can't be labelled
    and the basemaps already draw them)
  * builds a display name, preferring route numbers for state highways (I-5, HWY 101)
  * assigns a tier: 0 state highway, 1 major road, 2 local street, 3 ramp (line only, no label)
  * simplifies each line (~1 m tolerance) and stores coordinates as delta-encoded
    integers at 1e-5 degree precision
  * groups lines into CELL-degree tiles by the centre of their bounding box

Tiles are .js files (not .json) because browsers block fetch() from file:// pages
but allow <script> tags, so the app works when opened straight from disk.
"""
import json, math, os, sys, time

CELL = 0.2            # tile size in degrees (~16 x 22 km in Oregon)
TOL = 1.2e-5          # simplification tolerance in degrees (~1.3 m)
SCALE = 100000        # 1e-5 degree integer precision

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'All_Public_Roads.geojson')
OUT = os.path.join(ROOT, 'app', 'roads')

MAJOR_TYPES = {'HWY', 'FWY', 'BLVD', 'PKWY', 'EXPY', 'BYP'}
RAMP_TYPES = {'CONN', 'RAMP'}
ODOT = 'Oregon Department of Transportation'


def join(*parts):
    return ' '.join(p.strip() for p in parts if p and p.strip())


def is_route(s):
    return s.startswith('I-') or s.startswith('HWY ')


def display_name(p):
    name = join(p.get('PREFIX'), p.get('NAME'), p.get('TYPE'), p.get('SUFFIX'))
    alias_core = (p.get('ALIAS_NAME') or '').strip()
    alias = join(p.get('ALIAS_PREFIX'), alias_core, p.get('ALIAS_TYPE'), p.get('ALIAS_SUFFIX'))
    if p.get('ROADOWNER') == ODOT and alias_core:
        # Route numbers read better than ODOT's internal highway names
        if is_route(alias_core):
            return alias_core
        return alias                 # state highway signed as a local street, e.g. SE POWELL BLVD
    return name or alias


def tier_of(p, name):
    t = (p.get('TYPE') or '').upper()
    if t in RAMP_TYPES or ' CONN' in name or ' RAMP' in name:
        return 3
    if p.get('ROADOWNER') == ODOT:
        return 0
    if t in MAJOR_TYPES or (p.get('ROADOWNER') or '').endswith('County') and t in ('RD', 'HWY'):
        return 1
    return 2


def simplify(pts):
    """Douglas-Peucker on [(x, y)] with longitude scaled by cos(lat)."""
    n = len(pts)
    if n < 3:
        return pts
    k = math.cos(math.radians(pts[0][1]))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    tol2 = TOL * TOL
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a][0] * k, pts[a][1]
        bx, by = pts[b][0] * k, pts[b][1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i][0] * k - ax, pts[i][1] - ay
            if L2 == 0:
                d = px * px + py * py
            else:
                c = px * dy - py * dx
                d = c * c / L2
            if d > best:
                best, bi = d, i
        if best > tol2:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, kp in zip(pts, keep) if kp]


def encode(pts):
    out, px, py = [], 0, 0
    for i, (x, y) in enumerate(pts):
        ix, iy = round(x * SCALE), round(y * SCALE)
        if i == 0:
            out += [ix, iy]
        else:
            if ix == px and iy == py:
                continue
            out += [ix - px, iy - py]
        px, py = ix, iy
    return out


def main():
    t0 = time.time()
    tiles = {}          # key -> {'s': [strings], 'idx': {str: i}, 'f': [...]}
    kept = skipped = pts_in = pts_out = 0

    def sidx(tile, s):
        i = tile['idx'].get(s)
        if i is None:
            i = tile['idx'][s] = len(tile['s'])
            tile['s'].append(s)
        return i

    with open(SRC, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line.startswith('{ "type": "Feature"'):
                continue
            o = json.loads(line.rstrip(','))
            p, g = o['properties'], o['geometry']
            if not g:
                continue
            name = display_name(p)
            if not name:
                skipped += 1
                continue
            tier = tier_of(p, name)
            owner = p.get('ROADOWNER') or ''
            parts = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
            for part in parts:
                pts = [(c[0], c[1]) for c in part]
                if len(pts) < 2:
                    continue
                pts_in += len(pts)
                xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                key = f"{math.floor((cx + 180) / CELL)}_{math.floor((cy + 90) / CELL)}"
                tile = tiles.get(key)
                if tile is None:
                    tile = tiles[key] = {'s': [], 'idx': {}, 'f': []}
                enc = encode(simplify(pts))
                if len(enc) < 4:
                    continue
                pts_out += len(enc) // 2
                tile['f'].append([name, owner, tier, enc])
                if p.get('ROADOWNER') == ODOT:
                    # ODOT puts the route number on only some segments of a highway; remember which
                    # route each internal highway name carries in this tile
                    raw = join(p.get('PREFIX'), p.get('NAME'), p.get('TYPE'), p.get('SUFFIX'))
                    tile.setdefault('routes', {}).setdefault(raw, set())
                    if is_route(name):
                        tile['routes'][raw].add(name)
            kept += 1

    # Segments still showing the internal name (e.g. PACIFIC HWY) take the route number (I-5)
    # when the same highway carries exactly one route number elsewhere in the tile
    for tile in tiles.values():
        routes = {k: next(iter(v)) for k, v in tile.get('routes', {}).items() if len(v) == 1}
        for f in tile['f']:
            if f[0] in routes:
                f[0] = routes[f[0]]
            f[0], f[1] = sidx(tile, f[0]), sidx(tile, f[1])

    # Overwrite in place and remove stale tiles one by one (deleting the folder can fail while a sync client holds it)
    tile_dir = os.path.join(OUT, 'tiles')
    os.makedirs(tile_dir, exist_ok=True)
    for fn in os.listdir(tile_dir):
        if fn.endswith('.js') and fn[:-3] not in tiles:
            os.remove(os.path.join(tile_dir, fn))
    sizes, total = {}, 0
    for key, tile in tiles.items():
        body = json.dumps({'s': tile['s'], 'f': tile['f']}, separators=(',', ':'))
        js = f'PMTRoads.tile("{key}",{body});\n'
        with open(os.path.join(OUT, 'tiles', key + '.js'), 'w', encoding='utf-8') as fo:
            fo.write(js)
        sizes[key] = len(js)
        total += len(js)
    manifest = {'cell': CELL, 'scale': SCALE, 'built': time.strftime('%Y-%m-%d'),
                'source': os.path.basename(SRC), 'tiles': sizes}
    with open(os.path.join(OUT, 'manifest.js'), 'w', encoding='utf-8') as fo:
        fo.write('PMTRoads.manifest(' + json.dumps(manifest, separators=(',', ':')) + ');\n')

    big = sorted(sizes.items(), key=lambda kv: -kv[1])[:5]
    print(f'roads kept {kept:,}  unnamed skipped {skipped:,}')
    print(f'points {pts_in:,} -> {pts_out:,}')
    print(f'tiles {len(tiles):,}  total {total/1e6:.1f} MB  largest {[(k, round(v/1e6, 2)) for k, v in big]}')
    print(f'done in {time.time()-t0:.0f}s')


if __name__ == '__main__':
    main()

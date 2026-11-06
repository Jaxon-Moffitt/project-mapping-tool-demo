"""
Package the tool as ONE self-contained HTML file.

    python tools/build_single.py

Reads "Project Mapping Tool.html" and everything it uses under app/ and writes
dist/Project Mapping Tool.html with all styles, scripts, fonts, logos and the
statewide road tiles inlined. Road tiles are stored gzipped (base64) and unpacked
in the browser only when that area is on screen.

Run tools/build_roads.py first if the road data has changed.
"""
import base64, gzip, json, mimetypes, os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'Project Mapping Tool.html')
OUT_DIR = os.path.join(ROOT, 'dist')
OUT = os.path.join(OUT_DIR, 'Project Mapping Tool.html')
MIME = {'.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg'}


def read(rel, mode='r'):
    with open(os.path.join(ROOT, rel), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def data_uri(rel):
    ext = os.path.splitext(rel)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(rel)[0] or 'application/octet-stream'
    return f'data:{mime};base64,' + base64.b64encode(read(rel, 'rb')).decode('ascii')


def inline_css(rel):
    css = read(rel)
    base = os.path.dirname(rel)

    def repl(m):
        url = m.group(2)
        if url.startswith(('data:', 'http:', 'https:', '#')):
            return m.group(0)
        path = os.path.normpath(os.path.join(base, url)).replace('\\', '/')
        if not os.path.exists(os.path.join(ROOT, path)):
            return m.group(0)        # e.g. Leaflet's unused control images
        return f'url({data_uri(path)})'
    return re.sub(r'url\((["\']?)([^)"\']+)\1\)', repl, css)


def safe_script(js):
    # A literal "</script" inside the code would end the inline <script> block early
    return js.replace('</script', '<\\/script')


def road_blob():
    tiles_dir = os.path.join(ROOT, 'app', 'roads', 'tiles')
    man = read('app/roads/manifest.js')
    manifest = json.loads(man[man.index('(') + 1: man.rindex(')')])
    tiles = {}
    for key in manifest['tiles']:
        with open(os.path.join(tiles_dir, key + '.js'), encoding='utf-8') as f:
            js = f.read()
        body = js[js.index(',') + 1: js.rindex(')')]          # strip PMTRoads.tile("key", ... );
        tiles[key] = base64.b64encode(gzip.compress(body.encode('utf-8'), 9, mtime=0)).decode('ascii')
    return json.dumps({'manifest': manifest, 'tiles': tiles}, separators=(',', ':'))


def main():
    t0 = time.time()
    html = read('Project Mapping Tool.html')

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: f'<style>\n{inline_css(m.group(1))}\n</style>', html)
    html = re.sub(r'<link rel="icon" href="([^"]+)">',
                  lambda m: f'<link rel="icon" href="{data_uri(m.group(1))}">', html)
    html = re.sub(r'<img ([^>]*?)src="(app/[^"]+)"',
                  lambda m: f'<img {m.group(1)}src="{data_uri(m.group(2))}"', html)

    roads = road_blob()
    first = True

    def script(m):
        nonlocal first
        tag = ''
        if first:   # road data goes before the scripts so it's in the page when roads.js starts
            tag = f'<script id="pmt-roads" type="application/json">{roads}</script>\n'
            first = False
        return tag + f'<script>\n{safe_script(read(m.group(1)))}\n</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', script, html)

    left = re.findall(r'(?:src|href)="(app/[^"]+)"', html)
    if left:
        raise SystemExit('Not inlined: ' + ', '.join(left))

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print(f'wrote {os.path.relpath(OUT, ROOT)}  {len(html.encode("utf-8"))/1e6:.1f} MB '
          f'(roads {len(roads)/1e6:.1f} MB)  in {time.time()-t0:.0f}s')


if __name__ == '__main__':
    main()

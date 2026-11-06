/* PNG export — paints what is on the map (basemap, shapes, labels, callouts, north arrow,
   scale bar, logo) onto one canvas, using each element's on-screen position and computed style.
   It covers the elements this app puts on the map; it is not a general HTML renderer. */
(function(){
const SKIP = '.leaflet-control-zoom, .toolbar, .modehint';

function render(root, scale){
  const R = root.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(R.width * scale); canvas.height = Math.round(R.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale); ctx.translate(-R.left, -R.top);
  ctx.beginPath(); ctx.rect(R.left, R.top, R.width, R.height); ctx.clip();
  const map = root.querySelector('.leaflet-container') || root;
  ctx.fillStyle = getComputedStyle(map).backgroundColor; ctx.fillRect(R.left, R.top, R.width, R.height);
  const st = {scale, skipped:[]};
  paint(ctx, root, st);
  return {canvas, skipped:st.skipped};
}

function zOf(el){
  const cs = getComputedStyle(el);
  return cs.position !== 'static' && cs.zIndex !== 'auto' ? +cs.zIndex : 0;
}

function paint(ctx, el, st){
  if (el.matches(SKIP)) return;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
  ctx.save();
  if (+cs.opacity < 1) ctx.globalAlpha *= +cs.opacity;
  if (cs.filter && cs.filter !== 'none') ctx.filter = cs.filter;
  const tag = el.tagName.toLowerCase();
  if (tag === 'img') drawImg(ctx, el, st);
  else if (tag === 'canvas') { const r = el.getBoundingClientRect(); if (r.width && el.width) ctx.drawImage(el, r.left, r.top, r.width, r.height); }
  else if (tag === 'svg') drawSvg(ctx, el);
  else {
    const rot = rotation(cs);
    if (rot) {
      // Rotated labels (road names): draw in the element's own frame, text centred
      const r = el.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      ctx.translate(r.left + r.width / 2, r.top + r.height / 2); ctx.rotate(rot);
      box(ctx, cs, -w / 2, -h / 2, w, h, st);
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t) text(ctx, cs, transform(t, cs), 0, 0, 'center', st);
    } else {
      const r = el.getBoundingClientRect();
      box(ctx, cs, r.left, r.top, r.width, r.height, st);
      el.childNodes.forEach(n => { if (n.nodeType === 3 && n.textContent.trim()) textNode(ctx, n, cs, st); });
      [...el.children].map((c, i) => ({c, i, z:zOf(c)})).sort((a, b) => a.z - b.z || a.i - b.i).forEach(k => paint(ctx, k.c, st));
    }
  }
  ctx.restore();
}

function rotation(cs){
  const m = cs.transform && cs.transform.match(/^matrix\(([^)]+)\)/);
  if (!m) return 0;
  const [a, b] = m[1].split(',').map(Number);
  return Math.abs(b) > 1e-3 ? Math.atan2(b, a) : 0;
}

function drawImg(ctx, img, st){
  if (!img.complete || !img.naturalWidth) return;
  const u = new URL(img.src, location.href);
  // Images the page can't read back (e.g. local files when run from the project folder) would block the export
  const readable = u.protocol === 'data:' || u.protocol === 'blob:' || img.crossOrigin != null ||
    (u.origin === location.origin && location.protocol !== 'file:');
  if (!readable) { st.skipped.push(img.alt || u.pathname.split('/').pop()); return; }
  const r = img.getBoundingClientRect();
  if (r.width && r.height) ctx.drawImage(img, r.left, r.top, r.width, r.height);
}

/* ---------- Boxes: background, border, radius, shadow ---------- */
function firstShadow(v){
  if (!v || v === 'none') return null;
  const s = v.split(/,(?![^(]*\))/)[0];
  const color = (s.match(/rgba?\([^)]+\)|#[0-9a-f]+/i) || ['#000'])[0];
  const n = s.replace(color, '').match(/-?[\d.]+px/g) || [];
  const [x = 0, y = 0, blur = 0, spread = 0] = n.map(parseFloat);
  return {color, x, y, blur, spread};
}
const visible = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
function shape(ctx, x, y, w, h, r){
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h);
}
function box(ctx, cs, x, y, w, h, st){
  const rv = cs.borderTopLeftRadius, r = rv.endsWith('%') ? Math.min(w, h) * parseFloat(rv) / 100 : parseFloat(rv) || 0;
  const bg = cs.backgroundColor, sh = firstShadow(cs.boxShadow);
  if (sh) {
    ctx.save();
    if (sh.blur) {
      ctx.shadowColor = sh.color; ctx.shadowBlur = sh.blur * st.scale;
      ctx.shadowOffsetX = sh.x * st.scale; ctx.shadowOffsetY = sh.y * st.scale;
      ctx.fillStyle = visible(bg) ? bg : '#000';
    } else ctx.fillStyle = sh.color;
    const sp = sh.spread;
    shape(ctx, x - sp + (sh.blur ? 0 : sh.x), y - sp + (sh.blur ? 0 : sh.y), w + sp * 2, h + sp * 2, r + sp);
    ctx.fill(); ctx.restore();
  }
  if (visible(bg)) { ctx.fillStyle = bg; shape(ctx, x, y, w, h, r); ctx.fill(); }
  const side = s => ({w:parseFloat(cs['border' + s + 'Width']) || 0, c:cs['border' + s + 'Color'], on:cs['border' + s + 'Style'] !== 'none'});
  const T = side('Top'), Rt = side('Right'), B = side('Bottom'), Lf = side('Left');
  if (r > 0 && T.w && T.on) {           // rounded: uniform border
    ctx.strokeStyle = T.c; ctx.lineWidth = T.w; shape(ctx, x + T.w / 2, y + T.w / 2, w - T.w, h - T.w, r - T.w / 2); ctx.stroke();
    return;
  }
  [[T, x, y, w, T.w], [B, x, y + h - B.w, w, B.w], [Lf, x, y, Lf.w, h], [Rt, x + w - Rt.w, y, Rt.w, h]].forEach(([s, a, b, c, d]) => {
    if (s.w && s.on && visible(s.c)) { ctx.fillStyle = s.c; ctx.fillRect(a, b, c, d); }
  });
}

/* ---------- Text ---------- */
function transform(t, cs){
  if (cs.textTransform === 'uppercase') return t.toUpperCase();
  if (cs.textTransform === 'lowercase') return t.toLowerCase();
  return t;
}
function text(ctx, cs, t, x, y, align, st){
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(t), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  // x,y is the top-left of the text box (align left) or its centre (align center)
  const by = align === 'center' ? y + (asc - desc) / 2 : y + asc;
  // Letter spacing is added after every letter, last one included: centre on the letters, not the gap
  const bx = align === 'center' ? x + (parseFloat(ctx.letterSpacing) || 0) / 2 : x;
  const sh = firstShadow(cs.textShadow);
  if (sh) {                              // halo, like the CSS text-shadow glow
    ctx.save();
    ctx.shadowColor = sh.color; ctx.shadowBlur = Math.max(sh.blur, 2) * st.scale;
    ctx.strokeStyle = sh.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.strokeText(t, bx, by); ctx.strokeText(t, bx, by);
    ctx.restore();
  }
  ctx.fillStyle = cs.color; ctx.fillText(t, bx, by);
}
function textNode(ctx, node, cs, st){
  // One range per word gives each word's real position, wherever the browser wrapped or spaced it
  const s = node.textContent, range = document.createRange(), re = /\S+/g;
  let m;
  while ((m = re.exec(s))) {
    range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    ctx.save();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const mm = ctx.measureText('Hg'), pad = (r.height - mm.fontBoundingBoxAscent - mm.fontBoundingBoxDescent) / 2;
    text(ctx, cs, transform(m[0], cs), r.left, r.top + pad, 'left', st);
    ctx.restore();
  }
}

/* ---------- SVG (Leaflet shapes, leader lines, north arrow) ---------- */
function drawSvg(ctx, svg){
  const r = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal;
  ctx.save();
  ctx.translate(r.left, r.top);
  if (vb && vb.width && vb.height) { ctx.scale(r.width / vb.width, r.height / vb.height); ctx.translate(-vb.x, -vb.y); }
  svg.querySelectorAll('path, line, polyline, polygon, circle, rect').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const n = a => +el.getAttribute(a) || 0;
    let p;
    const tag = el.tagName.toLowerCase();
    if (tag === 'path') p = new Path2D(el.getAttribute('d') || '');
    else {
      p = new Path2D();
      if (tag === 'line') { p.moveTo(n('x1'), n('y1')); p.lineTo(n('x2'), n('y2')); }
      else if (tag === 'circle') p.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
      else if (tag === 'rect') p.rect(n('x'), n('y'), n('width'), n('height'));
      else {
        const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
        for (let i = 0; i + 1 < pts.length; i += 2) i ? p.lineTo(pts[i], pts[i + 1]) : p.moveTo(pts[i], pts[i + 1]);
        if (tag === 'polygon') p.closePath();
      }
    }
    ctx.save();
    if (+cs.opacity < 1) ctx.globalAlpha *= +cs.opacity;
    if (cs.fill && cs.fill !== 'none' && tag !== 'line' && tag !== 'polyline') {
      ctx.globalAlpha *= +cs.fillOpacity; ctx.fillStyle = cs.fill; ctx.fill(p, cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
      ctx.globalAlpha /= +cs.fillOpacity || 1;
    }
    if (cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) {
      ctx.globalAlpha *= +cs.strokeOpacity; ctx.strokeStyle = cs.stroke; ctx.lineWidth = parseFloat(cs.strokeWidth);
      ctx.lineCap = cs.strokeLinecap; ctx.lineJoin = cs.strokeLinejoin;
      ctx.setLineDash(cs.strokeDasharray && cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[\s,]+/).map(parseFloat).filter(isFinite) : []);
      ctx.stroke(p);
    }
    ctx.restore();
  });
  ctx.restore();
}

window.PMTExport = {render};
})();

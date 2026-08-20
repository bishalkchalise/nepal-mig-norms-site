/* charts.js: small dependency-free SVG charts (one accent colour, recessive axes).
   dotPlot(items, opts)      horizontal estimate + 95% CI
   barPlot(items, opts)      horizontal bars
   histogram(breaks, counts) counts by bin
   linePlot(series, opts)    one or a few lines over x (years)
   scatter(points, opts)     x/y dots with optional labels
   All return an <svg> element (viewBox scaled, width 100%). Tooltips via <title>. */
(function () {
  'use strict';
  var C = window.NMN = window.NMN || {};
  var ACC = '#2a5d8f', ACC2 = '#9a5b2a', MUTED = '#5c5c5c', RULE = '#d9d7d0', INK = '#161616', SURF = '#fcfcfa';
  var SERIES = [ACC, ACC2, '#4f7f3a'];  // fixed order: total/first, male/second, female/third
  function svgEl(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function txt(x, y, s, attrs) { var t = svgEl('text', Object.assign({ x: x, y: y, 'font-size': 13, fill: MUTED }, attrs || {})); t.textContent = s; return t; }
  function withTitle(e, t) { var ti = svgEl('title'); ti.textContent = t; e.appendChild(ti); return e; }
  function niceTicks(lo, hi, n) { var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))); var err = span / n / step; step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1; var t = [], v = Math.ceil(lo / step) * step; while (v <= hi + 1e-9) { t.push(+v.toFixed(10)); v += step; } return t; }
  function fmtTick(v) { var a = Math.abs(v); return a >= 1000 ? v.toLocaleString('en-US') : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : a >= 0.01 ? v.toFixed(2) : v.toFixed(3); }

  C.charts = {
    dotPlot: function (items, opts) {
      opts = opts || {};
      var rowH = 28, W = opts.width || 720, ml = opts.ml || 300, mr = 24, mt = 12, mb = 40, H = mt + mb + rowH * items.length;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.aria || 'Coefficient plot' });
      var lo = Math.min.apply(null, items.map(function (i) { return i.beta - 1.96 * i.se; })), hi = Math.max.apply(null, items.map(function (i) { return i.beta + 1.96 * i.se; }));
      if (lo > 0) lo = 0; if (hi < 0) hi = 0; var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
      var x = function (v) { return ml + (v - lo) / (hi - lo) * (W - ml - mr); };
      var tks = niceTicks(lo, hi, 5), stepDec = tks.length > 1 ? Math.max(0, -Math.floor(Math.log10(Math.abs(tks[1] - tks[0])) + 1e-9)) : 2;
      tks.forEach(function (t) { svg.appendChild(svgEl('line', { x1: x(t), x2: x(t), y1: mt, y2: H - mb, stroke: RULE })); svg.appendChild(txt(x(t), H - mb + 18, t.toFixed(stepDec), { 'text-anchor': 'middle' })); });
      svg.appendChild(svgEl('line', { x1: x(0), x2: x(0), y1: mt, y2: H - mb, stroke: INK, 'stroke-dasharray': '3 3' }));
      items.forEach(function (it, i) {
        var cy = mt + rowH * i + rowH / 2, col = it.color || (it.highlight ? INK : ACC);
        var maxCh = Math.floor((ml - 14) / 7.2), lab = it.label.length > maxCh ? it.label.slice(0, maxCh - 1) + '…' : it.label;
        var lt = txt(ml - 10, cy + 4, lab, { 'text-anchor': 'end', 'font-size': 13.5, fill: it.highlight ? INK : MUTED, 'font-weight': it.highlight ? 600 : 400 }); if (lab !== it.label) withTitle(lt, it.label); svg.appendChild(lt);
        svg.appendChild(svgEl('line', { x1: x(it.beta - 1.96 * it.se), x2: x(it.beta + 1.96 * it.se), y1: cy, y2: cy, stroke: col, 'stroke-width': 2 }));
        var c = svgEl('circle', { cx: x(it.beta), cy: cy, r: 5, fill: col, stroke: SURF, 'stroke-width': 2 });
        withTitle(c, it.label + ': ' + it.beta.toFixed(4) + ' (SE ' + it.se.toFixed(4) + ')' + (it.p != null ? ', p = ' + (it.p < 0.001 ? '<0.001' : it.p.toFixed(3)) : '') + (it.n != null ? ', N = ' + it.n.toLocaleString('en-US') : '') + (it.mean != null ? ', mean = ' + it.mean.toFixed(3) : '') + (it.spec ? ' [' + it.spec + ']' : ''));
        svg.appendChild(c);
      });
      svg.appendChild(txt((ml + W - mr) / 2, H - 8, opts.xlabel || 'coefficient with 95% CI', { 'text-anchor': 'middle' }));
      return svg;
    },
    barPlot: function (items, opts) {
      opts = opts || {};
      var rowH = 26, W = opts.width || 680, ml = opts.ml || 150, mr = 70, mt = 8, mb = 34, H = mt + mb + rowH * items.length;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.aria || 'Bar chart' });
      var mx = Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); })) || 1, mn = Math.min(0, Math.min.apply(null, items.map(function (i) { return i.value; })));
      var x = function (v) { return ml + (v - mn) / (mx - mn) * (W - ml - mr); };
      svg.appendChild(svgEl('line', { x1: x(0), x2: x(0), y1: mt, y2: H - mb, stroke: MUTED }));
      items.forEach(function (it, i) {
        var cy = mt + rowH * i;
        svg.appendChild(txt(ml - 8, cy + rowH / 2 + 4, it.label, { 'text-anchor': 'end', 'font-size': 14, fill: INK }));
        var r = svgEl('rect', { x: Math.min(x(0), x(it.value)), y: cy + 5, width: Math.max(1, Math.abs(x(it.value) - x(0))), height: rowH - 10, fill: it.color || ACC, rx: 2 });
        withTitle(r, it.label + ': ' + (opts.fmt ? opts.fmt(it.value) : it.value.toFixed(3)) + (it.extra ? ' ' + it.extra : '')); svg.appendChild(r);
        svg.appendChild(txt(Math.max(x(0), x(it.value)) + 6, cy + rowH / 2 + 4, opts.fmt ? opts.fmt(it.value) : it.value.toFixed(3)));
      });
      if (opts.xlabel) svg.appendChild(txt((ml + W - mr) / 2, H - 8, opts.xlabel, { 'text-anchor': 'middle' }));
      return svg;
    },
    histogram: function (breaks, counts, opts) {
      opts = opts || {};
      var W = opts.width || 640, H = 260, ml = 44, mr = 12, mt = 12, mb = 44;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': 'Histogram of ' + (opts.xlabel || '') });
      var xmin = breaks[0], xmax = breaks[breaks.length - 1], ymax = Math.max.apply(null, counts) || 1;
      var x = function (v) { return ml + (v - xmin) / (xmax - xmin) * (W - ml - mr); }, y = function (v) { return mt + (1 - v / ymax) * (H - mt - mb); };
      svg.appendChild(svgEl('line', { x1: ml, x2: W - mr, y1: y(0), y2: y(0), stroke: RULE }));
      counts.forEach(function (c, i) { var r = svgEl('rect', { x: x(breaks[i]) + 1, y: y(c), width: Math.max(1, x(breaks[i + 1]) - x(breaks[i]) - 2), height: y(0) - y(c), fill: ACC, rx: 2 }); withTitle(r, fmtTick(breaks[i]) + ' to ' + fmtTick(breaks[i + 1]) + ': ' + c); svg.appendChild(r); });
      niceTicks(xmin, xmax, 5).forEach(function (t) { svg.appendChild(txt(x(t), H - mb + 18, fmtTick(t), { 'text-anchor': 'middle' })); });
      [0, ymax].forEach(function (v) { svg.appendChild(txt(ml - 6, y(v) + 4, v, { 'text-anchor': 'end' })); });
      svg.appendChild(txt((ml + W - mr) / 2, H - 6, opts.xlabel || '', { 'text-anchor': 'middle' }));
      svg.appendChild(txt(12, mt + 10, opts.ylabel || 'districts'));
      return svg;
    },
    linePlot: function (series, opts) {
      // series: [{name, points:[{x,y}], color?}]
      opts = opts || {};
      var W = opts.width || 680, H = (opts.height || 280) + (series.length > 1 ? 22 : 0), ml = 64, mr = 20, mt = 14, mb = 44 + (series.length > 1 ? 22 : 0);
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.aria || 'Line chart' });
      var xs = [], ys = []; series.forEach(function (s) { s.points.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
      var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymin = Math.min(0, Math.min.apply(null, ys)), ymax = Math.max.apply(null, ys) || 1;
      if (opts.ymin != null) ymin = opts.ymin;
      var yt = niceTicks(ymin, ymax, 4); ymax = Math.max(ymax, yt[yt.length - 1]);
      var x = function (v) { return ml + (v - xmin) / ((xmax - xmin) || 1) * (W - ml - mr); }, y = function (v) { return mt + (1 - (v - ymin) / ((ymax - ymin) || 1)) * (H - mt - mb); };
      yt.forEach(function (t) { svg.appendChild(svgEl('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), stroke: RULE })); svg.appendChild(txt(ml - 8, y(t) + 4, opts.fmtY ? opts.fmtY(t) : fmtTick(t), { 'text-anchor': 'end' })); });
      var xt = opts.xticks || niceTicks(xmin, xmax, 6).filter(function (v) { return Number.isInteger(v); });
      xt.forEach(function (t) { svg.appendChild(txt(x(t), H - mb + 18, t, { 'text-anchor': 'middle' })); });
      series.forEach(function (s, si) {
        var col = s.color || SERIES[si % SERIES.length];
        var pts = s.points.filter(function (p) { return p.y != null; }).sort(function (a, b) { return a.x - b.x; });
        var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.x).toFixed(1) + ',' + y(p.y).toFixed(1); }).join(' ');
        svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: col, 'stroke-width': 2 }));
        pts.forEach(function (p) { var c = svgEl('circle', { cx: x(p.x), cy: y(p.y), r: 4, fill: col, stroke: SURF, 'stroke-width': 1.5 }); withTitle(c, s.name + ' ' + p.x + ': ' + (opts.fmtY ? opts.fmtY(p.y) : p.y.toFixed(3)) + (p.n ? ' (N=' + p.n.toLocaleString('en-US') + ')' : '')); svg.appendChild(c); });
        if (series.length > 1) { var lx = ml + si * Math.max(92, (W - ml - mr) / series.length); svg.appendChild(svgEl('line', { x1: lx, x2: lx + 16, y1: H - 10, y2: H - 10, stroke: col, 'stroke-width': 2.5 })); svg.appendChild(txt(lx + 21, H - 6, s.name.length > 13 ? s.name.slice(0, 12) + '…' : s.name, { fill: INK, 'font-size': 12 })); }
      });
      if (opts.ylabel) svg.appendChild(txt(ml, mt - 2, opts.ylabel, { 'font-size': 12 }));
      if (opts.xlabel) svg.appendChild(txt((ml + W - mr) / 2, H - 6 - (series.length > 1 ? 22 : 0), opts.xlabel, { 'text-anchor': 'middle' }));
      return svg;
    },
    scatter: function (points, opts) {
      opts = opts || {};
      var W = opts.width || 640, H = 320, ml = 64, mr = 20, mt = 14, mb = 48;
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': opts.aria || 'Scatter plot' });
      var xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
      var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
      var padx = (xmax - xmin) * 0.05 || 1, pady = (ymax - ymin) * 0.05 || 1; xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
      var x = function (v) { return ml + (v - xmin) / (xmax - xmin) * (W - ml - mr); }, y = function (v) { return mt + (1 - (v - ymin) / (ymax - ymin)) * (H - mt - mb); };
      niceTicks(ymin, ymax, 4).forEach(function (t) { svg.appendChild(svgEl('line', { x1: ml, x2: W - mr, y1: y(t), y2: y(t), stroke: RULE })); svg.appendChild(txt(ml - 8, y(t) + 4, fmtTick(t), { 'text-anchor': 'end' })); });
      niceTicks(xmin, xmax, 5).forEach(function (t) { svg.appendChild(txt(x(t), H - mb + 18, fmtTick(t), { 'text-anchor': 'middle' })); });
      if (ymin < 0 && ymax > 0) svg.appendChild(svgEl('line', { x1: ml, x2: W - mr, y1: y(0), y2: y(0), stroke: MUTED, 'stroke-dasharray': '3 3' }));
      points.forEach(function (p) { var c = svgEl('circle', { cx: x(p.x), cy: y(p.y), r: 4.5, fill: ACC, 'fill-opacity': 0.75, stroke: SURF, 'stroke-width': 1 }); withTitle(c, (p.label || '') + ': ' + fmtTick(p.x) + ', ' + fmtTick(p.y)); svg.appendChild(c); });
      svg.appendChild(txt((ml + W - mr) / 2, H - 8, opts.xlabel || '', { 'text-anchor': 'middle' }));
      svg.appendChild(txt(ml, mt - 2, opts.ylabel || '', { 'font-size': 12 }));
      return svg;
    },
    figure: function (title, svg, under) {
      var fig = C.el('figure', { class: 'fig' });
      if (title) fig.appendChild(C.el('figcaption', { class: 'fig-title', text: title }));
      fig.appendChild(svg);
      if (under) fig.appendChild(C.el('p', { class: 'fig-under', text: under }));
      return fig;
    }
  };
})();

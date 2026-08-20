/* results.js: Results explorer. Dropdowns (outcome family, share window, index,
   [migration channel], sample) -> annotated estimating equation -> ladder table.
   URL state: ?outcome=&share=&shift=&treatment=&sample= ; Back/Forward work. */
(function () {
  'use strict';
  var C = window.NMN;
  var DIMS = ['outcome', 'share', 'shift', 'treatment', 'sample'];
  var SEL = {}, sel = {};
  function opt(value, label, disabled) { var o = document.createElement('option'); o.value = value; o.textContent = label; if (disabled) o.disabled = true; return o; }
  function optgroup(label) { var g = document.createElement('optgroup'); g.label = label; return g; }
  function treatments() { return [].concat((C.config.treatments_by_paper || {})[C.paperId] || ['total']); }
  function fixedSel(fam) { return { controls: 'compare', estimator: fam.type === 'admin' ? (C.defaults.estimator_admin || 'ols_rate') : C.defaults.estimator, weight: fam.type === 'admin' ? 'none' : C.defaults.weight }; }

  function init() {
    DIMS.forEach(function (d) { SEL[d] = document.getElementById('sel-' + d); });
    var d = C.defaults, u = C.readURL(DIMS), trs = treatments();
    var defaultFamily = (C.paperCfg.hierarchy && [].concat(C.paperCfg.hierarchy[0].families)[0]) || C.families[0].id;
    sel = { outcome: u.outcome || defaultFamily, share: u.share || d.share, shift: u.shift || d.shifter,
            treatment: (u.treatment && trs.indexOf(u.treatment) >= 0) ? u.treatment : (trs.indexOf(d.treatment) >= 0 ? d.treatment : trs[0]), sample: u.sample || d.sample };
    document.getElementById('field-treatment').hidden = trs.length < 2;
    if (!C.family(sel.outcome)) sel.outcome = defaultFamily;
    DIMS.forEach(function (dim) { SEL[dim].addEventListener('change', function () { sel[dim] = SEL[dim].value; fixUnavailable(); C.writeURL(urlState()); render(); }); });
    window.addEventListener('popstate', function () { var uu = C.readURL(DIMS); DIMS.forEach(function (k) { if (uu[k]) sel[k] = uu[k]; }); fixUnavailable(); render(); });
    fixUnavailable(); C.writeURL(urlState(), true); render();
  }
  function urlState() { var o = { outcome: sel.outcome, share: sel.share, shift: sel.shift, sample: sel.sample }; if (treatments().length > 1) o.treatment = sel.treatment; return o; }
  function full(fam) { return Object.assign({}, sel, fixedSel(fam), { controls: C.defaults.controls }); }
  function fixUnavailable() {
    var fam = C.family(sel.outcome), order = ['sample', 'treatment', 'shift', 'share'], tries = 0;
    while (tries++ < 8) {
      var single = full(fam);
      if (C.rowsFor(fam.id, single).length) break;
      var fixed = false;
      for (var i = 0; i < order.length && !fixed; i++) {
        var dim = order[i], av = C.available(fam.id, single, dim);
        if (!av[single[dim]]) { var prefer = dim === 'shift' ? C.defaults.shifter : (C.defaults[dim] || null), keys = Object.keys(av); if (!keys.length) continue; sel[dim] = (prefer && av[prefer]) ? prefer : keys[0]; fixed = true; }
      }
      if (!fixed) break;
    }
    buildSelectors();
  }
  function buildSelectors() {
    var so = SEL.outcome; so.innerHTML = '';
    (C.paperCfg.hierarchy || [{ label: '', families: C.families.map(function (f) { return f.id; }) }]).forEach(function (h) {
      var g = h.label ? optgroup(h.label) : so;
      [].concat(h.families).forEach(function (fid) { var f = C.family(fid); if (!f) return; var dis = f.type === 'planned' || !C.anyForFamily(f.id); g.appendChild(opt(f.id, f.display_name + (dis ? ' (not yet estimated)' : ''), dis)); });
      if (h.label) so.appendChild(g);
    });
    so.value = sel.outcome;
    var fam = C.family(sel.outcome), probe = full(fam);
    var avail = function (dim) { return C.available(fam.id, probe, dim); };
    var a = avail('share'), ss = SEL.share; ss.innerHTML = '';
    var gP = optgroup('Main share windows'), gR = optgroup('Additional robustness shares');
    C.config.shares.filter(function (s) { return s.status === 'available'; }).forEach(function (s) { (s.primary ? gP : gR).appendChild(opt(s.id, s.years_label, !a[s.id])); });
    ss.appendChild(gP); ss.appendChild(gR); ss.value = sel.share; if (ss.value !== sel.share) sel.share = ss.value;
    a = avail('shift'); fill('shift', C.config.shifters.filter(function (s) { return s.status === 'available'; }).map(function (s) { return { id: s.id, label: s.display_name, disabled: !a[s.id] }; }), sel.shift);
    var trsP = treatments();
    a = avail('treatment'); fill('treatment', C.config.treatments.filter(function (t) { return trsP.indexOf(t.id) >= 0; }).map(function (t) { return { id: t.id, label: t.display_name, disabled: !a[t.id] }; }), sel.treatment);
    a = avail('sample'); fill('sample', C.config.samples.filter(function (s) { return s.papers.indexOf(C.paperId) >= 0; }).map(function (s) { return { id: s.id, label: s.display_name, disabled: !a[s.id] }; }), sel.sample);
  }
  function fill(dim, options, value) {
    var s = SEL[dim]; s.innerHTML = '';
    options.forEach(function (o) { s.appendChild(opt(o.id, o.label, o.disabled)); });
    s.value = value;
    if (s.value !== value) { var first = options.filter(function (o) { return !o.disabled; })[0]; if (first) { s.value = first.id; sel[dim] = first.id; } }
  }
  function render() {
    var fam = C.family(sel.outcome), base = full(fam);
    var columns = C.ladderColumns(fam, base);
    if (!columns.length) columns = [{ label: '(1)', sel: base }];
    var primary = columns[columns.length - 1].sel, rows = C.rowsFor(fam.id, primary);
    C.renderMath(document.getElementById('equations'), C.equations(fam.id, primary));
    var t = C.buildTable(fam.id, columns, { caption: fam.display_name, showEquality: false });
    var tw = document.getElementById('table-wrap'); tw.innerHTML = ''; tw.appendChild(t.table);
    document.getElementById('table-notes').innerHTML = '<p><strong>Notes.</strong> ' + C.notesHTML(fam.id, primary, rows).replace(/<\/p><p>/g, ' ').replace(/^<p>/, '').replace(/<\/p>$/, '') + '</p>';
    document.title = fam.display_name + ': Results: ' + C.paperCfg.title;
  }
  C.loadPaper(window.SITE.paper).then(init).catch(function (e) { document.getElementById('table-wrap').innerHTML = '<p class="notice warn">Could not load results: ' + C.esc(e.message) + '</p>'; });
})();

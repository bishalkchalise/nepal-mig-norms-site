/* data.js: Data page descriptives (from descriptives.json): sample, migration
   patterns, destination composition, shifter changes, exposure, outcomes by wave. */
(function () {
  'use strict';
  var C = window.NMN, D = null, paper = window.SITE.paper;
  function sec(id) { return document.getElementById(id); }
  function h3(t) { return C.el('h3', { class: 'fig-title', text: t }); }
  function table(headers, rows, numFrom) {
    var t = C.el('table', { class: 'plain compact' }), th = C.el('thead'), tr = C.el('tr');
    headers.forEach(function (h) { tr.appendChild(C.el('th', { text: h })); }); th.appendChild(tr); t.appendChild(th);
    var tb = C.el('tbody'); rows.forEach(function (r) { var x = C.el('tr'); r.forEach(function (c, i) { x.appendChild(C.el('td', { text: c, style: i >= (numFrom == null ? 1 : numFrom) ? 'text-align:right;font-variant-numeric:tabular-nums' : '' })); }); tb.appendChild(x); });
    t.appendChild(tb); var w = C.el('div', { class: 'table-wrap' }); w.appendChild(t); return w;
  }
  var fig = function (title, svg, under) { return C.charts.figure(title, svg, under); };
  var pct = function (v) { return (100 * v).toFixed(1) + '%'; };
  var NAMES = { QAT: 'Qatar', SAU: 'Saudi Arabia', MYS: 'Malaysia', ARE: 'UAE', KWT: 'Kuwait', BHR: 'Bahrain', OMN: 'Oman', JPN: 'Japan', KOR: 'Korea', ISR: 'Israel', CYP: 'Cyprus', LBN: 'Lebanon', HKG: 'Hong Kong', JOR: 'Jordan', AFG: 'Afghanistan', MDV: 'Maldives', POL: 'Poland', ROU: 'Romania', HRV: 'Croatia', MLT: 'Malta', USA: 'United States', GBR: 'United Kingdom', AUS: 'Australia', TUR: 'Türkiye', IRQ: 'Iraq', LBY: 'Libya', MUS: 'Mauritius' };
  var nm = function (iso) { return NAMES[iso] || iso; };

  function render() {
    var d = C.defaults, sh = C.byId(C.config.shares, d.share), sf = C.shifter(d.shifter);
    // ---- sample
    var S = sec('sample-root');
    var sw = D.sample.dhs_women, sm = D.sample.dhs_men;
    var rows = sw.map(function (r) { var m = sm.filter(function (x) { return x.survey_year === r.survey_year; })[0]; return [String(r.survey_year), C.fmtInt(r.women), C.fmtInt(r.districts), C.fmtInt(r.wb_asked), C.fmtInt(r.v743_asked), r.dv_module ? C.fmtInt(r.dv_module) : '—', m ? C.fmtInt(m.men) : '—']; });
    S.appendChild(table(['DHS wave', 'Women 15–49', 'Districts', 'Wife-beating items', 'Decision items', 'DV module', 'Men'], rows));
    if (paper === 'violence') {
      var n11 = D.sample.dhs2011;
      var box = C.el('div', { class: 'notice warn' });
      box.appendChild(C.el('strong', { text: 'DHS 2011' })); box.appendChild(document.createTextNode(' | DV module exists | Preferred violence analysis: excluded | ' + n11.reason_short + '. '));
      var det = C.el('details', { class: 'dict inline' }); det.appendChild(C.el('summary', { text: 'Why excluded?' })); det.appendChild(C.el('p', { class: 'small', text: n11.reason_long })); box.appendChild(det);
      S.appendChild(box);
      S.appendChild(C.el('p', { class: 'small muted', text: 'Comparable periods used: attitudes 2001/2006 → 2016/2022; agency 2001–2022; IPV experience 2016/2022 (no earlier module); INSEC 2020–2025 and courts 2016–2025 have no comparable pre-period (post-period exposure design).' }));
    }
    // ---- migration
    var M = sec('migration-root'), mg = D.migration;
    var ann = ['total', 'male', 'female'].map(function (ch) { return { name: ch, points: mg.annual.filter(function (r) { return r.channel === ch; }).map(function (r) { return { x: r.year, y: r.permits }; }) }; });
    M.appendChild(fig('Labour Permits per Year', C.charts.linePlot(ann, { ylabel: 'permits', fmtY: function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v; } }), 'Source: DoFE permits ' + mg.years[0] + '–' + mg.years[1] + ' · Sample: all non-India destinations · Unit: permits'));
    var intens = mg.intensity.filter(function (r) { return r.share_id === d.share && r.channel === 'total'; });
    if (intens.length) {
      var vals = intens.map(function (r) { return r.M; }).sort(function (a, b) { return a - b; });
      var nb = 10, lo = 0, hi = Math.max.apply(null, vals), step = hi / nb, br = [], cnt = [];
      for (var i = 0; i <= nb; i++) br.push(+(lo + i * step).toFixed(3)); for (i = 0; i < nb; i++) cnt.push(vals.filter(function (v) { return v >= br[i] && (v < br[i + 1] || (i === nb - 1 && v <= br[i + 1])); }).length);
      var top5 = intens.slice().sort(function (a, b) { return b.M - a.M; }).slice(0, 5).map(function (r) { return r.district + ' ' + r.M.toFixed(1); }).join(', ');
      M.appendChild(fig('District Migration Intensity (' + sh.years_label + ') (Permits per 1,000 Population)', C.charts.histogram(br, cnt, { xlabel: 'MigRate: annual permits per 1,000 (2011 population)' }), 'Source: DoFE permits, 2011 Census · Sample: 75 districts · Highest: ' + top5));
    }
    // ---- destinations
    var DS = sec('destination-root');
    var tot = mg.destinations_all_years.slice(0, 10).map(function (r) { return { label: nm(r.iso3), value: r.share }; });
    DS.appendChild(fig('Destination Shares of Labour Permits, ' + mg.years[0] + '–' + mg.years[1], C.charts.barPlot(tot, { fmt: pct, ml: 130 }), 'Source: DoFE permits · Sample: all non-India destinations'));
    if (paper === 'gender_norms') {
      var bm = mg.destinations_by_channel.filter(function (r) { return r.channel === 'male'; }).slice(0, 8), bf = mg.destinations_by_channel.filter(function (r) { return r.channel === 'female'; }).slice(0, 8);
      var wrap = C.el('div', { class: 'two-col figs' });
      wrap.appendChild(fig('Destination Shares, Male Permits', C.charts.barPlot(bm.map(function (r) { return { label: nm(r.iso3), value: r.share }; }), { fmt: pct, ml: 130, width: 560 }), 'Source: DoFE permits, men'));
      wrap.appendChild(fig('Destination Shares, Female Permits', C.charts.barPlot(bf.map(function (r) { return { label: nm(r.iso3), value: r.share, color: '#9a5b2a' }; }), { fmt: pct, ml: 130, width: 560 }), 'Source: DoFE permits, women'));
      DS.appendChild(wrap);
    }
    // ---- shifter
    var SH = sec('shifter-root');
    var shifters = Object.keys(D.shifters);
    var cur = d.shifter;
    var tog = C.el('div', { class: 'toggle-row', role: 'group', 'aria-label': 'Shifter' });
    var body = C.el('div');
    function drawShifter(id) {
      body.innerHTML = '';
      var s = D.shifters[id], cfg = C.shifter(id);
      var t = s.table.filter(function (r) { return r.change != null; }).slice(0, 10);
      body.appendChild(fig('Change in Destination Index, ' + s.baseline_year + '–' + s.later_year + ' (' + (cfg ? cfg.display_name : id) + ')', C.charts.barPlot(t.map(function (r) { return { label: nm(r.iso3), value: r.change, extra: '(' + r.baseline.toFixed(1) + ' → ' + r.later.toFixed(1) + ')' }; }), { fmt: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }, ml: 130, xlabel: 'change in index points (0–100)' }), 'Source: ' + ({ wbl: 'World Bank WBL 1.0', wbl_working_age: 'World Bank WBL 1.0', unvaw: 'UN Women Global Database on VAW' }[id] || id) + ' · destinations ordered by permit share'));
      body.appendChild(table(['Destination', 'Permit share', s.baseline_year, s.later_year, 'Change'], t.map(function (r) { return [nm(r.iso3), pct(r.share), r.baseline.toFixed(1), r.later.toFixed(1), (r.change >= 0 ? '+' : '') + r.change.toFixed(1)]; })));
      var lines = t.slice(0, 6).map(function (r) { return { name: nm(r.iso3), points: s.series.filter(function (x) { return x.iso3 === r.iso3; }).map(function (x) { return { x: x.year, y: x.value }; }) }; });
      body.appendChild(fig('Destination Index over Time, Six Largest Destinations (' + (cfg ? cfg.display_name : id) + ')', C.charts.linePlot(lines, { ylabel: 'index (0–100)', ymin: 0 }), 'Source: as above · Unit: destination-year'));
    }
    shifters.forEach(function (id) { var b = C.el('button', { type: 'button', text: (C.shifter(id) || {}).short || id, 'aria-pressed': String(id === cur) }); b.addEventListener('click', function () { cur = id; tog.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); drawShifter(id); }); tog.appendChild(b); });
    SH.appendChild(tog); SH.appendChild(body); drawShifter(cur);
    // ---- exposure
    var EX = sec('exposure-root');
    var ex = D.exposure.filter(function (e) { return e.paper === paper && e.channel === d.treatment.replace('gendered', 'male'); })[0] || D.exposure.filter(function (e) { return e.paper === paper; })[0];
    if (ex) {
      var w2 = C.el('div', { class: 'two-col figs' });
      w2.appendChild(fig('Distribution of District Treatment, ' + ex.year + ' (' + ex.channel + ' migration)', C.charts.histogram(ex.hist.breaks, ex.hist.counts, { xlabel: 'MigRate × Index', width: 560 }), 'Source: treatment panel; share window ' + sh.years_label + '; index ' + (sf ? sf.display_name : '')));
      w2.appendChild(fig('District Treatment and Migration Intensity, ' + ex.year, C.charts.scatter(ex.points.map(function (p) { return { x: p.M, y: p.Z, label: p.district }; }), { xlabel: 'MigRate: annual permits per 1,000', ylabel: 'MigRate × Index', width: 560 }), 'Unit: district (75); the spread at a given MigRate is the index variation'));
      EX.appendChild(w2);
      if (paper === 'gender_norms') {
        var exf = D.exposure.filter(function (e) { return e.paper === paper && e.channel === 'female'; })[0];
        if (exf) EX.appendChild(fig('Distribution of District Treatment, ' + exf.year + ' (female migration)', C.charts.histogram(exf.hist.breaks, exf.hist.counts, { xlabel: 'MigRate × Index (female migration)' }), 'Female permits are ~3% of the total; Z is correspondingly smaller'));
      }
    }
    // ---- outcomes
    var O = sec('outcome-root');
    var ser = D.outcomes.dhs.filter(function (s) { return s.paper === paper; });
    var grid = C.el('div', { class: 'two-col figs' });
    ser.forEach(function (s) {
      var pts = s.series.map(function (r) { return { x: r.survey_year, y: r.value, n: r.n }; });
      grid.appendChild(fig(s.label + ', by DHS Wave', C.charts.linePlot([{ name: s.label, points: pts }], { ylabel: s.unit, ymin: s.unit === 'share' ? 0 : undefined, width: 560, height: 240, xticks: pts.map(function (p) { return p.x; }), fmtY: function (v) { return s.unit === 'share' ? (100 * v).toFixed(0) + '%' : v.toFixed(1); } }), 'Source: DHS (weighted) · ' + (s.note || 'Unit: women 15–49')));
    });
    O.appendChild(grid);
    if (paper === 'violence') {
      var ins = D.outcomes.insec, crt = D.outcomes.court;
      var g2 = C.el('div', { class: 'two-col figs' });
      g2.appendChild(fig('INSEC Sexual-Violence Incidents per 100,000', C.charts.linePlot([{ name: 'sexual violence', points: ins.map(function (r) { return { x: r.year, y: r.rate_sv }; }) }, { name: 'non-gendered (reference)', points: ins.map(function (r) { return { x: r.year, y: r.rate_other }; }) }], { ylabel: 'per 100,000', ymin: 0, width: 560, height: 240, xticks: ins.map(function (r) { return r.year; }) }), 'Source: INSEC · ' + D.outcomes.insec_note));
      g2.appendChild(fig('District-Court Filings per 100,000', C.charts.linePlot([{ name: 'divorce (all forms)', points: crt.map(function (r) { return { x: r.year, y: r.rate_divorce }; }) }, { name: 'rape', points: crt.map(function (r) { return { x: r.year, y: r.rate_rape }; }) }, { name: 'domestic violence', points: crt.map(function (r) { return { x: r.year, y: r.rate_dv }; }) }], { ylabel: 'per 100,000', ymin: 0, width: 560, height: 240, xticks: crt.map(function (r) { return r.year; }) }), 'Source: district-court cause lists · ' + D.outcomes.court_note));
      O.appendChild(g2);
    }
  }
  Promise.all([C.loadPaper(paper), C.fetchJSON('data/descriptives.json')]).then(function (r) { D = r[1]; render(); }).catch(function (e) { sec('migration-root').innerHTML = '<p class="notice warn">Could not load descriptives: ' + C.esc(e.message) + '</p>'; });
})();

/* results-core.js: shared result loading, lookups, formatting, equation and
   table builders used by the Overview, Results and Diagnostics pages. */
(function () {
  'use strict';
  var C = window.NMN = window.NMN || {};

  C.loadPaper = function (paperId) {
    return Promise.all([C.fetchJSON('data/config.json'), C.fetchJSON('data/results_' + paperId + '.json')])
      .then(function (r) {
        C.config = r[0]; C.paperId = paperId;
        // expand compact column-oriented result file
        var raw = r[1], cols = raw.columns, sm = raw.spec_meta || {};
        C.results = raw.rows.map(function (row) {
          var o = {}; for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i];
          var m = sm[o.spec_id]; if (m) for (var k in m) o[k] = m[k];
          o.paper = raw.paper; o.generated_at = raw.generated_at; o.git_commit = raw.git_commit;
          o.result_id = o.spec_id + '.' + o.outcome_id + '.' + o.term;
          return o;
        });
        C.paperCfg = C.config.papers.filter(function (p) { return p.id === paperId; })[0];
        C.families = C.config.outcomes[paperId];
        C.defaults = C.config.defaults[paperId];
        C.index = {};
        C.results.forEach(function (r) { (C.index[r.spec_id] = C.index[r.spec_id] || []).push(r); });
        return C;
      });
  };

  C.TERM_ORDER = ['Z_total', 'Z_male', 'Z_female', 'husband_is_away'];
  // preferred selection for a family (paper defaults, admin adjustments)
  C.preferredSel = function (fam) {
    var d = C.defaults;
    var trs = [].concat((C.config.treatments_by_paper || {})[C.paperId] || ['total']);
    return { share: d.share, shift: d.shifter, treatment: trs.indexOf(d.treatment) >= 0 ? d.treatment : trs[0], controls: d.controls, sample: 'main',
             estimator: fam.type === 'admin' ? (d.estimator_admin || 'ols_rate') : d.estimator, weight: fam.type === 'admin' ? 'none' : d.weight };
  };
  // ladder columns (main results): config main_results.*_ladder applied on top of the preferred selection
  C.ladderColumns = function (fam, base) {
    var mr = C.config.main_results || {};
    var lad = fam.type === 'admin' ? mr.admin_ladder : (fam.cross_section ? mr.cross_section_ladder : mr.dhs_ladder) || [];
    base = base || C.preferredSel(fam);
    return lad.map(function (o, i) { var sel = Object.assign({}, base, o); return { label: '(' + (i + 1) + ')', sel: sel, spec: o }; })
              .filter(function (c) { return C.rowsFor(fam.id, c.sel).length; });
  };
  // ---- lookups ---------------------------------------------------------------
  C.byId = function (list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; };
  C.family = function (id) { return C.byId(C.families, id); };
  C.outcome = function (famId, ocId) { var f = C.family(famId); return f ? C.byId(f.outcomes, ocId) : null; };
  C.shareLabel = function (id) { var s = C.byId(C.config.shares, id); return s ? s.display_name.replace(/^Migration share: /, '') : id; };
  C.shifter = function (id) { return C.byId(C.config.shifters, id); };
  C.shifterLabel = function (id) { var s = C.shifter(id); return s ? s.display_name : id; };
  C.label = function (list, id) { var x = C.byId(list, id); return x ? x.display_name : id; };
  C.specId = function (famId, s) {
    return [C.paperId, famId, s.share, s.shift, s.treatment, s.controls, s.sample, s.estimator, s.weight].join('.');
  };

  // ---- formatting ------------------------------------------------------------
  C.fmt = function (x, d) {
    if (x == null || isNaN(x)) return '—';
    d = d == null ? 3 : d;
    if (Math.abs(x) >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d);
  };
  C.fmtInt = function (x) { return x == null ? '—' : Number(x).toLocaleString('en-US'); };
  C.stars = function (p) { if (p == null || isNaN(p)) return ''; return p < 0.01 ? '***' : p < 0.05 ? '**' : p < 0.10 ? '*' : ''; };
  C.fmtP = function (p) { if (p == null || isNaN(p)) return '—'; return p < 0.001 ? '<0.001' : p.toFixed(3); };
  // decimals: coefficients on binary outcomes are small; choose by magnitude of |beta| and se
  C.decimals = function (rows) {
    var m = 0; rows.forEach(function (r) { if (r && r.se) m = Math.max(m, Math.abs(r.beta), r.se); });
    if (m === 0) return 3;
    if (m < 0.01) return 4;
    if (m < 1) return 3;
    if (m < 10) return 2;
    return 1;
  };

  // ---- availability ------------------------------------------------------------
  // Which option values exist in the result set given the other fixed choices (for one family)
  C.available = function (famId, sel, dim) {
    var keys = { share: 'share_id', shift: 'shifter_id', treatment: 'treatment_id', controls: 'control_id', sample: 'sample_id', estimator: 'estimator', weight: 'weight_id' };
    var set = {};
    C.results.forEach(function (r) {
      if (r.outcome_family !== famId) return;
      for (var k in keys) { if (k === dim) continue; if (sel[k] !== 'compare' && r[keys[k]] !== sel[k]) return; }
      set[r[keys[dim]]] = true;
    });
    return set;
  };
  C.anyForFamily = function (famId) { return C.results.some(function (r) { return r.outcome_family === famId; }); };

  // ---- rows for a spec --------------------------------------------------------
  C.rowsFor = function (famId, sel) {
    var id = C.specId(famId, sel);
    return C.index[id] || [];
  };

  // ---- equations (KaTeX strings) ------------------------------------------------
  C.equations = function (famId, sel) {
    var fam = C.family(famId), admin = fam && fam.type === 'admin', cs = fam && fam.cross_section;
    var gendered = sel.treatment === 'gendered';
    var sf = C.shifter(sel.shift), idx = '\\text{' + (sf ? (sf.short || 'Index').replace(/[^A-Za-z0-9-]/g, '') : 'Index') + '}';
    var ctrl = (!admin && sel.controls !== 'minimal') ? " + \\underbrace{X_{idt}'\\theta}_{\\text{individual controls}}" : '';
    var fe = cs ? "\\underbrace{\\alpha_{r}}_{\\text{region FE}}" : "\\underbrace{\\alpha_d}_{\\text{district FE}} + \\underbrace{\\delta_t}_{\\text{year FE}}";
    var main = gendered
      ? "\\underbrace{\\beta_M\\, \\text{MigRate}^{M}_{d}\\times " + idx + "^{M}_{d,t-2}}_{\\text{male migration}} + \\underbrace{\\beta_F\\, \\text{MigRate}^{F}_{d}\\times " + idx + "^{F}_{d,t-2}}_{\\text{female migration}} + \\underbrace{\\gamma_M " + idx + "^{M}_{d,t-2} + \\gamma_F " + idx + "^{F}_{d,t-2}}_{\\text{index main effects}}"
      : "\\underbrace{\\beta_3\\, \\text{MigRate}_{d}\\times " + idx + "_{d,t-2}}_{\\text{reported}} + \\underbrace{\\beta_2\\, " + idx + "_{d,t-2}}_{\\text{index main effect}}";
    var trends = (sel.controls === 'trends' || sel.controls === 'full') && !cs ? (admin ? " + \\underbrace{\\phi_{prov}\\, t}_{\\text{province trends}}" : " + \\underbrace{\\lambda_{r}\\, t}_{\\text{regional trends}}") : '';
    var dest = sel.controls === 'full' ? " + \\underbrace{C_{dt}'\\kappa}_{\\text{destination controls}}" : '';
    var y = admin ? 'Y_{dt}' : 'Y_{idt}', eps = admin ? '\\varepsilon_{dt}' : '\\varepsilon_{idt}';
    if (gendered) return ["\\begin{aligned} " + y + " &= " + main + " \\\\ &\\quad " + (ctrl + trends + dest + " + " + fe + " + " + eps) + " \\end{aligned}"];
    return [y + " = " + main + ctrl + trends + dest + " + " + fe + " + " + eps];
  };
  C.termHTML = function (t) { return C.esc(t).replace(/_([A-Za-z]+)/g, '<sub>$1</sub>').replace(/\^([A-Za-z]+)/g, '<sup>$1</sup>'); };
  // term glossary for the annotated equation
  C.termItems = function (famId, sel) {
    var fam = C.family(famId), admin = fam && fam.type === 'admin', cs = fam && fam.cross_section, sh = C.byId(C.config.shares, sel.share), sf = C.shifter(sel.shift);
    var items = [
      [admin ? 'Y_dt' : 'Y_idt', admin ? 'outcome rate per 100,000 in unit d (local government or district), year t' : 'outcome of respondent i in district d, survey year t'],
      ['Z_dt', 'exposure = M_d × W̃_dt: annual permits per 1,000 residents (' + (sh ? sh.years_label : sel.share) + ') × standardised share-weighted destination index'],
      ['W̃_dt', (sf ? sf.display_name : sel.shift) + ' at t−2, share-weighted over destinations and standardised; its main effect is always included'],
      ['β', 'effect of one permit per 1,000 residents at a one-SD higher destination index; magnitude = β × IQR(M_d)']
    ];
    if (!admin && sel.controls !== 'minimal') items.push(['X_idt', 'age, years of schooling, urban residence, wealth quintile']);
    if (sel.controls === 'full') items.push(['C_dt', 'share-weighted destination controls: log GDP per capita, unemployment, female LFP, women in parliament, fertility, education spending, resource rents (t−2, standardised)']);
    items.push(cs ? ['α_r', 'development-region fixed effects (single-wave cross-section)'] : [admin ? 'α_d, δ_t' : 'α_d, δ_t', (admin ? 'unit' : 'district') + ' and ' + (admin ? 'year' : 'survey-year') + ' fixed effects']);
    if (sel.treatment === 'gendered') items.push(['Z^M, Z^F', 'exposure built from male and female permits separately; H₀: β_M = β_F tested beneath the table']);
    return items;
  };
  C.renderMath = function (container, eqs, attempt) {
    attempt = attempt || 0;
    container.innerHTML = '';
    eqs.forEach(function (tex) {
      var div = document.createElement('div'); div.className = 'eq';
      if (window.katex) { try { window.katex.render(tex, div, { displayMode: true, throwOnError: false }); } catch (e) { div.textContent = tex; } }
      else { div.className = 'eq eq-fallback'; div.textContent = tex; }
      container.appendChild(div);
    });
    // KaTeX is loaded with defer; if it is not ready yet, re-render once it arrives (up to ~10 s)
    if (!window.katex && attempt < 50) setTimeout(function () { if (container.isConnected) C.renderMath(container, eqs, attempt + 1); }, 200);
  };

  // ---- specification summary ---------------------------------------------------
  C.summaryItems = function (famId, sel, rows) {
    var fam = C.family(famId), sh = C.byId(C.config.shares, sel.share), sf = C.shifter(sel.shift);
    var r0 = rows[0] || {};
    var ns = rows.map(function (r) { return r.n; });
    var nTxt = rows.length ? (Math.min.apply(null, ns) === Math.max.apply(null, ns) ? C.fmtInt(r0.n) : C.fmtInt(Math.min.apply(null, ns)) + '–' + C.fmtInt(Math.max.apply(null, ns))) : '—';
    return [
      ['Share', (sh ? sh.years_label : sel.share) + ' destination shares' + (sel.treatment === 'gendered' ? ' (male, female)' : '') + ' × baseline intensity M'],
      ['Shift', (sf ? sf.display_name : sel.shift) + ' at t−2, standardised'],
      ['Weight', r0.weight_label || C.label(C.config.weights, sel.weight)],
      ['Fixed effects', r0.fixed_effects || '—'],
      ['Controls', C.controlsLabel(sel)],
      ['SE', r0.cluster ? 'clustered at ' + r0.cluster.replace(' (75-scheme)', '') : '—'],
      ['Years', r0.waves || '—']
    ];
  };

  C.controlsLabel = function (sel) {
    var lad = (C.config.ladder || ['minimal', 'baseline', 'destctl', 'full']);
    var i = lad.indexOf(sel.controls);
    var names = { minimal: 'baseline (fixed effects only)', baseline: '+ individual controls', trends: '+ individual controls + regional trends', full: '+ individual controls + regional trends + destination controls' };
    return (i >= 0 ? 'column (' + (i + 1) + '): ' : '') + (names[sel.controls] || sel.controls);
  };
  // ---- regression table --------------------------------------------------------
  // columns: array of {label, sel} ; returns {table: HTMLElement, flat: [...rows for export]}
  C.buildTable = function (famId, columns, opts) {
    opts = opts || {};
    var fam = C.family(famId);
    var outcomes = fam.outcomes.filter(function (o) { return !(o.level_only && columns.every(function (c) { return c.sel.estimator === 'stacked'; })); });
    if (!opts.allOutcomes && outcomes.some(function (o) { return o.key; })) outcomes = outcomes.filter(function (o) { return o.key; });
    var colRows = columns.map(function (c) { return C.rowsFor(famId, c.sel); });
    var anyRows = colRows.some(function (r) { return r.length; });
    var wrap = C.el('div', { class: 'table-wrap' });
    if (!anyRows) {
      wrap.appendChild(C.el('p', { class: 'notice warn', text: 'No estimates exist for this combination. The pipeline did not estimate it (see the grid rules in config/specifications.yml); choose another option.' }));
      return { table: wrap, flat: [] };
    }
    var allRows = [].concat.apply([], colRows);
    var dec = C.decimals(allRows);
    var TERM_ORDER = ['Z_total', 'Z_male', 'Z_female', 'husband_is_away'];
    var terms = (opts.terms || uniq(allRows.map(function (r) { return r.term; }))).slice().sort(function (a, b) { return TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b); });
    var table = C.el('table', { class: 'reg' });
    if (opts.caption !== '') { var cap = C.el('caption', { text: opts.caption || fam.display_name }); table.appendChild(cap); }
    var thead = C.el('thead');
    var showMean = opts.showMean !== false;
    var tr1 = C.el('tr'); tr1.appendChild(C.el('th', { class: 'rowlab colno', scope: 'col' }));
    columns.forEach(function (c, i) { tr1.appendChild(C.el('th', { class: 'colno', scope: 'col', text: '(' + (i + 1) + ')' })); });
    if (showMean) { tr1.appendChild(C.el('th', { class: 'colno', scope: 'col' })); tr1.appendChild(C.el('th', { class: 'colno', scope: 'col' })); }
    var numericHeads = columns.every(function (c) { return /^\(\d+\)$/.test(c.label); });
    var cn = C.config.column_names || {};
    var tr2 = C.el('tr', { class: 'colnames' }); tr2.appendChild(C.el('th', { class: 'rowlab', scope: 'col', text: opts.rowHeader || 'Outcome' }));
    columns.forEach(function (c) { tr2.appendChild(C.el('th', { scope: 'col', text: numericHeads ? (c.sublabel || cn[c.sel.controls] || '') : c.label })); });
    if (showMean) { tr2.appendChild(C.el('th', { scope: 'col', class: 'meancol', text: 'Mean' })); tr2.appendChild(C.el('th', { scope: 'col', class: 'meancol', text: 'N' })); }
    thead.appendChild(tr1); thead.appendChild(tr2); table.appendChild(thead);
    var tbody = C.el('tbody');
    var flat = [];
    var nRows = {}, fsF = {};
    outcomes.forEach(function (oc) {
      var present = colRows.some(function (rows) { return rows.some(function (r) { return r.outcome_id === oc.id; }); });
      if (!present) return;
      var multi = terms.length > 1;
      if (multi) {
        var trh = C.el('tr', { class: 'coef grp' });
        var thh = C.el('th', { class: 'rowlab', scope: 'rowgroup' }); thh.appendChild(C.el('span', { class: 'outcome-def', title: oc.definition || '', text: oc.label })); trh.appendChild(thh);
        columns.forEach(function () { trh.appendChild(C.el('td')); });
        if (showMean) { var mr0 = colRows.map(function (rows) { return rows.filter(function (r) { return r.outcome_id === oc.id; })[0]; }).filter(Boolean).pop(); trh.appendChild(C.el('td', { class: 'num meancol', text: mr0 && mr0.depvar_mean != null ? C.fmt(mr0.depvar_mean, 3) : '' })); trh.appendChild(C.el('td', { class: 'num meancol', text: mr0 ? C.fmtInt(mr0.n) : '' })); }
        tbody.appendChild(trh);
      }
      terms.forEach(function (term, ti) {
        var cells = columns.map(function (c, ci) { return colRows[ci].filter(function (r) { return r.outcome_id === oc.id && r.term === term; })[0] || null; });
        if (!cells.some(Boolean)) return;
        var lab = multi ? '\u2003' + termShort(term).replace(/^\w/, function (ch) { return ch.toUpperCase(); }) : oc.label;
        var trc = C.el('tr', { class: 'coef' + (multi ? ' sub' : '') });
        var th = C.el('th', { class: 'rowlab', scope: 'row' });
        var span = C.el('span', { class: multi ? '' : 'outcome-def', title: multi ? '' : (oc.definition || ''), text: lab }); th.appendChild(span); trc.appendChild(th);
        var trs = C.el('tr', { class: 'se' }); trs.appendChild(C.el('th', { class: 'rowlab', scope: 'row', 'aria-label': 'standard error' }));
        cells.forEach(function (r, ci) {
          if (!r) { trc.appendChild(C.el('td', { class: 'num na', text: '—' })); trs.appendChild(C.el('td', { class: 'num' })); return; }
          var td = C.el('td', { class: 'num' });
          td.appendChild(document.createTextNode(C.fmt(r.beta, dec)));
          var st = C.stars(r.p_value); if (st) td.appendChild(C.el('span', { class: 'stars', text: st }));
          trc.appendChild(td);
          trs.appendChild(C.el('td', { class: 'num', text: '(' + C.fmt(r.se, dec) + ')' }));
          nRows[ci] = nRows[ci] || {}; nRows[ci][oc.id] = r.n;
          if (r.first_stage_f != null) fsF[ci] = r.first_stage_f;
          flat.push({ column: ci + 1, column_label: columns[ci].label, outcome_id: oc.id, outcome_label: oc.label, term: term, beta: r.beta, se: r.se, p_value: r.p_value, stars: st, n: r.n, depvar_mean: r.depvar_mean, scaled_beta: r.scaled_beta, effect_pct: r.effect_pct, p_channel_equality: r.p_channel_equality, spec_id: r.spec_id, result_id: r.result_id });
        });
        if (showMean) {
          var mr = cells.filter(Boolean).pop();
          trc.appendChild(C.el('td', { class: 'num meancol', text: (!multi && mr && mr.depvar_mean != null && ti === 0) ? C.fmt(mr.depvar_mean, 3) : '' }));
          trc.appendChild(C.el('td', { class: 'num meancol', text: (!multi && mr && ti === 0) ? C.fmtInt(mr.n) : '' }));
          trs.appendChild(C.el('td', { class: 'num meancol' })); trs.appendChild(C.el('td', { class: 'num meancol' }));
        }
        tbody.appendChild(trc); tbody.appendChild(trs);
      });
      // channel-equality line for gendered
      if (terms.length > 1 && opts.showEquality !== false) {
        var cellsEq = columns.map(function (c, ci) { return colRows[ci].filter(function (r) { return r.outcome_id === oc.id && r.p_channel_equality != null; })[0] || null; });
        if (cellsEq.some(Boolean)) {
          var tre = C.el('tr', { class: 'se' }); tre.appendChild(C.el('th', { class: 'rowlab', scope: 'row', text: '\u2003p (male = female)' }));
          cellsEq.forEach(function (r) { tre.appendChild(C.el('td', { class: 'num', text: r ? C.fmtP(r.p_channel_equality) : '' })); });
          if (showMean) { tre.appendChild(C.el('td')); tre.appendChild(C.el('td')); }
          tbody.appendChild(tre);
        }
      }
    });
    table.appendChild(tbody);
    // stats block
    var stats = C.el('tbody', { class: 'stats' });
    var addStat = function (label, vals) { var tr = C.el('tr'); tr.appendChild(C.el('th', { class: 'rowlab', scope: 'row', text: label })); vals.forEach(function (v) { tr.appendChild(C.el('td', { class: 'num', text: v })); }); if (showMean) { tr.appendChild(C.el('td')); tr.appendChild(C.el('td')); } stats.appendChild(tr); };
    // N is reported per regression in the last column of each row (identical across ladder columns by construction)
    var r0s = columns.map(function (c, ci) { return colRows[ci][0] || null; });
    if (fam.cross_section) addStat('Region FE', r0s.map(function (r) { return r ? 'Yes' : '—'; }));
    else { addStat(fam.type === 'admin' ? (fam.unit_var === 'lgcode' ? 'Local-government FE' : 'District FE') : 'District FE', r0s.map(function (r) { return r ? 'Yes' : '—'; })); addStat('Year FE', r0s.map(function (r) { return r ? 'Yes' : '—'; })); }
    if (fam.type !== 'admin') {
      addStat('Individual controls', columns.map(function (c) { return c.sel.controls === 'minimal' ? 'No' : 'Yes'; }));
      if (!fam.cross_section) addStat('Regional trends', columns.map(function (c) { return (c.sel.controls === 'trends' || c.sel.controls === 'full') ? 'Yes' : 'No'; }));
      addStat('Destination controls', columns.map(function (c) { return c.sel.controls === 'full' ? 'Yes' : 'No'; }));
    } else {
      addStat('Province trends', columns.map(function (c) { return (c.sel.controls === 'trends' || c.sel.controls === 'full') ? 'Yes' : 'No'; }));
      addStat('Destination controls', columns.map(function (c) { return c.sel.controls === 'full' ? 'Yes' : 'No'; }));
    }
    table.appendChild(stats);
    wrap.appendChild(table);
    return { table: wrap, flat: flat, decimals: dec };
  };
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { var k = String(x); if (!s[k]) { s[k] = 1; o.push(x); } }); return o; }
  function termShort(t) { return t === 'Z_male' ? 'male channel' : t === 'Z_female' ? 'female channel' : t === 'Z_total' ? 'total channel' : t === 'husband_is_away' ? 'husband away' : t; }
  C.termShort = termShort; C.uniq = uniq;

  // ---- notes ------------------------------------------------------------------
  C.notesHTML = function (famId, sel, rows) {
    var fam = C.family(famId), r0 = rows[0] || {}, sh = C.byId(C.config.shares, sel.share), sf = C.shifter(sel.shift);
    var parts = [];
    parts.push('Each cell reports ' + (sel.treatment === 'gendered' ? 'β_M and β_F' : 'β₃') + ' from a separate regression; standard errors in parentheses, clustered by district. * p<0.10, ** p<0.05, *** p<0.01.');
    parts.push('MigRate = annual permits per 1,000 residents (' + (sh ? sh.years_label : sel.share) + '); Index = ' + (sf ? sf.display_name : sel.shift) + ' at t−2, share-weighted and standardised. ' + (fam.type === 'admin' ? 'Outcomes are rates per 100,000; OLS with ' + (r0.fixed_effects || 'unit and year') + ' fixed effects, unweighted.' : 'OLS with ' + (r0.fixed_effects || 'district and survey-year') + ' fixed effects, ' + (r0.weight_label || 'DHS sampling weights') + '.') + ' Years: ' + (r0.waves || '') + '. Columns add controls cumulatively; samples are identical across columns.');
    if (fam.design_note && fam.design_note.indexOf('No comparable pre-period') === 0) parts.push('Comparable pre-period: not available (post-period exposure specification).');
    else if (fam.type === 'dhs' && [].concat(fam.waves || []).indexOf(2011) < 0 && !fam.cross_section) parts.push('DHS 2011 excluded.');
    return parts.map(function (p) { return '<p>' + p + '</p>'; }).join('');
  };

  // ---- downloads ---------------------------------------------------------------
  C.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  C.toCSV = function (rows) {
    if (!rows.length) return '';
    var keys = Object.keys(rows[0]);
    var esc = function (v) { if (v == null) return ''; v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return keys.join(',') + '\n' + rows.map(function (r) { return keys.map(function (k) { return esc(r[k]); }).join(','); }).join('\n') + '\n';
  };
  C.toLaTeX = function (famId, columns, flat, dec, caption, notes) {
    var fam = C.family(famId);
    var TERM_ORDER = ['Z_total', 'Z_male', 'Z_female', 'husband_is_away'];
    var terms = C.uniq(flat.map(function (r) { return r.term; })).sort(function (a, b) { return TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b); });
    var out = [];
    out.push('% Generated by the nepal-mig-norms website build. Spec IDs: ' + C.uniq(flat.map(function (r) { return r.spec_id; })).join('; '));
    out.push('\\begin{table}[htbp]\\centering');
    out.push('\\caption{' + texEsc(caption) + '}');
    out.push('\\begin{tabular}{l' + columns.map(function () { return 'c'; }).join('') + '}');
    out.push('\\toprule');
    out.push(' & ' + columns.map(function (c, i) { return '(' + (i + 1) + ')'; }).join(' & ') + ' \\\\');
    out.push(' & ' + columns.map(function (c) { return texEsc(c.label); }).join(' & ') + ' \\\\');
    out.push('\\midrule');
    var ocs = C.uniq(flat.map(function (r) { return r.outcome_id; }));
    ocs.forEach(function (oid) {
      terms.forEach(function (t) {
        var cells = columns.map(function (c, ci) { return flat.filter(function (r) { return r.outcome_id === oid && r.term === t && r.column === ci + 1; })[0]; });
        if (!cells.some(Boolean)) return;
        var lab = (C.outcome(famId, oid) || { label: oid }).label + (terms.length > 1 ? ' --- ' + termShort(t) : '');
        out.push(texEsc(lab) + ' & ' + cells.map(function (r) { return r ? C.fmt(r.beta, dec) + (r.stars ? '$^{' + r.stars.replace(/\*/g, '*') + '}$' : '') : ''; }).join(' & ') + ' \\\\');
        out.push(' & ' + cells.map(function (r) { return r ? '(' + C.fmt(r.se, dec) + ')' : ''; }).join(' & ') + ' \\\\');
      });
    });
    out.push('\\midrule');
    out.push('Observations & ' + columns.map(function (c, ci) { var ns = flat.filter(function (r) { return r.column === ci + 1; }).map(function (r) { return r.n; }); if (!ns.length) return ''; var mn = Math.min.apply(null, ns), mx = Math.max.apply(null, ns); return mn === mx ? mn : mn + '--' + mx; }).join(' & ') + ' \\\\');
    out.push('\\bottomrule');
    out.push('\\end{tabular}');
    out.push('\\begin{minipage}{\\linewidth}\\footnotesize ' + texEsc(notes.replace(/<[^>]+>/g, ' ')) + '\\end{minipage}');
    out.push('\\end{table}');
    return out.join('\n') + '\n';
  };
  function texEsc(s) { return String(s).replace(/\\/g, '\\textbackslash{}').replace(/([%&#_{}$])/g, '\\$1').replace(/×/g, '$\\times$').replace(/≥/g, '$\\geq$').replace(/≤/g, '$\\leq$').replace(/−/g, '--').replace(/β/g, '$\\beta$'); }
  C.texEsc = texEsc;

  // ---- URL state ---------------------------------------------------------------
  C.readURL = function (keys) {
    var p = new URLSearchParams(window.location.search), o = {};
    keys.forEach(function (k) { var v = p.get(k); if (v) o[k] = v; });
    return o;
  };
  C.writeURL = function (state, replace) {
    var p = new URLSearchParams();
    Object.keys(state).forEach(function (k) { if (state[k] != null) p.set(k, state[k]); });
    var url = window.location.pathname + '?' + p.toString();
    if (replace) history.replaceState(state, '', url); else history.pushState(state, '', url);
  };
})();

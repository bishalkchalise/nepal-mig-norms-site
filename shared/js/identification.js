/* identification.js: Identification page: QUESTION → phrase → visual, from
   diagnostics.json (R: analysis/common/diagnostics.R) and the result file. */
(function () {
  'use strict';
  var C = window.NMN, D = null, sel = {};
  var NAMES = { QAT: 'Qatar', SAU: 'Saudi Arabia', MYS: 'Malaysia', ARE: 'UAE', KWT: 'Kuwait', BHR: 'Bahrain', OMN: 'Oman', JPN: 'Japan', KOR: 'Korea', ISR: 'Israel', CYP: 'Cyprus', LBN: 'Lebanon', HKG: 'Hong Kong', JOR: 'Jordan', AFG: 'Afghanistan', MDV: 'Maldives', POL: 'Poland', ROU: 'Romania', HRV: 'Croatia', MLT: 'Malta', USA: 'United States', GBR: 'United Kingdom', AUS: 'Australia', TUR: 'Türkiye' };
  var nm = function (iso) { return NAMES[iso] || iso; };
  var COV = { age: 'age', educ_years: 'years of schooling', urban: 'urban residence', literate_bin: 'literate', contracept_any: 'any contraception', children: 'children ever born', employed: 'worked last 12 months',
              gdp_pc: 'log GDP per capita', unemp_total: 'unemployment rate', female_lfp: 'female LFP', parl_female: 'women in parliament', fertility: 'fertility rate', educ_spend: 'education spending (% GDP)', resource_rent: 'resource rents (% GDP)' };
  var cv = function (k) { return COV[k] || k; };
  function opt(v, l) { var o = document.createElement('option'); o.value = v; o.textContent = l; return o; }
  function q(id, question, phrase) { var s = document.getElementById(id); s.innerHTML = ''; s.appendChild(C.el('h2', { text: question })); if (phrase) s.appendChild(C.el('p', { class: 'phrase', text: phrase })); return s; }
  function table(headers, rows, numFrom) {
    var t = C.el('table', { class: 'plain compact' }), th = C.el('thead'), tr = C.el('tr');
    headers.forEach(function (h) { tr.appendChild(C.el('th', { text: h })); }); th.appendChild(tr); t.appendChild(th);
    var tb = C.el('tbody'); rows.forEach(function (r) { var x = C.el('tr'); r.forEach(function (c, i) { x.appendChild(C.el('td', { text: c, style: i >= (numFrom == null ? 1 : numFrom) ? 'text-align:right;font-variant-numeric:tabular-nums' : '' })); }); tb.appendChild(x); });
    t.appendChild(tb); var w = C.el('div', { class: 'table-wrap' }); w.appendChild(t); return w;
  }
  var fig = C.charts.figure;
  function eq(tex) { var d = C.el('div', { class: 'equations' }); C.renderMath(d, [tex]); return d; }

  function init() {
    var d = C.defaults, u = C.readURL(['outcome', 'treatment']);
    var heads = C.paperCfg.headline.filter(function (h) { return C.outcome(h.family, h.outcome); });
    sel = { outcome: u.outcome || (heads[0].family + ':' + heads[0].outcome), treatment: u.treatment || d.treatment };
    var so = document.getElementById('diag-outcome'); heads.forEach(function (h) { so.appendChild(opt(h.family + ':' + h.outcome, C.outcome(h.family, h.outcome).label + ' (' + C.family(h.family).display_name + ')')); }); so.value = sel.outcome;
    var st = document.getElementById('diag-treatment'); C.config.treatments.forEach(function (t) { st.appendChild(opt(t.id, t.display_name)); }); st.value = sel.treatment;
    ['outcome', 'treatment'].forEach(function (k) { document.getElementById('diag-' + k).addEventListener('change', function (e) { sel[k] = e.target.value; C.writeURL(sel); render(); }); });
    window.addEventListener('popstate', function () { var uu = C.readURL(['outcome', 'treatment']); Object.keys(uu).forEach(function (k) { sel[k] = uu[k]; document.getElementById('diag-' + k).value = uu[k]; }); render(); });
    C.writeURL(sel, true); render();
  }

  function render() {
    var parts = sel.outcome.split(':'), famId = parts[0], ocId = parts[1], fam = C.family(famId), oc = C.outcome(famId, ocId);
    var d = C.defaults, chans = sel.treatment === 'gendered' ? ['male', 'female'] : ['total'];
    var est = fam.type === 'admin' ? 'stacked' : 'rf', ctl = fam.type === 'admin' ? 'minimal' : d.controls, wt = fam.type === 'admin' ? 'none' : 'dhs';
    var pick = function (r) { return r.outcome_family === famId && r.outcome_id === ocId && r.treatment_id === sel.treatment && r.estimator === est && r.control_id === ctl && r.sample_id === 'main' && r.weight_id === wt; };

    // 1. Why do districts differ in destination composition?
    var s1 = q('q-why-differ', 'Why do districts differ in destination composition?', 'Recruitment-agent networks and early movers fixed each district’s corridor mix before the destination policy changes; shares are measured in ' + C.shareLabel(d.share) + ' and held fixed.');
    chans.forEach(function (ch) { var e = D.concentration.filter(function (x) { return x.share_id === d.share && x.channel === ch; })[0]; if (!e) return;
      s1.appendChild(fig('Top destinations by mean district share: ' + ch + ' channel', C.charts.barPlot(e.top.slice(0, 8).map(function (t) { return { label: nm(t.iso3), value: t.mean_share }; }), { fmt: function (v) { return (100 * v).toFixed(1) + '%'; }, ml: 130 }), 'HHI ' + C.fmt(e.hhi_mean, 3) + ' · effective destinations ' + C.fmt(e.eff_n_mean, 1) + ' · ' + e.n_districts + ' districts')); });
    // 2. balance
    var s2 = q('q-balance', 'Are baseline destination shares correlated with district characteristics?', '2001 DHS district means regressed on ' + D.meta.reference_year + ' exposure Z (default share × shifter), 75 districts, robust SEs.');
    var brows = D.balance.filter(function (r) { return r.paper === C.paperId && chans.indexOf(r.channel) >= 0; });
    if (brows.length) { s2.appendChild(fig(null, C.charts.dotPlot(brows.map(function (r) { return { label: cv(r.covariate) + (chans.length > 1 ? ': ' + r.channel : ''), beta: r.beta * r.sd_z / r.sd_y, se: r.se * r.sd_z / r.sd_y, p: r.p_value, n: r.n }; }), { xlabel: 'SD(Z) effect in SD units of the 2001 covariate, 95% CI', ml: 220 }), 'Source: diagnostics file · balance regressions')); }
    else s2.appendChild(C.el('p', { class: 'muted', text: 'Not computed.' }));
    // 3. shifter vs macro
    var s3 = q('q-shifter-macro', 'Are destination policy changes correlated with destination economic shocks?', 'Destination × year regressions of the index on each WDI control, with destination and year fixed effects (top 25 destinations, 1999–2023; SEs clustered by destination). Coefficients in SD of the index per SD of the control.');
    var mrows = (D.shifter_macro || []).filter(function (r) { return r.shifter_id === d.shifter; });
    if (mrows.length) s3.appendChild(fig(null, C.charts.dotPlot(mrows.map(function (r) { return { label: cv(r.control), beta: r.beta * r.sd_x / r.sd_y, se: r.se * r.sd_x / r.sd_y, p: r.p_value, n: r.n }; }), { xlabel: 'standardised coefficient, 95% CI: ' + C.shifterLabel(d.shifter), ml: 160 }), 'Destination controls enter the Full column; this checks how much of the index they could absorb.'));
    else s3.appendChild(C.el('p', { class: 'muted', text: 'Not computed.' }));
    // 4–5. equations
    var s4 = q('q-main-effect', 'Why include the share-weighted shifter main effect?', 'β is identified from intensity × shifter; γW̃ absorbs the part of the destination change that reaches every district regardless of migration depth.');
    s4.appendChild(eq('Y_{idt} = \\beta\\,(M_d \\times \\tilde W_{dt}) + \\gamma\\,\\tilde W_{dt} + \\alpha_d + \\delta_t + \\varepsilon_{idt}'));
    var s5 = q('q-intensity', 'What role does baseline migration intensity play?', 'M_d scales the destination shock by how much of the district is connected; its level is absorbed by α_d, so only the interaction identifies β. Magnitude = β × IQR(M_d).');
    s5.appendChild(eq('Z_{dt} = M_d \\times \\tilde W_{dt},\\qquad M_d = \\frac{\\text{annual permits}_d}{\\text{pop}_d/1000}'));
    // 6. contribution
    var s6 = q('q-contribution', 'Which destinations drive exposure?', 'Share of Var(Z) across district × DHS-wave cells attributable to each destination, cov(Z_p, Z)/Var(Z). Computed from the exposure panel, not assumed.');
    chans.forEach(function (ch) { var e = D.contribution.filter(function (x) { return x.share_id === d.share && x.shifter_id === d.shifter && x.channel === ch; })[0]; if (!e) return;
      s6.appendChild(fig(ch + ' channel: ' + C.shareLabel(d.share) + ', ' + C.shifterLabel(d.shifter), C.charts.barPlot(e.rows.slice(0, 10).map(function (t) { return { label: nm(t.iso3), value: t.cov_share }; }), { fmt: function (v) { return (100 * v).toFixed(1) + '%'; }, xlabel: 'share of Var(Z)', ml: 130 }), 'Source: diagnostics file')); });
    // 7. LOO
    var s7 = q('q-loo', 'Do results survive dropping major destinations?', 'Exposure rebuilt without one destination (shares re-normalised, its permits removed from M) and the preferred specification re-estimated: real regressions, reference outcome: ' + oc.label + '.');
    var lrows = D.loo.filter(function (r) { return r.paper === C.paperId && r.outcome_family === famId && r.outcome_id === ocId && r.treatment_id === sel.treatment; });
    if (!lrows.length) s7.appendChild(C.el('p', { class: 'muted', text: 'Not computed for this outcome/channel.' }));
    else C.uniq(lrows.map(function (r) { return r.term; })).forEach(function (term) { var rr = lrows.filter(function (r) { return r.term === term; });
      s7.appendChild(fig(rr.length > 1 && lrows.length > rr.length ? C.termShort(term) : null, C.charts.dotPlot(rr.map(function (r) { return { label: r.dropped === 'none' ? 'All destinations' : 'Drop ' + nm(r.dropped), beta: r.beta, se: r.se, p: r.p_value, n: r.n, highlight: r.dropped === 'none' }; }), { xlabel: 'β with 95% CI', ml: 200 }), 'Share ' + C.shareLabel(lrows[0].share_id) + ' · shifter ' + C.shifterLabel(lrows[0].shifter_id))); });
    // 8. windows
    var s8 = q('q-windows', 'Do alternative share windows matter?', 'Preferred specification re-estimated under each configured window; IQR(M) differs by window, so compare β × IQR(M) in the table.');
    var byWin = C.results.filter(function (r) { return pick(r) && r.shifter_id === d.shifter; });
    if (byWin.length) { C.uniq(byWin.map(function (r) { return r.term; })).forEach(function (term) { var rr = byWin.filter(function (r) { return r.term === term; }).sort(function (a, b) { return C.config.shares.findIndex(function (s) { return s.id === a.share_id; }) - C.config.shares.findIndex(function (s) { return s.id === b.share_id; }); });
      s8.appendChild(fig(byWin.length > rr.length ? C.termShort(term) : null, C.charts.dotPlot(rr.map(function (r) { var s = C.byId(C.config.shares, r.share_id); return { label: C.shareLabel(r.share_id) + (s && !s.primary ? ' (robustness)' : ''), beta: r.beta, se: r.se, p: r.p_value, n: r.n, highlight: r.share_id === d.share }; }), { xlabel: 'β with 95% CI', ml: 200 }), null));
      s8.appendChild(table(['Window', 'β', 'SE', 'p', 'IQR(M)', 'β × IQR(M)', 'N'], rr.map(function (r) { return [C.shareLabel(r.share_id), C.fmt(r.beta, 4), C.fmt(r.se, 4), C.fmtP(r.p_value), C.fmt(r.iqr_m, 2), C.fmt(r.scaled_beta, fam.type === 'admin' ? 1 : 4), C.fmtInt(r.n)]; }))); }); }
    // 9. shifters
    var s9 = q('q-shifters', 'Do alternative shifters matter?', 'Same specification with each configured destination index.');
    var byShf = C.results.filter(function (r) { return pick(r) && r.share_id === d.share; });
    if (byShf.length) C.uniq(byShf.map(function (r) { return r.term; })).forEach(function (term) { var rr = byShf.filter(function (r) { return r.term === term; });
      s9.appendChild(fig(byShf.length > rr.length ? C.termShort(term) : null, C.charts.dotPlot(rr.map(function (r) { return { label: C.shifterLabel(r.shifter_id), beta: r.beta, se: r.se, p: r.p_value, n: r.n, highlight: r.shifter_id === d.shifter }; }), { xlabel: 'β with 95% CI', ml: 240 }), null)); });
    // 10. placebo
    var s10 = q('q-placebo', 'Does future destination policy predict current outcomes?', 'Lead placebo: exposure rebuilt with W at t+2 instead of t−2.');
    var prows = D.placebo.filter(function (r) { return r.paper === C.paperId && r.outcome_family === famId && r.outcome_id === ocId && r.treatment_id === sel.treatment; });
    if (prows.length) { var items = []; prows.forEach(function (r) { items.push({ label: C.shifterLabel(r.shifter_id) + (prows.length > C.uniq(prows.map(function (x) { return x.shifter_id; })).length ? ': ' + C.termShort(r.term) : '') + ' · lag t−2', beta: r.beta_lag, se: r.se_lag, p: r.p_lag, n: r.n_lag, highlight: true }); items.push({ label: '· lead t+2 (placebo)', beta: r.beta_lead, se: r.se_lead, p: r.p_lead, n: r.n_lead }); });
      s10.appendChild(fig(null, C.charts.dotPlot(items, { xlabel: 'β with 95% CI', ml: 260 }), null)); }
    else s10.appendChild(C.el('p', { class: 'muted', text: 'Not computed.' }));
    // 12. sensitivity
    var s12 = q('q-sensitivity', 'Weights, clustering, samples', 'Same point estimate under alternative variance estimators; unweighted and sub-sample re-estimates.');
    var crows = D.clustering.filter(function (r) { return r.paper === C.paperId && r.outcome_family === famId && r.outcome_id === ocId && r.treatment_id === sel.treatment; });
    if (crows.length) s12.appendChild(table(['Term', 'Variance estimator', 'β', 'SE', 'p'], crows.map(function (r) { return [C.termShort(r.term), r.vcov === 'district' ? 'clustered: district (75)' : r.vcov === 'region5' ? 'clustered: development region (5)' : 'heteroskedasticity-robust', C.fmt(r.beta, 4), C.fmt(r.se, 4), C.fmtP(r.p_value)]; }), 2));
    var wrows = C.results.filter(function (r) { return r.outcome_family === famId && r.outcome_id === ocId && r.treatment_id === sel.treatment && r.estimator === est && r.control_id === ctl && r.share_id === d.share && r.shifter_id === d.shifter; });
    if (wrows.length) s12.appendChild(table(['Sample', 'Weight', 'Term', 'β', 'SE', 'p', 'N'], wrows.map(function (r) { return [C.label(C.config.samples, r.sample_id), C.label(C.config.weights, r.weight_id), C.termShort(r.term), C.fmt(r.beta, 4), C.fmt(r.se, 4), C.fmtP(r.p_value), C.fmtInt(r.n)]; }), 3));
    // 13. reproducibility
    var s13 = q('q-repro', 'Reproducibility', null);
    var b = C.config.build || {};
    s13.appendChild(table(['Item', 'Value'], [['Build id', b.build_id || ''], ['Results generated', (b.generated_at || '').slice(0, 19)], ['Analysis commit', b.git_commit || ''], ['Result rows (this paper)', C.fmtInt(C.results.length)], ['Spec ID of reference outcome', C.results.filter(pick).filter(function (r) { return r.share_id === d.share && r.shifter_id === d.shifter; }).map(function (r) { return r.spec_id; })[0] || '—']], 9));
    s13.appendChild(C.el('p', { class: 'small muted', html: 'Documentation: <a href="' + C.rel + 'docs/project_audit.html">audit</a> · <a href="' + C.rel + 'docs/theoharides_specification_crosswalk.html">crosswalk</a> · <a href="' + C.rel + 'docs/identification_notes.html">identification notes</a> · <a href="' + C.rel + 'docs/website_schema.html">schema</a> · <a href="' + C.rel + 'docs/final_qa.html">QA</a>' }));
  }
  Promise.all([C.loadPaper(window.SITE.paper), C.fetchJSON('data/diagnostics.json')]).then(function (r) { D = r[1]; init(); }).catch(function (e) { document.getElementById('diag-root').innerHTML = '<p class="notice warn">Could not load diagnostics: ' + C.esc(e.message) + '</p>'; });
})();

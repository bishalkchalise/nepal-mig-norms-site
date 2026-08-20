/* home.js: Overview abstract: fills {est:family:outcome:Label} tokens with the
   preferred-specification estimate from the result file (never typed by hand). */
(function () {
  'use strict';
  var C = window.NMN;
  var el = document.getElementById('abstract-text');
  C.loadPaper(window.SITE.paper).then(function () {
    var txt = el.textContent;
    var sentences = [];
    txt = txt.replace(/\{est:([a-z0-9_]+):([a-z0-9_]+):([^}]+)\}/g, function (m, fid, oid, label) {
      var fam = C.family(fid), oc = C.outcome(fid, oid); if (!fam || !oc) return '';
      var rows = C.rowsFor(fid, C.preferredSel(fam)).filter(function (r) { return r.outcome_id === oid; }).sort(function (a, b) { return C.TERM_ORDER.indexOf(a.term) - C.TERM_ORDER.indexOf(b.term); });
      if (!rows.length) return '';
      var dec = C.decimals(rows), parts = rows.map(function (r) { return (rows.length > 1 ? C.termShort(r.term) + ' ' : '') + C.fmt(r.beta, dec) + C.stars(r.p_value) + ' (SE ' + C.fmt(r.se, dec) + ')'; });
      sentences.push(label + ': β = ' + parts.join(', ') + ', N = ' + C.fmtInt(rows[0].n) + (rows[0].depvar_mean != null ? ', mean ' + C.fmt(rows[0].depvar_mean, 3) : '') + '.');
      return '';
    }).replace(/\s+/g, ' ').trim();
    el.textContent = txt;
    if (sentences.length) {
      var p = C.el('p', { class: 'abstract-results' });
      p.appendChild(C.el('strong', { text: 'Key estimates (preferred specification, column ' + (((C.config.main_results || {}).preferred_column || {}).dhs || 4) + '). ' }));
      p.appendChild(document.createTextNode(sentences.join(' ') + ' Stars: * p<0.10, ** p<0.05, *** p<0.01; SEs clustered by district; β per unit of exposure Z.'));
      el.parentNode.appendChild(p);
    }
  }).catch(function () { el.textContent = el.textContent.replace(/\{est:[^}]+\}/g, ''); });
})();

/* site.js: shared behaviour: nothing heavy. Marks current nav, exposes helpers. */
(function () {
  'use strict';
  window.NMN = window.NMN || {};
  // relative root ("" at site root, "../" inside a paper folder) injected by the build
  NMN.rel = (window.SITE && window.SITE.rel) || '';
  NMN.paper = (window.SITE && window.SITE.paper) || null;
  NMN.fetchJSON = function (path) {
    return fetch(NMN.rel + path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + path + ' (' + r.status + ')');
      return r.json();
    });
  };
  NMN.el = function (tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };
  NMN.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
})();

/* ============================================================
   Shinobi Atlas — single-page app (no dependencies)
   ============================================================ */
(function () {
  'use strict';
  const D = window.SHINOBI_ATLAS;
  const app = document.getElementById('app');

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const go = (hash) => { window.location.hash = hash; };

  const CAT_COLOR = {
    'Compute': '#38bdf8', 'Containers': '#818cf8', 'Storage': '#34d399', 'Database': '#22d3ee',
    'Messaging': '#f472b6', 'Networking': '#60a5fa', 'Security': '#fb7185', 'Observability': '#fbbf24',
    'Data & Analytics': '#2dd4bf', 'Machine Learning': '#a78bfa', 'Edge & CDN': '#fb923c', 'Identity': '#c084fc',
    'AI / ML': '#a78bfa', 'Infrastructure': '#60a5fa',
    'Identity & Access': '#c084fc', 'Network': '#60a5fa', 'Encryption': '#34d399',
    'Logging & Audit': '#fbbf24', 'Resilience': '#38bdf8', 'Data Protection': '#2dd4bf',
    'Cost': '#fb923c', 'Configuration': '#94a3b8',
  };
  const catColor = (c) => CAT_COLOR[c] || '#7c5cff';
  const STAGE_COLOR = { sky: '#38bdf8', cyan: '#22d3ee', violet: '#a78bfa', indigo: '#818cf8', amber: '#fbbf24', orange: '#fb923c', emerald: '#34d399' };

  /* ---------- icons ---------- */
  const I = {
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    cube: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
    flow: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4a3 3 0 0 1 3 3V14"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M19 3v18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/>',
    tick: '<path d="M20 6 9 17l-5-5"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 8h.01M7 17h.01"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/>',
    net: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M10 13l-3.5 3.5M14 13l3.5 3.5"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="13" y="7" width="3" height="10"/>',
    brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1V4a3 3 0 0 0-3-1Z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5 3 3 0 0 1-5 1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-3 3"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  };
  const CAT_ICON = {
    'Compute': 'bolt', 'Containers': 'cube', 'Storage': 'box', 'Database': 'db', 'Messaging': 'chat',
    'Networking': 'net', 'Security': 'shield', 'Observability': 'eye', 'Data & Analytics': 'chart',
    'Machine Learning': 'brain', 'Edge & CDN': 'globe', 'Identity': 'key',
    'AI / ML': 'brain', 'Infrastructure': 'layers',
    'Identity & Access': 'key', 'Network': 'net', 'Encryption': 'lock', 'Logging & Audit': 'eye',
    'Resilience': 'shield', 'Data Protection': 'lock', 'Cost': 'chart', 'Configuration': 'flow',
  };
  const svg = (name, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${cls || ''}">${I[name] || I.cube}</svg>`;
  const catIcon = (cat) => svg(CAT_ICON[cat] || 'cube');

  /* ---------- cross-links ---------- */
  const blueprintsUsing = (capId) => D.blueprints.filter((b) => (b.components || []).includes(capId));
  const capById = (id) => byId(D.capabilities, id);
  const polById = (id) => byId(D.policies, id);
  const SEV_RANK = { error: 3, warning: 2, info: 1, none: 0 };
  const topSeverity = (p) => ['FedRAMP-High', 'FedRAMP-Moderate', 'Baseline'].map((k) => p.severity[k]).sort((a, b) => SEV_RANK[b] - SEV_RANK[a])[0];
  function policyMiniRow(p) {
    const lvl = topSeverity(p);
    return `<a class="polmini" href="#/policy/${encodeURIComponent(p.id)}">
      <span class="sev-dot sev-${lvl}"></span>
      <span class="pm-name">${esc(p.name)}</span>
      <span class="pm-cat">${esc(p.category)}</span>
      <span class="pm-arrow">${svg('arrow')}</span></a>`;
  }

  /* ---------- topbar ---------- */
  function topbar(active) {
    const link = (href, label, key) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
    return `<header class="topbar"><div class="wrap topbar-inner">
      <a class="brand" href="#/">
        <span class="mark">${svg('flow')}</span>
        <span>Shinobi&nbsp;<b>Atlas</b><br><small>DevEx Portal</small></span>
      </a>
      <nav class="nav">
        ${link('#/pipeline', 'Pipeline', 'pipeline')}
        ${link('#/capabilities', 'Capabilities', 'capabilities')}
        ${link('#/blueprints', 'Blueprints', 'blueprints')}
        ${link('#/compliance', 'Compliance', 'compliance')}
        ${link('#/architecture', 'Architecture', 'architecture')}
        ${link('#/glossary', 'Glossary', 'glossary')}
      </nav>
      <form class="search" onsubmit="return Atlas.submitSearch(event)">
        ${svg('search')}
        <input id="globalSearch" placeholder="Search the platform…" autocomplete="off" />
      </form>
    </div></header>`;
  }
  function footer() {
    return `<footer class="footer"><div class="wrap fr">
      <div><b>Shinobi Atlas</b> — ${esc(D.meta.generatedFrom)}</div>
      <div>${D.stats.capabilities} capabilities · ${D.stats.policyRules} policy rules · ${D.stats.blueprintsImplemented}/${D.stats.blueprintsTotal} blueprints</div>
    </div></footer>`;
  }

  /* ---------- shell ---------- */
  function shell(active, body) {
    app.innerHTML = topbar(active) + `<main class="fade">${body}</main>` + footer();
    const gs = document.getElementById('globalSearch');
    if (gs && Atlas._q) gs.value = Atlas._q;
    window.scrollTo(0, 0);
  }

  /* ============================================================
     VIEWS
     ============================================================ */

  function home() {
    const s = D.stats;
    const stat = (n, l, grad) => `<div class="stat"><div class="num">${grad ? `<span>${n}</span>` : n}</div><div class="label">${l}</div></div>`;
    const explore = [
      { href: '#/capabilities', cat: 'Compute', ic: 'cube', h: 'Capability Catalog', p: `${s.capabilities} deployable building blocks, in plain English.` },
      { href: '#/blueprints', cat: 'Infrastructure', ic: 'layers', h: 'Blueprint Gallery', p: `${s.blueprintsImplemented} ready-made architectures you can lift and ship.` },
      { href: '#/compliance', cat: 'Security', ic: 'shield', h: 'Compliance', p: `${s.policyRules} rules across ${s.policyPacks} packs, escalating by tier.` },
      { href: '#/architecture', cat: 'Networking', ic: 'flow', h: 'Architecture', p: `How ${s.layers} layers compose into one deterministic kernel.` },
    ].map((x) => `<a class="card xcard" style="--cat:${catColor(x.cat)}" href="${x.href}">
        <div class="top"><span class="badge-ic">${svg(x.ic)}</span><h3>${x.h}</h3><span class="arrow">${svg('arrow')}</span></div>
        <div class="tagline">${x.p}</div></a>`).join('');

    const featured = ['aws-lambda', 'aws-stepfunctions', 'aws-dynamodb', 'aws-eks-cluster', 'aws-apigateway', 'aws-s3']
      .map(capById).filter(Boolean).map(capCard).join('');

    return `
    <section class="hero"><div class="wrap">
      <div class="eyebrow">${esc(D.meta.project)} · Platform Atlas</div>
      <h1>One manifest in.<br><span class="grad">Compliant cloud out.</span></h1>
      <p class="lead">${esc(D.meta.tagline)} Explore the compilation pipeline, browse every capability in human terms, and see exactly how intent becomes infrastructure.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/pipeline">${svg('flow')} Walk the pipeline</a>
        <a class="btn btn-ghost" href="#/capabilities">${svg('cube')} Browse capabilities</a>
      </div>
      <div class="stat-row">
        ${stat(s.capabilities, 'Capabilities', true)}
        ${stat(s.blueprintsImplemented + '/' + s.blueprintsTotal, 'Blueprints', true)}
        ${stat(s.policyRules, 'Policy rules', true)}
        ${stat(s.policyPacks, 'Compliance packs', true)}
        ${stat(s.layers, 'Architecture layers', true)}
        ${stat(s.graphNodes, 'Graph nodes', true)}
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">The Pipeline</div><h2>From intent to infrastructure, in seven moves</h2>
      <p>Every deploy flows through the same deterministic path. Click any stage to see what happens, which package owns it, and the invariants it guards.</p></div>
      ${railHTML(true)}
    </div></section>

    <section class="section"><div class="wrap">
      <div class="section-head"><h2>Explore the Atlas</h2></div>
      <div class="grid explore">${explore}</div>
    </div></section>

    <section class="section"><div class="wrap">
      <div class="section-head"><h2>Featured capabilities</h2><p>A taste of the catalog — each one a click from full product details.</p></div>
      <div class="grid cap">${featured}</div>
      <div style="margin-top:22px"><a class="btn btn-ghost" href="#/capabilities">See all ${s.capabilities} capabilities ${svg('arrow')}</a></div>
    </div></section>`;
  }

  /* ---------- pipeline rail ---------- */
  function railHTML(compact) {
    return `<div class="rail-block"><div class="rail">` + D.pipeline.map((st, i) => {
      const c = STAGE_COLOR[st.accent] || '#7c5cff';
      return `<a class="stage" style="--st:${c}" href="#/pipeline/${st.id}">
        <span class="glow"></span>
        <div class="step">STEP ${i + 1}</div>
        <div class="ic" style="background:color-mix(in srgb, ${c} 18%, transparent);color:${c}">${svg(stageIcon(st.id))}</div>
        <h4>${esc(st.short)}</h4>
        <div class="pkg mono">${esc(st.package)}</div>
      </a>`;
    }).join('') + `</div></div>`;
  }
  const stageIcon = (id) => ({ manifest: 'file', parse: 'flow', kernel: 'cube', binder: 'net', policy: 'shield', adapter: 'server', deploy: 'bolt' }[id] || 'cube');

  function pipeline() {
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">The Pipeline</div><h2>The compilation pipeline</h2>
      <p>Shinobi compiles a declarative manifest into deployable cloud through a fixed, deterministic sequence. Backend-neutral until the very last step. Click a stage to drill in.</p></div>
      ${railHTML()}
      <div class="grid explore" style="margin-top:30px">
        ${D.pipeline.map((st, i) => { const c = STAGE_COLOR[st.accent]; return `<a class="card" style="--cat:${c}" href="#/pipeline/${st.id}">
          <div class="top"><span class="badge-ic" style="--cat:${c}">${svg(stageIcon(st.id))}</span><div><h3>${esc(st.name)}</h3><div class="muted mono" style="font-size:12px">${esc(st.package)}</div></div></div>
          <div class="tagline">${esc(st.summary)}</div></a>`; }).join('')}
      </div>
    </div></section>`;
  }

  function pipelineDetail(id) {
    const st = byId(D.pipeline, id); if (!st) return notFound();
    const idx = D.pipeline.indexOf(st); const c = STAGE_COLOR[st.accent];
    const prev = D.pipeline[idx - 1], next = D.pipeline[idx + 1];
    return `<section class="section"><div class="wrap">
      <a class="backlink" href="#/pipeline">${svg('back')} The Pipeline</a>
      <div class="detail-hero" style="--cat:${c}">
        <span class="badge-ic">${svg(stageIcon(st.id))}</span>
        <div><div class="eyebrow">Step ${idx + 1} of ${D.pipeline.length} · <span class="mono">${esc(st.package)}</span></div>
        <h1>${esc(st.name)}</h1><div class="sub">${esc(st.summary)}</div></div>
      </div>
      <div class="detail-grid">
        <div class="prose">
          <p style="font-size:16.5px;color:var(--text)">${esc(st.detail)}</p>
          <div class="section-sub">Invariants guarded here</div>
          <div class="chips">${st.invariants.map((v) => `<span class="inv">${svg('shield')} ${esc(v)}</span>`).join('')}</div>
          <div class="section-sub">Key source</div>
          ${st.files.map((f) => `<div class="filepath">${svg('file')} ${esc(f)}</div>`).join('')}
        </div>
        <div>
          <div class="block"><h4>Data flow</h4>
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">In</div>
            <ul class="list">${st.inputs.map((x) => `<li><span class="dotm">${svg('arrow')}</span>${esc(x)}</li>`).join('')}</ul>
            <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px">Out</div>
            <ul class="list">${st.outputs.map((x) => `<li><span class="tick">${svg('tick')}</span>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="block"><h4>Owned by</h4>
            <div class="kv"><span class="k">Package</span><span class="v mono">${esc(st.package)}</span></div>
            <div class="kv"><span class="k">Role</span><span class="v">${esc(st.role)}</span></div>
          </div>
          <div style="display:flex;gap:10px">
            ${prev ? `<a class="btn btn-ghost" style="flex:1" href="#/pipeline/${prev.id}">${svg('back')} ${esc(prev.short)}</a>` : ''}
            ${next ? `<a class="btn btn-primary" style="flex:1;justify-content:center" href="#/pipeline/${next.id}">${esc(next.short)} ${svg('arrow')}</a>` : ''}
          </div>
        </div>
      </div>
    </div></section>`;
  }

  /* ---------- capability card ---------- */
  function capCard(cap) {
    const c = catColor(cap.category); const used = blueprintsUsing(cap.id).length;
    return `<a class="card" style="--cat:${c}" href="#/capability/${encodeURIComponent(cap.id)}">
      <div class="top"><span class="badge-ic">${catIcon(cap.category)}</span>
        <div><h3>${esc(cap.name)}</h3><span class="pill cat" style="--cat:${c}"><span class="dot"></span>${esc(cap.category)}</span></div></div>
      <div class="tagline">${esc(cap.tagline)}</div>
      <div class="foot">
        ${cap.kind === 'intent' ? `<span class="pill">Cross-cutting</span>` : ''}
        ${used ? `<span class="pill count">${used} blueprint${used > 1 ? 's' : ''}</span>` : ''}
        <span class="pill count mono" style="font-size:10.5px">${esc(cap.id)}</span>
      </div>
    </a>`;
  }

  function capabilities() {
    const cats = [...new Set(D.capabilities.map((c) => c.category))].sort();
    const active = Atlas._capCat || 'All';
    const q = (Atlas._capQ || '').toLowerCase();
    let list = D.capabilities;
    if (active !== 'All') list = list.filter((c) => c.category === active);
    if (q) list = list.filter((c) => (c.name + c.tagline + c.id + c.description).toLowerCase().includes(q));
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    const chips = ['All', ...cats].map((cat) => `<button class="chip ${active === cat ? 'on' : ''}" onclick="Atlas.setCapCat('${esc(cat)}')">${esc(cat)}${cat !== 'All' ? ` <span style="opacity:.6">${D.capabilities.filter((c) => c.category === cat).length}</span>` : ''}</button>`).join('');
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Service Catalog</div><h2>Capabilities</h2>
      <p>Every deployable building block, named for humans. Filter by category, then open any card for its full product details — what it provisions, its config surface, and the blueprints that use it.</p></div>
      <div class="filters">${chips}<span class="spacer"></span>
        <label class="field">${svg('search')}<input placeholder="Filter capabilities…" value="${esc(Atlas._capQ || '')}" oninput="Atlas.setCapQ(this.value)" /></label></div>
      ${list.length ? `<div class="grid cap">${list.map(capCard).join('')}</div>` : `<div class="empty">No capabilities match “${esc(Atlas._capQ)}”.</div>`}
    </div></section>`;
  }

  function capabilityDetail(id) {
    const cap = capById(id); if (!cap) return notFound();
    const c = catColor(cap.category); const used = blueprintsUsing(cap.id);
    return `<section class="section"><div class="wrap">
      <a class="backlink" href="#/capabilities">${svg('back')} Capability Catalog</a>
      <div class="detail-hero" style="--cat:${c}">
        <span class="badge-ic">${catIcon(cap.category)}</span>
        <div>
          <span class="pill cat" style="--cat:${c}"><span class="dot"></span>${esc(cap.category)}</span>
          ${cap.kind === 'intent' ? ` <span class="pill">Cross-cutting intent</span>` : ''}
          <h1 style="margin-top:10px">${esc(cap.name)}</h1>
          <div class="sub">${esc(cap.tagline)}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="prose">
          <p style="font-size:16.5px;color:var(--text)">${esc(cap.description)}</p>
          ${cap.provisions && cap.provisions.length ? `<div class="section-sub">What it provisions</div>
            <ul class="list">${cap.provisions.map((p) => `<li><span class="tick">${svg('tick')}</span>${esc(p)}</li>`).join('')}</ul>` : ''}
          ${(cap.policyIds || []).length ? `<div class="section-sub">Governing policies <span class="muted" style="font-weight:500;font-size:14px">· ${cap.policyIds.length}</span></div>
            <div class="polminis">${cap.policyIds.map(polById).filter(Boolean).map(policyMiniRow).join('')}</div>` : ''}
          ${used.length ? `<div class="section-sub">Used in ${used.length} blueprint${used.length > 1 ? 's' : ''}</div>
            <div class="grid bp">${used.map(bpCard).join('')}</div>` : ''}
        </div>
        <div>
          <div class="block"><h4>At a glance</h4>
            <div class="kv"><span class="k">Identifier</span><span class="v mono">${esc(cap.id)}</span></div>
            <div class="kv"><span class="k">Category</span><span class="v">${esc(cap.category)}</span></div>
            <div class="kv"><span class="k">Complexity</span><span class="v" style="text-transform:capitalize">${esc(cap.complexity || '—')}</span></div>
            <div class="kv"><span class="k">Lowered at</span><span class="v"><a href="#/pipeline/adapter" style="color:var(--brand-b)">Adapter stage ${svg('arrow')}</a></span></div>
          </div>
          ${cap.resourceTypes && cap.resourceTypes.length ? `<div class="block"><h4>Provider resources</h4><div class="chips">${cap.resourceTypes.map((r) => `<span class="codechip">${esc(r)}</span>`).join('')}</div></div>` : ''}
          ${cap.configKeys && cap.configKeys.length ? `<div class="block"><h4>Config surface</h4><div class="chips">${cap.configKeys.map((k) => `<span class="cfgchip">${esc(k)}</span>`).join('')}</div></div>` : ''}
          ${cap.sourceFile ? `<div class="block"><h4>Source</h4><div class="filepath">${svg('file')} ${esc(cap.sourceFile)}</div></div>` : ''}
        </div>
      </div>
    </div></section>`;
  }

  /* ---------- blueprint card ---------- */
  function bpCard(bp) {
    const c = catColor(bp.category);
    return `<a class="card" style="--cat:${c}" href="#/blueprint/${encodeURIComponent(bp.id)}">
      <div class="top"><span class="badge-ic">${catIcon(bp.category)}</span>
        <div><h3>${esc(bp.name)}</h3><span class="muted mono" style="font-size:12px">${esc(bp.id)} · ${esc(bp.category)}</span></div></div>
      <div class="tagline">${esc(bp.summary)}</div>
      <div class="foot">
        <span class="badge ${bp.status === 'Implemented' ? 'impl' : 'plan'}">${esc(bp.status)}</span>
        ${bp.componentCount ? `<span class="pill count">${bp.componentCount} components</span>` : ''}
        ${bp.policyPack ? `<span class="pill count">${esc(bp.policyPack)}</span>` : ''}
      </div>
    </a>`;
  }

  function blueprints() {
    const cats = [...new Set(D.blueprints.map((b) => b.category))];
    const active = Atlas._bpCat || 'All';
    const status = Atlas._bpStatus || 'All';
    const q = (Atlas._bpQ || '').toLowerCase();
    let list = D.blueprints;
    if (active !== 'All') list = list.filter((b) => b.category === active);
    if (status !== 'All') list = list.filter((b) => b.status === status);
    if (q) list = list.filter((b) => (b.name + b.summary + b.id + (b.components || []).join(' ')).toLowerCase().includes(q));
    const chips = ['All', ...cats].map((cat) => `<button class="chip ${active === cat ? 'on' : ''}" onclick="Atlas.setBpCat('${esc(cat)}')">${esc(cat)}</button>`).join('');
    const sChips = ['All', 'Implemented', 'Planned'].map((s) => `<button class="chip ${status === s ? 'on' : ''}" onclick="Atlas.setBpStatus('${esc(s)}')">${esc(s)}</button>`).join('');
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Reference Architectures</div><h2>Blueprint Gallery</h2>
      <p>Opinionated, ready-to-ship architectures. ${D.stats.blueprintsImplemented} of ${D.stats.blueprintsTotal} are implemented as manifests today — open any card to see its components and compliance posture.</p></div>
      <div class="filters">${chips}<span style="width:1px;height:24px;background:var(--line);margin:0 4px"></span>${sChips}<span class="spacer"></span>
        <label class="field">${svg('search')}<input placeholder="Filter blueprints…" value="${esc(Atlas._bpQ || '')}" oninput="Atlas.setBpQ(this.value)" /></label></div>
      ${list.length ? `<div class="grid bp">${list.map(bpCard).join('')}</div>` : `<div class="empty">No blueprints match those filters.</div>`}
    </div></section>`;
  }

  function blueprintDetail(id) {
    const bp = byId(D.blueprints, id); if (!bp) return notFound();
    const c = catColor(bp.category);
    const comps = (bp.components || []).map(capById).filter(Boolean);
    const missing = (bp.components || []).filter((cid) => !capById(cid));
    return `<section class="section"><div class="wrap">
      <a class="backlink" href="#/blueprints">${svg('back')} Blueprint Gallery</a>
      <div class="detail-hero" style="--cat:${c}">
        <span class="badge-ic">${catIcon(bp.category)}</span>
        <div>
          <span class="badge ${bp.status === 'Implemented' ? 'impl' : 'plan'}">${esc(bp.status)}</span>
          <span class="pill cat" style="--cat:${c};margin-left:6px"><span class="dot"></span>${esc(bp.category)}</span>
          <h1 style="margin-top:10px">${esc(bp.name)}</h1>
          <div class="sub">${esc(bp.summary)}</div>
        </div>
      </div>
      <div class="detail-grid">
        <div class="prose">
          ${comps.length ? `<div class="section-sub">Composed of ${comps.length} capabilit${comps.length > 1 ? 'ies' : 'y'}</div>
            <div class="grid cap">${comps.map(capCard).join('')}</div>` :
        `<p class="muted">This blueprint is <b>planned</b> — its manifest isn't authored yet, so the component list will populate once it's implemented.</p>`}
          ${missing.length ? `<p class="muted" style="margin-top:14px">Also references: ${missing.map((m) => `<span class="cfgchip">${esc(m)}</span>`).join(' ')}</p>` : ''}
          ${bp.manifest ? `<div class="section-sub">The manifest <button class="copybtn" onclick="Atlas.copy('mf-${esc(bp.id)}', this)">${svg('file')} Copy</button></div>
            <p class="muted" style="margin-top:-6px;margin-bottom:12px">This is the exact YAML Shinobi compiles — copy it as a starting point.</p>
            <pre class="code"><code id="mf-${esc(bp.id)}">${esc(bp.manifest)}</code></pre>` : ''}
        </div>
        <div>
          <div class="block"><h4>Blueprint facts</h4>
            <div class="kv"><span class="k">ID</span><span class="v mono">${esc(bp.id)}</span></div>
            <div class="kv"><span class="k">Status</span><span class="v">${esc(bp.status)}</span></div>
            <div class="kv"><span class="k">Wave</span><span class="v">${esc(bp.wave || '—')}</span></div>
            ${bp.policyPack ? `<div class="kv"><span class="k">Policy pack</span><span class="v"><a href="#/compliance" style="color:var(--brand-b)">${esc(bp.policyPack)}</a></span></div>` : ''}
            ${bp.componentCount ? `<div class="kv"><span class="k">Components</span><span class="v">${bp.componentCount}</span></div>` : ''}
          </div>
          ${bp.file ? `<div class="block"><h4>Manifest</h4><div class="filepath">${svg('file')} ${esc(bp.file)}</div></div>` : ''}
        </div>
      </div>
    </div></section>`;
  }

  /* ---------- compliance ---------- */
  function compliance() {
    const cats = [...new Set(D.policies.map((p) => p.category))].sort();
    const active = Atlas._polCat || 'All';
    const q = (Atlas._polQ || '').toLowerCase();
    let list = D.policies;
    if (active !== 'All') list = list.filter((p) => p.category === active);
    if (q) list = list.filter((p) => (p.name + p.summary + p.id).toLowerCase().includes(q));
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    const chips = ['All', ...cats].map((cat) => `<button class="chip ${active === cat ? 'on' : ''}" onclick="Atlas.setPolCat('${esc(cat)}')">${esc(cat)}</button>`).join('');
    const sevDot = (lvl) => `<span class="sevcell"><span class="sev-dot sev-${lvl}"></span>${lvl === 'none' ? '—' : lvl}</span>`;
    const rows = list.map((p) => `<div class="polrow" onclick="location.hash='#/policy/${encodeURIComponent(p.id)}'">
      <div><div class="pname">${esc(p.name)}</div><div class="psum">${esc(p.summary)}</div></div>
      ${sevDot(p.severity.Baseline)}${sevDot(p.severity['FedRAMP-Moderate'])}${sevDot(p.severity['FedRAMP-High'])}
    </div>`).join('');
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Policy-as-Data</div><h2>Compliance</h2>
      <p>${D.stats.policyRules} rules, evaluated before anything deploys. The same rule set escalates in severity across three packs — the rules never branch, only their severity does.</p></div>
      <div class="sev-legend">
        <span><span class="sev-dot sev-error"></span> Error — blocks</span>
        <span><span class="sev-dot sev-warning"></span> Warning</span>
        <span><span class="sev-dot sev-info"></span> Info</span>
        <span><span class="sev-dot sev-none"></span> Not in pack</span>
      </div>
      <div class="filters">${chips}<span class="spacer"></span>
        <label class="field">${svg('search')}<input placeholder="Filter rules…" value="${esc(Atlas._polQ || '')}" oninput="Atlas.setPolQ(this.value)" /></label></div>
      <div class="polhead"><div class="ph">Rule</div><div class="ph">Baseline</div><div class="ph">FedRAMP&nbsp;Mod</div><div class="ph">FedRAMP&nbsp;High</div></div>
      ${list.length ? rows : `<div class="empty">No rules match those filters.</div>`}
    </div></section>`;
  }

  function policyDetail(id) {
    const p = byId(D.policies, id); if (!p) return notFound();
    const c = catColor(p.category);
    const pack = (name, lvl) => `<div class="pack"><div class="pk">${name}</div><div class="lvl lvl-${lvl}">${lvl === 'none' ? 'n/a' : lvl}</div></div>`;
    return `<section class="section"><div class="wrap">
      <a class="backlink" href="#/compliance">${svg('back')} Compliance</a>
      <div class="detail-hero" style="--cat:${c}">
        <span class="badge-ic">${catIcon(p.category)}</span>
        <div><span class="pill cat" style="--cat:${c}"><span class="dot"></span>${esc(p.category)}</span>
        <h1 style="margin-top:10px">${esc(p.name)}</h1><div class="sub">${esc(p.summary)}</div></div>
      </div>
      <div class="detail-grid">
        <div class="prose">
          <div class="section-sub">Why it matters</div><p style="font-size:16px;color:var(--text)">${esc(p.rationale)}</p>
          <div class="section-sub">How to fix it</div>
          <div class="block" style="background:rgba(52,211,153,.06);border-color:rgba(52,211,153,.25)"><ul class="list"><li><span class="tick">${svg('tick')}</span>${esc(p.remediation)}</li></ul></div>
        </div>
        <div>
          <div class="block"><h4>Severity by pack</h4>
            <div class="sev-escalate">
              ${pack('Baseline', p.severity.Baseline)}
              ${pack('FedRAMP Mod', p.severity['FedRAMP-Moderate'])}
              ${pack('FedRAMP High', p.severity['FedRAMP-High'])}
            </div>
            <p class="muted" style="font-size:13px;margin-top:12px">Severity escalates with the compliance tier — the rule logic is identical across packs.</p>
          </div>
          <div class="block"><h4>Rule</h4><div class="kv"><span class="k">Identifier</span><span class="v mono">${esc(p.id)}</span></div>
          <div class="kv"><span class="k">Category</span><span class="v">${esc(p.category)}</span></div></div>
          ${(p.appliesTo || []).length ? `<div class="block"><h4>Applies to</h4><div class="chips">${p.appliesTo.map(capById).filter(Boolean).map((c) => `<a class="pill cat" style="--cat:${catColor(c.category)}" href="#/capability/${encodeURIComponent(c.id)}"><span class="dot"></span>${esc(c.name)}</a>`).join('')}</div></div>` : ''}
        </div>
      </div>
    </div></section>`;
  }

  /* ---------- architecture ---------- */
  function architecture() {
    const ntc = D.nodeTypeCounts; const total = Object.values(ntc).reduce((a, b) => a + b, 0);
    const typeColors = { file: '#38bdf8', function: '#a78bfa', class: '#34d399', config: '#fbbf24', document: '#fb923c', pipeline: '#f472b6' };
    const bar = Object.entries(ntc).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span style="width:${(n / total * 100).toFixed(2)}%;background:${typeColors[t] || '#7c5cff'}" title="${t}: ${n}"></span>`).join('');
    const legend = Object.entries(ntc).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span><i style="background:${typeColors[t] || '#7c5cff'}"></i>${t} · ${n}</span>`).join('');
    const flowCats = ['Database', 'Encryption', 'Kernel', 'Networking', 'Identity', 'Security', 'Infrastructure', 'Observability', 'AI / ML', 'Cost'];
    const layers = D.layers.map((l, i) => {
      const c = catColor(flowCats[i] || 'Infrastructure');
      return `<div class="arch-layer" style="--cat:${c}">
        <div><div class="ln">${esc(l.name)}</div><div class="ld">${esc(l.description)}</div></div>
        <div class="cnt">${l.nodeCount}<small>nodes</small></div></div>` + (i < D.layers.length - 1 ? `<div class="arch-flow">↓</div>` : '');
    }).join('');
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">System Design</div><h2>Architecture</h2>
      <p>Ten layers, each a package with an enforced boundary. Dependencies flow strictly downward — the foundation never imports a provider SDK, and the provider adapter is the only place a cloud is named.</p></div>
      <div class="arch">${layers}</div>
      <div class="section-head" style="margin-top:46px"><h2 style="font-size:24px">Knowledge graph at a glance</h2>
      <p>${D.stats.graphNodes} nodes and ${D.stats.graphEdges} relationships, extracted from the source tree.</p></div>
      <div class="typebar">${bar}</div>
      <div class="typelegend">${legend}</div>
    </div></section>`;
  }

  /* ---------- glossary ---------- */
  function glossary() {
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Shared Vocabulary</div><h2>Glossary</h2>
      <p>The handful of terms that unlock the whole platform. Learn these and the rest of the Atlas reads like prose.</p></div>
      <div class="gloss">${D.glossary.map((g) => `<div class="gterm"><h4>${esc(g.term)}</h4><p>${esc(g.def)}</p></div>`).join('')}</div>
    </div></section>`;
  }

  /* ---------- search ---------- */
  function search(q) {
    const ql = (q || '').toLowerCase().trim();
    if (!ql) return `<section class="section"><div class="wrap"><div class="empty">Type to search capabilities, blueprints, and rules.</div></div></section>`;
    const caps = D.capabilities.filter((c) => (c.name + c.tagline + c.id + c.description + c.category).toLowerCase().includes(ql));
    const bps = D.blueprints.filter((b) => (b.name + b.summary + b.id + (b.components || []).join(' ')).toLowerCase().includes(ql));
    const pols = D.policies.filter((p) => (p.name + p.summary + p.id + p.category).toLowerCase().includes(ql));
    const total = caps.length + bps.length + pols.length;
    const group = (title, items, render, cls) => items.length ? `<div class="searchgroup"><div class="gh">${title} · ${items.length}</div><div class="grid ${cls}">${items.map(render).join('')}</div></div>` : '';
    return `<section class="section"><div class="wrap">
      <div class="section-head"><div class="eyebrow">Search</div><h2>${total} result${total === 1 ? '' : 's'} for “${esc(q)}”</h2></div>
      ${total ? group('Capabilities', caps, capCard, 'cap') + group('Blueprints', bps, bpCard, 'bp') +
        (pols.length ? `<div class="searchgroup"><div class="gh">Policy rules · ${pols.length}</div>${pols.map((p) => `<div class="polrow" onclick="location.hash='#/policy/${encodeURIComponent(p.id)}'"><div><div class="pname">${esc(p.name)}</div><div class="psum">${esc(p.summary)}</div></div><span class="pill cat" style="--cat:${catColor(p.category)}"><span class="dot"></span>${esc(p.category)}</span></div>`).join('')}</div>` : '')
        : `<div class="empty">Nothing matched “${esc(q)}”. Try a capability name, a blueprint, or a service.</div>`}
    </div></section>`;
  }

  function notFound() {
    return `<section class="section"><div class="wrap"><div class="empty"><h2>Not found</h2><p>That page doesn't exist. <a href="#/" style="color:var(--brand-b)">Back to the Atlas</a></p></div></div></section>`;
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  const Atlas = window.Atlas = {
    _q: '', _capCat: 'All', _capQ: '', _bpCat: 'All', _bpStatus: 'All', _bpQ: '', _polCat: 'All', _polQ: '',
    submitSearch(e) { e.preventDefault(); const v = document.getElementById('globalSearch').value.trim(); Atlas._q = v; go('#/search/' + encodeURIComponent(v)); return false; },
    setCapCat(c) { Atlas._capCat = c; render(); }, setCapQ(v) { Atlas._capQ = v; renderInline(capabilities, 'capabilities'); },
    setBpCat(c) { Atlas._bpCat = c; render(); }, setBpStatus(s) { Atlas._bpStatus = s; render(); }, setBpQ(v) { Atlas._bpQ = v; renderInline(blueprints, 'blueprints'); },
    setPolCat(c) { Atlas._polCat = c; render(); }, setPolQ(v) { Atlas._polQ = v; renderInline(compliance, 'compliance'); },
    copy(id, btn) {
      const el = document.getElementById(id); if (!el) return;
      const txt = el.textContent;
      const done = () => { if (btn) { const o = btn.innerHTML; btn.innerHTML = 'Copied ✓'; btn.classList.add('ok'); setTimeout(() => { btn.innerHTML = o; btn.classList.remove('ok'); }, 1600); } };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, fallback); } else { fallback(); }
      function fallback() { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
    },
  };

  // re-render only <main> without losing input focus (for live filters)
  function renderInline(view, active) {
    const main = app.querySelector('main');
    if (!main) return render();
    main.innerHTML = view();
  }

  function render() {
    const h = window.location.hash.replace(/^#\/?/, '');
    const [route, param] = [h.split('/')[0], h.split('/').slice(1).join('/')];
    Atlas._q = route === 'search' ? decodeURIComponent(param || '') : '';
    switch (route) {
      case '': case undefined: return shell('home', home());
      case 'pipeline': return param ? shell('pipeline', pipelineDetail(param)) : shell('pipeline', pipeline());
      case 'capabilities': return shell('capabilities', capabilities());
      case 'capability': return shell('capabilities', capabilityDetail(decodeURIComponent(param || '')));
      case 'blueprints': return shell('blueprints', blueprints());
      case 'blueprint': return shell('blueprints', blueprintDetail(decodeURIComponent(param || '')));
      case 'compliance': return shell('compliance', compliance());
      case 'policy': return shell('compliance', policyDetail(decodeURIComponent(param || '')));
      case 'architecture': return shell('architecture', architecture());
      case 'glossary': return shell('glossary', glossary());
      case 'search': return shell('home', search(decodeURIComponent(param || '')));
      default: return shell('home', notFound());
    }
  }

  window.addEventListener('hashchange', render);
  // keyboard: "/" focuses search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); const s = document.getElementById('globalSearch'); if (s) s.focus(); }
  });
  render();
})();

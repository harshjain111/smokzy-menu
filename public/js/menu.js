// Smokzy customer app — home / menu (book) / standalone feedback
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function visitorId() {
    let id = localStorage.getItem('smokzy_vid');
    if (!id) { id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('smokzy_vid', id); }
    return id;
  }
  function deriveStrengthLabel(s) {
    if (!s && s !== 0) return 'mild';
    if (s.strengthLabel) return s.strengthLabel;
    const n = s.strength || 5;
    if (n <= 3) return 'light';
    if (n <= 7) return 'mild';
    return 'strong';
  }
  const face = (cls, html) => {
    const d = document.createElement('div');
    d.className = 'page-face ' + cls;
    d.innerHTML = html;
    return d;
  };

  let DATA = null, leaves = [], current = 0, animating = false, zoom = 1, menuTracked = false;

  function showView(name) {
    $('#homeScreen').hidden = (name !== 'home');
    $('#menuView').hidden    = (name !== 'menu');
    $('#feedbackView').hidden = (name !== 'feedback');
    if (name === 'menu') {
      if (!leaves.length && DATA) buildAndMount();
      if (!menuTracked) {
        menuTracked = true;
        fetch('/api/track/view', { method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ visitorId: visitorId() }) }).catch(()=>{});
      }
    }
    if (name === 'home') {
      resetBook();
      menuTracked = false;
      const f = $('#standaloneFeedback');
      if (f) { f.hidden = false; f.reset(); }
      $('#standaloneThanks').hidden = true;
      $$('#starsStandalone span').forEach(s => s.classList.remove('on'));
      renderHomeLogos();
    }
  }
  function renderHomeLogos() {
    const s = (DATA && DATA.settings) || {};
    const wrap = $('#homeLogos');
    if (!wrap) return;
    const smokzyLogo = s.logoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.logoUrl) + '\')"></div>' : '<div class="crest">S</div>';
    const partnerLogo = s.partnerLogoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.partnerLogoUrl) + '\')"></div>' : '';
    wrap.innerHTML = smokzyLogo + (partnerLogo ? '<div class="home-logo-divider"></div>' + partnerLogo : '');
    if (s.partnerName) $('#homeSub').innerHTML = '<em>curated for ' + esc(s.partnerName) + '</em>';
  }
  function resetBook() {
    if (!leaves.length) return;
    for (let i = leaves.length - 1; i >= 0; i--) {
      const el = $('.page[data-leaf="' + i + '"]');
      if (el) { el.classList.remove('flipped'); el.style.zIndex = leaves.length - i; }
    }
    current = 0; animating = false;
    updateNav();
  }

  document.addEventListener('click', e => {
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { e.preventDefault(); showView(goBtn.dataset.go); }
  });

  function applyZoom() { const book = $('#book'); if (book) book.style.transform = 'scale(' + zoom + ')'; }
  $('#zoomInBtn').addEventListener('click', () => { zoom = Math.min(1.6, zoom + 0.1); applyZoom(); });
  $('#zoomOutBtn').addEventListener('click', () => { zoom = Math.max(0.6, zoom - 0.1); applyZoom(); });

  function renderCover(c) {
    const bg = c && c.backgroundImage ? "url('" + esc(c.backgroundImage) + "')" : '';
    const s = (DATA && DATA.settings) || {};
    const smokzyLogo = s.logoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.logoUrl) + '\')"></div>' : '<div class="crest">S</div>';
    const partnerLogo = s.partnerLogoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.partnerLogoUrl) + '\')"></div>' : '';
    const logoRow = '<div class="cover-logos">' + smokzyLogo + (partnerLogo ? '<div class="cover-logo-divider"></div>' + partnerLogo : '') + '</div>';
    const curation = s.partnerName ? '<div class="curation">curated exclusively for <em>' + esc(s.partnerName) + '</em></div>' : '';
    return face('cover front',
      '<div class="cover-bg" style="background-image:' + (bg ? 'linear-gradient(135deg,rgba(0,0,0,.7),rgba(0,0,0,.35)),' + bg : 'none') + '"></div>' +
      '<div class="leather"></div><div class="leather-frame"></div>' +
      '<div class="cover-inner">' + logoRow + '<h1>SHISHA MENU</h1>' + curation +
        '<div class="openLabel">' + esc((c && c.openLabel) || 'Open the menu') + ' →</div>' +
      '</div>');
  }
  function renderFounderQuote() {
    return face('founder back',
      '<div style="margin:auto; text-align:center; padding:20px;">' +
        '<div style="font-family:var(--serif); font-size:64px; color:var(--gold); line-height:1;">"</div>' +
        '<p style="font-family:var(--serif); font-style:italic; font-size:22px; color:var(--ink); line-height:1.6; max-width:280px; margin:0 auto;">Every great evening begins the moment you exhale.</p>' +
        '<div style="margin-top:24px; width:40px; height:1px; background:var(--gold); margin-left:auto; margin-right:auto;"></div>' +
      '</div><span class="page-tag" style="left:24px;">i</span>');
  }
  function renderFounderBody(f) {
    return face('founder front',
      '<h2>' + esc((f && f.title) || 'A note from the founder') + '</h2>' +
      '<div class="body">' + esc((f && f.body) || '').replace(/\n/g, '<br>') + '</div>' +
      '<div class="signature">' + esc((f && f.founderName) || '') + '</div>' +
      '<span class="page-tag">ii</span>');
  }

  // ---------- HIGHLIGHTS (magazine-style spread) ----------
  function resolveHighlight(item) {
    if (!item || !item.libraryId) return null;
    const lib = (DATA && DATA.library) || [];
    const ref = lib.find(L => L.id === item.libraryId);
    if (!ref) return null;
    return {
      libraryId: ref.id,
      name: (item.title && item.title.trim()) || ref.name,
      tagline: (item.tagline && item.tagline.trim()) || ref.description || '',
      image: (item.image && item.image.trim()) || ref.image || '',
      blendType: ref.blendType || 'signature',
      strength: ref.strength,
      strengthLabel: deriveStrengthLabel(ref),
      tags: ref.tags || [],
      description: ref.description || ''
    };
  }
  function strengthDotsHtml(label) {
    const filled = label === 'strong' ? 5 : label === 'mild' ? 3 : 1;
    let h = '<span class="hmg-strength" title="Strength: ' + esc(label || 'mild') + '">';
    for (let i = 0; i < 5; i++) h += '<i class="' + (i < filled ? 'on' : '') + '"></i>';
    return h + '</span>';
  }
  function magCoverHtml(h, opts) {
    opts = opts || {};
    const num = opts.num || '01';
    const headerHtml =
      '<div class="hmg-header">' +
        '<span class="hmg-header-rule"></span>' +
        '<div class="hmg-header-text">' +
          '<div class="hmg-label">★ FLAVOUR IN HIGHLIGHT ★</div>' +
          '<div class="hmg-num">No. ' + esc(num) + (opts.numTotal ? ' / ' + esc(opts.numTotal) : '') + '</div>' +
        '</div>' +
        '<span class="hmg-header-rule"></span>' +
      '</div>';
    if (!h) {
      return headerHtml +
        '<div class="hmg-empty">' +
          '<span class="hmg-empty-mark">✦</span>' +
          '<p>Coming soon</p>' +
          '<small>This slot is still being curated</small>' +
        '</div>' +
        '<span class="hmg-pagenum">' + esc(opts.pageNum || '') + '</span>';
    }
    const tags = (h.tags || []).slice(0, 3).map(t =>
      '<span class="hmg-tag">' + esc(t) + '</span>').join('');
    const blurb = (h.tagline || h.description || '').trim();
    const blendUpper = (h.blendType || 'signature').toUpperCase();
    const badge = opts.badge
      ? '<div class="hmg-badge"><span class="hmg-badge-star">★</span> ' + esc(opts.badge) + '</div>'
      : '';
    const image = h.image
      ? '<div class="hmg-image" style="background-image:url(\'' + esc(h.image) + '\')">' + badge + '</div>'
      : '<div class="hmg-image hmg-image-fallback">' + badge + '<span>' + esc((h.name || '?').charAt(0).toUpperCase()) + '</span></div>';
    return headerHtml +
      '<div class="hmg-frame">' + image + '</div>' +
      '<div class="hmg-body">' +
        '<div class="hmg-kicker">' + esc(opts.kicker || 'FEATURED') + '</div>' +
        '<h2 class="hmg-name">' + esc(h.name) + '</h2>' +
        '<div class="hmg-meta">' +
          '<span class="hmg-blend">' + blendUpper + '</span>' +
          '<span class="hmg-dot">·</span>' +
          strengthDotsHtml(h.strengthLabel) +
          '<span class="hmg-strength-label">' + esc(h.strengthLabel.toUpperCase()) + '</span>' +
        '</div>' +
        (blurb ? '<p class="hmg-blurb"><span class="hmg-dropcap">' + esc(blurb.charAt(0)) + '</span>' + esc(blurb.slice(1)) + '</p>' : '') +
        (tags ? '<div class="hmg-tags">' + tags + '</div>' : '') +
        '<button class="hmg-cta" data-act="try-highlight" data-library-id="' + esc(h.libraryId) + '" type="button">' +
          '<span class="hmg-cta-text">TAP TO TRY THIS</span>' +
          '<span class="hmg-arr">→</span>' +
        '</button>' +
      '</div>' +
      '<span class="hmg-pagenum">' + esc(opts.pageNum || '') + '</span>';
  }
  function renderHighlightsIntro() {
    // LEFT page of the spread — flavour #1
    const s = (DATA && DATA.settings) || {};
    const hl = s.highlights || { enabled: false, items: [] };
    const items = (hl.items || []).slice(0, 2);
    const a = resolveHighlight(items[0]);
    return face('highlights-mag back',
      magCoverHtml(a, {
        num: '01', numTotal: '02',
        kicker: '— THE HEADLINER —',
        badge: 'STAR OF THE MONTH',
        pageNum: 'i'
      })
    );
  }
  function renderHighlightsLeaf() {
    // RIGHT page of the spread — flavour #2
    const s = (DATA && DATA.settings) || {};
    const hl = s.highlights || { enabled: false, items: [] };
    const items = (hl.items || []).slice(0, 2);
    const b = resolveHighlight(items[1]);
    return face('highlights-mag front',
      magCoverHtml(b, {
        num: '02', numTotal: '02',
        kicker: '— ALSO FEATURED —',
        badge: "CURATOR'S PICK",
        pageNum: 'ii'
      })
    );
  }

  function renderPotImage(pot) {
    return face('pot-image back',
      '<img src="' + esc(pot.image) + '" alt="' + esc(pot.name) + '" onerror="this.style.display=\'none\'">' +
      '<div class="veil"></div>' +
      '<div class="price-pill">From ₹' + (pot.basePrice == null ? 0 : pot.basePrice) + '</div>' +
      '<div class="label">' +
        '<div class="tag">' + esc(pot.tagline || 'Smokzy Selection') + '</div>' +
        '<h3>' + esc(pot.name) + '</h3>' +
        '<div class="desc">' + esc(pot.description || '') + '</div>' +
      '</div>');
  }

  function renderPotFlavors(pot, pageNum) {
    const flavors = (pot.flavors || []).map(f => ({ ...f, strengthLabel: deriveStrengthLabel(f) }));
    const total = flavors.length;
    const dCls = total > 18 ? 'qc-tight' : total > 10 ? 'qc-medium' : 'qc-roomy';
    const tagSet = new Set();
    flavors.forEach(f => (f.tags || []).forEach(t => tagSet.add(t)));
    const allTags = Array.from(tagSet).sort();

    function strengthBars(label) {
      const filled = label === 'strong' ? 5 : label === 'mild' ? 3 : 1;
      let h = '<span class="qc-strength">';
      for (let i = 0; i < 5; i++) h += '<i class="' + (i < filled ? 'on' : '') + '"></i>';
      h += '</span>'; return h;
    }
    function rowHtml(fl) {
      const tagsAttr = (fl.tags || []).join(',');
      return '<div class="qc-row" data-flavor-id="' + esc(fl.id) + '" data-pot-id="' + esc(pot.id) + '"' +
        ' data-strength="' + esc(fl.strengthLabel) + '" data-blend="' + esc(fl.blendType) + '" data-tags="' + esc(tagsAttr) + '">' +
        '<span class="qc-name">' + esc(fl.name) + (fl.popular ? ' <span class="qc-pop">★</span>' : '') + '</span>' +
        strengthBars(fl.strengthLabel) +
        '<span class="qc-arr">›</span></div>';
    }
    function twoColSection(items, blend) {
      if (!items.length) return '';
      const half = Math.ceil(items.length / 2);
      return '<div class="qc-cols" data-blend-section="' + blend + '">' +
        '<div class="qc-col">' + items.slice(0, half).map(rowHtml).join('') + '</div>' +
        '<div class="qc-divider"></div>' +
        '<div class="qc-col">' + items.slice(half).map(rowHtml).join('') + '</div></div>';
    }
    function sectionHeader(words, blend) {
      return '<div class="qc-section-head" data-blend-head="' + blend + '">' +
        '<span class="qc-rule"></span>' +
        '<span class="qc-section-label"><span class="qc-word">' + words[0] + '</span><span class="qc-word-gap"></span><span class="qc-word">' + words[1] + '</span></span>' +
        '<span class="qc-rule"></span></div>';
    }

    const sig = flavors.filter(f => (f.blendType || 'signature') === 'signature');
    const imp = flavors.filter(f => (f.blendType || 'signature') === 'imported');
    let body = '';
    if (sig.length) body += sectionHeader(['SIGNATURE','BLENDS'], 'signature') + twoColSection(sig, 'signature');
    if (imp.length) body += sectionHeader(['IMPORTED','BLENDS'], 'imported')   + twoColSection(imp, 'imported');
    if (!sig.length && !imp.length) body = '<div style="color:var(--ink-soft); font-style:italic; margin:auto;">No flavours yet.</div>';

    const toolbar = '<div class="qc-toolbar">' +
      '<button class="qc-tool-btn" data-act="toggle-filters" type="button">' +
        '<span class="qc-tool-icon">⚲</span>' +
        '<span class="qc-tool-label">Filters</span>' +
        '<span class="qc-active-count" data-active-count hidden>0</span>' +
      '</button>' +
      (flavors.length ? '<button class="qc-tool-btn qc-suggest" data-pot-id="' + esc(pot.id) + '" type="button">' +
        '<span class="qc-tool-icon">✦</span><span class="qc-tool-label">Surprise me</span></button>' : '') +
    '</div>';
    const filterPanel = '<div class="qc-filter-panel qc-filters" data-pot-id="' + esc(pot.id) + '" hidden>' +
      '<div class="qc-filter-row">' +
        '<span class="qc-filter-label">Strength</span>' +
        '<button class="qc-chip strength-chip" data-filter-strength="strong">Strong</button>' +
        '<button class="qc-chip strength-chip" data-filter-strength="mild">Mild</button>' +
        '<button class="qc-chip strength-chip" data-filter-strength="light">Light</button>' +
      '</div>' +
      (allTags.length ? '<div class="qc-filter-row"><span class="qc-filter-label">Tags</span>' +
        allTags.map(t => '<button class="qc-chip tag-chip" data-filter-tag="' + esc(t) + '">' + esc(t) + '</button>').join('') +
      '</div>' : '') +
      '<button class="qc-chip qc-clear" data-filter-clear hidden>clear all</button></div>';

    const legend = '<div class="qc-legend" aria-hidden="true">' +
      '<span class="qc-legend-key">' +
        '<i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i>' +
      '</span>' +
      '<span class="qc-legend-text">bars show flavour strength · light → strong</span>' +
    '</div>';

    return face('flavor-list front qc',
      '<div class="qc-title-block compact">' +
        '<h4 class="qc-title">' + esc(pot.name) + '</h4>' +
        '<div class="qc-subtitle">' + total + ' flavour' + (total === 1 ? '' : 's') +
          (sig.length && imp.length ? ', two traditions' : '') + '</div>' +
      '</div>' + toolbar + filterPanel + legend +
      '<div class="qc-body ' + dCls + '">' + body + '</div>' +
      '<span class="page-tag">' + pageNum + '</span>');
  }

  function renderPairingsIntro() {
    return face('pairings back',
      '<h2>Recommended<br>Pairings</h2>' +
      '<p class="lede">A great flavor finds its match in the right drink.</p>' +
      '<div style="margin-top:auto; padding-top:24px; font-family:var(--serif); font-style:italic; color:var(--ink-soft); font-size:14px;">Turn the page →</div>' +
      '<span class="page-tag" style="left:24px;">Pairings</span>');
  }
  function renderPairingsList(pairings) {
    const items = (pairings || []).map(p =>
      '<div class="pairing"><div class="row"><span class="drink">' + esc(p.drink) + '</span><span class="arrow">+</span><span class="flavor">' + esc(p.flavor) + '</span></div><div class="reason">' + esc(p.reason) + '</div></div>').join('');
    return face('pairings front',
      '<h2 style="font-size:26px;">For your drink tonight</h2>' +
      '<div class="pairing-list" style="margin-top:18px;">' + (items || '<em>No pairings yet.</em>') + '</div>' +
      '<span class="page-tag">Pairings</span>');
  }
  function renderInBookFeedbackPrompt() {
    return face('feedback back',
      '<div style="margin:auto; text-align:center; padding:20px;">' +
        '<div style="font-family:var(--serif); font-size:64px; color:var(--gold); line-height:1;">✦</div>' +
        '<p style="font-family:var(--serif); font-style:italic; font-size:22px; color:var(--ink); line-height:1.6; max-width:280px; margin:14px auto 0;">Ready to share how it tasted?</p>' +
        '<p style="font-family:var(--sans); font-size:13px; color:var(--ink-soft); margin-top:14px;">Tap ⌂ Home and choose Feedback.</p>' +
      '</div><span class="page-tag" style="left:24px;">Feedback</span>');
  }
  function renderThankYou() {
    return face('feedback front',
      '<div class="thanks"><h3>Thank you.</h3>' +
        '<p style="font-style:italic; color:var(--ink-soft); max-width:260px; margin:8px auto 0; line-height:1.5;">Until your next exhale.<br>— The Smokzy Team</p>' +
        '<div style="margin-top:32px; width:40px; height:1px; background:var(--gold); margin-left:auto; margin-right:auto;"></div>' +
        '<p style="margin-top:24px; font-size:11px; letter-spacing:3px; color:var(--ink-soft); text-transform:uppercase;">Smokzy · The Art of Shisha</p>' +
      '</div><span class="page-tag">⌘</span>');
  }
  function renderBackCover() {
    const s = (DATA && DATA.settings) || {};
    const smokzyLogo = s.logoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.logoUrl) + '\'); width:64px; height:64px;"></div>' : '<div class="crest" style="margin-bottom:14px;">S</div>';
    const partnerLogo = s.partnerLogoUrl ? '<div class="logo-img" style="background-image:url(\'' + esc(s.partnerLogoUrl) + '\'); width:64px; height:64px;"></div>' : '';
    const partner = s.partnerName ? ('<div class="partner-strip" style="margin-top:30px;">' +
      '<div class="partner-line" style="color:rgba(255,255,255,0.6);">In partnership with</div>' +
      '<div class="partner-name">' + esc(s.partnerName) + '</div></div>') : '';
    return face('cover back back-cover',
      '<div class="leather"></div><div class="leather-frame"></div>' +
      '<div class="cover-inner">' +
        '<div class="cover-logos">' + smokzyLogo + (partnerLogo ? '<div class="cover-logo-divider"></div>' + partnerLogo : '') + '</div>' +
        '<h3 style="margin-top:18px;">SHISHA MENU</h3>' +
        '<p>' + esc(s.tagline || 'The Art of Shisha') + '</p>' + partner +
      '</div>');
  }

  function highlightsVisible(data) {
    const hl = data && data.settings && data.settings.highlights;
    if (!hl || !hl.enabled) return false;
    const items = (hl.items || []).slice(0, 2);
    const valid = items.some(it => it && it.libraryId);
    return valid;
  }

  function buildLeaves(data) {
    const out = [];
    const pots = data.pots || [];
    const showHl = highlightsVisible(data);
    const showPair = !data.settings || data.settings.pairingsEnabled !== false;
    // when pairings are turned off, the "back" of the last pot becomes the
    // feedback prompt directly instead of the pairings intro spread.
    const tailBack = showPair ? renderPairingsIntro() : renderInBookFeedbackPrompt();
    let pageNum = 2;
    out.push({ front: renderCover(data.cover), back: renderFounderQuote() });
    if (showHl) {
      out.push({ front: renderFounderBody(data.founderNote), back: renderHighlightsIntro() });
      out.push({ front: renderHighlightsLeaf(), back: pots[0] ? renderPotImage(pots[0]) : tailBack });
    } else {
      out.push({ front: renderFounderBody(data.founderNote), back: pots[0] ? renderPotImage(pots[0]) : tailBack });
    }
    pots.forEach((pot, i) => {
      const next = pots[i + 1];
      out.push({ front: renderPotFlavors(pot, ++pageNum), back: next ? renderPotImage(next) : tailBack });
    });
    if (showPair) {
      out.push({ front: renderPairingsList(data.pairings), back: renderInBookFeedbackPrompt() });
    }
    out.push({ front: renderThankYou(), back: renderBackCover() });
    return out;
  }
  function mountBook(leaves) {
    const book = $('#book'); book.innerHTML = '';
    leaves.forEach((leaf, idx) => {
      const el = document.createElement('div');
      el.className = 'page right'; el.dataset.leaf = idx;
      el.style.zIndex = (leaves.length - idx);
      el.appendChild(leaf.front); el.appendChild(leaf.back);
      // No per-page click handler — the global edge-tap handler below
      // handles next/prev navigation across every page consistently.
      book.appendChild(el);
    });
  }
  function buildAndMount() { leaves = buildLeaves(DATA); mountBook(leaves); updateNav(); }

  function nextPage() {
    if (animating || current >= leaves.length - 1) return;
    const el = $('.page[data-leaf="' + current + '"]'); if (!el) return;
    animating = true;
    el.style.zIndex = 300 + current;
    el.classList.add('flipped');
    afterFlip(el, () => { el.style.zIndex = 200 + current; animating = false; });
    current++; updateNav();
  }
  function prevPage() {
    if (animating || current <= 0) return;
    current--;
    const el = $('.page[data-leaf="' + current + '"]'); if (!el) return;
    animating = true;
    el.style.zIndex = 300 + current;
    el.classList.remove('flipped');
    afterFlip(el, () => { el.style.zIndex = leaves.length - current; animating = false; });
    updateNav();
  }
  function afterFlip(el, fn) {
    let done = false;
    const finish = () => { if (done) return; done = true; el.removeEventListener('transitionend', onEnd); fn(); };
    const onEnd = e => { if (e.propertyName === 'transform') finish(); };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, 1200);
  }
  function updateNav() {
    const prevBtn = $('#prevBtn'), nextBtn = $('#nextBtn');
    if (prevBtn) prevBtn.disabled = current <= 0;
    if (nextBtn) nextBtn.disabled = current >= leaves.length - 1;
    const spreadNames = ['Cover', "Founder's note"];
    if (DATA && highlightsVisible(DATA)) spreadNames.push('Highlights');
    ((DATA && DATA.pots) || []).forEach(p => spreadNames.push(p.name));
    const pairOn = !(DATA && DATA.settings) || DATA.settings.pairingsEnabled !== false;
    if (pairOn) spreadNames.push('Pairings');
    spreadNames.push('Feedback', 'Thank you');
    const lbl = $('#pageLabel');
    if (lbl) lbl.textContent = spreadNames[current] || ('Page ' + (current + 1));
    const hint = $('#hint');
    if (hint && current > 0) hint.style.opacity = 0;
  }

  function applyFilters(filtersEl) {
    const card = filtersEl.closest('.page');
    const activeStrength = filtersEl.dataset.activeStrength || '';
    const activeTags = (filtersEl.dataset.activeTags || '').split(',').filter(Boolean);
    $$('.qc-row', card).forEach(row => {
      let show = true;
      if (activeStrength && row.dataset.strength !== activeStrength) show = false;
      if (show && activeTags.length) {
        const rowTags = (row.dataset.tags || '').split(',').filter(Boolean);
        if (!activeTags.every(t => rowTags.includes(t))) show = false;
      }
      row.style.display = show ? '' : 'none';
    });
    $$('.qc-section-head, .qc-cols', card).forEach(g => {
      const blend = g.dataset.blendHead || g.dataset.blendSection;
      if (!blend) return;
      const visibleRows = $$('.qc-cols[data-blend-section="' + blend + '"] .qc-row', card)
        .filter(r => r.style.display !== 'none').length;
      g.style.display = visibleRows ? '' : 'none';
    });
    const clearBtn = $('.qc-clear', filtersEl);
    if (clearBtn) clearBtn.hidden = !(activeStrength || activeTags.length);
    const totalActive = (activeStrength ? 1 : 0) + activeTags.length;
    const countEl = card.querySelector('[data-active-count]');
    if (countEl) { countEl.textContent = totalActive; countEl.hidden = totalActive === 0; }
    const toolBtn = card.querySelector('.qc-tool-btn[data-act="toggle-filters"]');
    if (toolBtn) toolBtn.classList.toggle('on', totalActive > 0);
  }

  document.addEventListener('click', e => {
    const tgl = e.target.closest('[data-act="toggle-filters"]');
    if (tgl) { e.preventDefault(); const card = tgl.closest('.page'); const panel = card.querySelector('.qc-filter-panel'); if (panel) panel.hidden = !panel.hidden; return; }
    const sBtn = e.target.closest('[data-filter-strength]');
    if (sBtn) {
      e.preventDefault();
      const f = sBtn.closest('.qc-filters');
      const cur = f.dataset.activeStrength || '';
      const next = cur === sBtn.dataset.filterStrength ? '' : sBtn.dataset.filterStrength;
      f.dataset.activeStrength = next;
      $$('[data-filter-strength]', f).forEach(b => b.classList.toggle('on', b.dataset.filterStrength === next));
      applyFilters(f); return;
    }
    const tBtn = e.target.closest('[data-filter-tag]');
    if (tBtn) {
      e.preventDefault();
      const f = tBtn.closest('.qc-filters');
      const tag = tBtn.dataset.filterTag;
      const cur = (f.dataset.activeTags || '').split(',').filter(Boolean);
      const i = cur.indexOf(tag);
      if (i >= 0) cur.splice(i, 1); else cur.push(tag);
      f.dataset.activeTags = cur.join(',');
      $$('[data-filter-tag]', f).forEach(b => b.classList.toggle('on', cur.includes(b.dataset.filterTag)));
      applyFilters(f); return;
    }
    const cBtn = e.target.closest('[data-filter-clear]');
    if (cBtn) {
      e.preventDefault();
      const f = cBtn.closest('.qc-filters');
      f.dataset.activeStrength = ''; f.dataset.activeTags = '';
      $$('.qc-chip.on', f).forEach(c => c.classList.remove('on'));
      applyFilters(f); return;
    }
    const sug = e.target.closest('.qc-suggest');
    if (sug) {
      e.preventDefault();
      const card = sug.closest('.page');
      const visible = $$('.qc-row', card).filter(r => r.style.display !== 'none');
      if (!visible.length) return;
      let pool = visible.filter(r => r.dataset.blend === 'imported');
      if (!pool.length) pool = visible;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      pick.classList.add('qc-glow');
      pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { pick.classList.remove('qc-glow'); openFlavor(pick.dataset.potId, pick.dataset.flavorId); }, 800);
    }
    const hlCta = e.target.closest('[data-act="try-highlight"]');
    if (hlCta) {
      e.preventDefault();
      e.stopPropagation();
      openPotPicker(hlCta.dataset.libraryId);
      return;
    }
  });

  // ---------- POT PICKER (for highlight CTAs) ----------
  const potPicker = $('#potPickerModal');
  function findPotsForLibrary(libraryId) {
    const pots = (DATA && DATA.pots) || [];
    const matches = [];
    pots.forEach(pot => {
      const fl = (pot.flavors || []).find(f => f.source === 'library' && f.libraryId === libraryId);
      if (fl) {
        const price = (fl.price != null && fl.price !== '') ? fl.price : pot.basePrice;
        matches.push({ pot, flavor: fl, price });
      }
    });
    return matches;
  }
  function openPotPicker(libraryId) {
    const lib = ((DATA && DATA.library) || []).find(L => L.id === libraryId);
    if (!lib || !potPicker) return;
    const matches = findPotsForLibrary(libraryId);
    const head = '<div class="pp-head">' +
      '<div class="pp-kicker">CHOOSE YOUR POT</div>' +
      '<h3 class="pp-name">' + esc(lib.name) + '</h3>' +
      '<div class="pp-sub"><em>' + esc((lib.blendType || 'signature')) + ' blend' + (lib.description ? ' · ' + esc(lib.description) : '') + '</em></div>' +
    '</div>';
    let body;
    if (!matches.length) {
      body = '<div class="pp-empty">This flavour isn\'t carried in any of our pots right now. Please ask your host.</div>';
    } else {
      body = '<div class="pp-list">' + matches.map(m => {
        const img = m.pot.image
          ? '<div class="pp-thumb" style="background-image:url(\'' + esc(m.pot.image) + '\')"></div>'
          : '<div class="pp-thumb pp-thumb-fallback"><span>' + esc((m.pot.name || '?').charAt(0)) + '</span></div>';
        return '<button class="pp-item" type="button" data-pp-pot="' + esc(m.pot.id) + '" data-pp-flavor="' + esc(m.flavor.id) + '">' +
          img +
          '<div class="pp-item-text">' +
            '<div class="pp-pot-name">' + esc(m.pot.name) + '</div>' +
            '<div class="pp-pot-tag">' + esc(m.pot.tagline || 'Smokzy Selection') + '</div>' +
          '</div>' +
          '<div class="pp-price">₹' + (m.price == null ? '—' : m.price) + '</div>' +
          '<div class="pp-go">›</div>' +
        '</button>';
      }).join('') + '</div>';
    }
    $('#potPickerBody').innerHTML = head + body;
    potPicker.classList.add('open');
    potPicker.setAttribute('aria-hidden', 'false');
  }
  function closePotPicker() {
    if (!potPicker) return;
    potPicker.classList.remove('open');
    potPicker.setAttribute('aria-hidden', 'true');
  }
  if (potPicker) {
    potPicker.addEventListener('click', e => {
      if (e.target.matches('[data-close]')) { closePotPicker(); return; }
      const item = e.target.closest('[data-pp-pot]');
      if (item) {
        const potId = item.dataset.ppPot;
        const flavorId = item.dataset.ppFlavor;
        closePotPicker();
        setTimeout(() => openFlavor(potId, flavorId), 120);
      }
    });
  }

  const modal = $('#flavorModal');
  function openFlavor(potId, flavorId) {
    const pot = ((DATA && DATA.pots) || []).find(p => p.id === potId);
    const fl = pot && pot.flavors && pot.flavors.find(f => f.id === flavorId);
    if (!fl) return;
    const sLabel = deriveStrengthLabel(fl);
    const dotsW = sLabel === 'strong' ? 100 : sLabel === 'mild' ? 60 : 30;
    const img = fl.image
      ? '<div class="modal-image" style="background-image:url(\'' + esc(fl.image) + '\')"></div>'
      : '<div class="modal-image generated">' + flavorIconSvg(fl) + '</div>';
    const tagsHtml = (fl.tags && fl.tags.length)
      ? '<div class="notes">' + fl.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' : '';
    $('#flavorModalBody').innerHTML = img +
      '<div class="modal-text">' +
        '<div class="pot-of">From ' + esc(pot.name) + ' · ' + (fl.blendType || 'signature').toUpperCase() + '</div>' +
        '<h3>' + esc(fl.name) + '</h3>' +
        '<div class="price">₹' + (fl.price != null ? fl.price : (pot.basePrice || '')) + '</div>' +
        '<div class="strengthBar">' +
          '<span class="lab">Strength</span>' +
          '<div class="bar"><div class="fill" style="width:' + dotsW + '%"></div></div>' +
          '<span class="num">' + sLabel.toUpperCase() + '</span>' +
        '</div>' +
        '<div class="desc">' + esc(fl.description || 'A house favorite.') + '</div>' +
        tagsHtml +
      '</div>';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    fetch('/api/track/flavor', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ flavorId }) }).catch(()=>{});
  }
  function flavorIconSvg(fl) {
    const palette = { fruit: ['#f49b6f', '#c54b3a'], mint: ['#9be0b6', '#1f6d4a'],
      classic: ['#d4a256', '#7a4a1a'], signature: ['#e88aa6', '#7c2843'],
      tobacco: ['#a98860', '#3a2410'], default: ['#c9a86a', '#5a1a1f'] };
    const c = palette[fl.category] || palette.default;
    const letter = (fl.name || '?').charAt(0).toUpperCase();
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">' +
      '<defs><radialGradient id="g" cx="35%" cy="35%"><stop offset="0%" stop-color="' + c[0] + '"/><stop offset="100%" stop-color="' + c[1] + '"/></radialGradient></defs>' +
      '<circle cx="100" cy="100" r="90" fill="url(#g)"/>' +
      '<text x="100" y="125" font-family="Cormorant Garamond, serif" font-size="80" font-weight="600" fill="rgba(255,255,255,0.85)" text-anchor="middle">' + esc(letter) + '</text>' +
      '<circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/></svg>';
  }
  modal.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  });

  document.addEventListener('click', e => {
    const fi = e.target.closest('.qc-row');
    if (fi) { e.stopPropagation(); openFlavor(fi.dataset.potId, fi.dataset.flavorId); return; }
    const sStar = e.target.closest('#starsStandalone span');
    if (sStar) {
      const v = +sStar.dataset.v;
      $('#ratingStandalone').value = v;
      $$('#starsStandalone span').forEach(s => s.classList.toggle('on', +s.dataset.v <= v));
    }
  });

  $('#standaloneFeedback').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      rating: +($('#ratingStandalone').value || 5),
      experience: fd.get('experience'),
      favoriteFlavor: fd.get('favoriteFlavor'),
      wouldRecommend: !!fd.get('wouldRecommend')
    };
    const btn = e.target.querySelector('.fb-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';
    fetch('/api/feedback', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
      .then(r => r.json()).then(() => { e.target.hidden = true; $('#standaloneThanks').hidden = false; })
      .catch(err => alert('Submit failed: ' + err.message))
      .finally(() => { btn.disabled = false; btn.textContent = 'Submit feedback'; });
  });

  // ====== EDGE-TAP NAVIGATION ======
  // Tapping the LEFT half of the screen goes to the previous page,
  // tapping the RIGHT half goes to the next page. Works on every page
  // including the flavour list, pairings, highlights and feedback prompts.
  // Anything interactive (buttons, flavour rows, modals, form fields, etc.)
  // is ignored so taps on those still do their own thing.
  const NAV_SKIP = [
    'button', 'a', 'input', 'textarea', 'select', 'label',
    '.qc-row', '.qc-chip', '.qc-suggest', '.qc-toolbar', '.qc-filter-panel', '.qc-filters',
    '.hl-card', '.hl-cta',
    '.modal', '.modal-card', '.pp-item', '.pp-card',
    '.stars span', '.navBtn', '.zoom-controls',
    '.top-home-btn',
    '[data-go]', '[data-close]', '[data-act]'
  ].join(',');
  document.addEventListener('click', e => {
    // only act while the book view is the visible one
    if ($('#menuView').hidden) return;
    // never flip when a modal is open
    if (modal && modal.classList.contains('open')) return;
    if (potPicker && potPicker.classList.contains('open')) return;
    // never flip when the user tapped something interactive
    if (e.target.closest(NAV_SKIP)) return;
    if (animating) return;
    const w = window.innerWidth || document.documentElement.clientWidth;
    const x = e.clientX;
    // 10% dead zone in the centre so accidental centre taps do nothing
    if (x < w * 0.45) prevPage();
    else if (x > w * 0.55) nextPage();
  });

  document.addEventListener('keydown', e => {
    if (!$('#menuView').hidden) {
      if (e.key === 'ArrowRight') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
    }
    if (e.key === 'Escape') {
      modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
      closePotPicker();
    }
  });

  let touchX = null, touchY = null;
  $('#menuView').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, {passive:true});
  $('#menuView').addEventListener('touchend', e => {
    if (touchX == null) return;
    const startedIn = e.target && e.target.closest && e.target.closest('.qc-body, .pairing-list, .qc-filter-panel, .qc-toolbar, .modal, .fb-card-pane, .hl-stage, input, textarea, select, button');
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = touchY = null;
    if (startedIn) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < -60) nextPage();
    if (dx > 60) prevPage();
  });

  $('#nextBtn').addEventListener('click', nextPage);
  $('#prevBtn').addEventListener('click', prevPage);

  document.addEventListener('wheel', e => {
    const targetSel = '.qc-body, .pairing-list, .modal-card, .fb-card-pane, .pp-list, .hl-stage';
    let el = e.target.closest(targetSel);
    if (!el) {
      const page = e.target.closest('.page-face');
      if (page) el = page.querySelector('.qc-body, .pairing-list, .hl-stage');
    }
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) return;
    el.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  function isPwa() {
    return window.matchMedia &&
      (window.matchMedia('(display-mode: standalone)').matches ||
       window.matchMedia('(display-mode: fullscreen)').matches ||
       window.navigator.standalone === true);
  }
  if (isPwa()) {
    let fsArmed = true;
    const goFs = () => {
      if (!fsArmed) return;
      fsArmed = false;
      setTimeout(() => {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) { try { req.call(el); } catch (e) {} }
      }, 250);
    };
    window.addEventListener('click', goFs, { once: true });
    window.addEventListener('keydown', goFs, { once: true });
  }

  fetch('/api/menu').then(r => r.json()).then(data => {
    DATA = data;
    renderHomeLogos();
    showView('home');
  }).catch(err => {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font-family:sans-serif;">Failed to load menu. ' + err.message + '</div>';
  });
})();

// Smokzy customer menu — flip-book renderer with filters + suggest
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function visitorId() {
    let id = localStorage.getItem('smokzy_vid');
    if (!id) {
      id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('smokzy_vid', id);
    }
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

  function renderCover(c) {
    const bg = c && c.backgroundImage ? "url('" + esc(c.backgroundImage) + "')" : '';
    const s = (window.__menuData && window.__menuData.settings) || {};
    const smokzyLogo = s.logoUrl
      ? '<div class="logo-img" style="background-image:url(\'' + esc(s.logoUrl) + '\')"></div>'
      : '<div class="crest">S</div>';
    const partnerLogo = s.partnerLogoUrl
      ? '<div class="logo-img" style="background-image:url(\'' + esc(s.partnerLogoUrl) + '\')"></div>'
      : '';
    const logoRow = '<div class="cover-logos">' + smokzyLogo +
      (partnerLogo ? '<div class="cover-logo-divider"></div>' + partnerLogo : '') + '</div>';
    const curation = s.partnerName
      ? '<div class="curation">curated exclusively for <em>' + esc(s.partnerName) + '</em></div>'
      : '';
    return face('cover front',
      '<div class="cover-bg" style="background-image:' + (bg ? 'linear-gradient(135deg,rgba(0,0,0,.7),rgba(0,0,0,.35)),' + bg : 'none') + '"></div>' +
      '<div class="leather"></div><div class="leather-frame"></div>' +
      '<div class="cover-inner">' +
        logoRow +
        '<h1>SHISHA MENU</h1>' + curation +
        '<div class="openLabel">' + esc((c && c.openLabel) || 'Open the menu') + ' →</div>' +
      '</div>');
  }

  function renderFounderQuote() {
    return face('founder back',
      '<div style="margin:auto; text-align:center; padding:20px;">' +
        '<div style="font-family:var(--serif); font-size:64px; color:var(--gold); line-height:1;">"</div>' +
        '<p style="font-family:var(--serif); font-style:italic; font-size:22px; color:var(--ink); line-height:1.6; max-width:280px; margin:0 auto;">' +
          'Every great evening begins the moment you exhale.' +
        '</p>' +
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

  // Quiet Cartography — flavour list with filters and Suggest
  function renderPotFlavors(pot, pageNum) {
    const flavors = (pot.flavors || []).map(f => ({ ...f, strengthLabel: deriveStrengthLabel(f) }));
    const total = flavors.length;
    const dCls = total > 18 ? 'qc-tight' : total > 10 ? 'qc-medium' : 'qc-roomy';

    // collect every unique tag on this page
    const tagSet = new Set();
    flavors.forEach(f => (f.tags || []).forEach(t => tagSet.add(t)));
    const allTags = Array.from(tagSet).sort();

    function strengthBars(label) {
      const filled = label === 'strong' ? 5 : label === 'mild' ? 3 : 1;
      let html = '<span class="qc-strength">';
      for (let i = 0; i < 5; i++) {
        html += '<i class="' + (i < filled ? 'on' : '') + '"></i>';
      }
      html += '</span>';
      return html;
    }
    function rowHtml(fl) {
      const tagsAttr = (fl.tags || []).join(',');
      return (
        '<div class="qc-row" data-flavor-id="' + esc(fl.id) + '" data-pot-id="' + esc(pot.id) + '"' +
          ' data-strength="' + esc(fl.strengthLabel) + '" data-blend="' + esc(fl.blendType) + '" data-tags="' + esc(tagsAttr) + '">' +
          '<span class="qc-name">' + esc(fl.name) +
            (fl.popular ? ' <span class="qc-pop">★</span>' : '') + '</span>' +
          strengthBars(fl.strengthLabel) +
          '<span class="qc-arr">›</span>' +
        '</div>');
    }
    function twoColSection(items, blend) {
      if (!items.length) return '';
      const half = Math.ceil(items.length / 2);
      const colA = items.slice(0, half).map(rowHtml).join('');
      const colB = items.slice(half).map(rowHtml).join('');
      return '<div class="qc-cols" data-blend-section="' + blend + '">' +
        '<div class="qc-col">' + colA + '</div>' +
        '<div class="qc-divider"></div>' +
        '<div class="qc-col">' + colB + '</div></div>';
    }
    function sectionHeader(label, blend) {
      return '<div class="qc-section-head" data-blend-head="' + blend + '">' +
        '<span class="qc-rule"></span>' +
        '<span class="qc-section-label">' + label + '</span>' +
        '<span class="qc-rule"></span></div>';
    }

    const sig = flavors.filter(f => (f.blendType || 'signature') === 'signature');
    const imp = flavors.filter(f => (f.blendType || 'signature') === 'imported');

    let body = '';
    if (sig.length) body += sectionHeader('S I G N A T U R E   B L E N D S', 'signature') + twoColSection(sig, 'signature');
    if (imp.length) body += sectionHeader('I M P O R T E D   B L E N D S', 'imported') + twoColSection(imp, 'imported');
    if (!sig.length && !imp.length) {
      body = '<div style="color:var(--ink-soft); font-style:italic; margin:auto;">No flavours yet.</div>';
    }

    // filter row: strength + dynamic tags
    const filterChips =
      '<div class="qc-filters" data-pot-id="' + esc(pot.id) + '">' +
        '<div class="qc-filter-group">' +
          '<button class="qc-chip strength-chip" data-filter-strength="strong">Strong</button>' +
          '<button class="qc-chip strength-chip" data-filter-strength="mild">Mild</button>' +
          '<button class="qc-chip strength-chip" data-filter-strength="light">Light</button>' +
        '</div>' +
        (allTags.length ? '<div class="qc-filter-divider"></div><div class="qc-filter-group">' +
          allTags.map(t => '<button class="qc-chip tag-chip" data-filter-tag="' + esc(t) + '">' + esc(t) + '</button>').join('') +
          '</div>' : '') +
        '<button class="qc-chip qc-clear" data-filter-clear hidden>clear</button>' +
      '</div>';

    // Suggest button at bottom
    const suggest = flavors.length ? (
      '<div class="qc-suggest-wrap">' +
        '<button class="qc-suggest" data-pot-id="' + esc(pot.id) + '">' +
          '<span class="qc-suggest-mark">✦</span>' +
          '<span class="qc-suggest-label">Surprise me</span>' +
          '<span class="qc-suggest-sub">a flavour for tonight</span>' +
        '</button>' +
      '</div>') : '';

    return face('flavor-list front qc',
      '<div class="qc-title-block">' +
        '<h4 class="qc-title">' + esc(pot.name) + '</h4>' +
        '<div class="qc-subtitle">' + total + ' flavour' + (total === 1 ? '' : 's') +
          (sig.length && imp.length ? ', two traditions' : '') + '</div>' +
        '<div class="qc-ornament"><span class="qc-rule short"></span><span class="qc-diamond">◆</span><span class="qc-rule short"></span></div>' +
      '</div>' +
      filterChips +
      '<div class="qc-body ' + dCls + '">' + body + '</div>' +
      suggest +
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

  function renderFeedbackForm() {
    return face('feedback back',
      '<h2>Before you leave</h2>' +
      '<div class="lede">Your feedback shapes the next chapter of Smokzy.</div>' +
      '<form id="feedbackForm">' +
        '<div><label>How was your experience?</label>' +
        '<div class="stars" id="stars" role="radiogroup">' +
          [1,2,3,4,5].map(i => '<span data-v="' + i + '" role="radio">★</span>').join('') +
        '</div><input type="hidden" name="rating" id="ratingInput"></div>' +
        '<div class="row2"><div><label>Your name</label><input name="name" maxlength="80" placeholder="Optional"></div>' +
        '<div><label>Favorite flavor tonight</label><input name="favoriteFlavor" maxlength="80" placeholder="e.g. Mint Storm"></div></div>' +
        '<div><label>Tell us more</label><textarea name="experience" maxlength="500" placeholder="The one thing we should never change..."></textarea></div>' +
        '<div><label style="display:flex; align-items:center; gap:8px; text-transform:none; letter-spacing:0; font-size:13px; color:var(--ink);">' +
          '<input type="checkbox" name="wouldRecommend" style="width:auto;" checked>' +
          "I'd recommend Smokzy to a friend</label></div>" +
        '<button type="submit" class="submit">Submit feedback</button>' +
      '</form><span class="page-tag" style="left:24px;">Feedback</span>');
  }

  function renderThankYou() {
    return face('feedback front',
      '<div class="thanks"><h3>Thank you.</h3>' +
        '<p style="font-style:italic; color:var(--ink-soft); max-width:260px; margin:8px auto 0; line-height:1.5;">' +
          'Until your next exhale.<br>— The Smokzy Team</p>' +
        '<div style="margin-top:32px; width:40px; height:1px; background:var(--gold); margin-left:auto; margin-right:auto;"></div>' +
        '<p style="margin-top:24px; font-size:11px; letter-spacing:3px; color:var(--ink-soft); text-transform:uppercase;">Smokzy · The Art of Shisha</p>' +
      '</div><span class="page-tag">⌘</span>');
  }

  function renderBackCover() {
    const s = (window.__menuData && window.__menuData.settings) || {};
    const smokzyLogo = s.logoUrl
      ? '<div class="logo-img" style="background-image:url(\'' + esc(s.logoUrl) + '\'); width:64px; height:64px;"></div>'
      : '<div class="crest" style="margin-bottom:14px;">S</div>';
    const partnerLogo = s.partnerLogoUrl
      ? '<div class="logo-img" style="background-image:url(\'' + esc(s.partnerLogoUrl) + '\'); width:64px; height:64px;"></div>'
      : '';
    const partner = s.partnerName ? (
      '<div class="partner-strip" style="margin-top:30px;">' +
        '<div class="partner-line" style="color:rgba(255,255,255,0.6);">In partnership with</div>' +
        '<div class="partner-name">' + esc(s.partnerName) + '</div>' +
      '</div>') : '';
    return face('cover back back-cover',
      '<div class="leather"></div><div class="leather-frame"></div>' +
      '<div class="cover-inner">' +
        '<div class="cover-logos">' + smokzyLogo +
          (partnerLogo ? '<div class="cover-logo-divider"></div>' + partnerLogo : '') + '</div>' +
        '<h3 style="margin-top:18px;">SHISHA MENU</h3>' +
        '<p>' + esc(s.tagline || 'The Art of Shisha') + '</p>' +
        partner +
      '</div>');
  }

  function buildLeaves(data) {
    const leaves = [];
    const pots = data.pots || [];
    let pageNum = 2;
    leaves.push({ front: renderCover(data.cover), back: renderFounderQuote() });
    leaves.push({ front: renderFounderBody(data.founderNote),
                  back: pots[0] ? renderPotImage(pots[0]) : renderPairingsIntro() });
    pots.forEach((pot, i) => {
      const next = pots[i + 1];
      leaves.push({
        front: renderPotFlavors(pot, ++pageNum),
        back: next ? renderPotImage(next) : renderPairingsIntro()
      });
    });
    leaves.push({ front: renderPairingsList(data.pairings), back: renderFeedbackForm() });
    leaves.push({ front: renderThankYou(), back: renderBackCover() });
    return leaves;
  }

  function mountBook(leaves) {
    const book = $('#book');
    book.innerHTML = '';
    leaves.forEach((leaf, idx) => {
      const el = document.createElement('div');
      el.className = 'page right';
      el.dataset.leaf = idx;
      el.style.zIndex = (leaves.length - idx);
      el.appendChild(leaf.front);
      el.appendChild(leaf.back);
      el.addEventListener('click', e => {
        if (e.target.closest('input, textarea, button, select, .qc-row, label, .stars span, .qc-chip, .qc-suggest, .qc-filters')) return;
        nextPage();
      });
      book.appendChild(el);
    });
  }

  let leaves = [];
  let current = 0;
  let animating = false;

  function nextPage() {
    if (animating || current >= leaves.length - 1) return;
    const el = $('.page[data-leaf="' + current + '"]');
    if (!el) return;
    animating = true;
    el.style.zIndex = 300 + current;
    el.classList.add('flipped');
    afterFlip(el, () => { el.style.zIndex = 200 + current; animating = false; });
    current++; updateNav();
  }
  function prevPage() {
    if (animating || current <= 0) return;
    current--;
    const el = $('.page[data-leaf="' + current + '"]');
    if (!el) return;
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
    $('#prevBtn').disabled = current <= 0;
    $('#nextBtn').disabled = current >= leaves.length - 1;
    const spreadNames = ['Cover', "Founder's note"];
    ((window.__menuData && window.__menuData.pots) || []).forEach(p => spreadNames.push(p.name));
    spreadNames.push('Pairings', 'Feedback', 'Thank you');
    $('#pageLabel').textContent = spreadNames[current] || ('Page ' + (current + 1));
    if (current > 0) $('#hint').style.opacity = 0;
  }

  // ===== FILTERS =====
  // Each .qc-filters has its own active filter state stored on dataset.
  function applyFilters(filtersEl) {
    const card = filtersEl.closest('.page');
    const activeStrength = filtersEl.dataset.activeStrength || '';
    const activeTags = (filtersEl.dataset.activeTags || '').split(',').filter(Boolean);
    let visibleCount = 0;
    $$('.qc-row', card).forEach(row => {
      let show = true;
      if (activeStrength && row.dataset.strength !== activeStrength) show = false;
      if (show && activeTags.length) {
        const rowTags = (row.dataset.tags || '').split(',').filter(Boolean);
        if (!activeTags.every(t => rowTags.includes(t))) show = false;
      }
      row.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    // hide empty section heads/cols
    $$('.qc-section-head, .qc-cols', card).forEach(g => {
      const blend = g.dataset.blendHead || g.dataset.blendSection;
      if (!blend) return;
      const visibleRows = $$('.qc-cols[data-blend-section="' + blend + '"] .qc-row', card)
        .filter(r => r.style.display !== 'none').length;
      g.style.display = visibleRows ? '' : 'none';
    });
    const clearBtn = $('.qc-clear', filtersEl);
    if (clearBtn) clearBtn.hidden = !(activeStrength || activeTags.length);
  }

  document.addEventListener('click', e => {
    // strength filter chip
    const sBtn = e.target.closest('[data-filter-strength]');
    if (sBtn) {
      e.preventDefault();
      const filtersEl = sBtn.closest('.qc-filters');
      const cur = filtersEl.dataset.activeStrength || '';
      const next = cur === sBtn.dataset.filterStrength ? '' : sBtn.dataset.filterStrength;
      filtersEl.dataset.activeStrength = next;
      $$('[data-filter-strength]', filtersEl).forEach(b =>
        b.classList.toggle('on', b.dataset.filterStrength === next));
      applyFilters(filtersEl);
      return;
    }
    // tag filter chip
    const tBtn = e.target.closest('[data-filter-tag]');
    if (tBtn) {
      e.preventDefault();
      const filtersEl = tBtn.closest('.qc-filters');
      const tag = tBtn.dataset.filterTag;
      const cur = (filtersEl.dataset.activeTags || '').split(',').filter(Boolean);
      const i = cur.indexOf(tag);
      if (i >= 0) cur.splice(i, 1); else cur.push(tag);
      filtersEl.dataset.activeTags = cur.join(',');
      $$('[data-filter-tag]', filtersEl).forEach(b =>
        b.classList.toggle('on', cur.includes(b.dataset.filterTag)));
      applyFilters(filtersEl);
      return;
    }
    // clear
    const cBtn = e.target.closest('[data-filter-clear]');
    if (cBtn) {
      e.preventDefault();
      const filtersEl = cBtn.closest('.qc-filters');
      filtersEl.dataset.activeStrength = '';
      filtersEl.dataset.activeTags = '';
      $$('.qc-chip.on', filtersEl).forEach(c => c.classList.remove('on'));
      applyFilters(filtersEl);
      return;
    }
    // SUGGEST
    const sug = e.target.closest('.qc-suggest');
    if (sug) {
      e.preventDefault();
      const card = sug.closest('.page');
      // visible rows only (respect active filters)
      const visibleRows = $$('.qc-row', card).filter(r => r.style.display !== 'none');
      if (!visibleRows.length) return;
      // prefer imported blends
      let pool = visibleRows.filter(r => r.dataset.blend === 'imported');
      if (!pool.length) pool = visibleRows;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      pick.classList.add('qc-glow');
      pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        pick.classList.remove('qc-glow');
        openFlavor(pick.dataset.potId, pick.dataset.flavorId);
      }, 800);
    }
  });

  // ===== FLAVOR MODAL =====
  const modal = $('#flavorModal');
  function openFlavor(potId, flavorId) {
    const pot = ((window.__menuData && window.__menuData.pots) || []).find(p => p.id === potId);
    const fl = pot && pot.flavors && pot.flavors.find(f => f.id === flavorId);
    if (!fl) return;
    const sLabel = deriveStrengthLabel(fl);
    const dotsW = sLabel === 'strong' ? 100 : sLabel === 'mild' ? 60 : 30;
    const img = fl.image
      ? '<div class="modal-image" style="background-image:url(\'' + esc(fl.image) + '\')"></div>'
      : '<div class="modal-image generated">' + flavorIconSvg(fl) + '</div>';
    const tagsHtml = (fl.tags && fl.tags.length)
      ? '<div class="notes">' + fl.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' : '';
    $('#flavorModalBody').innerHTML =
      img +
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
    fetch('/api/track/flavor', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ flavorId })
    }).catch(()=>{});
  }
  function flavorIconSvg(fl) {
    const palette = {
      fruit: ['#f49b6f', '#c54b3a'], mint: ['#9be0b6', '#1f6d4a'],
      classic: ['#d4a256', '#7a4a1a'], signature: ['#e88aa6', '#7c2843'],
      tobacco: ['#a98860', '#3a2410'], default: ['#c9a86a', '#5a1a1f']
    };
    const c = palette[fl.category] || palette.default;
    const letter = (fl.name || '?').charAt(0).toUpperCase();
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">' +
      '<defs><radialGradient id="g" cx="35%" cy="35%"><stop offset="0%" stop-color="' + c[0] + '"/><stop offset="100%" stop-color="' + c[1] + '"/></radialGradient></defs>' +
      '<circle cx="100" cy="100" r="90" fill="url(#g)"/>' +
      '<text x="100" y="125" font-family="Cormorant Garamond, serif" font-size="80" font-weight="600" fill="rgba(255,255,255,0.85)" text-anchor="middle">' + esc(letter) + '</text>' +
      '<circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>' +
      '</svg>';
  }
  modal.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  document.addEventListener('click', e => {
    const fi = e.target.closest('.qc-row');
    if (fi) { e.stopPropagation(); openFlavor(fi.dataset.potId, fi.dataset.flavorId); return; }
    const star = e.target.closest('#stars span');
    if (star) {
      const v = +star.dataset.v;
      $('#ratingInput').value = v;
      $$('#stars span').forEach(s => s.classList.toggle('on', +s.dataset.v <= v));
    }
  });

  document.addEventListener('submit', e => {
    if (e.target.id !== 'feedbackForm') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      rating: +($('#ratingInput').value || 5),
      experience: fd.get('experience'),
      favoriteFlavor: fd.get('favoriteFlavor'),
      wouldRecommend: !!fd.get('wouldRecommend')
    };
    fetch('/api/feedback', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    }).then(r => r.json()).then(() => {
      const back = e.target.closest('.page-face');
      if (back) {
        back.innerHTML = '<div class="thanks" style="margin:auto; text-align:center;">' +
          '<h3>Thank you ✦</h3>' +
          '<p style="font-style:italic; color:var(--ink-soft); max-width:240px; margin:8px auto 0; line-height:1.6;">' +
            "We've logged your note. It helps more than you know.</p></div>" +
          '<span class="page-tag" style="left:24px;">Feedback</span>';
      }
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'Escape') { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  });

  let touchX = null;
  document.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx < -50) nextPage();
    if (dx > 50) prevPage();
    touchX = null;
  });

  $('#nextBtn').addEventListener('click', nextPage);
  $('#prevBtn').addEventListener('click', prevPage);

  fetch('/api/menu').then(r => r.json()).then(data => {
    window.__menuData = data;
    leaves = buildLeaves(data);
    mountBook(leaves);
    updateNav();
    fetch('/api/track/view', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ visitorId: visitorId() })
    }).catch(()=>{});
  }).catch(err => {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font-family:sans-serif;">Failed to load menu. ' + err.message + '</div>';
  });
})();

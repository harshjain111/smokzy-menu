// Smokzy Admin — login, CRUD, dashboard, library, tags, strength labels, highlights, modal
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TAG_PRESETS = ['minty','fruity','floral','ice','sweet','earthy','smoky','citrus','berry','cream','spicy','herbal','tropical','tobacco'];
  let DATA = null;

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const r = await fetch(path, Object.assign({}, opts, { headers, credentials: 'same-origin' }));
    if (!r.ok) {
      let msg = r.statusText;
      try { msg = (await r.json()).error || msg; } catch(e){}
      throw new Error(msg);
    }
    return r.json();
  }

  async function checkAuth() {
    try { const j = await api('/api/admin/me'); if (j.admin) showApp(); else showLogin(); }
    catch (e) { showLogin(); }
  }
  function showLogin() { $('#loginScreen').hidden = false; $('#adminApp').hidden = true; }
  function showApp()   { $('#loginScreen').hidden = true;  $('#adminApp').hidden = false; refresh(); }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#loginPw').value }) });
      showApp();
    } catch (err) { $('#loginErr').textContent = err.message || 'Wrong password'; }
    finally { btn.disabled = false; }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch(e){}
    showLogin();
  });

  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    $$('.panel').forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
    if (t.dataset.tab === 'dashboard') loadDashboard();
  }));

  async function refresh() {
    DATA = await api('/api/admin/data');
    renderSettings(); renderCover(); renderFounder(); renderHighlights();
    renderLibrary(); renderPots(); renderPairings(); renderFeedback();
    if (typeof potsView !== 'undefined' && potsView === 'grid') renderAssignmentGrid();
    loadDashboard();
  }

  // ---- helpers ----
  function getAllKnownTags() {
    const set = new Set(TAG_PRESETS);
    if (DATA) {
      (DATA.library || []).forEach(L => (L.tags || []).forEach(t => set.add(t)));
      (DATA.pots || []).forEach(p => (p.flavors || []).forEach(f => (f.tags || []).forEach(t => set.add(t))));
    }
    return Array.from(set).sort();
  }
  function tagsInputHtml(id, tags) {
    const ts = (tags || []).map(t => '<span class="tag-pill" data-tag="' + esc(t) + '">' + esc(t) + '<button type="button" data-act="del-tag" data-tag="' + esc(t) + '">×</button></span>').join('');
    const all = getAllKnownTags();
    const presetsHtml = all.map(t => {
      const isCustom = !TAG_PRESETS.includes(t);
      return '<button type="button" class="tag-preset' + (isCustom ? ' custom' : '') + '" data-act="add-preset" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    return `
      <div class="tag-input" data-tags-for="${esc(id)}">
        <div class="tag-pills">${ts}</div>
        <input type="text" placeholder="add tag + Enter (or pick below)" class="tag-text" list="tag-suggestions-${esc(id)}">
        <datalist id="tag-suggestions-${esc(id)}">${all.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <div class="tag-presets">${presetsHtml}</div>
      </div>`;
  }
  function strengthSelectHtml(value) {
    const v = (value || 'mild').toLowerCase();
    return `<select class="strength-select">
      <option value="light"  ${v==='light'?'selected':''}>Light</option>
      <option value="mild"   ${v==='mild'?'selected':''}>Mild</option>
      <option value="strong" ${v==='strong'?'selected':''}>Strong</option>
    </select>`;
  }

  // delegated upload
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-upload-target]');
    if (!btn) return;
    e.preventDefault();
    const targetId = btn.dataset.uploadTarget;
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*';
    fi.onchange = async () => {
      if (!fi.files || !fi.files[0]) return;
      const fd = new FormData(); fd.append('file', fi.files[0]);
      const orig = btn.textContent;
      btn.disabled = true; btn.textContent = '…';
      try {
        const r = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'upload failed');
        const target = document.getElementById(targetId);
        if (target) {
          target.value = j.url;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (DATA) {
          if (targetId === 'set_logoUrl' && DATA.settings)        DATA.settings.logoUrl = j.url;
          if (targetId === 'set_partnerLogoUrl' && DATA.settings) DATA.settings.partnerLogoUrl = j.url;
          if (targetId === 'cv_bg' && DATA.cover)                 DATA.cover.backgroundImage = j.url;
        }
        if (targetId === 'set_logoUrl' || targetId === 'set_partnerLogoUrl') {
          await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({
            brandName: document.getElementById('set_brandName').value,
            tagline: document.getElementById('set_tagline').value,
            logoUrl: document.getElementById('set_logoUrl').value,
            partnerName: document.getElementById('set_partnerName').value,
            partnerLogoUrl: document.getElementById('set_partnerLogoUrl').value
          })});
          flash('Uploaded & saved ✓');
        } else { flash('Uploaded ✓'); }
        renderSettings();
      } catch (err) { alert('Upload failed: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = orig; }
    };
    fi.click();
  });

  // tag input
  document.addEventListener('keydown', e => {
    if (!e.target.classList.contains('tag-text')) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const tag = e.target.value.trim().toLowerCase();
    if (!tag) return;
    addTagToInput(e.target.closest('.tag-input'), tag);
    e.target.value = '';
  });
  document.addEventListener('click', e => {
    const presetBtn = e.target.closest('[data-act="add-preset"]');
    if (presetBtn) { e.preventDefault(); addTagToInput(presetBtn.closest('.tag-input'), presetBtn.dataset.tag); return; }
    const delBtn = e.target.closest('[data-act="del-tag"]');
    if (delBtn) { e.preventDefault(); delBtn.parentElement.remove(); return; }
  });
  function addTagToInput(wrap, tag) {
    if (!wrap) return;
    const existing = $$('.tag-pill', wrap).map(p => p.dataset.tag);
    if (existing.includes(tag)) return;
    const pills = $('.tag-pills', wrap);
    const span = document.createElement('span');
    span.className = 'tag-pill'; span.dataset.tag = tag;
    span.innerHTML = esc(tag) + '<button type="button" data-act="del-tag" data-tag="' + esc(tag) + '">×</button>';
    pills.appendChild(span);
  }
  function readTagsFrom(wrap) { if (!wrap) return []; return $$('.tag-pill', wrap).map(p => p.dataset.tag).filter(Boolean); }

  // ============ NEW FLAVOUR MODAL ============
  function openNewFlavourModal() {
    const modal = $('#newFlavourModal'); if (!modal) return;
    const form = $('#newFlavourForm'); form.reset();
    $('#nf_err').textContent = '';
    modal.querySelector('.tag-pills').innerHTML = '';
    const all = getAllKnownTags();
    const presetWrap = modal.querySelector('.tag-presets');
    presetWrap.innerHTML = all.map(t => {
      const isCustom = !TAG_PRESETS.includes(t);
      return '<button type="button" class="tag-preset' + (isCustom ? ' custom' : '') + '" data-act="add-preset" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    let dl = modal.querySelector('datalist');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'tag-suggestions-nf';
      modal.querySelector('.tag-input .tag-text').setAttribute('list', 'tag-suggestions-nf');
      modal.querySelector('.tag-input').appendChild(dl);
    }
    dl.innerHTML = all.map(t => '<option value="' + esc(t) + '">').join('');
    modal.hidden = false;
    setTimeout(() => modal.querySelector('input[name="name"]').focus(), 50);
  }
  function closeNewFlavourModal() { const m = $('#newFlavourModal'); if (m) m.hidden = true; }
  $('#addLibrary').addEventListener('click', e => { e.preventDefault(); openNewFlavourModal(); });
  document.addEventListener('click', e => { if (e.target.matches('[data-ax-close]')) { e.preventDefault(); closeNewFlavourModal(); } });
  document.addEventListener('keydown', e => { const m = $('#newFlavourModal'); if (e.key === 'Escape' && m && !m.hidden) closeNewFlavourModal(); });
  $('#newFlavourForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const submitBtn = $('#nf_submit');
    const errBox = $('#nf_err');
    errBox.textContent = '';
    submitBtn.disabled = true; submitBtn.textContent = 'Adding…';
    try {
      const fd = new FormData(form);
      const tagsWrap = form.querySelector('.tag-input');
      const payload = {
        name: (fd.get('name') || '').trim(),
        blendType: fd.get('blendType') || 'signature',
        strengthLabel: fd.get('strengthLabel') || 'mild',
        image: fd.get('image') || '',
        description: fd.get('description') || '',
        popular: !!fd.get('popular'),
        tags: readTagsFrom(tagsWrap)
      };
      if (!payload.name) { errBox.textContent = 'Name is required.'; return; }
      await api('/api/admin/library', { method: 'POST', body: JSON.stringify(payload) });
      flash('Flavour added to library ✓');
      closeNewFlavourModal();
      refresh();
    } catch (err) {
      errBox.innerHTML = 'Could not save: ' + esc(err.message) +
        '<br><span style="color:var(--muted); font-size:12px;">If this mentions "column does not exist", run lib/schema-v3.sql in Supabase first.</span>';
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = 'Add to library';
    }
  });

  // ---- SETTINGS ----
  function renderSettings() {
    const s = (DATA && DATA.settings) || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('set_brandName', s.brandName); set('set_tagline', s.tagline);
    set('set_logoUrl', s.logoUrl); set('set_partnerName', s.partnerName);
    set('set_partnerLogoUrl', s.partnerLogoUrl);
    const up = document.getElementById('set_importedUpcharge');
    if (up) up.value = (s.importedUpcharge != null ? s.importedUpcharge : 0);
    const lp = document.getElementById('settingsLogoPreview');
    if (lp) { lp.style.backgroundImage = s.logoUrl ? "url('" + s.logoUrl + "')" : ''; lp.textContent = s.logoUrl ? '' : 'No logo'; }
    const pp = document.getElementById('settingsPartnerPreview');
    if (pp) { pp.style.backgroundImage = s.partnerLogoUrl ? "url('" + s.partnerLogoUrl + "')" : ''; pp.textContent = s.partnerLogoUrl ? '' : 'No logo'; }
  }
  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveSettings') return;
    try {
      const upEl = document.getElementById('set_importedUpcharge');
      const upVal = upEl ? Number(upEl.value || 0) : 0;
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({
        brandName: document.getElementById('set_brandName').value,
        tagline: document.getElementById('set_tagline').value,
        logoUrl: document.getElementById('set_logoUrl').value,
        partnerName: document.getElementById('set_partnerName').value,
        partnerLogoUrl: document.getElementById('set_partnerLogoUrl').value,
        importedUpcharge: upVal
      })});
      flash('Branding saved'); refresh();
    } catch (err) { alert('Save failed: ' + err.message); }
  });

  // ---- COVER + FOUNDER ----
  function renderCover() {
    const c = (DATA && DATA.cover) || {};
    $('#cv_title').value = c.title || ''; $('#cv_subtitle').value = c.subtitle || '';
    $('#cv_byline').value = c.byline || ''; $('#cv_bg').value = c.backgroundImage || '';
    $('#cv_open').value = c.openLabel || '';
  }
  function renderFounder() {
    const f = (DATA && DATA.founderNote) || {};
    $('#fn_title').value = f.title || ''; $('#fn_name').value = f.founderName || '';
    $('#fn_body').value = f.body || '';
  }
  $('#saveCover').addEventListener('click', async () => {
    try {
      await api('/api/admin/cover', { method: 'PUT', body: JSON.stringify({
        title: $('#cv_title').value, subtitle: $('#cv_subtitle').value,
        byline: $('#cv_byline').value, backgroundImage: $('#cv_bg').value,
        openLabel: $('#cv_open').value
      })});
      flash('Cover saved');
    } catch (err) { alert('Save failed: ' + err.message); }
  });
  $('#saveFounder').addEventListener('click', async () => {
    try {
      await api('/api/admin/founder', { method: 'PUT', body: JSON.stringify({
        title: $('#fn_title').value, founderName: $('#fn_name').value, body: $('#fn_body').value
      })});
      flash('Founder note saved');
    } catch (err) { alert('Save failed: ' + err.message); }
  });

  // ============ HIGHLIGHTS ============
  function renderHighlights() {
    const lib = (DATA && DATA.library) || [];
    const hl = (DATA && DATA.settings && DATA.settings.highlights) || { enabled: false, items: [] };
    const en = document.getElementById('hl_enabled');
    if (en) en.checked = !!hl.enabled;
    for (let i = 0; i < 2; i++) {
      const item = (hl.items && hl.items[i]) || {};
      const sel = document.getElementById('hl_libraryId_' + i);
      if (sel) {
        sel.innerHTML = '<option value="">— pick one —</option>' +
          lib.map(L => '<option value="' + esc(L.id) + '"' +
            (item.libraryId === L.id ? ' selected' : '') + '>' +
            esc(L.name) + ' · ' + esc(L.blendType) + '</option>').join('');
      }
      const t = document.getElementById('hl_title_' + i); if (t) t.value = item.title || '';
      const g = document.getElementById('hl_tagline_' + i); if (g) g.value = item.tagline || '';
      const m = document.getElementById('hl_image_' + i); if (m) m.value = item.image || '';
    }
  }
  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveHighlights') return;
    const items = [];
    for (let i = 0; i < 2; i++) {
      const libraryId = (document.getElementById('hl_libraryId_' + i) || {}).value || '';
      if (!libraryId) continue;
      items.push({
        libraryId,
        title:   (document.getElementById('hl_title_' + i)   || {}).value || '',
        tagline: (document.getElementById('hl_tagline_' + i) || {}).value || '',
        image:   (document.getElementById('hl_image_' + i)   || {}).value || ''
      });
    }
    const enabled = !!(document.getElementById('hl_enabled') || {}).checked;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ highlights: { enabled, items } })});
      flash('Highlights saved');
      refresh();
    } catch (err) { alert('Save failed: ' + err.message); }
  });

  // ============ LIBRARY LIST ============
  function renderLibrary() {
    const wrap = $('#libraryList');
    if (!wrap) return;
    const lib = (DATA && DATA.library) || [];
    if (!lib.length) {
      wrap.innerHTML = '<div class="card muted" style="margin-top:14px;">Library is empty. Click "+ New flavour" to add your first one.</div>';
      return;
    }
    wrap.innerHTML = lib.map(L => `
      <div class="library-row" data-id="${esc(L.id)}">
        <div class="library-card" data-id="${esc(L.id)}">
          <div class="library-thumb" style="background-image:url('${esc(L.image)}')"></div>
          <div><strong>${esc(L.name) || '<em style="color:#888">untitled</em>'}</strong>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${esc((L.description || '').slice(0, 80))}${(L.description||'').length>80?'…':''}</div>
            ${(L.tags||[]).length ? '<div style="margin-top:4px;">' + (L.tags||[]).map(t=>`<span class="tag-pill view">${esc(t)}</span>`).join('') + '</div>' : ''}
          </div>
          <div><span class="blend-chip ${L.blendType}">${L.blendType}</span></div>
          <div><span class="strength-chip ${L.strengthLabel}">${L.strengthLabel}</span></div>
          <div style="font-size:12px;color:var(--muted);">in ${L.usedInPots} pot${L.usedInPots===1?'':'s'}</div>
          <div class="lib-row-actions">
            <button class="ghost-btn mini" data-act="edit-lib">Edit</button>
            <button class="del-mini" data-act="del-lib">×</button>
          </div>
        </div>
        <div class="library-edit">
          <div class="form-grid">
            <label>Name<input data-lf="name" value="${esc(L.name)}"></label>
            <label>Blend type
              <select data-lf="blendType">
                <option value="signature" ${L.blendType==='signature'?'selected':''}>Signature</option>
                <option value="imported" ${L.blendType==='imported'?'selected':''}>Imported</option>
              </select>
            </label>
            <label>Strength<span>${strengthSelectHtml(L.strengthLabel)}</span></label>
            <label class="full">Image URL
              <div class="img-with-upload">
                <input data-lf="image" id="lib_img_${L.id}" value="${esc(L.image || '')}">
                <button type="button" class="ghost-btn" data-upload-target="lib_img_${L.id}">Upload…</button>
              </div>
            </label>
            <label class="full">Description / tasting notes<textarea data-lf="description" rows="3">${esc(L.description || '')}</textarea></label>
            <label class="full">Taste tags${tagsInputHtml('lib_tags_'+L.id, L.tags)}</label>
            <label style="display:flex; align-items:center; gap:8px; text-transform:none; letter-spacing:0;">
              <input type="checkbox" data-lf="popular" ${L.popular?'checked':''} style="width:auto;">
              Mark as popular (★)
            </label>
          </div>
          <button class="primary-btn" data-act="save-lib">Save flavour</button>
        </div>
      </div>
    `).join('');
  }
  $('#libraryList').addEventListener('click', async e => {
    let card = e.target.closest('.library-card');
    if (!card) {
      const editPanel = e.target.closest('.library-edit');
      if (editPanel) card = editPanel.previousElementSibling;
    }
    const row = e.target.closest('.library-row');
    if (!row && !card) return;
    const id = (row && row.dataset.id) || (card && card.dataset.id);
    const act = e.target.dataset.act;
    if (!act) return;
    if (act === 'add-preset' || act === 'del-tag') return;
    e.preventDefault();
    if (act === 'edit-lib') { card.classList.toggle('editing'); return; }
    if (act === 'del-lib') {
      const L = (DATA.library || []).find(x => x.id === id);
      if (L && L.usedInPots > 0) { if (!confirm('This flavour is used in ' + L.usedInPots + ' pot(s). Continue?')) return; }
      else { if (!confirm('Delete this flavour from the library?')) return; }
      try { await api('/api/admin/library/' + id, { method: 'DELETE' }); refresh(); }
      catch (err) { alert('Delete failed: ' + err.message); }
      return;
    }
    if (act === 'save-lib') {
      const editPanel = row.querySelector('.library-edit');
      const fields = {};
      editPanel.querySelectorAll('[data-lf]').forEach(el => {
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number') v = +el.value;
        else v = el.value;
        fields[el.dataset.lf] = v;
      });
      const ss = editPanel.querySelector('.strength-select');
      if (ss) fields.strengthLabel = ss.value;
      const ti = editPanel.querySelector('.tag-input');
      if (ti) fields.tags = readTagsFrom(ti);
      const btn = e.target;
      const orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await api('/api/admin/library/' + id, { method: 'PUT', body: JSON.stringify(fields) });
        flash('Library flavour saved ✓');
        refresh();
      } catch (err) { alert('Save failed: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = orig; }
    }
  });

  // ============ POTS ============
  function renderPots() {
    const wrap = $('#potList'); wrap.innerHTML = '';
    const lib = (DATA && DATA.library) || [];
    (DATA.pots || []).forEach(pot => {
      const linkedIds = new Set((pot.flavors || []).filter(f => f.source === 'library').map(f => f.libraryId));
      const inlineFlavors = (pot.flavors || []).filter(f => f.source !== 'library');
      const linkedFlavors = (pot.flavors || []).filter(f => f.source === 'library');
      const card = document.createElement('div');
      card.className = 'pot-card'; card.dataset.id = pot.id;
      card.innerHTML = `
        <div class="pot-header">
          <div class="pot-thumb" style="background-image:url('${esc(pot.image)}')"></div>
          <div class="pot-meta">
            <h3 class="pot-name">${esc(pot.name) || 'Untitled pot'}</h3>
            <div class="pot-tagline">${esc(pot.tagline || '')} · Signature ₹${pot.basePrice == null ? 0 : pot.basePrice}${pot.importedPrice != null && pot.importedPrice !== pot.basePrice ? ' · Imported ₹' + pot.importedPrice : ''} · ${(pot.flavors || []).length} flavors</div>
          </div>
          <div class="pot-actions">
            <button class="ghost-btn mini" data-act="move-up"   title="Move up">↑</button>
            <button class="ghost-btn mini" data-act="move-down" title="Move down">↓</button>
            <button class="ghost-btn" data-act="edit-pot">Edit pot</button>
            <button class="ghost-btn" data-act="del-pot" style="color:var(--burgundy)">Delete</button>
          </div>
        </div>
        <div class="pot-edit">
          <div class="form-grid">
            <label>Name<input data-f="name" value="${esc(pot.name)}"></label>
            <label>Tagline<input data-f="tagline" value="${esc(pot.tagline || '')}"></label>
            <label class="full">Image URL
              <div class="img-with-upload">
                <input data-f="image" id="pot_img_${pot.id}" value="${esc(pot.image || '')}">
                <button type="button" class="ghost-btn" data-upload-target="pot_img_${pot.id}">Upload…</button>
              </div>
            </label>
            <label>Base price (₹)<input data-f="basePrice" type="number" value="${pot.basePrice || 0}"></label>
            <label class="full">Description<textarea data-f="description" rows="2">${esc(pot.description || '')}</textarea></label>
          </div>
          <button class="primary-btn" data-act="save-pot">Save pot</button>
        </div>
        <div class="lib-picker">
          <div class="picker-head">
            <strong style="color:var(--ink); letter-spacing:0; text-transform:none; font-size:14px;">Flavours from Library</strong>
            <span style="margin-left:auto; font-size:11px;">${linkedFlavors.length} linked</span>
          </div>
          <div class="linked-rows">
            ${linkedFlavors.map(f => '<span class="linked-pill ' + esc(f.blendType) + '">' + esc(f.name) +
              '<button data-act="unlink" data-lib-id="' + esc(f.libraryId) + '" title="Remove from this pot">×</button></span>').join('')}
            ${linkedFlavors.length===0 ? '<span style="color:var(--muted); font-size:13px; font-style:italic;">No library flavours linked yet.</span>' : ''}
          </div>
          <input type="text" class="picker-search" placeholder="Search library to add…" data-act="lib-search">
          <div class="lib-options" data-act="lib-options" hidden>
            ${lib.map(L => '<label class="lib-option" data-lib-id="' + esc(L.id) + '" data-name="' + esc(L.name).toLowerCase() + '">' +
              '<input type="checkbox" ' + (linkedIds.has(L.id) ? 'checked disabled' : '') + '>' +
              '<span class="name">' + esc(L.name) + '</span>' +
              '<span class="blend-chip ' + esc(L.blendType) + '">' + esc(L.blendType) + '</span>' +
              '<span style="color:var(--muted); font-size:12px;">' + esc(L.strengthLabel) + '</span>' +
              '</label>').join('')}
          </div>
          <button class="primary-btn" data-act="link-selected" style="margin-top:8px;">Add selected to pot</button>
        </div>
        <div class="flavor-table">
          <div class="picker-head"><strong style="color:var(--ink); letter-spacing:0; text-transform:none; font-size:14px;">Custom flavours (this pot only)</strong></div>
          ${inlineFlavors.map(fl => '<div class="flavor-row-v2" data-flavor-id="' + esc(fl.id) + '">' +
            '<div class="form-grid" style="margin-bottom:0;">' +
              '<label>Name<input data-ff="name" value="' + esc(fl.name) + '"></label>' +
              '<label>Blend type<select data-ff="blendType">' +
                '<option value="signature" ' + (fl.blendType==='signature'?'selected':'') + '>Signature</option>' +
                '<option value="imported" ' + (fl.blendType==='imported'?'selected':'') + '>Imported</option>' +
              '</select></label>' +
              '<label>Strength<span>' + strengthSelectHtml(fl.strengthLabel) + '</span></label>' +
              '<label class="full">Image URL<div class="img-with-upload">' +
                '<input data-ff="image" id="fl_img_' + esc(fl.id) + '" value="' + esc(fl.image || '') + '">' +
                '<button type="button" class="ghost-btn" data-upload-target="fl_img_' + esc(fl.id) + '">Upload…</button>' +
              '</div></label>' +
              '<label class="full">Description<textarea data-ff="description" rows="2">' + esc(fl.description || '') + '</textarea></label>' +
              '<label class="full">Taste tags' + tagsInputHtml('fl_tags_' + fl.id, fl.tags) + '</label>' +
              '<label style="display:flex; align-items:center; gap:8px; text-transform:none; letter-spacing:0;">' +
                '<input type="checkbox" data-ff="popular" ' + (fl.popular?'checked':'') + ' style="width:auto;">Popular (★)</label>' +
            '</div>' +
            '<div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px;">' +
              '<button class="del-mini" data-act="del-flavor">Delete</button>' +
            '</div></div>').join('')}
          <div class="add-flavor-row" data-act="add-flavor">+ Add custom flavour</div>
          ${inlineFlavors.length ? '<div style="margin-top:10px;"><button class="primary-btn" data-act="save-flavors">Save custom flavours</button></div>' : ''}
        </div>`;
      wrap.appendChild(card);
    });
  }

  $('#addPot').addEventListener('click', async () => {
    const name = prompt('Name for the new pot?'); if (!name) return;
    try { await api('/api/admin/pots', { method: 'POST', body: JSON.stringify({ name, tagline: '', basePrice: 0 }) }); refresh(); }
    catch (err) { alert('Add pot failed: ' + err.message); }
  });

  $('#potList').addEventListener('click', async e => {
    const card = e.target.closest('.pot-card'); if (!card) return;
    const potId = card.dataset.id;
    const act = e.target.dataset.act; if (!act) return;
    if (act === 'add-preset' || act === 'del-tag') return;
    e.preventDefault();
    if (act === 'move-up' || act === 'move-down') {
      const pots = DATA.pots || [];
      const i = pots.findIndex(p => p.id === potId);
      if (i < 0) return;
      const j = act === 'move-up' ? i - 1 : i + 1;
      if (j < 0 || j >= pots.length) return;
      const order = pots.map(p => p.id);
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      try { await api('/api/admin/pots-reorder', { method: 'PUT', body: JSON.stringify({ order }) }); flash('Order saved'); refresh(); }
      catch (err) { alert('Reorder failed: ' + err.message); }
      return;
    }
    if (act === 'edit-pot') { card.classList.toggle('editing'); return; }
    if (act === 'del-pot') {
      if (confirm('Delete this pot and all its flavors?')) {
        try { await api('/api/admin/pots/' + potId, { method: 'DELETE' }); refresh(); }
        catch (err) { alert('Delete failed: ' + err.message); }
      } return;
    }
    if (act === 'save-pot') {
      const fields = {};
      card.querySelectorAll('.pot-edit [data-f]').forEach(el => {
        let v = el.value; if (el.type === 'number') v = +v;
        fields[el.dataset.f] = v;
      });
      try { await api('/api/admin/pots/' + potId, { method: 'PUT', body: JSON.stringify(fields) }); flash('Pot saved'); refresh(); }
      catch (err) { alert('Save failed: ' + err.message); }
      return;
    }
    if (act === 'add-flavor') {
      const name = prompt('Custom flavour name?'); if (!name) return;
      try { await api('/api/admin/pots/' + potId + '/flavors', { method: 'POST', body: JSON.stringify({ name, strengthLabel: 'mild' }) }); refresh(); }
      catch (err) { alert('Add flavour failed: ' + err.message); }
      return;
    }
    if (act === 'del-flavor') {
      const row = e.target.closest('.flavor-row-v2'); const flavorId = row.dataset.flavorId;
      if (confirm('Delete this custom flavour?')) {
        try { await api('/api/admin/pots/' + potId + '/flavors/' + flavorId, { method: 'DELETE' }); refresh(); }
        catch (err) { alert('Delete failed: ' + err.message); }
      } return;
    }
    if (act === 'save-flavors') {
      const rows = card.querySelectorAll('.flavor-row-v2[data-flavor-id]');
      try {
        for (const row of rows) {
          const flavorId = row.dataset.flavorId;
          const fields = {};
          row.querySelectorAll('[data-ff]').forEach(el => {
            let v;
            if (el.type === 'checkbox') v = el.checked;
            else if (el.type === 'number') v = +el.value;
            else v = el.value;
            fields[el.dataset.ff] = v;
          });
          const ss = row.querySelector('.strength-select');
          if (ss) fields.strengthLabel = ss.value;
          const ti = row.querySelector('.tag-input');
          if (ti) fields.tags = readTagsFrom(ti);
          await api('/api/admin/pots/' + potId + '/flavors/' + flavorId, { method: 'PUT', body: JSON.stringify(fields) });
        }
        flash('Flavours saved'); refresh();
      } catch (err) { alert('Save failed: ' + err.message); }
      return;
    }
    if (act === 'unlink') {
      const libId = e.target.dataset.libId;
      if (confirm('Remove this library flavour from this pot?')) {
        try { await api('/api/admin/pots/' + potId + '/library/' + libId, { method: 'DELETE' }); refresh(); }
        catch (err) { alert('Unlink failed: ' + err.message); }
      } return;
    }
    if (act === 'link-selected') {
      const opts = card.querySelectorAll('.lib-option input[type=checkbox]:not(:disabled):checked');
      const ids = Array.from(opts).map(cb => cb.closest('.lib-option').dataset.libId);
      if (!ids.length) { alert('Pick at least one flavour from the list first.'); return; }
      try { await api('/api/admin/pots/' + potId + '/library', { method: 'POST', body: JSON.stringify({ libraryIds: ids }) });
        flash('Linked ' + ids.length + ' flavour' + (ids.length===1?'':'s')); refresh(); }
      catch (err) { alert('Link failed: ' + err.message); }
      return;
    }
  });
  $('#potList').addEventListener('input', e => {
    if (e.target.dataset.act !== 'lib-search') return;
    const card = e.target.closest('.pot-card');
    const opts = card.querySelector('.lib-options');
    opts.hidden = false;
    const q = e.target.value.trim().toLowerCase();
    card.querySelectorAll('.lib-option').forEach(o => { o.style.display = (!q || o.dataset.name.includes(q)) ? '' : 'none'; });
  });
  $('#potList').addEventListener('focusin', e => {
    if (e.target.dataset.act === 'lib-search') {
      const card = e.target.closest('.pot-card');
      card.querySelector('.lib-options').hidden = false;
    }
  });

  // ============ POTS VIEW SWITCH + ASSIGNMENT GRID ============
  let potsView = 'list';
  function showPotsView(name) {
    potsView = name === 'grid' ? 'grid' : 'list';
    const list = document.getElementById('potList');
    const grid = document.getElementById('potGrid');
    const hint = document.getElementById('potsViewHint');
    if (list) list.hidden = potsView !== 'list';
    if (grid) grid.hidden = potsView !== 'grid';
    document.querySelectorAll('[data-pots-view]').forEach(b => {
      b.classList.toggle('active', b.dataset.potsView === potsView);
    });
    if (hint) {
      hint.textContent = potsView === 'grid'
        ? 'Grid view: each column is a pot, each row is a library flavour. Click a cell to add or remove that flavour from that pot. Prices are derived from each pot’s base price (+ imported upcharge for imported blends).'
        : 'Card view: edit each pot, its image, base price, and inline flavours. Use Grid view to quickly check off which library flavours belong to which pot.';
    }
    if (potsView === 'grid') renderAssignmentGrid();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pots-view]');
    if (!b) return;
    e.preventDefault();
    showPotsView(b.dataset.potsView);
  });

  function buildLinkMap() {
    // potId -> Set of libraryIds linked
    const map = {};
    (DATA.pots || []).forEach(p => {
      const set = new Set();
      (p.flavors || []).forEach(f => { if (f.source === 'library' && f.libraryId) set.add(f.libraryId); });
      map[p.id] = set;
    });
    return map;
  }

  function renderAssignmentGrid() {
    const wrap = document.getElementById('potGrid');
    if (!wrap) return;
    const pots = DATA.pots || [];
    const lib = (DATA.library || []).slice().sort((a, b) => {
      const ba = a.blendType || 'signature', bb = b.blendType || 'signature';
      if (ba !== bb) return ba === 'signature' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    if (!pots.length || !lib.length) {
      wrap.innerHTML = '<div class="card muted" style="margin-top:14px;">' +
        (!pots.length ? 'Add at least one pot first.' : 'Library is empty — add flavours to the Flavour Library first.') +
      '</div>';
      return;
    }
    const linkMap = buildLinkMap();
    const totalCells = pots.length * lib.length;
    const totalLinked = pots.reduce((s, p) => s + (linkMap[p.id] ? linkMap[p.id].size : 0), 0);

    function potColHead(p) {
      const imported = p.importedPrice != null && p.importedPrice !== p.basePrice;
      return '<th class="ag-pot-col">' +
        '<div class="ag-pot-name">' + esc(p.name || 'Untitled') + '</div>' +
        '<div class="ag-pot-price">₹' + (p.basePrice || 0) +
          (imported ? ' <span class="ag-pot-imp">· imp ₹' + p.importedPrice + '</span>' : '') +
        '</div>' +
      '</th>';
    }
    function cellHtml(p, L) {
      const linked = linkMap[p.id] && linkMap[p.id].has(L.id);
      return '<td class="ag-cell" data-pot-id="' + esc(p.id) + '" data-lib-id="' + esc(L.id) + '"' +
        (linked ? ' data-linked="1"' : '') + '>' +
        '<span class="ag-mark">' + (linked ? '✓' : '') + '</span>' +
      '</td>';
    }
    function rowHtml(L) {
      const price = (cellPot) => Number(cellPot.basePrice || 0) +
        ((L.blendType === 'imported') ? Number((DATA.settings && DATA.settings.importedUpcharge) || 0) : 0);
      return '<tr class="ag-row" data-blend="' + esc(L.blendType || 'signature') + '" data-name="' + esc((L.name||'').toLowerCase()) + '">' +
        '<th class="ag-name-cell" scope="row">' +
          '<div class="ag-name">' + esc(L.name) + (L.popular ? ' <span class="ag-pop">★</span>' : '') + '</div>' +
          '<div class="ag-sub">' + esc(L.blendType || 'signature') + ' · ' + esc(L.strengthLabel || 'mild') + '</div>' +
        '</th>' +
        pots.map(p => cellHtml(p, L)).join('') +
      '</tr>';
    }

    const sig = lib.filter(L => (L.blendType || 'signature') === 'signature');
    const imp = lib.filter(L => (L.blendType || 'signature') === 'imported');

    wrap.innerHTML = '' +
      '<div class="ag-toolbar">' +
        '<div class="ag-stat">' + lib.length + ' flavour' + (lib.length===1?'':'s') +
        ' × ' + pots.length + ' pot' + (pots.length===1?'':'s') +
        ' · ' + totalLinked + ' / ' + totalCells + ' linked</div>' +
        '<input class="ag-search" id="agSearch" placeholder="Filter flavours…">' +
      '</div>' +
      '<div class="ag-scroll"><table class="ag-table"><thead><tr>' +
        '<th class="ag-name-col">Flavour</th>' +
        pots.map(potColHead).join('') +
      '</tr></thead><tbody>' +
        (sig.length ? '<tr class="ag-sec"><th colspan="' + (pots.length + 1) + '">SIGNATURE BLENDS</th></tr>' + sig.map(rowHtml).join('') : '') +
        (imp.length ? '<tr class="ag-sec"><th colspan="' + (pots.length + 1) + '">IMPORTED BLENDS</th></tr>' + imp.map(rowHtml).join('') : '') +
      '</tbody></table></div>';

    const search = document.getElementById('agSearch');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        wrap.querySelectorAll('.ag-row').forEach(r => {
          r.style.display = (!q || r.dataset.name.includes(q)) ? '' : 'none';
        });
      });
    }
  }

  // Click on a grid cell → toggle the link, optimistic UI, then API.
  document.addEventListener('click', async e => {
    const cell = e.target.closest('#potGrid .ag-cell');
    if (!cell) return;
    e.preventDefault();
    if (cell.dataset.busy) return;
    const potId = cell.dataset.potId;
    const libId = cell.dataset.libId;
    const wasLinked = cell.dataset.linked === '1';
    cell.dataset.busy = '1';
    if (wasLinked) {
      delete cell.dataset.linked;
      cell.querySelector('.ag-mark').textContent = '';
    } else {
      cell.dataset.linked = '1';
      cell.querySelector('.ag-mark').textContent = '✓';
    }
    try {
      if (wasLinked) {
        await api('/api/admin/pots/' + potId + '/library/' + libId, { method: 'DELETE' });
      } else {
        await api('/api/admin/pots/' + potId + '/library', { method: 'POST', body: JSON.stringify({ libraryIds: [libId] }) });
      }
      const pot = (DATA.pots || []).find(p => p.id === potId);
      const L = (DATA.library || []).find(x => x.id === libId);
      if (pot && L) {
        pot.flavors = pot.flavors || [];
        if (wasLinked) {
          pot.flavors = pot.flavors.filter(f => !(f.source === 'library' && f.libraryId === libId));
        } else if (!pot.flavors.some(f => f.source === 'library' && f.libraryId === libId)) {
          const up = (DATA.settings && DATA.settings.importedUpcharge) || 0;
          const isImp = (L.blendType || 'signature') === 'imported';
          pot.flavors.push({
            ...L, id: 'lib_' + L.id, potId: potId, source: 'library', libraryId: L.id,
            price: Number(pot.basePrice || 0) + (isImp ? up : 0)
          });
        }
      }
      const linkMap = buildLinkMap();
      const totalLinked = (DATA.pots || []).reduce((s, p) => s + (linkMap[p.id] ? linkMap[p.id].size : 0), 0);
      const totalCells = (DATA.pots || []).length * (DATA.library || []).length;
      const stat = document.querySelector('#potGrid .ag-stat');
      if (stat) stat.textContent = (DATA.library||[]).length + ' flavours × ' + (DATA.pots||[]).length + ' pots · ' + totalLinked + ' / ' + totalCells + ' linked';
    } catch (err) {
      if (wasLinked) { cell.dataset.linked = '1'; cell.querySelector('.ag-mark').textContent = '✓'; }
      else { delete cell.dataset.linked; cell.querySelector('.ag-mark').textContent = ''; }
      alert('Update failed: ' + err.message);
    } finally {
      delete cell.dataset.busy;
    }
  });

  // ============ PAIRINGS ============
  function renderPairings() {
    const wrap = $('#pairingList');
    if (!wrap) return;
    const items = (DATA && DATA.pairings) || [];
    if (!items.length) {
      wrap.innerHTML = '<div class="card muted">No pairings yet. Click "+ Add pairing" to create one.</div>';
      return;
    }
    wrap.innerHTML = items.map(p => '<div class="card pairing-row" data-id="' + esc(p.id) + '">' +
      '<div class="form-grid">' +
        '<label>Drink<input data-pf="drink" value="' + esc(p.drink || '') + '"></label>' +
        '<label>Flavour<input data-pf="flavor" value="' + esc(p.flavor || '') + '"></label>' +
        '<label class="full">Why it works<textarea data-pf="reason" rows="2">' + esc(p.reason || '') + '</textarea></label>' +
      '</div>' +
      '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">' +
        '<button class="ghost-btn" data-act="save-pairing">Save</button>' +
        '<button class="del-mini" data-act="del-pairing">Delete</button>' +
      '</div></div>').join('');
  }
  const addPairingBtn = $('#addPairing');
  if (addPairingBtn) addPairingBtn.addEventListener('click', async () => {
    try { await api('/api/admin/pairings', { method: 'POST', body: JSON.stringify({ drink: 'New drink', flavor: '', reason: '' }) }); refresh(); }
    catch (err) { alert('Add pairing failed: ' + err.message); }
  });
  const pairingListEl = $('#pairingList');
  if (pairingListEl) pairingListEl.addEventListener('click', async e => {
    const row = e.target.closest('.pairing-row'); if (!row) return;
    const id = row.dataset.id;
    const act = e.target.dataset.act; if (!act) return;
    e.preventDefault();
    if (act === 'del-pairing') {
      if (!confirm('Delete this pairing?')) return;
      try { await api('/api/admin/pairings/' + id, { method: 'DELETE' }); refresh(); }
      catch (err) { alert('Delete failed: ' + err.message); }
      return;
    }
    if (act === 'save-pairing') {
      const fields = {};
      row.querySelectorAll('[data-pf]').forEach(el => { fields[el.dataset.pf] = el.value; });
      try { await api('/api/admin/pairings/' + id, { method: 'PUT', body: JSON.stringify(fields) }); flash('Pairing saved'); refresh(); }
      catch (err) { alert('Save failed: ' + err.message); }
    }
  });

  // ============ FEEDBACK ============
  function renderFeedback() {
    const wrap = $('#feedbackList');
    if (!wrap) return;
    const items = (DATA && DATA.feedback) || [];
    if (!items.length) { wrap.innerHTML = '<div class="card muted">No feedback yet.</div>'; return; }
    wrap.innerHTML = items.map(f => {
      const r = Math.max(0, Math.min(5, f.rating || 0));
      const stars = '★'.repeat(r) + '☆'.repeat(5 - r);
      const when = f.timestamp ? new Date(f.timestamp).toLocaleString() : '';
      return '<div class="card" data-fb-id="' + esc(f.id) + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">' +
          '<div>' +
            '<div class="fb-stars">' + stars + '</div>' +
            '<div style="margin-top:4px;"><strong>' + esc(f.name || 'Anonymous') + '</strong>' +
              '<span class="muted" style="margin-left:6px; font-size:12px;">' + esc(when) + '</span></div>' +
            (f.experience ? '<p style="margin:8px 0 0; color:var(--ink); line-height:1.5;">' + esc(f.experience) + '</p>' : '') +
            (f.favoriteFlavor ? '<div class="fb-fav">Favourite: <b>' + esc(f.favoriteFlavor) + '</b></div>' : '') +
            '<div class="muted" style="font-size:12px; margin-top:4px;">' + (f.wouldRecommend ? 'Would recommend ✓' : 'Would not recommend') + '</div>' +
          '</div>' +
          '<button class="del-mini" data-act="del-feedback">Delete</button>' +
        '</div></div>';
    }).join('');
  }
  const feedbackListEl = $('#feedbackList');
  if (feedbackListEl) feedbackListEl.addEventListener('click', async e => {
    if (e.target.dataset.act !== 'del-feedback') return;
    const card = e.target.closest('[data-fb-id]'); if (!card) return;
    if (!confirm('Delete this feedback?')) return;
    try { await api('/api/admin/feedback/' + card.dataset.fbId, { method: 'DELETE' }); refresh(); }
    catch (err) { alert('Delete failed: ' + err.message); }
  });

  // ============ DASHBOARD ============
  async function loadDashboard() {
    try {
      const a = await api('/api/admin/analytics');
      const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setText('kpiViews', a.totalViews != null ? a.totalViews : 0);
      setText('kpiVisitors', a.uniqueVisitors != null ? a.uniqueVisitors : 0);
      setText('kpiFeedback', ((DATA && DATA.feedback) || []).length);
      const hours = a.hourly || new Array(24).fill(0);
      const max = Math.max(1, ...hours);
      let peakHour = 0; hours.forEach((h, i) => { if (h > hours[peakHour]) peakHour = i; });
      setText('kpiPeak', max > 0 ? (peakHour + ':00') : '—');
      const hm = document.getElementById('heatmap');
      if (hm) {
        hm.innerHTML = hours.map((h, i) => {
          const intensity = max ? (h / max) : 0;
          return '<div class="h-cell" style="background:rgba(90,26,31,' + (0.08 + intensity * 0.6) + ');"><span class="lbl">' + i + '</span></div>';
        }).join('');
      }
      const tf = document.getElementById('topFlavors');
      if (tf) {
        const top = (a.topFlavors || []).slice(0, 8);
        const allFlavors = ((DATA && DATA.pots) || []).flatMap(p => (p.flavors || []).map(f => ({ id: f.id, name: f.name })));
        const libById = {}; ((DATA && DATA.library) || []).forEach(L => { libById[L.id] = L; });
        tf.innerHTML = top.length ? top.map(t => {
          const fl = allFlavors.find(x => x.id === t.flavorId);
          const libMatch = !fl && t.flavorId && t.flavorId.indexOf('lib_') === 0 ? libById[t.flavorId.slice(4)] : null;
          const name = (fl && fl.name) || (libMatch && libMatch.name) || t.flavorId;
          return '<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #efe6cf;"><span>' + esc(name) + '</span><span class="muted">' + (t.count || 0) + '</span></div>';
        }).join('') : '<div class="muted">No taps yet.</div>';
      }
    } catch (err) { /* silent */ }
  }
  const resetBtn = $('#resetAnalytics');
  if (resetBtn) resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all analytics counts? This cannot be undone.')) return;
    try { await api('/api/admin/analytics/reset', { method: 'POST' }); flash('Analytics reset'); loadDashboard(); }
    catch (err) { alert('Reset failed: ' + err.message); }
  });

  // ============ BOOT + FLASH ============
  let _flashTimer = null;
  function flash(msg) {
    let el = document.getElementById('_flash');
    if (!el) {
      el = document.createElement('div');
      el.id = '_flash';
      el.style.cssText = 'position:fixed; top:18px; right:18px; z-index:9999; background:#1f6d4a; color:#fff; padding:10px 16px; border-radius:6px; font:500 13px/1 Inter, sans-serif; box-shadow:0 6px 18px rgba(0,0,0,0.2); opacity:0; transition:opacity 0.2s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  }
  checkAuth();
})();

// Smokzy Admin — login, CRUD, dashboard, image uploads, master flavour library
(() => {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
    try {
      const j = await api('/api/admin/me');
      if (j.admin) showApp(); else showLogin();
    } catch (e) { showLogin(); }
  }
  function showLogin() { $('#loginScreen').hidden = false; $('#adminApp').hidden = true; }
  function showApp()   { $('#loginScreen').hidden = true;  $('#adminApp').hidden = false; refresh(); }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = e.target.querySelector('button');
    btn.disabled = true;
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
    renderSettings(); renderCover(); renderFounder();
    renderLibrary(); renderPots(); renderPairings(); renderFeedback();
    loadDashboard();
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
        } else {
          flash('Uploaded ✓ — click Save to persist');
        }
        renderSettings();
      } catch (err) { alert('Upload failed: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = orig; }
    };
    fi.click();
  });

  // SETTINGS
  function renderSettings() {
    const s = (DATA && DATA.settings) || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('set_brandName', s.brandName); set('set_tagline', s.tagline);
    set('set_logoUrl', s.logoUrl); set('set_partnerName', s.partnerName);
    set('set_partnerLogoUrl', s.partnerLogoUrl);
    const lp = document.getElementById('settingsLogoPreview');
    if (lp) { lp.style.backgroundImage = s.logoUrl ? "url('" + s.logoUrl + "')" : ''; lp.textContent = s.logoUrl ? '' : 'No logo'; }
    const pp = document.getElementById('settingsPartnerPreview');
    if (pp) { pp.style.backgroundImage = s.partnerLogoUrl ? "url('" + s.partnerLogoUrl + "')" : ''; pp.textContent = s.partnerLogoUrl ? '' : 'No logo'; }
  }
  document.addEventListener('click', async e => {
    if (e.target.id !== 'saveSettings') return;
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({
        brandName: document.getElementById('set_brandName').value,
        tagline: document.getElementById('set_tagline').value,
        logoUrl: document.getElementById('set_logoUrl').value,
        partnerName: document.getElementById('set_partnerName').value,
        partnerLogoUrl: document.getElementById('set_partnerLogoUrl').value
      })});
      flash('Branding saved'); refresh();
    } catch (err) { alert(err.message); }
  });

  // COVER + FOUNDER
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
    } catch (err) { alert(err.message); }
  });
  $('#saveFounder').addEventListener('click', async () => {
    try {
      await api('/api/admin/founder', { method: 'PUT', body: JSON.stringify({
        title: $('#fn_title').value, founderName: $('#fn_name').value, body: $('#fn_body').value
      })});
      flash('Founder note saved');
    } catch (err) { alert(err.message); }
  });

  // ============ FLAVOUR LIBRARY ============
  function renderLibrary() {
    const wrap = $('#libraryList');
    if (!wrap) return;
    const lib = (DATA && DATA.library) || [];
    if (!lib.length) {
      wrap.innerHTML = '<div class="card muted" style="margin-top:14px;">Library is empty. Click "+ New flavour" to add your first one.</div>';
      return;
    }
    wrap.innerHTML = lib.map(L => `
      <div>
        <div class="library-card" data-id="${esc(L.id)}">
          <div class="library-thumb" style="background-image:url('${esc(L.image)}')"></div>
          <div><strong>${esc(L.name) || '<em style="color:#888">untitled</em>'}</strong>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${esc((L.description || '').slice(0, 80))}${(L.description||'').length>80?'…':''}</div>
          </div>
          <div><span class="blend-chip ${L.blendType}">${L.blendType}</span></div>
          <div style="font-size:13px;color:var(--muted);">Strength ${L.strength}/10</div>
          <div style="font-size:13px;color:var(--muted);">₹${L.defaultPrice}</div>
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
            <label>Strength (1-10)<input data-lf="strength" type="number" min="1" max="10" value="${L.strength}"></label>
            <label>Default price (₹)<input data-lf="defaultPrice" type="number" value="${L.defaultPrice}"></label>
            <label class="full">Image URL
              <div class="img-with-upload">
                <input data-lf="image" id="lib_img_${L.id}" value="${esc(L.image || '')}">
                <button type="button" class="ghost-btn" data-upload-target="lib_img_${L.id}">Upload…</button>
              </div>
            </label>
            <label class="full">Description / tasting notes<textarea data-lf="description" rows="3">${esc(L.description || '')}</textarea></label>
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

  $('#addLibrary').addEventListener('click', async () => {
    const name = prompt('Flavour name? (you can fill the rest after)');
    if (!name) return;
    await api('/api/admin/library', { method: 'POST', body: JSON.stringify({ name, blendType: 'signature' }) });
    refresh();
  });

  $('#libraryList').addEventListener('click', async e => {
    const card = e.target.closest('.library-card');
    if (!card) return;
    const id = card.dataset.id;
    const act = e.target.dataset.act;
    if (!act) return;
    e.preventDefault();
    if (act === 'edit-lib') { card.classList.toggle('editing'); return; }
    if (act === 'del-lib') {
      const L = (DATA.library || []).find(x => x.id === id);
      if (L && L.usedInPots > 0) {
        if (!confirm(`This flavour is used in ${L.usedInPots} pot(s). Deleting will remove it from those pots too. Continue?`)) return;
      } else {
        if (!confirm('Delete this flavour from the library?')) return;
      }
      await api('/api/admin/library/' + id, { method: 'DELETE' });
      refresh();
      return;
    }
    if (act === 'save-lib') {
      const wrap = card.parentElement;
      const fields = {};
      wrap.querySelectorAll('[data-lf]').forEach(el => {
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number') v = +el.value;
        else v = el.value;
        fields[el.dataset.lf] = v;
      });
      await api('/api/admin/library/' + id, { method: 'PUT', body: JSON.stringify(fields) });
      flash('Library flavour saved');
      refresh();
    }
  });

  // ============ POTS + FLAVORS ============
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
            <div class="pot-tagline">${esc(pot.tagline || '')} · From ₹${pot.basePrice == null ? 0 : pot.basePrice} · ${(pot.flavors || []).length} flavors</div>
          </div>
          <div class="pot-actions">
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

        <!-- LIBRARY-LINKED FLAVOURS -->
        <div class="lib-picker">
          <div class="picker-head">
            <strong style="color:var(--ink); letter-spacing:0; text-transform:none; font-size:14px;">Flavours from Library</strong>
            <span style="margin-left:auto; font-size:11px;">${linkedFlavors.length} linked</span>
          </div>
          <div class="linked-rows">
            ${linkedFlavors.map(f => `
              <span class="linked-pill ${f.blendType}">${esc(f.name)}
                <button data-act="unlink" data-lib-id="${esc(f.libraryId)}" title="Remove from this pot">×</button>
              </span>`).join('')}
            ${linkedFlavors.length===0 ? '<span style="color:var(--muted); font-size:13px; font-style:italic;">No library flavours linked yet.</span>' : ''}
          </div>
          <input type="text" class="picker-search" placeholder="Search library to add…" data-act="lib-search">
          <div class="lib-options" data-act="lib-options" hidden>
            ${lib.map(L => `
              <label class="lib-option" data-lib-id="${esc(L.id)}" data-name="${esc(L.name).toLowerCase()}">
                <input type="checkbox" ${linkedIds.has(L.id) ? 'checked disabled' : ''}>
                <span class="name">${esc(L.name)}</span>
                <span class="blend-chip ${L.blendType}">${L.blendType}</span>
                <span style="color:var(--muted); font-size:12px;">str ${L.strength} · ₹${L.defaultPrice}</span>
              </label>`).join('')}
          </div>
          <button class="primary-btn" data-act="link-selected" style="margin-top:8px;">Add selected to pot</button>
        </div>

        <!-- INLINE (custom one-off) FLAVOURS -->
        <div class="flavor-table">
          <div class="picker-head" style="display:flex; align-items:center; gap:8px;">
            <strong style="color:var(--ink); letter-spacing:0; text-transform:none; font-size:14px;">Custom flavours (this pot only)</strong>
          </div>
          ${inlineFlavors.length ? `
          <div class="flavor-row header">
            <div>Image</div><div>Name</div><div>Strength</div><div>Price</div><div>Description</div><div class="center">Pop?</div><div></div>
          </div>` : ''}
          ${inlineFlavors.map(fl => `
            <div class="flavor-row" data-flavor-id="${esc(fl.id)}">
              <div class="flavor-thumb-cell">
                <div class="flavor-thumb" style="background-image:url('${esc(fl.image || '')}')"></div>
                <input data-ff="image" id="fl_img_${fl.id}" value="${esc(fl.image || '')}" placeholder="URL or upload">
                <button type="button" class="ghost-btn mini" data-upload-target="fl_img_${fl.id}" title="Upload image">↑</button>
              </div>
              <input data-ff="name" value="${esc(fl.name)}">
              <input data-ff="strength" type="number" min="1" max="10" value="${fl.strength || 5}">
              <input data-ff="price" type="number" value="${fl.price || pot.basePrice || 0}">
              <textarea data-ff="description" placeholder="Tasting notes...">${esc(fl.description || '')}</textarea>
              <input data-ff="popular" type="checkbox" ${fl.popular ? 'checked' : ''} class="center">
              <button class="del-mini" data-act="del-flavor">Delete</button>
            </div>`).join('')}
          <div class="add-flavor-row" data-act="add-flavor">+ Add custom flavour</div>
          ${inlineFlavors.length ? '<div style="margin-top:10px;"><button class="primary-btn" data-act="save-flavors">Save custom flavours</button></div>' : ''}
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  $('#addPot').addEventListener('click', async () => {
    const name = prompt('Name for the new pot?'); if (!name) return;
    await api('/api/admin/pots', { method: 'POST', body: JSON.stringify({ name, tagline: '', basePrice: 0 }) });
    refresh();
  });

  // pot-level interactions (delegated)
  $('#potList').addEventListener('click', async e => {
    const card = e.target.closest('.pot-card'); if (!card) return;
    const potId = card.dataset.id;
    const act = e.target.dataset.act; if (!act) return;
    e.preventDefault();
    if (act === 'edit-pot') { card.classList.toggle('editing'); return; }
    if (act === 'del-pot') {
      if (confirm('Delete this pot and all its flavors?')) {
        await api('/api/admin/pots/' + potId, { method: 'DELETE' }); refresh();
      } return;
    }
    if (act === 'save-pot') {
      const fields = {};
      card.querySelectorAll('.pot-edit [data-f]').forEach(el => {
        let v = el.value; if (el.type === 'number') v = +v;
        fields[el.dataset.f] = v;
      });
      await api('/api/admin/pots/' + potId, { method: 'PUT', body: JSON.stringify(fields) });
      flash('Pot saved'); refresh(); return;
    }
    if (act === 'add-flavor') {
      const name = prompt('Custom flavour name?'); if (!name) return;
      await api('/api/admin/pots/' + potId + '/flavors', { method: 'POST', body: JSON.stringify({ name }) });
      refresh(); return;
    }
    if (act === 'del-flavor') {
      const row = e.target.closest('.flavor-row'); const flavorId = row.dataset.flavorId;
      if (confirm('Delete this custom flavour?')) {
        await api('/api/admin/pots/' + potId + '/flavors/' + flavorId, { method: 'DELETE' }); refresh();
      } return;
    }
    if (act === 'save-flavors') {
      const rows = card.querySelectorAll('.flavor-row[data-flavor-id]');
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
        await api('/api/admin/pots/' + potId + '/flavors/' + flavorId, { method: 'PUT', body: JSON.stringify(fields) });
      }
      flash('Flavours saved'); refresh(); return;
    }
    // unlink a library flavor
    if (act === 'unlink') {
      const libId = e.target.dataset.libId;
      if (confirm('Remove this library flavour from this pot? (the master flavour stays in your library)')) {
        await api('/api/admin/pots/' + potId + '/library/' + libId, { method: 'DELETE' });
        refresh();
      }
      return;
    }
    // link selected library flavours
    if (act === 'link-selected') {
      const opts = card.querySelectorAll('.lib-option input[type=checkbox]:not(:disabled):checked');
      const ids = Array.from(opts).map(cb => cb.closest('.lib-option').dataset.libId);
      if (!ids.length) { alert('Pick at least one flavour from the list first.'); return; }
      await api('/api/admin/pots/' + potId + '/library', { method: 'POST', body: JSON.stringify({ libraryIds: ids }) });
      flash('Linked ' + ids.length + ' flavour' + (ids.length===1?'':'s'));
      refresh();
      return;
    }
  });

  // search filter for the lib-options dropdown
  $('#potList').addEventListener('input', e => {
    if (e.target.dataset.act !== 'lib-search') return;
    const card = e.target.closest('.pot-card');
    const opts = card.querySelector('.lib-options');
    opts.hidden = false;
    const q = e.target.value.trim().toLowerCase();
    card.querySelectorAll('.lib-option').forEach(o => {
      o.style.display = (!q || o.dataset.name.includes(q)) ? '' : 'none';
    });
  });
  $('#potList').addEventListener('focusin', e => {
    if (e.target.dataset.act === 'lib-search') {
      const card = e.target.closest('.pot-card');
      card.querySelector('.lib-options').hidden = false;
    }
  });

  // ============ PAIRINGS ============
  function renderPairings() {
    const wrap = $('#pairingList'); wrap.innerHTML = '';
    (DATA.pairings || []).forEach(p => {
      const div = document.createElement('div');
      div.className = 'pairing-card'; div.dataset.id = p.id;
      div.innerHTML = `
        <input data-pf="drink" placeholder="Drink" value="${esc(p.drink)}">
        <input data-pf="flavor" placeholder="Recommended flavor" value="${esc(p.flavor)}">
        <textarea data-pf="reason" placeholder="Why it works...">${esc(p.reason)}</textarea>
        <button class="del-mini" data-act="del-pairing">×</button>
      `;
      wrap.appendChild(div);
    });
    const saveAll = document.createElement('button');
    saveAll.className = 'primary-btn'; saveAll.style.marginTop = '12px';
    saveAll.textContent = 'Save all pairings'; saveAll.dataset.act = 'save-pairings';
    wrap.appendChild(saveAll);
  }
  $('#addPairing').addEventListener('click', async () => {
    await api('/api/admin/pairings', { method: 'POST', body: JSON.stringify({ drink: '', flavor: '', reason: '' }) });
    refresh();
  });
  $('#pairingList').addEventListener('click', async e => {
    const act = e.target.dataset.act;
    if (act === 'del-pairing') {
      const id = e.target.closest('.pairing-card').dataset.id;
      if (confirm('Delete this pairing?')) {
        await api('/api/admin/pairings/' + id, { method: 'DELETE' }); refresh();
      }
    }
    if (act === 'save-pairings') {
      const rows = $$('#pairingList .pairing-card');
      for (const row of rows) {
        const id = row.dataset.id;
        const fields = {};
        row.querySelectorAll('[data-pf]').forEach(el => fields[el.dataset.pf] = el.value);
        await api('/api/admin/pairings/' + id, { method: 'PUT', body: JSON.stringify(fields) });
      }
      flash('Pairings saved');
    }
  });

  // ============ FEEDBACK ============
  function renderFeedback() {
    const wrap = $('#feedbackList');
    if (!DATA.feedback || !DATA.feedback.length) {
      wrap.innerHTML = '<div class="card muted" style="margin:0;">No feedback yet.</div>'; return;
    }
    wrap.innerHTML = DATA.feedback.map(f => `
      <div class="fb-card" data-id="${esc(f.id)}">
        <div class="fb-head">
          <div>
            <div class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</div>
            <div class="fb-name">${esc(f.name) || 'Anonymous'}</div>
          </div>
          <div style="text-align:right">
            <div class="fb-meta">${new Date(f.timestamp).toLocaleString()}</div>
            <button class="del-mini" data-act="del-fb">Delete</button>
          </div>
        </div>
        ${f.experience ? '<div class="fb-text">' + esc(f.experience) + '</div>' : ''}
        ${f.favoriteFlavor ? '<div class="fb-fav">Favorite tonight: <b>' + esc(f.favoriteFlavor) + '</b></div>' : ''}
        <div class="fb-fav">${f.wouldRecommend ? '✓ Would recommend' : '✗ Would not recommend'}</div>
      </div>`).join('');
  }
  $('#feedbackList').addEventListener('click', async e => {
    if (e.target.dataset.act === 'del-fb') {
      const id = e.target.closest('.fb-card').dataset.id;
      if (confirm('Delete this feedback?')) {
        await api('/api/admin/feedback/' + id, { method: 'DELETE' }); refresh();
      }
    }
  });

  // ============ DASHBOARD ============
  async function loadDashboard() {
    let a;
    try { a = await api('/api/admin/analytics'); } catch (e) { return; }
    $('#kpiViews').textContent = a.totalViews.toLocaleString();
    $('#kpiVisitors').textContent = a.uniqueVisitors.toLocaleString();
    $('#kpiFeedback').textContent = a.feedbackCount.toLocaleString();
    const peakHour = a.hourlyTraffic.indexOf(Math.max.apply(null, a.hourlyTraffic));
    $('#kpiPeak').textContent = a.totalViews ? (String(peakHour).padStart(2,'0') + ':00') : '—';
    const max = Math.max.apply(null, [1].concat(a.hourlyTraffic));
    $('#heatmap').innerHTML = a.hourlyTraffic.map((v, i) => {
      const intensity = v / max;
      const color = 'rgba(90, 26, 31, ' + (0.1 + intensity * 0.9) + ')';
      return '<div class="h-cell" title="' + i + ':00 — ' + v + ' views" style="background:' + (v ? color : '#ece8e2') + '">' +
             (i % 3 === 0 ? '<span class="lbl">' + i + '</span>' : '') + '</div>';
    }).join('');
    if (!a.topFlavors.length) {
      $('#topFlavors').innerHTML = '<div class="muted">No flavor taps yet.</div>';
    } else {
      $('#topFlavors').innerHTML = a.topFlavors.map((f, i) =>
        '<div class="top-row"><span class="rank">' + (i + 1) + '</span><span class="name">' + esc(f.name) + '</span><span class="count">' + f.count + '</span></div>'
      ).join('');
    }
  }
  $('#resetAnalytics').addEventListener('click', async () => {
    if (!confirm('Reset ALL analytics? This cannot be undone.')) return;
    await api('/api/admin/analytics/reset', { method: 'POST' });
    loadDashboard();
  });

  function flash(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%);' +
      'background:var(--ink); color:var(--gold); padding:10px 18px; border-radius:6px;' +
      'font-size:13px; letter-spacing:1px; box-shadow:0 8px 30px rgba(0,0,0,0.3); z-index:1000;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  checkAuth();
})();

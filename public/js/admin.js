// Smokzy Admin — login, CRUD, dashboard, image uploads
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
    renderPots(); renderPairings(); renderFeedback();
    loadDashboard();
  }

  // delegated upload (any element with data-upload-target="<inputId>")
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
        flash('Uploaded ✓');
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
    set('set_brandName', s.brandName);
    set('set_tagline', s.tagline);
    set('set_logoUrl', s.logoUrl);
    set('set_partnerName', s.partnerName);
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

  // POTS + FLAVORS
  function renderPots() {
    const wrap = $('#potList'); wrap.innerHTML = '';
    (DATA.pots || []).forEach(pot => {
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
        <div class="flavor-table">
          <div class="flavor-row header">
            <div>Image</div><div>Flavor name</div><div>Strength</div><div>Price ₹</div><div>Description</div><div class="center">Pop?</div><div></div>
          </div>
          ${(pot.flavors || []).map(fl => `
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
          <div class="add-flavor-row" data-act="add-flavor">+ Add flavor to ${esc(pot.name)}</div>
          <div style="margin-top:10px;"><button class="primary-btn" data-act="save-flavors">Save all flavors</button></div>
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
      const name = prompt('Flavor name?'); if (!name) return;
      await api('/api/admin/pots/' + potId + '/flavors', { method: 'POST', body: JSON.stringify({ name }) });
      refresh(); return;
    }
    if (act === 'del-flavor') {
      const row = e.target.closest('.flavor-row'); const flavorId = row.dataset.flavorId;
      if (confirm('Delete this flavor?')) {
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
      flash('Flavors saved'); refresh();
    }
  });

  // PAIRINGS
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

  // FEEDBACK
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

  // DASHBOARD
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

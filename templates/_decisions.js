/**
 * Shared decision bar for mockup review.
 * Usage in each mockup:
 *   <script src="_decisions.js"></script>
 *   <script>
 *     decisionBar.init({
 *       fixId: 'fix-01',
 *       title: 'Logo full',
 *       variants: [{ id: 'A', label: 'Card bianca' }, ...],
 *       allowPending: true,
 *     });
 *   </script>
 */
(() => {
  const ENDPOINT = '/.preview/decisions';
  const STATE_URL = '/.preview/decisions.json';

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v !== undefined && v !== null) e.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  async function post(payload) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function loadState(fixId) {
    try {
      const r = await fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const data = await r.json();
      return data[fixId] || null;
    } catch (e) {
      return null;
    }
  }

  function statusPill(status) {
    const colors = {
      pending: ['#fbbf24', '#78350f'],
      approved: ['#10b981', '#064e3b'],
      revise: ['#ef4444', '#7f1d1d'],
      variant: ['#3b82f6', '#1e3a8a'],
    };
    const pair = colors[status] || colors.pending;
    return el('span', {
      style: {
        background: pair[0],
        color: pair[1],
        padding: '2px 8px',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: '600',
      },
    }, status);
  }

  function replaceChildren(node, ...newChildren) {
    while (node.firstChild) node.removeChild(node.firstChild);
    for (const c of newChildren) if (c != null) node.append(c);
  }

  function highlightVariant(variantId, anchors) {
    if (!anchors) return;
    for (const [id, sel] of Object.entries(anchors)) {
      const node = document.querySelector(sel);
      if (!node) continue;
      node.classList.add('variant-target');
      node.classList.remove('variant-selected', 'variant-dimmed');
      if (id === variantId) node.classList.add('variant-selected');
    }
    // NOTE: no scrolling, no dimming of other variants — user asked for side-by-side comparison.
  }

  function clearVariantHighlight(anchors) {
    if (!anchors) return;
    for (const sel of Object.values(anchors)) {
      const node = document.querySelector(sel);
      if (node) node.classList.remove('variant-selected', 'variant-dimmed');
    }
  }

  function makeVariantNodesClickable(anchors, onToggleFn) {
    if (!anchors) return;
    for (const [id, sel] of Object.entries(anchors)) {
      const node = document.querySelector(sel);
      if (!node) continue;
      node.classList.add('variant-target', 'variant-clickable');
      node.style.cursor = 'pointer';
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', 'Seleziona variante ' + id);
      node.addEventListener('click', (e) => {
        // ignore click on links/buttons inside the card
        if (e.target.closest('a, button, input, textarea, select')) return;
        onToggleFn(id);
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleFn(id);
        }
      });
    }
  }

  const init = async (opts) => {
    const fixId = opts.fixId;
    const title = opts.title || '';
    const variants = opts.variants || null;
    const kpiSets = opts.kpiSets || null;
    const allowPending = opts.allowPending !== false;
    const variantAnchors = opts.variantAnchors || null;
    const onVariantSelect = typeof opts.onVariantSelect === 'function' ? opts.onVariantSelect : null;

    document.querySelectorAll('.decision-bar').forEach(n => n.remove());

    const container = el('div', {
      class: 'decision-bar-live',
      style: {
        margin: '3rem auto 0',
        maxWidth: '1280px',
        background: '#0f1722',
        border: '2px solid #00AAFF',
        boxShadow: '0 10px 40px rgba(0,170,255,0.18)',
        padding: '14px 18px',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#fff',
        position: 'relative',
      },
    });

    const statusWrap = el('div', {
      id: 'status-wrap',
      style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', flexWrap: 'wrap' },
    });

    const head = el('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' },
    },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        el('strong', {
          style: { color: '#00AAFF', fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase' },
        }, fixId.toUpperCase()),
        el('span', { style: { fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' } }, title),
      ),
      statusWrap,
    );

    const btnBase = {
      padding: '8px 14px',
      fontSize: '0.8rem',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: 'pointer',
      border: 'none',
      fontFamily: 'inherit',
      transition: 'all 0.2s',
    };

    const noteInput = el('textarea', {
      id: 'note-input',
      rows: '2',
      placeholder: 'scrivi cosa modificare, poi invia con "revise" →',
      style: {
        width: '100%',
        minHeight: '44px',
        padding: '8px 10px',
        background: '#1a2332',
        border: '1px solid rgba(255,255,255,0.15)',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: '0.85rem',
        resize: 'vertical',
        boxSizing: 'border-box',
      },
    });

    const approveBtn = el('button', {
      style: Object.assign({}, btnBase, { background: '#10b981', color: '#fff' }),
      onclick: () => submit({ status: 'approved' }),
    }, '✓ approve');

    const pendingBtn = allowPending ? el('button', {
      style: Object.assign({}, btnBase, { background: '#fbbf24', color: '#78350f' }),
      onclick: () => submit({ status: 'pending' }),
    }, '⏸ pending') : null;

    const reviseBtn = el('button', {
      style: Object.assign({}, btnBase, { background: '#ef4444', color: '#fff', alignSelf: 'stretch', minWidth: '160px' }),
      onclick: async () => {
        const note = noteInput.value.trim();
        if (!note) {
          noteInput.style.borderColor = '#ef4444';
          noteInput.focus();
          return;
        }
        await submit({ status: 'revise', note: note });
        reviseBtn.textContent = '… inviando';
        reviseBtn.style.background = '#f59e0b';
        try {
          const r = await fetch('/.preview/send-to-claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'leggi il commento su ' + fixId }),
          });
          const d = await r.json();
          if (d.ok) {
            reviseBtn.textContent = '✓ inviato (' + (d.frontApp || 'terminale') + ')';
            reviseBtn.style.background = '#10b981';
          } else {
            reviseBtn.textContent = '⚠ errore: ' + (d.osascriptError || 'attiva terminale Claude');
            reviseBtn.style.background = '#ef4444';
          }
        } catch (e) {
          reviseBtn.textContent = '⚠ server non risponde';
          reviseBtn.style.background = '#ef4444';
        }
        setTimeout(() => {
          reviseBtn.textContent = '↻ invia a Claude';
          reviseBtn.style.background = '#ef4444';
        }, 4000);
      },
    }, '↻ invia a Claude');

    // Auto-save on blur and Ctrl/Cmd+Enter
    let noteAutoSaveTimer = null;
    noteInput.addEventListener('blur', () => {
      const note = noteInput.value.trim();
      if (note && note !== (noteInput.dataset.lastSaved || '')) {
        submit({ status: 'revise', note: note });
        noteInput.dataset.lastSaved = note;
      }
    });
    noteInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const note = noteInput.value.trim();
        if (note) {
          submit({ status: 'revise', note: note });
          noteInput.dataset.lastSaved = note;
        }
      }
    });
    noteInput.addEventListener('input', () => {
      clearTimeout(noteAutoSaveTimer);
      reviseBtn.textContent = '… scrivendo';
      reviseBtn.style.background = '#f59e0b';
      noteAutoSaveTimer = setTimeout(() => {
        const note = noteInput.value.trim();
        if (note && note !== (noteInput.dataset.lastSaved || '')) {
          submit({ status: 'revise', note: note });
          noteInput.dataset.lastSaved = note;
        }
        reviseBtn.textContent = '↻ invia a Claude';
        reviseBtn.style.background = '#ef4444';
      }, 1500);
    });

    let variantSelect = null;
    let variantButtons = {};
    let currentVariant = null;

    // Single source of truth for variant toggle — used by bar buttons AND card clicks
    const toggleVariant = (variantId) => {
      if (currentVariant === variantId) {
        clearVariantHighlight(variantAnchors);
        setVariantButtonActive(null);
        currentVariant = null;
        if (onVariantSelect) onVariantSelect(null);
        submit({ status: 'pending', variant: '' });
      } else {
        highlightVariant(variantId, variantAnchors);
        setVariantButtonActive(variantId);
        currentVariant = variantId;
        if (onVariantSelect) onVariantSelect(variantId);
        submit({ status: 'variant', variant: variantId });
      }
    };

    if (variants && variants.length) {
      variantSelect = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
      variants.forEach(v => {
        const btn = el('button', {
          'data-variant': v.id,
          style: Object.assign({}, btnBase, {
            background: 'rgba(0,170,255,0.15)',
            color: '#7DD3FC',
            border: '1px solid rgba(0,170,255,0.3)',
            padding: '6px 12px',
            textAlign: 'left',
          }),
          onclick: () => toggleVariant(v.id),
        },
          el('div', { style: { fontWeight: '700' } }, 'variant ' + v.id),
          v.label ? el('div', { style: { fontSize: '0.65rem', fontWeight: '400', textTransform: 'none', opacity: '0.75', marginTop: '1px' } }, v.label) : null,
        );
        variantButtons[v.id] = btn;
        variantSelect.append(btn);
      });
    }

    const setVariantButtonActive = (id) => {
      Object.entries(variantButtons).forEach(([k, btn]) => {
        if (id != null && k === id) {
          btn.style.background = 'var(--color-orange)';
          btn.style.color = '#fff';
          btn.style.borderColor = 'var(--color-orange)';
          btn.style.boxShadow = '0 0 12px rgba(255,163,0,0.5)';
        } else {
          btn.style.background = 'rgba(0,170,255,0.15)';
          btn.style.color = '#7DD3FC';
          btn.style.borderColor = 'rgba(0,170,255,0.3)';
          btn.style.boxShadow = 'none';
        }
      });
    };

    let kpiSetSelect = null;
    let kpiSetButtons = {};
    if (kpiSets && kpiSets.length) {
      kpiSetSelect = el('div', {
        style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' },
      }, el('span', {}, 'Set KPI:'));
      kpiSets.forEach(s => {
        const btn = el('button', {
          'data-set': s.id,
          style: Object.assign({}, btnBase, {
            padding: '4px 10px',
            fontSize: '0.7rem',
            background: 'rgba(255,163,0,0.15)',
            color: '#fcd34d',
            border: '1px solid rgba(255,163,0,0.3)',
          }),
          onclick: () => submit({ set: s.id }),
        }, s.label);
        kpiSetButtons[s.id] = btn;
        kpiSetSelect.append(btn);
      });
    }

    const setKpiButtonActive = (id) => {
      Object.entries(kpiSetButtons).forEach(([k, btn]) => {
        if (k === id) {
          btn.style.background = '#fcd34d';
          btn.style.color = '#78350f';
          btn.style.borderColor = '#fcd34d';
        } else {
          btn.style.background = 'rgba(255,163,0,0.15)';
          btn.style.color = '#fcd34d';
          btn.style.borderColor = 'rgba(255,163,0,0.3)';
        }
      });
    };

    const row1Children = [approveBtn];
    if (pendingBtn) row1Children.push(pendingBtn);
    if (variantSelect) row1Children.push(variantSelect);
    if (kpiSetSelect) row1Children.push(kpiSetSelect);

    const row1 = el('div', {
      style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' },
    }, ...row1Children);

    const row2 = el('div', {
      style: { display: 'flex', gap: '10px', alignItems: 'stretch' },
    }, noteInput, reviseBtn);

    const flash = el('div', {
      id: 'flash',
      style: {
        position: 'absolute',
        top: '-36px',
        right: '0',
        background: '#10b981',
        color: '#fff',
        padding: '6px 14px',
        fontSize: '0.8rem',
        fontWeight: '600',
        opacity: '0',
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      },
    }, 'saved ✓');

    container.append(head, row1, row2, flash);

    document.body.append(container);

    const updateStatusDisplay = (state) => {
      const children = [el('span', {}, 'status:')];
      if (!state) {
        children.push(statusPill('pending'));
      } else {
        children.push(statusPill(state.status || 'pending'));
        if (state.variant) children.push(el('span', { style: { fontSize: '0.75rem', color: '#7DD3FC' } }, 'variant=' + state.variant));
        if (state.set) children.push(el('span', { style: { fontSize: '0.75rem', color: '#fcd34d' } }, 'set=' + state.set));
        if (state.note) children.push(el('span', {
          style: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        }, '"' + state.note + '"'));
        if (state.note) noteInput.value = state.note;
      }
      replaceChildren(statusWrap, ...children);
    };

    const showFlash = () => {
      flash.style.opacity = '1';
      setTimeout(() => { flash.style.opacity = '0'; }, 1600);
    };

    const showPostSaveHint = (note) => {
      const existing = document.getElementById('claude-nudge');
      if (existing) existing.remove();
      const nudge = document.createElement('div');
      nudge.id = 'claude-nudge';
      nudge.style.cssText = 'position:fixed;top:12px;right:12px;background:#10b981;color:#fff;padding:8px 14px;font-family:Inter,sans-serif;font-size:0.8rem;font-weight:600;z-index:99999;box-shadow:0 4px 14px rgba(16,185,129,0.35);letter-spacing:0.05em;';
      nudge.textContent = '✓ commento salvato';
      document.body.appendChild(nudge);
      setTimeout(() => nudge.remove(), 2000);
    };

    const submit = async (partial) => {
      try {
        const body = Object.assign({ fixId: fixId }, partial);
        const result = await post(body);
        updateStatusDisplay(result.saved);
        if (result.saved.variant) setVariantButtonActive(result.saved.variant);
        if (result.saved.set) setKpiButtonActive(result.saved.set);
        showFlash();
        if (partial.status === 'revise' && partial.note) showPostSaveHint(partial.note);
      } catch (e) {
        alert('errore salvataggio: ' + e.message);
      }
    };

    // Make the variant cards themselves clickable (not just the bar buttons)
    makeVariantNodesClickable(variantAnchors, toggleVariant);

    const initial = await loadState(fixId);
    updateStatusDisplay(initial);
    if (initial && initial.variant) {
      currentVariant = initial.variant;
      setVariantButtonActive(initial.variant);
      highlightVariant(initial.variant, variantAnchors);
      if (onVariantSelect) onVariantSelect(initial.variant);
    }
    if (initial && initial.set) {
      setKpiButtonActive(initial.set);
    }

    // Expose for testing
    window.__decisionBarState = { setVariantButtonActive: setVariantButtonActive, setKpiButtonActive: setKpiButtonActive };
  };

  // Live reload: polls mtime of current HTML; if it changes, reloads the page.
  // Activated automatically on every mockup page (so user sees Claude's updates live).
  async function startLiveReload() {
    const path = location.pathname;
    let lastMtime = null;
    try {
      const r = await fetch('/.preview/mtime?path=' + encodeURIComponent(path), { cache: 'no-store' });
      const d = await r.json();
      lastMtime = d.mtime;
    } catch (e) { return; }
    // Also monitor _decisions.js and _shared.css to reload on framework updates
    const extras = ['/.preview/mockups/_decisions.js', '/.preview/mockups/_shared.css'];
    const extraMtimes = {};
    for (const p of extras) {
      try {
        const r = await fetch('/.preview/mtime?path=' + encodeURIComponent(p), { cache: 'no-store' });
        const d = await r.json();
        extraMtimes[p] = d.mtime;
      } catch (e) {}
    }
    setInterval(async () => {
      try {
        const r = await fetch('/.preview/mtime?path=' + encodeURIComponent(path), { cache: 'no-store' });
        const d = await r.json();
        if (d.mtime && lastMtime && d.mtime !== lastMtime) {
          const badge = document.createElement('div');
          badge.textContent = '🔄 Claude ha aggiornato la pagina · ricarico…';
          badge.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:10px 18px;font-family:Inter,sans-serif;font-size:0.9rem;font-weight:600;z-index:99999;box-shadow:0 6px 20px rgba(16,185,129,0.4);';
          document.body.appendChild(badge);
          setTimeout(() => location.reload(), 500);
          return;
        }
        for (const p of extras) {
          const r2 = await fetch('/.preview/mtime?path=' + encodeURIComponent(p), { cache: 'no-store' });
          const d2 = await r2.json();
          if (d2.mtime && extraMtimes[p] && d2.mtime !== extraMtimes[p]) {
            setTimeout(() => location.reload(), 300);
            return;
          }
        }
      } catch (e) {}
    }, 2000);
  }

  // kick off on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLiveReload);
  } else {
    startLiveReload();
  }

  window.decisionBar = { init: init };
})();

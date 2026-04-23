---
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, TaskCreate, TaskUpdate, TaskList
description: Parse client feedback granularly (1 annotation = 1 task), generate HTML mockups with interactive review bar, collect decisions in browser, then implement. AI acts as senior UI/UX expert.
---

# /client-revision — Gestione revisione cliente (con mockup-review framework)

Gestisce il feedback cliente in 3 fasi: **parse granulare → mockup interattivi in browser → implementazione batch**.

Agisci come **senior UI/UX designer**: ogni proposta include rationale di design, non solo classi Tailwind.

**Prerequisito**: il framework deve essere installato. Se `.preview/mockups/_server.py` non esiste, lancia prima `/mockup-init`.

---

## Step 1 — Raccogli il feedback

Fonte:
- **A: Export FeedbackWidget** — HTML/Markdown report incollato
- **B: Testo libero** — email, messaggio, trascrizione vocale
- **C: Lista già organizzata** dall'utente

Se ci sono allegati (immagini, asset), l'utente deve fornirli come path locali.

---

## Step 2 — Identifica il progetto

1. Verifica che tu sia in un progetto valido (package.json, astro.config, ecc.)
2. Leggi `CLAUDE.md` e altre istruzioni di progetto
3. Identifica l'URL preview dal report (es. `studio-buccini.vercel.app`)

---

## Step 3 — Parsing GRANULARE (1 annotazione = 1 task)

**REGOLA FERREA**: mai raggruppare più annotazioni in un unico task.

Campi per ogni task:
| Campo | Descrizione |
|-------|-------------|
| `id` | 1..N progressivo |
| `url` | Pagina del sito (es. `/`) |
| `selector` | Path DOM completo |
| `file` + `riga` | Localizzazione nel codice |
| `tipo` | `UI` / `Content` / `UI+Content` / `Backend` |
| `commento integrale cliente` | MAI troncato |
| `stile/codice attuale` | Snippet |
| `visual_companion_required` | `true` se tipo contiene `UI` |
| `backend_impact` | Esplicito. Default `none` |
| `priorita` | Alta / Media / Bassa |
| `sub-agent` | visual-qa, data-validator, ecc. |

**Output Step 3**: tabella Markdown in `.preview/task-list.md`.

---

## Step 4 — Mockup parallel generation

Per ogni task `visual_companion_required: true`, genera `.preview/mockups/fix-<id>-<slug>.html`.

### Template mockup

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fix #X · Descrizione</title>
  <link rel="stylesheet" href="_shared.css">
  <style>
    /* CSS custom delle varianti */
  </style>
</head>
<body>
  <div class="mockup-page">
    <!-- Header: titolo + commento cliente integrale + meta (file:riga, tipo, priorita', backend_impact, sub-agent) -->
    <div class="mockup-header">
      <a class="back-link" href="index.html">← indice mockup</a>
      <h1>Fix #N — Titolo</h1>
      <div class="client-quote">"Commento integrale citato"</div>
      <div class="meta">...</div>
    </div>

    <!-- BEFORE (stato attuale) -->
    <div class="mockup-panel">
      <div class="mockup-panel-head before"><span>BEFORE · riferimento</span></div>
      <div class="mockup-panel-body">
        <!-- replica del componente reale col codice attuale -->
      </div>
    </div>

    <!-- AFTER live preview (cambia al click variant) -->
    <div class="mockup-panel">
      <div class="mockup-panel-head after" id="live-after-label">
        <span>AFTER · <span id="live-after-name">scegli una variante</span></span>
      </div>
      <div class="mockup-panel-body">
        <!-- container con id="live-after-cta-slot" (o equivalente) che l'onVariantSelect aggiorna -->
      </div>
    </div>

    <!-- 4 variant cards a confronto -->
    <div class="variant-card-grid">
      <div class="variant-card" id="variant-A">...</div>
      <div class="variant-card" id="variant-B">...</div>
      <div class="variant-card" id="variant-C">...</div>
      <div class="variant-card" id="variant-D">...</div>
    </div>

    <!-- Design rationale -->
    <div class="rationale">
      <h3>Design rationale — UI expert</h3>
      <ul>...principi applicati, WCAG, trade-off...</ul>
    </div>
  </div>

  <script src="_decisions.js"></script>
  <script>
    const afterRenderers = {
      A: { name: '...', html: '<a class="...">...</a>' },
      B: { name: '...', html: '...' },
      C: { name: '...', html: '...' },
      D: { name: '...', html: '...' },
    };
    function updateAfterPreview(variantId) {
      const slot = document.getElementById('live-after-cta-slot');
      const nameEl = document.getElementById('live-after-name');
      if (!variantId) { slot.textContent = ''; nameEl.textContent = 'scegli una variante'; return; }
      const r = afterRenderers[variantId];
      slot.textContent = '';
      slot.insertAdjacentHTML('afterbegin', r.html);
      nameEl.textContent = 'variante ' + variantId + ' · ' + r.name;
    }
    decisionBar.init({
      fixId: 'fix-N',
      title: 'Titolo',
      variants: [
        { id: 'A', label: 'nome breve A' },
        { id: 'B', label: 'nome breve B' },
        { id: 'C', label: 'nome breve C' },
        { id: 'D', label: 'nome breve D' },
      ],
      variantAnchors: { A: '#variant-A', B: '#variant-B', C: '#variant-C', D: '#variant-D' },
      onVariantSelect: updateAfterPreview,
    });
  </script>
</body>
</html>
```

### Requisiti OBBLIGATORI per ogni mockup

1. **Varianti realmente diverse** — non 4 gradient con parametri leggermente diversi. 4 approcci concettualmente distinti (es. static vs outline vs animated vs directional).
2. **Card cliccabili** (non solo bottoni in barra). `decisionBar.init()` aggiunge role=button, cursor=pointer, keyboard support.
3. **AFTER preview live** — un blocco `#live-after-*` che si aggiorna tramite la callback `onVariantSelect`.
4. **BEFORE statico** per riferimento.
5. **Design rationale inline** — principi, WCAG, trade-off per ciascuna variante.
6. **Toggle re-click** — già gestito dal framework (re-click su variant selezionata = deseleziona).
7. **Nessun dimming** delle altre varianti — rimangono tutte visibili per confronto side-by-side.
8. **Client comment citato integralmente** nel `.client-quote`.
9. **Backend impact** esplicitato nella meta (default: `none`).

---

## Step 5 — Review interattiva in browser (NO chat)

L'utente:
- Clicca le card variant o i bottoni della barra → scelta salvata auto in `decisions.json`
- Scrive commenti nella textarea → auto-save su blur / Ctrl+Enter / debounce 1.5s
- Preme **INVIA A CLAUDE** → server digita `"leggi il commento su fix-N"` nel terminale Claude

Il hook `UserPromptSubmit` del plugin inietta automaticamente il contenuto dei commenti non letti come context in ogni prompt utente — così Claude vede sempre i commenti recenti.

---

## Step 6 — Implementazione batch

Solo quando tutti i task sono `approved` o `variant`:

1. Ordina per priorità (Alta → Media → Bassa)
2. Per ogni task:
   a. Consulta sub-agent appropriato
   b. Applica modifica al codice reale
   c. `npm run build` quick check per fix UI
3. Suggerisci `agent-improver` per fix di bug

---

## Step 7 — Test suite

```bash
npm run build
npm run test
```

---

## Step 8 — Report + cleanup

- Report consolidato delle modifiche applicate
- Offri: mantenere o rimuovere `.preview/mockups/`
- Suggerisci: `/send-review`, `/deploy-site`, commit

---

## Regole invariabili

1. **MAI raggruppare** annotazioni in un task
2. **MAI mockup senza variant interattive** per fix UI
3. **SEMPRE controllare backend impact**
4. **SEMPRE citare commento cliente integrale**
5. **SEMPRE agire come UI expert** (design rationale)
6. **MAI dimmerare** le altre varianti — confronto side-by-side

// App wiring: card selection, manual form, photo mode + grid, scoring & results.
(function () {
  "use strict";

  const activeCards = []; // ordered list of card ids
  let mode = "manual"; // "manual" | "photo"
  const formValues = {}; // persistent map of field key -> string value

  const editor = new CityEditor(document.getElementById("editor"), {
    rows: 6,
    cols: 6,
    onChange: () => clearResults(),
  });

  // ---------- Manual form ----------
  const baseFieldsEl = document.getElementById("base-fields");
  const cardFieldsEl = document.getElementById("card-fields");

  function makeField(field) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const span = document.createElement("span");
    span.className = "field-label";
    span.textContent = field.label;
    if (field.help) {
      const help = document.createElement("small");
      help.className = "field-help";
      help.textContent = field.help;
      span.appendChild(document.createElement("br"));
      span.appendChild(help);
    }
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.placeholder = "0";
    input.dataset.key = field.key;
    input.value = formValues[field.key] ?? "";
    input.addEventListener("input", () => {
      formValues[field.key] = input.value;
      clearResults();
    });
    wrap.appendChild(span);
    wrap.appendChild(input);
    return wrap;
  }

  function renderBaseFields() {
    baseFieldsEl.innerHTML = "";
    window.BASE_FIELDS.forEach((f) => baseFieldsEl.appendChild(makeField(f)));
  }

  function renderCardFields() {
    cardFieldsEl.innerHTML = "";
    const seen = new Set(window.BASE_FIELDS.map((f) => f.key));
    if (!activeCards.length) {
      cardFieldsEl.innerHTML =
        '<p class="hint">Add scoring cards in step 1 to see their questions here.</p>';
      return;
    }
    activeCards.forEach((id) => {
      const card = window.CARD_BY_ID[id];
      const group = document.createElement("fieldset");
      group.className = "form-group";
      const legend = document.createElement("legend");
      legend.innerHTML = `<b>${id}</b> ${card.name}`;
      group.appendChild(legend);

      const newFields = card.fields.filter((f) => !seen.has(f.key));
      newFields.forEach((f) => seen.add(f.key));

      if (!card.fields.length) {
        const note = document.createElement("p");
        note.className = "hint nomargin";
        note.textContent =
          "Scored from your largest-group numbers in the base section above.";
        group.appendChild(note);
      } else if (!newFields.length) {
        const note = document.createElement("p");
        note.className = "hint nomargin";
        note.textContent = "Uses numbers you already entered above.";
        group.appendChild(note);
      } else {
        const grid = document.createElement("div");
        grid.className = "field-grid";
        newFields.forEach((f) => grid.appendChild(makeField(f)));
        group.appendChild(grid);
      }
      cardFieldsEl.appendChild(group);
    });
  }

  function readForm() {
    const values = {};
    document
      .querySelectorAll("#manual-form input[data-key]")
      .forEach((inp) => (values[inp.dataset.key] = inp.value));
    return values;
  }

  // ---------- Active cards ----------
  const chips = document.getElementById("card-chips");
  const cardInput = document.getElementById("card-input");

  function renderChips() {
    chips.innerHTML = "";
    if (!activeCards.length) {
      chips.innerHTML = '<span class="empty">No cards selected yet.</span>';
      return;
    }
    activeCards.forEach((id) => {
      const card = window.CARD_BY_ID[id];
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<b>${id}</b> ${card.name} <button aria-label="remove">×</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        const i = activeCards.indexOf(id);
        if (i >= 0) activeCards.splice(i, 1);
        renderChips();
        renderCardFields();
        clearResults();
      });
      chips.appendChild(chip);
    });
  }

  function addCard(n) {
    n = parseInt(n, 10);
    if (!n || n < 1 || n > 18) return;
    if (activeCards.includes(n)) return;
    activeCards.push(n);
    activeCards.sort((a, b) => a - b);
    renderChips();
    renderCardFields();
    clearResults();
  }

  document.getElementById("card-add-btn").addEventListener("click", () => {
    addCard(cardInput.value);
    cardInput.value = "";
    cardInput.focus();
  });
  cardInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCard(cardInput.value);
      cardInput.value = "";
    }
  });

  // ---------- Rules reference ----------
  const rulesList = document.getElementById("rules-list");
  window.SCORING_CARDS.forEach((card) => {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.innerHTML = `
      <div class="rule-num">${card.id}</div>
      <div class="rule-body">
        <div class="rule-name">${card.name}</div>
        <div class="rule-text">${card.rule}</div>
      </div>
      <button class="btn mini add">Add</button>`;
    row.querySelector(".add").addEventListener("click", () => addCard(card.id));
    rulesList.appendChild(row);
  });
  const modal = document.getElementById("rules-modal");
  document
    .getElementById("card-ref-btn")
    .addEventListener("click", () => modal.classList.remove("hidden"));
  document
    .getElementById("rules-close")
    .addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // ---------- Editor toolbar (photo mode) ----------
  const palette = document.getElementById("palette");
  const toolNames = {
    R: "Residential",
    C: "Commercial",
    I: "Industrial",
    P: "Park",
    erase: "Erase",
    road: "Roads",
  };
  function selectTool(tool, btn) {
    editor.setTool(tool);
    editor.render();
    palette.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    const hint = document.getElementById("tool-hint");
    if (tool === "road") {
      hint.innerHTML =
        "Selected: <b>Roads</b>. Click the grid lines between/around blocks to " +
        "place or remove road segments.";
    } else if (tool === "erase") {
      hint.innerHTML = "Selected: <b>Erase</b>. Click or drag to remove blocks.";
    } else {
      hint.innerHTML = `Selected: <b>${toolNames[tool]}</b>. Click and drag on the grid to paint blocks.`;
    }
  }
  palette.querySelectorAll(".swatch").forEach((btn) => {
    btn.addEventListener("click", () => selectTool(btn.dataset.tool, btn));
  });
  palette.querySelector('[data-tool="R"]').classList.add("active");

  document.querySelectorAll("[data-grid]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.grid;
      let { rows, cols } = editor;
      if (a === "row+") rows++;
      if (a === "row-") rows--;
      if (a === "col+") cols++;
      if (a === "col-") cols--;
      editor.resize(rows, cols);
      document.getElementById("row-count").textContent = editor.rows;
      document.getElementById("col-count").textContent = editor.cols;
    });
  });
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (confirm("Clear the whole city?")) editor.clear();
  });

  // ---------- Mode toggle ----------
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.mode;
      document.getElementById("manual-mode").classList.toggle("hidden", mode !== "manual");
      document.getElementById("photo-mode").classList.toggle("hidden", mode !== "photo");
      clearResults();
    });
  });

  // ---------- API key (stored only in this browser) ----------
  const KEY_STORAGE = "sprawl_anthropic_key";
  const getKey = () => {
    try {
      return localStorage.getItem(KEY_STORAGE) || "";
    } catch {
      return "";
    }
  };
  const setStoredKey = (k) => {
    try {
      localStorage.setItem(KEY_STORAGE, k);
    } catch {}
  };
  const clearKey = () => {
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {}
  };

  const keyModal = document.getElementById("key-modal");
  const keyInput = document.getElementById("key-input");
  const keyStoredNote = document.getElementById("key-stored-note");
  let keyResolve = null;

  function updateStoredNote() {
    keyStoredNote.classList.toggle("hidden", !getKey());
  }

  // Opens the modal; resolves with the saved key string, or null if cancelled.
  function openKeyModal() {
    keyInput.value = getKey();
    updateStoredNote();
    keyModal.classList.remove("hidden");
    keyInput.focus();
    return new Promise((resolve) => (keyResolve = resolve));
  }
  function closeKeyModal(result) {
    keyModal.classList.add("hidden");
    if (keyResolve) {
      keyResolve(result);
      keyResolve = null;
    }
  }

  document.getElementById("key-save").addEventListener("click", () => {
    const v = keyInput.value.trim();
    if (!v) {
      keyInput.focus();
      return;
    }
    setStoredKey(v);
    closeKeyModal(v);
  });
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("key-save").click();
    }
  });
  document.getElementById("key-cancel").addEventListener("click", () => closeKeyModal(null));
  document.getElementById("key-close").addEventListener("click", () => closeKeyModal(null));
  keyModal.addEventListener("click", (e) => {
    if (e.target === keyModal) closeKeyModal(null);
  });
  document.getElementById("key-forget").addEventListener("click", () => {
    clearKey();
    keyInput.value = "";
    updateStoredNote();
  });
  document.getElementById("key-manage").addEventListener("click", () => openKeyModal());

  // ---------- Photo mode ----------
  const photoInput = document.getElementById("photo-input");
  const photoGo = document.getElementById("photo-go");
  const photoStatus = document.getElementById("photo-status");
  const photoPreview = document.getElementById("photo-preview");
  let photoData = null;

  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoData = reader.result;
      photoPreview.src = photoData;
      photoPreview.classList.remove("hidden");
      photoGo.disabled = false;
      photoStatus.textContent = "";
    };
    reader.readAsDataURL(file);
  });

  photoGo.addEventListener("click", async () => {
    if (!photoData) return;
    let key = getKey();
    if (!key) {
      key = await openKeyModal();
      if (!key) {
        photoStatus.textContent =
          "Cancelled — a Claude API key is needed for photo mode.";
        return;
      }
    }
    photoGo.disabled = true;
    photoStatus.textContent = "Interpreting board with AI…";
    try {
      const city = await window.interpretCity(photoData, key);
      editor.load(city);
      document.getElementById("row-count").textContent = editor.rows;
      document.getElementById("col-count").textContent = editor.cols;
      photoStatus.textContent =
        "Loaded! Review the grid below and fix anything the AI misread, then score.";
    } catch (err) {
      photoStatus.textContent = "⚠️ " + err.message;
    } finally {
      photoGo.disabled = false;
    }
  });

  // ---------- Scoring ----------
  const resultsEl = document.getElementById("results");
  function clearResults() {
    resultsEl.classList.add("hidden");
    resultsEl.innerHTML = "";
  }

  document.getElementById("score-btn").addEventListener("click", () => {
    let res;
    if (mode === "manual") {
      res = window.Sprawl.scoreForm(readForm(), activeCards);
    } else {
      res = window.Sprawl.scoreCity(editor.getData(), activeCards);
    }
    renderResults(res);
  });

  function line(label, value, cls) {
    const v = value > 0 ? "+" + value : "" + value;
    return `<div class="score-line ${cls || ""}"><span>${label}</span><b>${v}</b></div>`;
  }

  function renderResults(res) {
    const b = res.base;
    let html = '<div class="score-card">';
    html += "<h3>Base score</h3>";
    html += line(
      `Largest groups (R ${b.groups.R}, C ${b.groups.C}, I ${b.groups.I}, P ${b.groups.P})`,
      b.blockTotal
    );
    html += line(`Roads (${b.roadCount} continuous stretch(es))`, -b.roadCount);
    html += line("Base subtotal", b.total, "subtotal");
    html += "</div>";

    html += '<div class="score-card">';
    html += "<h3>Scoring cards</h3>";
    if (!res.cardResults.length) {
      html += '<div class="muted">No scoring cards selected.</div>';
    } else {
      res.cardResults.forEach((c) => {
        html += `<div class="score-line">
          <span><b>${c.id}</b> ${c.name}${
          c.note ? `<br><small class="muted">${c.note}</small>` : ""
        }</span>
          <b>${c.points > 0 ? "+" : ""}${c.points}</b></div>`;
      });
      html += line("Cards subtotal", res.cardTotal, "subtotal");
    }
    html += "</div>";

    html += `<div class="final ${res.win ? "win" : "lose"}">
      <div class="final-row"><span>Final score</span><b>${res.finalScore}</b></div>
      <div class="final-row"><span>Target (sum of card #s)</span><b>${res.target}</b></div>
      <div class="verdict">${
        res.win ? "🎉 You win!" : "😖 You lose — keep building."
      }</div>
    </div>`;

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
    if (resultsEl.scrollIntoView)
      resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- Init ----------
  renderBaseFields();
  renderCardFields();
  renderChips();
})();

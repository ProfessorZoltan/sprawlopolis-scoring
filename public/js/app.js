// App wiring: card selection, editor controls, photo mode, scoring & results.
(function () {
  "use strict";

  const activeCards = []; // ordered list of card ids
  const editor = new CityEditor(document.getElementById("editor"), {
    rows: 6,
    cols: 6,
    onChange: () => clearResults(),
  });

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
      chip.innerHTML =
        `<b>${id}</b> ${card.name} <button aria-label="remove">×</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        const i = activeCards.indexOf(id);
        if (i >= 0) activeCards.splice(i, 1);
        renderChips();
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
    clearResults();
  }

  document.getElementById("card-add-btn").addEventListener("click", () => {
    addCard(cardInput.value);
    cardInput.value = "";
    cardInput.focus();
  });
  cardInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
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
        <div class="rule-name">${card.name}${
      card.heuristic ? ' <span class="tag">auto-estimate</span>' : ""
    }</div>
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

  // ---------- Editor toolbar ----------
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
      const photo = document.getElementById("photo-mode");
      photo.classList.toggle("hidden", tab.dataset.mode !== "photo");
    });
  });

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
      photoData = reader.result; // data URL
      photoPreview.src = photoData;
      photoPreview.classList.remove("hidden");
      photoGo.disabled = false;
      photoStatus.textContent = "";
    };
    reader.readAsDataURL(file);
  });

  photoGo.addEventListener("click", async () => {
    if (!photoData) return;
    photoGo.disabled = true;
    photoStatus.textContent = "Interpreting board with AI…";
    try {
      const resp = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photoData }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Request failed");
      editor.load(json.city);
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
    const data = editor.getData();
    const res = window.Sprawl.scoreCity(data, activeCards);
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
          c.heuristic ? ' <span class="tag" title="Spatial rule estimated automatically — verify by hand if it matters">est.</span>' : ""
        }<br><small class="muted">${c.note}</small></span>
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

    if (res.cardResults.some((c) => c.heuristic)) {
      html +=
        '<p class="hint">Cards marked <span class="tag">est.</span> involve ' +
        "road geometry that is auto-estimated. Double-check those against the " +
        "physical card if the game is close.</p>";
    }

    resultsEl.innerHTML = html;
    resultsEl.classList.remove("hidden");
    if (resultsEl.scrollIntoView)
      resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  renderChips();
})();

// SVG-based city editor: paint zone blocks and draw roads on the grid lines.
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const CELL = 46;

  class CityEditor {
    constructor(svg, opts = {}) {
      this.svg = svg;
      this.rows = opts.rows || 6;
      this.cols = opts.cols || 6;
      this.cells = this._empty();
      this.roads = new Set();
      this.tool = "R"; // R,C,I,P,erase,road
      this.onChange = opts.onChange || (() => {});
      this._painting = false;
      this._paintValue = null;

      svg.addEventListener("mouseup", () => (this._painting = false));
      svg.addEventListener("mouseleave", () => (this._painting = false));
      this.render();
    }

    _empty() {
      return Array.from({ length: this.rows }, () =>
        Array.from({ length: this.cols }, () => null)
      );
    }

    setTool(t) {
      this.tool = t;
    }

    resize(rows, cols) {
      rows = Math.max(1, Math.min(14, rows));
      cols = Math.max(1, Math.min(14, cols));
      const old = this.cells;
      this.cells = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
          r < this.rows && c < this.cols ? old[r][c] : null
        )
      );
      // Drop roads that fall outside the new lattice.
      const kept = new Set();
      for (const seg of this.roads) {
        const [t, r, c] = seg.split("_").map((x, i) => (i ? +x : x));
        if (t === "H" && r <= rows && c < cols) kept.add(seg);
        if (t === "V" && r < rows && c <= cols) kept.add(seg);
      }
      this.roads = kept;
      this.rows = rows;
      this.cols = cols;
      this.render();
      this.onChange();
    }

    clear() {
      this.cells = this._empty();
      this.roads = new Set();
      this.render();
      this.onChange();
    }

    load(data) {
      this.rows = data.rows;
      this.cols = data.cols;
      this.cells = data.cells.map((row) =>
        row.map((v) => (v && "RCIP".includes(v) ? v : null))
      );
      this.roads = new Set(data.roads || []);
      this.render();
      this.onChange();
    }

    getData() {
      return {
        rows: this.rows,
        cols: this.cols,
        cells: this.cells.map((r) => r.slice()),
        roads: [...this.roads],
      };
    }

    _applyZone(r, c) {
      const v = this.tool === "erase" ? null : this.tool;
      if (this.cells[r][c] === v) return;
      this.cells[r][c] = v;
      this.render();
      this.onChange();
    }

    _toggleRoad(seg) {
      if (this.roads.has(seg)) this.roads.delete(seg);
      else this.roads.add(seg);
      this.render();
      this.onChange();
    }

    render() {
      const svg = this.svg;
      svg.innerHTML = "";
      const w = this.cols * CELL;
      const h = this.rows * CELL;
      svg.setAttribute("viewBox", `-6 -6 ${w + 12} ${h + 12}`);
      svg.setAttribute("width", w + 12);
      svg.setAttribute("height", h + 12);

      const roadMode = this.tool === "road";

      // Cells
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const z = this.cells[r][c];
          const rect = document.createElementNS(NS, "rect");
          rect.setAttribute("x", c * CELL);
          rect.setAttribute("y", r * CELL);
          rect.setAttribute("width", CELL);
          rect.setAttribute("height", CELL);
          rect.setAttribute("fill", z ? window.ZONES[z].color : "#f4f5f7");
          rect.setAttribute("stroke", "#cfd4da");
          rect.setAttribute("stroke-width", "1");
          rect.style.pointerEvents = roadMode ? "none" : "all";
          rect.style.cursor = "pointer";
          if (!roadMode) {
            rect.addEventListener("mousedown", (e) => {
              e.preventDefault();
              this._painting = true;
              this._applyZone(r, c);
            });
            rect.addEventListener("mouseenter", () => {
              if (this._painting) this._applyZone(r, c);
            });
          }
          svg.appendChild(rect);
          if (z) {
            const t = document.createElementNS(NS, "text");
            t.setAttribute("x", c * CELL + CELL / 2);
            t.setAttribute("y", r * CELL + CELL / 2 + 5);
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("font-size", "16");
            t.setAttribute("font-weight", "700");
            t.setAttribute("fill", "rgba(0,0,0,.55)");
            t.style.pointerEvents = "none";
            t.textContent = z;
            svg.appendChild(t);
          }
        }
      }

      // Road segments
      const drawSeg = (seg, x1, y1, x2, y2) => {
        const on = this.roads.has(seg);
        if (on) {
          const line = document.createElementNS(NS, "line");
          line.setAttribute("x1", x1);
          line.setAttribute("y1", y1);
          line.setAttribute("x2", x2);
          line.setAttribute("y2", y2);
          line.setAttribute("stroke", "#222");
          line.setAttribute("stroke-width", "5");
          line.setAttribute("stroke-linecap", "round");
          line.style.pointerEvents = "none";
          svg.appendChild(line);
        }
        if (roadMode) {
          const hit = document.createElementNS(NS, "line");
          hit.setAttribute("x1", x1);
          hit.setAttribute("y1", y1);
          hit.setAttribute("x2", x2);
          hit.setAttribute("y2", y2);
          hit.setAttribute("stroke", on ? "transparent" : "#dfe3e8");
          hit.setAttribute("stroke-width", "12");
          hit.setAttribute("stroke-linecap", "round");
          hit.style.cursor = "pointer";
          hit.style.pointerEvents = "stroke";
          hit.addEventListener("mousedown", (e) => {
            e.preventDefault();
            this._toggleRoad(seg);
          });
          svg.appendChild(hit);
        }
      };

      if (roadMode) {
        // draw faint guide dots at vertices
      }

      for (let r = 0; r <= this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          drawSeg(`H_${r}_${c}`, c * CELL, r * CELL, (c + 1) * CELL, r * CELL);
        }
      }
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c <= this.cols; c++) {
          drawSeg(`V_${r}_${c}`, c * CELL, r * CELL, c * CELL, (r + 1) * CELL);
        }
      }
    }
  }

  window.CityEditor = CityEditor;
})();

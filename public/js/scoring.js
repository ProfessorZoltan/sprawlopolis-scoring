// Scoring engine for Sprawlopolis.
//
// A "city" is described by:
//   { rows, cols,
//     cells: rows x cols array of null | 'R' | 'C' | 'I' | 'P',
//     roads: array/Set of segment keys "H_r_c" or "V_r_c" }
//
// Road segments live on the lattice of grid lines:
//   "H_r_c" is the horizontal segment between vertices (r,c) and (r,c+1)
//           -- it borders cell (r-1,c) above and cell (r,c) below.
//   "V_r_c" is the vertical segment between vertices (r,c) and (r+1,c)
//           -- it borders cell (r,c-1) to the left and cell (r,c) to the right.
// Vertices (r,c) range over 0..rows (r) and 0..cols (c).

(function () {
  "use strict";

  const ORTHO = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const DIAG = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];

  class City {
    constructor(data) {
      this.rows = data.rows;
      this.cols = data.cols;
      this.cells = data.cells;
      this.roads = new Set(data.roads || []);
    }

    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    zone(r, c) {
      if (!this.inBounds(r, c)) return null;
      return this.cells[r][c] || null;
    }

    // All placed (non-empty) cells as [r,c].
    placed() {
      const out = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (this.zone(r, c)) out.push([r, c]);
      return out;
    }

    cellsOfType(type) {
      return this.placed().filter(([r, c]) => this.zone(r, c) === type);
    }

    // Is this placed cell on the edge of the city footprint?
    // (at least one orthogonal neighbour is empty / off-grid)
    isEdge(r, c) {
      for (const [dr, dc] of ORTHO) {
        if (!this.zone(r + dr, c + dc)) return true;
      }
      return false;
    }

    // Corner = two perpendicular sides are both open (e.g. up & left).
    isCorner(r, c) {
      const up = !this.zone(r - 1, c);
      const down = !this.zone(r + 1, c);
      const left = !this.zone(r, c - 1);
      const right = !this.zone(r, c + 1);
      return (up && left) || (up && right) || (down && left) || (down && right);
    }

    // Connected components (orthogonal adjacency) of cells matching `pred`.
    components(pred) {
      const seen = new Set();
      const comps = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const key = r + "," + c;
          if (seen.has(key)) continue;
          if (!pred(r, c)) continue;
          const stack = [[r, c]];
          const comp = [];
          seen.add(key);
          while (stack.length) {
            const [cr, cc] = stack.pop();
            comp.push([cr, cc]);
            for (const [dr, dc] of ORTHO) {
              const nr = cr + dr,
                nc = cc + dc;
              const nkey = nr + "," + nc;
              if (!seen.has(nkey) && this.inBounds(nr, nc) && pred(nr, nc)) {
                seen.add(nkey);
                stack.push([nr, nc]);
              }
            }
          }
          comps.push(comp);
        }
      }
      return comps;
    }

    largestGroupSize(type) {
      const comps = this.components((r, c) => this.zone(r, c) === type);
      return comps.reduce((m, comp) => Math.max(m, comp.length), 0);
    }

    largestGroupCells(type) {
      const comps = this.components((r, c) => this.zone(r, c) === type);
      let best = [];
      for (const comp of comps) if (comp.length > best.length) best = comp;
      return best;
    }

    // ---- Road graph helpers ----

    // Endpoints of a segment key -> two vertex keys "r,c".
    segVertices(seg) {
      const [t, r, c] = seg.split("_");
      const R = +r,
        C = +c;
      if (t === "H") return [R + "," + C, R + "," + (C + 1)];
      return [R + "," + C, R + 1 + "," + C]; // V
    }

    // Cells bordering a road segment -> array of [r,c] that are in bounds.
    segCells(seg) {
      const [t, r, c] = seg.split("_");
      const R = +r,
        C = +c;
      let pair;
      if (t === "H") pair = [[R - 1, C], [R, C]];
      else pair = [[R, C - 1], [R, C]];
      return pair.filter(([rr, cc]) => this.inBounds(rr, cc));
    }

    // Build the road graph. Returns { adj: Map(vertex -> [{to, seg}]),
    // degree: Map(vertex -> n) }.
    roadGraph() {
      const adj = new Map();
      const add = (a, b, seg) => {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a).push({ to: b, seg });
      };
      for (const seg of this.roads) {
        const [a, b] = this.segVertices(seg);
        add(a, b, seg);
        add(b, a, seg);
      }
      return adj;
    }

    // Connected components of the road graph, each as a set of segment keys.
    roadComponents() {
      const adj = this.roadGraph();
      const seenSeg = new Set();
      const comps = [];
      for (const seg of this.roads) {
        if (seenSeg.has(seg)) continue;
        // BFS over segments via shared vertices.
        const [sa] = this.segVertices(seg);
        const stackV = [sa];
        const visitedV = new Set([sa]);
        const compSegs = new Set();
        while (stackV.length) {
          const v = stackV.pop();
          for (const e of adj.get(v) || []) {
            if (!compSegs.has(e.seg)) {
              compSegs.add(e.seg);
              seenSeg.add(e.seg);
            }
            if (!visitedV.has(e.to)) {
              visitedV.add(e.to);
              stackV.push(e.to);
            }
          }
        }
        comps.push({ segs: compSegs, vertices: visitedV });
      }
      return comps;
    }

    // Degree-1 vertices (true road endpoints) within a component.
    endpointsOf(comp) {
      const deg = new Map();
      for (const seg of comp.segs) {
        for (const v of this.segVertices(seg)) {
          deg.set(v, (deg.get(v) || 0) + 1);
        }
      }
      const ends = [];
      for (const [v, d] of deg) if (d === 1) ends.push(v);
      return ends;
    }

    // Park blocks that have vertex `v` ("r,c") as one of their four corners.
    parksAtVertex(v) {
      const [vr, vc] = v.split(",").map(Number);
      const out = [];
      // The four cells touching this vertex.
      for (const [rr, cc] of [
        [vr - 1, vc - 1],
        [vr - 1, vc],
        [vr, vc - 1],
        [vr, vc],
      ]) {
        if (this.zone(rr, cc) === "P") out.push(rr + "," + cc);
      }
      return out;
    }

    // Is a vertex on the edge of the city footprint?
    // True if fewer than 4 of the surrounding cells are placed.
    vertexOnEdge(v) {
      const [vr, vc] = v.split(",").map(Number);
      let placedCount = 0;
      for (const [rr, cc] of [
        [vr - 1, vc - 1],
        [vr - 1, vc],
        [vr, vc - 1],
        [vr, vc],
      ]) {
        if (this.zone(rr, cc)) placedCount++;
      }
      return placedCount < 4;
    }
  }

  // ---------- Base scoring ----------
  function baseScore(city) {
    const groups = {};
    let blockTotal = 0;
    for (const t of ["R", "C", "I", "P"]) {
      const s = city.largestGroupSize(t);
      groups[t] = s;
      blockTotal += s;
    }
    const roadCount = city.roadComponents().length;
    return {
      groups,
      blockTotal,
      roadCount,
      total: blockTotal - roadCount,
    };
  }

  // ---------- Card scorers ----------
  // Each returns { points, note } given the City.
  const SCORERS = {
    // 1
    outskirts(city) {
      const comps = city.roadComponents();
      let pts = 0;
      let interior = 0,
        edge = 0;
      for (const comp of comps) {
        const ends = city.endpointsOf(comp);
        // A pure loop has no endpoints -> does not end at the edge.
        const endsAtEdge = ends.some((v) => city.vertexOnEdge(v));
        if (endsAtEdge) {
          pts -= 1;
          edge++;
        } else {
          pts += 1;
          interior++;
        }
      }
      return {
        points: pts,
        note: `${interior} interior road(s) +, ${edge} edge road(s) -`,
      };
    },

    // 2
    bloomBoom(city) {
      let pts = 0;
      const rowParks = [];
      const colParks = new Array(city.cols).fill(0);
      for (let r = 0; r < city.rows; r++) {
        let rc = 0;
        for (let c = 0; c < city.cols; c++) {
          if (city.zone(r, c) === "P") {
            rc++;
            colParks[c]++;
          }
        }
        rowParks.push(rc);
      }
      const tally = (arr) => {
        let p = 0;
        for (const n of arr) {
          if (n === 3) p += 1;
          else if (n === 0) p -= 1;
        }
        return p;
      };
      pts = tally(rowParks) + tally(colParks);
      return { points: pts, note: "rows/cols scored over the full grid" };
    },

    // 3
    goGreen(city) {
      const parks = city.cellsOfType("P").length;
      const ind = city.cellsOfType("I").length;
      return {
        points: parks * 1 + ind * -3,
        note: `${parks} park(s), ${ind} industrial`,
      };
    },

    // 4
    blockParty(city) {
      let groups = 0;
      for (const t of ["R", "C", "I", "P"]) {
        for (let r = 0; r < city.rows - 1; r++) {
          for (let c = 0; c < city.cols - 1; c++) {
            if (
              city.zone(r, c) === t &&
              city.zone(r + 1, c) === t &&
              city.zone(r, c + 1) === t &&
              city.zone(r + 1, c + 1) === t
            ) {
              groups++;
            }
          }
        }
      }
      const table = [-8, -5, -2, 1, 4];
      const points = groups >= 5 ? 7 : table[groups];
      return { points, note: `${groups} 2x2 group(s)` };
    },

    // 5
    stacksAndScrapers(city) {
      let count = 0;
      for (const [r, c] of city.cellsOfType("I")) {
        const neighbours = ORTHO.map(([dr, dc]) => city.zone(r + dr, c + dc)).filter(
          (z) => z
        );
        if (neighbours.length > 0 && neighbours.every((z) => z === "C" || z === "I")) {
          count++;
        }
      }
      return { points: count * 2, note: `${count} qualifying industrial` };
    },

    // 6
    masterPlanned(city) {
      const res = city.largestGroupSize("R");
      const ind = city.largestGroupSize("I");
      return { points: res - ind, note: `largest R ${res} - largest I ${ind}` };
    },

    // 7
    centralPerks(city) {
      let pts = 0,
        interior = 0,
        edge = 0;
      for (const [r, c] of city.cellsOfType("P")) {
        if (city.isEdge(r, c)) {
          pts -= 2;
          edge++;
        } else {
          pts += 1;
          interior++;
        }
      }
      return { points: pts, note: `${interior} interior, ${edge} edge park(s)` };
    },

    // 8
    theBurbs(city) {
      const group = city.largestGroupCells("R");
      const groupSet = new Set(group.map(([r, c]) => r + "," + c));
      const adjToGroup = (r, c) =>
        ORTHO.some(([dr, dc]) => groupSet.has(r + dr + "," + (c + dc)));
      let pts = 0,
        parks = 0,
        ind = 0;
      for (const [r, c] of city.cellsOfType("P"))
        if (adjToGroup(r, c)) {
          pts += 1;
          parks++;
        }
      for (const [r, c] of city.cellsOfType("I"))
        if (adjToGroup(r, c)) {
          pts -= 2;
          ind++;
        }
      return { points: pts, note: `${parks} park(s) +, ${ind} industrial -` };
    },

    // 9
    concreteJungle(city) {
      let count = 0;
      for (const [r, c] of city.cellsOfType("I")) {
        const touches = [...ORTHO, ...DIAG].some(
          ([dr, dc]) => city.zone(r + dr, c + dc) === "I"
        );
        if (touches) count++;
      }
      return { points: count, note: `${count} industrial sharing a corner` };
    },

    // 10
    theStrip(city) {
      let best = 0;
      for (let r = 0; r < city.rows; r++) {
        let n = 0;
        for (let c = 0; c < city.cols; c++) if (city.zone(r, c) === "C") n++;
        best = Math.max(best, n);
      }
      for (let c = 0; c < city.cols; c++) {
        let n = 0;
        for (let r = 0; r < city.rows; r++) if (city.zone(r, c) === "C") n++;
        best = Math.max(best, n);
      }
      return { points: best, note: `best row/col has ${best} commercial` };
    },

    // 11 (heuristic: commercial flanked by two residential in a line; assumes
    //     a connecting road where present)
    miniMarts(city) {
      let count = 0;
      for (const [r, c] of city.cellsOfType("C")) {
        const pairs = [
          [city.zone(r, c - 1), city.zone(r, c + 1)], // horizontal
          [city.zone(r - 1, c), city.zone(r + 1, c)], // vertical
        ];
        if (pairs.some(([a, b]) => a === "R" && b === "R")) count++;
      }
      return {
        points: count * 2,
        note: `${count} commercial flanked by residential`,
      };
    },

    // 12
    superhighway(city) {
      const comps = city.roadComponents();
      let longest = 0;
      for (const comp of comps) longest = Math.max(longest, comp.segs.size);
      return {
        points: Math.floor(longest / 2),
        note: `longest road = ${longest} section(s)`,
      };
    },

    // 13 (heuristic: a road whose endpoints touch two different parks)
    parkHopping(city) {
      const comps = city.roadComponents();
      let roads = 0;
      for (const comp of comps) {
        const ends = city.endpointsOf(comp);
        const parks = new Set();
        for (const v of ends) for (const p of city.parksAtVertex(v)) parks.add(p);
        if (parks.size >= 2) roads++;
      }
      return { points: roads * 3, note: `${roads} park-to-park road(s)` };
    },

    // 14
    loopingLanes(city) {
      // Iteratively prune degree-1 vertices; remaining segments lie on loops.
      const adj = new Map();
      const segSet = new Set(city.roads);
      const deg = new Map();
      const inc = (v, seg) => {
        if (!adj.has(v)) adj.set(v, new Map());
        adj.get(v).set(seg, true);
        deg.set(v, (deg.get(v) || 0) + 1);
      };
      for (const seg of segSet) {
        const [a, b] = city.segVertices(seg);
        inc(a, seg);
        inc(b, seg);
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const [v, d] of deg) {
          if (d === 1) {
            // find its one remaining segment
            const segs = adj.get(v);
            for (const seg of segs.keys()) {
              if (!segSet.has(seg)) continue;
              segSet.delete(seg);
              const [a, b] = city.segVertices(seg);
              deg.set(a, deg.get(a) - 1);
              deg.set(b, deg.get(b) - 1);
              changed = true;
            }
          }
        }
      }
      return { points: segSet.size, note: `${segSet.size} looped section(s)` };
    },

    // 15
    skidRow(city) {
      let count = 0;
      for (const [r, c] of city.cellsOfType("R")) {
        const ind = ORTHO.filter(([dr, dc]) => city.zone(r + dr, c + dc) === "I").length;
        if (ind >= 2) count++;
      }
      return { points: count * 2, note: `${count} residential next to 2+ ind.` };
    },

    // 16
    morningCommute(city) {
      const comps = city.roadComponents();
      let roads = 0;
      for (const comp of comps) {
        const zones = new Set();
        for (const seg of comp.segs)
          for (const [r, c] of city.segCells(seg)) {
            const z = city.zone(r, c);
            if (z) zones.add(z);
          }
        if (zones.has("R") && zones.has("C")) roads++;
      }
      return { points: roads * 2, note: `${roads} road(s) touching R and C` };
    },

    // 17
    touristTraps(city) {
      let pts = 0,
        edge = 0,
        corner = 0;
      for (const [r, c] of city.cellsOfType("C")) {
        if (city.isEdge(r, c)) {
          pts += 1;
          edge++;
          if (city.isCorner(r, c)) {
            pts += 1;
            corner++;
          }
        }
      }
      return { points: pts, note: `${edge} edge (+${corner} corner) commercial` };
    },

    // 18
    sprawlopolis(city) {
      let bestRow = 0,
        bestCol = 0;
      for (let r = 0; r < city.rows; r++) {
        let n = 0;
        for (let c = 0; c < city.cols; c++) if (city.zone(r, c)) n++;
        bestRow = Math.max(bestRow, n);
      }
      for (let c = 0; c < city.cols; c++) {
        let n = 0;
        for (let r = 0; r < city.rows; r++) if (city.zone(r, c)) n++;
        bestCol = Math.max(bestCol, n);
      }
      return {
        points: bestRow + bestCol,
        note: `longest row ${bestRow} + longest col ${bestCol}`,
      };
    },
  };

  function scoreCard(card, city) {
    const fn = SCORERS[card.scorer];
    if (!fn) return { points: 0, note: "not implemented" };
    return fn(city);
  }

  // Full scoring run over a set of active card ids.
  function scoreCity(cityData, activeCardIds) {
    const city = new City(cityData);
    const base = baseScore(city);
    const cardResults = [];
    let cardTotal = 0;
    for (const id of activeCardIds) {
      const card = window.CARD_BY_ID[id];
      if (!card) continue;
      const res = scoreCard(card, city);
      cardResults.push({ id, name: card.name, ...res, heuristic: !!card.heuristic });
      cardTotal += res.points;
    }
    const finalScore = base.total + cardTotal;
    const target = activeCardIds.reduce((a, b) => a + b, 0);
    return {
      base,
      cardResults,
      cardTotal,
      finalScore,
      target,
      win: finalScore >= target,
    };
  }

  window.Sprawl = { City, baseScore, scoreCity, scoreCard, SCORERS };
})();

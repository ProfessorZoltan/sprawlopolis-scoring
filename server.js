// Sprawlopolis Scorer server.
// Serves the static app and exposes POST /api/interpret, which forwards a
// board photo to the Anthropic (Claude) API and returns a structured city grid.
//
// The manual form works fully offline/static — only the photo feature needs
// this server and an ANTHROPIC_API_KEY.

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You read a top-down photo of a finished game of the board game Sprawlopolis and convert it into a structured grid.

The city is a rectangular grid of square "blocks". Each block is one zone type, identified by color:
- Residential = orange / tan  -> "R"
- Commercial  = blue / cyan    -> "C"
- Industrial  = grey           -> "I"
- Park        = green          -> "P"
Empty grid positions (no block) are null.

Roads are black lines printed ALONG THE EDGES of blocks (on the grid lines between or around blocks), not through their centers. Represent each road segment on the lattice of grid lines:
- "H_r_c" = a horizontal segment on grid row line r spanning column c (the top edge of cell row r, between lattice vertices (r,c) and (r,c+1)). Valid r in 0..rows, c in 0..cols-1.
- "V_r_c" = a vertical segment on grid column line c spanning row r (the left edge of cell column c). Valid r in 0..rows-1, c in 0..cols.
Lattice vertices range r in 0..rows and c in 0..cols, where the grid is rows x cols cells.

Respond with ONLY a JSON object, no prose, of the form:
{
  "rows": <int>,
  "cols": <int>,
  "cells": [[ "R"|"C"|"I"|"P"|null, ... ], ...],   // rows arrays, each of length cols
  "roads": [ "H_r_c", "V_r_c", ... ]
}
Pick the smallest bounding grid that contains every block. Be careful to align rows and columns consistently.`;

app.post("/api/interpret", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error:
          "Photo mode needs an ANTHROPIC_API_KEY on the server. Set it and restart, or use the manual form.",
      });
    }
    const { image } = req.body || {};
    if (!image || !image.startsWith("data:")) {
      return res.status(400).json({ error: "No image provided." });
    }
    const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!m) return res.status(400).json({ error: "Unsupported image format." });
    const mediaType = m[1];
    const data = m[2];

    const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              {
                type: "text",
                text:
                  "Interpret this Sprawlopolis board into the JSON grid format. Output JSON only.",
              },
            ],
          },
        ],
      }),
    });

    const payload = await apiResp.json();
    if (!apiResp.ok) {
      return res
        .status(502)
        .json({ error: payload.error?.message || "AI request failed." });
    }

    const text = (payload.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const city = parseCity(text);
    if (!city) {
      return res
        .status(502)
        .json({ error: "Could not parse the AI response into a grid." });
    }
    res.json({ city });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error." });
  }
});

// Extract and validate the JSON grid from the model's text.
function parseCity(text) {
  let jsonStr = text.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  jsonStr = jsonStr.slice(start, end + 1);
  let obj;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!Array.isArray(obj.cells)) return null;
  const rows = obj.rows || obj.cells.length;
  const cols = obj.cols || (obj.cells[0] ? obj.cells[0].length : 0);
  if (!rows || !cols) return null;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const v = obj.cells[r] ? obj.cells[r][c] : null;
      row.push(v && "RCIP".includes(v) ? v : null);
    }
    cells.push(row);
  }
  const roads = Array.isArray(obj.roads)
    ? obj.roads.filter((s) => typeof s === "string" && /^[HV]_\d+_\d+$/.test(s))
    : [];
  return { rows, cols, cells, roads };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sprawlopolis Scorer running at http://localhost:${PORT}`);
  if (!API_KEY) {
    console.log("(ANTHROPIC_API_KEY not set — photo mode disabled, manual form works.)");
  }
});

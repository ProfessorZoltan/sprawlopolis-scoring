// Client-side photo interpretation: calls the Anthropic API DIRECTLY from the
// browser using the user's own key. The key is read from localStorage by the
// caller and passed in here; it is sent only to api.anthropic.com and never to
// this app's server.
(function () {
  "use strict";

  const MODEL = "claude-opus-4-8";

  const SYSTEM_PROMPT = `You read a top-down photo of a finished game of the board game Sprawlopolis and convert it into a structured grid.

The city is a rectangular grid of square "blocks". Each block is one zone type, identified by color:
- Residential = orange / tan  -> "R"
- Commercial  = blue / cyan    -> "C"
- Industrial  = grey           -> "I"
- Park        = green           -> "P"
Empty grid positions (no block) are null.

Roads are black lines printed ALONG THE EDGES of blocks (on the grid lines between or around blocks), not through their centers. Represent each road segment on the lattice of grid lines:
- "H_r_c" = a horizontal segment on grid row line r spanning column c (the top edge of cell row r, between lattice vertices (r,c) and (r,c+1)). Valid r in 0..rows, c in 0..cols-1.
- "V_r_c" = a vertical segment on grid column line c spanning row r (the left edge of cell column c). Valid r in 0..rows-1, c in 0..cols.
Lattice vertices range r in 0..rows and c in 0..cols, where the grid is rows x cols cells.

Respond with ONLY a JSON object, no prose, of the form:
{
  "rows": <int>,
  "cols": <int>,
  "cells": [[ "R"|"C"|"I"|"P"|null, ... ], ...],
  "roads": [ "H_r_c", "V_r_c", ... ]
}
Pick the smallest bounding grid that contains every block. Align rows and columns consistently.`;

  function parseCity(text) {
    let jsonStr = (text || "").trim();
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

  // dataUrl: "data:image/...;base64,..."  apiKey: user's Anthropic key.
  async function interpretCity(dataUrl, apiKey) {
    const m = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s);
    if (!m) throw new Error("Unsupported image format.");
    const mediaType = m[1];
    const data = m[2];

    let resp;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Required for calling the API straight from a browser.
          "anthropic-dangerous-direct-browser-access": "true",
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
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data },
                },
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
    } catch (e) {
      throw new Error(
        "Could not reach the Anthropic API from your browser (network/CORS). " +
          e.message
      );
    }

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = payload && payload.error && payload.error.message;
      if (resp.status === 401)
        throw new Error("Invalid API key — check it and try again.");
      throw new Error(msg || `Anthropic API error (${resp.status}).`);
    }

    const text = (payload.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const city = parseCity(text);
    if (!city) throw new Error("Could not read a city grid from the AI response.");
    return city;
  }

  window.interpretCity = interpretCity;
})();

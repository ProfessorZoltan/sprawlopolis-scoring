// Client-side photo interpretation: calls the Anthropic API DIRECTLY from the
// browser using the user's own key. The key is read from localStorage by the
// caller and passed in here; it is sent only to api.anthropic.com and never to
// this app's server.
(function () {
  "use strict";

  const MODEL = "claude-opus-4-8";

  const SYSTEM_PROMPT = `You read a top-down photo of a finished game of the board game Sprawlopolis and convert it into a structured grid.

The finished city is a single rectangular grid of square "blocks". The game is built from cards that OVERLAP each other, so ignore the card seams — only the topmost block at each position counts. Each position holds at most ONE block; never repeat or duplicate a block, and do not invent extra rows or columns. First decide the exact number of rows and columns by counting distinct block positions across and down, then fill the grid once.

Each block is one zone type, identified by color:
- Residential = orange / tan  -> "R"
- Commercial  = blue / cyan    -> "C"
- Industrial  = grey           -> "I"
- Park        = green           -> "P"
Grid positions with no block are null.

Roads are the grey paved strips. They run THROUGH the interior of blocks (block-center to block-center), entering a block at the midpoint of a side and connecting to the neighbouring block it points into — they do NOT sit on the lines between blocks. Encode a road only where it continuously links two ADJACENT blocks:
- "H_r_c" = a road link between block (r,c) and block (r,c+1).  Valid r in 0..rows-1, c in 0..cols-2.
- "V_r_c" = a road link between block (r,c) and block (r+1,c).  Valid r in 0..rows-1, c in 0..cols-1.
(r = row index from the top starting at 0, c = column index from the left starting at 0.)

Respond with ONLY a JSON object, no prose, of the form:
{
  "rows": <int>,
  "cols": <int>,
  "cells": [[ "R"|"C"|"I"|"P"|null, ... ], ...],
  "roads": [ "H_r_c", "V_r_c", ... ]
}
"cells" must have exactly "rows" arrays, each of exactly "cols" entries. Pick the smallest bounding grid that contains every block.`;

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

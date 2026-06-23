// Sprawlopolis Scorer server.
//
// This is a plain static file server. The whole app runs in the browser:
//  - the manual form needs nothing external;
//  - photo mode calls the Anthropic API DIRECTLY from the browser using the
//    user's own API key, which is stored only in their browser (localStorage).
//
// No API key is ever read, stored, or proxied by this server.

const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sprawlopolis Scorer running at http://localhost:${PORT}`);
});

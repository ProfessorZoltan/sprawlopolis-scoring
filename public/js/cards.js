// Database of all 18 Sprawlopolis scoring-condition cards.
// Transcribed directly from the physical cards.
//
// Zone codes used throughout the app:
//   R = Residential (orange/tan)
//   C = Commercial  (blue/cyan)
//   I = Industrial  (grey)
//   P = Park        (green)
//
// Each card has:
//   id       1-18, the number printed on the card (also its face value toward
//            the win target)
//   name     card title
//   rule     full rule text
//   summary  one-line plain description
//   scorer   key into the grid-based engine in scoring.js (used by photo mode)
//   fields   inputs the MANUAL FORM asks for (deduped by `key` across cards)
//   score    computes this card's points from a flat map of field values
//            (the map also includes the shared base fields below)
window.SCORING_CARDS = [
  {
    id: 1,
    name: "The Outskirts",
    rule:
      "+1pt / Road that does not end at the edge of the city. " +
      "-1pt / Road that ends at the edge of the city.",
    summary: "Reward interior roads, punish roads that run off the city edge.",
    scorer: "outskirts",
    fields: [
      { key: "out_interior", label: "Roads that do NOT end at the city edge" },
      { key: "out_edge", label: "Roads that DO end at the city edge" },
    ],
    score: (v) => num(v.out_interior) - num(v.out_edge),
  },
  {
    id: 2,
    name: "Bloom Boom",
    rule:
      "+1pt / Each row & column with exactly 3 Park blocks in it. " +
      "-1pt / Each row & column with exactly 0 Park blocks in it.",
    summary: "Rows/columns with exactly 3 parks score; those with 0 parks lose.",
    scorer: "bloomBoom",
    fields: [
      { key: "bloom_three", label: "Rows + columns containing exactly 3 parks" },
      { key: "bloom_zero", label: "Rows + columns containing exactly 0 parks" },
    ],
    score: (v) => num(v.bloom_three) - num(v.bloom_zero),
  },
  {
    id: 3,
    name: "Go Green",
    rule: "+1pt / Park block in your city. -3pts / Industrial block in your city.",
    summary: "Reward every park, heavily punish every industrial block.",
    scorer: "goGreen",
    fields: [
      { key: "tot_park", label: "Total Park blocks in the city" },
      { key: "tot_ind", label: "Total Industrial blocks in the city" },
    ],
    score: (v) => num(v.tot_park) - 3 * num(v.tot_ind),
  },
  {
    id: 4,
    name: "Block Party",
    rule:
      "Score points per group of 4 'corner to corner' blocks of the same type " +
      "(a 2x2 square). You may score multiple groups of the same type and a " +
      "block may apply to more than one group. " +
      "# of groups -> points: 0=-8, 1=-5, 2=-2, 3=1, 4=4, 5+=7.",
    summary: "Count 2x2 same-type squares; more squares = more points.",
    scorer: "blockParty",
    fields: [
      {
        key: "bp_groups",
        label: "Number of 2×2 squares of four matching blocks",
        help: "Count every 2×2 block of four same-type blocks; overlaps count separately.",
      },
    ],
    score: (v) => {
      const g = num(v.bp_groups);
      const table = [-8, -5, -2, 1, 4];
      return g >= 5 ? 7 : table[g] ?? -8;
    },
  },
  {
    id: 5,
    name: "Stacks and Scrapers",
    rule:
      "+2pts / Industrial block adjacent to only Commercial or Industrial blocks.",
    summary: "Industrial blocks touching only commercial/industrial neighbors.",
    scorer: "stacksAndScrapers",
    fields: [
      {
        key: "ss_count",
        label: "Industrial blocks touching only commercial/industrial neighbours",
      },
    ],
    score: (v) => 2 * num(v.ss_count),
  },
  {
    id: 6,
    name: "Master Planned",
    rule:
      "Subtract the number of blocks in your largest Industrial group from the " +
      "number of blocks in your largest Residential group. Score that many points.",
    summary: "Largest residential group minus largest industrial group.",
    scorer: "masterPlanned",
    fields: [], // uses the shared "largest group" base inputs
    score: (v) => num(v.largestR) - num(v.largestI),
  },
  {
    id: 7,
    name: "Central Perks",
    rule:
      "+1pt / Park block located on the interior of the city. " +
      "-2pts / Park block on the edge of the city.",
    summary: "Interior parks score, edge parks lose double.",
    scorer: "centralPerks",
    fields: [
      { key: "cp_interior", label: "Park blocks in the interior (not on the edge)" },
      { key: "cp_edge", label: "Park blocks on the city edge" },
    ],
    score: (v) => num(v.cp_interior) - 2 * num(v.cp_edge),
  },
  {
    id: 8,
    name: "The 'Burbs",
    rule:
      "+1pt / Park block adjacent to your largest group of Residential blocks. " +
      "-2pts / Industrial block adjacent to your largest group of Residential blocks.",
    summary: "Parks near your biggest residential group help; industrial hurts.",
    scorer: "theBurbs",
    fields: [
      { key: "burbs_park", label: "Parks adjacent to your largest Residential group" },
      {
        key: "burbs_ind",
        label: "Industrial adjacent to your largest Residential group",
      },
    ],
    score: (v) => num(v.burbs_park) - 2 * num(v.burbs_ind),
  },
  {
    id: 9,
    name: "Concrete Jungle",
    rule:
      "+1pt / Industrial block that shares a corner with at least 1 other " +
      "Industrial block.",
    summary: "Industrial blocks touching another industrial (incl. diagonally).",
    scorer: "concreteJungle",
    fields: [
      {
        key: "cj_count",
        label: "Industrial blocks touching another industrial (corner or edge)",
      },
    ],
    score: (v) => num(v.cj_count),
  },
  {
    id: 10,
    name: "The Strip",
    rule:
      "+1pt / Commercial block in any 1 Row or Column of your choice. " +
      "You may only score for 1 Row or Column.",
    summary: "Score the single row or column with the most commercial blocks.",
    scorer: "theStrip",
    fields: [
      { key: "strip_best", label: "Most commercial blocks in any single row or column" },
    ],
    score: (v) => num(v.strip_best),
  },
  {
    id: 11,
    name: "Mini Marts",
    rule:
      "+2pts / Commercial block directly between two Residential blocks with the " +
      "same road connecting all three blocks. Blocks may be a straight line or " +
      "in a 'stepped' pattern.",
    summary: "Commercial flanked by two residential, joined by one road.",
    scorer: "miniMarts",
    fields: [
      {
        key: "mm_count",
        label: "Commercial blocks between two residential, joined by one road",
      },
    ],
    score: (v) => 2 * num(v.mm_count),
  },
  {
    id: 12,
    name: "Superhighway",
    rule:
      "+1pt / every 2 Road sections (rounded down) that are part of your " +
      "longest road.",
    summary: "Half the length (rounded down) of your single longest road.",
    scorer: "superhighway",
    fields: [
      { key: "sh_longest", label: "Length of your longest road (in road sections)" },
    ],
    score: (v) => Math.floor(num(v.sh_longest) / 2),
  },
  {
    id: 13,
    name: "Park Hopping",
    rule: "+3pts / Road that begins at one Park and ends at a different Park.",
    summary: "Roads that connect two different parks end-to-end.",
    scorer: "parkHopping",
    fields: [
      { key: "ph_count", label: "Roads that connect two different parks" },
    ],
    score: (v) => 3 * num(v.ph_count),
  },
  {
    id: 14,
    name: "Looping Lanes",
    rule:
      "+1pt / Road section in a completed loop. You may score multiple loops " +
      "in your city.",
    summary: "Every road section that is part of a closed loop.",
    scorer: "loopingLanes",
    fields: [
      { key: "ll_count", label: "Road sections that are part of a completed loop" },
    ],
    score: (v) => num(v.ll_count),
  },
  {
    id: 15,
    name: "Skid Row",
    rule: "+2pts / Residential block adjacent to 2 or more Industrial blocks.",
    summary: "Residential blocks next to 2+ industrial blocks.",
    scorer: "skidRow",
    fields: [
      { key: "sr_count", label: "Residential blocks next to 2 or more industrial" },
    ],
    score: (v) => 2 * num(v.sr_count),
  },
  {
    id: 16,
    name: "Morning Commute",
    rule:
      "+2pts / Road that passes through both a Residential block and a " +
      "Commercial block.",
    summary: "Roads that touch both a residential and a commercial block.",
    scorer: "morningCommute",
    fields: [
      {
        key: "mc_count",
        label: "Roads passing through both a residential and a commercial block",
      },
    ],
    score: (v) => 2 * num(v.mc_count),
  },
  {
    id: 17,
    name: "Tourist Traps",
    rule:
      "+1pt / Commercial block on the edge of the city. " +
      "Additional +1pt / Commercial block on a corner edge.",
    summary: "Edge commercial blocks score; corner commercial scores extra.",
    scorer: "touristTraps",
    fields: [
      { key: "tt_edge", label: "Commercial blocks on the city edge (including corners)" },
      {
        key: "tt_corner",
        label: "Commercial blocks on a corner",
        help: "Corner blocks also count in the edge total above; they score 1 extra here.",
      },
    ],
    score: (v) => num(v.tt_edge) + num(v.tt_corner),
  },
  {
    id: 18,
    name: "Sprawlopolis",
    rule:
      "Add the number of blocks in your longest Row to the number of blocks in " +
      "your longest Column (skipping any gaps). Score that many points.",
    summary: "Blocks in your fullest row plus blocks in your fullest column.",
    scorer: "sprawlopolis",
    fields: [
      { key: "sp_row", label: "Blocks in your longest row (gaps skipped)" },
      { key: "sp_col", label: "Blocks in your longest column (gaps skipped)" },
    ],
    score: (v) => num(v.sp_row) + num(v.sp_col),
  },
];

// Shared inputs always asked in the manual form (drive the base score and a
// couple of cards such as Master Planned).
window.BASE_FIELDS = [
  { key: "largestR", label: "Largest Residential group (blocks)" },
  { key: "largestC", label: "Largest Commercial group (blocks)" },
  { key: "largestI", label: "Largest Industrial group (blocks)" },
  { key: "largestP", label: "Largest Park group (blocks)" },
  { key: "roads", label: "Number of roads (separate continuous stretches)" },
];

function num(x) {
  const n = parseInt(x, 10);
  return Number.isFinite(n) ? n : 0;
}
window.fieldNum = num;

window.CARD_BY_ID = {};
window.SCORING_CARDS.forEach((c) => (window.CARD_BY_ID[c.id] = c));

// Zone metadata for rendering / labels.
window.ZONES = {
  R: { code: "R", name: "Residential", color: "#e8a866" },
  C: { code: "C", name: "Commercial", color: "#39b6d8" },
  I: { code: "I", name: "Industrial", color: "#9aa0a6" },
  P: { code: "P", name: "Park", color: "#6cc04a" },
};

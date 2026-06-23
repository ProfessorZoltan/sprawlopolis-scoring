// Database of all 18 Sprawlopolis scoring-condition cards.
// Transcribed directly from the physical cards.
//
// Zone codes used throughout the app:
//   R = Residential (orange/tan)
//   C = Commercial  (blue/cyan)
//   I = Industrial  (grey)
//   P = Park        (green)
//
// Each card has an `id` (1-18, the number printed on the card and also its
// face value toward the win target), a `name`, the full `rule` text, a short
// `summary`, and a `scorer` key that maps to a function in scoring.js.
window.SCORING_CARDS = [
  {
    id: 1,
    name: "The Outskirts",
    rule:
      "+1pt / Road that does not end at the edge of the city. " +
      "-1pt / Road that ends at the edge of the city.",
    summary: "Reward interior roads, punish roads that run off the city edge.",
    scorer: "outskirts",
    heuristic: true,
  },
  {
    id: 2,
    name: "Bloom Boom",
    rule:
      "+1pt / Each row & column with exactly 3 Park blocks in it. " +
      "-1pt / Each row & column with exactly 0 Park blocks in it.",
    summary: "Rows/columns with exactly 3 parks score; those with 0 parks lose.",
    scorer: "bloomBoom",
  },
  {
    id: 3,
    name: "Go Green",
    rule: "+1pt / Park block in your city. -3pts / Industrial block in your city.",
    summary: "Reward every park, heavily punish every industrial block.",
    scorer: "goGreen",
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
  },
  {
    id: 5,
    name: "Stacks and Scrapers",
    rule:
      "+2pts / Industrial block adjacent to only Commercial or Industrial blocks.",
    summary: "Industrial blocks touching only commercial/industrial neighbors.",
    scorer: "stacksAndScrapers",
  },
  {
    id: 6,
    name: "Master Planned",
    rule:
      "Subtract the number of blocks in your largest Industrial group from the " +
      "number of blocks in your largest Residential group. Score that many points.",
    summary: "Largest residential group minus largest industrial group.",
    scorer: "masterPlanned",
  },
  {
    id: 7,
    name: "Central Perks",
    rule:
      "+1pt / Park block located on the interior of the city. " +
      "-2pts / Park block on the edge of the city.",
    summary: "Interior parks score, edge parks lose double.",
    scorer: "centralPerks",
  },
  {
    id: 8,
    name: "The 'Burbs",
    rule:
      "+1pt / Park block adjacent to your largest group of Residential blocks. " +
      "-2pts / Industrial block adjacent to your largest group of Residential blocks.",
    summary: "Parks near your biggest residential group help; industrial hurts.",
    scorer: "theBurbs",
  },
  {
    id: 9,
    name: "Concrete Jungle",
    rule:
      "+1pt / Industrial block that shares a corner with at least 1 other " +
      "Industrial block.",
    summary: "Industrial blocks touching another industrial (incl. diagonally).",
    scorer: "concreteJungle",
  },
  {
    id: 10,
    name: "The Strip",
    rule:
      "+1pt / Commercial block in any 1 Row or Column of your choice. " +
      "You may only score for 1 Row or Column.",
    summary: "Score the single row or column with the most commercial blocks.",
    scorer: "theStrip",
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
    heuristic: true,
  },
  {
    id: 12,
    name: "Superhighway",
    rule:
      "+1pt / every 2 Road sections (rounded down) that are part of your " +
      "longest road.",
    summary: "Half the length (rounded down) of your single longest road.",
    scorer: "superhighway",
  },
  {
    id: 13,
    name: "Park Hopping",
    rule: "+3pts / Road that begins at one Park and ends at a different Park.",
    summary: "Roads that connect two different parks end-to-end.",
    scorer: "parkHopping",
    heuristic: true,
  },
  {
    id: 14,
    name: "Looping Lanes",
    rule:
      "+1pt / Road section in a completed loop. You may score multiple loops " +
      "in your city.",
    summary: "Every road section that is part of a closed loop.",
    scorer: "loopingLanes",
  },
  {
    id: 15,
    name: "Skid Row",
    rule: "+2pts / Residential block adjacent to 2 or more Industrial blocks.",
    summary: "Residential blocks next to 2+ industrial blocks.",
    scorer: "skidRow",
  },
  {
    id: 16,
    name: "Morning Commute",
    rule:
      "+2pts / Road that passes through both a Residential block and a " +
      "Commercial block.",
    summary: "Roads that touch both a residential and a commercial block.",
    scorer: "morningCommute",
  },
  {
    id: 17,
    name: "Tourist Traps",
    rule:
      "+1pt / Commercial block on the edge of the city. " +
      "Additional +1pt / Commercial block on a corner edge.",
    summary: "Edge commercial blocks score; corner commercial scores extra.",
    scorer: "touristTraps",
  },
  {
    id: 18,
    name: "Sprawlopolis",
    rule:
      "Add the number of blocks in your longest Row to the number of blocks in " +
      "your longest Column (skipping any gaps). Score that many points.",
    summary: "Blocks in your fullest row plus blocks in your fullest column.",
    scorer: "sprawlopolis",
  },
];

window.CARD_BY_ID = {};
window.SCORING_CARDS.forEach((c) => (window.CARD_BY_ID[c.id] = c));

// Zone metadata for rendering / labels.
window.ZONES = {
  R: { code: "R", name: "Residential", color: "#e8a866" },
  C: { code: "C", name: "Commercial", color: "#39b6d8" },
  I: { code: "I", name: "Industrial", color: "#9aa0a6" },
  P: { code: "P", name: "Park", color: "#6cc04a" },
};

// World English Bible (WEB) — public domain. Genesis 37:1–11 for Joseph Scene 1.
// Every string verified VERBATIM against the canonical WEB distribution
// (ebible.org/web/GEN37.htm, raw HTML) on 2026-07-16 — including the readings
// where popular API snapshots differ ("tunic of many colors", "brothers asked
// him", "evil report of them to their father"). Do NOT edit wording by hand.
// Trimming rule (scripture-accuracy): only whole clauses may be dropped,
// always marked with an ellipsis. `vo` = narrator line-id (audio/vo/<id>.mp3).
export const WEB = {
  gen_37_1: {
    ref: 'Genesis 37:1 (WEB)',
    vo: 'joseph/1/verse-37-1',
    text: 'Jacob lived in the land of his father’s travels, in the land of Canaan.',
  },
  gen_37_2: {
    ref: 'Genesis 37:2 (WEB)',
    vo: 'joseph/1/verse-37-2',
    text: 'This is the history of the generations of Jacob. Joseph, being seventeen years old, was feeding the flock with his brothers. He was a boy with the sons of Bilhah and Zilpah, his father’s wives. Joseph brought an evil report of them to their father.',
  },
  gen_37_3: {
    ref: 'Genesis 37:3 (WEB)',
    vo: 'joseph/1/verse-37-3',
    text: 'Now Israel loved Joseph more than all his children, because he was the son of his old age, and he made him a tunic of many colors.',
  },
  gen_37_4: {
    ref: 'Genesis 37:4 (WEB)',
    vo: 'joseph/1/verse-37-4',
    text: 'His brothers saw that their father loved him more than all his brothers, and they hated him, and couldn’t speak peaceably to him.',
  },
  gen_37_5: {
    ref: 'Genesis 37:5 (WEB)',
    vo: 'joseph/1/verse-37-5',
    text: 'Joseph dreamed a dream, and he told it to his brothers, and they hated him all the more.',
  },
  gen_37_7: {
    ref: 'Genesis 37:7 (WEB)',
    vo: 'joseph/1/verse-37-7',
    text: 'for behold, we were binding sheaves in the field, and behold, my sheaf arose and also stood upright; and behold, your sheaves came around, and bowed down to my sheaf.',
  },
  gen_37_8: {
    ref: 'Genesis 37:8 (WEB)',
    vo: 'joseph/1/verse-37-8',
    text: 'His brothers asked him, “Will you indeed reign over us? Will you indeed have dominion over us?” They hated him all the more for his dreams and for his words.',
  },
  gen_37_9: {
    ref: 'Genesis 37:9 (WEB)',
    vo: 'joseph/1/verse-37-9',
    text: 'He dreamed yet another dream, and told it to his brothers, and said, “Behold, I have dreamed yet another dream: and behold, the sun and the moon and eleven stars bowed down to me.”',
  },
  gen_37_10: {
    ref: 'Genesis 37:10 (WEB)',
    vo: 'joseph/1/verse-37-10',
    text: 'He told it to his father and to his brothers. His father rebuked him, and said to him, “What is this dream that you have dreamed? Will I and your mother and your brothers indeed come to bow ourselves down to the earth before you?”',
  },
  gen_37_11: {
    ref: 'Genesis 37:11 (WEB)',
    vo: 'joseph/1/verse-37-11',
    text: 'His brothers envied him, but his father kept this saying in mind.',
  },
  gen_37_24: {
    ref: 'Genesis 37:24 (WEB)',
    vo: 'joseph/1/verse-37-24',
    // The COLD-OPEN flash-forward (verified verbatim at ebible.org/web/GEN37.htm
    // 2026-07-16). The lowercase opening is canonical: v24 continues v23.
    text: 'and they took him, and threw him into the pit. The pit was empty. There was no water in it.',
  },
};

// Note on v7: canonical text begins mid-sentence continuing v6 ("…dreamed:
// for behold, we were binding…"). Keep its lowercase opening word-perfect.

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION (D8) — non-scripture narrator lines. These are NEVER shown on a
// verse card (no ref, no quote styling); they are spoken-only storytelling in
// the same baked voice. Kept apart from WEB so the scripture table stays pure.
export const NARRATION = {
  dream_begins: {
    vo: 'joseph/1/narr-dream-begins',
    // present-moment only (D8): the dream's opening may not foreshadow the
    // telling — Gen 37:5's card now lands at the campfire, where it happens.
    text: 'Joseph began to dream.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 1 LINE ROUTING (D4 Task 8) — the VO manifest's source of truth for who
// carries each beat. Rule: CUTSCENES → the NARRATOR (voiced verse cards) carries
// the story; GAMEPLAY → CHARACTERS speak (text popups, unvoiced) to guide the
// player. The same information is never said twice. Only NARRATOR lines have VO
// files (the 11 verses below + verse-37-24 for the cold open); character lines
// are text only, so Nate records ONLY the verses.
export const SCENE1_ROUTING = [
  { beat: 'cold-open', voice: 'NARRATOR', line: 'gen_37_24 (verse card + VO)' },
  { beat: 'intro', voice: 'NARRATOR', line: 'gen_37_1 (verse card + VO)' },
  { beat: 'herd', voice: 'CHARACTER', line: 'Simeon/Levi give practical flock directions (text; no verse)' },
  { beat: 'report', voice: 'MIXED', line: 'Jacob/Joseph enact the report (text) · then full gen_37_2 (verse card + VO)' },
  { beat: 'coat', voice: 'MIXED', line: 'Jacob + brothers speak (text) · verses 37:3, 37:4 narrated — no line quotes its verse' },
  { beat: 'dusk', voice: 'GAMEPLAY', line: 'objective + Sit prompt only (no spoken lines)' },
  { beat: 'dream-and-first-telling', voice: 'MIXED', line: 'dream 1: narr-dream-begins + 37:7 · Joseph tells only the brothers (text) · 37:5, 37:8 narrated · then dream 2' },
  { beat: 'second-telling', voice: 'MIXED', line: 'Joseph tells dream 2 to his brothers · 37:9 narrated · then tells his father and brothers · Jacob reacts · 37:10 narrated' },
  { beat: 'close', voice: 'NARRATOR', line: 'gen_37_11 (verse card + VO) + tease title' },
];

// Canonical runtime order for Genesis 37:5–11. Beat 5 deliberately contains
// the first four events so external checkpoint indices remain stable.
export const SCENE1_CANONICAL_ORDER = [
  'dream1', 'tell1', 'response1', 'dream2',
  'tell2_brothers', 'tell2_family', 'rebuke', 'envy',
];

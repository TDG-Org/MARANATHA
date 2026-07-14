// Story registry — order matters: progress unlocks top to bottom.
// sceneKey null = story not built yet (shows as "coming soon" when reached).
export const STORIES = [
  {
    id: 'creation',
    title: 'Creation',
    passage: 'Genesis 1–2',
    sceneKey: 'Creation',
    blurb: 'In the beginning… Watch God speak the world into being — and take part as His hands: lift the sky, raise the land, light the stars.',
  },
  {
    id: 'fall',
    title: 'The Fall',
    passage: 'Genesis 3',
    sceneKey: null,
    blurb: 'The serpent, the tree, and the choice that broke the world — and the first whisper of God’s promise to mend it.',
  },
  {
    id: 'noah',
    title: "Noah's Ark",
    passage: 'Genesis 6–9',
    sceneKey: null,
    blurb: 'One faithful family, a flood, and a rainbow — God keeps His promise through the storm.',
  },
  {
    id: 'joseph',
    title: 'Joseph',
    passage: 'Genesis 37–50',
    sceneKey: 'joseph', // Phase C: the first playable story (built now)
    blurb: 'Betrayed, enslaved, forgotten — yet what others meant for evil, God meant for good.',
  },
];

export function storyById(id) {
  return STORIES.find((s) => s.id === id) ?? null;
}

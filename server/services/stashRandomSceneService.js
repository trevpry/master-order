const UNWATCHED_SCENE_FILTER = {
  AND: [
    { OR: [{ playCount: 0 }, { playCount: null }] },
    { NOT: { tags: { some: { tag: { name: '__Watched' } } } } }
  ]
};

async function selectRandomUnwatchedScene(prisma, include) {
  // Count and offset use the same filter; hydrate metadata for only the selected row.
  for (let attempt = 0; attempt < 2; attempt++) {
    const totalUnwatched = await prisma.stashScene.count({ where: UNWATCHED_SCENE_FILTER });
    if (totalUnwatched === 0) return { scene: null, totalUnwatched: 0 };
    const scenes = await prisma.stashScene.findMany({
      where: UNWATCHED_SCENE_FILTER,
      orderBy: { id: 'asc' },
      skip: Math.floor(Math.random() * totalUnwatched),
      take: 1,
      include
    });
    if (scenes[0]) return { scene: scenes[0], totalUnwatched };
  }
  throw new Error('Unwatched scenes changed during selection; please retry');
}

module.exports = { selectRandomUnwatchedScene };

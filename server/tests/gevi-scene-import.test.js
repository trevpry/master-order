const test = require('node:test');
const assert = require('node:assert');

const GeviScraperService = require('../services/geviScraperService');
const { annotatePerformerImports, importScenePerformers, createMissingPerformers, resolvePerformerChoices, addSceneUrl } = require('../services/geviSceneImportService');

const sceneUrlPrisma = scene => {
  const updates = [];
  return {
    updates,
    stashScene: {
      findUnique: async () => scene,
      update: async ({ data }) => updates.push(data)
    }
  };
};

const sceneUrlStash = urls => {
  const mutations = [];
  return {
    mutations,
    makeGraphQLRequest: async (query, variables) => {
      if (query.includes('findScene')) return { findScene: { urls } };
      mutations.push(variables.input);
      return { sceneUpdate: { id: variables.input.id } };
    }
  };
};

test('addSceneUrl appends the GEVI scene URL locally and in Stash, keeping existing URLs', async () => {
  const prisma = sceneUrlPrisma({ url: null, episodeUrls: JSON.stringify(['https://aebn/x']) });
  const stash = sceneUrlStash(['https://aebn/x']);
  const added = await addSceneUrl({ prisma, syncService: stash, sceneId: '5', url: 'https://gevi/episode/1' });
  assert.strictEqual(added, true);
  assert.deepStrictEqual(prisma.updates, [{ episodeUrls: JSON.stringify(['https://aebn/x', 'https://gevi/episode/1']) }]);
  assert.deepStrictEqual(stash.mutations, [{ id: '5', urls: ['https://aebn/x', 'https://gevi/episode/1'] }]);
});

test('addSceneUrl does nothing when the scene already has the URL', async () => {
  const prisma = sceneUrlPrisma({ url: null, episodeUrls: JSON.stringify([{ url: 'https://gevi/episode/1' }]) });
  const stash = sceneUrlStash(['https://gevi/episode/1']);
  const added = await addSceneUrl({ prisma, syncService: stash, sceneId: '5', url: 'https://gevi/episode/1' });
  assert.strictEqual(added, false);
  assert.deepStrictEqual(prisma.updates, []);
  assert.deepStrictEqual(stash.mutations, []);
});

const quietly = async fn => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
  }
};

test('scenes without performers are matched to GEVI scenes by scene number', async () => {
  const service = new GeviScraperService();
  const movieScenes = [
    { sceneNumber: 1, details: 'One', performers: [{ name: 'Al', actionCode: 'T' }] },
    { sceneNumber: 2, details: 'Two', performers: [{ name: 'Bo', actionCode: 'B' }, { name: 'Cy', actionCode: 'T' }] }
  ];
  const dbScenes = [
    { id: 's2', title: 'clip', performers: [], groups: [{ sceneIndex: 2 }] },
    { id: 's1', title: 'clip', performers: [], groups: [{ sceneIndex: 1 }] }
  ];
  const matches = await quietly(() => service.matchMovieScenes(movieScenes, dbScenes));
  const byId = Object.fromEntries(matches.map(m => [m.sceneId, m]));
  assert.strictEqual(byId.s1.sceneNumber, 1);
  assert.strictEqual(byId.s2.sceneNumber, 2);
  assert.strictEqual(byId.s2.details, 'Two');
  assert.strictEqual(byId.s2.matchMethod, 'position');
});

test('annotatePerformerImports resolves GEVI performers for performer-less scenes only', async () => {
  const matches = [
    {
      sceneId: 'empty',
      performers: [
        { name: 'Bo', actionCode: 'B' },
        { name: 'Cy', actionCode: 'T' },
        { name: 'Unknown', url: 'https://gevi/performer/9' },
        { name: 'unknown', actionCode: 'Bf' }
      ]
    },
    { sceneId: 'full', performers: [{ name: 'Bo', actionCode: 'B' }] }
  ];
  const dbScenes = [
    { id: 'empty', performers: [] },
    { id: 'full', performers: [{ performer: { name: 'Bo' } }] }
  ];
  let lookedUp;
  await annotatePerformerImports(matches, dbScenes, async performers => {
    lookedUp = performers.map(p => p.name);
    return {
      matched: [
        { id: 'p-bo', name: 'Bo Library', originalName: 'Bo' },
        { id: 'p-cy', name: 'Cy', originalName: 'Cy' }
      ]
    };
  });
  assert.deepStrictEqual(lookedUp, ['Bo', 'Cy', 'Unknown']);
  assert.strictEqual(matches[0].importPerformers, true);
  assert.deepStrictEqual(matches[0].performersToImport, [
    { id: 'p-bo', name: 'Bo Library', scrapedName: 'Bo', actionCode: 'B' },
    { id: 'p-cy', name: 'Cy', scrapedName: 'Cy', actionCode: 'T' }
  ]);
  assert.deepStrictEqual(matches[0].performersToCreate, [
    { name: 'Unknown', url: 'https://gevi/performer/9', actionCode: 'Bf', forceNew: true }
  ]);
  assert.deepStrictEqual(matches[0].performerImports.map(e => [e.scrapedName, e.choice.type]), [
    ['Bo', 'library'], ['Cy', 'library'], ['Unknown', 'new']
  ]);
  assert.strictEqual(matches[1].importPerformers, undefined);
});

test('annotatePerformerImports keeps library alternatives so the match can be switched', async () => {
  const matches = [{ sceneId: 'empty', performers: [{ name: 'Max', actionCode: 'T' }] }];
  await annotatePerformerImports(matches, [{ id: 'empty', performers: [] }], async () => ({
    matched: [{
      id: 7, name: 'Max Power', originalName: 'Max', matchedVia: 'name',
      alternatives: [{ id: 8, name: 'Max (II)', disambiguation: 'twink', matchedVia: 'alias', matchedAlias: 'Max' }]
    }]
  }));
  const [entry] = matches[0].performerImports;
  assert.deepStrictEqual(entry.match, { id: '7', name: 'Max Power', disambiguation: null, matchedVia: 'name', matchedAlias: null });
  assert.deepStrictEqual(entry.alternatives, [{ id: '8', name: 'Max (II)', disambiguation: 'twink', matchedVia: 'alias', matchedAlias: 'Max' }]);
  assert.deepStrictEqual(entry.choice, { type: 'library', id: '7', name: 'Max Power' });
});

test('resolvePerformerChoices honors switched, new and skipped performers', () => {
  const resolved = resolvePerformerChoices([
    { scrapedName: 'Max', actionCode: 'T', choice: { type: 'library', id: '8', name: 'Max (II)' } },
    { scrapedName: 'Matched Wrong', url: 'https://gevi/p/1', actionCode: 'B', choice: { type: 'new', name: 'Matched Wrong' } },
    { scrapedName: 'Extra', actionCode: 'Bf', choice: { type: 'skip' } },
    { scrapedName: 'Max alias', actionCode: 'Bf', choice: { type: 'library', id: '8', name: 'Max (II)' } }
  ]);
  assert.deepStrictEqual(resolved.performersToImport, [{ id: '8', name: 'Max (II)', scrapedName: 'Max', actionCode: 'T' }]);
  assert.deepStrictEqual(resolved.performersToCreate, [
    { name: 'Matched Wrong', url: 'https://gevi/p/1', actionCode: 'B', forceNew: true }
  ]);
});

test('createMissingPerformers creates explicitly-new performers even when an alias matches', async () => {
  const prisma = fakePrisma([], [{ id: 'lib-1', name: 'Real Name', alias: 'Stage Name' }]);
  const stash = fakeStash();
  const resolved = await createMissingPerformers({
    prisma,
    syncService: stash,
    performers: [{ name: 'Stage Name', actionCode: 'T', forceNew: true }]
  });
  assert.strictEqual(resolved[0].created, true);
  assert.strictEqual(resolved[0].name, 'Stage Name');
});

const fakePrisma = (existingLinks = [], library = []) => {
  const created = [];
  const upserted = [];
  return {
    created,
    upserted,
    stashScenePerformer: {
      findMany: async () => existingLinks,
      create: async ({ data }) => created.push(data)
    },
    stashPerformer: {
      findMany: async ({ where }) => {
        if (where.id) return where.id.in.filter(id => id !== 'missing').map(id => ({ id }));
        const name = where.OR[0].name.contains.toLowerCase();
        return library.filter(p => p.name.toLowerCase() === name || String(p.alias || '').toLowerCase().includes(name));
      },
      upsert: async args => upserted.push(args)
    }
  };
};

test('importScenePerformers attaches library performers in Stash and locally', async () => {
  const prisma = fakePrisma();
  const calls = [];
  const syncService = { makeGraphQLRequest: async (query, variables) => calls.push(variables) };
  const imported = await importScenePerformers({
    prisma,
    syncService,
    sceneId: 's1',
    performers: [
      { id: 'p1', name: 'A', actionCode: 'T' },
      { id: 'missing', name: 'Gone' },
      { id: 'p1', name: 'A again' }
    ]
  });
  assert.deepStrictEqual(calls, [{ input: { id: 's1', performer_ids: ['p1'] } }]);
  assert.deepStrictEqual(prisma.created, [{ sceneId: 's1', performerId: 'p1' }]);
  assert.deepStrictEqual(imported, [{ id: 'p1', name: 'A', actionCode: 'T', created: false }]);
});

const fakeStash = (stashPerformers = []) => {
  const calls = [];
  let nextId = 100;
  return {
    calls,
    makeGraphQLRequest: async (query, variables) => {
      calls.push({ query, variables });
      if (query.includes('findPerformers')) {
        const name = variables.filter.name.value.toLowerCase();
        return { findPerformers: { performers: stashPerformers.filter(p => p.name.toLowerCase() === name) } };
      }
      if (query.includes('performerCreate')) {
        const { name, urls } = variables.input;
        return { performerCreate: { id: String(nextId++), name, alias_list: [], url: urls[0] || null, urls } };
      }
      return { sceneUpdate: { id: variables.input.id } };
    }
  };
};

test('importScenePerformers creates GEVI performers missing from the library and attaches them', async () => {
  const prisma = fakePrisma();
  const stash = fakeStash();
  const imported = await importScenePerformers({
    prisma,
    syncService: stash,
    sceneId: 's1',
    performers: [{ id: 'p1', name: 'A', actionCode: 'T' }],
    performersToCreate: [{ name: 'New Guy', url: 'https://gevi/performer/5', actionCode: 'B' }]
  });

  const create = stash.calls.find(c => c.query.includes('performerCreate'));
  assert.deepStrictEqual(create.variables.input, {
    name: 'New Guy',
    url: 'https://gevi/performer/5',
    urls: ['https://gevi/performer/5']
  });
  assert.strictEqual(prisma.upserted.length, 1);
  assert.strictEqual(prisma.upserted[0].create.id, '100');
  assert.strictEqual(prisma.upserted[0].create.url, 'https://gevi/performer/5');
  assert.ok(!('image' in prisma.upserted[0].update));

  const sceneUpdate = stash.calls.find(c => c.query.includes('sceneUpdate'));
  assert.deepStrictEqual(sceneUpdate.variables.input, { id: 's1', performer_ids: ['p1', '100'] });
  assert.deepStrictEqual(prisma.created, [
    { sceneId: 's1', performerId: 'p1' },
    { sceneId: 's1', performerId: '100' }
  ]);
  assert.deepStrictEqual(imported.map(p => [p.id, p.actionCode, p.created]), [['p1', 'T', false], ['100', 'B', true]]);
});

test('createMissingPerformers reuses library aliases and existing Stash performers instead of duplicating', async () => {
  const prisma = fakePrisma([], [{ id: 'lib-1', name: 'Real Name', alias: 'Stage Name, Other' }]);
  const stash = fakeStash([{ id: 'st-9', name: 'In Stash', alias_list: [], urls: [] }]);
  const resolved = await createMissingPerformers({
    prisma,
    syncService: stash,
    performers: [{ name: 'Stage Name', actionCode: 'T' }, { name: 'in stash', actionCode: 'B' }]
  });
  assert.deepStrictEqual(resolved, [
    { id: 'lib-1', name: 'Real Name', scrapedName: 'Stage Name', actionCode: 'T', created: false },
    { id: 'st-9', name: 'In Stash', scrapedName: 'in stash', actionCode: 'B', created: false }
  ]);
  assert.ok(!stash.calls.some(c => c.query.includes('performerCreate')));
  assert.strictEqual(prisma.upserted[0].create.id, 'st-9');
});

test('importScenePerformers does not create performers for scenes that gained performers', async () => {
  const prisma = fakePrisma([{ sceneId: 's1', performerId: 'other' }]);
  const stash = fakeStash();
  const imported = await importScenePerformers({
    prisma,
    syncService: stash,
    sceneId: 's1',
    performers: [],
    performersToCreate: [{ name: 'New Guy' }]
  });
  assert.deepStrictEqual(imported, []);
  assert.deepStrictEqual(stash.calls, []);
});

test('importScenePerformers leaves scenes that gained performers untouched', async () => {
  const prisma = fakePrisma([{ sceneId: 's1', performerId: 'other' }]);
  let called = false;
  const imported = await importScenePerformers({
    prisma,
    syncService: { makeGraphQLRequest: async () => { called = true; } },
    sceneId: 's1',
    performers: [{ id: 'p1', name: 'A' }]
  });
  assert.deepStrictEqual(imported, []);
  assert.strictEqual(called, false);
  assert.deepStrictEqual(prisma.created, []);
});

const test = require('node:test');
const assert = require('node:assert');

const {
  MANUAL_FIELD,
  diffGroupPerformers,
  addManualPerformers,
  removePerformer
} = require('../services/stashGroupPerformerService');

test('diffGroupPerformers adds scene performers and keeps performers whose scenes left the group as manual', () => {
  const desired = [
    { groupId: 'g1', performerId: 'p1' },
    { groupId: 'g1', performerId: 'p1' }, // performer in two scenes of the group
    { groupId: 'g1', performerId: 'p2' },
    { groupId: 'g2', performerId: 'p3' }
  ];
  const existing = [
    { groupId: 'g1', performerId: 'p2', source: 'manual' },
    { groupId: 'g1', performerId: 'p9', source: 'scene' },
    { groupId: 'g2', performerId: 'p8', source: 'manual' }
  ];
  const { toCreate, toPromote } = diffGroupPerformers(desired, existing);
  assert.deepStrictEqual(toCreate, [
    { groupId: 'g1', performerId: 'p1', source: 'scene' },
    { groupId: 'g2', performerId: 'p3', source: 'scene' }
  ]);
  assert.deepStrictEqual(toPromote, [{ groupId: 'g1', performerId: 'p9' }]);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(diffGroupPerformers(desired, existing), 'toDelete'), false);
});

// Minimal in-memory stand-in for the Prisma calls used by add/remove
function fakePrisma({ links = [], performers = ['1', '2', '3'], scenePerformers = [] } = {}) {
  const key = w => `${w.groupId_performerId.groupId}|${w.groupId_performerId.performerId}`;
  const store = new Map(links.map(l => [`${l.groupId}|${l.performerId}`, { ...l }]));
  return {
    store,
    stashGroup: { findUnique: async ({ where }) => (where.id === 'g1' ? { id: 'g1' } : null) },
    stashPerformer: { findMany: async ({ where }) => where.id.in.filter(id => performers.includes(id)).map(id => ({ id })) },
    stashGroupScene: { count: async ({ where }) => (scenePerformers.includes(where.scene.performers.some.performerId) ? 1 : 0) },
    stashGroupPerformer: {
      findUnique: async ({ where }) => store.get(key(where)) || null,
      findMany: async ({ where }) => [...store.values()].filter(l => l.groupId === where.groupId && (!where.source || l.source === where.source)),
      upsert: async ({ where, update, create }) => {
        const existing = store.get(key(where));
        store.set(key(where), existing ? { ...existing, ...update } : { ...create });
      },
      update: async ({ where, data }) => store.set(key(where), { ...store.get(key(where)), ...data }),
      delete: async ({ where }) => store.delete(key(where))
    }
  };
}

test('addManualPerformers stores manual links and mirrors ids to the Stash custom field', async () => {
  const prisma = fakePrisma({ links: [{ groupId: 'g1', performerId: '2', source: 'scene' }] });
  const calls = [];
  const result = await addManualPerformers(prisma, 'g1', ['3', '2'], async (query, variables) => { calls.push(variables); return {}; });

  assert.strictEqual(result.mirrored, true);
  assert.strictEqual(prisma.store.get('g1|2').source, 'manual');
  assert.strictEqual(prisma.store.get('g1|3').source, 'manual');
  assert.deepStrictEqual(calls[0].input, { id: 'g1', custom_fields: { partial: { [MANUAL_FIELD]: '2,3' } } });

  await assert.rejects(addManualPerformers(prisma, 'g1', ['404'], null), /Unknown performer/);
  await assert.rejects(addManualPerformers(prisma, 'nope', ['1'], null), /Group not found/);
});

test('removePerformer reverts manual links still backed by a scene and refuses scene-only removals', async () => {
  const prisma = fakePrisma({
    links: [
      { groupId: 'g1', performerId: '1', source: 'manual' },
      { groupId: 'g1', performerId: '2', source: 'manual' },
      { groupId: 'g1', performerId: '3', source: 'scene' }
    ],
    scenePerformers: ['2', '3']
  });
  const calls = [];
  const graphql = async (query, variables) => { calls.push(variables); return {}; };

  assert.strictEqual((await removePerformer(prisma, 'g1', '1', graphql)).remaining, 'none');
  assert.strictEqual(prisma.store.has('g1|1'), false);
  assert.deepStrictEqual(calls.at(-1).input.custom_fields, { partial: { [MANUAL_FIELD]: '2' } });

  assert.strictEqual((await removePerformer(prisma, 'g1', '2', graphql)).remaining, 'scene');
  assert.strictEqual(prisma.store.get('g1|2').source, 'scene');
  assert.deepStrictEqual(calls.at(-1).input.custom_fields, { remove: [MANUAL_FIELD] });

  await assert.rejects(removePerformer(prisma, 'g1', '3', graphql), /comes from a scene/);
});

test('refreshGroupPerformers never detaches: performers of deleted scenes become manual and are mirrored', async () => {
  const { refreshGroupPerformers, setGraphqlProvider } = require('../services/stashGroupPerformerService');
  const links = [
    { groupId: 'g1', performerId: '1', source: 'scene' },
    { groupId: 'g1', performerId: '2', source: 'scene' }
  ];
  const calls = [];
  const prisma = {
    // Only performer 2's scene is still in the group; performer 1's scene was deleted
    stashGroupScene: { findMany: async () => [{ groupId: 'g1', scene: { performers: [{ performerId: '2' }] } }] },
    stashGroupPerformer: {
      findMany: async ({ where }) => links.filter(l => (!where.groupId?.in || where.groupId.in.includes(l.groupId)) &&
        (!where.source || l.source === where.source) && (typeof where.groupId !== 'string' || l.groupId === where.groupId)),
      createMany: async () => {},
      updateMany: async ({ where, data }) => {
        links.filter(l => l.source === where.source && where.OR.some(o => o.groupId === l.groupId && o.performerId === l.performerId))
          .forEach(l => Object.assign(l, data));
      },
      deleteMany: async () => { throw new Error('refresh must not delete links'); }
    }
  };
  setGraphqlProvider(async () => async (query, variables) => { calls.push(variables); return {}; });
  try {
    const result = await refreshGroupPerformers(prisma, ['g1']);
    assert.deepStrictEqual(result, { created: 0, promoted: 1 });
    assert.deepStrictEqual(links.map(l => [l.performerId, l.source]), [['1', 'manual'], ['2', 'scene']]);
    assert.deepStrictEqual(calls[0].input, { id: 'g1', custom_fields: { partial: { [MANUAL_FIELD]: '1' } } });
  } finally {
    setGraphqlProvider(null);
  }
});

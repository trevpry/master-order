const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGroupUpdateInput, editGroup, GroupEditError } = require('../services/stashGroupEditService');

test('only sends present fields and clears blanks', () => {
  const input = buildGroupUpdateInput(7, {
    name: '  New Name ',
    aliases: '',
    director: null,
    date: '2001-05',
    duration: '5400.4',
    rating: '',
    studioId: '',
    urls: [' https://a.example ', '', 'https://a.example', 'https://b.example'],
    tagIds: [3, '3', ' 4 ']
  });
  assert.deepEqual(input, {
    id: '7',
    name: 'New Name',
    aliases: null,
    director: null,
    date: '2001-05',
    duration: 5400,
    rating100: null,
    studio_id: null,
    urls: ['https://a.example', 'https://b.example'],
    tag_ids: ['3', '4']
  });
  assert.deepEqual(buildGroupUpdateInput('1', { synopsis: 'Plot' }), { id: '1', synopsis: 'Plot' });
});

test('validates fields', () => {
  assert.throws(() => buildGroupUpdateInput('1', { name: '  ' }), GroupEditError);
  assert.throws(() => buildGroupUpdateInput('1', { date: '05/01/2001' }), /Date/);
  assert.throws(() => buildGroupUpdateInput('1', { rating: 101 }), /Rating/);
  assert.throws(() => buildGroupUpdateInput('1', { duration: -1 }), /Duration/);
  assert.throws(() => buildGroupUpdateInput('1', { urls: 'x' }), /URLs/);
  assert.throws(() => buildGroupUpdateInput('1', { frontImage: 'javascript:alert(1)' }), /Front image/);
  assert.equal(buildGroupUpdateInput('1', { rating: 80 }).rating100, 80);
  assert.equal(buildGroupUpdateInput('1', { frontImage: 'data:image/png;base64,iVBOR=' }).front_image, 'data:image/png;base64,iVBOR=');
  assert.equal(buildGroupUpdateInput('1', { backImage: '' }).back_image, null);
});

function fakePrisma({ exists = true, failStudio = false } = {}) {
  const calls = [];
  const record = name => async args => { calls.push([name, args]); return {}; };
  return {
    calls,
    stashGroup: {
      findUnique: async () => (exists ? { id: '9' } : null),
      update: record('group.update')
    },
    stashStudio: {
      upsert: async args => {
        calls.push(['studio.upsert', args]);
        if (failStudio) throw new Error('unique name');
      }
    },
    stashTag: { upsert: record('tag.upsert') },
    stashGroupTag: { deleteMany: record('groupTag.deleteMany'), create: record('groupTag.create') }
  };
}

test('updates Stash first, then mirrors the response locally', async () => {
  const prisma = fakePrisma();
  let sent = null;
  const graphql = async (query, variables) => {
    assert.match(query, /groupUpdate/);
    sent = variables.input;
    return {
      groupUpdate: {
        id: '9', name: 'Edited', aliases: null, duration: 3600, date: '2001', rating100: 60,
        director: 'Dir', synopsis: null, urls: ['https://x.example'],
        front_image_path: 'http://stash/group/9/frontimage?t=1', back_image_path: null,
        studio: { id: 's1', name: 'Studio' }, tags: [{ id: 't1', name: 'Tag' }]
      }
    };
  };

  await editGroup({ prisma, graphql, id: '9', body: { name: 'Edited', tagIds: ['t1'] } });
  assert.deepEqual(sent, { id: '9', name: 'Edited', tag_ids: ['t1'] });

  const update = prisma.calls.find(([name]) => name === 'group.update')[1];
  assert.equal(update.data.name, 'Edited');
  assert.equal(update.data.rating, 60);
  assert.equal(update.data.url, '["https://x.example"]');
  assert.equal(update.data.frontImage, 'http://stash/group/9/frontimage?t=1');
  assert.equal(update.data.studioId, 's1');
  assert.equal(update.data.tagIds, 't1');
  assert.ok(prisma.calls.some(([name, args]) => name === 'groupTag.create' && args.data.tagId === 't1'));
});

test('leaves local tag links alone when tags were not edited, and drops unmirrorable studios', async () => {
  const prisma = fakePrisma({ failStudio: true });
  const graphql = async () => ({ groupUpdate: { id: '9', name: 'N', studio: { id: 's2', name: 'Dup' }, tags: [] } });
  await editGroup({ prisma, graphql, id: '9', body: { synopsis: 'x' } });
  assert.ok(!prisma.calls.some(([name]) => name === 'groupTag.deleteMany'));
  assert.equal(prisma.calls.find(([name]) => name === 'group.update')[1].data.studioId, null);
});

test('rejects unknown groups, empty edits and Stash failures without touching local data', async () => {
  const graphql = async () => { throw new Error('should not be called'); };
  await assert.rejects(editGroup({ prisma: fakePrisma({ exists: false }), graphql, id: '1', body: { name: 'x' } }), { status: 404 });
  await assert.rejects(editGroup({ prisma: fakePrisma(), graphql, id: '1', body: {} }), /No changes/);

  const prisma = fakePrisma();
  await assert.rejects(editGroup({ prisma, graphql: async () => { throw new Error('Stash GraphQL error'); }, id: '9', body: { name: 'x' } }), /Stash GraphQL error/);
  assert.equal(prisma.calls.length, 0);
});

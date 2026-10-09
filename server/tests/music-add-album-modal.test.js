const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const clientPath = path.resolve(__dirname, '..', '..', 'client');
const esbuild = require(require.resolve('esbuild', { paths: [clientPath] }));
const compiled = esbuild.transformSync(fs.readFileSync(path.join(clientPath,
  'src', 'components', 'music', 'AddTrackToAlbumModal.jsx'), 'utf8'), {
  loader: 'jsx', format: 'cjs'
}).code;

function modal(fetch) {
  const state = [];
  let cursor;
  let effect;
  let deps;
  let cleanup;
  let selectedTrack;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect: (callback, nextDeps) => {
      if (!deps || nextDeps.some((value, index) => value !== deps[index])) {
        cleanup?.();
        deps = nextDeps;
        effect = callback;
      }
    }
  };
  const context = vm.createContext({
    module: { exports: {} }, AbortController, URLSearchParams, fetch,
    console: { error() {} },
    require: name => {
      if (name === 'react') return react;
      if (name === '../../config') return { apiBaseUrl: 'http://local' };
      if (name === './MergeArtistsModal') return { mergeModalStyles: {} };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  vm.runInContext(compiled, context);
  const render = () => {
    cursor = 0;
    const tree = context.module.exports.default({
      track: { ratingKey: 'track', title: 'Track' },
      onClose() {},
      onSuccess: track => { selectedTrack = track; }
    });
    if (effect) {
      cleanup = effect();
      effect = null;
    }
    return tree;
  };
  return { render, selectedTrack: () => selectedTrack };
}

function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  for (const child of tree.children || []) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('album picker browses, searches across artists, selects an album and saves its key', async () => {
  const requests = [];
  const updatedTrack = { ratingKey: 'track', parentRatingKey: 'other-album', grandparentRatingKey: 'original-artist' };
  const picker = modal(async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => options?.method === 'POST' ? { success: true, track: updatedTrack }
        : url.includes('search=') ? [{ ratingKey: 'other-album', title: 'Other Album', artist: { title: 'Other Artist' } }]
          : { albums: [{ ratingKey: 'album', title: 'Album' }], totalPages: 2 }
    };
  });
  picker.render();
  await settle();
  let tree = picker.render();
  find(tree, node => node.type === 'button' && node.children.includes('Next')).props.onClick();
  picker.render();
  await settle();
  assert.ok(requests[1].url.includes('page=2'));
  tree = picker.render();
  find(tree, node => node.type === 'input' && node.props.id === 'track-album-search')
    .props.onChange({ target: { value: 'Other Album' } });
  tree = picker.render();
  find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  picker.render();
  await settle();
  assert.ok(requests[2].url.includes('page=1'));
  assert.ok(requests[2].url.includes('search=Other+Album'));
  tree = picker.render();
  assert.ok(find(tree, node => node.children.includes('Other Artist')));
  find(tree, node => node.type === 'input' && node.props.type === 'radio').props.onChange();
  tree = picker.render();
  await find(tree, node => node.type === 'button' && node.children.includes('Add to Album')).props.onClick();
  assert.equal(requests[3].url, 'http://local/api/music/tracks/track/album');
  assert.equal(requests[3].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[3].options.body), { albumRatingKey: 'other-album' });
  assert.equal(picker.selectedTrack(), updatedTrack);
});

test('album picker displays save errors without reporting success', async () => {
  const picker = modal(async (_url, options) => ({
    ok: options?.method !== 'POST',
    json: async () => options?.method === 'POST'
      ? { error: 'Disconnect the track from its current album first' }
      : { albums: [{ ratingKey: 'album', title: 'Album' }], totalPages: 1 }
  }));
  picker.render();
  await settle();
  let tree = picker.render();
  find(tree, node => node.type === 'input' && node.props.type === 'radio').props.onChange();
  tree = picker.render();
  await find(tree, node => node.type === 'button' && node.children.includes('Add to Album')).props.onClick();
  tree = picker.render();
  assert.equal(find(tree, node => node.props.role === 'alert').children[0],
    'Disconnect the track from its current album first');
  assert.equal(picker.selectedTrack(), undefined);
});

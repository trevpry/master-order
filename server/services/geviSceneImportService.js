/**
 * Imports GEVI scene data (performers + action codes) into group scenes that have no performers yet.
 * Scenes are paired with GEVI scenes by their scene number in the group (see matchMovieScenes).
 */

const performerName = p => (typeof p === 'string' ? p : p?.name || '').trim();
const normalizeName = name => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Annotate matches whose DB scene has no performers with the GEVI performers resolved against the library.
 * @param {Array} matches - output of geviScraper.matchMovieScenes
 * @param {Array} dbScenes - group scenes ({ id, performers: [] })
 * @param {(performers: Array) => Promise<{matched: Array}>} matchPerformers - library matcher
 */
async function annotatePerformerImports(matches, dbScenes, matchPerformers) {
  const emptyIds = new Set(dbScenes.filter(s => !s.performers || s.performers.length === 0).map(s => s.id));
  const targets = matches.filter(m => emptyIds.has(m.sceneId) && Array.isArray(m.performers) && m.performers.some(performerName));
  if (targets.length === 0) return matches;

  const unique = new Map();
  for (const m of targets) {
    for (const p of m.performers) {
      const name = performerName(p);
      if (name && !unique.has(normalizeName(name))) {
        unique.set(normalizeName(name), { name, url: typeof p === 'object' ? p.url || null : null });
      }
    }
  }
  const { matched = [] } = await matchPerformers([...unique.values()]);
  const byName = new Map(matched.map(m => [normalizeName(m.originalName), m]));

  for (const m of targets) {
    const performerImports = [];
    for (const p of m.performers) {
      const name = performerName(p);
      if (!name) continue;
      const actionCode = typeof p === 'object' ? p.actionCode || null : null;
      const existing = performerImports.find(x => x.key === normalizeName(name));
      if (existing) {
        if (!existing.actionCode && actionCode) existing.actionCode = actionCode;
        continue;
      }
      const lib = byName.get(normalizeName(name));
      const match = lib ? toCandidate(lib) : null;
      performerImports.push({
        key: normalizeName(name),
        scrapedName: name,
        url: typeof p === 'object' ? p.url || null : null,
        actionCode,
        match,
        alternatives: lib && Array.isArray(lib.alternatives) ? lib.alternatives.map(toCandidate).filter(Boolean) : [],
        choice: match ? { type: 'library', id: match.id, name: match.name } : { type: 'new', name }
      });
    }
    m.importPerformers = true;
    m.performerImports = performerImports;
    Object.assign(m, resolvePerformerChoices(performerImports));
  }
  return matches;
}

function toCandidate(p) {
  if (!p || !p.id) return null;
  return {
    id: String(p.id),
    name: p.name,
    disambiguation: p.disambiguation || null,
    matchedVia: p.matchedVia || null,
    matchedAlias: p.matchedAlias || null
  };
}

/**
 * Turn the per-performer choices made in the review modal into the performers to attach and to create.
 * choice: { type: 'library', id, name } | { type: 'new', name? } | { type: 'skip' }
 */
function resolvePerformerChoices(performerImports) {
  const performersToImport = [];
  const performersToCreate = [];
  for (const entry of performerImports || []) {
    if (!entry) continue;
    const scrapedName = String(entry.scrapedName || '').trim();
    const actionCode = entry.actionCode || null;
    const choice = entry.choice || { type: 'skip' };

    if (choice.type === 'library' && choice.id) {
      const id = String(choice.id);
      const existing = performersToImport.find(x => x.id === id);
      if (existing) {
        if (!existing.actionCode && actionCode) existing.actionCode = actionCode;
      } else {
        performersToImport.push({ id, name: choice.name || scrapedName, scrapedName, actionCode });
      }
    } else if (choice.type === 'new') {
      const name = String(choice.name || scrapedName).trim();
      if (!name) continue;
      const existing = performersToCreate.find(x => normalizeName(x.name) === normalizeName(name));
      if (existing) {
        if (!existing.actionCode && actionCode) existing.actionCode = actionCode;
      } else {
        performersToCreate.push({ name, url: entry.url || null, actionCode, forceNew: true });
      }
    }
  }
  return { performersToImport, performersToCreate };
}

const splitAliases = alias => String(alias || '').split(/[,\n]/).map(normalizeName).filter(Boolean);

async function findLibraryPerformer(prisma, name, { includeAliases = true } = {}) {
  const key = normalizeName(name);
  const candidates = await prisma.stashPerformer.findMany({
    where: {
      OR: [
        { name: { contains: name } },
        { alias: { contains: name } }
      ]
    }
  });
  return candidates.find(c => normalizeName(c.name) === key)
    || (includeAliases ? candidates.find(c => splitAliases(c.alias).includes(key)) : null)
    || null;
}

const PERFORMER_FIELDS = 'id name alias_list gender url urls';

const toLocalPerformer = sp => ({
  id: String(sp.id),
  name: sp.name,
  alias: Array.isArray(sp.alias_list) && sp.alias_list.length > 0 ? sp.alias_list.join(', ') : null,
  gender: sp.gender || null,
  url: sp.url || (Array.isArray(sp.urls) && sp.urls[0]) || null,
  urls: Array.isArray(sp.urls) && sp.urls.length > 0 ? JSON.stringify(sp.urls) : null,
  image: null,
  lastSyncedAt: new Date()
});

/**
 * Resolve GEVI performers that are not in the library: reuse a library/Stash performer with the same
 * name (or alias, unless `forceNew` was chosen in the review) when one exists, otherwise create it in
 * Stash (with its GEVI url) and locally.
 * Returns [{ id, name, scrapedName, actionCode, created }].
 */
async function createMissingPerformers({ prisma, syncService, performers }) {
  const resolved = [];
  for (const p of performers || []) {
    const name = performerName(p);
    if (!name) continue;
    const actionCode = (typeof p === 'object' && p.actionCode) || null;

    const local = await findLibraryPerformer(prisma, name, { includeAliases: !(typeof p === 'object' && p.forceNew) });
    if (local) {
      resolved.push({ id: String(local.id), name: local.name, scrapedName: name, actionCode, created: false });
      continue;
    }
    if (!syncService) continue;

    const found = await syncService.makeGraphQLRequest(
      `query FindPerformerByName($filter: PerformerFilterType) {
        findPerformers(performer_filter: $filter, filter: { per_page: 5 }) { performers { ${PERFORMER_FIELDS} } }
      }`,
      { filter: { name: { value: name, modifier: 'EQUALS' } } }
    );
    let stashPerformer = (found?.findPerformers?.performers || [])
      .find(sp => normalizeName(sp.name) === normalizeName(name));
    let created = false;

    if (!stashPerformer) {
      const url = (typeof p === 'object' && p.url) || null;
      const data = await syncService.makeGraphQLRequest(
        `mutation PerformerCreate($input: PerformerCreateInput!) { performerCreate(input: $input) { ${PERFORMER_FIELDS} } }`,
        { input: { name, url, urls: url ? [url] : [] } }
      );
      stashPerformer = data?.performerCreate;
      if (!stashPerformer?.id) throw new Error(`Stash did not return the created performer "${name}"`);
      created = true;
    }

    const row = toLocalPerformer(stashPerformer);
    const update = { ...row };
    delete update.id;
    delete update.image;
    await prisma.stashPerformer.upsert({ where: { id: row.id }, create: row, update });
    resolved.push({ id: row.id, name: stashPerformer.name, scrapedName: name, actionCode, created });
  }
  return resolved;
}

/**
 * Attach performers to a scene that still has none, in Stash and locally. GEVI performers missing from the
 * library (performersToCreate) are created first. Returns the attached performers (with action codes and a
 * `created` flag), or [] when the scene already has performers.
 */
async function importScenePerformers({ prisma, syncService, sceneId, performers, performersToCreate = [] }) {
  const valid = (performers || []).filter(p => p && p.id);
  const toCreate = (performersToCreate || []).filter(p => performerName(p));
  if (valid.length === 0 && toCreate.length === 0) return [];

  const existing = await prisma.stashScenePerformer.findMany({ where: { sceneId } });
  if (existing.length > 0) return [];

  const ids = [...new Set(valid.map(p => String(p.id)))];
  const libraryPerformers = ids.length > 0
    ? await prisma.stashPerformer.findMany({ where: { id: { in: ids } } })
    : [];
  const known = new Set(libraryPerformers.map(p => String(p.id)));
  const attached = ids.filter(id => known.has(id)).map(id => ({ ...valid.find(p => String(p.id) === id), created: false }));

  const created = await createMissingPerformers({ prisma, syncService, performers: toCreate });
  for (const p of created) {
    const existingEntry = attached.find(a => String(a.id) === p.id);
    if (existingEntry) {
      if (!existingEntry.actionCode && p.actionCode) existingEntry.actionCode = p.actionCode;
    } else {
      attached.push(p);
    }
  }
  if (attached.length === 0) return [];

  const performerIds = attached.map(p => String(p.id));
  if (syncService) {
    await syncService.makeGraphQLRequest(
      `mutation SceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
      { input: { id: sceneId, performer_ids: performerIds } }
    );
  }
  for (const performerId of performerIds) {
    await prisma.stashScenePerformer.create({ data: { sceneId, performerId } });
  }

  return attached;
}

const parseUrlList = value => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const urlOf = item => (typeof item === 'string' ? item : item?.url || '');

/**
 * Add a GEVI scene (episode) URL to a scene: appended to the local episodeUrls and merged into the
 * Stash scene's urls. Returns true when the URL was new for the scene.
 */
async function addSceneUrl({ prisma, syncService, sceneId, url }) {
  const target = String(url || '').trim();
  if (!sceneId || !target) return false;

  const scene = await prisma.stashScene.findUnique({ where: { id: sceneId }, select: { url: true, episodeUrls: true } });
  if (!scene) return false;
  const localUrls = parseUrlList(scene.episodeUrls);
  const hadLocally = scene.url === target || localUrls.some(item => urlOf(item) === target);
  if (!hadLocally) {
    await prisma.stashScene.update({
      where: { id: sceneId },
      data: { episodeUrls: JSON.stringify([...localUrls, target]) }
    });
  }

  let addedToStash = false;
  if (syncService) {
    const data = await syncService.makeGraphQLRequest(
      `query FindSceneUrls($id: ID!) { findScene(id: $id) { urls } }`,
      { id: String(sceneId) }
    );
    const stashUrls = data?.findScene?.urls || [];
    if (data?.findScene && !stashUrls.includes(target)) {
      await syncService.makeGraphQLRequest(
        `mutation SceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
        { input: { id: String(sceneId), urls: [...stashUrls, target] } }
      );
      addedToStash = true;
    }
  }
  return !hadLocally || addedToStash;
}

module.exports = { annotatePerformerImports, importScenePerformers, createMissingPerformers, resolvePerformerChoices, addSceneUrl };

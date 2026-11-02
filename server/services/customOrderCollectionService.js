/**
 * Links custom orders to Jellyfin collections (BoxSets).
 *
 * Every movie and series (the series of each episode) in a linked order - including
 * its nested sub-orders - is added to the linked collection. Items are only ever
 * added: removing an item from an order leaves the collection untouched, so manually
 * curated collection members are never deleted.
 */
const { getCollectionsForItem } = require('../utils/collectionArtwork');

const JELLYFIN_ID = /^[0-9a-f]{32}$/i;
const ADD_BATCH_SIZE = 50;
const LOOKUP_BATCH_SIZE = 200;
const SYNC_DEBOUNCE_MS = 2000;
const VIDEO_TYPES = ['movie', 'episode', 'tv_episode'];

// Required lazily: prismaClient's middleware loads this module.
function resolveDeps(deps = {}) {
  return {
    prisma: deps.prisma || require('../prismaClient'),
    jellyfin: deps.jellyfin || require('./jellyfinService')
  };
}

function chunk(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function isJellyfinKey(value) {
  return typeof value === 'string' && JELLYFIN_ID.test(value);
}

/** The order plus every nested sub-order (via parentOrderId or "suborder" items). */
async function descendantOrderIds(prisma, orderId) {
  const seen = new Set([orderId]);
  let frontier = [orderId];
  while (frontier.length) {
    const [children, references] = await Promise.all([
      prisma.customOrder.findMany({ where: { parentOrderId: { in: frontier } }, select: { id: true } }),
      prisma.customOrderItem.findMany({
        where: { customOrderId: { in: frontier }, mediaType: 'suborder', referencedCustomOrderId: { not: null } },
        select: { referencedCustomOrderId: true }
      })
    ]);
    frontier = [...children.map(c => c.id), ...references.map(r => r.referencedCustomOrderId)]
      .filter(id => !seen.has(id));
    frontier.forEach(id => seen.add(id));
  }
  return [...seen];
}

/** The order followed by every order that contains it, nearest first. */
async function ancestorOrderIds(prisma, orderId) {
  const result = [orderId];
  const seen = new Set(result);
  let frontier = [orderId];
  while (frontier.length) {
    const [orders, references] = await Promise.all([
      prisma.customOrder.findMany({ where: { id: { in: frontier } }, select: { parentOrderId: true } }),
      prisma.customOrderItem.findMany({
        where: { mediaType: 'suborder', referencedCustomOrderId: { in: frontier } },
        select: { customOrderId: true }
      })
    ]);
    frontier = [...orders.map(o => o.parentOrderId), ...references.map(r => r.customOrderId)]
      .filter(id => id != null && !seen.has(id));
    frontier.forEach(id => { seen.add(id); result.push(id); });
  }
  return result;
}

/** Jellyfin movie ids and series ids for every library video in an order tree. */
async function collectOrderLibraryKeys(orderId, deps = {}) {
  const { prisma, jellyfin } = resolveDeps(deps);
  const orderIds = await descendantOrderIds(prisma, orderId);
  const items = await prisma.customOrderItem.findMany({
    where: { customOrderId: { in: orderIds }, mediaType: { in: VIDEO_TYPES } },
    select: { mediaType: true, plexKey: true, sourceProvider: true }
  });
  const movies = new Set();
  const episodeKeys = new Set();
  for (const item of items) {
    if (item.sourceProvider === 'arr' || !isJellyfinKey(item.plexKey)) continue;
    if (item.mediaType === 'movie') movies.add(item.plexKey);
    else episodeKeys.add(item.plexKey);
  }

  const shows = new Set();
  const unresolved = new Set(episodeKeys);
  for (const batch of chunk([...episodeKeys], LOOKUP_BATCH_SIZE)) {
    const rows = await prisma.plexEpisode.findMany({
      where: { ratingKey: { in: batch } },
      select: { ratingKey: true, grandparentRatingKey: true }
    });
    for (const row of rows) {
      if (!isJellyfinKey(row.grandparentRatingKey)) continue;
      shows.add(row.grandparentRatingKey);
      unresolved.delete(row.ratingKey);
    }
  }
  // Episodes added since the last library sync are not in the database yet.
  for (const batch of chunk([...unresolved], LOOKUP_BATCH_SIZE)) {
    for (const episode of await jellyfin.getItems(batch)) {
      if (isJellyfinKey(episode.SeriesId)) shows.add(episode.SeriesId);
    }
  }
  return { movies: [...movies], shows: [...shows] };
}

async function upsertLocalCollection(prisma, item) {
  const data = {
    name: item.Name,
    sortName: item.SortName || null,
    overview: item.Overview || null,
    thumb: item.ImageTags?.Primary ? `/Items/${item.Id}/Images/Primary` : null,
    removed: false,
    lastSyncedAt: new Date()
  };
  return prisma.mediaCollection.upsert({
    where: { jellyfinId: item.Id },
    update: data,
    create: { jellyfinId: item.Id, ...data }
  });
}

/**
 * Validate (or create) the Jellyfin collection for an order and cache it locally.
 * Returns the BoxSet id, or null to unlink.
 */
async function resolveCollectionLink({ jellyfinCollectionId, createJellyfinCollection, orderName }, deps = {}) {
  const { prisma, jellyfin } = resolveDeps(deps);
  let collectionId = jellyfinCollectionId ? String(jellyfinCollectionId).trim() : null;
  if (createJellyfinCollection) {
    const name = String(createJellyfinCollection === true ? orderName : createJellyfinCollection).trim();
    if (!name) throw Object.assign(new Error('A collection name is required'), { status: 400 });
    const created = await jellyfin.createCollection(name);
    collectionId = created?.Id;
    if (!isJellyfinKey(collectionId)) throw new Error('Jellyfin did not return the new collection id');
  }
  if (!collectionId) return null;
  if (!isJellyfinKey(collectionId)) {
    throw Object.assign(new Error('Invalid Jellyfin collection id'), { status: 400 });
  }
  let item;
  try {
    item = await jellyfin.getItem(collectionId);
  } catch (error) {
    if (error.response?.status === 404) item = null;
    else throw error;
  }
  if (!item || item.Type !== 'BoxSet') {
    throw Object.assign(new Error('Jellyfin collection not found'), { status: 400 });
  }
  await upsertLocalCollection(prisma, item);
  return item.Id;
}

/** Add the order's missing movies and series to its linked Jellyfin collection. */
async function syncOrderCollection(orderId, deps = {}) {
  const { prisma, jellyfin } = resolveDeps(deps);
  const order = await prisma.customOrder.findUnique({
    where: { id: orderId },
    select: { id: true, name: true, jellyfinCollectionId: true }
  });
  const collectionId = order?.jellyfinCollectionId;
  if (!collectionId) return { orderId, added: 0, skipped: true };

  const { movies, shows } = await collectOrderLibraryKeys(orderId, { prisma, jellyfin });
  const existing = new Set((await jellyfin.getCollectionChildren(collectionId)).map(child => child.Id));
  const missing = [
    ...movies.filter(id => !existing.has(id)).map(id => ({ id, type: 'movie' })),
    ...shows.filter(id => !existing.has(id)).map(id => ({ id, type: 'show' }))
  ];
  for (const batch of chunk(missing, ADD_BATCH_SIZE)) {
    await jellyfin.addToCollection(collectionId, batch.map(entry => entry.id));
  }

  // Mirror the additions locally so collection artwork/membership is current before the next library sync.
  const local = await prisma.mediaCollection.findUnique({ where: { jellyfinId: collectionId } });
  if (local) {
    let sortOrder = existing.size;
    for (const entry of missing) {
      await prisma.mediaCollectionItem.upsert({
        where: { collectionId_itemKey: { collectionId: local.id, itemKey: entry.id } },
        update: {},
        create: { collectionId: local.id, itemType: entry.type, itemKey: entry.id, sortOrder: sortOrder++ }
      });
    }
  }
  if (missing.length) {
    console.log(`📚 Added ${missing.length} item(s) from custom order "${order.name}" to its Jellyfin collection`);
  }
  return { orderId, added: missing.length, skipped: false };
}

const running = new Map();
const timers = new Map();

/** Serialize syncs per order so overlapping triggers cannot add duplicates. */
function runExclusive(orderId, task) {
  const previous = running.get(orderId) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  running.set(orderId, next);
  next.finally(() => { if (running.get(orderId) === next) running.delete(orderId); }).catch(() => {});
  return next;
}

/** Sync the order and every containing order that is linked to a collection. */
async function syncLinkedCollectionsForOrder(orderId, deps = {}) {
  const { prisma, jellyfin } = resolveDeps(deps);
  if (!(await jellyfin.isConfigured())) return [];
  const ids = await ancestorOrderIds(prisma, orderId);
  const linked = await prisma.customOrder.findMany({
    where: { id: { in: ids }, jellyfinCollectionId: { not: null } },
    select: { id: true }
  });
  const results = [];
  for (const { id } of linked) {
    results.push(await runExclusive(id, () => syncOrderCollection(id, { prisma, jellyfin })));
  }
  return results;
}

/** Debounced, fire-and-forget sync after an order's items change. */
function scheduleOrderCollectionSync(orderId) {
  const id = Number(orderId);
  if (!Number.isInteger(id)) return;
  clearTimeout(timers.get(id));
  const timer = setTimeout(() => {
    timers.delete(id);
    syncLinkedCollectionsForOrder(id).catch(error => {
      console.warn(`⚠️ Jellyfin collection sync failed for custom order ${id}:`, error.message);
    });
  }, SYNC_DEBOUNCE_MS);
  timer.unref?.();
  timers.set(id, timer);
}

async function syncAllOrderCollections(deps = {}) {
  const { prisma, jellyfin } = resolveDeps(deps);
  if (!(await jellyfin.isConfigured())) return [];
  const orders = await prisma.customOrder.findMany({
    where: { jellyfinCollectionId: { not: null } },
    select: { id: true, name: true }
  });
  const results = [];
  for (const order of orders) {
    try {
      results.push(await runExclusive(order.id, () => syncOrderCollection(order.id, { prisma, jellyfin })));
    } catch (error) {
      console.warn(`⚠️ Jellyfin collection sync failed for custom order "${order.name}":`, error.message);
      results.push({ orderId: order.id, added: 0, error: error.message });
    }
  }
  return results;
}

/**
 * Collection artwork for the custom order an item belongs to: each linked collection
 * of the order and its containing orders (nearest first), followed by its parent collections.
 */
async function getLinkedCollectionArtwork(customOrderId, prisma = require('../prismaClient')) {
  const id = Number(customOrderId);
  if (!Number.isInteger(id)) return [];
  const ids = await ancestorOrderIds(prisma, id);
  const orders = await prisma.customOrder.findMany({
    where: { id: { in: ids }, jellyfinCollectionId: { not: null } },
    select: { id: true, jellyfinCollectionId: true }
  });
  const byOrder = new Map(orders.map(order => [order.id, order.jellyfinCollectionId]));
  const result = [];
  const seen = new Set();
  for (const orderId of ids) {
    const jellyfinId = byOrder.get(orderId);
    if (!jellyfinId || seen.has(jellyfinId)) continue;
    const collection = await prisma.mediaCollection.findUnique({ where: { jellyfinId } });
    if (!collection || collection.removed) continue;
    seen.add(jellyfinId);
    result.push({
      id: collection.id,
      jellyfinId,
      title: collection.name,
      thumb: collection.thumb || `/Items/${jellyfinId}/Images/Primary`,
      depth: 0
    });
    for (const parent of await getCollectionsForItem(jellyfinId, prisma)) {
      if (seen.has(parent.jellyfinId)) continue;
      seen.add(parent.jellyfinId);
      result.push({ ...parent, depth: parent.depth + 1 });
    }
  }
  return result;
}

/** Attach `jellyfinCollection` ({ jellyfinId, name, thumb }) to orders for API responses. */
async function attachLinkedCollections(orders, prisma = require('../prismaClient')) {
  const list = (Array.isArray(orders) ? orders : [orders]).filter(Boolean);
  const all = [];
  const visit = (order) => {
    if (!order || typeof order !== 'object') return;
    all.push(order);
    (order.subOrders || []).forEach(visit);
  };
  list.forEach(visit);
  const ids = [...new Set(all.map(order => order.jellyfinCollectionId).filter(Boolean))];
  const collections = ids.length
    ? await prisma.mediaCollection.findMany({ where: { jellyfinId: { in: ids } } })
    : [];
  const byId = new Map(collections.map(c => [c.jellyfinId, c]));
  for (const order of all) {
    const collection = order.jellyfinCollectionId ? byId.get(order.jellyfinCollectionId) : null;
    order.jellyfinCollection = order.jellyfinCollectionId ? {
      jellyfinId: order.jellyfinCollectionId,
      name: collection?.name || null,
      thumb: collection?.thumb || `/Items/${order.jellyfinCollectionId}/Images/Primary`,
      removed: collection ? collection.removed : null
    } : null;
  }
  return orders;
}

module.exports = {
  ancestorOrderIds,
  attachLinkedCollections,
  collectOrderLibraryKeys,
  descendantOrderIds,
  getLinkedCollectionArtwork,
  resolveCollectionLink,
  scheduleOrderCollectionSync,
  syncAllOrderCollections,
  syncLinkedCollectionsForOrder,
  syncOrderCollection
};

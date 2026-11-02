/**
 * Group performers.
 *
 * Stash groups have no performer field, so performers are attached locally (StashGroupPerformer):
 * - source "scene": derived from the performers of the group's scenes; added by refreshGroupPerformers.
 * - source "manual": attached by the user, or a scene performer whose scenes all left the group. Kept until
 *   explicitly removed. Manual ids are mirrored to the Stash group's custom field (MANUAL_FIELD) so they
 *   survive a local resync/reset.
 * Refreshes never detach anyone; performers only leave a group through removePerformer.
 */

const MANUAL_FIELD = 'master_order_performer_ids';
const CHUNK = 200;

// Optional () => graphql|null used to mirror links that refreshes promote to manual
let graphqlProvider = null;
function setGraphqlProvider(provider) {
  graphqlProvider = typeof provider === 'function' ? provider : null;
}

const pairKey = (groupId, performerId) => `${groupId}|${performerId}`;

const chunk = (items, size = CHUNK) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Pure diff between scene-derived performers and existing links.
 * Nothing is ever removed: scene links whose performer left every scene of the group are promoted to manual.
 */
function diffGroupPerformers(desiredPairs, existingLinks) {
  const existing = new Map(existingLinks.map(l => [pairKey(l.groupId, l.performerId), l]));
  const desired = new Set(desiredPairs.map(p => pairKey(p.groupId, p.performerId)));

  const toCreate = [];
  const seen = new Set();
  for (const pair of desiredPairs) {
    const key = pairKey(pair.groupId, pair.performerId);
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    toCreate.push({ groupId: pair.groupId, performerId: pair.performerId, source: 'scene' });
  }

  const toPromote = existingLinks
    .filter(l => l.source === 'scene' && !desired.has(pairKey(l.groupId, l.performerId)))
    .map(l => ({ groupId: l.groupId, performerId: l.performerId }));

  return { toCreate, toPromote };
}

/**
 * Attach the performers of each group's scenes to the group. Scene-derived performers that no longer appear
 * in any of its scenes stay attached as manual links. Pass groupIds to limit the refresh; omit for all groups.
 */
async function refreshGroupPerformers(prisma, groupIds = null) {
  if (Array.isArray(groupIds) && groupIds.length === 0) return { created: 0, promoted: 0 };
  const groupFilter = groupIds ? { groupId: { in: groupIds } } : {};

  const groupScenes = await prisma.stashGroupScene.findMany({
    where: groupFilter,
    select: {
      groupId: true,
      scene: { select: { performers: { select: { performerId: true } } } }
    }
  });
  const desiredPairs = [];
  for (const gs of groupScenes) {
    for (const sp of gs.scene?.performers || []) {
      desiredPairs.push({ groupId: gs.groupId, performerId: sp.performerId });
    }
  }

  const existingLinks = await prisma.stashGroupPerformer.findMany({
    where: groupFilter,
    select: { groupId: true, performerId: true, source: true }
  });

  const { toCreate, toPromote } = diffGroupPerformers(desiredPairs, existingLinks);

  for (const batch of chunk(toCreate)) {
    await prisma.stashGroupPerformer.createMany({ data: batch });
  }
  for (const batch of chunk(toPromote)) {
    await prisma.stashGroupPerformer.updateMany({ where: { source: 'scene', OR: batch }, data: { source: 'manual' } });
  }

  const promotedGroups = [...new Set(toPromote.map(p => p.groupId))];
  if (promotedGroups.length > 0 && graphqlProvider) {
    const graphql = await Promise.resolve(graphqlProvider()).catch(() => null);
    for (const groupId of promotedGroups) await mirrorManualToStash(prisma, groupId, graphql);
  }

  return { created: toCreate.length, promoted: toPromote.length };
}

/** Refresh every group containing any of the given scenes. */
async function refreshGroupPerformersForScenes(prisma, sceneIds) {
  const ids = (Array.isArray(sceneIds) ? sceneIds : [sceneIds]).filter(Boolean).map(String);
  if (ids.length === 0) return { created: 0, promoted: 0 };
  const links = await prisma.stashGroupScene.findMany({
    where: { sceneId: { in: ids } },
    select: { groupId: true }
  });
  return refreshGroupPerformers(prisma, [...new Set(links.map(l => l.groupId))]);
}

/** Fire-and-forget refresh for request handlers; failures are logged, never thrown. */
function refreshGroupPerformersInBackground(prisma, groupIds) {
  refreshGroupPerformers(prisma, groupIds).catch(err =>
    console.warn('⚠️ [Group Performers] Refresh failed:', err.message));
}

const parseIdList = (value) => {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(list.map(v => String(v).trim()).filter(Boolean))];
};

async function manualPerformerIds(prisma, groupId) {
  const rows = await prisma.stashGroupPerformer.findMany({
    where: { groupId, source: 'manual' },
    select: { performerId: true }
  });
  return rows.map(r => r.performerId).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

/** Mirror the group's manual performer ids to its Stash custom field. Best effort. */
async function mirrorManualToStash(prisma, groupId, graphql) {
  if (!graphql) return { mirrored: false };
  const ids = await manualPerformerIds(prisma, groupId);
  const customFields = ids.length > 0
    ? { partial: { [MANUAL_FIELD]: ids.join(',') } }
    : { remove: [MANUAL_FIELD] };
  try {
    await graphql(
      `mutation GroupPerformers($input: GroupUpdateInput!) { groupUpdate(input: $input) { id } }`,
      { input: { id: groupId, custom_fields: customFields } }
    );
    return { mirrored: true };
  } catch (error) {
    console.warn(`⚠️ [Group Performers] Could not mirror performers to Stash group ${groupId}:`, error.message);
    return { mirrored: false, error: error.message };
  }
}

/** Attach performers to a group manually. Existing scene-derived links are promoted to manual. */
async function addManualPerformers(prisma, groupId, performerIds, graphql = null) {
  const ids = parseIdList(performerIds);
  if (ids.length === 0) throw Object.assign(new Error('performerIds is required'), { status: 400 });

  const group = await prisma.stashGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });

  const performers = await prisma.stashPerformer.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const found = new Set(performers.map(p => p.id));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length > 0) {
    throw Object.assign(new Error(`Unknown performer id(s): ${missing.join(', ')}`), { status: 400 });
  }

  for (const performerId of ids) {
    await prisma.stashGroupPerformer.upsert({
      where: { groupId_performerId: { groupId, performerId } },
      update: { source: 'manual' },
      create: { groupId, performerId, source: 'manual' }
    });
  }
  return mirrorManualToStash(prisma, groupId, graphql);
}

/**
 * Detach a performer. A manual link to a performer who is still in one of the group's scenes reverts to
 * a scene link; scene-only links can't be removed (they come from the scenes themselves).
 */
async function removePerformer(prisma, groupId, performerId, graphql = null) {
  const link = await prisma.stashGroupPerformer.findUnique({
    where: { groupId_performerId: { groupId, performerId } }
  });
  if (!link) throw Object.assign(new Error('Performer is not attached to this group'), { status: 404 });

  const inScenes = await prisma.stashGroupScene.count({
    where: { groupId, scene: { performers: { some: { performerId } } } }
  });

  if (link.source !== 'manual') {
    if (inScenes > 0) {
      throw Object.assign(
        new Error('This performer comes from a scene in the group; remove them from the scene instead'),
        { status: 400 }
      );
    }
    await prisma.stashGroupPerformer.delete({ where: { groupId_performerId: { groupId, performerId } } });
    return { mirrored: false, remaining: 'none' };
  }

  if (inScenes > 0) {
    await prisma.stashGroupPerformer.update({
      where: { groupId_performerId: { groupId, performerId } },
      data: { source: 'scene' }
    });
  } else {
    await prisma.stashGroupPerformer.delete({ where: { groupId_performerId: { groupId, performerId } } });
  }
  const result = await mirrorManualToStash(prisma, groupId, graphql);
  return { ...result, remaining: inScenes > 0 ? 'scene' : 'none' };
}

/**
 * Restore manual links stored in Stash group custom fields (add-only, so a failed mirror never drops
 * a local manual link). Used after a full sync.
 */
async function restoreManualFromStash(prisma, graphql) {
  if (!graphql) return { restored: 0 };
  const data = await graphql(
    `query GroupPerformerFields($filter: FindFilterType) { findGroups(filter: $filter) { groups { id custom_fields } } }`,
    { filter: { per_page: -1 } }
  );
  const wanted = [];
  for (const group of data?.findGroups?.groups || []) {
    for (const performerId of parseIdList(group.custom_fields?.[MANUAL_FIELD])) {
      wanted.push({ groupId: String(group.id), performerId });
    }
  }
  if (wanted.length === 0) return { restored: 0 };

  const [groups, performers, existing] = await Promise.all([
    prisma.stashGroup.findMany({ where: { id: { in: [...new Set(wanted.map(w => w.groupId))] } }, select: { id: true } }),
    prisma.stashPerformer.findMany({ where: { id: { in: [...new Set(wanted.map(w => w.performerId))] } }, select: { id: true } }),
    prisma.stashGroupPerformer.findMany({
      where: { groupId: { in: [...new Set(wanted.map(w => w.groupId))] } },
      select: { groupId: true, performerId: true, source: true }
    })
  ]);
  const groupIds = new Set(groups.map(g => g.id));
  const performerIds = new Set(performers.map(p => p.id));
  const existingByKey = new Map(existing.map(e => [pairKey(e.groupId, e.performerId), e]));

  let restored = 0;
  for (const { groupId, performerId } of wanted) {
    if (!groupIds.has(groupId) || !performerIds.has(performerId)) continue;
    const current = existingByKey.get(pairKey(groupId, performerId));
    if (current?.source === 'manual') continue;
    await prisma.stashGroupPerformer.upsert({
      where: { groupId_performerId: { groupId, performerId } },
      update: { source: 'manual' },
      create: { groupId, performerId, source: 'manual' }
    });
    restored++;
  }
  return { restored };
}

/** Post-sync reconcile: scene-derived links for all groups, then manual links from Stash. */
async function reconcileAllGroupPerformers(prisma, graphql = null) {
  const scene = await refreshGroupPerformers(prisma);
  let manual = { restored: 0 };
  try {
    manual = await restoreManualFromStash(prisma, graphql);
  } catch (error) {
    console.warn('⚠️ [Group Performers] Could not restore manual performers from Stash:', error.message);
  }
  console.log(`👥 [Group Performers] Reconciled: +${scene.created} scene links, ${scene.promoted} kept as manual, ${manual.restored} manual restored`);
  return { ...scene, restored: manual.restored };
}

module.exports = {
  MANUAL_FIELD,
  setGraphqlProvider,
  diffGroupPerformers,
  refreshGroupPerformers,
  refreshGroupPerformersForScenes,
  refreshGroupPerformersInBackground,
  addManualPerformers,
  removePerformer,
  restoreManualFromStash,
  reconcileAllGroupPerformers
};

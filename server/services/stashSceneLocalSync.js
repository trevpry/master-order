/**
 * Upsert a single Stash scene (as returned by SCENE_SYNC_FIELDS) into the local database.
 * Shared by POST /api/stash/scenes/:id/sync and group scene splitting.
 * Local performer action codes/notes are preserved.
 */

const SCENE_SYNC_FIELDS = `
  id
  title
  details
  url
  date
  rating100
  o_counter
  organized
  studio { id name }
  tags { id name }
  performers { id name }
  stash_ids { endpoint stash_id }
  files { path size duration video_codec audio_codec width height frame_rate bit_rate }
`;

async function upsertSceneFromStash(prisma, scene) {
  const primaryFile = scene.files && scene.files.length > 0 ? scene.files[0] : null;

  let validatedStudioId = null;
  if (scene.studio?.id) {
    const studioExists = await prisma.stashStudio.findUnique({ where: { id: scene.studio.id } });
    if (studioExists) validatedStudioId = scene.studio.id;
    else console.log(`   ⚠️ Studio ${scene.studio.id} not found, setting studioId to null`);
  }

  const sceneData = {
    id: scene.id,
    title: scene.title || '',
    details: scene.details || null,
    url: scene.url || null,
    date: scene.date || null,
    rating: scene.rating100 ? Math.round(scene.rating100 / 20) : null,
    organized: scene.organized || false,
    osHash: null,
    checksum: null,
    phash: null,
    oCounter: scene.o_counter || null,
    path: primaryFile?.path || null,
    fileModTime: null,
    fileSize: primaryFile?.size || null,
    duration: primaryFile?.duration || null,
    width: primaryFile?.width || null,
    height: primaryFile?.height || null,
    videoCodec: primaryFile?.video_codec || null,
    audioCodec: primaryFile?.audio_codec || null,
    frameRate: primaryFile?.frame_rate || null,
    bitrate: primaryFile?.bit_rate || null,
    studio: scene.studio?.name || null,
    studioId: validatedStudioId,
    code: null,
    director: null,
    synopsis: null,
    lastPlayedAt: null,
    resumeTime: null,
    playDuration: null,
    playCount: null,
    lastSyncedAt: new Date()
  };

  const syncedScene = await prisma.stashScene.upsert({
    where: { id: scene.id },
    update: sceneData,
    create: sceneData
  });

  if (scene.performers && scene.performers.length > 0) {
    const existingRelationships = await prisma.stashScenePerformer.findMany({
      where: { sceneId: scene.id },
      include: { tags: true }
    });

    // Relationships carrying local action codes or notes are never removed by a sync
    const relationshipsWithData = new Map();
    existingRelationships.forEach(rel => {
      if (rel.tags.length > 0 || rel.notes) relationshipsWithData.set(rel.performerId, rel);
    });

    const stashPerformerIds = new Set();
    const validPerformers = [];
    for (const performer of scene.performers) {
      const performerExists = await prisma.stashPerformer.findUnique({ where: { id: performer.id } });
      if (performerExists) {
        validPerformers.push(performer);
        stashPerformerIds.add(performer.id);
      } else {
        console.log(`   ⚠️ Skipping performer ${performer.id} - not found in database`);
      }
    }

    const performersToRemove = existingRelationships
      .filter(rel => !stashPerformerIds.has(rel.performerId) && !relationshipsWithData.has(rel.performerId))
      .map(rel => rel.performerId);

    if (performersToRemove.length > 0) {
      await prisma.stashScenePerformer.deleteMany({
        where: { sceneId: scene.id, performerId: { in: performersToRemove } }
      });
      console.log(`   🗑️ Removed ${performersToRemove.length} performer(s) no longer in Stash (without local data)`);
    }

    for (const performer of validPerformers) {
      await prisma.stashScenePerformer.upsert({
        where: { sceneId_performerId: { sceneId: scene.id, performerId: performer.id } },
        update: {},
        create: { sceneId: scene.id, performerId: performer.id }
      });
    }
    console.log(`   - Synced ${validPerformers.length} performers`);
  }

  if (scene.tags && scene.tags.length > 0) {
    await prisma.stashSceneTag.deleteMany({ where: { sceneId: scene.id } });

    const validTags = [];
    for (const tag of scene.tags) {
      const tagExists = await prisma.stashTag.findUnique({ where: { id: tag.id } });
      if (tagExists) validTags.push(tag);
      else console.log(`   ⚠️ Skipping tag ${tag.id} - not found in database`);
    }

    if (validTags.length > 0) {
      await prisma.stashSceneTag.createMany({
        data: validTags.map(tag => ({ sceneId: scene.id, tagId: tag.id }))
      });
      console.log(`   - Synced ${validTags.length} tags`);
    }
  }

  return syncedScene;
}

module.exports = { SCENE_SYNC_FIELDS, upsertSceneFromStash };

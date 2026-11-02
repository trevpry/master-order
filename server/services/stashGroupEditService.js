/**
 * Edits a Stash group (movie) in Stash itself via `groupUpdate`, then mirrors Stash's response
 * into the local StashGroup row so the web app and Stash stay in sync.
 */

class GroupEditError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

const optionalText = value => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const uniqueIds = values => [...new Set((values || []).map(v => String(v).trim()).filter(Boolean))];

// Stash accepts YYYY, YYYY-MM or YYYY-MM-DD
const DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;
// Stash fetches http(s) URLs itself, or decodes base64 data URIs
const IMAGE_PATTERN = /^(https?:\/\/\S+|data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+)$/i;

/**
 * Builds a GroupUpdateInput from an edit form body. Only keys present in the body are sent, and
 * blank/null values clear the field in Stash.
 */
function buildGroupUpdateInput(id, body = {}) {
  const input = { id: String(id) };

  if (has(body, 'name')) {
    const name = optionalText(body.name);
    if (!name) throw new GroupEditError('Name is required');
    input.name = name;
  }
  for (const key of ['aliases', 'director', 'synopsis']) {
    if (has(body, key)) input[key] = optionalText(body[key]);
  }
  if (has(body, 'date')) {
    const date = optionalText(body.date);
    if (date && !DATE_PATTERN.test(date)) throw new GroupEditError('Date must be YYYY, YYYY-MM or YYYY-MM-DD');
    input.date = date;
  }
  if (has(body, 'duration')) {
    if (body.duration === null || body.duration === '') {
      input.duration = null;
    } else {
      const duration = Math.round(Number(body.duration));
      if (!Number.isFinite(duration) || duration < 0) throw new GroupEditError('Duration must be a positive number of seconds');
      input.duration = duration;
    }
  }
  if (has(body, 'rating')) {
    if (body.rating === null || body.rating === '') {
      input.rating100 = null;
    } else {
      const rating = Math.round(Number(body.rating));
      if (!Number.isFinite(rating) || rating < 0 || rating > 100) throw new GroupEditError('Rating must be between 0 and 100');
      input.rating100 = rating;
    }
  }
  if (has(body, 'studioId')) input.studio_id = optionalText(body.studioId);
  if (has(body, 'urls')) {
    if (!Array.isArray(body.urls)) throw new GroupEditError('URLs must be a list');
    input.urls = [...new Set(body.urls.map(optionalText).filter(Boolean))];
  }
  if (has(body, 'tagIds')) {
    if (!Array.isArray(body.tagIds)) throw new GroupEditError('Tags must be a list');
    input.tag_ids = uniqueIds(body.tagIds);
  }
  for (const [key, stashKey] of [['frontImage', 'front_image'], ['backImage', 'back_image']]) {
    if (!has(body, key)) continue;
    const image = optionalText(body[key]);
    if (image && !IMAGE_PATTERN.test(image)) throw new GroupEditError(`${key === 'frontImage' ? 'Front' : 'Back'} image must be an http(s) URL or an uploaded image`);
    // null removes the image in Stash
    input[stashKey] = image;
  }

  return input;
}

const GROUP_UPDATE_MUTATION = `
  mutation GroupUpdate($input: GroupUpdateInput!) {
    groupUpdate(input: $input) {
      id
      name
      aliases
      duration
      date
      rating100
      director
      synopsis
      urls
      front_image_path
      back_image_path
      studio { id name }
      tags { id name }
    }
  }
`;

/** Maps a Stash group onto local StashGroup columns (matches stashSyncService storage). */
function localGroupData(stashGroup) {
  return {
    name: stashGroup.name || 'Untitled Group',
    aliases: stashGroup.aliases || null,
    duration: stashGroup.duration ?? null,
    date: stashGroup.date || null,
    rating: stashGroup.rating100 ?? null,
    director: stashGroup.director || null,
    synopsis: stashGroup.synopsis || null,
    url: stashGroup.urls?.length ? JSON.stringify(stashGroup.urls) : null,
    frontImage: stashGroup.front_image_path || null,
    backImage: stashGroup.back_image_path || null,
    studioId: stashGroup.studio?.id || null,
    tagIds: stashGroup.tags?.length ? stashGroup.tags.map(tag => tag.id).join(',') : null,
    lastSyncedAt: new Date()
  };
}

/**
 * Applies the edit to Stash, then updates the local group, studio and tag links from Stash's
 * response. Local data is only touched after Stash accepts the change.
 */
async function editGroup({ prisma, graphql, id, body }) {
  const existing = await prisma.stashGroup.findUnique({ where: { id: String(id) }, select: { id: true } });
  if (!existing) throw new GroupEditError('Group not found', 404);

  const input = buildGroupUpdateInput(id, body);
  if (Object.keys(input).length === 1) throw new GroupEditError('No changes provided');

  const data = await graphql(GROUP_UPDATE_MUTATION, { input });
  const stashGroup = data?.groupUpdate;
  if (!stashGroup) throw new GroupEditError('Stash did not return the updated group', 502);

  // Stash has already accepted the edit, so a stale local studio/tag row must not fail the request
  const ensureLocal = async (model, entity) => {
    try {
      await prisma[model].upsert({ where: { id: entity.id }, update: {}, create: { id: entity.id, name: entity.name } });
      return true;
    } catch (error) {
      console.warn(`⚠️ Could not mirror ${model} ${entity.id} locally: ${error.message}`);
      return false;
    }
  };

  const groupData = localGroupData(stashGroup);
  if (stashGroup.studio && !(await ensureLocal('stashStudio', stashGroup.studio))) groupData.studioId = null;
  const localTags = [];
  for (const tag of stashGroup.tags || []) {
    if (await ensureLocal('stashTag', tag)) localTags.push(tag);
  }

  await prisma.stashGroup.update({ where: { id: stashGroup.id }, data: groupData });
  if (has(input, 'tag_ids')) {
    await prisma.stashGroupTag.deleteMany({ where: { groupId: stashGroup.id } });
    for (const tag of localTags) {
      await prisma.stashGroupTag.create({ data: { groupId: stashGroup.id, tagId: tag.id } });
    }
  }

  return stashGroup;
}

module.exports = { editGroup, buildGroupUpdateInput, localGroupData, GroupEditError, GROUP_UPDATE_MUTATION };

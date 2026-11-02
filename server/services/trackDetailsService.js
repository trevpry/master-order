/**
 * Classical-aware track details for clients that show "now playing" info (e.g. the Android
 * reading session): composer, work, movement and the best album artwork.
 */

const nonEmpty = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

const workTitle = work => (work ? nonEmpty(work.userTitle) || nonEmpty(work.title) : null);

function resolveTrackDetails(track) {
  if (!track) return { composer: null, work: null, workCatalog: null, movement: null };

  const partEntry = (track.workPartTracks || []).find(entry => entry.workPart);
  const part = partEntry?.workPart || null;
  const work = track.work || part?.work || track.album?.work || null;

  const creditedComposer = (track.trackArtists || [])
    .find(credit => credit.artistType?.name === 'Composer' && credit.artist)?.artist;
  const albumComposer = (track.album?.albumArtists || [])
    .find(credit => credit.artistType?.name === 'Composer' && credit.artist)?.artist;

  const composer = nonEmpty(track.userComposer)
    || nonEmpty(work?.composer?.title)
    || nonEmpty(creditedComposer?.title)
    || nonEmpty(albumComposer?.title);

  const title = workTitle(work);
  const movement = nonEmpty(part?.title);

  return {
    composer: composer || null,
    work: title,
    workCatalog: work ? nonEmpty(work.userCatalogNumber) || nonEmpty(work.userOpusNumber) : null,
    // A movement that just repeats the work or track title adds nothing
    movement: movement && movement !== title && movement !== nonEmpty(track.title) ? movement : null
  };
}

async function getTrackDetails(prisma, ratingKey) {
  if (!ratingKey) return null;
  const composerCredit = {
    where: { artistType: { name: 'Composer' } },
    include: { artist: { select: { title: true } }, artistType: { select: { name: true } } }
  };
  const workInclude = { include: { composer: { select: { title: true } } } };

  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: String(ratingKey) },
    include: {
      work: workInclude,
      workPartTracks: { include: { workPart: { include: { work: workInclude } } } },
      trackArtists: composerCredit,
      album: {
        select: {
          ratingKey: true,
          work: workInclude,
          albumArtists: composerCredit,
          artworks: { where: { type: 'front' }, select: { updatedAt: true } }
        }
      }
    }
  });
  if (!track) return null;

  const front = track.album?.artworks?.[0];
  return {
    ...resolveTrackDetails(track),
    albumArtworkPath: front
      ? `/api/music/albums/${encodeURIComponent(track.album.ratingKey)}/artwork/front?v=${front.updatedAt.getTime()}`
      : null
  };
}

module.exports = { getTrackDetails, resolveTrackDetails };

// Diagnostic script to locate the 'Penny Dreadful' album or tracks in Plex music sections
// Uses direct Plex section-wide queries to determine why artist children call returns 0 albums.

const prisma = require('./server/prismaClient');
const PlexSyncService = require('./server/plexSyncService');

async function run() {
  console.log('🔍 Investigating missing album: Penny Dreadful');
  const plex = new PlexSyncService();
  try {
    // Ensure sections present
    await plex.syncLibrarySections();
    const sectionsData = await plex.makeRequest('/library/sections');
    const sections = sectionsData.MediaContainer?.Directory || [];
    const musicSections = sections.filter(s => s.type === 'artist');
    console.log(`🎼 Music sections: ${musicSections.map(s => `${s.key}:${s.title}`).join(', ')}`);

    const targetArtistKey = '115738'; // Abel Korzeniowski

    for (const section of musicSections) {
      console.log(`\n==== Section ${section.key} (${section.title}) ====\n`);
      // 1. Search for album objects (type=9 is album) with text match on title
      const encodedTitle = encodeURIComponent('Penny Dreadful');
      // Plex search by title param (may or may not work depending on agent). We'll also do a broad 'all?type=9' scan and filter client-side.
      let albumsResp;
      try {
        albumsResp = await plex.makeRequest(`/library/sections/${section.key}/all?type=9&title=${encodedTitle}`);
      } catch (e) {
        console.warn(`   ⚠️ Title-filter album search failed in section ${section.key}: ${e.message}`);
      }
      const titleFilterAlbums = albumsResp?.MediaContainer?.Metadata || [];
      if (titleFilterAlbums.length) {
        console.log(`   🎯 Direct title search returned ${titleFilterAlbums.length} album(s):`);
        titleFilterAlbums.forEach(a => console.log(`      - Album ${a.title} (ratingKey ${a.ratingKey}) parentRatingKey=${a.parentRatingKey}`));
      } else {
        console.log('   ℹ️ Direct title search returned 0 albums');
      }

      // 2. Pull first N albums from section (may be large; we paginate with container size)
      let allAlbums = [];
      try {
        const bulk = await plex.makeRequest(`/library/sections/${section.key}/all?type=9&X-Plex-Container-Start=0&X-Plex-Container-Size=200`);
        allAlbums = bulk?.MediaContainer?.Metadata || [];
      } catch (e) {
        console.warn(`   ⚠️ Bulk album fetch failed: ${e.message}`);
      }
      const pennyAlbums = allAlbums.filter(a => a.title && a.title.toLowerCase().includes('penny dreadful'));
      console.log(`   📀 Scanned first ${allAlbums.length} albums; matches for 'penny dreadful': ${pennyAlbums.length}`);
      pennyAlbums.forEach(a => console.log(`      - ${a.title} (ratingKey ${a.ratingKey}) artist=${a.parentRatingKey}`));

      // 3. Look for tracks referencing Penny Dreadful (type=10 for track) limited sample
      let tracks = [];
      try {
        const tracksResp = await plex.makeRequest(`/library/sections/${section.key}/all?type=10&X-Plex-Container-Start=0&X-Plex-Container-Size=300`);
        tracks = tracksResp?.MediaContainer?.Metadata || [];
      } catch (e) {
        console.warn(`   ⚠️ Track fetch failed: ${e.message}`);
      }
      const pennyTracks = tracks.filter(t => (t.title && t.title.toLowerCase().includes('penny')) || (t.grandparentTitle && t.grandparentTitle.toLowerCase().includes('penny dreadful')) || (t.parentTitle && t.parentTitle.toLowerCase().includes('penny dreadful')));
      console.log(`   🎵 Sampled ${tracks.length} tracks; 'penny' related tracks: ${pennyTracks.length}`);
      pennyTracks.slice(0, 10).forEach(t => console.log(`      - Track ${t.title} (ratingKey ${t.ratingKey}) album=${t.parentTitle} artist=${t.grandparentTitle}`));

      // 4. If we find album(s), fetch their children explicitly
      for (const album of pennyAlbums) {
        try {
          const children = await plex.makeRequest(`/library/metadata/${album.ratingKey}/children`);
          const childTracks = children?.MediaContainer?.Metadata || [];
            console.log(`   ✅ Album detail: ${album.title} has ${childTracks.length} tracks`);
        } catch (e) {
          console.warn(`   ⚠️ Could not fetch tracks for album ${album.ratingKey}: ${e.message}`);
        }
      }

      // 5. Check DB if discovered
      if (pennyAlbums.length) {
        const dbAlbums = await prisma.plexAlbum.findMany({ where: { title: { contains: 'Penny Dreadful' } } });
        console.log(`   🗄️ DB currently has ${dbAlbums.length} matching album rows.`);
      }

      // 6. If we found album(s) but they are not under the target artist, show their parentRatingKey mapping
      if (pennyAlbums.length) {
        for (const a of pennyAlbums) {
          if (a.parentRatingKey && a.parentRatingKey !== targetArtistKey) {
            console.log(`   ⚠️ Album ${a.title} parentRatingKey ${a.parentRatingKey} does not match Abel Korzeniowski (${targetArtistKey})`);
          }
        }
      }

      // 7. Directly fetch artist children again to compare
      if (section.title.toLowerCase().includes('soundtrack')) {
        try {
          const artistChildren = await plex.makeRequest(`/library/metadata/${targetArtistKey}/children`);
          const artistAlbums = artistChildren?.MediaContainer?.Metadata || [];
          console.log(`   🔁 Direct artist children (again) returned ${artistAlbums.length} albums.`);
        } catch (e) {
          console.warn('   ⚠️ Artist children re-fetch failed:', e.message);
        }
      }
    }
  } catch (e) {
    console.error('❌ Investigation failed:', e.message);
  } finally {
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

run();

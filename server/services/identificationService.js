const { PrismaClient } = require('@prisma/client');
const MusicBrainzService = require('./musicBrainzService');
const { getPreferredMusicBrainzArtistName, unsortMusicBrainzName } = require('../utils/musicBrainzNames');

/**
 * IdentificationService
 * 
 * Handles MusicBrainz identification workflow with confidence scoring
 * Searches for matches, stores candidates, and applies accepted identifications
 */
class IdentificationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.musicBrainz = new MusicBrainzService();
    // Caches resolved local PlexArtist records by MusicBrainz artist ID for the duration of a
    // single apply operation, since the same composer/conductor/ensemble is typically referenced
    // by every track on a classical release and would otherwise trigger a network call each time.
    this.artistResolutionCache = new Map();
  }

  /**
   * Extract album cover URL from MusicBrainz release/release-group data
   * @param {Object} musicBrainzData - MusicBrainz release or release-group data
   * @returns {string|null} Cover art URL or null
   */
  extractAlbumCoverUrl(musicBrainzData) {
    // Try to get cover art from MusicBrainz
    // Use Cover Art Archive API: https://coverartarchive.org/
    // For releases: https://coverartarchive.org/release/{id}/front
    // For release-groups: https://coverartarchive.org/release-group/{id}/front
    
    // Check if we have a release object (has id field)
    const releaseId = musicBrainzData.id;
    if (releaseId) {
      // Return the Cover Art Archive URL for the release
      // Front cover is the default image type
      const coverUrl = `https://coverartarchive.org/release/${releaseId}/front`;
      console.log('Cover art URL for', releaseId, ':', coverUrl);
      return coverUrl;
    }
    return null;
  }

  /**
   * Search MusicBrainz for album matches
   * @param {string} ratingKey - Album's ratingKey
   * @param {Object} plexInfo - Optional Plex URL and token for artwork URLs
   * @param {string} plexInfo.plexUrl - Plex server URL
   * @param {string} plexInfo.plexToken - Plex token for authentication
   * @returns {Promise<Array>} Array of candidates with confidence scores
   */
  async identifyAlbum(ratingKey, plexInfo = {}) {
    // Get album with artist info
    const album = await this.prisma.plexAlbum.findUnique({
      where: { ratingKey },
      include: {
        artist: true,
        tracks: {
          orderBy: { index: 'asc' },
          take: 20 // First 20 tracks for matching
        }
      }
    });

    if (!album) {
      throw new Error(`Album not found: ${ratingKey}`);
    }

    // Get cover art URL from database
    const albumCoverLocalRaw = album.art || album.thumb || null;
    
    // Construct proper artwork URL if plexInfo is provided
    const albumCoverLocal = plexInfo.plexUrl && plexInfo.plexToken && albumCoverLocalRaw
      ? `${plexInfo.plexUrl}${albumCoverLocalRaw}?X-Plex-Token=${plexInfo.plexToken}`
      : albumCoverLocalRaw;

    // Clear any pending candidates for this album
    await this.prisma.identificationCandidate.deleteMany({
      where: {
        entityType: 'album',
        entityKey: ratingKey,
        status: 'pending'
      }
    });

    const candidates = [];

    if (album.musicBrainzId) {
      try {
        const directResult = await this.musicBrainz.getRelease(album.musicBrainzId);
        
        // Get cover art from MusicBrainz
        const albumCoverMusicBrainz = this.extractAlbumCoverUrl(directResult);
        
        console.log('Direct album lookup - Album:', album.title, 'Local cover:', albumCoverLocal || 'none', 'MusicBrainz cover:', albumCoverMusicBrainz || 'none');
        
        const candidate = await this.prisma.identificationCandidate.create({
          data: {
            entityType: 'album',
            entityKey: ratingKey,
            musicBrainzId: directResult.id,
            title: directResult.title,
            artist: directResult['artist-credit']?.[0]?.name,
            releaseDate: directResult.date ? new Date(directResult.date) : null,
            confidence: 1,
            metadata: JSON.stringify(directResult),
            status: 'pending',
            albumCoverLocal: albumCoverLocal,
            albumCoverMusicBrainz: albumCoverMusicBrainz
          }
        });

        candidates.push(candidate);
      } catch (error) {
        console.warn(`MusicBrainz direct album lookup failed for ${album.musicBrainzId}, falling back to search`, error.message);
      }
    }

    if (candidates.length === 0) {
      // Plex stores many artists (especially classical) as sort names like "Scarlatti, Alessandro",
      // which never match MusicBrainz's fielded artist search, so try the unsorted form and finally
      // a title-only search before giving up.
      const artistTitle = album.artist?.title?.trim() || null;
      const artistVariants = [...new Set([artistTitle, unsortMusicBrainzName(artistTitle), null])]
        .filter((name) => name === null || Boolean(name));

      let searchResults = [];
      for (const artistName of artistVariants) {
        searchResults = await this.musicBrainz.searchRelease(album.title, artistName);

        if (searchResults.length > 0) {
          break;
        }
      }

      // Calculate confidence scores and store candidates
      for (const result of searchResults.slice(0, 10)) { // Top 10 matches
        const confidence = this.calculateAlbumConfidence(album, result);
        
        // Get cover art from MusicBrainz
        const albumCoverMusicBrainz = this.extractAlbumCoverUrl(result);
        
        console.log('Search result - Album:', result.title, 'Local cover:', albumCoverLocal || 'none', 'MusicBrainz cover:', albumCoverMusicBrainz || 'none');
        
        // Store candidate
        const candidate = await this.prisma.identificationCandidate.create({
          data: {
            entityType: 'album',
            entityKey: ratingKey,
            musicBrainzId: result.id,
            title: result.title,
            artist: result['artist-credit']?.[0]?.name,
            releaseDate: result.date ? new Date(result.date) : null,
            confidence,
            metadata: JSON.stringify(result),
            status: 'pending',
            albumCoverLocal: albumCoverLocal,
            albumCoverMusicBrainz: albumCoverMusicBrainz
          }
        });

        candidates.push(candidate);
      }
    }

    // Search by AcoustID fingerprint if available
    const tracksWithAcoustId = await this.prisma.plexTrack.findMany({
      where: {
        ratingKey: {
          in: album.tracks.map(t => t.ratingKey)
        },
        acoustidId: {
          not: null
        }
      },
      take: 1 // Just need one track with AcoustID
    });

    if (tracksWithAcoustId.length > 0) {
      const firstTrack = tracksWithAcoustId[0];
      const acoustId = firstTrack.acoustidId;
      
      if (acoustId) {
        try {
          const recordingResults = await this.musicBrainz.searchRecordingsByAcoustId(acoustId, 10);
          
          for (const result of recordingResults) {
            // Check if this recording is already in candidates
            const alreadyExists = candidates.find(c => c.musicBrainzId === result.id);
            if (!alreadyExists) {
              const confidence = 0.8; // High confidence for AcoustID matches
              
              const candidate = await this.prisma.identificationCandidate.create({
                data: {
                  entityType: 'album',
                  entityKey: ratingKey,
                  musicBrainzId: result.id,
                  title: result.title,
                  artist: result['artist-credit']?.[0]?.name,
                  releaseDate: result.date ? new Date(result.date) : null,
                  confidence,
                  metadata: JSON.stringify(result),
                  status: 'pending'
                }
              });
              
              candidates.push(candidate);
            }
          }
        } catch (error) {
          console.error('MusicBrainz AcoustID search error:', error);
        }
      }
    }

    // Update album identification status
    await this.prisma.plexAlbum.update({
      where: { ratingKey },
      data: {
        identificationStatus: candidates.length > 0 ? 'pending_review' : 'no_match',
        lastIdentificationAttempt: new Date()
      }
    });

    // Sort by confidence (highest first)
    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Search MusicBrainz for artist matches
   * @param {string} ratingKey - Artist's ratingKey
   * @param {Object} plexInfo - Optional Plex URL and token for artwork URLs
   * @param {string} plexInfo.plexUrl - Plex server URL
   * @param {string} plexInfo.plexToken - Plex token for authentication
   * @returns {Promise<Array>} Array of candidates with confidence scores
   */
  async identifyArtist(ratingKey, plexInfo = {}) {
    const artist = await this.prisma.plexArtist.findUnique({
      where: { ratingKey },
      include: {
        albums: {
          take: 5,
          orderBy: { year: 'desc' }
        }
      }
    });

    if (!artist) {
      throw new Error(`Artist not found: ${ratingKey}`);
    }

    // Get artist cover art URL from database
    const artistCoverLocalRaw = artist.art || artist.thumb || null;
    
    // Construct proper artwork URL if plexInfo is provided
    const artistCoverLocal = plexInfo.plexUrl && plexInfo.plexToken && artistCoverLocalRaw
      ? `${plexInfo.plexUrl}${artistCoverLocalRaw}?X-Plex-Token=${plexInfo.plexToken}`
      : artistCoverLocalRaw;

    // Clear pending candidates
    await this.prisma.identificationCandidate.deleteMany({
      where: {
        entityType: 'artist',
        entityKey: ratingKey,
        status: 'pending'
      }
    });

    // Search MusicBrainz
    // Handle "lastName, firstName" format by searching both formats
    const searchName = artist.title;
    const searchNames = [searchName];
    
    // Check if the name is in "lastName, firstName" format
    if (searchName.includes(',') && !searchName.startsWith(',')) {
      const parts = searchName.split(',');
      if (parts.length === 2) {
        const firstName = parts[1].trim();
        const lastName = parts[0].trim();
        // Add "firstName lastName" format to search
        searchNames.push(`${firstName} ${lastName}`);
      }
    }
    
    // Also try searching without quotes for better results
    const searchNamesUnquoted = searchNames.map(name => {
      if (name.includes(' ')) {
        return name.replace(/"/g, '');
      }
      return name;
    });
    
    let allSearchResults = [];
    for (const searchName of [...searchNames, ...searchNamesUnquoted]) {
      // Each MusicBrainz call is isolated: a transient failure (rate limiting, network hiccup)
      // on one name variant/search type shouldn't abort the whole identification request.
      let primaryResults = [];
      try {
        primaryResults = await this.musicBrainz.searchArtist(searchName);
        allSearchResults.push(...primaryResults);
      } catch (error) {
        console.warn(`MusicBrainz artist search failed for "${searchName}"`, error.message);
      }

      if (primaryResults.length === 0) {
        try {
          // Preserve field-specific fallbacks for unusual names without tripling normal traffic.
          const aliasResults = await this.musicBrainz.searchArtistByAlias(searchName);
          allSearchResults.push(...aliasResults);
        } catch (error) {
          console.warn(`MusicBrainz artist alias search failed for "${searchName}"`, error.message);
        }

        try {
          const sortNameResults = await this.musicBrainz.searchArtistBySortName(searchName);
          allSearchResults.push(...sortNameResults);
        } catch (error) {
          console.warn(`MusicBrainz artist sort name search failed for "${searchName}"`, error.message);
        }
      }
    }
    
    // Deduplicate results
    const uniqueResults = [];
    const seenIds = new Set();
    for (const result of allSearchResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        uniqueResults.push(result);
      }
    }

    // Calculate confidence and store candidates
    const candidates = [];
    for (const result of uniqueResults.slice(0, 10)) {
      const confidence = this.calculateArtistConfidence(artist, result);
      const preferredName = getPreferredMusicBrainzArtistName(result) || result.name;
      
      const candidate = await this.prisma.identificationCandidate.create({
        data: {
          entityType: 'artist',
          entityKey: ratingKey,
          musicBrainzId: result.id,
          title: preferredName,
          artist: null,
          releaseDate: null,
          confidence,
          metadata: JSON.stringify(result),
          status: 'pending',
          artistCoverLocal: artistCoverLocal
        }
      });

      candidates.push(candidate);
    }

    await this.prisma.plexArtist.update({
      where: { ratingKey },
      data: {
        identificationStatus: candidates.length > 0 ? 'pending_review' : 'no_match',
        lastIdentificationAttempt: new Date()
      }
    });

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Accept an identification candidate and apply metadata
   * @param {number} candidateId - Candidate ID to accept
   * @returns {Promise<Object>} Updated entity
   */
  async acceptIdentification(candidateId) {
    const candidate = await this.prisma.identificationCandidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    // Fetch full metadata from MusicBrainz
    let fullMetadata;
    if (candidate.entityType === 'album') {
      fullMetadata = await this.musicBrainz.getRelease(candidate.musicBrainzId);
    } else if (candidate.entityType === 'artist') {
      fullMetadata = await this.musicBrainz.getArtist(candidate.musicBrainzId);
    }

    // Return the raw metadata without saving to database
    return {
      success: true,
      data: fullMetadata,
      candidate: {
        id: candidate.id,
        entityType: candidate.entityType,
        entityKey: candidate.entityKey,
        musicBrainzId: candidate.musicBrainzId
      }
    };
  }

  /**
   * Apply a candidate's MusicBrainz metadata to the album/artist and its tracks, persisting it
   * @param {number} candidateId - Candidate ID to apply
   * @param {Object} [preloadedMetadata] - Metadata already fetched (e.g. during accept) to avoid
   *   re-hitting the rate-limited MusicBrainz API
   * @param {Array<{localTrackKey: string, recordingId: string}>} [trackMatchOverrides] - manual
   *   track pairings chosen by the user, applied before the automatic per-track matching
   * @returns {Promise<Object>} Updated entity
   */
  async applyIdentification(candidateId, preloadedMetadata = null, trackMatchOverrides = []) {
    const candidate = await this.prisma.identificationCandidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    let updatedEntity;
    if (candidate.entityType === 'album') {
      const fullMetadata = preloadedMetadata || await this.musicBrainz.getRelease(candidate.musicBrainzId);
      updatedEntity = await this.applyAlbumMetadata(candidate.entityKey, fullMetadata, trackMatchOverrides);
    } else if (candidate.entityType === 'artist') {
      const fullMetadata = preloadedMetadata || await this.musicBrainz.getArtist(candidate.musicBrainzId);
      updatedEntity = await this.applyArtistMetadata(candidate.entityKey, fullMetadata);
    } else {
      throw new Error(`Unsupported entity type: ${candidate.entityType}`);
    }

    await this.prisma.identificationCandidate.update({
      where: { id: candidateId },
      data: { status: 'accepted' }
    });

    return {
      success: true,
      entityType: candidate.entityType,
      entityKey: candidate.entityKey,
      data: updatedEntity
    };
  }

  /**
   * Apply MusicBrainz metadata to album
   * @private
   */
  async applyAlbumMetadata(ratingKey, metadata, trackMatchOverrides = []) {
    this.artistResolutionCache.clear();

    const album = await this.prisma.plexAlbum.findUnique({
      where: { ratingKey },
      include: {
        artist: true,
        tracks: {
          orderBy: [
            { discNumber: 'asc' },
            { index: 'asc' },
            { ratingKey: 'asc' }
          ]
        }
      }
    });

    if (!album) {
      throw new Error(`Album not found: ${ratingKey}`);
    }

    const updateData = {
      musicBrainzId: metadata.id,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

    if (metadata.title) {
      updateData.title = metadata.title;
      updateData.titleSort = metadata.title;
    }

    // Extract relevant MusicBrainz fields
    if (metadata['first-release-date']) {
      updateData.musicBrainzReleaseDate = metadata['first-release-date'];
    }
    if (metadata['label-info']?.[0]?.label?.name) {
      updateData.musicBrainzLabel = metadata['label-info'][0].label.name;
    }
    if (metadata.barcode) {
      updateData.musicBrainzBarcode = metadata.barcode;
    }
    if (metadata.asin) {
      updateData.musicBrainzAsin = metadata.asin;
    }

    // Handle artist and album artist from MusicBrainz
    if (metadata['artist-credit']?.[0]) {
      const mbArtistName = metadata['artist-credit'][0].name;
      const mbArtistId = metadata['artist-credit'][0].artist?.id;
      
      // Try to find matching artist in system by MusicBrainz ID first
      let matchingArtist = null;
      if (mbArtistId) {
        matchingArtist = await this.prisma.plexArtist.findFirst({
          where: { musicBrainzId: mbArtistId }
        });
      }
      
      // If not found by MB ID, try by exact name match
      if (!matchingArtist && mbArtistName) {
        matchingArtist = await this.prisma.plexArtist.findFirst({
          where: {
            title: mbArtistName
          }
        });
      }
      
      // If we found a matching artist, link it
      if (matchingArtist) {
        updateData.parentRatingKey = matchingArtist.ratingKey;
      }
      
      // Store album artist from MusicBrainz
      updateData.albumArtist = mbArtistName;
    }

    const updatedAlbum = await this.prisma.plexAlbum.update({
      where: { ratingKey },
      data: updateData
    });

    await this.applyReleaseTrackMetadata(album, metadata, trackMatchOverrides);

    // Auto-merge albums with the same MusicBrainz ID
    await this.autoMergeAlbumsByMusicBrainzId(metadata.id);

    return updatedAlbum;
  }

  /**
   * Auto-merge albums with the same MusicBrainz ID
   * @param {string} musicBrainzId - MusicBrainz ID to match
   */
  async autoMergeAlbumsByMusicBrainzId(musicBrainzId) {
    // Find all albums with the same MusicBrainz ID
    const albums = await this.prisma.plexAlbum.findMany({
      where: {
        musicBrainzId: musicBrainzId,
        removed: false
      },
      orderBy: [{ addedAt: 'asc' }]
    });

    // If we have more than one album with the same MusicBrainz ID, merge them
    if (albums.length > 1) {
      console.log(`Auto-merging ${albums.length} albums with MusicBrainz ID ${musicBrainzId}`);
      
      const primaryAlbum = albums[0];
      const duplicateAlbums = albums.slice(1);

      // Merge each duplicate album into the primary
      for (const duplicate of duplicateAlbums) {
        // Build merge patch
        const patch = {};
        const copyIfMissing = (field) => {
          if ((primaryAlbum[field] === null || primaryAlbum[field] === undefined || primaryAlbum[field] === '')
            && duplicate[field] !== null
            && duplicate[field] !== undefined
            && duplicate[field] !== '') {
            patch[field] = duplicate[field];
            primaryAlbum[field] = duplicate[field];
          }
        };

        [
          'titleSort',
          'summary',
          'year',
          'thumb',
          'art',
          'parentThumb',
          'originallyAvailableAt',
          'musicBrainzReleaseDate',
          'musicBrainzCountry',
          'musicBrainzStatus',
          'musicBrainzPackaging',
          'musicBrainzLabel',
          'musicBrainzBarcode',
          'musicBrainzAsin',
          'albumArtist',
          'workId',
          'userTitle',
          'userReleaseDate',
          'userLabel',
          'metadataPreferences',
          'identificationStatus',
          'identificationConfidence',
          'lastIdentificationAttempt',
        ].forEach(copyIfMissing);

        const mergeCollections = (primaryCollections, duplicateCollections) => {
          const parseCollections = (str) => {
            try {
              return JSON.parse(str || '[]');
            } catch {
              return [];
            }
          };

          const merged = [...new Set([...parseCollections(primaryCollections), ...parseCollections(duplicateCollections)])];
          return merged.length > 0 ? JSON.stringify(merged) : null;
        };

        const mergedCollections = mergeCollections(primaryAlbum.collections, duplicate.collections);
        if (mergedCollections && mergedCollections !== primaryAlbum.collections) {
          patch.collections = mergedCollections;
          primaryAlbum.collections = mergedCollections;
        }

        // Update primary album with merged data
        if (Object.keys(patch).length > 0) {
          await this.prisma.plexAlbum.update({
            where: { ratingKey: primaryAlbum.ratingKey },
            data: patch
          });
        }

        // Transfer tracks from duplicate to primary
        const trackUpdateData = { parentRatingKey: primaryAlbum.ratingKey };
        if (primaryAlbum.parentRatingKey) {
          trackUpdateData.grandparentRatingKey = primaryAlbum.parentRatingKey;
        }

        await this.prisma.plexTrack.updateMany({
          where: { parentRatingKey: duplicate.ratingKey },
          data: trackUpdateData
        });

        // Delete duplicate album
        await this.prisma.plexAlbum.delete({
          where: { ratingKey: duplicate.ratingKey }
        });

        console.log(`Merged album "${duplicate.title}" into "${primaryAlbum.title}"`);
      }
    }
  }

  /**
   * Auto-merge artists with the same MusicBrainz ID
   * @param {string} musicBrainzId - MusicBrainz ID to match
   */
  async autoMergeArtistsByMusicBrainzId(musicBrainzId) {
    // Find all artists with the same MusicBrainz ID
    const artists = await this.prisma.plexArtist.findMany({
      where: {
        musicBrainzId: musicBrainzId,
        removed: false
      },
      orderBy: [{ addedAt: 'asc' }]
    });

    // If we have more than one artist with the same MusicBrainz ID, merge them
    if (artists.length > 1) {
      console.log(`Auto-merging ${artists.length} artists with MusicBrainz ID ${musicBrainzId}`);
      
      const primaryArtist = artists[0];
      const duplicateArtists = artists.slice(1);

      // Merge each duplicate artist into the primary
      for (const duplicate of duplicateArtists) {
        // Build merge patch
        const patch = {};
        const copyIfMissing = (field) => {
          if ((primaryArtist[field] === null || primaryArtist[field] === undefined || primaryArtist[field] === '')
            && duplicate[field] !== null
            && duplicate[field] !== undefined
            && duplicate[field] !== '') {
            patch[field] = duplicate[field];
            primaryArtist[field] = duplicate[field];
          }
        };

        [
          'titleSort',
          'summary',
          'thumb',
          'art',
          'musicBrainzCountry',
          'musicBrainzBeginDate',
          'musicBrainzEndDate',
          'musicBrainzEnded',
          'musicBrainzAliases',
          'musicBrainzLinks',
          'userTitle',
          'userSortName',
          'userBiography',
          'userCountry',
          'metadataPreferences',
          'identificationStatus',
          'identificationConfidence',
          'lastIdentificationAttempt',
        ].forEach(copyIfMissing);

        const mergeCollections = (primaryCollections, duplicateCollections) => {
          const parseCollections = (str) => {
            try {
              return JSON.parse(str || '[]');
            } catch {
              return [];
            }
          };

          const merged = [...new Set([...parseCollections(primaryCollections), ...parseCollections(duplicateCollections)])];
          return merged.length > 0 ? JSON.stringify(merged) : null;
        };

        const mergedCollections = mergeCollections(primaryArtist.collections, duplicate.collections);
        if (mergedCollections && mergedCollections !== primaryArtist.collections) {
          patch.collections = mergedCollections;
          primaryArtist.collections = mergedCollections;
        }

        // Update primary artist with merged data
        if (Object.keys(patch).length > 0) {
          await this.prisma.plexArtist.update({
            where: { ratingKey: primaryArtist.ratingKey },
            data: patch
          });
        }

        // Transfer albums from duplicate to primary
        await this.prisma.plexAlbum.updateMany({
          where: { parentRatingKey: duplicate.ratingKey },
          data: { parentRatingKey: primaryArtist.ratingKey }
        });

        // Delete duplicate artist
        await this.prisma.plexArtist.delete({
          where: { ratingKey: duplicate.ratingKey }
        });

        console.log(`Merged artist "${duplicate.title}" into "${primaryArtist.title}"`);
      }
    }
  }

  async applyReleaseTrackMetadata(album, metadata, trackMatchOverrides = []) {
    const releaseTracks = this.flattenReleaseTracks(metadata);

    if (releaseTracks.length === 0 || album.tracks.length === 0) {
      return;
    }

    const overridesByLocalKey = {};
    for (const override of (Array.isArray(trackMatchOverrides) ? trackMatchOverrides : [])) {
      if (override?.localTrackKey && override?.recordingId) {
        overridesByLocalKey[override.localTrackKey] = override.recordingId;
      }
    }

    const matchedTracks = this.matchLocalTracksToReleaseTracks(album.tracks, releaseTracks, overridesByLocalKey);

    const matchedTrackContexts = [];

    for (const { localTrack, releaseTrack } of matchedTracks) {
      const trackWorkContext = await this.resolveTrackWorkContext(releaseTrack);

      matchedTrackContexts.push({
        localTrack,
        releaseTrack,
        trackWorkContext,
      });
    }

    for (const { localTrack, releaseTrack, trackWorkContext } of matchedTrackContexts) {
      await this.applyTrackMetadata(localTrack, releaseTrack, trackWorkContext);
    }
  }

  flattenReleaseTracks(metadata) {
    if (!Array.isArray(metadata?.media)) {
      return [];
    }

    return metadata.media.flatMap((medium, mediumIndex) => {
      const discNumber = Number.parseInt(medium?.position, 10);

      return (medium?.tracks || []).map(track => ({
        ...track,
        mediaTitle: medium?.title || null,
        mediaPosition: medium?.position || null,
        discNumber: Number.isInteger(discNumber) ? discNumber : mediumIndex + 1,
        discTotal: metadata.media.length
      }));
    });
  }

  matchLocalTracksToReleaseTracks(localTracks, releaseTracks, overridesByLocalKey = {}) {
    const matchedLocalTrackKeys = new Set();
    const usedReleaseTracks = new Set();
    const matches = [];

    // Manual overrides take priority: reserve both sides before automatic matching runs.
    for (const localTrack of localTracks) {
      const overrideRecordingId = overridesByLocalKey[localTrack.ratingKey];
      if (!overrideRecordingId) {
        continue;
      }

      const releaseTrack = releaseTracks.find((candidate) => {
        if (usedReleaseTracks.has(candidate)) {
          return false;
        }
        const candidateId = candidate?.recording?.id || candidate?.id || null;
        return candidateId === overrideRecordingId;
      });

      if (releaseTrack) {
        matchedLocalTrackKeys.add(localTrack.ratingKey);
        usedReleaseTracks.add(releaseTrack);
        matches.push({ localTrack, releaseTrack });
      }
    }

    for (let position = 0; position < releaseTracks.length; position += 1) {
      const releaseTrack = releaseTracks[position];
      if (usedReleaseTracks.has(releaseTrack)) {
        continue;
      }

      const releaseIndex = Number.parseInt(releaseTrack.number || releaseTrack.position, 10);
      const releaseTrackId = releaseTrack?.recording?.id || releaseTrack?.id || null;
      const releaseHasTrackId = Boolean(releaseTrackId);
      const releaseHasTrackNumber = Number.isInteger(releaseIndex);
      const releaseDisc = Number.isInteger(releaseTrack.discNumber) ? releaseTrack.discNumber : null;

      const localTrack = localTracks.find(track => {
        if (matchedLocalTrackKeys.has(track.ratingKey)) {
          return false;
        }

        // A disc mismatch only disqualifies a pairing when both sides know their disc, so
        // single-disc releases and tracks synced without a disc number still match on number alone.
        const localDisc = Number.isInteger(track.discNumber) ? track.discNumber : null;
        if (localDisc !== null && releaseDisc !== null && localDisc !== releaseDisc) {
          return false;
        }

        const localTrackId = track.musicBrainzTrackId || null;
        const localTrackIndex = Number.isInteger(track.index) ? track.index : null;

        if (releaseHasTrackId && localTrackId) {
          if (localTrackId !== releaseTrackId) {
            return false;
          }

          if (releaseHasTrackNumber && localTrackIndex !== null) {
            return localTrackIndex === releaseIndex;
          }

          return true;
        }

        if (releaseHasTrackId && !localTrackId) {
          return releaseHasTrackNumber && localTrackIndex === releaseIndex;
        }

        if (releaseHasTrackNumber) {
          return localTrackIndex === releaseIndex;
        }

        return false;
      }) || null;

      if (!localTrack) {
        continue;
      }

      matchedLocalTrackKeys.add(localTrack.ratingKey);
      usedReleaseTracks.add(releaseTrack);
      matches.push({ localTrack, releaseTrack });
    }

    return matches;
  }

  async resolveTrackWorkContext(releaseTrack) {
    let recording = releaseTrack?.recording || null;
    let workRelation = this.findTrackWorkRelation(recording);

    if (!workRelation && recording?.id) {
      try {
        // The release fetch requests recording-level-rels/work-level-rels so this fallback should
        // rarely trigger. Keep a couple of retries (not the default 3) so a transient 503 doesn't
        // lose classical work/composer data, without letting a bad run of tracks stall for minutes.
        recording = await this.musicBrainz.getRecordingDetails(recording.id, 2);
        workRelation = this.findTrackWorkRelation(recording);
      } catch (error) {
        console.warn(`MusicBrainz recording detail lookup failed for ${recording.id}`, error.message);
      }
    }

    return {
      recording,
      workRelation,
    };
  }

  async applyTrackMetadata(localTrack, releaseTrack, options = {}) {
    const {
      recording: resolvedRecording = null,
      workRelation: resolvedWorkRelation = null,
    } = options;
    const recording = resolvedRecording || releaseTrack?.recording || null;
    const workRelation = resolvedWorkRelation || this.findTrackWorkRelation(recording);

    const contributors = this.collectTrackContributors(releaseTrack, recording, workRelation?.work);
    let fallbackComposerKey = localTrack.grandparentRatingKey || null;

    const composerContributor = contributors.find(contributor => contributor.typeNames.includes('Composer'));
    let composerArtist = null;
    if (composerContributor) {
      composerArtist = await this.ensureArtistFromMusicBrainz(composerContributor.artist);
      if (composerArtist?.ratingKey) {
        fallbackComposerKey = composerArtist.ratingKey;
      }
    }

    // Only link a track to a work when MusicBrainz actually provided a recording->work
    // relation. Never synthesize a work from the track's own title.
    const workImport = workRelation
      ? await this.importWorkHierarchy(
          workRelation.work,
          localTrack.ratingKey,
          fallbackComposerKey,
          releaseTrack?.title || recording?.title || localTrack?.title || null,
          releaseTrack?.number || releaseTrack?.position || localTrack?.index || null
        )
      : null;
    const composerNames = this.extractComposerNames(workRelation?.work);

    const trackUpdateData = {
      musicBrainzTrackId: recording?.id || releaseTrack?.id || null,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date(),
      userComposer: composerNames.length > 0 ? composerNames.join(', ') : null,
      workId: workImport?.workId || null
    };

    const releaseTitle = releaseTrack?.title || recording?.title || null;
    if (releaseTitle) {
      trackUpdateData.title = releaseTitle;
      trackUpdateData.titleSort = releaseTitle;
    }

    const releaseTrackNumber = Number.parseInt(releaseTrack?.number ?? releaseTrack?.position, 10);
    if (Number.isInteger(releaseTrackNumber)) {
      trackUpdateData.index = releaseTrackNumber;
    }

    if (Number.isInteger(releaseTrack?.discNumber)) {
      trackUpdateData.discNumber = releaseTrack.discNumber;
    }

    if (Number.isInteger(releaseTrack?.discTotal)) {
      trackUpdateData.discTotal = releaseTrack.discTotal;
    }

    await this.prisma.plexTrack.update({
      where: { ratingKey: localTrack.ratingKey },
      data: trackUpdateData
    });

    if (workImport?.workPartId) {
      await this.prisma.workPartTrack.upsert({
        where: {
          workPartId_trackKey: {
            workPartId: workImport.workPartId,
            trackKey: localTrack.ratingKey
          }
        },
        update: {},
        create: {
          workPartId: workImport.workPartId,
          trackKey: localTrack.ratingKey
        }
      });

      const relationshipTypeNames = [...new Set(
        contributors.flatMap(contributor => contributor.typeNames || [])
      )];

      for (const typeName of relationshipTypeNames) {
        await this.ensureWorkPartArtistTypeAssignmentByName(workImport.workPartId, typeName);
      }
    }

    for (const contributor of contributors) {
      const artist = await this.ensureArtistFromMusicBrainz(contributor.artist);
      if (!artist) {
        continue;
      }

      for (const typeName of contributor.typeNames) {
        await this.ensureTrackArtistAssignment(localTrack.ratingKey, artist.ratingKey, typeName);
        if (localTrack.parentRatingKey) {
          await this.ensureAlbumArtistAssignment(localTrack.parentRatingKey, artist.ratingKey, typeName);
        }
      }
    }
  }

  findTrackWorkRelation(recording) {
    const relationLists = [
      recording?.relations,
      recording?.['relation-list'],
      recording?.['work-relation-list'],
      recording?.['work-rels']
    ].filter(Array.isArray);

    const relations = relationLists.flat();

    return relations.find(relation => relation?.work && relation?.type === 'performance')
      || relations.find(relation => relation?.work)
      || null;
  }

  getEntityRelations(entity) {
    const relationLists = [
      entity?.relations,
      entity?.['relation-list'],
      entity?.['artist-relation-list'],
      entity?.['work-relation-list'],
      entity?.['place-relation-list'],
      entity?.['url-relation-list']
    ].filter(Array.isArray);

    return relationLists.flat();
  }

  shouldExcludeRelationshipType(relationType) {
    if (!relationType) {
      return false;
    }

    const normalized = String(relationType).trim().toLowerCase();
    return normalized === 'engineer'
      || normalized === 'producer'
      || normalized === 'recorded at'
      || normalized === 'recording of';
  }

  shouldExcludeArtistTypeName(typeName) {
    if (!typeName) {
      return true;
    }

    const normalized = String(typeName).trim().toLowerCase();
    return normalized === 'engineer'
      || normalized === 'producer'
      || normalized === 'recorded at'
      || normalized === 'recording of'
      || normalized === 'recording'
      || normalized === 'person'
      || normalized === 'editor'
      || normalized === 'sound';
  }

  isSoloArtistTypeName(typeName) {
    if (!typeName) {
      return false;
    }

    return String(typeName).trim().toLowerCase() === 'solo';
  }

  pruneContributorTypeNames(typeNames) {
    const uniqueTypeNames = [...new Set(
      (typeNames || [])
        .map(typeName => String(typeName || '').trim())
        .filter(Boolean)
    )];

    if (uniqueTypeNames.length === 0) {
      return [];
    }

    const hasSolo = uniqueTypeNames.some(typeName => this.isSoloArtistTypeName(typeName));
    const nonSoloAllowed = uniqueTypeNames.filter(typeName => {
      return !this.isSoloArtistTypeName(typeName) && !this.shouldExcludeArtistTypeName(typeName);
    });

    if (nonSoloAllowed.length > 0) {
      return nonSoloAllowed;
    }

    if (hasSolo) {
      const preferredSolo = uniqueTypeNames.find(typeName => this.isSoloArtistTypeName(typeName)) || 'Solo';
      return [preferredSolo];
    }

    return uniqueTypeNames.filter(typeName => !this.shouldExcludeArtistTypeName(typeName));
  }

  extractComposerNames(work) {
    const workRelations = this.getEntityRelations(work);

    if (workRelations.length === 0) {
      return [];
    }

    return [...new Set(
      workRelations
        .filter(relation => relation?.type === 'composer' && relation?.artist?.name)
        .map(relation => relation.artist.name)
    )];
  }

  collectTrackContributors(releaseTrack, recording, work) {
    const assignments = new Map();

    const addContributor = (artist, typeNames) => {
      if (!artist?.id || typeNames.length === 0) {
        return;
      }

      const key = artist.id;
      const existing = assignments.get(key) || {
        artist,
        typeNames: new Set()
      };

      typeNames
        .filter(Boolean)
        .map(typeName => String(typeName).trim())
        .filter(Boolean)
        .forEach(typeName => existing.typeNames.add(typeName));
      assignments.set(key, existing);
    };

    for (const relation of this.getEntityRelations(recording)) {
      if (!relation?.artist) {
        continue;
      }

      if (this.shouldExcludeRelationshipType(relation.type)) {
        continue;
      }

      addContributor(relation.artist, this.mapArtistTypeNames(relation.type, relation.artist, relation.attributes || []));
    }

    for (const credit of recording?.['artist-credit'] || []) {
      if (!credit?.artist) {
        continue;
      }

      addContributor(credit.artist, this.mapArtistTypeNames(null, credit.artist, []));
    }

    for (const credit of releaseTrack?.['artist-credit'] || []) {
      if (!credit?.artist) {
        continue;
      }

      const typeNames = this.shouldAssignComposerArtistType(credit.artist)
        ? ['Composer']
        : this.mapArtistTypeNames(null, credit.artist, []);

      addContributor(credit.artist, typeNames);
    }

    for (const relation of this.getEntityRelations(work)) {
      if (!relation?.artist) {
        continue;
      }

      if (this.shouldExcludeRelationshipType(relation.type)) {
        continue;
      }

      if (relation.type === 'composer') {
        addContributor(relation.artist, ['Composer']);
        continue;
      }

      addContributor(relation.artist, this.mapArtistTypeNames(relation.type, relation.artist, relation.attributes || []));
    }

    return [...assignments.values()]
      .map(entry => ({
        artist: entry.artist,
        typeNames: this.pruneContributorTypeNames([...entry.typeNames])
      }))
      .filter(entry => entry.typeNames.length > 0);
  }

  mapArtistTypeNames(relationType, artist, attributes) {
    if (relationType === 'conductor') {
      return ['Conductor'];
    }

    if (relationType === 'performing orchestra' || artist?.type === 'Orchestra') {
      return ['Orchestra'];
    }

    if (relationType === 'composer' || this.shouldAssignComposerArtistType(artist)) {
      return ['Composer'];
    }

    if (relationType === 'instrument') {
      const instrumentTypes = attributes
        .map(attribute => this.formatArtistTypeName(attribute))
        .filter(Boolean);

      return instrumentTypes.length > 0 ? instrumentTypes : ['Instrument'];
    }

    if (relationType) {
      return [this.formatArtistTypeName(relationType)];
    }

    if (artist?.type) {
      return [this.formatArtistTypeName(artist.type)];
    }

    return ['Performer'];
  }

  formatArtistTypeName(value) {
    if (!value) {
      return null;
    }

    return String(value)
      .split(/[-\s]+/)
      .filter(Boolean)
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  async importWorkHierarchy(work, trackKey, fallbackComposerKey = null, fallbackPartTitle = null, fallbackPartOrder = null) {
    if (!work) {
      return null;
    }

    const workRelations = this.getEntityRelations(work);
    const composerRelation = workRelations.find(relation => relation?.type === 'composer' && relation?.artist);
    const composerArtist = composerRelation?.artist ? await this.ensureArtistFromMusicBrainz(composerRelation.artist) : null;
    const parentRelation = workRelations.find(relation => relation?.type === 'parts' && relation?.direction === 'backward' && relation?.work);
    const relatedWorkRelation = workRelations.find(relation => {
      return relation?.work && relation?.type === 'related works';
    });
    let effectiveComposerKey = composerArtist?.ratingKey || fallbackComposerKey || null;

    if (!effectiveComposerKey) {
      effectiveComposerKey = await this.ensureFallbackComposerArtistKey();
    }

    const primaryWork = parentRelation?.work || relatedWorkRelation?.work || work;
    const workRecord = await this.ensureWorkRecord(primaryWork, effectiveComposerKey);

    if (!workRecord) {
      return null;
    }

    if (composerArtist?.ratingKey) {
      await this.ensureArtistTypeAssignmentByName(composerArtist.ratingKey, 'Composer');
    }

    if (!parentRelation?.work) {
      const inferredPartTitle = fallbackPartTitle || work.title || null;
      const inferredPartOrder = Number.parseInt(fallbackPartOrder, 10);

      const inferredWorkPart = inferredPartTitle
        ? await this.ensureWorkPartRecord(
            workRecord.id,
            inferredPartTitle,
            Number.isInteger(inferredPartOrder) ? inferredPartOrder : 1
          )
        : null;

      return {
        workId: workRecord.id,
        workPartId: inferredWorkPart?.id || null
      };
    }

    const workPart = await this.ensureWorkPartRecord(
      workRecord.id,
      work.title,
      parentRelation['ordering-key'] || 1
    );

    return {
      workId: workRecord.id,
      workPartId: workPart?.id || null
    };
  }

  async ensureWorkRecord(work, composerKey) {
    if (!work?.id && !work?.title) {
      return null;
    }

    let existing = null;

    if (work?.id) {
      existing = await this.prisma.work.findFirst({
        where: { musicBrainzWorkId: work.id }
      });
    }

    if (!existing && work?.title) {
      existing = await this.prisma.work.findFirst({
        where: {
          title: work.title,
          ...(composerKey ? { composerKey } : {})
        }
      });
    }

    const data = {
      title: work.title,
      composerKey,
      musicBrainzWorkId: work.id || null,
      identificationStatus: 'identified',
      identificationConfidence: 1.0
    };

    if (existing) {
      return await this.prisma.work.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          composerKey: composerKey || existing.composerKey,
          musicBrainzWorkId: data.musicBrainzWorkId,
          identificationStatus: data.identificationStatus,
          identificationConfidence: data.identificationConfidence
        }
      });
    }

    return await this.prisma.work.create({
      data
    });
  }

  async ensureFallbackComposerArtistKey() {
    const fallbackRatingKey = 'mb-artist:unknown-composer';

    const existing = await this.prisma.plexArtist.findUnique({
      where: { ratingKey: fallbackRatingKey }
    });

    if (existing) {
      return existing.ratingKey;
    }

    const created = await this.prisma.plexArtist.create({
      data: {
        ratingKey: fallbackRatingKey,
        key: `/library/metadata/${fallbackRatingKey}`,
        title: 'Unknown Composer',
        titleSort: 'Unknown Composer',
        identificationStatus: 'identified',
        identificationConfidence: 0.5,
        lastIdentificationAttempt: new Date()
      }
    });

    await this.ensureArtistTypeAssignmentByName(created.ratingKey, 'Composer');

    return created.ratingKey;
  }

  async ensureWorkPartRecord(workId, title, order) {
    const existing = await this.prisma.workPart.findFirst({
      where: {
        workId,
        title
      }
    });

    if (existing) {
      return await this.prisma.workPart.update({
        where: { id: existing.id },
        data: {
          order: order || existing.order
        }
      });
    }

    return await this.prisma.workPart.create({
      data: {
        workId,
        title,
        order: order || 1
      }
    });
  }

  async ensureArtistFromMusicBrainz(artist) {
    if (!artist?.name) {
      return null;
    }

    // The same composer/conductor/ensemble is usually referenced by every track on a release,
    // so cache the resolved record per MusicBrainz ID to avoid a network + DB round trip per track.
    const cacheKey = artist.id || null;
    if (cacheKey && this.artistResolutionCache.has(cacheKey)) {
      return this.artistResolutionCache.get(cacheKey);
    }

    let resolvedArtist = artist;
    const rawName = String(artist.name || '').trim();
    const nameLooksNonLatin = /[\u0400-\u04FF\u0370-\u03FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/.test(rawName);
    const hasAliasesInPayload = Array.isArray(artist.aliases) && artist.aliases.length > 0;

    // Relationship payloads often contain a non-canonical Latin alias and no alias list.
    // Pull full artist details in those cases so locale/primary alias ranking can run.
    if (artist.id && (nameLooksNonLatin || !hasAliasesInPayload)) {
      try {
        // Bounded retries: this can be called for many distinct contributors on a classical
        // release, so don't let the default retry/backoff policy multiply into a long stall.
        const fullArtist = await this.musicBrainz.getArtist(artist.id, 2);
        if (fullArtist?.name) {
          resolvedArtist = {
            ...artist,
            ...fullArtist,
            id: artist.id || fullArtist.id
          };
        }
      } catch (error) {
        console.warn(`MusicBrainz artist detail lookup failed for ${artist.id}`, error.message);
      }
    }

    const preferredName = getPreferredMusicBrainzArtistName(resolvedArtist) || resolvedArtist.name || artist.name;
    const preferredSortName = resolvedArtist['sort-name'] || resolvedArtist['sortName'] || resolvedArtist.sortName || null;

    let existingArtist = resolvedArtist.id
      ? await this.prisma.plexArtist.findFirst({
          where: { musicBrainzId: resolvedArtist.id }
        })
      : null;

    if (!existingArtist) {
      existingArtist = await this.prisma.plexArtist.findFirst({
        where: {
          OR: [
            { title: preferredName },
            { title: artist.name },
            preferredSortName ? { title: preferredSortName } : null
          ].filter(Boolean)
        }
      });
    }

    const artistData = {
      title: preferredName,
      titleSort: preferredSortName || preferredName,
      musicBrainzId: resolvedArtist.id || null,
      musicBrainzCountry: resolvedArtist.country || null,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

    if (Array.isArray(resolvedArtist.aliases) && resolvedArtist.aliases.length > 0) {
      artistData.musicBrainzAliases = JSON.stringify(
        resolvedArtist.aliases.map((alias) => ({
          name: alias.name,
          sortName: alias['sort-name'] || null,
          locale: alias.locale || null,
          type: alias.type || null,
          primary: typeof alias.primary === 'boolean' ? alias.primary : null
        }))
      );
    }

    let resolvedResult;
    if (existingArtist) {
      resolvedResult = await this.prisma.plexArtist.update({
        where: { ratingKey: existingArtist.ratingKey },
        data: artistData
      });
    } else {
      const syntheticKeySource = preferredName || resolvedArtist.name || artist.name;
      const syntheticKey = resolvedArtist.id ? `mb-artist:${resolvedArtist.id}` : `mb-artist:${syntheticKeySource.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      resolvedResult = await this.prisma.plexArtist.create({
        data: {
          ratingKey: syntheticKey,
          key: `/library/metadata/${syntheticKey}`,
          ...artistData
        }
      });
    }

    if (cacheKey) {
      this.artistResolutionCache.set(cacheKey, resolvedResult);
    }

    return resolvedResult;
  }

  async ensureTrackArtistAssignment(trackKey, artistKey, typeName) {
    const trimmedTypeName = typeName.trim();

    let artistType = await this.prisma.artistType.findUnique({
      where: { name: trimmedTypeName }
    });

    if (!artistType) {
      artistType = await this.prisma.artistType.create({
        data: {
          name: trimmedTypeName,
          description: `${trimmedTypeName} artists`
        }
      });
    }

    await this.ensureArtistTypeAssignmentByName(artistKey, trimmedTypeName);

    const existingAssignment = await this.prisma.trackArtist.findFirst({
      where: {
        trackKey,
        artistKey,
        artistTypeId: artistType.id
      }
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    return await this.prisma.trackArtist.create({
      data: {
        trackKey,
        artistKey,
        artistTypeId: artistType.id
      }
    });
  }

  async ensureAlbumArtistAssignment(albumKey, artistKey, typeName) {
    const trimmedTypeName = typeName.trim();

    if (this.shouldExcludeArtistTypeName(trimmedTypeName)) {
      return null;
    }

    let artistType = await this.prisma.artistType.findUnique({
      where: { name: trimmedTypeName }
    });

    if (!artistType) {
      artistType = await this.prisma.artistType.create({
        data: {
          name: trimmedTypeName,
          description: `${trimmedTypeName} artists`
        }
      });
    }

    await this.ensureArtistTypeAssignmentByName(artistKey, trimmedTypeName);

    return await this.prisma.albumArtist.upsert({
      where: {
        albumKey_artistKey_artistTypeId: {
          albumKey,
          artistKey,
          artistTypeId: artistType.id
        }
      },
      update: {},
      create: {
        albumKey,
        artistKey,
        artistTypeId: artistType.id
      }
    });
  }

  async ensureWorkPartArtistTypeAssignmentByName(workPartId, typeName) {
    const trimmedTypeName = typeName.trim();

    if (this.shouldExcludeArtistTypeName(trimmedTypeName)) {
      return null;
    }

    let artistType = await this.prisma.artistType.findUnique({
      where: { name: trimmedTypeName }
    });

    if (!artistType) {
      artistType = await this.prisma.artistType.create({
        data: {
          name: trimmedTypeName,
          description: `${trimmedTypeName} artists`
        }
      });
    }

    return await this.prisma.workPartArtistType.upsert({
      where: {
        workPartId_artistTypeId: {
          workPartId,
          artistTypeId: artistType.id
        }
      },
      update: {},
      create: {
        workPartId,
        artistTypeId: artistType.id
      }
    });
  }

  /**
   * Apply MusicBrainz metadata to artist
   * @private
   */
  async applyArtistMetadata(ratingKey, metadata) {
    const preferredName = getPreferredMusicBrainzArtistName(metadata) || metadata.name;
    const preferredSortName = metadata['sort-name'] || metadata['sortName'] || metadata.sortName || preferredName;

    const updateData = {
      musicBrainzId: metadata.id,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

    if (preferredName) {
      updateData.title = preferredName;
    }

    // Extract relevant MusicBrainz fields that exist in schema
    if (metadata.country) {
      updateData.musicBrainzCountry = metadata.country;
    }
    if (preferredSortName) {
      updateData.titleSort = preferredSortName;
    }
    if (metadata['life-span']?.begin) {
      updateData.musicBrainzBeginDate = metadata['life-span'].begin;
    }
    if (metadata['life-span']?.end) {
      updateData.musicBrainzEndDate = metadata['life-span'].end;
    }
    if (typeof metadata['life-span']?.ended === 'boolean') {
      updateData.musicBrainzEnded = metadata['life-span'].ended;
    }
    if (Array.isArray(metadata.aliases) && metadata.aliases.length > 0) {
      updateData.musicBrainzAliases = JSON.stringify(
        metadata.aliases.map(alias => ({
          name: alias.name,
          sortName: alias['sort-name'] || null,
          locale: alias.locale || null,
          type: alias.type || null,
          primary: typeof alias.primary === 'boolean' ? alias.primary : null
        }))
      );
    }
    if (Array.isArray(metadata.relations) && metadata.relations.length > 0) {
      updateData.musicBrainzLinks = JSON.stringify(
        metadata.relations.map(relation => ({
          url: relation.url?.resource || null
        })).filter(relation => relation.url)
      );
    }

    const updatedArtist = await this.prisma.plexArtist.update({
      where: { ratingKey },
      data: updateData
    });

    // Auto-merge artists with the same MusicBrainz ID
    if (metadata.id) {
      await this.autoMergeArtistsByMusicBrainzId(metadata.id);
    }

    if (this.shouldAssignComposerArtistType(metadata)) {
      await this.ensureArtistTypeAssignmentByName(ratingKey, 'Composer');
    }

    return updatedArtist;
  }

  shouldAssignComposerArtistType(metadata) {
    const summaryText = [
      metadata?.disambiguation,
      metadata?.annotation,
      metadata?.summary,
      metadata?.['artist-summary']
    ].filter(Boolean).join(' ');

    const typeText = [
      metadata?.type,
      metadata?.['type-id']
    ].filter(Boolean).join(' ');

    const tagText = [
      ...(Array.isArray(metadata?.tags) ? metadata.tags.map(tag => tag?.name).filter(Boolean) : []),
      ...(Array.isArray(metadata?.genres) ? metadata.genres.map(genre => genre?.name).filter(Boolean) : [])
    ].join(' ');

    return /\bcomposer\b/i.test(`${summaryText} ${typeText} ${tagText}`);
  }

  async ensureArtistTypeAssignmentByName(artistKey, typeName) {
    const trimmedName = typeName.trim();

    let artistType = await this.prisma.artistType.findUnique({
      where: { name: trimmedName }
    });

    if (!artistType) {
      artistType = await this.prisma.artistType.create({
        data: {
          name: trimmedName,
          description: `${trimmedName} artists`
        }
      });
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.artistTypeAssignment.findFirst({
      where: {
        artistKey: artistKey,
        artistTypeId: artistType.id
      }
    });

    if (!existingAssignment) {
      await this.prisma.artistTypeAssignment.create({
        data: {
          artistKey,
          artistTypeId: artistType.id
        }
      });
    }
  }

  /**
   * Calculate confidence score for album match
   * @private
   */
  calculateAlbumConfidence(localAlbum, mbResult) {
    let confidence = 0;

    // Title match (40 points)
    const titleSimilarity = this.stringSimilarity(
      this.normalizeString(localAlbum.title),
      this.normalizeString(mbResult.title)
    );
    confidence += titleSimilarity * 40;

    // Artist match (30 points)
    const mbArtistName = mbResult['artist-credit']?.[0]?.name;
    let artistSimilarity = 0;
    if (localAlbum.artist?.title && mbArtistName) {
      const normalizedMbArtist = this.normalizeString(mbArtistName);
      // Compare against the unsorted form too, since Plex stores "Family, Given" sort names.
      artistSimilarity = Math.max(
        ...[localAlbum.artist.title, unsortMusicBrainzName(localAlbum.artist.title)]
          .filter(Boolean)
          .map((name) => this.stringSimilarity(this.normalizeString(name), normalizedMbArtist))
      );
      confidence += artistSimilarity * 30;
    }

    // Year match (15 points)
    if (localAlbum.year && mbResult.date) {
      const mbYear = parseInt(mbResult.date.split('-')[0]);
      if (localAlbum.year === mbYear) {
        confidence += 15;
      } else if (Math.abs(localAlbum.year - mbYear) <= 1) {
        confidence += 10; // Close enough
      }
    }

    // Track count match (10 points)
    if (localAlbum.leafCount && mbResult['track-count']) {
      const countDiff = Math.abs(localAlbum.leafCount - mbResult['track-count']);
      if (countDiff === 0) {
        confidence += 10;
      } else if (countDiff <= 2) {
        confidence += 5;
      }
    }

    // Exact title + artist match bonus (5 points)
    if (titleSimilarity > 0.95 && artistSimilarity > 0.95) {
      confidence += 5;
    }

    return Math.min(confidence / 100, 1.0); // Normalize to 0-1
  }

  /**
   * Calculate confidence score for artist match
   * @private
   */
  calculateArtistConfidence(localArtist, mbResult) {
    let confidence = 0;

    // Name match (60 points)
    const nameSimilarity = this.stringSimilarity(
      this.normalizeString(localArtist.title),
      this.normalizeString(mbResult.name)
    );
    confidence += nameSimilarity * 60;

    // Country match (20 points)
    if (localArtist.musicBrainzCountry && mbResult.country) {
      if (localArtist.musicBrainzCountry === mbResult.country) {
        confidence += 20;
      }
    }

    // Disambiguation helps if present (10 points)
    if (mbResult.disambiguation) {
      // Having disambiguation is good - means it's well-documented
      confidence += 10;
    }

    // Sort name consistency (10 points)
    if (localArtist.titleSort && mbResult['sort-name']) {
      const sortSimilarity = this.stringSimilarity(
        this.normalizeString(localArtist.titleSort),
        this.normalizeString(mbResult['sort-name'])
      );
      confidence += sortSimilarity * 10;
    }

    return Math.min(confidence / 100, 1.0);
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   * @private
   */
  stringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   * @private
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Normalize string for comparison
   * @private
   */
  normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }

  /**
   * Get pending candidates for an entity
   * @param {string} entityType
   * @param {string} entityKey
   * @returns {Promise<Array>}
   */
  async getPendingCandidates(entityType, entityKey) {
    return await this.prisma.identificationCandidate.findMany({
      where: {
        entityType,
        entityKey,
        status: 'pending'
      },
      orderBy: {
        confidence: 'desc'
      }
    });
  }

  /**
   * Reject a candidate
   * @param {number} candidateId
   */
  async rejectCandidate(candidateId) {
    await this.prisma.identificationCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'rejected',
        reviewedAt: new Date()
      }
    });
  }

  /**
   * Mark entity as manually identified (no MusicBrainz match)
   * @param {string} entityType
   * @param {string} entityKey
   */
  async markAsManual(entityType, entityKey) {
    const models = {
      artist: this.prisma.plexArtist,
      album: this.prisma.plexAlbum,
      track: this.prisma.plexTrack
    };

    const model = models[entityType];
    if (!model) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    await model.update({
      where: { ratingKey: entityKey },
      data: {
        identificationStatus: 'manual',
        identificationConfidence: null,
        lastIdentificationAttempt: new Date()
      }
    });

    // Reject all pending candidates
    await this.prisma.identificationCandidate.updateMany({
      where: {
        entityType,
        entityKey,
        status: 'pending'
      },
      data: {
        status: 'rejected',
        reviewedAt: new Date()
      }
    });
  }
}

module.exports = IdentificationService;

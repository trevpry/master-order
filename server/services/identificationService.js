const { PrismaClient } = require('@prisma/client');
const MusicBrainzService = require('./musicBrainzService');

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
  }

  /**
   * Search MusicBrainz for album matches
   * @param {string} ratingKey - Album's ratingKey
   * @returns {Promise<Array>} Array of candidates with confidence scores
   */
  async identifyAlbum(ratingKey) {
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
            status: 'pending'
          }
        });

        candidates.push(candidate);
      } catch (error) {
        console.warn(`MusicBrainz direct album lookup failed for ${album.musicBrainzId}, falling back to search`, error.message);
      }
    }

    if (candidates.length === 0) {
      // Search MusicBrainz when no stored MusicBrainz album ID is available or lookup fails
      const searchResults = await this.musicBrainz.searchRelease(
        album.title,
        album.artist?.title
      );

      // Calculate confidence scores and store candidates
      for (const result of searchResults.slice(0, 10)) { // Top 10 matches
        const confidence = this.calculateAlbumConfidence(album, result);
        
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
            status: 'pending'
          }
        });

        candidates.push(candidate);
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
   * @returns {Promise<Array>} Array of candidates with confidence scores
   */
  async identifyArtist(ratingKey) {
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

    // Clear pending candidates
    await this.prisma.identificationCandidate.deleteMany({
      where: {
        entityType: 'artist',
        entityKey: ratingKey,
        status: 'pending'
      }
    });

    // Search MusicBrainz
    const searchResults = await this.musicBrainz.searchArtist(artist.title);

    // Calculate confidence and store candidates
    const candidates = [];
    for (const result of searchResults.slice(0, 10)) {
      const confidence = this.calculateArtistConfidence(artist, result);
      
      const candidate = await this.prisma.identificationCandidate.create({
        data: {
          entityType: 'artist',
          entityKey: ratingKey,
          musicBrainzId: result.id,
          title: result.name,
          artist: null,
          releaseDate: null,
          confidence,
          metadata: JSON.stringify(result),
          status: 'pending'
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

    // Cache the metadata
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day cache

    await this.prisma.musicBrainzMetadataCache.upsert({
      where: { musicBrainzId: candidate.musicBrainzId },
      create: {
        musicBrainzId: candidate.musicBrainzId,
        entityType: candidate.entityType,
        metadata: JSON.stringify(fullMetadata),
        expiresAt
      },
      update: {
        metadata: JSON.stringify(fullMetadata),
        lastFetched: new Date(),
        expiresAt
      }
    });

    // Update entity with MusicBrainz ID and metadata
    let updatedEntity;
    if (candidate.entityType === 'album') {
      updatedEntity = await this.applyAlbumMetadata(candidate.entityKey, fullMetadata);
    } else if (candidate.entityType === 'artist') {
      updatedEntity = await this.applyArtistMetadata(candidate.entityKey, fullMetadata);
    }

    // Mark candidate as accepted
    await this.prisma.identificationCandidate.update({
      where: { id: candidateId },
      data: {
        status: 'accepted',
        reviewedAt: new Date()
      }
    });

    // Mark other candidates as rejected
    await this.prisma.identificationCandidate.updateMany({
      where: {
        entityType: candidate.entityType,
        entityKey: candidate.entityKey,
        id: { not: candidateId },
        status: 'pending'
      },
      data: {
        status: 'rejected',
        reviewedAt: new Date()
      }
    });

    return updatedEntity;
  }

  /**
   * Apply MusicBrainz metadata to album
   * @private
   */
  async applyAlbumMetadata(ratingKey, metadata) {
    const album = await this.prisma.plexAlbum.findUnique({
      where: { ratingKey },
      include: {
        artist: true,
        tracks: {
          orderBy: [
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

    await this.applyReleaseTrackMetadata(album, metadata);

    return updatedAlbum;
  }

  async applyReleaseTrackMetadata(album, metadata) {
    const releaseTracks = this.flattenReleaseTracks(metadata);

    if (releaseTracks.length === 0 || album.tracks.length === 0) {
      return;
    }

    const matchedTracks = this.matchLocalTracksToReleaseTracks(album.tracks, releaseTracks);

    const matchedTrackContexts = [];
    let albumHasExplicitWorkRelation = false;

    for (const { localTrack, releaseTrack } of matchedTracks) {
      const trackWorkContext = await this.resolveTrackWorkContext(releaseTrack);
      if (trackWorkContext.workRelation) {
        albumHasExplicitWorkRelation = true;
      }

      matchedTrackContexts.push({
        localTrack,
        releaseTrack,
        trackWorkContext,
      });
    }

    for (const { localTrack, releaseTrack, trackWorkContext } of matchedTrackContexts) {
      await this.applyTrackMetadata(localTrack, releaseTrack, {
        ...trackWorkContext,
        allowFallbackSingleTrackWork: albumHasExplicitWorkRelation,
      });
    }
  }

  flattenReleaseTracks(metadata) {
    if (!Array.isArray(metadata?.media)) {
      return [];
    }

    return metadata.media.flatMap(medium => (medium?.tracks || []).map(track => ({
      ...track,
      mediaTitle: medium?.title || null,
      mediaPosition: medium?.position || null
    })));
  }

  matchLocalTracksToReleaseTracks(localTracks, releaseTracks) {
    const matchedLocalTrackKeys = new Set();
    const matches = [];

    for (let position = 0; position < releaseTracks.length; position += 1) {
      const releaseTrack = releaseTracks[position];
      const releaseIndex = Number.parseInt(releaseTrack.number || releaseTrack.position, 10);
      const releaseTrackId = releaseTrack?.recording?.id || releaseTrack?.id || null;
      const releaseHasTrackId = Boolean(releaseTrackId);
      const releaseHasTrackNumber = Number.isInteger(releaseIndex);

      const localTrack = localTracks.find(track => {
        if (matchedLocalTrackKeys.has(track.ratingKey)) {
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
      matches.push({ localTrack, releaseTrack });
    }

    return matches;
  }

  async resolveTrackWorkContext(releaseTrack) {
    let recording = releaseTrack?.recording || null;
    let workRelation = this.findTrackWorkRelation(recording);

    if (!workRelation && recording?.id) {
      try {
        recording = await this.musicBrainz.getRecordingDetails(recording.id);
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

  async createFallbackSingleTrackWorkImport(localTrack, releaseTrack, recording, fallbackComposerKey) {
    const inferredWorkTitle = recording?.title || releaseTrack?.title || localTrack?.title || null;

    if (!inferredWorkTitle) {
      return null;
    }

    const effectiveComposerKey = fallbackComposerKey || await this.ensureFallbackComposerArtistKey();
    const workRecord = await this.ensureWorkRecord({ title: inferredWorkTitle }, effectiveComposerKey);

    if (!workRecord) {
      return null;
    }

    const partOrder = Number.parseInt(
      releaseTrack?.number || releaseTrack?.position || localTrack?.index || 1,
      10
    );
    const workPart = await this.ensureWorkPartRecord(
      workRecord.id,
      inferredWorkTitle,
      Number.isInteger(partOrder) ? partOrder : 1
    );

    return {
      workId: workRecord.id,
      workPartId: workPart?.id || null,
    };
  }

  async applyTrackMetadata(localTrack, releaseTrack, options = {}) {
    const {
      recording: resolvedRecording = null,
      workRelation: resolvedWorkRelation = null,
      allowFallbackSingleTrackWork = false,
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

    const shouldCreateFallbackSingleTrackWork = allowFallbackSingleTrackWork || (
      composerArtist?.ratingKey
      && localTrack.grandparentRatingKey
      && composerArtist.ratingKey === localTrack.grandparentRatingKey
    );

    const workImport = workRelation
      ? await this.importWorkHierarchy(
          workRelation.work,
          localTrack.ratingKey,
          fallbackComposerKey,
          releaseTrack?.title || recording?.title || localTrack?.title || null,
          releaseTrack?.number || releaseTrack?.position || localTrack?.index || null
        )
      : shouldCreateFallbackSingleTrackWork
        ? await this.createFallbackSingleTrackWorkImport(
            localTrack,
            releaseTrack,
            recording,
            fallbackComposerKey
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

    let existingArtist = artist.id
      ? await this.prisma.plexArtist.findFirst({
          where: { musicBrainzId: artist.id }
        })
      : null;

    if (!existingArtist) {
      existingArtist = await this.prisma.plexArtist.findFirst({
        where: { title: artist.name }
      });
    }

    const artistData = {
      title: artist.name,
      titleSort: artist['sort-name'] || artist['sortName'] || artist.sortName || null,
      musicBrainzId: artist.id || null,
      musicBrainzCountry: artist.country || null,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

    if (existingArtist) {
      return await this.prisma.plexArtist.update({
        where: { ratingKey: existingArtist.ratingKey },
        data: artistData
      });
    }

    const syntheticKey = artist.id ? `mb-artist:${artist.id}` : `mb-artist:${artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    return await this.prisma.plexArtist.create({
      data: {
        ratingKey: syntheticKey,
        key: `/library/metadata/${syntheticKey}`,
        ...artistData
      }
    });
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
    const updateData = {
      musicBrainzId: metadata.id,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

    // Extract relevant MusicBrainz fields that exist in schema
    if (metadata.country) {
      updateData.musicBrainzCountry = metadata.country;
    }
    if (metadata['sort-name']) {
      updateData.titleSort = metadata['sort-name'];
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
          type: relation.type || null,
          url: relation.url?.resource || null
        })).filter(relation => relation.url)
      );
    }

    const updatedArtist = await this.prisma.plexArtist.update({
      where: { ratingKey },
      data: updateData
    });

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

    await this.prisma.artistTypeAssignment.upsert({
      where: {
        artistKey_artistTypeId: {
          artistKey,
          artistTypeId: artistType.id
        }
      },
      update: {},
      create: {
        artistKey,
        artistTypeId: artistType.id
      }
    });
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
    if (localAlbum.artist && mbResult['artist-credit']?.[0]?.name) {
      const artistSimilarity = this.stringSimilarity(
        this.normalizeString(localAlbum.artist.title),
        this.normalizeString(mbResult['artist-credit'][0].name)
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
    if (titleSimilarity > 0.95 && localAlbum.artist && mbResult['artist-credit']?.[0]?.name) {
      const artistSimilarity = this.stringSimilarity(
        this.normalizeString(localAlbum.artist.title),
        this.normalizeString(mbResult['artist-credit'][0].name)
      );
      if (artistSimilarity > 0.95) {
        confidence += 5;
      }
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

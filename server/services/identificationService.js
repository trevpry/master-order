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

    // Search MusicBrainz
    const searchResults = await this.musicBrainz.searchRelease(
      album.title,
      album.artist?.title
    );

    // Calculate confidence scores and store candidates
    const candidates = [];
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
    const updateData = {
      musicBrainzId: metadata.id,
      identificationStatus: 'identified',
      identificationConfidence: 1.0,
      lastIdentificationAttempt: new Date()
    };

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

    return await this.prisma.plexAlbum.update({
      where: { ratingKey },
      data: updateData
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
      updateData.country = metadata.country;
    }
    if (metadata['sort-name']) {
      updateData.sortTitle = metadata['sort-name'];
    }

    return await this.prisma.plexArtist.update({
      where: { ratingKey },
      data: updateData
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

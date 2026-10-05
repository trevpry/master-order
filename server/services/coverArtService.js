// Cover Art Archive (MusicBrainz) release images.

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_AGENT = 'EddieLifeManagement/1.0.0 (https://github.com/yourusername/eddie)';

const toHttps = (url) => (url ? String(url).replace(/^http:\/\//i, 'https://') : null);

class CoverArtService {
  static isValidMbid(value) {
    return MBID_PATTERN.test(String(value || ''));
  }

  /**
   * Returns normalized images for a MusicBrainz release ([] when the release has no cover art).
   * `saveUrl` prefers the 1200px rendition because original scans can be very large.
   */
  async getReleaseImages(releaseId) {
    if (!CoverArtService.isValidMbid(releaseId)) {
      throw new Error('Invalid MusicBrainz release ID');
    }

    const response = await fetch(`https://coverartarchive.org/release/${releaseId}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    });

    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`Cover Art Archive error: ${response.status}`);
    }

    const data = await response.json();
    return (data.images || []).map((image, index) => ({
      index,
      thumb: toHttps(image.thumbnails?.['250'] || image.thumbnails?.small || image.image),
      full: toHttps(image.image),
      saveUrl: toHttps(image.thumbnails?.['1200'] || image.thumbnails?.large || image.image),
      types: Array.isArray(image.types) ? image.types : [],
      front: Boolean(image.front),
      back: Boolean(image.back),
      comment: image.comment || null
    }));
  }

  static defaultSelection(images) {
    const find = (flag, type) => images.find(image => image[flag])
      || images.find(image => image.types.includes(type));
    return {
      front: find('front', 'Front')?.index ?? null,
      back: find('back', 'Back')?.index ?? null
    };
  }

  /**
   * artwork: { front: imageIndex|null, back: imageIndex|null } — indexes into the release's own
   * Cover Art Archive list, so only that release's images can be downloaded.
   */
  async saveSelectedArtwork(albumKey, releaseId, artwork) {
    const AlbumArtworkService = require('./albumArtworkService');
    const artworkService = new AlbumArtworkService();
    const saved = [];
    const errors = [];

    const wanted = AlbumArtworkService.ARTWORK_TYPES.filter(type => Number.isInteger(Number.parseInt(artwork?.[type], 10)));
    if (wanted.length === 0) return { saved, errors };

    const images = await this.getReleaseImages(releaseId);
    for (const type of wanted) {
      const image = images[Number.parseInt(artwork[type], 10)];
      if (!image?.saveUrl) continue;

      try {
        await artworkService.saveFromUrl(albumKey, type, image.saveUrl, {
          source: 'musicbrainz',
          headers: { 'User-Agent': USER_AGENT }
        });
        saved.push(type);
      } catch (error) {
        console.error(`Failed to save Cover Art Archive ${type} artwork for album ${albumKey}:`, error.message);
        errors.push({ type, error: error.message });
      }
    }

    return { saved, errors };
  }
}

module.exports = CoverArtService;

const prisma = require('../prismaClient');

const ARTWORK_TYPES = ['front', 'back'];
const MAX_ARTWORK_BYTES = 15 * 1024 * 1024;

class AlbumArtworkService {
  static isValidType(type) {
    return ARTWORK_TYPES.includes(type);
  }

  /**
   * Adds `artwork: { front, back }` (version strings or null) to each album so clients can
   * prefer database artwork over Plex thumbs.
   */
  async attachArtworkInfo(albums) {
    const list = (Array.isArray(albums) ? albums : [albums]).filter(album => album?.ratingKey);
    if (list.length === 0) return albums;

    const rows = await prisma.albumArtwork.findMany({
      where: { albumKey: { in: list.map(album => album.ratingKey) } },
      select: { albumKey: true, type: true, updatedAt: true }
    });

    const byAlbum = new Map();
    for (const row of rows) {
      const entry = byAlbum.get(row.albumKey) || { front: null, back: null };
      entry[row.type] = row.updatedAt.getTime().toString();
      byAlbum.set(row.albumKey, entry);
    }

    for (const album of list) {
      album.artwork = byAlbum.get(album.ratingKey) || { front: null, back: null };
    }
    return albums;
  }

  async getArtwork(albumKey, type) {
    return await prisma.albumArtwork.findUnique({
      where: { albumKey_type: { albumKey, type } }
    });
  }

  async deleteArtwork(albumKey, type) {
    await prisma.albumArtwork.deleteMany({ where: { albumKey, type } });
  }

  /**
   * Downloads an image and stores it for the album. Callers must only pass URLs taken from a
   * trusted source (e.g. the Discogs release's own image list), never raw user input.
   */
  async saveFromUrl(albumKey, type, url, { source = null, width = null, height = null, headers = {} } = {}) {
    if (!AlbumArtworkService.isValidType(type)) {
      throw new Error(`Invalid artwork type: ${type}`);
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to download artwork (${response.status})`);
    }

    const mimeType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) {
      throw new Error(`Artwork URL did not return an image (${mimeType || 'unknown type'})`);
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTWORK_BYTES) {
      throw new Error('Artwork image is too large');
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length === 0 || data.length > MAX_ARTWORK_BYTES) {
      throw new Error('Artwork image is empty or too large');
    }

    const record = { mimeType, data, width, height, source, sourceUrl: url };
    return await prisma.albumArtwork.upsert({
      where: { albumKey_type: { albumKey, type } },
      update: record,
      create: { albumKey, type, ...record }
    });
  }
}

module.exports = AlbumArtworkService;
module.exports.ARTWORK_TYPES = ARTWORK_TYPES;

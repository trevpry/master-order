const { PrismaClient } = require('@prisma/client');

class LocationService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async createLocation(locationData) {
    const {
      name,
      description,
      type = 'place',
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postalCode,
      category,
      rating,
      tags = [],
      website,
      phone,
      notes,
      isPrivate = false,
      isFavorite = false,
      userId = 1,
      noteId
    } = locationData;

    return await this.prisma.location.create({
      data: {
        name,
        description,
        type,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        city,
        state,
        country,
        postalCode,
        category,
        rating: rating ? parseFloat(rating) : null,
        tags: JSON.stringify(tags),
        website,
        phone,
        notes,
        isPrivate,
        isFavorite,
        userId,
        noteId
      },
      include: {
        note: true
      }
    });
  }

  async getAllLocations(userId = 1, options = {}) {
    const {
      includePrivate = true,
      type,
      category,
      isFavorite,
      search,
      bounds,
      limit = 100,
      offset = 0
    } = options;

    const where = {
      userId,
      ...(includePrivate ? {} : { isPrivate: false }),
      ...(type && { type }),
      ...(category && { category }),
      ...(isFavorite !== undefined && { isFavorite }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(bounds && {
        latitude: {
          gte: bounds.south,
          lte: bounds.north
        },
        longitude: {
          gte: bounds.west,
          lte: bounds.east
        }
      })
    };

    return await this.prisma.location.findMany({
      where,
      include: {
        note: true
      },
      orderBy: [
        { isFavorite: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset
    });
  }

  async getLocationById(id) {
    return await this.prisma.location.findUnique({
      where: { id: parseInt(id) },
      include: {
        note: true
      }
    });
  }

  async updateLocation(id, updateData) {
    const {
      name,
      description,
      type,
      latitude,
      longitude,
      address,
      city,
      state,
      country,
      postalCode,
      category,
      rating,
      tags,
      website,
      phone,
      notes,
      isPrivate,
      isFavorite,
      noteId
    } = updateData;

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (state !== undefined) data.state = state;
    if (country !== undefined) data.country = country;
    if (postalCode !== undefined) data.postalCode = postalCode;
    if (category !== undefined) data.category = category;
    if (rating !== undefined) data.rating = rating ? parseFloat(rating) : null;
    if (tags !== undefined) data.tags = JSON.stringify(tags);
    if (website !== undefined) data.website = website;
    if (phone !== undefined) data.phone = phone;
    if (notes !== undefined) data.notes = notes;
    if (isPrivate !== undefined) data.isPrivate = isPrivate;
    if (isFavorite !== undefined) data.isFavorite = isFavorite;
    if (noteId !== undefined) data.noteId = noteId;

    return await this.prisma.location.update({
      where: { id: parseInt(id) },
      data,
      include: {
        note: true
      }
    });
  }

  async deleteLocation(id) {
    return await this.prisma.location.delete({
      where: { id: parseInt(id) }
    });
  }

  async searchNearby(latitude, longitude, radiusKm = 10, options = {}) {
    // Simple bounding box calculation (rough approximation)
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = parseFloat(radiusKm);
    
    // Approximate degrees per km (varies by latitude)
    const degPerKm = 1 / 111.32;
    const latRadius = radius * degPerKm;
    const lngRadius = radius * degPerKm / Math.cos(lat * Math.PI / 180);

    const bounds = {
      north: lat + latRadius,
      south: lat - latRadius,
      east: lng + lngRadius,
      west: lng - lngRadius
    };

    return await this.getAllLocations(options.userId || 1, {
      ...options,
      bounds
    });
  }

  async getLocationsByType(type, userId = 1) {
    return await this.prisma.location.findMany({
      where: {
        userId,
        type
      },
      include: {
        note: true
      },
      orderBy: [
        { isFavorite: 'desc' },
        { name: 'asc' }
      ]
    });
  }

  async getFavoriteLocations(userId = 1) {
    return await this.prisma.location.findMany({
      where: {
        userId,
        isFavorite: true
      },
      include: {
        note: true
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });
  }

  async getLocationStats(userId = 1) {
    const [total, favorites, types, countries] = await Promise.all([
      this.prisma.location.count({ where: { userId } }),
      this.prisma.location.count({ where: { userId, isFavorite: true } }),
      this.prisma.location.groupBy({
        by: ['type'],
        where: { userId },
        _count: { id: true }
      }),
      this.prisma.location.groupBy({
        by: ['country'],
        where: { userId, country: { not: null } },
        _count: { id: true }
      })
    ]);

    return {
      total,
      favorites,
      byType: types.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {}),
      byCountry: countries.reduce((acc, item) => {
        acc[item.country] = item._count.id;
        return acc;
      }, {})
    };
  }

  async connectToNote(locationId, noteId) {
    return await this.prisma.location.update({
      where: { id: parseInt(locationId) },
      data: { noteId: parseInt(noteId) },
      include: {
        note: true
      }
    });
  }

  async disconnectFromNote(locationId) {
    return await this.prisma.location.update({
      where: { id: parseInt(locationId) },
      data: { noteId: null },
      include: {
        note: true
      }
    });
  }
}

module.exports = LocationService;

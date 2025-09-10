/**
 * Database Service Base Class
 * Provides common database operations with optimization patterns
 */

const { PrismaClient } = require('@prisma/client');

class DatabaseService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Paginated query with consistent response format
   */
  async findManyPaginated(model, options = {}) {
    const {
      page = 1,
      limit = 20,
      where = {},
      include = {},
      orderBy = { createdAt: 'desc' }
    } = options;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma[model].findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit
      }),
      this.prisma[model].count({ where })
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Safe find with existence check
   */
  async findByIdOrThrow(model, id, include = {}) {
    const record = await this.prisma[model].findUnique({
      where: { id },
      include
    });

    if (!record) {
      throw new Error(`${model} with ID ${id} not found`);
    }

    return record;
  }

  /**
   * Bulk operations with transaction safety
   */
  async bulkCreate(model, data) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of data) {
        const result = await tx[model].create({ data: item });
        results.push(result);
      }
      return results;
    });
  }
}

module.exports = DatabaseService;

const BookCompletionService = require('./BookCompletionService');

const isBookPart = item => ['chapter', 'section'].includes(item.mediaType);

function normalizeBookPartProgress(progress = {}) {
  if (progress === null) return {};
  if (typeof progress !== 'object' || Array.isArray(progress)) {
    throw new TypeError('Reading progress must be an object');
  }
  const supplied = {
    percentComplete: progress.readPercentage ?? progress.percentComplete ??
      progress.percentCompleted ?? progress.percentRead ?? progress.percentage ?? progress.percent,
    currentPage: progress.currentPage,
    totalPages: progress.totalPages
  };
  const normalized = {};
  for (const [field, value] of Object.entries(supplied)) {
    if (value === undefined || value === null) continue;
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
      throw new TypeError(`${field} must be a finite number`);
    }
    const number = Number(value);
    if (number < 0 || (field === 'percentComplete' && number > 100) ||
        (field === 'totalPages' && number === 0)) {
      throw new RangeError(`${field} is outside the valid reading progress range`);
    }
    normalized[field] = number;
  }
  return normalized;
}

class BookCustomOrderService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async addParts(bookId, customOrderId, selections) {
    return this.prisma.$transaction(async tx => {
      const book = await tx.book.findUnique({
        where: { id: bookId },
        include: {
          chapters: {
            orderBy: { chapterNumber: 'asc' },
            include: {
              chapterCompletions: { where: { userId: 'default' } },
              sections: {
                orderBy: { sectionNumber: 'asc' },
                include: { sectionCompletions: { where: { userId: 'default' } } }
              }
            }
          }
        }
      });
      if (!book) return { status: 404, error: 'Book not found' };
      const order = await tx.customOrder.findUnique({ where: { id: customOrderId } });
      if (!order) return { status: 404, error: 'Custom order not found' };

      const requested = new Set(selections.map(part => `${part.type}:${part.id}`));
      const parts = [];
      for (const chapter of book.chapters) {
        if (requested.delete(`chapter:${chapter.id}`)) {
          parts.push({
            mediaType: 'chapter', bookId, chapterId: chapter.id,
            title: `${book.title} - Chapter ${chapter.chapterNumber}: ${chapter.title}`,
            isWatched: chapter.chapterCompletions.some(completion => completion.isCompleted)
          });
        }
        for (const section of chapter.sections) {
          if (requested.delete(`section:${section.id}`)) {
            parts.push({
              mediaType: 'section', bookId, chapterId: chapter.id, sectionId: section.id,
              title: `${book.title} - Chapter ${chapter.chapterNumber}, Section ${section.sectionNumber}: ${section.title}`,
              isWatched: section.sectionCompletions.some(completion => completion.isCompleted)
            });
          }
        }
      }
      if (requested.size) return { status: 400, error: 'Every selected chapter or section must belong to this book' };

      await tx.customOrder.update({ where: { id: customOrderId }, data: { updatedAt: new Date() } });
      const existing = await tx.customOrderItem.findMany({
        where: { customOrderId },
        select: { sortOrder: true, mediaType: true, chapterId: true, sectionId: true }
      });
      const keys = new Set(existing.filter(isBookPart).map(item =>
        `${item.mediaType}:${item.mediaType === 'section' ? item.sectionId : item.chapterId}`));
      let sortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const newItems = parts.filter(part => !keys.has(
        `${part.mediaType}:${part.mediaType === 'section' ? part.sectionId : part.chapterId}`
      )).map(part => ({
        ...part, customOrderId, sortOrder: sortOrder++,
        plexKey: `book-${part.mediaType}-${part.mediaType === 'section' ? part.sectionId : part.chapterId}`
      }));
      if (newItems.length) await tx.customOrderItem.createMany({ data: newItems });
      return {
        customOrderId, customOrderName: order.name,
        added: newItems.length, skipped: parts.length - newItems.length
      };
    });
  }

  async setCompleted(item, isCompleted) {
    if (!isBookPart(item)) throw new Error('Expected a chapter or section custom order item');
    const id = item.mediaType === 'chapter' ? item.chapterId : item.sectionId;
    if (!id) throw new Error(`Custom order ${item.mediaType} is missing its library reference`);
    return this.prisma.$transaction(async tx => {
      const service = new BookCompletionService(tx);
      if (isCompleted) {
        return item.mediaType === 'chapter'
          ? service.markChapterCompleted(id)
          : service.markSectionCompleted(id);
      }
      const model = item.mediaType === 'chapter' ? tx.chapterCompletion : tx.sectionCompletion;
      const field = item.mediaType === 'chapter' ? 'chapterId' : 'sectionId';
      const completion = await model.findUnique({
        where: { [`${field}_userId`]: { [field]: id, userId: 'default' } }
      });
      if (completion?.isCompleted) {
        return item.mediaType === 'chapter'
          ? service.toggleChapterCompletion(id)
          : service.toggleSectionCompletion(id);
      }
      await tx.customOrderItem.updateMany({
        where: { mediaType: item.mediaType, [field]: id },
        data: { isWatched: false }
      });
      return completion;
    }, { timeout: 30000 });
  }

  async updateReadingProgress(item, progress = {}) {
    progress = normalizeBookPartProgress(progress);
    const percentage = progress.percentComplete;
    let completed = percentage === 100;
    if (percentage === undefined && progress.currentPage !== undefined) {
      const part = item.mediaType === 'chapter'
        ? await this.prisma.bookChapter.findUnique({ where: { id: item.chapterId } })
        : await this.prisma.bookSection.findUnique({ where: { id: item.sectionId } });
      if (!part) throw new Error('Library chapter or section not found');
      const endPage = part.pageEnd ?? progress.totalPages;
      completed = Number.isFinite(progress.currentPage) && Number.isFinite(endPage) &&
        endPage > 0 && progress.currentPage >= endPage;
    }
    if (completed) await this.setCompleted(item, true);
    return completed;
  }
}

module.exports = { BookCustomOrderService, isBookPart, normalizeBookPartProgress };

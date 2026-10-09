class CourseCustomOrderService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async addVideos(courseId, customOrderId, videoIds) {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.historyCourse.findUnique({
        where: { id: courseId },
        include: {
          videos: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] }
        }
      });
      if (!course) {
        return { error: 'Course not found', status: 404 };
      }

      const customOrder = await tx.customOrder.findUnique({ where: { id: customOrderId } });
      if (!customOrder) {
        return { error: 'Custom order not found', status: 404 };
      }

      const selectedIds = videoIds ? new Set(videoIds) : null;
      const videos = selectedIds
        ? course.videos.filter(video => selectedIds.has(video.id))
        : course.videos;
      if (selectedIds && videos.length !== selectedIds.size) {
        return { error: 'Every selected video must belong to this course', status: 400 };
      }
      if (videos.length === 0) {
        return { error: 'No course videos to add. Import course lectures first.', status: 400 };
      }

      // Serialize course imports into the same order before checking duplicates and positions.
      await tx.customOrder.update({
        where: { id: customOrderId },
        data: { updatedAt: new Date() }
      });

      const existingItems = await tx.customOrderItem.findMany({
        where: { customOrderId },
        select: { sortOrder: true, plexKey: true, webUrl: true }
      });
      const existingKeys = new Set(existingItems.map(item => item.plexKey));
      const existingUrls = new Set(existingItems.map(item => item.webUrl));
      let sortOrder = existingItems.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const newItems = [];

      for (const video of videos) {
        const plexKey = `webvideo-course-${video.id}`;
        if (existingKeys.has(plexKey) || existingUrls.has(video.url)) {
          continue;
        }
        newItems.push({
          customOrderId,
          mediaType: 'webvideo',
          plexKey,
          title: `${course.title} - ${video.title}`,
          webTitle: video.title,
          webUrl: video.url,
          webDescription: video.description || course.description,
          sortOrder: sortOrder++,
          isWatched: false
        });
        existingKeys.add(plexKey);
        existingUrls.add(video.url);
      }

      let items = [];
      if (newItems.length > 0) {
        await tx.customOrderItem.createMany({ data: newItems });
        items = await tx.customOrderItem.findMany({
          where: { customOrderId, plexKey: { in: newItems.map(item => item.plexKey) } },
          orderBy: { sortOrder: 'asc' }
        });
      }

      return {
        customOrderId,
        customOrderName: customOrder.name,
        added: newItems.length,
        skipped: videos.length - newItems.length,
        items
      };
    });
  }
}

module.exports = CourseCustomOrderService;

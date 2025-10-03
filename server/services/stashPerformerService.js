/**
 * StashPerformerService
 * Fetches comprehensive performer data for Android API consumption.
 */
const prisma = require('../prismaClient');

class StashPerformerService {
  /** Get full performer details */
  async getPerformer(id) {
    const performer = await prisma.stashPerformer.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        scenes: {
          include: {
            scene: {
              select: {
                id: true,
                title: true,
                date: true,
                studio: true,
                rating: true,
                duration: true
              }
            }
          },
          take: 24
        },
        images: {
          include: {
            image: {
              select: {
                id: true,
                title: true,
                path: true,
                rating: true,
                galleryId: true
              }
            }
          },
          take: 50
        }
      }
    });

    if (!performer) return null;

    return {
      id: performer.id,
      name: performer.name,
      disambiguation: performer.disambiguation,
      alias: performer.alias,
      favorite: performer.favorite,
      ignore_auto_tag: performer.ignore_auto_tag,
      birthdate: performer.birthdate,
      death_date: performer.death_date,
      gender: performer.gender,
      details: performer.details,
      rating: performer.rating,
      ethnicity: performer.ethnicity,
      country: performer.country,
      eye_color: performer.eye_color,
      hair_color: performer.hair_color,
      height: performer.height,
      weight: performer.weight,
      measurements: performer.measurements,
      fake_tits: performer.fake_tits,
      career_length: performer.career_length,
      tattoos: performer.tattoos,
      piercings: performer.piercings,
      image: performer.image,
      instagram: performer.instagram,
      twitter: performer.twitter,
      url: performer.url,
      tags: performer.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
      scenes: performer.scenes.map(s => s.scene),
      images: performer.images.map(pi => ({
        id: pi.image.id,
        title: pi.image.title,
        path: pi.image.path,
        rating: pi.image.rating,
        galleryId: pi.image.galleryId
      }))
    };
  }
}

module.exports = StashPerformerService;

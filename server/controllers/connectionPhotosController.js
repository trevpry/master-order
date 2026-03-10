const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { getUploadDirectory } = require('../utils/utilities');

const prisma = new PrismaClient();

// Ensure upload directory exists at startup
const photosDir = getUploadDirectory('connection-photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `conn-${req.params.connectionId}-${unique}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB per file
});

const getPhotos = async (req, res) => {
  try {
    const photos = await prisma.connectionPhoto.findMany({
      where: { connectionId: parseInt(req.params.connectionId) },
      orderBy: { createdAt: 'asc' }
    });
    res.json(photos);
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
};

const uploadPhotos = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.connectionId);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    // First-ever photo automatically becomes the profile photo
    const existingCount = await prisma.connectionPhoto.count({ where: { connectionId } });

    const photos = await Promise.all(
      req.files.map((file, index) =>
        prisma.connectionPhoto.create({
          data: {
            connectionId,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            isProfile: existingCount === 0 && index === 0
          }
        })
      )
    );

    res.status(201).json(photos);
  } catch (error) {
    console.error('Error uploading photos:', error);
    // Clean up any files that were saved before the error
    if (req.files) {
      req.files.forEach(file => fs.unlink(file.path, () => {}));
    }
    res.status(500).json({ error: 'Failed to upload photos' });
  }
};

const setProfilePhoto = async (req, res) => {
  try {
    const photoId = parseInt(req.params.photoId);
    const photo = await prisma.connectionPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    await prisma.$transaction([
      prisma.connectionPhoto.updateMany({
        where: { connectionId: photo.connectionId },
        data: { isProfile: false }
      }),
      prisma.connectionPhoto.update({
        where: { id: photoId },
        data: { isProfile: true }
      })
    ]);

    const updated = await prisma.connectionPhoto.findUnique({ where: { id: photoId } });
    res.json(updated);
  } catch (error) {
    console.error('Error setting profile photo:', error);
    res.status(500).json({ error: 'Failed to set profile photo' });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const photoId = parseInt(req.params.photoId);
    const photo = await prisma.connectionPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const { connectionId, filename, isProfile } = photo;

    await prisma.connectionPhoto.delete({ where: { id: photoId } });

    // Remove file from disk (non-blocking)
    const filePath = path.join(photosDir, filename);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Could not delete photo file:', filePath);
    });

    // If the deleted photo was the profile, promote the next oldest
    if (isProfile) {
      const next = await prisma.connectionPhoto.findFirst({
        where: { connectionId },
        orderBy: { createdAt: 'asc' }
      });
      if (next) {
        await prisma.connectionPhoto.update({ where: { id: next.id }, data: { isProfile: true } });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
};

module.exports = { upload, getPhotos, uploadPhotos, setProfilePhoto, deletePhoto };

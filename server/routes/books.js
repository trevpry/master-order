const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Create a reference book (for containing short stories) without adding to collection order
router.post('/reference', async (req, res) => {
  try {
    const {
      title,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount,
      customOrderId // Order context is needed due to schema constraints
    } = req.body;

    // Check if this book already exists globally by OpenLibrary ID
    const existingBook = await prisma.customOrderItem.findFirst({
      where: {
        mediaType: 'book',
        bookOpenLibraryId: bookOpenLibraryId
      }
    });

    if (existingBook) {
      return res.json(existingBook);
    }

    // If no customOrderId provided, we can't create the book due to schema constraints
    if (!customOrderId) {
      return res.status(400).json({ error: 'customOrderId is required to create a book' });
    }

    // Generate a unique plexKey for the book (since it's required by schema)
    const bookPlexKey = `book_${bookOpenLibraryId || Date.now()}`;

    // Create the book entry in the specified order
    const book = await prisma.customOrderItem.create({
      data: {
        mediaType: 'book',
        plexKey: bookPlexKey,
        title: title,
        bookTitle: bookTitle,
        bookAuthor: bookAuthor,
        bookYear: bookYear,
        bookIsbn: bookIsbn,
        bookPublisher: bookPublisher,
        bookOpenLibraryId: bookOpenLibraryId,
        bookCoverUrl: bookCoverUrl,
        bookPageCount: bookPageCount ? parseInt(bookPageCount) : null,
        sortOrder: 0,
        customOrderId: customOrderId,
        isWatched: true // Reference books are automatically marked as watched
      }
    });

    res.status(201).json(book);
  } catch (error) {
    console.error('Error creating reference book:', error);
    res.status(500).json({ error: 'Failed to create reference book' });
  }
});

module.exports = router;

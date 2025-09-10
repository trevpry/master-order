const express = require('express');
const prisma = require('../prismaClient'); // Use shared singleton instance
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

const router = express.Router();

// Create a reference book (for containing short stories) without adding to collection order
router.post('/reference', validateRequiredFields('customOrderId', 'customOrderId is required to create a book'), asyncHandler(async (req, res) => {
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
}));

module.exports = router;

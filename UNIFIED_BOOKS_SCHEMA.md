# Unified Books Schema Design

## Overview
This document outlines the design for centralizing all book-related functionality into a unified Books table that will be referenced by CustomOrderItems, HistoryPlus, and standalone books.

## Current State Analysis

### CustomOrderItem Book Fields (to be migrated)
- bookTitle, bookAuthor, bookYear, bookIsbn, bookPublisher
- bookOpenLibraryId, bookCoverUrl, bookPageCount
- bookCurrentPage, bookPercentRead

### HistoryBook Structure (to be unified)
- HistoryBook -> HistoryChapter -> HistorySection
- User reading tracking tables

## New Unified Schema Design

### Core Books Table
```prisma
model Book {
  id                  Int       @id @default(autoincrement())
  title               String
  author              String?
  isbn                String?   @unique
  publisher           String?
  publishYear         Int?
  description         String?
  coverUrl            String?
  pageCount           Int?
  openLibraryId       String?   @unique
  komgaBookId         String?   @unique
  komgaSeriesId       String?
  komgaUrl            String?
  komgaMetadata       String?
  
  // Artwork caching
  artworkLastCached   DateTime?
  artworkMimeType     String?
  localArtworkPath    String?
  originalArtworkUrl  String?
  
  // Metadata
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  // Relations
  chapters            BookChapter[]
  customOrderItems    CustomOrderItem[]
  historyBookLinks    HistoryBookLink[]  // Link to historical events
  readingSessions     WatchLog[]         // All reading sessions
  bookCompletions     BookCompletion[]   // Completion tracking
  
  @@index([isbn])
  @@index([openLibraryId])
  @@index([komgaBookId])
}

model BookChapter {
  id                Int       @id @default(autoincrement())
  bookId            Int
  title             String
  chapterNumber     Int
  description       String?
  pageStart         Int?
  pageEnd           Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  book              Book                @relation(fields: [bookId], references: [id], onDelete: Cascade)
  sections          BookSection[]
  chapterCompletions ChapterCompletion[]
  
  @@unique([bookId, chapterNumber])
}

model BookSection {
  id                Int       @id @default(autoincrement())
  chapterId         Int
  title             String
  sectionNumber     Int
  description       String?
  content           String?
  pageStart         Int?
  pageEnd           Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Relations
  chapter           BookChapter         @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  sectionCompletions SectionCompletion[]
  
  @@unique([chapterId, sectionNumber])
}
```

### Completion Tracking
```prisma
model BookCompletion {
  id          Int       @id @default(autoincrement())
  bookId      Int
  userId      String?   // For future multi-user support
  isCompleted Boolean   @default(false)
  currentPage Int?
  percentRead Float?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  book        Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  
  @@unique([bookId, userId])
}

model ChapterCompletion {
  id          Int         @id @default(autoincrement())
  chapterId   Int
  userId      String?
  isCompleted Boolean     @default(false)
  completedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  chapter     BookChapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  
  @@unique([chapterId, userId])
}

model SectionCompletion {
  id          Int         @id @default(autoincrement())
  sectionId   Int
  userId      String?
  isCompleted Boolean     @default(false)
  completedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  
  section     BookSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  
  @@unique([sectionId, userId])
}
```

### History Plus Integration
```prisma
model HistoryBookLink {
  id        Int               @id @default(autoincrement())
  bookId    Int
  eventId   Int
  createdAt DateTime          @default(now())
  
  book      Book              @relation(fields: [bookId], references: [id], onDelete: Cascade)
  event     HistoricalEvent   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  @@unique([bookId, eventId])
}
```

### Updated Relations
```prisma
// CustomOrderItem - Remove book fields, add book reference
model CustomOrderItem {
  // ... existing fields ...
  bookId              Int?
  book                Book?             @relation(fields: [bookId], references: [id])
  // Remove: bookTitle, bookAuthor, bookYear, etc.
}

// WatchLog - Enhanced for book sessions
model WatchLog {
  // ... existing fields ...
  bookId              Int?
  chapterId           Int?
  sectionId           Int?
  
  book                Book?             @relation(fields: [bookId], references: [id])
}
```

## Migration Strategy

### Phase 1: Create New Tables
1. Add Book, BookChapter, BookSection tables
2. Add completion tracking tables
3. Add HistoryBookLink table

### Phase 2: Data Migration
1. Migrate CustomOrderItem book data to Books table
2. Migrate HistoryBook data to unified structure
3. Create appropriate links and references

### Phase 3: Update Application Logic
1. Update services to use unified Books table
2. Consolidate reading session logic
3. Update UI components

### Phase 4: Cleanup
1. Remove old book fields from CustomOrderItem
2. Remove old HistoryBook tables (after data migration)
3. Update indexes and constraints

## Benefits

1. **Single Source of Truth**: All book data in one place
2. **Consistent Structure**: Same chapter/section model across all use cases
3. **Reduced Duplication**: No more duplicate book metadata
4. **Unified Reading Sessions**: One session system for all book types
5. **Better Progress Tracking**: Granular completion at all levels
6. **Scalability**: Easier to add new book sources and features
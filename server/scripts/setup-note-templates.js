#!/usr/bin/env node
/**
 * Setup Note Templates Script
 * Creates default note templates for Docker/Unraid environments
 * Can be run manually: node server/scripts/setup-note-templates.js
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Initialize Prisma client with error handling
let prisma;
try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
} catch (error) {
  console.error('[ERROR] Failed to initialize Prisma client:', error.message);
  process.exit(1);
}

async function setupNoteTemplates() {
  console.log('[INFO] 📝 Note Templates Setup Script');
  console.log('[INFO] ==============================');
  console.log('[INFO] Environment:', process.env.NODE_ENV || 'production');
  console.log('[INFO] Working directory:', process.cwd());

  try {
    // Test database connection
    console.log('[INFO] Testing database connection...');
    await prisma.$connect();
    console.log('[SUCCESS] ✅ Database connection established');

    // Check current template count
    const existingCount = await prisma.noteTemplate.count();
    console.log(`[INFO] Found ${existingCount} existing templates`);

    if (existingCount >= 4) {
      console.log('[INFO] ✅ All default templates already exist, skipping creation');
      return { created: 0, skipped: existingCount };
    }

    // Check which templates are missing
    const existingTemplates = await prisma.noteTemplate.findMany({
      select: { name: true, type: true }
    });
    
    const existingTypes = existingTemplates.map(t => t.type);
    console.log('[INFO] Existing template types:', existingTypes);

    let createdCount = 0;

    // Create Daily Note Template if missing
    if (!existingTypes.includes('daily')) {
      console.log('[INFO] Creating Daily Note Template...');
      await prisma.noteTemplate.create({
        data: {
          name: 'Daily Note Template',
          description: 'Default template for daily notes with sections for goals, habits, and reflection',
          content: `# {{date}}

## Morning Reflection
- How am I feeling today?
- What are my priorities?
- What am I excited about?

## Goals for Today
- [ ] 
- [ ] 
- [ ] 

## Daily Habits
- [ ] Exercise
- [ ] Read
- [ ] Meditate
- [ ] Drink water

## Notes & Thoughts
_Capture thoughts, ideas, and observations throughout the day..._

## Evening Reflection
- What went well today?
- What could I improve?
- What challenges did I face?

## Gratitude
- 
- 
- 

---
*Created on {{timestamp}}*`,
          type: 'daily',
          variables: JSON.stringify(['date', 'timestamp']),
          userId: 1,
          isDefault: true
        }
      });
      console.log('[SUCCESS] ✅ Daily Note Template created');
      createdCount++;
    }

    // Create Weekly Review Template if missing
    if (!existingTypes.includes('weekly')) {
      console.log('[INFO] Creating Weekly Review Template...');
      await prisma.noteTemplate.create({
        data: {
          name: 'Weekly Review Template',
          description: 'Template for weekly planning and review sessions',
          content: `# Week of {{date}}

## Weekly Goals
- [ ] 
- [ ] 
- [ ] 

## Priority Projects
1. 
2. 
3. 

## This Week's Focus
_What is the main theme or focus for this week?_

## Weekly Review
- What did I accomplish?
- What did I learn?
- What will I do differently next week?

---
*Created on {{timestamp}}*`,
          type: 'weekly',
          variables: JSON.stringify(['date', 'timestamp']),
          userId: 1,
          isDefault: false
        }
      });
      console.log('[SUCCESS] ✅ Weekly Review Template created');
      createdCount++;
    }

    // Create Meeting Notes Template if missing
    if (!existingTypes.includes('meeting')) {
      console.log('[INFO] Creating Meeting Notes Template...');
      await prisma.noteTemplate.create({
        data: {
          name: 'Meeting Notes Template',
          description: 'Template for capturing meeting notes and action items',
          content: `# {{title}} - Meeting Notes

**Date:** {{date}}
**Attendees:** 

## Agenda
1. 
2. 
3. 

## Discussion Points
- 
- 
- 

## Decisions Made
- 
- 

## Action Items
- [ ] **Person:** Task description
- [ ] **Person:** Task description
- [ ] **Person:** Task description

## Next Steps
- 

## Follow-up Required
- 

---
*Meeting notes from {{timestamp}}*`,
          type: 'meeting',
          variables: JSON.stringify(['title', 'date', 'timestamp']),
          userId: 1,
          isDefault: false
        }
      });
      console.log('[SUCCESS] ✅ Meeting Notes Template created');
      createdCount++;
    }

    // Create Project Notes Template if missing
    if (!existingTypes.includes('project')) {
      console.log('[INFO] Creating Project Notes Template...');
      await prisma.noteTemplate.create({
        data: {
          name: 'Project Notes Template',
          description: 'Template for project planning and tracking',
          content: `# {{title}} - Project Notes

**Started:** {{date}}
**Status:** In Progress

## Project Overview
_Brief description of the project and its objectives..._

## Goals & Objectives
- 
- 
- 

## Key Milestones
- [ ] **Date:** Milestone description
- [ ] **Date:** Milestone description
- [ ] **Date:** Milestone description

## Tasks & To-Do
- [ ] 
- [ ] 
- [ ] 

## Resources & References
- 
- 

## Notes & Ideas
_Capture thoughts and ideas as the project progresses..._

## Challenges & Blockers
- 

## Next Steps
- 

---
*Project notes created on {{timestamp}}*`,
          type: 'project',
          variables: JSON.stringify(['title', 'date', 'timestamp']),
          userId: 1,
          isDefault: false
        }
      });
      console.log('[SUCCESS] ✅ Project Notes Template created');
      createdCount++;
    }

    console.log('[SUCCESS] ==============================');
    console.log(`[SUCCESS] 🎉 Template setup complete!`);
    console.log(`[SUCCESS] Created: ${createdCount} new templates`);
    console.log(`[SUCCESS] Total: ${existingCount + createdCount} templates available`);
    
    return { created: createdCount, total: existingCount + createdCount };

  } catch (error) {
    console.error('[ERROR] ==============================');
    console.error('[ERROR] 💥 Template setup failed!');
    console.error('[ERROR] Error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('[ERROR] Full error:', error);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('[INFO] Database connection closed');
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupNoteTemplates()
    .then((result) => {
      console.log(`[SUCCESS] Script completed successfully: ${result.created} templates created`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ERROR] Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { setupNoteTemplates };

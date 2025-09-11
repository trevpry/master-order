const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client with error handling for different environments
let prisma;
try {
  prisma = new PrismaClient({
    log: ['error'], // Only log errors to reduce noise in Docker
  });
} catch (error) {
  console.error('[ERROR] Failed to initialize Prisma client:', error.message);
  process.exit(1);
}

async function createDefaultTemplates() {
  console.log('[INFO] Creating default note templates...');

  try {
    // Test database connection first
    await prisma.$connect();
    console.log('[INFO] Database connection established');

    // Check if templates already exist to avoid duplicates
    const existingTemplates = await prisma.noteTemplate.count();
    if (existingTemplates > 0) {
      console.log(`[INFO] ${existingTemplates} templates already exist, skipping creation`);
      return;
    }
    // Daily Note Template
    const dailyTemplate = await prisma.noteTemplate.upsert({
      where: { id: 1 }, // Use a consistent ID for daily template
      update: {}, // Don't update if exists
      create: {
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

    console.log('[SUCCESS] Created daily template:', dailyTemplate.name);

    // Weekly Review Template
    const weeklyTemplate = await prisma.noteTemplate.create({
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

## Daily Breakdown

### Monday
**Goals:** 
- [ ] 

**Notes:**

### Tuesday
**Goals:** 
- [ ] 

**Notes:**

### Wednesday
**Goals:** 
- [ ] 

**Notes:**

### Thursday
**Goals:** 
- [ ] 

**Notes:**

### Friday
**Goals:** 
- [ ] 

**Notes:**

### Weekend Plans
**Saturday:**
- 

**Sunday:**
- 

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

    console.log('[SUCCESS] Created weekly template:', weeklyTemplate.name);

    // Meeting Notes Template
    const meetingTemplate = await prisma.noteTemplate.create({
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

    console.log('[SUCCESS] Created meeting template:', meetingTemplate.name);

    // Project Notes Template
    const projectTemplate = await prisma.noteTemplate.create({
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

## Project Timeline
**Phase 1:**
- 

**Phase 2:**
- 

**Phase 3:**
- 

---
*Project notes created on {{timestamp}}*`,
        type: 'project',
        variables: JSON.stringify(['title', 'date', 'timestamp']),
        userId: 1,
        isDefault: false
      }
    });

    console.log('[SUCCESS] Created project template:', projectTemplate.name);

    console.log('[SUCCESS] ✅ All default templates created successfully!');

  } catch (error) {
    console.error('[ERROR] Failed to create default templates:', error.message);
    console.error('[ERROR] Full error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('[INFO] Database connection closed');
  }
}

createDefaultTemplates();

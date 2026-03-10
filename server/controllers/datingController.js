const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all connections
const getConnections = async (req, res) => {
  try {
    const connections = await prisma.connection.findMany({
      include: {
        app: true,
        dates: true,
        encounters: true,
        connectionPhotos: { where: { isProfile: true }, take: 1 },
        messages: {
          take: 5,
          orderBy: {
            timestamp: 'desc'
          }
        },
        _count: {
          select: {
            dates: true,
            encounters: true,
            messages: true
          }
        }
      },
      orderBy: {
        lastContact: 'desc'
      }
    });

    res.json(connections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};

// Get connection by ID
const getConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await prisma.connection.findUnique({
      where: { id: parseInt(id) },
      include: {
        app: true,
        dates: {
          orderBy: { dateTime: 'desc' }
        },
        encounters: {
          orderBy: { dateTime: 'desc' }
        },
        messages: {
          orderBy: { timestamp: 'desc' }
        },
        screenshots: true,
        connectionPhotos: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json(connection);
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ error: 'Failed to fetch connection' });
  }
};

// Convert empty strings to null and coerce numeric types for Connection data
const sanitizeConnectionData = (data) => {
  // Nullable int fields (can be null in schema)
  const nullableIntFields = ['age', 'avgResponseTime'];
  // Non-nullable int fields with schema defaults — drop if empty so Prisma uses the default
  const defaultIntFields = { privatePhotos: 0, woofCount: 0, viewCount: 0, messagesExchanged: 0 };
  // Nullable float fields
  const nullableFloatFields = ['extractionConfidence'];
  // Non-nullable float field with schema default — drop if empty
  const defaultFloatFields = { responseRate: 0.0 };

  const sanitized = { ...data };

  for (const field of nullableIntFields) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = null;
    } else {
      const parsed = parseInt(sanitized[field], 10);
      sanitized[field] = isNaN(parsed) ? null : parsed;
    }
  }

  for (const [field, defaultVal] of Object.entries(defaultIntFields)) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = defaultVal;
    } else {
      const parsed = parseInt(sanitized[field], 10);
      sanitized[field] = isNaN(parsed) ? defaultVal : parsed;
    }
  }

  for (const field of nullableFloatFields) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = null;
    } else {
      const parsed = parseFloat(sanitized[field]);
      sanitized[field] = isNaN(parsed) ? null : parsed;
    }
  }

  for (const [field, defaultVal] of Object.entries(defaultFloatFields)) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = defaultVal;
    } else {
      const parsed = parseFloat(sanitized[field]);
      sanitized[field] = isNaN(parsed) ? defaultVal : parsed;
    }
  }

  // Convert empty strings to null for all remaining optional string fields
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === '') sanitized[key] = null;
  }

  // Remove fields that don't exist on the Connection model
  const unknownFields = ['userId'];
  for (const field of unknownFields) {
    delete sanitized[field];
  }

  return sanitized;
};

const sanitizeDateData = (data) => {
  const sanitized = { ...data };

  // Nullable int fields
  for (const field of ['duration', 'rating', 'chemistry', 'conversation', 'attraction']) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = null;
    } else {
      const parsed = parseInt(sanitized[field], 10);
      sanitized[field] = isNaN(parsed) ? null : parsed;
    }
  }

  // Nullable float fields
  for (const field of ['cost']) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = null;
    } else {
      const parsed = parseFloat(sanitized[field]);
      sanitized[field] = isNaN(parsed) ? null : parsed;
    }
  }

  // Empty strings to null for remaining string fields
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === '') sanitized[key] = null;
  }

  delete sanitized.userId;
  return sanitized;
};

const sanitizeEncounterData = (data) => {
  const sanitized = { ...data };

  for (const field of ['duration', 'satisfaction', 'performance', 'chemistry']) {
    if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = null;
    } else {
      const parsed = parseInt(sanitized[field], 10);
      sanitized[field] = isNaN(parsed) ? null : parsed;
    }
  }

  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === '') sanitized[key] = null;
  }

  delete sanitized.userId;
  return sanitized;
};

// Create new connection
const createConnection = async (req, res) => {
  try {
    const connectionData = req.body;
    
    // Ensure we have required fields
    if (!connectionData.guyName || !connectionData.appId) {
      return res.status(400).json({ error: 'Guy name and app ID are required' });
    }

    const sanitized = sanitizeConnectionData(connectionData);

    const connection = await prisma.connection.create({
      data: {
        ...sanitized,
        appId: parseInt(sanitized.appId)
      },
      include: {
        app: true
      }
    });

    res.status(201).json(connection);
  } catch (error) {
    console.error('Error creating connection:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Connection with this name already exists for this app' });
    }
    
    res.status(500).json({ error: 'Failed to create connection' });
  }
};

// Update connection
const updateConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = sanitizeConnectionData(req.body);

    const connection = await prisma.connection.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        app: true
      }
    });

    res.json(connection);
  } catch (error) {
    console.error('Error updating connection:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    res.status(500).json({ error: 'Failed to update connection' });
  }
};

// Delete connection
const deleteConnection = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.connection.delete({
      where: { id: parseInt(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting connection:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete connection' });
  }
};

// Get all dates
// Get all dates
const getDates = async (req, res) => {
  try {
    const dates = await prisma.date.findMany({
      include: {
        connection: {
          include: {
            app: true,
            connectionPhotos: { where: { isProfile: true }, take: 1 }
          }
        },
        encounters: true
      },
      orderBy: {
        dateTime: 'desc'
      }
    });

    res.json(dates);
  } catch (error) {
    console.error('Error fetching dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
};

// Get single date
const getDate = async (req, res) => {
  try {
    const date = await prisma.date.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        connection: { include: { app: true, connectionPhotos: { where: { isProfile: true }, take: 1 } } },
        encounters: {
          include: { connection: { include: { app: true } } },
          orderBy: { dateTime: 'desc' }
        }
      }
    });
    if (!date) return res.status(404).json({ error: 'Date not found' });
    res.json(date);
  } catch (error) {
    console.error('Error fetching date:', error);
    res.status(500).json({ error: 'Failed to fetch date' });
  }
};

// Create new date
const createDate = async (req, res) => {
  try {
    const raw = sanitizeDateData(req.body);

    const date = await prisma.date.create({
      data: {
        ...raw,
        connectionId: raw.connectionId ? parseInt(raw.connectionId) : null,
        dateTime: new Date(raw.dateTime)
      },
      include: {
        connection: {
          include: {
            app: true
          }
        }
      }
    });

    res.status(201).json(date);
  } catch (error) {
    console.error('Error creating date:', error);
    res.status(500).json({ error: 'Failed to create date' });
  }
};

// Update date
const updateDate = async (req, res) => {
  try {
    const raw = sanitizeDateData(req.body);
    const date = await prisma.date.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...raw,
        connectionId: raw.connectionId ? parseInt(raw.connectionId) : null,
        dateTime: raw.dateTime ? new Date(raw.dateTime) : undefined
      },
      include: { connection: { include: { app: true } } }
    });
    res.json(date);
  } catch (error) {
    console.error('Error updating date:', error);
    res.status(500).json({ error: 'Failed to update date' });
  }
};

// Delete date
const deleteDate = async (req, res) => {
  try {
    await prisma.date.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting date:', error);
    res.status(500).json({ error: 'Failed to delete date' });
  }
};

// Get all encounters
const getEncounters = async (req, res) => {
  try {
    const encounters = await prisma.encounter.findMany({
      include: {
        connection: {
          include: {
            app: true
          }
        },
        date: true
      },
      orderBy: {
        dateTime: 'desc'
      }
    });

    res.json(encounters);
  } catch (error) {
    console.error('Error fetching encounters:', error);
    res.status(500).json({ error: 'Failed to fetch encounters' });
  }
};

// Get single encounter
const getEncounter = async (req, res) => {
  try {
    const encounter = await prisma.encounter.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        connection: { include: { app: true } },
        date: true
      }
    });
    if (!encounter) return res.status(404).json({ error: 'Encounter not found' });
    res.json(encounter);
  } catch (error) {
    console.error('Error fetching encounter:', error);
    res.status(500).json({ error: 'Failed to fetch encounter' });
  }
};

// Create new encounter
const createEncounter = async (req, res) => {
  try {
    const raw = sanitizeEncounterData(req.body);

    const encounter = await prisma.encounter.create({
      data: {
        ...raw,
        connectionId: raw.connectionId ? parseInt(raw.connectionId) : null,
        dateId: raw.dateId ? parseInt(raw.dateId) : null,
        dateTime: new Date(raw.dateTime)
      },
      include: {
        connection: {
          include: {
            app: true
          }
        },
        date: true
      }
    });

    res.status(201).json(encounter);
  } catch (error) {
    console.error('Error creating encounter:', error);
    res.status(500).json({ error: 'Failed to create encounter' });
  }
};

// Update encounter
const updateEncounter = async (req, res) => {
  try {
    const raw = sanitizeEncounterData(req.body);
    const encounter = await prisma.encounter.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...raw,
        connectionId: raw.connectionId ? parseInt(raw.connectionId) : null,
        dateId: raw.dateId ? parseInt(raw.dateId) : null,
        dateTime: raw.dateTime ? new Date(raw.dateTime) : undefined
      },
      include: { connection: { include: { app: true } }, date: true }
    });
    res.json(encounter);
  } catch (error) {
    console.error('Error updating encounter:', error);
    res.status(500).json({ error: 'Failed to update encounter' });
  }
};

// Delete encounter
const deleteEncounter = async (req, res) => {
  try {
    await prisma.encounter.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting encounter:', error);
    res.status(500).json({ error: 'Failed to delete encounter' });
  }
};

// Get dating apps
const getDatingApps = async (req, res) => {
  try {
    const apps = await prisma.datingApp.findMany({
      include: {
        connections: {
          include: {
            _count: {
              select: {
                dates: true,
                encounters: true
              }
            }
          }
        },
        _count: {
          select: {
            connections: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Compute aggregated stats per app
    const appsWithStats = apps.map(app => ({
      ...app,
      totalDates: app.connections.reduce((sum, c) => sum + c._count.dates, 0),
      totalEncounters: app.connections.reduce((sum, c) => sum + c._count.encounters, 0)
    }));

    res.json(appsWithStats);
  } catch (error) {
    console.error('Error fetching dating apps:', error);
    res.status(500).json({ error: 'Failed to fetch dating apps' });
  }
};

// Create dating app
const createDatingApp = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'App name is required' });
    }

    const app = await prisma.datingApp.create({
      data: { name, description }
    });

    res.status(201).json(app);
  } catch (error) {
    console.error('Error creating dating app:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Dating app with this name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create dating app' });
  }
};

// Update dating app
const updateDatingApp = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'App name is required' });
    }

    const app = await prisma.datingApp.update({
      where: { id: parseInt(id) },
      data: { name, description }
    });

    res.json(app);
  } catch (error) {
    console.error('Error updating dating app:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Dating app not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Dating app with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update dating app' });
  }
};

// Delete dating app
const deleteDatingApp = async (req, res) => {
  try {
    const { id } = req.params;

    const app = await prisma.datingApp.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { connections: true } } }
    });

    if (!app) {
      return res.status(404).json({ error: 'Dating app not found' });
    }

    if (app._count.connections > 0) {
      return res.status(409).json({
        error: `Cannot delete app "${app.name}" — it has ${app._count.connections} connection(s) linked to it. Reassign or delete those connections first.`
      });
    }

    await prisma.datingApp.delete({ where: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting dating app:', error);
    res.status(500).json({ error: 'Failed to delete dating app' });
  }
};

// Get dating stats
const getStats = async (req, res) => {
  try {
    const [
      totalConnections,
      activeConnections,
      totalDates,
      totalEncounters,
      avgResponseData
    ] = await Promise.all([
      prisma.connection.count(),
      prisma.connection.count({ where: { status: 'ACTIVE' } }),
      prisma.date.count(),
      prisma.encounter.count(),
      prisma.connection.aggregate({
        _avg: {
          responseRate: true,
          avgResponseTime: true
        }
      })
    ]);

    const stats = {
      totalConnections,
      activeConnections,
      totalDates,
      totalEncounters,
      responseRate: Math.round(avgResponseData._avg.responseRate || 0),
      avgResponseTime: Math.round(avgResponseData._avg.avgResponseTime || 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// Get messages for a connection
const getMessages = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const messages = await prisma.message.findMany({
      where: { connectionId: parseInt(connectionId) },
      orderBy: { timestamp: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Create a message
const createMessage = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { content, sender, timestamp, platform } = req.body;

    if (!content || !sender) {
      return res.status(400).json({ error: 'content and sender are required' });
    }

    const message = await prisma.message.create({
      data: {
        connectionId: parseInt(connectionId),
        content,
        sender,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        platform: platform || null
      }
    });

    // Increment messagesExchanged on the connection
    await prisma.connection.update({
      where: { id: parseInt(connectionId) },
      data: { messagesExchanged: { increment: 1 } }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

// Update a message
const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, sender, timestamp, platform } = req.body;

    const message = await prisma.message.update({
      where: { id: parseInt(id) },
      data: {
        ...(content !== undefined && { content }),
        ...(sender !== undefined && { sender }),
        ...(timestamp !== undefined && { timestamp: new Date(timestamp) }),
        ...(platform !== undefined && { platform: platform || null })
      }
    });

    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    if (error.code === 'P2025') return res.status(404).json({ error: 'Message not found' });
    res.status(500).json({ error: 'Failed to update message' });
  }
};

// Delete a message
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.findUnique({ where: { id: parseInt(id) } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    await prisma.message.delete({ where: { id: parseInt(id) } });

    // Decrement messagesExchanged
    await prisma.connection.update({
      where: { id: message.connectionId },
      data: { messagesExchanged: { decrement: 1 } }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

module.exports = {
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  getDates,
  getDate,
  createDate,
  updateDate,
  deleteDate,
  getEncounters,
  getEncounter,
  createEncounter,
  updateEncounter,
  deleteEncounter,
  getDatingApps,
  createDatingApp,
  updateDatingApp,
  deleteDatingApp,
  getMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  getStats
};

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
        screenshots: true
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

// Create new connection
const createConnection = async (req, res) => {
  try {
    const connectionData = req.body;
    
    // Ensure we have required fields
    if (!connectionData.guyName || !connectionData.appId) {
      return res.status(400).json({ error: 'Guy name and app ID are required' });
    }

    const connection = await prisma.connection.create({
      data: {
        ...connectionData,
        appId: parseInt(connectionData.appId)
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
    const updateData = req.body;

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
const getDates = async (req, res) => {
  try {
    const dates = await prisma.date.findMany({
      include: {
        connection: {
          include: {
            app: true
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

// Create new date
const createDate = async (req, res) => {
  try {
    const dateData = req.body;

    const date = await prisma.date.create({
      data: {
        ...dateData,
        connectionId: dateData.connectionId ? parseInt(dateData.connectionId) : null,
        dateTime: new Date(dateData.dateTime)
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

// Create new encounter
const createEncounter = async (req, res) => {
  try {
    const encounterData = req.body;

    const encounter = await prisma.encounter.create({
      data: {
        ...encounterData,
        connectionId: encounterData.connectionId ? parseInt(encounterData.connectionId) : null,
        dateId: encounterData.dateId ? parseInt(encounterData.dateId) : null,
        dateTime: new Date(encounterData.dateTime)
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

// Get dating apps
const getDatingApps = async (req, res) => {
  try {
    const apps = await prisma.datingApp.findMany({
      include: {
        _count: {
          select: {
            connections: true
          }
        }
      }
    });

    res.json(apps);
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

module.exports = {
  getConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  getDates,
  createDate,
  getEncounters,
  createEncounter,
  getDatingApps,
  createDatingApp,
  getStats
};

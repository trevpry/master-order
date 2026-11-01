const LibraryBackgroundSyncService = require('./libraryBackgroundSyncService');
const jellyfinSyncService = require('../jellyfinSyncService');

// Shared scheduler for the Jellyfin movie/TV library sync (interval: Settings.jellyfinSyncInterval)
const jellyfinBackgroundSync = new LibraryBackgroundSyncService({
  providerName: 'jellyfin',
  syncService: jellyfinSyncService,
  intervalSettingsKey: 'jellyfinSyncInterval',
  defaultIntervalHours: 12
});

module.exports = jellyfinBackgroundSync;

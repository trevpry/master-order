// Test settingsService import
console.log('Testing settingsService import...');

try {
  const settingsService = require('./settingsService');
  console.log('settingsService imported:', settingsService);
  console.log('getSettings type:', typeof settingsService.getSettings);
  console.log('Keys:', Object.keys(settingsService));
  
  if (settingsService.getSettings) {
    console.log('getSettings exists, testing call...');
    settingsService.getSettings().then(settings => {
      console.log('Settings retrieved successfully');
    }).catch(err => {
      console.error('Error calling getSettings:', err.message);
    });
  } else {
    console.error('getSettings function not found!');
  }
  
} catch (error) {
  console.error('Import error:', error);
}

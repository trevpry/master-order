const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/datingController');

// Connection routes
router.get('/connections', getConnections);
router.get('/connections/:id', getConnection);
router.post('/connections', createConnection);
router.put('/connections/:id', updateConnection);
router.delete('/connections/:id', deleteConnection);

// Date routes
router.get('/dates', getDates);
router.post('/dates', createDate);

// Encounter routes
router.get('/encounters', getEncounters);
router.post('/encounters', createEncounter);

// Dating app routes
router.get('/apps', getDatingApps);
router.post('/apps', createDatingApp);

// Stats route
router.get('/stats', getStats);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/datingController');

// Connection routes
router.get('/connections', getConnections);
router.get('/connections/:id', getConnection);
router.post('/connections', createConnection);
router.put('/connections/:id', updateConnection);
router.delete('/connections/:id', deleteConnection);

// Date routes
router.get('/dates', getDates);
router.get('/dates/:id', getDate);
router.post('/dates', createDate);
router.put('/dates/:id', updateDate);
router.delete('/dates/:id', deleteDate);

// Encounter routes
router.get('/encounters', getEncounters);
router.get('/encounters/:id', getEncounter);
router.post('/encounters', createEncounter);
router.put('/encounters/:id', updateEncounter);
router.delete('/encounters/:id', deleteEncounter);

// Dating app routes
router.get('/apps', getDatingApps);
router.post('/apps', createDatingApp);
router.put('/apps/:id', updateDatingApp);
router.delete('/apps/:id', deleteDatingApp);

// Stats route
router.get('/stats', getStats);

// Message routes (nested under connections)
router.get('/connections/:connectionId/messages', getMessages);
router.post('/connections/:connectionId/messages', createMessage);
router.put('/messages/:id', updateMessage);
router.delete('/messages/:id', deleteMessage);

// Photo routes (nested under connections)
const { upload, getPhotos, uploadPhotos, setProfilePhoto, deletePhoto } = require('../controllers/connectionPhotosController');
router.get('/connections/:connectionId/photos', getPhotos);
router.post('/connections/:connectionId/photos', upload.array('photos', 20), uploadPhotos);
router.put('/photos/:photoId/profile', setProfilePhoto);
router.delete('/photos/:photoId', deletePhoto);

module.exports = router;

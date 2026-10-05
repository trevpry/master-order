// Registry of publisher catalogues that can be searched and imported like Discogs releases.
const { createNaxosSource } = require('./naxosSource');

const PUBLISHERS = {
  naxos: {
    key: 'naxos',
    label: 'Naxos',
    description: 'Naxos Music Library catalogue (Naxos, Dynamic, Marco Polo, Ondine and other distributed labels)',
    createSource: createNaxosSource
  }
};

const listPublishers = () => Object.values(PUBLISHERS).map(({ key, label, description }) => ({ key, label, description }));

const getPublisher = (key) => PUBLISHERS[String(key || '').toLowerCase()] || null;

module.exports = { listPublishers, getPublisher };

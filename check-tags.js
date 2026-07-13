const { PrismaClient } = require('./server/node_modules/@prisma/client');
const p = new PrismaClient();
const names = ['Performer Count','Performer Race','Sex Acts','Masturbation','Oral Sex','Performer Oral','Performer Rimming','Anal Sex','Performer Positions','Cum Shot'];
p.stashTag.findMany({ where: { name: { in: names } }, select: { id: true, name: true, includeInClipTagging: true } })
  .then(r => {
    console.log('Found (' + r.length + '):', r.map(t => t.name));
    const missing = names.filter(n => !r.find(t => t.name === n));
    console.log('Missing (' + missing.length + '):', missing);
    p.$disconnect();
  });

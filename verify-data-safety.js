const fs = require('fs');
const path = require('path');

const entrypointPath = path.join(__dirname, 'docker-entrypoint.sh');

if (!fs.existsSync(entrypointPath)) {
  console.error(`ERROR: docker-entrypoint.sh not found at ${entrypointPath}`);
  process.exit(1);
}

const content = fs.readFileSync(entrypointPath, 'utf8');

const dangerousPatterns = [
  { pattern: /migrate reset/i, label: 'migrate reset' },
  { pattern: /prisma migrate reset/i, label: 'prisma migrate reset' },
  { pattern: /force-reset/i, label: 'force-reset' },
  { pattern: /DROP DATABASE|DROP TABLE|TRUNCATE|DELETE FROM/i, label: 'destructive SQL' },
];

const safetyPatterns = [
  /accept-data-loss=false/,
  /Will NOT attempt reset/,
  /DATA-SAFE/,
  /preserve your data/i,
];

const dangerousMatches = dangerousPatterns.filter(({ pattern }) => pattern.test(content));
const hasSafetySignal = safetyPatterns.some((pattern) => pattern.test(content));

if (dangerousMatches.length > 0) {
  console.error('FAILED: dangerous commands detected in docker-entrypoint.sh');
  for (const match of dangerousMatches) {
    console.error(` - ${match.label}`);
  }
  process.exit(1);
}

if (!hasSafetySignal) {
  console.error('FAILED: no explicit safety measures detected in docker-entrypoint.sh');
  process.exit(1);
}

console.log('PASSED: docker-entrypoint.sh contains safety guards and no destructive reset commands');
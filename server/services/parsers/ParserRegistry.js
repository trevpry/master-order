const AlienVsPredatorTimelineParser = require('./AlienVsPredatorTimelineParser');
const CssSelectorParser = require('./CssSelectorParser');
const DcuTimelineParser = require('./DcuTimelineParser');
const MarvelComicsParser = require('./MarvelComicsParser');
const McuTimelineParser = require('./McuTimelineParser');
const StarWarsTimelineParser = require('./StarWarsTimelineParser');

/**
 * Registry mapping parserType strings to parser instances.
 * Add new parsers here when creating custom list parsers.
 */
const parsers = {
  'avp-timeline': new AlienVsPredatorTimelineParser(),
  'css-selectors': new CssSelectorParser(),
  'dcu-timeline': new DcuTimelineParser(),
  'marvel-comics': new MarvelComicsParser(),
  'mcu-timeline': new McuTimelineParser(),
  'starwars-timeline': new StarWarsTimelineParser()
};

/**
 * Get a parser instance by type.
 * @param {string} parserType
 * @returns {BaseListParser}
 */
function getParser(parserType) {
  const parser = parsers[parserType];
  if (!parser) {
    throw new Error(`Unknown parser type: "${parserType}". Available: ${Object.keys(parsers).join(', ')}`);
  }
  return parser;
}

/**
 * Get all available parsers with their metadata.
 * @returns {Array<{type: string, name: string, description: string, configFields: Array}>}
 */
function getAvailableParsers() {
  return Object.entries(parsers).map(([type, parser]) => ({
    type,
    name: parser.name,
    description: parser.getDescription(),
    configFields: parser.getConfigFields()
  }));
}

module.exports = { getParser, getAvailableParsers };

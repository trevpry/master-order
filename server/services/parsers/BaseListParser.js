/**
 * Base class for list parsers.
 * Each parser knows how to fetch and extract items from a specific type of page.
 */
class BaseListParser {
  /**
   * @param {string} name - Human-readable parser name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Parse a page and return structured items.
   * @param {Object} config - ListScrapeConfig record
   * @returns {Promise<Array<{title: string, position: number, mediaType: string, itemUrl?: string, itemYear?: string}>>}
   */
  async parse(config) {
    throw new Error(`${this.name}: parse() not implemented`);
  }

  /**
   * Get a description of what this parser does (for UI display).
   * @returns {string}
   */
  getDescription() {
    return 'Base parser';
  }

  /**
   * Get the configuration fields this parser needs (for UI display).
   * @returns {Array<{name: string, label: string, required: boolean, type: string}>}
   */
  getConfigFields() {
    return [];
  }
}

module.exports = BaseListParser;

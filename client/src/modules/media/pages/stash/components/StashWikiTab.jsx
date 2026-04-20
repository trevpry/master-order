import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

/**
 * StashWikiTab - Tag wiki for the Stash section
 * Displays LLM-generated wiki pages for stash tags with relationships and descriptions.
 * Includes settings panel, lint system, and activity log.
 */
export default function StashWikiTab({ initialSlug = null }) {
  const [pages, setPages] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [activeView, setActiveView] = useState('wiki'); // 'wiki' | 'log' | 'settings' | 'lint'
  const [stats, setStats] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [correction, setCorrection] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const [settings, setSettings] = useState({ stashWikiAutoGenEnabled: false, stashWikiAutoGenInterval: 120 });
  const [schema, setSchema] = useState('');
  const [schemaExpanded, setSchemaExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lintResults, setLintResults] = useState(null);

  useEffect(() => {
    fetchPages();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchPages();
  }, [searchQuery]);

  useEffect(() => {
    if (activeSlug) {
      fetchPage(activeSlug);
    } else {
      setActivePage(null);
    }
  }, [activeSlug]);

  useEffect(() => {
    if (initialSlug) {
      setActiveSlug(initialSlug);
      setActiveView('wiki');
    }
  }, [initialSlug]);

  const fetchPages = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/stash-wiki/pages?${params}`);
      const json = await res.json();
      if (json.success) setPages(json.data);
    } catch (err) {
      console.error('Failed to fetch stash wiki pages:', err);
    }
  };

  const fetchPage = async (slug) => {
    try {
      const res = await fetch(`/api/stash-wiki/pages/${slug}`);
      const json = await res.json();
      if (json.success) setActivePage(json.data);
    } catch (err) {
      console.error('Failed to fetch stash wiki page:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stash-wiki/stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('Failed to fetch stash wiki stats:', err);
    }
  };

  const fetchLog = async () => {
    try {
      const res = await fetch('/api/stash-wiki/log?limit=100');
      const json = await res.json();
      if (json.success) setLog(json.data);
    } catch (err) {
      console.error('Failed to fetch stash wiki log:', err);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stash-wiki/generate', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchPages();
        await fetchStats();
        alert(`Generated ${json.data.pages.length} wiki pages from ${json.data.processed} tags`);
      } else {
        alert('Generation failed: ' + (json.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Generate failed:', err);
      alert('Generation failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (slug) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stash-wiki/pages/${slug}/regenerate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setActivePage(json.data);
        await fetchPages();
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
      alert('Regeneration failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleCorrect = async (slug) => {
    if (!correction.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stash-wiki/pages/${slug}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction })
      });
      const json = await res.json();
      if (json.success) {
        setActivePage(json.data);
        setCorrection('');
        setShowCorrection(false);
        await fetchPages();
      }
    } catch (err) {
      console.error('Correction failed:', err);
      alert('Correction failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePage = async (slug) => {
    if (!confirm(`Delete wiki page "${slug}"?`)) return;
    try {
      await fetch(`/api/stash-wiki/pages/${slug}`, { method: 'DELETE' });
      setActiveSlug(null);
      await fetchPages();
      await fetchStats();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleWikiLinkClick = useCallback((slug) => {
    setActiveSlug(slug);
    setActiveView('wiki');
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/stash-wiki/settings');
      const json = await res.json();
      if (json.success) {
        setSettings({
          stashWikiAutoGenEnabled: json.data.stashWikiAutoGenEnabled,
          stashWikiAutoGenInterval: json.data.stashWikiAutoGenInterval
        });
      }
    } catch (err) {
      console.error('Failed to fetch stash wiki settings:', err);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await fetch('/api/stash-wiki/schema');
      const json = await res.json();
      if (json.success) setSchema(json.data.schema);
    } catch (err) {
      console.error('Failed to fetch stash wiki schema:', err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/stash-wiki/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    } catch (err) {
      console.error('Failed to save stash wiki settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveSchema = async () => {
    setSaving(true);
    try {
      await fetch('/api/stash-wiki/schema', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema })
      });
    } catch (err) {
      console.error('Failed to save stash wiki schema:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLint = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stash-wiki/lint', { method: 'POST' });
      const json = await res.json();
      if (json.success) setLintResults(json.data);
    } catch (err) {
      console.error('Lint failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-10rem)]">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-700 flex flex-col bg-gray-900/50">
        {/* View Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeView === 'wiki' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveView('wiki')}
          >
            📖 Wiki
          </button>
          <button
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeView === 'lint' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => { setActiveView('lint'); if (!lintResults) handleLint(); }}
          >
            🔍 Lint
          </button>
          <button
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeView === 'log' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => { setActiveView('log'); fetchLog(); }}
          >
            📋 Log
          </button>
          <button
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeView === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => { setActiveView('settings'); fetchSettings(); fetchSchema(); }}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="px-3 py-2 border-b border-gray-700 text-xs text-gray-400 flex gap-3">
            <span title="Wiki pages">📄 {stats.totalPages}</span>
            <span title="Tags total">🏷️ {stats.totalTags}</span>
            <span title="Tags without pages">📝 {stats.tagsWithoutPages}</span>
          </div>
        )}

        {/* Search */}
        <div className="p-2 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Generate Button */}
        <div className="p-2 border-b border-gray-700">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm text-white"
          >
            {loading ? '⏳ Processing...' : '🤖 Generate from Tags'}
          </button>
        </div>

        {/* Page List */}
        <div className="flex-1 overflow-y-auto">
          {pages.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No wiki pages yet.
              <br />Click "Generate from Tags" to start.
            </div>
          ) : (
            pages.map(page => (
              <button
                key={page.slug}
                onClick={() => { setActiveSlug(page.slug); setActiveView('wiki'); }}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                  activeSlug === page.slug ? 'bg-gray-800 text-white' : 'text-gray-300'
                }`}
              >
                <div className="font-medium truncate">{page.title}</div>
                <div className="text-xs text-gray-500">
                  {page.tagId ? '🏷️' : '📄'} {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {activeView === 'wiki' && (
          activePage ? (
            <div className="max-w-4xl mx-auto p-6">
              {/* Page Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{activePage.title}</h1>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {activePage.tagId && <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">🏷️ Tag</span>}
                    {activePage.tagId && (
                      <Link
                        to={`/media/stash/tags/${activePage.tagId}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded"
                      >
                        Open Tag
                      </Link>
                    )}
                    <span>Updated {new Date(activePage.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCorrection(!showCorrection)}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs text-white"
                    title="Submit a correction"
                  >
                    ✏️ Correct
                  </button>
                  <button
                    onClick={() => handleRegenerate(activePage.slug)}
                    disabled={loading}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-xs text-white"
                    title="Regenerate with LLM"
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    onClick={() => handleDeletePage(activePage.slug)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs text-white"
                    title="Delete page"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Correction Input */}
              {showCorrection && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-200 mb-2">Describe what should be corrected:</p>
                  <textarea
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder='e.g., "This tag actually refers to..." or "The relationship with X is wrong because..."'
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-yellow-500"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleCorrect(activePage.slug)}
                      disabled={loading || !correction.trim()}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded text-xs text-white"
                    >
                      {loading ? 'Applying...' : 'Apply Correction'}
                    </button>
                    <button
                      onClick={() => { setShowCorrection(false); setCorrection(''); }}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Links */}
              {(activePage.inboundLinks?.length > 0 || activePage.outboundLinks?.length > 0) && (
                <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                  {activePage.outboundLinks?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 mr-2">Links to:</span>
                      {activePage.outboundLinks.map(slug => (
                        <button
                          key={slug}
                          onClick={() => handleWikiLinkClick(slug)}
                          className="inline-block mr-1 mb-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                        >
                          [[{slug}]]
                        </button>
                      ))}
                    </div>
                  )}
                  {activePage.inboundLinks?.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500 mr-2">Linked from:</span>
                      {activePage.inboundLinks.map(slug => (
                        <button
                          key={slug}
                          onClick={() => handleWikiLinkClick(slug)}
                          className="inline-block mr-1 mb-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-xs hover:bg-green-500/30"
                        >
                          [[{slug}]]
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Page Content (Markdown rendering) */}
              <div className="prose prose-invert max-w-none">
                <MarkdownRenderer content={activePage.content} onWikiLinkClick={handleWikiLinkClick} />
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <div className="text-6xl mb-4">🏷️</div>
              <h2 className="text-2xl font-bold mb-2">Stash Tag Wiki</h2>
              <p className="text-center max-w-md mb-6">
                AI-generated knowledge base for your Stash tags. Describes each tag, maps relationships, and helps identify relevant tags for scene descriptions.
              </p>
              {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.totalPages}</div>
                    <div className="text-sm text-gray-500">Wiki Pages</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.totalTags}</div>
                    <div className="text-sm text-gray-500">Total Tags</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-400">{stats.tagsWithoutPages}</div>
                    <div className="text-sm text-gray-500">Unprocessed</div>
                  </div>
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white"
              >
                {loading ? '⏳ Generating...' : '🤖 Generate Wiki from Tags'}
              </button>
            </div>
          )
        )}

        {activeView === 'log' && (
          <div className="max-w-4xl mx-auto p-6">
            <h2 className="text-xl font-bold text-white mb-4">Activity Log</h2>
            {log.length === 0 ? (
              <p className="text-gray-500">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {log.map(entry => (
                  <div key={entry.id} className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.action === 'generate' ? 'bg-blue-500/20 text-blue-300' :
                        entry.action === 'correct' ? 'bg-yellow-500/20 text-yellow-300' :
                        entry.action === 'merge' ? 'bg-purple-500/20 text-purple-300' :
                        entry.action === 'delete' ? 'bg-red-500/20 text-red-300' :
                        entry.action === 'lint' ? 'bg-cyan-500/20 text-cyan-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>
                        {entry.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{entry.description}</p>
                    {entry.affectedPages?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.affectedPages.map(slug => (
                          <button
                            key={slug}
                            onClick={() => { setActiveSlug(slug); setActiveView('wiki'); }}
                            className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs hover:text-white"
                          >
                            {slug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'settings' && (
          <div className="max-w-3xl mx-auto p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Tag Wiki Settings</h2>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Auto-Generation</h3>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-gray-200">Auto-Generate Wiki Pages</div>
                  <div className="text-xs text-gray-500">Automatically generate wiki pages for new tags on a schedule</div>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, stashWikiAutoGenEnabled: !s.stashWikiAutoGenEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.stashWikiAutoGenEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.stashWikiAutoGenEnabled ? 'left-[22px]' : 'left-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-gray-200">Generation Interval</div>
                  <div className="text-xs text-gray-500">How often to check for new tags to process (minutes)</div>
                </div>
                <input
                  type="number"
                  min={10}
                  max={1440}
                  value={settings.stashWikiAutoGenInterval}
                  onChange={e => setSettings(s => ({ ...s, stashWikiAutoGenInterval: parseInt(e.target.value) || 120 }))}
                  className="w-24 bg-gray-800 text-gray-200 text-sm rounded px-3 py-1.5 border border-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Tag Wiki Schema</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Instructions that tell the AI how to generate and maintain tag wiki pages.
                  </p>
                </div>
                <button
                  onClick={() => setSchemaExpanded(!schemaExpanded)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {schemaExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {schemaExpanded && (
                <>
                  <textarea
                    value={schema}
                    onChange={e => setSchema(e.target.value)}
                    rows={20}
                    className="w-full bg-gray-800 text-gray-200 text-sm font-mono rounded-lg p-4 border border-gray-700 focus:border-blue-500 focus:outline-none resize-y"
                  />
                  <button
                    onClick={saveSchema}
                    disabled={saving}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white text-sm"
                  >
                    {saving ? 'Saving...' : 'Save Schema'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {activeView === 'lint' && (
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Wiki Health Check</h2>
              <button
                onClick={handleLint}
                disabled={loading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded text-sm text-white"
              >
                {loading ? '⏳ Scanning...' : '🔍 Run Lint'}
              </button>
            </div>

            {lintResults ? (
              <>
                <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <span className="text-sm text-gray-300">
                    Scanned <strong className="text-white">{lintResults.totalPages}</strong> pages — 
                    found <strong className={lintResults.issues.length === 0 ? 'text-green-400' : 'text-yellow-400'}>
                      {lintResults.issues.length}
                    </strong> issues
                  </span>
                </div>

                {lintResults.issues.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">✅</div>
                    <p>No issues found — wiki is healthy!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lintResults.issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-gray-900 rounded-lg border border-gray-800 flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                          issue.type === 'broken-link' ? 'bg-red-500/20 text-red-300' :
                          issue.type === 'orphan' ? 'bg-yellow-500/20 text-yellow-300' :
                          issue.type === 'stale' ? 'bg-orange-500/20 text-orange-300' :
                          issue.type === 'empty' ? 'bg-gray-500/20 text-gray-300' :
                          issue.type === 'missing-tag' ? 'bg-red-500/20 text-red-300' :
                          issue.type === 'no-embedding' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {issue.type}
                        </span>
                        <div>
                          <button
                            onClick={() => { setActiveSlug(issue.page); setActiveView('wiki'); }}
                            className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {issue.page}
                          </button>
                          <p className="text-xs text-gray-500 mt-0.5">{issue.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>Click "Run Lint" to scan wiki pages for issues.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simple Markdown renderer with wiki-link support
 */
function MarkdownRenderer({ content, onWikiLinkClick }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={i} className="bg-gray-800 rounded-lg p-4 overflow-x-auto my-3 text-sm">
            <code className="text-green-300">{codeContent}</code>
          </pre>
        );
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3">{renderInline(line.slice(2), onWikiLinkClick)}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-xl font-semibold text-gray-200 mt-5 mb-2 border-b border-gray-700 pb-1">{renderInline(line.slice(3), onWikiLinkClick)}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-lg font-medium text-gray-300 mt-4 mb-1">{renderInline(line.slice(4), onWikiLinkClick)}</h3>);
      continue;
    }

    if (line.startsWith('> ')) {
      const isWarning = line.includes('⚠️');
      elements.push(
        <blockquote key={i} className={`border-l-4 pl-4 py-1 my-2 ${
          isWarning ? 'border-yellow-500 bg-yellow-500/10 text-yellow-200' : 'border-gray-600 text-gray-400'
        }`}>
          {renderInline(line.slice(2), onWikiLinkClick)}
        </blockquote>
      );
      continue;
    }

    if (line.match(/^[\s]*[-*]\s/)) {
      const indent = line.match(/^(\s*)/)[1].length;
      const text = line.replace(/^[\s]*[-*]\s/, '');
      elements.push(
        <div key={i} className="flex gap-2 text-gray-300 my-0.5" style={{ marginLeft: `${indent * 8 + 16}px` }}>
          <span className="text-gray-500 flex-shrink-0">•</span>
          <span>{renderInline(text, onWikiLinkClick)}</span>
        </div>
      );
      continue;
    }

    elements.push(<p key={i} className="text-gray-300 my-1">{renderInline(line, onWikiLinkClick)}</p>);
  }

  return <>{elements}</>;
}

function renderInline(text, onWikiLinkClick) {
  if (!text) return text;

  // Split on wiki-links [[slug]], bold **text**, and inline code `text`
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Wiki links
    const wikiMatch = remaining.match(/\[\[([^\]]+)\]\]/);
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    // Find the earliest match
    let earliest = null;
    let earliestIdx = remaining.length;

    if (wikiMatch && wikiMatch.index < earliestIdx) {
      earliest = 'wiki';
      earliestIdx = wikiMatch.index;
    }
    if (boldMatch && boldMatch.index < earliestIdx) {
      earliest = 'bold';
      earliestIdx = boldMatch.index;
    }
    if (codeMatch && codeMatch.index < earliestIdx) {
      earliest = 'code';
      earliestIdx = codeMatch.index;
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    // Add text before the match
    if (earliestIdx > 0) {
      parts.push(remaining.substring(0, earliestIdx));
    }

    if (earliest === 'wiki') {
      const slug = wikiMatch[1];
      parts.push(
        <button
          key={`wiki-${key++}`}
          onClick={() => onWikiLinkClick?.(slug)}
          className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
        >
          {slug}
        </button>
      );
      remaining = remaining.substring(wikiMatch.index + wikiMatch[0].length);
    } else if (earliest === 'bold') {
      parts.push(<strong key={`bold-${key++}`} className="text-white font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
    } else if (earliest === 'code') {
      parts.push(<code key={`code-${key++}`} className="bg-gray-800 px-1.5 py-0.5 rounded text-yellow-300 text-sm">{codeMatch[1]}</code>);
      remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

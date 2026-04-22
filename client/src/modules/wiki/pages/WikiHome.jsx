import React, { useState, useEffect, useCallback } from 'react';
import WikiSidebar from '../components/WikiSidebar';
import WikiPageViewer from '../components/WikiPageViewer';
import WikiLog from '../components/WikiLog';
import WikiSettings from '../components/WikiSettings';

const WikiHome = () => {
  const [pages, setPages] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [activeView, setActiveView] = useState('wiki'); // 'wiki' | 'log' | 'settings'
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ type: '', category: '', search: '' });

  useEffect(() => {
    fetchPages();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchPages();
  }, [filters]);

  useEffect(() => {
    if (activeSlug) {
      fetchPage(activeSlug);
    } else {
      setActivePage(null);
    }
  }, [activeSlug]);

  const fetchPages = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.category) params.set('category', filters.category);
      if (filters.search) params.set('search', filters.search);
      const res = await fetch(`/api/wiki/pages?${params}`);
      const json = await res.json();
      if (json.success) setPages(json.data);
    } catch (err) {
      console.error('Failed to fetch wiki pages:', err);
    }
  };

  const fetchPage = async (slug) => {
    try {
      const res = await fetch(`/api/wiki/pages/${slug}`);
      const json = await res.json();
      if (json.success) setActivePage(json.data);
    } catch (err) {
      console.error('Failed to fetch wiki page:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/wiki/stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('Failed to fetch wiki stats:', err);
    }
  };

  const handleIngestAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/ingest/all', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchPages();
        await fetchStats();
        alert(`Ingested ${json.data.processed} notes into ${json.data.pages.length} wiki pages`);
      }
    } catch (err) {
      console.error('Ingest failed:', err);
      alert('Ingest failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleBackfillChat = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/backfill-chat', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchPages();
        await fetchStats();
        alert(`Processed ${json.data.processed} chat messages for wiki extraction`);
      }
    } catch (err) {
      console.error('Backfill failed:', err);
      alert('Chat backfill failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleIngestDating = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/ingest/dating', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchPages();
        await fetchStats();
        alert(`Processed ${json.data.processed} dating records into ${json.data.pages.length} wiki pages`);
      }
    } catch (err) {
      console.error('Dating ingest failed:', err);
      alert('Dating ingest failed — is Ollama running?');
    } finally {
      setLoading(false);
    }
  };

  const handleLint = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/lint', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        const { issues, totalPages } = json.data;
        alert(`Lint: ${issues.length} issues found across ${totalPages} pages`);
        await fetchStats();
      }
    } catch (err) {
      console.error('Lint failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePage = async (slug) => {
    if (!confirm(`Delete wiki page "${slug}"?`)) return;
    try {
      await fetch(`/api/wiki/pages/${slug}`, { method: 'DELETE' });
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-950">
      {/* Sidebar */}
      <WikiSidebar
        pages={pages}
        activeSlug={activeSlug}
        onSelectPage={setActiveSlug}
        activeView={activeView}
        onViewChange={setActiveView}
        stats={stats}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {activeView === 'wiki' && (
          activePage ? (
            <WikiPageViewer
              page={activePage}
              onWikiLinkClick={handleWikiLinkClick}
              onDelete={() => handleDeletePage(activePage.slug)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold mb-2">Personal Wiki</h2>
              <p className="text-center max-w-md mb-6">
                Your AI-maintained knowledge base. Notes and chat conversations are synthesized into structured, interlinked wiki pages.
              </p>
              {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.totalPages}</div>
                    <div className="text-sm text-gray-500">Pages</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.recentActivity}</div>
                    <div className="text-sm text-gray-500">Recent Updates</div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {stats.chatExtractionEnabled ? 'On' : 'Off'}
                    </div>
                    <div className="text-sm text-gray-500">Chat Extract</div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleIngestAll}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm"
                >
                  {loading ? 'Processing...' : 'Seed Wiki from Notes'}
                </button>
                <button
                  onClick={handleBackfillChat}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-white text-sm"
                >
                  {loading ? 'Processing...' : 'Backfill from Chat'}
                </button>
                <button
                  onClick={handleIngestDating}
                  disabled={loading}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 rounded-lg text-white text-sm"
                >
                  {loading ? 'Processing...' : 'Ingest Dating Data'}
                </button>
                <button
                  onClick={handleLint}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-white text-sm"
                >
                  Lint Wiki
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'log' && <WikiLog />}
        {activeView === 'settings' && (
          <WikiSettings onSettingsChanged={() => fetchStats()} />
        )}
      </div>
    </div>
  );
};

export default WikiHome;

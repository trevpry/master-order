import React, { useState, useEffect } from 'react';

const ChatSettings = ({ settings, onSaved, connected, models }) => {
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://localhost:11434');
  const [ollamaDefaultModel, setOllamaDefaultModel] = useState(settings.ollamaDefaultModel || '');
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState(settings.ollamaEmbeddingModel || 'nomic-embed-text');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState(null);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    fetchEmbeddingStatus();
  }, []);

  const fetchEmbeddingStatus = async () => {
    try {
      const res = await fetch('/api/chat/embeddings/status');
      const json = await res.json();
      if (json.success) setEmbeddingStatus(json.data);
    } catch (err) {
      console.error('Failed to fetch embedding status:', err);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/chat/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ollamaUrl })
      });
      const json = await res.json();
      if (json.success && json.data.connected) {
        setTestResult({ ok: true, message: `Connected! ${json.data.models} model(s) available.` });
      } else {
        setTestResult({ ok: false, message: 'Connection failed.' });
      }
    } catch (err) {
      setTestResult({ ok: false, message: `Connection failed: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaUrl, ollamaDefaultModel, ollamaEmbeddingModel })
      });
      const json = await res.json();
      if (json.success) {
        onSaved(json.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      let hasMore = true;
      while (hasMore) {
        const res = await fetch('/api/chat/embeddings/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize: 50 })
        });
        const json = await res.json();
        if (json.success) {
          await fetchEmbeddingStatus();
          hasMore = json.data.processed > 0 && json.data.processed === json.data.total;
        } else {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error('Backfill failed:', err);
    } finally {
      setBackfilling(false);
      fetchEmbeddingStatus();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Ollama Settings</h2>
        <p className="text-sm text-gray-500 mb-6">
          Configure your connection to a local Ollama instance for AI chat.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Ollama URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ollama URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleTestConnection}
                disabled={testing || !ollamaUrl}
                className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <p className={`mt-2 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? '✓' : '✗'} {testResult.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              The URL where your Ollama instance is running. Default is http://localhost:11434
            </p>
          </div>

          {/* Default Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Chat Model
            </label>
            {models.length > 0 ? (
              <select
                value={ollamaDefaultModel}
                onChange={(e) => setOllamaDefaultModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a model...</option>
                {models.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaDefaultModel}
                onChange={(e) => setOllamaDefaultModel(e.target.value)}
                placeholder="llama3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              The model to use by default for new conversations. You can change models per conversation.
            </p>
          </div>

          {/* Embedding Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Embedding Model (Memory/RAG)
            </label>
            {models.length > 0 ? (
              <select
                value={ollamaEmbeddingModel}
                onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a model...</option>
                {models.map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={ollamaEmbeddingModel}
                onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
                placeholder="nomic-embed-text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              Used for cross-conversation memory. Run <code className="bg-gray-100 px-1 rounded">ollama pull nomic-embed-text</code> to install the recommended model.
            </p>
          </div>

          {/* Memory / Embeddings Status */}
          {embeddingStatus && (
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-purple-800">Cross-Conversation Memory</h4>
                <span className="text-xs text-purple-600">
                  {embeddingStatus.embedded}/{embeddingStatus.total} messages indexed
                </span>
              </div>
              {embeddingStatus.total > 0 && (
                <div className="w-full bg-purple-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.round((embeddingStatus.embedded / embeddingStatus.total) * 100)}%` }}
                  />
                </div>
              )}
              {embeddingStatus.pending > 0 && (
                <button
                  onClick={handleBackfill}
                  disabled={backfilling}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-xs font-medium"
                >
                  {backfilling ? 'Indexing...' : `Index ${embeddingStatus.pending} remaining message${embeddingStatus.pending !== 1 ? 's' : ''}`}
                </button>
              )}
              {embeddingStatus.pending === 0 && embeddingStatus.total > 0 && (
                <p className="text-xs text-purple-600">All messages indexed — memory is up to date.</p>
              )}
            </div>
          )}

          {/* Connection Status */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-600">
              {connected
                ? `Connected to Ollama — ${models.length} model(s) available`
                : 'Not connected to Ollama'}
            </span>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && (
              <span className="text-sm text-green-600">✓ Settings saved</span>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-blue-50 rounded-lg border border-blue-100 p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Getting Started with Ollama</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Install Ollama from <span className="font-mono">ollama.com</span></li>
            <li>Run <code className="bg-blue-100 px-1 rounded">ollama pull llama3</code> to download a chat model</li>
            <li>Run <code className="bg-blue-100 px-1 rounded">ollama pull nomic-embed-text</code> for memory support</li>
            <li>Start Ollama — it runs on port 11434 by default</li>
            <li>Enter the URL above and test the connection</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ChatSettings;

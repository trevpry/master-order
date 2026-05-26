import React, { useState, useEffect } from 'react';
import { formatDate } from '../utils/dateFormat';

const WikiLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLog();
  }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/log?limit=100');
      const json = await res.json();
      if (json.success) setLogs(json.data);
    } catch (err) {
      console.error('Failed to fetch wiki log:', err);
    } finally {
      setLoading(false);
    }
  };

  const actionIcons = {
    'ingest': '📥',
    'update': '✏️',
    'lint': '🔍',
    'query-filed': '💾',
    'chat-extract': '💬'
  };

  const actionColors = {
    'ingest': 'text-blue-400',
    'update': 'text-green-400',
    'lint': 'text-yellow-400',
    'query-filed': 'text-purple-400',
    'chat-extract': 'text-pink-400'
  };

  const sourceTypeLabels = {
    'note': 'Note',
    'daily_note': 'Daily Note',
    'chat': 'Chat',
    'manual': 'Manual',
    'lint': 'Lint'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading log...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Wiki Activity Log</h2>
        <button
          onClick={fetchLog}
          className="text-sm text-gray-400 hover:text-white px-3 py-1 bg-gray-800 rounded"
        >
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No wiki activity yet. Ingest some notes to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{actionIcons[log.action] || '📄'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${actionColors[log.action] || 'text-gray-300'}`}>
                        {log.action}
                      </span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                        {sourceTypeLabels[log.sourceType] || log.sourceType}
                      </span>
                      {log.sourceId && (
                        <span className="text-xs text-gray-500">#{log.sourceId}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-1">{log.description}</p>
                    {log.affectedPages?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {log.affectedPages.map(slug => (
                          <span key={slug} className="text-xs bg-gray-800 text-blue-400 px-2 py-0.5 rounded">
                            [[{slug}]]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {formatDate(log.createdAt, { includeTime: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WikiLog;

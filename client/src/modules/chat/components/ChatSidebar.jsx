import React, { useState } from 'react';

const ChatSidebar = ({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onOpenSettings,
  activeView,
  connected
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startRename = (conv) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="w-72 bg-gray-900 text-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={onNew}
          disabled={!connected}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span> New Conversation
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No conversations yet
          </div>
        ) : (
          <ul className="py-1">
            {conversations.map(conv => (
              <li
                key={conv.id}
                className={`group relative px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors ${
                  activeConversationId === conv.id && activeView === 'chat' ? 'bg-gray-800' : ''
                }`}
                onClick={() => onSelect(conv.id)}
              >
                {editingId === conv.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full bg-gray-700 text-white text-sm px-2 py-1 rounded outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="text-sm font-medium truncate pr-16">
                      {conv.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                      <span>{conv.model}</span>
                      <span>·</span>
                      <span>{formatDate(conv.updatedAt)}</span>
                      {conv._count?.messages > 0 && (
                        <>
                          <span>·</span>
                          <span>{conv._count.messages} msgs</span>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                      <button
                        title="Rename"
                        onClick={(e) => { e.stopPropagation(); startRename(conv); }}
                        className="p-1 text-gray-400 hover:text-white rounded text-xs"
                      >
                        ✏️
                      </button>
                      {confirmDeleteId === conv.id ? (
                        <button
                          title="Confirm delete"
                          onClick={(e) => { e.stopPropagation(); onDelete(conv.id); setConfirmDeleteId(null); }}
                          className="p-1 text-red-400 hover:text-red-300 rounded text-xs"
                        >
                          ✓
                        </button>
                      ) : (
                        <button
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(conv.id); }}
                          className="p-1 text-gray-400 hover:text-red-400 rounded text-xs"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={onOpenSettings}
          className={`w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${
            activeView === 'settings'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <span>⚙️</span> Ollama Settings
        </button>
        <div className="mt-2 px-1 flex items-center gap-2 text-xs text-gray-500">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;

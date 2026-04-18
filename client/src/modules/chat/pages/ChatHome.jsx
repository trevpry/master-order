import React, { useState, useEffect } from 'react';
import ChatSidebar from '../components/ChatSidebar';
import ChatInterface from '../components/ChatInterface';
import ChatSettings from '../components/ChatSettings';

const ChatHome = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'settings'
  const [models, setModels] = useState([]);
  const [settings, setSettings] = useState({ ollamaUrl: '', ollamaDefaultModel: '' });
  const [connected, setConnected] = useState(false);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
    fetchSettings();
  }, []);

  // Load models when settings change
  useEffect(() => {
    if (settings.ollamaUrl) {
      fetchModels();
    }
  }, [settings.ollamaUrl]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
      const json = await res.json();
      if (json.success) setConversations(json.data);
    } catch {
      // Ollama may not be connected yet
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/chat/settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch {
      // Settings not available yet
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/chat/models');
      const json = await res.json();
      if (json.success) {
        setModels(json.data);
        setConnected(true);
      }
    } catch {
      setModels([]);
      setConnected(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.ollamaDefaultModel })
      });
      const json = await res.json();
      if (json.success) {
        setConversations(prev => [json.data, ...prev]);
        setActiveConversationId(json.data.id);
        setActiveView('chat');
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleRenameConversation = async (id, title) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const json = await res.json();
      if (json.success) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
      }
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  };

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
    fetchModels();
  };

  const handleConversationUpdated = () => {
    fetchConversations();
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={(id) => { setActiveConversationId(id); setActiveView('chat'); }}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onOpenSettings={() => setActiveView('settings')}
        activeView={activeView}
        connected={connected}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeView === 'settings' ? (
          <ChatSettings
            settings={settings}
            onSaved={handleSettingsSaved}
            connected={connected}
            models={models}
          />
        ) : activeConversationId ? (
          <ChatInterface
            conversationId={activeConversationId}
            models={models}
            defaultModel={settings.ollamaDefaultModel}
            onConversationUpdated={handleConversationUpdated}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold mb-2">Eddie AI Chat</h2>
              <p className="mb-4">Chat with local AI models through Ollama</p>
              {connected ? (
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start a New Conversation
                </button>
              ) : (
                <p className="text-sm text-amber-600">
                  Configure Ollama connection in Settings to get started
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHome;

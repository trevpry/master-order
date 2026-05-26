import React, { useState, useEffect } from 'react';

const WikiSettings = ({ onSettingsChanged }) => {
  const [settings, setSettings] = useState({
    wikiContextEnabled: true,
    wikiAutoIngestEnabled: true,
    wikiAutoIngestInterval: 60,
    wikiChatExtractionEnabled: true,
    ollamaWikiExtractionModel: '',
    ollamaChatExtractionModel: '',
    ollamaNotesExtractionModel: '',
    ollamaDatingExtractionModel: ''
  });
  const [schema, setSchema] = useState('');
  const [saving, setSaving] = useState(false);
  const [schemaExpanded, setSchemaExpanded] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSchema();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/wiki/settings');
      const json = await res.json();
      if (json.success) {
        setSettings({
          wikiContextEnabled: json.data.wikiContextEnabled,
          wikiAutoIngestEnabled: json.data.wikiAutoIngestEnabled,
          wikiAutoIngestInterval: json.data.wikiAutoIngestInterval,
          wikiChatExtractionEnabled: json.data.wikiChatExtractionEnabled,
          ollamaWikiExtractionModel: json.data.ollamaWikiExtractionModel || '',
          ollamaChatExtractionModel: json.data.ollamaChatExtractionModel || '',
          ollamaNotesExtractionModel: json.data.ollamaNotesExtractionModel || '',
          ollamaDatingExtractionModel: json.data.ollamaDatingExtractionModel || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch wiki settings:', err);
    }
  };

  const fetchSchema = async () => {
    try {
      const res = await fetch('/api/wiki/schema');
      const json = await res.json();
      if (json.success) setSchema(json.data.schema);
    } catch (err) {
      console.error('Failed to fetch wiki schema:', err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/wiki/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      onSettingsChanged?.();
    } catch (err) {
      console.error('Failed to save wiki settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveSchema = async () => {
    setSaving(true);
    try {
      await fetch('/api/wiki/schema', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema })
      });
    } catch (err) {
      console.error('Failed to save wiki schema:', err);
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Wiki Settings</h2>

      {/* Toggles */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Behavior</h3>

        <Toggle
          label="Wiki Context in Chat"
          description="Include wiki knowledge in AI chat system prompts"
          checked={settings.wikiContextEnabled}
          onChange={v => setSettings(s => ({ ...s, wikiContextEnabled: v }))}
        />

        <Toggle
          label="Chat Extraction"
          description="Automatically extract personal facts from chat conversations into the wiki"
          checked={settings.wikiChatExtractionEnabled}
          onChange={v => setSettings(s => ({ ...s, wikiChatExtractionEnabled: v }))}
        />

        <Toggle
          label="Auto-Ingest Notes"
          description="Automatically ingest modified notes on a schedule"
          checked={settings.wikiAutoIngestEnabled}
          onChange={v => setSettings(s => ({ ...s, wikiAutoIngestEnabled: v }))}
        />

        <div className="flex items-center justify-between py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">Ingest Interval</div>
            <div className="text-xs text-gray-500">How often to check for new/modified notes (minutes)</div>
          </div>
          <input
            type="number"
            min={5}
            max={1440}
            value={settings.wikiAutoIngestInterval}
            onChange={e => setSettings(s => ({ ...s, wikiAutoIngestInterval: parseInt(e.target.value) || 60 }))}
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

      {/* Extraction Models */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Extraction Models</h3>
        <p className="text-xs text-gray-500 mb-4">
          Optional per-source model overrides for wiki extraction. Leave blank to use the default extraction model chain.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Generic Wiki Extraction Model</label>
            <input
              type="text"
              value={settings.ollamaWikiExtractionModel}
              onChange={e => setSettings(s => ({ ...s, ollamaWikiExtractionModel: e.target.value }))}
              placeholder="e.g. llama3.1:8b-instruct"
              className="w-full bg-gray-800 text-gray-200 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Fallback extraction model for any source without a source-specific override.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Chat Extraction Model</label>
            <input
              type="text"
              value={settings.ollamaChatExtractionModel}
              onChange={e => setSettings(s => ({ ...s, ollamaChatExtractionModel: e.target.value }))}
              placeholder="e.g. mistral:latest"
              className="w-full bg-gray-800 text-gray-200 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Notes Extraction Model</label>
            <input
              type="text"
              value={settings.ollamaNotesExtractionModel}
              onChange={e => setSettings(s => ({ ...s, ollamaNotesExtractionModel: e.target.value }))}
              placeholder="e.g. llama3:latest"
              className="w-full bg-gray-800 text-gray-200 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Dating Extraction Model</label>
            <input
              type="text"
              value={settings.ollamaDatingExtractionModel}
              onChange={e => setSettings(s => ({ ...s, ollamaDatingExtractionModel: e.target.value }))}
              placeholder="e.g. llama3.1:latest"
              className="w-full bg-gray-800 text-gray-200 text-sm rounded px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white text-sm"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Schema Editor */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Wiki Schema (Layer 3)</h3>
            <p className="text-xs text-gray-500 mt-1">
              These instructions tell the AI how to maintain your wiki — formatting, categories, extraction rules.
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
  );
};

export default WikiSettings;

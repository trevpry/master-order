import React, { useEffect, useState } from 'react';
import { historyPlusApi } from '../services/historyPlusApi';
import LoadingSpinner from '../../../components/LoadingSpinner';
import {
  buildExistingEventsCsv,
  downloadCsvFile,
  getExistingEventsCsvFileName
} from '../utils/existingEventsCsv';

const PromptTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKeys, setSavingKeys] = useState({});
  const [statusByKey, setStatusByKey] = useState({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await historyPlusApi.getPromptTemplates();
      setTemplates(response.data?.templates || []);
      setError(null);
    } catch (loadError) {
      console.error('Error loading AI prompt templates:', loadError);
      setError('Failed to load AI prompt templates');
    } finally {
      setLoading(false);
    }
  };

  const updateTemplateValue = (templateKey, value) => {
    setTemplates(prevTemplates => prevTemplates.map(template => (
      template.key === templateKey
        ? { ...template, template: value }
        : template
    )));
  };

  const setTemplateStatus = (templateKey, message) => {
    setStatusByKey(prev => ({
      ...prev,
      [templateKey]: message
    }));

    setTimeout(() => {
      setStatusByKey(prev => {
        if (prev[templateKey] !== message) {
          return prev;
        }

        const next = { ...prev };
        delete next[templateKey];
        return next;
      });
    }, 2500);
  };

  const handleSaveTemplate = async (templateKey) => {
    const currentTemplate = templates.find(template => template.key === templateKey);
    if (!currentTemplate) {
      return;
    }

    try {
      setSavingKeys(prev => ({ ...prev, [templateKey]: true }));
      const response = await historyPlusApi.savePromptTemplate(templateKey, currentTemplate.template || '');
      const payload = response.data || {};

      setTemplates(prevTemplates => prevTemplates.map(template => (
        template.key === templateKey
          ? {
              ...template,
              ...payload
            }
          : template
      )));

      setTemplateStatus(templateKey, 'Saved');
    } catch (saveError) {
      console.error(`Error saving ${templateKey} prompt template:`, saveError);
      setTemplateStatus(templateKey, 'Save failed');
    } finally {
      setSavingKeys(prev => ({ ...prev, [templateKey]: false }));
    }
  };

  const handleResetTemplate = async (templateKey) => {
    try {
      setSavingKeys(prev => ({ ...prev, [templateKey]: true }));
      const response = await historyPlusApi.savePromptTemplate(templateKey, '');
      const payload = response.data || {};

      setTemplates(prevTemplates => prevTemplates.map(template => (
        template.key === templateKey
          ? {
              ...template,
              ...payload
            }
          : template
      )));

      setTemplateStatus(templateKey, 'Reset to default');
    } catch (resetError) {
      console.error(`Error resetting ${templateKey} prompt template:`, resetError);
      setTemplateStatus(templateKey, 'Reset failed');
    } finally {
      setSavingKeys(prev => ({ ...prev, [templateKey]: false }));
    }
  };

  const handleDownloadExistingEventsCsv = async (templateKey) => {
    try {
      const response = await historyPlusApi.getEvents();
      const events = response.data?.events || response.data || response.events || [];
      const fileName = getExistingEventsCsvFileName(`${templateKey}-prompt-template`);
      downloadCsvFile(fileName, buildExistingEventsCsv(events));
      setTemplateStatus(templateKey, `Downloaded ${fileName}`);
    } catch (downloadError) {
      console.error(`Error exporting existing events CSV for ${templateKey}:`, downloadError);
      setTemplateStatus(templateKey, 'CSV export failed');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading AI prompt templates..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Prompt Templates</h1>
          <p className="mt-2 text-gray-600">
            Review and edit every History Plus prompt template in one place.
          </p>
        </div>
        <button
          onClick={loadTemplates}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
        Changes here apply to Timeline event prompts, video assignment, course assignment, and book chapter/section import prompts.
      </div>

      <div className="space-y-6">
        {templates.map(template => (
          <section key={template.key} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{template.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${template.isCustom ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {template.isCustom ? 'Custom' : 'Default'}
                </span>
              </div>
            </div>

            <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Template</label>
                <textarea
                  value={template.template || ''}
                  onChange={(event) => updateTemplateValue(template.key, event.target.value)}
                  className="min-h-[320px] w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter AI prompt template..."
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleSaveTemplate(template.key)}
                    disabled={Boolean(savingKeys[template.key])}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingKeys[template.key] ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleResetTemplate(template.key)}
                    disabled={Boolean(savingKeys[template.key])}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset to Default
                  </button>
                  {statusByKey[template.key] && (
                    <span className="text-sm text-gray-600">{statusByKey[template.key]}</span>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">Available Placeholders</h3>
                  <ul className="mt-3 space-y-2 text-sm text-gray-700">
                    {(template.placeholders || []).map(placeholder => (
                      <li key={placeholder} className="rounded-md bg-white px-3 py-2 font-mono text-xs text-gray-800 shadow-sm">
                        {placeholder}
                      </li>
                    ))}
                    {(!template.placeholders || template.placeholders.length === 0) && (
                      <li className="text-gray-500">No placeholders provided.</li>
                    )}
                  </ul>
                  {template.placeholders?.includes('{{EXISTING_EVENTS}}') && (
                    <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
                      <p className="text-xs text-gray-700">
                        {'{{EXISTING_EVENTS}}'} should be supplied as a CSV export with columns: Event Title, Start Date, End Date, Event Description.
                      </p>
                      <button
                        onClick={() => handleDownloadExistingEventsCsv(template.key)}
                        className="mt-3 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                      >
                        Download Existing Events CSV
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">Default Template Snapshot</h3>
                  <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white px-3 py-3 text-xs text-gray-700 shadow-sm">
                    {template.defaultTemplate || 'No default template available.'}
                  </pre>
                </div>
              </aside>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default PromptTemplates;
import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus,
  Save,
  X,
  Zap,
  FileText,
  Calendar,
  Tag,
  Folder
} from 'lucide-react';
import Button from '../../shared/components/Button';

// Extract the form component outside to prevent re-creation
const QuickCaptureForm = ({ 
  formData, 
  setFormData, 
  tagInput, 
  setTagInput, 
  folders, 
  saving, 
  titleInputRef, 
  contentInputRef, 
  handleClose, 
  handleSave, 
  handleTagInputKeyDown, 
  removeTag, 
  typeOptions 
}) => (
  <>
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      <div className="flex items-center space-x-2">
        <Zap className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-900">
          Quick Capture
        </h3>
      </div>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
    </div>

    {/* Form */}
    <div className="p-4 space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          ref={titleInputRef}
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter note title..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              contentInputRef.current?.focus();
            }
          }}
        />
      </div>

      {/* Type and Folder */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {typeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folder
          </label>
          <select
            value={formData.folderId || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              folderId: e.target.value ? parseInt(e.target.value) : null 
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No folder</option>
            {folders.map(folder => (
              <option key={folder.id} value={folder.id}>
                {folder.name} ({folder.noteCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          {formData.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder={formData.tags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-20 outline-none text-sm"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Press Enter or comma to add tags
        </p>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <textarea
          ref={contentInputRef}
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          placeholder="Write your note content..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleSave();
            }
          }}
        />
        <p className="text-xs text-gray-500 mt-1">
          Ctrl+Enter to save quickly
        </p>
      </div>
    </div>

    {/* Footer */}
    <div className="flex justify-end space-x-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
      <Button
        variant="secondary"
        onClick={handleClose}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={saving || !formData.title.trim()}
      >
        <Save className="h-4 w-4 mr-1" />
        {saving ? 'Saving...' : 'Save Note'}
      </Button>
    </div>
  </>
);

const QuickCapture = ({ 
  onNoteCreated, 
  defaultType = 'note',
  className = '',
  compact = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: defaultType,
    tags: [],
    folderId: null
  });
  const [tagInput, setTagInput] = useState('');
  const [folders, setFolders] = useState([]);
  
  const titleInputRef = useRef(null);
  const contentInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus title input when opened
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      
      // Load folders
      loadFolders();
    }
  }, [isOpen]);

  useEffect(() => {
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/notes/folders');
      if (response.ok) {
        const result = await response.json();
        setFolders(result.data || []);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setFormData({
      title: '',
      content: '',
      type: defaultType,
      tags: [],
      folderId: null
    });
    setTagInput('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData({
      title: '',
      content: '',
      type: defaultType,
      tags: [],
      folderId: null
    });
    setTagInput('');
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      titleInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const noteData = {
        ...formData,
        title: formData.title.trim(),
        content: formData.content.trim()
      };

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const result = await response.json();
      
      if (onNoteCreated) {
        onNoteCreated(result.data);
      }

      handleClose();
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Error creating note: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0) {
      // Remove last tag if input is empty
      setFormData(prev => ({
        ...prev,
        tags: prev.tags.slice(0, -1)
      }));
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const typeOptions = [
    { value: 'note', label: 'Note', icon: FileText, color: 'text-blue-600' },
    { value: 'journal', label: 'Journal', icon: Calendar, color: 'text-green-600' },
    { value: 'idea', label: 'Idea', icon: Zap, color: 'text-yellow-600' },
    { value: 'todo', label: 'Todo', icon: Plus, color: 'text-red-600' }
  ];

  if (compact) {
    return (
      <>
        {/* Compact Trigger Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpen}
          className={className}
          title="Quick Capture (Ctrl+N)"
        >
          <Plus className="h-4 w-4 mr-1" />
          Quick Note
        </Button>

        {/* Overlay Modal */}
        {isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <QuickCaptureForm 
                formData={formData}
                setFormData={setFormData}
                tagInput={tagInput}
                setTagInput={setTagInput}
                folders={folders}
                saving={saving}
                titleInputRef={titleInputRef}
                contentInputRef={contentInputRef}
                handleClose={handleClose}
                handleSave={handleSave}
                handleTagInputKeyDown={handleTagInputKeyDown}
                removeTag={removeTag}
                typeOptions={typeOptions}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Inline version (non-compact)
  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {!isOpen ? (
        <button
          onClick={handleOpen}
          className="w-full p-4 text-left hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-300 rounded-lg"
        >
          <div className="flex items-center space-x-2 text-gray-600">
            <Plus className="h-5 w-5" />
            <span>Quick capture a note...</span>
          </div>
        </button>
      ) : (
        <QuickCaptureForm 
          formData={formData}
          setFormData={setFormData}
          tagInput={tagInput}
          setTagInput={setTagInput}
          folders={folders}
          saving={saving}
          titleInputRef={titleInputRef}
          contentInputRef={contentInputRef}
          handleClose={handleClose}
          handleSave={handleSave}
          handleTagInputKeyDown={handleTagInputKeyDown}
          removeTag={removeTag}
          typeOptions={typeOptions}
        />
      )}
    </div>
  );
};

export default QuickCapture;

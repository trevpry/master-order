import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Save, 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image,
  Paperclip,
  Hash,
  Folder,
  Star,
  Eye,
  Edit3,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo
} from 'lucide-react';
import { Button } from '../ui/button';

const API_BASE = 'http://localhost:3001/api/notes';

const NoteEditor = ({ note, folders, tags, onSave, onClose, userId }) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [selectedTags, setSelectedTags] = useState(note?.tags || []);
  const [selectedFolder, setSelectedFolder] = useState(note?.folderId || null);
  const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
  const [isPublic, setIsPublic] = useState(note?.isPublic || false);
  const [newTag, setNewTag] = useState('');
  const [attachments, setAttachments] = useState(note?.attachments || []);
  const [links, setLinks] = useState(note?.links || []);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your note.');
      return;
    }

    setSaving(true);
    try {
      const noteData = {
        title: title.trim(),
        content,
        tags: selectedTags,
        folderId: selectedFolder,
        isFavorite,
        isPublic,
        attachments,
        links,
        userId,
        type: note?.type || 'note'
      };

      const url = note ? `${API_BASE}/${note.id}` : API_BASE;
      const method = note ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        throw new Error('Failed to save note');
      }

      const savedNote = await response.json();
      onSave(savedNote);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addTag = (tagName) => {
    const trimmedTag = tagName.trim().toLowerCase();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
    }
    setNewTag('');
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text:') || url;
    if (url) {
      const linkHtml = `<a href="${url}" class="text-blue-600 hover:underline" target="_blank" rel="noopener">${text}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const newAttachments = [];

    for (const file of files) {
      // In a real app, you'd upload to a file storage service
      const attachment = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file) // Temporary URL for preview
      };
      newAttachments.push(attachment);
    }

    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (attachmentId) => {
    setAttachments(attachments.filter(att => att.id !== attachmentId));
  };

  const handleKeyDown = (e) => {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault();
          handleSave();
          break;
        case 'b':
          e.preventDefault();
          formatText('bold');
          break;
        case 'i':
          e.preventDefault();
          formatText('italic');
          break;
        case 'u':
          e.preventDefault();
          formatText('underline');
          break;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Edit3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              {note ? 'Edit Note' : 'Create New Note'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
            >
              {showPreview ? <Edit3 className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Editor/Content */}
          <div className="flex-1 flex flex-col">
            {/* Title */}
            <div className="p-6 border-b">
              <input
                type="text"
                placeholder="Enter note title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-bold border-none outline-none placeholder-gray-400"
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Toolbar */}
            {!showPreview && (
              <div className="flex items-center gap-1 p-4 border-b bg-gray-50 overflow-x-auto">
                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  <button
                    onClick={() => formatText('bold')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Bold (Ctrl+B)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('italic')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Italic (Ctrl+I)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('underline')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Underline (Ctrl+U)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  <button
                    onClick={() => formatText('insertUnorderedList')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('insertOrderedList')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Numbered List"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('formatBlock', 'blockquote')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Quote"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  <button
                    onClick={() => formatText('justifyLeft')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('justifyCenter')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('justifyRight')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 border-r pr-2 mr-2">
                  <button
                    onClick={insertLink}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Insert Link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Attach File"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.txt,.md"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => formatText('undo')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Undo"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => formatText('redo')}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
                    title="Redo"
                  >
                    <Redo className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Content Editor/Preview */}
            <div className="flex-1 p-6 overflow-auto">
              {showPreview ? (
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <div
                  ref={editorRef}
                  contentEditable
                  className="w-full h-full outline-none prose max-w-none"
                  style={{ minHeight: '400px' }}
                  onInput={(e) => setContent(e.target.innerHTML)}
                  onKeyDown={handleKeyDown}
                  suppressContentEditableWarning={true}
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              )}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="p-4 border-t bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
                <div className="flex flex-wrap gap-2">
                  {attachments.map(attachment => (
                    <div key={attachment.id} className="flex items-center gap-2 bg-white p-2 rounded border">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{attachment.name}</span>
                      <button
                        onClick={() => removeAttachment(attachment.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l bg-gray-50 p-6 overflow-auto">
            <div className="space-y-6">
              {/* Note Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Note Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700 flex items-center">
                      <Star className="w-4 h-4 mr-2" />
                      Favorite
                    </label>
                    <input
                      type="checkbox"
                      checked={isFavorite}
                      onChange={(e) => setIsFavorite(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-700 flex items-center">
                      <Eye className="w-4 h-4 mr-2" />
                      Public
                    </label>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Folder Selection */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Folder className="w-4 h-4 mr-2" />
                  Category
                </label>
                <select
                  value={selectedFolder || ''}
                  onChange={(e) => setSelectedFolder(e.target.value || null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No category</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 mr-2" />
                  Tags
                </label>
                
                {/* Tag Input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(newTag);
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    size="sm"
                    onClick={() => addTag(newTag)}
                    disabled={!newTag.trim()}
                  >
                    Add
                  </Button>
                </div>

                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Popular Tags */}
                {tags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Popular tags:</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 8).map(tag => (
                        <button
                          key={tag.name}
                          onClick={() => addTag(tag.name)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        >
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Keyboard Shortcuts */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Keyboard Shortcuts</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Save</span>
                    <span className="font-mono">Ctrl+S</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bold</span>
                    <span className="font-mono">Ctrl+B</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Italic</span>
                    <span className="font-mono">Ctrl+I</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Underline</span>
                    <span className="font-mono">Ctrl+U</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;

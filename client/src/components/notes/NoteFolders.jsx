import React, { useState } from 'react';
import { 
  Folder, 
  FolderPlus, 
  ChevronRight, 
  ChevronDown,
  Edit3,
  Trash2,
  Plus
} from 'lucide-react';
import { Button } from '../ui/button';

const API_BASE = 'http://localhost:3001/api/notes/folders';

const NoteFolders = ({ folders, selectedFolder, onFolderSelect }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [editingFolder, setEditingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const createFolder = async (parentId = null) => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId,
          userId: 1 // Default user
        }),
      });

      if (response.ok) {
        setNewFolderName('');
        setShowNewFolder(false);
        // Refresh folders - in a real app, you'd call a refresh function
        window.location.reload();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const updateFolder = async (folderId, newName) => {
    try {
      const response = await fetch(`${API_BASE}/${folderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName.trim()
        }),
      });

      if (response.ok) {
        setEditingFolder(null);
        // Refresh folders
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating folder:', error);
    }
  };

  const deleteFolder = async (folderId) => {
    if (!confirm('Are you sure you want to delete this folder? All notes in this folder will be moved to "Uncategorized".')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/${folderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh folders
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  const buildFolderTree = (folders, parentId = null) => {
    return folders
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const renderFolder = (folder, depth = 0) => {
    const hasChildren = folders.some(f => f.parentId === folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder?.id === folder.id;
    const isEditing = editingFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center group hover:bg-gray-100 rounded-lg transition-colors ${
            isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <button
            onClick={() => onFolderSelect(folder)}
            className="flex items-center flex-1 py-2 px-2 hover:bg-gray-100 rounded transition-colors"
          >
            <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
            {isEditing ? (
              <input
                type="text"
                defaultValue={folder.name}
                className="flex-1 border border-blue-500 rounded px-2 py-1 text-sm"
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    updateFolder(folder.id, e.target.value);
                  } else {
                    setEditingFolder(null);
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur();
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null);
                  }
                }}
                autoFocus
              />
            ) : (
              <>
                <span className="flex-1 text-left truncate">{folder.name}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {folder.noteCount || 0}
                </span>
              </>
            )}
          </button>

          {/* Folder Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 mr-2 transition-opacity">
            <button
              onClick={() => setEditingFolder(folder.id)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Rename folder"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => deleteFolder(folder.id)}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete folder"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {buildFolderTree(folders, folder.id).map(childFolder =>
              renderFolder(childFolder, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = buildFolderTree(folders);

  return (
    <div className="space-y-1">
      {/* All Notes */}
      <button
        onClick={() => onFolderSelect(null)}
        className={`w-full flex items-center px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors ${
          !selectedFolder ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
        }`}
      >
        <Folder className="w-4 h-4 mr-3" />
        <span className="flex-1">All Notes</span>
        <span className="text-xs text-gray-400">
          {folders.reduce((sum, folder) => sum + (folder.noteCount || 0), 0)}
        </span>
      </button>

      {/* Folders */}
      {rootFolders.map(folder => renderFolder(folder))}

      {/* New Folder */}
      {showNewFolder ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <Folder className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                createFolder();
              } else if (e.key === 'Escape') {
                setShowNewFolder(false);
                setNewFolderName('');
              }
            }}
            onBlur={() => {
              if (newFolderName.trim()) {
                createFolder();
              } else {
                setShowNewFolder(false);
              }
            }}
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setShowNewFolder(true)}
          className="w-full flex items-center px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4 mr-3" />
          Create new category
        </button>
      )}
    </div>
  );
};

export default NoteFolders;

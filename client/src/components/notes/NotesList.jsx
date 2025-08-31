import React from 'react';
import { 
  FileText, 
  Calendar,
  Star, 
  Tag,
  Clock,
  Edit3,
  Trash2,
  Eye,
  Hash,
  Paperclip
} from 'lucide-react';

const NotesList = ({ 
  notes, 
  selectedNote, 
  onNoteSelect, 
  onNoteEdit, 
  onNoteDelete, 
  onNoteFavorite,
  activeView,
  searchQuery 
}) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = (now - date) / 1000;
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else if (diffInSeconds < 604800) {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const truncateContent = (content, maxLength = 150) => {
    // Remove HTML tags for preview
    const textContent = content.replace(/<[^>]*>/g, '');
    return textContent.length > maxLength 
      ? textContent.substring(0, maxLength) + '...' 
      : textContent;
  };

  const highlightSearchTerms = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  const getViewTitle = () => {
    switch (activeView) {
      case 'recent':
        return 'Recent Notes';
      case 'favorites':
        return 'Favorite Notes';
      case 'journal':
        return 'Journal Entries';
      default:
        return searchQuery ? `Search results for "${searchQuery}"` : 'All Notes';
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onNoteDelete(noteId);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  if (notes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery 
              ? `No notes match your search for "${searchQuery}"`
              : activeView === 'favorites'
              ? "You haven't favorited any notes yet"
              : activeView === 'journal'
              ? "You haven't created any journal entries yet"
              : "Create your first note to get started"
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{getViewTitle()}</h2>
          <span className="text-sm text-gray-500">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>
      </div>

      {/* Notes List */}
      <div className="divide-y divide-gray-200">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors group ${
              selectedNote?.id === note.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
            }`}
            onClick={() => onNoteSelect(note)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                  <span 
                    dangerouslySetInnerHTML={{ 
                      __html: highlightSearchTerms(note.title, searchQuery) 
                    }} 
                  />
                  {note.isFavorite && (
                    <Star className="inline w-4 h-4 ml-2 text-yellow-500 fill-current" />
                  )}
                </h3>

                {/* Content Preview */}
                {note.content && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                    <span 
                      dangerouslySetInnerHTML={{ 
                        __html: highlightSearchTerms(
                          truncateContent(note.content), 
                          searchQuery
                        ) 
                      }} 
                    />
                  </p>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(note.updatedAt)}
                  </div>
                  
                  {note.type === 'journal' && (
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Journal
                    </div>
                  )}

                  {note.attachments?.length > 0 && (
                    <div className="flex items-center">
                      <Paperclip className="w-3 h-3 mr-1" />
                      {note.attachments.length} {note.attachments.length === 1 ? 'file' : 'files'}
                    </div>
                  )}

                  {note.isPublic && (
                    <div className="flex items-center">
                      <Eye className="w-3 h-3 mr-1" />
                      Public
                    </div>
                  )}
                </div>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {note.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
                      >
                        <Hash className="w-2.5 h-2.5 mr-1" />
                        <span 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightSearchTerms(tag, searchQuery) 
                          }} 
                        />
                      </span>
                    ))}
                    {note.tags.length > 5 && (
                      <span className="text-xs text-gray-400">
                        +{note.tags.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNoteFavorite(note.id);
                  }}
                  className={`p-2 rounded-lg hover:bg-gray-200 transition-colors ${
                    note.isFavorite ? 'text-yellow-500' : 'text-gray-400'
                  }`}
                  title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star className={`w-4 h-4 ${note.isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNoteEdit(note);
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit note"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesList;

import React, { useState } from 'react';
import { 
  Edit3, 
  Trash2, 
  Star, 
  Share2, 
  Download,
  Calendar,
  Clock,
  Tag,
  Folder,
  Eye,
  Hash,
  Paperclip,
  ExternalLink,
  Copy,
  Link2,
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';

const NotePreview = ({ note, onEdit, onDelete, onFavorite }) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleShareNote = async () => {
    if (!note.isPublic) {
      alert('Note must be public to share. Edit the note and make it public first.');
      return;
    }

    const shareUrl = `${window.location.origin}/notes/${note.id}`;
    await copyToClipboard(shareUrl);
    setShowShareMenu(false);
  };

  const handleExportNote = () => {
    // Create a text version of the note
    const textContent = note.content.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
    const noteText = `# ${note.title}\n\n${textContent}\n\n---\nTags: ${note.tags?.join(', ') || 'None'}\nCreated: ${formatDate(note.createdAt)}\nModified: ${formatDate(note.updatedAt)}`;
    
    // Create and download file
    const blob = new Blob([noteText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteNote = async () => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/notes/${note.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  const renderContent = (content) => {
    // Basic HTML rendering with safety
    const cleanContent = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, ''); // Remove iframes
    
    return { __html: cleanContent };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight pr-4">
            {note.title}
            {note.isFavorite && (
              <Star className="inline w-5 h-5 ml-2 text-yellow-500 fill-current" />
            )}
          </h1>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onFavorite(note.id)}
              className={`p-2 rounded-lg transition-colors ${
                note.isFavorite 
                  ? 'text-yellow-500 hover:bg-yellow-50' 
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
              }`}
              title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${note.isFavorite ? 'fill-current' : ''}`} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Share note"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {showShareMenu && (
                <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
                  <div className="p-2">
                    <button
                      onClick={handleShareNote}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      {copied ? 'Link copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={handleExportNote}
                      className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as text
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit note"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeleteNote}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Created {formatDate(note.createdAt)}
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Modified {formatDate(note.updatedAt)}
          </div>
          {note.isPublic && (
            <div className="flex items-center text-green-600">
              <Eye className="w-4 h-4 mr-1" />
              Public
            </div>
          )}
          {note.type === 'journal' && (
            <div className="flex items-center text-blue-600">
              <Calendar className="w-4 h-4 mr-1" />
              Journal Entry
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {note.content ? (
            <div 
              className="prose max-w-none text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={renderContent(note.content)}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>This note is empty.</p>
              <Button
                onClick={onEdit}
                variant="outline"
                className="mt-4"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Add content
              </Button>
            </div>
          )}
        </div>

        {/* Attachments */}
        {note.attachments && note.attachments.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Paperclip className="w-4 h-4 mr-2" />
              Attachments ({note.attachments.length})
            </h3>
            <div className="space-y-2">
              {note.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Paperclip className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{attachment.name}</p>
                      <p className="text-xs text-gray-500">
                        {(attachment.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {attachment.type?.startsWith('image/') && (
                      <button
                        onClick={() => window.open(attachment.url, '_blank')}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="View image"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => window.open(attachment.url, '_blank')}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {note.links && note.links.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <Link2 className="w-4 h-4 mr-2" />
              Links ({note.links.length})
            </h3>
            <div className="space-y-2">
              {note.links.map((link, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center min-w-0">
                    <ExternalLink className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {link.title || link.url}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{link.url}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(link.url, '_blank')}
                    className="p-1 text-gray-400 hover:text-blue-600 ml-2 flex-shrink-0"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Tags and Folder */}
      <div className="p-6 border-t bg-gray-50">
        {note.folder && (
          <div className="mb-3 flex items-center text-sm text-gray-600">
            <Folder className="w-4 h-4 mr-2" />
            <span>{note.folder.name}</span>
          </div>
        )}

        {note.tags && note.tags.length > 0 && (
          <div>
            <div className="flex items-center mb-2 text-sm text-gray-600">
              <Tag className="w-4 h-4 mr-2" />
              <span>Tags:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {(!note.tags || note.tags.length === 0) && !note.folder && (
          <div className="text-center text-gray-500 text-sm">
            <p>No tags or category assigned</p>
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <Tag className="w-4 h-4 mr-2" />
              Add tags
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotePreview;

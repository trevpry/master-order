import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter,
  Folder,
  Tag,
  Clock,
  Star,
  BookOpen,
  Calendar,
  Hash,
  Edit3,
  Trash2,
  Share2,
  Link2,
  Paperclip,
  Download,
  Upload,
  Eye
} from 'lucide-react';
import { Button } from '../components/ui/button';
import NoteEditor from '../components/notes/NoteEditor';
import NoteFolders from '../components/notes/NoteFolders';
import NotesList from '../components/notes/NotesList';
import NotePreview from '../components/notes/NotePreview';

const API_BASE = 'http://localhost:3001/api/notes';

const Notes = () => {
  const [activeView, setActiveView] = useState('all'); // all, recent, favorites, journal
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Data states
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [favoriteNotes, setFavoriteNotes] = useState([]);
  const [todayJournal, setTodayJournal] = useState(null);
  const [stats, setStats] = useState({ totalNotes: 0, totalTags: 0, totalFolders: 0 });
  const [loading, setLoading] = useState(true);

  // User state
  const [userId] = useState(1); // Default user

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadNotes(),
        loadFolders(),
        loadTags(),
        loadStats(),
        loadTodayJournal()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await fetch(`${API_BASE}?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result; // Handle wrapped response
        
        console.log('Loading notes - received data:', data);
        
        setNotes(Array.isArray(data) ? data : []);
        
        // Filter recent and favorite notes
        if (Array.isArray(data)) {
          const recent = data
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 10);
          setRecentNotes(recent);
          
          const favorites = data.filter(note => note.isFavorite);
          setFavoriteNotes(favorites);
        }
      } else {
        console.error('Failed to load notes:', response.status, response.statusText);
        setNotes([]);
        setRecentNotes([]);
        setFavoriteNotes([]);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotes([]);
      setRecentNotes([]);
      setFavoriteNotes([]);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/folders?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result; // Handle wrapped response
        
        console.log('Loading folders - received data:', data);
        
        setFolders(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to load folders:', response.status, response.statusText);
        setFolders([]);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
      setFolders([]);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch(`${API_BASE}/tags?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result; // Handle wrapped response
        setTags(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      setTags([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result; // Handle wrapped response
        setStats(data || {});
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({});
    }
  };

  const loadTodayJournal = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${API_BASE}/journal/${today}?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setTodayJournal(data);
      }
    } catch (error) {
      console.error('Error loading today journal:', error);
    }
  };

  const createNewNote = () => {
    setEditingNote(null);
    setShowEditor(true);
  };

  const createNewJournalEntry = async () => {
    const today = new Date();
    const journalNote = {
      title: `Journal - ${today.toLocaleDateString()}`,
      content: '',
      type: 'journal',
      tags: ['journal'],
      userId
    };
    
    setEditingNote(journalNote);
    setShowEditor(true);
  };

  const handleNoteCreated = (newNote) => {
    setNotes(prev => [newNote, ...prev]);
    setStats(prev => ({ ...prev, totalNotes: prev.totalNotes + 1 }));
    setShowEditor(false);
    loadInitialData(); // Refresh all data
  };

  const handleNoteUpdated = (updatedNote) => {
    setNotes(prev => prev.map(note => 
      note.id === updatedNote.id ? updatedNote : note
    ));
    setShowEditor(false);
    loadInitialData(); // Refresh all data
  };

  const handleNoteDeleted = (noteId) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setStats(prev => ({ ...prev, totalNotes: prev.totalNotes - 1 }));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
  };

  const toggleNoteFavorite = async (noteId) => {
    try {
      const response = await fetch(`${API_BASE}/${noteId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        loadNotes(); // Refresh notes
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getFilteredNotes = () => {
    let filtered = notes;

    // Filter by view
    if (activeView === 'recent') {
      filtered = recentNotes;
    } else if (activeView === 'favorites') {
      filtered = favoriteNotes;
    } else if (activeView === 'journal') {
      filtered = notes.filter(note => note.type === 'journal');
    }

    // Filter by folder
    if (selectedFolder) {
      filtered = filtered.filter(note => note.folderId === selectedFolder.id);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(note =>
        selectedTags.every(tag => note.tags.includes(tag))
      );
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome to Eddie Notes</h1>
                <p className="text-gray-600 text-sm">
                  Organize your thoughts, ideas, and knowledge in one place
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>

              {/* Create Note Button */}
              <Button onClick={createNewNote}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Note
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3">
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={createNewNote}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Note
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveView('all')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Browse All Notes
                  </Button>
                </div>
              </div>

              {/* Quick Access */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
                <div className="space-y-2">
                  <button
                    onClick={createNewJournalEntry}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors ${
                      activeView === 'journal' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4 mr-3" />
                    Today's journal
                  </button>
                  <button
                    onClick={() => setActiveView('recent')}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors ${
                      activeView === 'recent' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 mr-3" />
                    Recent notes ({recentNotes.length})
                  </button>
                  <button
                    onClick={() => setActiveView('favorites')}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors ${
                      activeView === 'favorites' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <Star className="w-4 h-4 mr-3" />
                    Favorite notes ({favoriteNotes.length})
                  </button>
                </div>
              </div>

              {/* Categories/Folders */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
                {folders.length === 0 ? (
                  <div className="text-center py-4">
                    <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No categories yet</p>
                    <p className="text-gray-400 text-xs">Start organizing your notes!</p>
                  </div>
                ) : (
                  <NoteFolders
                    folders={Array.isArray(folders) ? folders : []}
                    selectedFolder={selectedFolder}
                    onFolderSelect={setSelectedFolder}
                  />
                )}
              </div>

              {/* Knowledge Base Stats */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  Knowledge Base
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Notes created</span>
                    <span className="font-semibold text-blue-600">{stats.totalNotes}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tags used</span>
                    <span className="font-semibold text-blue-600">{stats.totalTags}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Categories</span>
                    <span className="font-semibold text-blue-600">{stats.totalFolders}</span>
                  </div>
                </div>
              </div>

              {/* Popular Tags */}
              {tags.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Hash className="w-5 h-5 mr-2" />
                    Popular Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 10).map(tag => (
                      <button
                        key={tag.name}
                        onClick={() => {
                          const newTags = selectedTags.includes(tag.name)
                            ? selectedTags.filter(t => t !== tag.name)
                            : [...selectedTags, tag.name];
                          setSelectedTags(newTags);
                        }}
                        className={`px-2 py-1 rounded-full text-xs transition-colors ${
                          selectedTags.includes(tag.name)
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        } border`}
                      >
                        #{tag.name} ({tag.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-6">
            <NotesList
              notes={getFilteredNotes()}
              selectedNote={selectedNote}
              onNoteSelect={setSelectedNote}
              onNoteEdit={(note) => {
                setEditingNote(note);
                setShowEditor(true);
              }}
              onNoteDelete={handleNoteDeleted}
              onNoteFavorite={toggleNoteFavorite}
              activeView={activeView}
              searchQuery={searchQuery}
            />
          </div>

          {/* Preview Pane */}
          <div className="col-span-3">
            {selectedNote ? (
              <NotePreview
                note={selectedNote}
                onEdit={() => {
                  setEditingNote(selectedNote);
                  setShowEditor(true);
                }}
                onDelete={() => handleNoteDeleted(selectedNote.id)}
                onFavorite={() => toggleNoteFavorite(selectedNote.id)}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a note</h3>
                <p className="text-gray-500 text-sm">
                  Choose a note from the list to view its content and details here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note Editor Modal */}
      {showEditor && (
        <NoteEditor
          note={editingNote}
          folders={Array.isArray(folders) ? folders : []}
          tags={Array.isArray(tags) ? tags : []}
          onSave={editingNote ? handleNoteUpdated : handleNoteCreated}
          onClose={() => setShowEditor(false)}
          userId={userId}
        />
      )}
    </div>
  );
};

export default Notes;

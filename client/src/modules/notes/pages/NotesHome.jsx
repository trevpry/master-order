import React from 'react';
import Button from '../../../shared/components/Button';

function NotesHome() {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Notes & Knowledge</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Welcome to Eddie Notes</h2>
          <p className="text-gray-600 mb-4">
            Organize your thoughts, ideas, and knowledge in one place. This module will include:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
            <li>Rich text note-taking with formatting</li>
            <li>Hierarchical note organization with folders</li>
            <li>Tag-based categorization and search</li>
            <li>Cross-linking between notes</li>
            <li>File attachments and media embedding</li>
            <li>Collaboration and sharing features</li>
          </ul>
          <Button variant="primary" className="mr-4">
            Create New Note
          </Button>
          <Button variant="secondary">
            Browse All Notes
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-800 mb-2">Quick Access</h3>
            <ul className="text-indigo-700 text-sm space-y-1">
              <li>• Today's journal</li>
              <li>• Recent notes</li>
              <li>• Favorite notes</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">Categories</h3>
            <p className="text-yellow-700 text-sm">No categories yet<br />Start organizing your notes!</p>
          </div>
          
          <div className="bg-pink-50 rounded-lg p-4">
            <h3 className="font-semibold text-pink-800 mb-2">Knowledge Base</h3>
            <p className="text-pink-700 text-sm">0 notes created<br />0 tags used</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotesHome;

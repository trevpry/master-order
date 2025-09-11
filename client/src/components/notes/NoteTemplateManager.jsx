import React, { useState, useEffect } from 'react';
import { 
  Plus,
  Edit3,
  Trash2,
  Star,
  FileText,
  Calendar,
  Save,
  X,
  Copy
} from 'lucide-react';
import Button from '../../shared/components/Button';

const NoteTemplateManager = ({ 
  onTemplateSelect, 
  className = '',
  showCreateButton = true 
}) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    type: 'daily',
    variables: [],
    isDefault: false
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/notes/templates');
      if (response.ok) {
        const result = await response.json();
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      type: 'daily',
      variables: [],
      isDefault: false
    });
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setIsCreating(true);
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      type: template.type,
      variables: JSON.parse(template.variables || '[]'),
      isDefault: template.isDefault
    });
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      const templateData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        variables: formData.variables
      };

      let response;
      if (editingTemplate) {
        response = await fetch(`/api/notes/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });
      } else {
        response = await fetch('/api/notes/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });
      }

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      await loadTemplates();
      setIsCreating(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template: ' + error.message);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/notes/templates/${template.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template: ' + error.message);
    }
  };

  const handleUseTemplate = (template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      type: 'daily',
      variables: [],
      isDefault: false
    });
  };

  const getDefaultDailyTemplate = () => {
    return `# {{date}}

## Morning Reflection
- How am I feeling today?
- What are my priorities?
- What am I excited about?

## Goals for Today
- [ ] 
- [ ] 
- [ ] 

## Daily Habits
- [ ] Exercise
- [ ] Read
- [ ] Meditate
- [ ] Drink water

## Notes & Thoughts
_Capture thoughts, ideas, and observations throughout the day..._

## Evening Reflection
- What went well today?
- What could I improve?
- What challenges did I face?

## Gratitude
- 
- 
- 

---
*Created on {{timestamp}}*`;
  };

  const getDefaultWeeklyTemplate = () => {
    return `# Week of {{date}}

## Weekly Goals
- [ ] 
- [ ] 
- [ ] 

## Priority Projects
1. 
2. 
3. 

## This Week's Focus
_What is the main theme or focus for this week?_

## Monday
### Goals:
- [ ] 
### Notes:


## Tuesday
### Goals:
- [ ] 
### Notes:


## Wednesday
### Goals:
- [ ] 
### Notes:


## Thursday
### Goals:
- [ ] 
### Notes:


## Friday
### Goals:
- [ ] 
### Notes:


## Weekend Plans
### Saturday:
- 

### Sunday:
- 

## Weekly Review
- What did I accomplish?
- What did I learn?
- What will I do differently next week?

---
*Created on {{timestamp}}*`;
  };

  const insertPredefinedTemplate = (type) => {
    let content = '';
    let name = '';
    
    switch (type) {
      case 'daily':
        content = getDefaultDailyTemplate();
        name = 'Daily Note Template';
        break;
      case 'weekly':
        content = getDefaultWeeklyTemplate();
        name = 'Weekly Review Template';
        break;
      case 'meeting':
        content = `# {{title}} - Meeting Notes

**Date:** {{date}}
**Attendees:** 

## Agenda
1. 
2. 
3. 

## Discussion Points
- 
- 
- 

## Action Items
- [ ] 
- [ ] 
- [ ] 

## Next Steps
- 

## Follow-up
- 

---
*Meeting notes from {{timestamp}}*`;
        name = 'Meeting Notes Template';
        break;
      case 'project':
        content = `# {{title}} - Project Notes

**Started:** {{date}}
**Status:** In Progress

## Project Overview
_Brief description of the project..._

## Goals & Objectives
- 
- 
- 

## Tasks
- [ ] 
- [ ] 
- [ ] 

## Resources
- 
- 

## Notes & Ideas
_Capture thoughts and ideas as the project progresses..._

## Challenges
- 

## Next Steps
- 

---
*Project notes created on {{timestamp}}*`;
        name = 'Project Notes Template';
        break;
    }
    
    setFormData(prev => ({
      ...prev,
      name,
      content,
      type
    }));
  };

  const typeOptions = [
    { value: 'daily', label: 'Daily', icon: Calendar, color: 'text-blue-600' },
    { value: 'weekly', label: 'Weekly', icon: Calendar, color: 'text-green-600' },
    { value: 'project', label: 'Project', icon: FileText, color: 'text-purple-600' },
    { value: 'meeting', label: 'Meeting', icon: FileText, color: 'text-orange-600' },
    { value: 'custom', label: 'Custom', icon: FileText, color: 'text-gray-600' }
  ];

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Note Templates
          </h3>
        </div>
        
        {showCreateButton && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateTemplate}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        )}
      </div>

      {/* Template Form */}
      {isCreating && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </h4>
          
          <div className="space-y-4">
            {/* Name and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
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
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the template..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Templates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Start Templates
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => insertPredefinedTemplate('daily')}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Daily
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => insertPredefinedTemplate('weekly')}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Weekly
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => insertPredefinedTemplate('meeting')}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Meeting
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => insertPredefinedTemplate('project')}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Project
                </Button>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Template content... Use {{variable}} for placeholders like {{date}}, {{title}}, {{timestamp}}"
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use variables like {{date}}, {{title}}, {{timestamp}} for dynamic content
              </p>
            </div>

            {/* Options */}
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Set as default template for this type
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                onClick={handleCancel}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveTemplate}
                disabled={!formData.name.trim()}
              >
                <Save className="h-4 w-4 mr-1" />
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No templates created yet</p>
            {showCreateButton && (
              <Button
                variant="primary"
                onClick={handleCreateTemplate}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Template
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map(template => {
              const typeOption = typeOptions.find(opt => opt.value === template.type);
              const TypeIcon = typeOption?.icon || Template;
              
              return (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <TypeIcon className={`h-5 w-5 ${typeOption?.color || 'text-gray-600'}`} />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">
                          {template.name}
                        </h4>
                        {template.isDefault && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500 capitalize">
                          {template.type}
                        </span>
                        <span className="text-xs text-gray-400">
                          Updated {new Date(template.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {onTemplateSelect && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                        title="Use this template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                      title="Edit template"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template)}
                      title="Delete template"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteTemplateManager;

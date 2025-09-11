import React, { useState, useEffect } from 'react';
import Button from '../../../shared/components/Button';

const GoalForm = ({ goal, onSubmit, onCancel, projects }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'PERSONAL',
    priority: 'MEDIUM',
    targetValue: '',
    unit: '',
    deadline: '',
    projectId: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (goal) {
      setFormData({
        title: goal.title || '',
        description: goal.description || '',
        category: goal.category || 'PERSONAL',
        priority: goal.priority || 'MEDIUM',
        targetValue: goal.targetValue?.toString() || '',
        unit: goal.unit || '',
        deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
        projectId: goal.projectId || ''
      });
    }
  }, [goal]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Goal title is required';
    }

    if (formData.targetValue && isNaN(Number(formData.targetValue))) {
      newErrors.targetValue = 'Target value must be a number';
    }

    if (formData.deadline) {
      const deadline = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadline < today) {
        newErrors.deadline = 'Deadline cannot be in the past';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        targetValue: formData.targetValue ? Number(formData.targetValue) : null,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        projectId: formData.projectId || null
      };
      
      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const categoryOptions = [
    { value: 'PERSONAL', label: 'Personal', icon: '👤' },
    { value: 'PROFESSIONAL', label: 'Professional', icon: '💼' },
    { value: 'HEALTH', label: 'Health & Fitness', icon: '🏃‍♂️' },
    { value: 'FINANCIAL', label: 'Financial', icon: '💰' },
    { value: 'LEARNING', label: 'Learning & Development', icon: '📚' },
    { value: 'RELATIONSHIPS', label: 'Relationships', icon: '👥' },
    { value: 'CREATIVE', label: 'Creative', icon: '🎨' },
    { value: 'OTHER', label: 'Other', icon: '🎯' }
  ];

  const priorityOptions = [
    { value: 'LOW', label: 'Low', color: 'text-green-600' },
    { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-600' },
    { value: 'HIGH', label: 'High', color: 'text-orange-600' },
    { value: 'URGENT', label: 'Urgent', color: 'text-red-600' }
  ];

  const unitOptions = [
    'hours', 'days', 'weeks', 'books', 'pages', 'exercises', 'pounds', 'kilometers', 
    'dollars', 'projects', 'skills', 'habits', 'connections', 'percent'
  ];

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {goal ? 'Edit Goal' : 'Create New Goal'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Goal Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Goal Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="What do you want to achieve?"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your goal in detail..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Target Value and Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="targetValue" className="block text-sm font-medium text-gray-700 mb-2">
              Target Value
            </label>
            <input
              type="number"
              id="targetValue"
              name="targetValue"
              value={formData.targetValue}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.targetValue ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="100"
              min="0"
              step="0.1"
            />
            {errors.targetValue && (
              <p className="mt-1 text-sm text-red-600">{errors.targetValue}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
              Unit
            </label>
            <div className="relative">
              <input
                type="text"
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="hours, books, etc."
                list="unit-suggestions"
              />
              <datalist id="unit-suggestions">
                {unitOptions.map(unit => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Deadline */}
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
              Deadline
            </label>
            <input
              type="date"
              id="deadline"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.deadline ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.deadline && (
              <p className="mt-1 text-sm text-red-600">{errors.deadline}</p>
            )}
          </div>

          {/* Project */}
          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 mb-2">
              Related Project (Optional)
            </label>
            <select
              id="projectId"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No project selected</option>
              {projects?.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Goal Preview */}
        {(formData.title || formData.targetValue) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Goal Preview:</h4>
            <div className="flex items-center space-x-2">
              <span className="text-lg">
                {categoryOptions.find(cat => cat.value === formData.category)?.icon}
              </span>
              <span className="font-medium">
                {formData.title || 'Your Goal Title'}
              </span>
              {formData.targetValue && (
                <span className="text-sm text-gray-600">
                  - Target: {formData.targetValue} {formData.unit}
                </span>
              )}
              {formData.deadline && (
                <span className="text-sm text-gray-600">
                  - Due: {new Date(formData.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : (goal ? 'Update Goal' : 'Create Goal')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default GoalForm;

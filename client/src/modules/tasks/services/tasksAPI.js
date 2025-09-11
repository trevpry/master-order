import config from '../../../config.js';

class TasksAPI {
  constructor() {
    this.baseUrl = `${config.apiBaseUrl}/api/tasks`;
  }

  // ========================================
  // PROJECTS API
  // ========================================

  async getAllProjects() {
    const response = await fetch(`${this.baseUrl}/projects`);
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    const result = await response.json();
    return result.data;
  }

  async getProjectById(id) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    const result = await response.json();
    return result.data;
  }

  async createProject(projectData) {
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create project');
    }
    
    const result = await response.json();
    return result.data;
  }

  async updateProject(id, projectData) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update project');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteProject(id) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete project');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // TASKS API
  // ========================================

  async getAllTasks(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const url = params.toString() ? `${this.baseUrl}?${params}` : this.baseUrl;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }
    
    const result = await response.json();
    return result.data;
  }

  async getTaskById(id) {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch task');
    }
    const result = await response.json();
    return result.data;
  }

  async createTask(taskData) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create task');
    }
    
    const result = await response.json();
    return result.data;
  }

  async updateTask(id, taskData) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update task');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteTask(id) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete task');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // CATEGORIES API
  // ========================================

  async getAllCategories() {
    const response = await fetch(`${this.baseUrl}/categories`);
    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }
    const result = await response.json();
    return result.data;
  }

  async createCategory(categoryData) {
    const response = await fetch(`${this.baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoryData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create category');
    }
    
    const result = await response.json();
    return result.data;
  }

  async updateCategory(id, categoryData) {
    const response = await fetch(`${this.baseUrl}/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(categoryData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update category');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteCategory(id) {
    const response = await fetch(`${this.baseUrl}/categories/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete category');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // TIME TRACKING API
  // ========================================

  async getAllTimeEntries(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const url = params.toString() ? `${this.baseUrl}/time-entries?${params}` : `${this.baseUrl}/time-entries`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch time entries');
    }
    
    const result = await response.json();
    return result.data;
  }

  async getActiveTimeEntry() {
    const response = await fetch(`${this.baseUrl}/time-entries/active`);
    if (!response.ok) {
      throw new Error('Failed to fetch active time entry');
    }
    const result = await response.json();
    return result.data;
  }

  async startTimeEntry(timeEntryData) {
    const response = await fetch(`${this.baseUrl}/time-entries/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(timeEntryData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start time entry');
    }
    
    const result = await response.json();
    return result.data;
  }

  async endTimeEntry(id, endTime = null) {
    const response = await fetch(`${this.baseUrl}/time-entries/${id}/end`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endTime }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to end time entry');
    }
    
    const result = await response.json();
    return result.data;
  }

  async endAllActiveTimeEntries() {
    const response = await fetch(`${this.baseUrl}/time-entries/end-all`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to end active time entries');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteTimeEntry(id) {
    const response = await fetch(`${this.baseUrl}/time-entries/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete time entry');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // GOALS API
  // ========================================

  async getAllGoals(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const url = params.toString() ? `${this.baseUrl}/goals?${params}` : `${this.baseUrl}/goals`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch goals');
    }
    
    const result = await response.json();
    return result.data;
  }

  async createGoal(goalData) {
    const response = await fetch(`${this.baseUrl}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goalData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create goal');
    }
    
    const result = await response.json();
    return result.data;
  }

  async updateGoal(id, goalData) {
    const response = await fetch(`${this.baseUrl}/goals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goalData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update goal');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteGoal(id) {
    const response = await fetch(`${this.baseUrl}/goals/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete goal');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // DASHBOARD & ANALYTICS API
  // ========================================

  async getDashboardStats() {
    const response = await fetch(`${this.baseUrl}/dashboard`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }
    const result = await response.json();
    return result.data;
  }

  async getProductivityStats(period = 'week') {
    const response = await fetch(`${this.baseUrl}/analytics/productivity?period=${period}`);
    if (!response.ok) {
      throw new Error('Failed to fetch productivity stats');
    }
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // TASK COMMENTS API
  // ========================================

  async getTaskComments(taskId) {
    const response = await fetch(`${this.baseUrl}/${taskId}/comments`);
    if (!response.ok) {
      throw new Error('Failed to fetch task comments');
    }
    const result = await response.json();
    return result.data;
  }

  async createTaskComment(taskId, commentData) {
    const response = await fetch(`${this.baseUrl}/${taskId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commentData),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create comment');
    }
    
    const result = await response.json();
    return result.data;
  }

  async deleteTaskComment(commentId) {
    const response = await fetch(`${this.baseUrl}/comments/${commentId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete comment');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // TASK DEPENDENCIES API
  // ========================================

  async getTaskDependencies(taskId) {
    const response = await fetch(`${this.baseUrl}/${taskId}/dependencies`);
    if (!response.ok) {
      throw new Error('Failed to fetch task dependencies');
    }
    const result = await response.json();
    return result.data;
  }

  async addTaskDependency(taskId, dependsOnTaskId, type = 'FINISH_TO_START') {
    const response = await fetch(`${this.baseUrl}/${taskId}/dependencies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dependsOnTaskId, type }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add task dependency');
    }
    
    const result = await response.json();
    return result.data;
  }

  async removeTaskDependency(dependencyId) {
    const response = await fetch(`${this.baseUrl}/dependencies/${dependencyId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove task dependency');
    }
    
    const result = await response.json();
    return result.data;
  }

  // ========================================
  // BULK OPERATIONS API
  // ========================================

  async bulkUpdateTasks(taskIds, updateData) {
    const response = await fetch(`${this.baseUrl}/bulk-update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskIds, updateData }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk update tasks');
    }
    
    const result = await response.json();
    return result.data;
  }

  async bulkDeleteTasks(taskIds) {
    const response = await fetch(`${this.baseUrl}/bulk-delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskIds }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk delete tasks');
    }
    
    const result = await response.json();
    return result.data;
  }

  async bulkCreateTasks(tasks) {
    const response = await fetch(`${this.baseUrl}/bulk-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tasks }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to bulk create tasks');
    }
    
    const result = await response.json();
    return result.data;
  }
}

export default new TasksAPI();

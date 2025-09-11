import { useState, useEffect } from 'react';
import tasksAPI from '../services/tasksAPI';

// Hook for managing dashboard stats
export const useDashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksAPI.getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, error, refetch: fetchStats };
};

// Hook for managing projects
export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksAPI.getAllProjects();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData) => {
    try {
      const newProject = await tasksAPI.createProject(projectData);
      setProjects(prev => [...prev, newProject]);
      return newProject;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProject = async (id, projectData) => {
    try {
      const updatedProject = await tasksAPI.updateProject(id, projectData);
      setProjects(prev => 
        prev.map(project => project.id === id ? updatedProject : project)
      );
      return updatedProject;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      await tasksAPI.deleteProject(id);
      setProjects(prev => prev.filter(project => project.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject
  };
};

// Hook for managing tasks
export const useTasks = (filters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksAPI.getAllTasks(filters);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData) => {
    try {
      const newTask = await tasksAPI.createTask(taskData);
      setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateTask = async (id, taskData) => {
    try {
      const updatedTask = await tasksAPI.updateTask(id, taskData);
      setTasks(prev => 
        prev.map(task => task.id === id ? updatedTask : task)
      );
      return updatedTask;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteTask = async (id) => {
    try {
      await tasksAPI.deleteTask(id);
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [JSON.stringify(filters)]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask
  };
};

// Hook for managing categories
export const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksAPI.getAllCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData) => {
    try {
      const newCategory = await tasksAPI.createCategory(categoryData);
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateCategory = async (id, categoryData) => {
    try {
      const updatedCategory = await tasksAPI.updateCategory(id, categoryData);
      setCategories(prev => 
        prev.map(category => category.id === id ? updatedCategory : category)
      );
      return updatedCategory;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteCategory = async (id) => {
    try {
      await tasksAPI.deleteCategory(id);
      setCategories(prev => prev.filter(category => category.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
};

// Hook for managing time tracking
export const useTimeTracking = () => {
  const [activeEntry, setActiveEntry] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActiveEntry = async () => {
    try {
      const data = await tasksAPI.getActiveTimeEntry();
      setActiveEntry(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchTimeEntries = async (filters = {}) => {
    try {
      setLoading(true);
      const data = await tasksAPI.getAllTimeEntries(filters);
      setTimeEntries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startTimer = async (timeEntryData) => {
    try {
      const entry = await tasksAPI.startTimeEntry(timeEntryData);
      setActiveEntry(entry);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const stopTimer = async (id, endTime = null) => {
    try {
      const entry = await tasksAPI.endTimeEntry(id, endTime);
      setActiveEntry(null);
      return entry;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const stopAllTimers = async () => {
    try {
      const result = await tasksAPI.endAllActiveTimeEntries();
      setActiveEntry(null);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchActiveEntry();
  }, []);

  return {
    activeEntry,
    timeEntries,
    loading,
    error,
    fetchActiveEntry,
    fetchTimeEntries,
    startTimer,
    stopTimer,
    stopAllTimers
  };
};

// Hook for managing goals
export const useGoals = (filters = {}) => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksAPI.getAllGoals(filters);
      setGoals(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData) => {
    try {
      const newGoal = await tasksAPI.createGoal(goalData);
      setGoals(prev => [...prev, newGoal]);
      return newGoal;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateGoal = async (id, goalData) => {
    try {
      const updatedGoal = await tasksAPI.updateGoal(id, goalData);
      setGoals(prev => 
        prev.map(goal => goal.id === id ? updatedGoal : goal)
      );
      return updatedGoal;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteGoal = async (id) => {
    try {
      await tasksAPI.deleteGoal(id);
      setGoals(prev => prev.filter(goal => goal.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [JSON.stringify(filters)]);

  return {
    goals,
    loading,
    error,
    refetch: fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal
  };
};

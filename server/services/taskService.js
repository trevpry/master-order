const { PrismaClient } = require('@prisma/client');

class TaskService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // ========================================
  // PROJECT MANAGEMENT
  // ========================================

  async getAllProjects() {
    return await this.prisma.project.findMany({
      include: {
        tasks: {
          include: {
            category: true
          }
        },
        timeEntries: true,
        goals: true,
        _count: {
          select: {
            tasks: true,
            timeEntries: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { updatedAt: 'desc' }
      ]
    });
  }

  async getProjectById(id) {
    return await this.prisma.project.findUnique({
      where: { id: parseInt(id) },
      include: {
        tasks: {
          include: {
            category: true,
            timeEntries: true
          },
          orderBy: [
            { status: 'asc' },
            { priority: 'desc' },
            { dueDate: 'asc' }
          ]
        },
        timeEntries: {
          include: {
            task: true
          },
          orderBy: { startTime: 'desc' }
        },
        goals: true
      }
    });
  }

  async createProject(data) {
    return await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#3B82F6',
        status: data.status || 'active',
        priority: data.priority || 'medium',
        dueDate: data.dueDate ? new Date(data.dueDate) : null
      },
      include: {
        tasks: true,
        timeEntries: true,
        goals: true
      }
    });
  }

  async updateProject(id, data) {
    const updateData = {
      name: data.name,
      description: data.description,
      color: data.color,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      updatedAt: new Date()
    };

    // Set completedAt if status is being changed to completed
    if (data.status === 'completed' && !data.completedAt) {
      updateData.completedAt = new Date();
    } else if (data.status !== 'completed') {
      updateData.completedAt = null;
    }

    return await this.prisma.project.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        tasks: true,
        timeEntries: true,
        goals: true
      }
    });
  }

  async deleteProject(id) {
    return await this.prisma.project.delete({
      where: { id: parseInt(id) }
    });
  }

  // ========================================
  // TASK MANAGEMENT
  // ========================================

  async getAllTasks(filters = {}) {
    const where = {};
    
    if (filters.projectId) {
      where.projectId = parseInt(filters.projectId);
    }
    
    if (filters.categoryId) {
      where.categoryId = parseInt(filters.categoryId);
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.isRecurring !== undefined) {
      where.isRecurring = filters.isRecurring === 'true';
    }

    if (filters.dueSoon) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      
      where.dueDate = {
        lte: tomorrow,
        gte: new Date()
      };
    }

    return await this.prisma.task.findMany({
      where,
      include: {
        project: true,
        category: true,
        timeEntries: true,
        dependencies: true,
        dependentTasks: true,
        _count: {
          select: {
            timeEntries: true,
            dependentTasks: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async getTaskById(id) {
    return await this.prisma.task.findUnique({
      where: { id: parseInt(id) },
      include: {
        project: true,
        category: true,
        timeEntries: {
          orderBy: { startTime: 'desc' }
        },
        dependencies: {
          include: {
            dependsOnTask: true
          }
        },
        dependentTasks: {
          include: {
            dependentTask: true
          }
        }
      }
    });
  }

  async createTask(data) {
    return await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedMinutes: data.estimatedMinutes ? parseInt(data.estimatedMinutes) : null,
        projectId: data.projectId ? parseInt(data.projectId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null
      },
      include: {
        project: true,
        category: true,
        timeEntries: true,
        dependencies: true,
        dependentTasks: true
      }
    });
  }

  async updateTask(id, data) {
    const updateData = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedMinutes: data.estimatedMinutes ? parseInt(data.estimatedMinutes) : null,
      actualMinutes: data.actualMinutes ? parseInt(data.actualMinutes) : null,
      projectId: data.projectId ? parseInt(data.projectId) : null,
      categoryId: data.categoryId ? parseInt(data.categoryId) : null,
      updatedAt: new Date()
    };

    // Set completedAt if status is being changed to completed
    if (data.status === 'completed' && !data.completedAt) {
      updateData.completedAt = new Date();
    } else if (data.status !== 'completed') {
      updateData.completedAt = null;
    }

    return await this.prisma.task.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        project: true,
        category: true,
        timeEntries: true,
        dependencies: true,
        dependentTasks: true
      }
    });
  }

  async deleteTask(id) {
    return await this.prisma.task.delete({
      where: { id: parseInt(id) }
    });
  }

  // ========================================
  // CATEGORY MANAGEMENT
  // ========================================

  async getAllCategories() {
    return await this.prisma.taskCategory.findMany({
      include: {
        _count: {
          select: {
            tasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async createCategory(data) {
    return await this.prisma.taskCategory.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color || '#6B7280',
        icon: data.icon
      }
    });
  }

  async updateCategory(id, data) {
    return await this.prisma.taskCategory.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        updatedAt: new Date()
      }
    });
  }

  async deleteCategory(id) {
    return await this.prisma.taskCategory.delete({
      where: { id: parseInt(id) }
    });
  }

  // ========================================
  // TIME TRACKING
  // ========================================

  async getAllTimeEntries(filters = {}) {
    const where = {};
    
    if (filters.taskId) {
      where.taskId = parseInt(filters.taskId);
    }
    
    if (filters.projectId) {
      where.projectId = parseInt(filters.projectId);
    }
    
    if (filters.categoryId) {
      where.categoryId = parseInt(filters.categoryId);
    }

    if (filters.isBillable !== undefined) {
      where.isBillable = filters.isBillable === 'true';
    }
    
    if (filters.startDate && filters.endDate) {
      where.startTime = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    }

    return await this.prisma.timeEntry.findMany({
      where,
      include: {
        task: true,
        project: true
      },
      orderBy: { startTime: 'desc' }
    });
  }

  async startTimeEntry(data) {
    // End any active time entries first
    await this.endActiveTimeEntries();

    return await this.prisma.timeEntry.create({
      data: {
        description: data.description,
        startTime: new Date(),
        taskId: data.taskId ? parseInt(data.taskId) : null,
        projectId: data.projectId ? parseInt(data.projectId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        isBillable: data.isBillable || false,
        hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
        tags: data.tags ? JSON.stringify(data.tags) : '[]'
      },
      include: {
        task: true,
        project: true
      }
    });
  }

  async endTimeEntry(id, endTime = null) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!entry) {
      throw new Error('Time entry not found');
    }

    const endDateTime = endTime ? new Date(endTime) : new Date();
    const duration = (endDateTime - entry.startTime) / (1000 * 60 * 60); // hours

    const updatedEntry = await this.prisma.timeEntry.update({
      where: { id: parseInt(id) },
      data: {
        endTime: endDateTime,
        duration: duration,
        updatedAt: new Date()
      },
      include: {
        task: true,
        project: true
      }
    });

    // Update task's actual hours if this entry is linked to a task
    if (entry.taskId) {
      await this.updateTaskActualHours(entry.taskId);
    }

    return updatedEntry;
  }

  async endActiveTimeEntries() {
    const activeEntries = await this.prisma.timeEntry.findMany({
      where: { endTime: null }
    });

    for (const entry of activeEntries) {
      await this.endTimeEntry(entry.id);
    }

    return activeEntries.length;
  }

  async getActiveTimeEntry() {
    return await this.prisma.timeEntry.findFirst({
      where: { endTime: null },
      include: {
        task: true,
        project: true
      },
      orderBy: { startTime: 'desc' }
    });
  }

  async updateTaskActualHours(taskId) {
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { 
        taskId: parseInt(taskId),
        duration: { not: null }
      }
    });

    const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);

    await this.prisma.task.update({
      where: { id: parseInt(taskId) },
      data: { actualHours: totalHours }
    });

    return totalHours;
  }

  async deleteTimeEntry(id) {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: parseInt(id) }
    });

    if (!entry) {
      throw new Error('Time entry not found');
    }

    await this.prisma.timeEntry.delete({
      where: { id: parseInt(id) }
    });

    // Update task's actual hours if this entry was linked to a task
    if (entry.taskId) {
      await this.updateTaskActualHours(entry.taskId);
    }

    return entry;
  }

  // ========================================
  // GOALS MANAGEMENT
  // ========================================

  async getAllGoals(filters = {}) {
    const where = {};
    
    if (filters.type) {
      where.type = filters.type;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    return await this.prisma.goal.findMany({
      where,
      orderBy: [
        { status: 'asc' },
        { endDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async createGoal(data) {
    return await this.prisma.goal.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type || 'PROJECT',
        targetValue: data.targetValue ? parseFloat(data.targetValue) : null,
        currentValue: data.currentValue ? parseFloat(data.currentValue) : 0,
        unit: data.unit,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status || 'ACTIVE',
        priority: data.priority || 'MEDIUM',
        tags: data.tags ? JSON.stringify(data.tags) : '[]',
        milestones: data.milestones ? JSON.stringify(data.milestones) : '[]'
      }
    });
  }

  async updateGoal(id, data) {
    return await this.prisma.goal.update({
      where: { id: parseInt(id) },
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        targetValue: data.targetValue ? parseFloat(data.targetValue) : null,
        currentValue: data.currentValue ? parseFloat(data.currentValue) : null,
        unit: data.unit,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status,
        priority: data.priority,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        milestones: data.milestones ? JSON.stringify(data.milestones) : null,
        updatedAt: new Date()
      }
    });
  }

  async deleteGoal(id) {
    return await this.prisma.goal.delete({
      where: { id: parseInt(id) }
    });
  }

  // ========================================
  // DASHBOARD & ANALYTICS
  // ========================================

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    
    const nextWeek = new Date(thisWeekStart);
    nextWeek.setDate(thisWeekStart.getDate() + 7);

    const [
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      todayTasks,
      thisWeekTasks,
      activeProjects,
      completedProjects,
      activeTimeEntry,
      todayTimeEntries,
      thisWeekTimeHours
    ] = await Promise.all([
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.task.count({ 
        where: { 
          dueDate: { lt: today },
          status: { notIn: ['COMPLETED', 'CANCELLED'] }
        } 
      }),
      this.prisma.task.count({ 
        where: { 
          dueDate: { gte: today, lt: tomorrow }
        } 
      }),
      this.prisma.task.count({ 
        where: { 
          dueDate: { gte: thisWeekStart, lt: nextWeek }
        } 
      }),
      this.prisma.project.count({ where: { status: 'ACTIVE' } }),
      this.prisma.project.count({ where: { status: 'COMPLETED' } }),
      this.prisma.timeEntry.findFirst({
        where: { endTime: null },
        include: { task: true, project: true }
      }),
      this.prisma.timeEntry.count({
        where: {
          startTime: { gte: today, lt: tomorrow }
        }
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          startTime: { gte: thisWeekStart, lt: nextWeek },
          minutes: { not: null }
        },
        _sum: { minutes: true }
      })
    ]);

    return {
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        overdue: overdueTasks,
        today: todayTasks,
        thisWeek: thisWeekTasks
      },
      projects: {
        active: activeProjects,
        completed: completedProjects
      },
      timeTracking: {
        activeEntry: activeTimeEntry,
        todayEntries: todayTimeEntries,
        thisWeekHours: thisWeekTimeHours._sum.minutes || 0
      }
    };
  }

  async getProductivityStats(period = 'week') {
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    }

    const [tasksCompleted, timeSpent, projectsProgress] = await Promise.all([
      this.prisma.task.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startDate }
        }
      }),
      this.prisma.timeEntry.aggregate({
        where: {
          startTime: { gte: startDate },
          duration: { not: null }
        },
        _sum: { duration: true }
      }),
      this.prisma.project.findMany({
        where: {
          status: 'ACTIVE',
          updatedAt: { gte: startDate }
        },
        include: {
          tasks: {
            where: {
              completedAt: { gte: startDate }
            }
          },
          _count: {
            select: { tasks: true }
          }
        }
      })
    ]);

    return {
      period,
      tasksCompleted,
      timeSpentHours: timeSpent._sum.duration || 0,
      projectsProgress: projectsProgress.map(project => ({
        id: project.id,
        name: project.name,
        totalTasks: project._count.tasks,
        completedTasks: project.tasks.length,
        completionRate: project._count.tasks > 0 
          ? Math.round((project.tasks.length / project._count.tasks) * 100) 
          : 0
      }))
    };
  }

  // ========================================
  // TASK COMMENTS
  // ========================================

  async getTaskComments(taskId) {
    return await this.prisma.taskComment.findMany({
      where: { taskId: parseInt(taskId) },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTaskComment(taskId, data) {
    return await this.prisma.taskComment.create({
      data: {
        content: data.content,
        taskId: parseInt(taskId),
        projectId: data.projectId ? parseInt(data.projectId) : null
      }
    });
  }

  async deleteTaskComment(id) {
    return await this.prisma.taskComment.delete({
      where: { id: parseInt(id) }
    });
  }

  // ========================================
  // TASK DEPENDENCIES
  // ========================================

  async addTaskDependency(dependentTaskId, dependsOnTaskId, type = 'FINISH_TO_START') {
    // Check if dependency would create a circular reference
    const wouldCreateCycle = await this.wouldCreateCircularDependency(dependentTaskId, dependsOnTaskId);
    if (wouldCreateCycle) {
      throw new Error('Cannot add dependency: would create circular dependency');
    }

    return await this.prisma.taskDependency.create({
      data: {
        dependentTaskId: parseInt(dependentTaskId),
        dependsOnTaskId: parseInt(dependsOnTaskId),
        type
      },
      include: {
        dependentTask: true,
        dependsOnTask: true
      }
    });
  }

  async removeTaskDependency(dependencyId) {
    return await this.prisma.taskDependency.delete({
      where: { id: parseInt(dependencyId) }
    });
  }

  async getTaskDependencies(taskId) {
    return await this.prisma.taskDependency.findMany({
      where: {
        OR: [
          { dependentTaskId: parseInt(taskId) },
          { dependsOnTaskId: parseInt(taskId) }
        ]
      },
      include: {
        dependentTask: true,
        dependsOnTask: true
      }
    });
  }

  async wouldCreateCircularDependency(dependentTaskId, dependsOnTaskId) {
    // Simple cycle detection - check if dependsOnTaskId already depends on dependentTaskId
    const existingDependencies = await this.prisma.taskDependency.findMany({
      where: { dependentTaskId: parseInt(dependsOnTaskId) }
    });

    for (const dep of existingDependencies) {
      if (dep.dependsOnTaskId === parseInt(dependentTaskId)) {
        return true;
      }
      // Recursively check deeper dependencies
      const deeperCycle = await this.wouldCreateCircularDependency(dependentTaskId, dep.dependsOnTaskId);
      if (deeperCycle) {
        return true;
      }
    }

    return false;
  }

  // ========================================
  // BULK OPERATIONS
  // ========================================

  async bulkUpdateTasks(taskIds, updateData) {
    const results = [];
    
    for (const taskId of taskIds) {
      const updated = await this.updateTask(taskId, updateData);
      results.push(updated);
    }
    
    return results;
  }

  async bulkDeleteTasks(taskIds) {
    return await this.prisma.task.deleteMany({
      where: {
        id: {
          in: taskIds.map(id => parseInt(id))
        }
      }
    });
  }

  async bulkCreateTasks(tasksData) {
    const results = [];
    
    for (const taskData of tasksData) {
      const created = await this.createTask(taskData);
      results.push(created);
    }
    
    return results;
  }
}

module.exports = TaskService;

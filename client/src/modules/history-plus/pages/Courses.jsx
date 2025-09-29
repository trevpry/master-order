import React, { useState, useEffect, useCallback } from 'react';
import { HistoryPlusApiService } from '../services/historyPlusApi';
import CourseAIAssignment from '../components/CourseAIAssignment';

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [coursesPerPage] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  
  // Add course form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCourseUrl, setNewCourseUrl] = useState('');
  const [isScrapingCourses, setIsScrapingCourses] = useState(false);
  
  // Video linking state
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseVideos, setCourseVideos] = useState([]);
  const [availableHistoryVideos, setAvailableHistoryVideos] = useState([]);
  const [showVideoLinking, setShowVideoLinking] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  
  // AI assignment state
  const [selectedAiCourse, setSelectedAiCourse] = useState(null);
  const [showAiAssignment, setShowAiAssignment] = useState(false);
  
  // Local state for UI
  const [addedCourses, setAddedCourses] = useState(() => {
    const saved = localStorage.getItem('addedCourses');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Function to generate consistent gradient colors based on course title
  const getGradientColors = (title) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-purple-500 to-pink-600',
      'from-green-500 to-blue-600',
      'from-orange-500 to-red-600',
      'from-teal-500 to-cyan-600',
      'from-indigo-500 to-purple-600',
      'from-red-500 to-orange-600',
      'from-cyan-500 to-blue-600'
    ];
    
    const index = title.length % gradients.length;
    return gradients[index];
  };

  // Fetch courses from the API
  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: coursesPerPage.toString()
      });

      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/courses?${params}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      
      const data = await response.json();
      
      if (data.success) {
        setCourses(data.data.courses || []);
        setTotalPages(data.data.pagination?.pages || 1);
      } else {
        throw new Error(data.message || 'Failed to fetch courses');
      }

    } catch (error) {
      console.error('Error fetching courses:', error);
      setError(error.message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, coursesPerPage, selectedCategory, searchQuery]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/courses/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchCourses();
    fetchCategories();
  }, [fetchCourses]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  // Handle adding courses from URL
  const handleAddCoursesFromUrl = async () => {
    if (!newCourseUrl.trim()) {
      alert('Please enter a valid Great Courses URL');
      return;
    }

    // Validate URL format
    if (!newCourseUrl.includes('thegreatcoursesplus.com') && !newCourseUrl.includes('wondrium.com')) {
      alert('Please enter a valid Great Courses Plus or Wondrium URL');
      return;
    }

    // Determine if this is a single course URL or category URL
    const isSingleCourse = newCourseUrl.match(/\/[^\/]+$/i) && 
                          !newCourseUrl.includes('/category/') && 
                          !newCourseUrl.includes('/collection/') &&
                          !newCourseUrl.includes('/browse') &&
                          !newCourseUrl.includes('/search');

    try {
      setIsScrapingCourses(true);
      setError(null);

      console.log(`${isSingleCourse ? '📚' : '🔍'} ${isSingleCourse ? 'Adding single course' : 'Discovering courses'} from:`, newCourseUrl);

      const response = await fetch('/api/courses/scrape-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: newCourseUrl.trim() })
      });

      if (!response.ok) throw new Error('Failed to scrape courses');
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to scrape courses');
      }

      // Refresh the courses list
      await fetchCourses();
      await fetchCategories();

      // Reset form
      setNewCourseUrl('');
      setShowAddForm(false);

      // Show success message
      if (isSingleCourse) {
        const message = `🎉 Course added successfully!\n\n` +
                      `📚 Course: ${result.data.coursesAdded > 0 ? 'Added to database' : 'Already exists in database'}\n` +
                      `✅ Course is now available in the database!`;
        alert(message);
      } else {
        const message = `🎉 Course discovery completed successfully!\n\n` +
                      `📊 Results:\n` +
                      `• Courses Found: ${result.data.coursesFound || 0}\n` +
                      `• Courses Added: ${result.data.coursesAdded || 0}\n` +
                      `• Courses Skipped: ${result.data.coursesSkipped || 0} (already in database)\n\n` +
                      `✅ All discovered courses have been added to the database!`;
        alert(message);
      }

    } catch (error) {
      console.error('Error processing course URL:', error);
      setError(`Failed to process course URL: ${error.message}`);
      alert(`❌ Failed to process course from URL.\n\nError: ${error.message}`);
    } finally {
      setIsScrapingCourses(false);
    }
  };

  // Handle opening video linking modal
  const handleOpenVideoLinking = async (course) => {
    try {
      setLinkingLoading(true);
      const response = await fetch(`/api/courses/${course.id}/videos`);
      
      if (!response.ok) throw new Error('Failed to fetch course videos');
      
      const result = await response.json();
      setSelectedCourse(result.data.course);
      setCourseVideos(result.data.course.videos || []);
      setAvailableHistoryVideos(result.data.availableHistoryVideos || []);
      setShowVideoLinking(true);
    } catch (error) {
      console.error('Error loading course videos:', error);
      alert(`Failed to load course videos: ${error.message}`);
    } finally {
      setLinkingLoading(false);
    }
  };

  // Handle opening AI assignment modal
  const handleOpenAiAssignment = async (course) => {
    setSelectedAiCourse(course);
    setShowAiAssignment(true);
  };

  // Handle AI assignment completion
  const handleAiAssignmentComplete = async (courseId, result) => {
    console.log('AI assignment completed for course:', courseId, result);
    // Refresh courses if needed
    await fetchCourses();
    // Close modal
    setShowAiAssignment(false);
    setSelectedAiCourse(null);
  };

  // Handle linking existing video
  const handleLinkVideo = async (courseVideoId, historyVideoId) => {
    try {
      const response = await fetch(`/api/courses/${selectedCourse.id}/videos/${courseVideoId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyVideoId })
      });
      
      if (!response.ok) throw new Error('Failed to link video');
      
      // Refresh the course videos
      await handleOpenVideoLinking(selectedCourse);
      alert('Video linked successfully!');
    } catch (error) {
      console.error('Error linking video:', error);
      alert(`Failed to link video: ${error.message}`);
    }
  };

  // Handle creating new video
  const handleCreateVideo = async (courseVideoId, videoData) => {
    try {
      const response = await fetch(`/api/courses/${selectedCourse.id}/videos/${courseVideoId}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoData)
      });
      
      if (!response.ok) throw new Error('Failed to create video');
      
      // Refresh the course videos
      await handleOpenVideoLinking(selectedCourse);
      alert('New video created successfully!');
    } catch (error) {
      console.error('Error creating video:', error);
      alert(`Failed to create video: ${error.message}`);
    }
  };

  // Handle unlinking video
  const handleUnlinkVideo = async (courseVideoId) => {
    try {
      const response = await fetch(`/api/courses/${selectedCourse.id}/videos/${courseVideoId}/unlink`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to unlink video');
      
      // Refresh the course videos
      await handleOpenVideoLinking(selectedCourse);
      alert('Video unlinked successfully!');
    } catch (error) {
      console.error('Error unlinking video:', error);
      alert(`Failed to unlink video: ${error.message}`);
    }
  };

  // Handle course deletion
  const handleDeleteCourse = async (course) => {
    const confirmDeletion = window.confirm(
      `Are you sure you want to delete "${course.title}"?\n\nThis will also delete all associated videos and cannot be undone.`
    );

    if (!confirmDeletion) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete course');

      // Refresh the courses list
      await fetchCourses();
      await fetchCategories();

      alert(`✅ Course "${course.title}" has been deleted successfully.`);

    } catch (error) {
      console.error('Error deleting course:', error);
      alert(`❌ Failed to delete course: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle course video scraping
  const handleScrapeVideos = async (course) => {
    try {
      setLoading(true);

      const response = await fetch(`/api/courses/${course.id}/scrape-videos`, {
        method: 'POST'
      });

      if (!response.ok) throw new Error('Failed to scrape videos');
      
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to scrape videos');
      }

      // Mark course as "added" in local state
      const newAddedCourses = new Set(addedCourses);
      newAddedCourses.add(course.id);
      setAddedCourses(newAddedCourses);
      localStorage.setItem('addedCourses', JSON.stringify([...newAddedCourses]));

      const message = `🎉 Video scraping completed!\n\n` +
                    `📊 Results:\n` +
                    `• Videos Found: ${result.data.videosFound || 0}\n` +
                    `• Videos Added: ${result.data.videosAdded || 0}\n` +
                    `• Videos Skipped: ${result.data.videosSkipped || 0} (already in database)\n\n` +
                    `✅ All course videos have been processed!`;
      alert(message);

    } catch (error) {
      console.error('Error scraping videos:', error);
      alert(`❌ Failed to scrape videos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter courses based on search and category
  const filteredCourses = courses;

  // Pagination
  const indexOfLastCourse = currentPage * coursesPerPage;
  const indexOfFirstCourse = indexOfLastCourse - coursesPerPage;

  if (loading && courses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Great Courses</h1>
              <p className="text-gray-600 mt-1">Explore history courses from The Great Courses Plus</p>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                🎓 {filteredCourses.length} Courses
              </span>
              
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                📚 Add Course(s)
              </button>
              
              {addedCourses.size > 0 && (
                <button
                  onClick={() => {
                    setAddedCourses(new Set());
                    localStorage.removeItem('addedCourses');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium transition-colors"
                  title="Clear all added course statuses"
                >
                  🔄 Reset Status
                </button>
              )}
            </div>
          </div>
          
          {/* Add Courses Form */}
          {showAddForm && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Add Great Courses Content</h3>
              <p className="text-sm text-gray-600 mb-4">
                Add a single course or discover multiple courses from a category/collection:
              </p>
              
              <div className="mb-3 text-xs text-gray-500">
                <div className="mb-1"><strong>Single Course:</strong> https://www.thegreatcoursesplus.com/history-of-ancient-egypt</div>
                <div><strong>Category/Collection:</strong> https://www.thegreatcoursesplus.com/category/history</div>
              </div>
              
              <div className="flex gap-3">
                <input
                  type="url"
                  value={newCourseUrl}
                  onChange={(e) => setNewCourseUrl(e.target.value)}
                  placeholder="https://www.thegreatcoursesplus.com/history-of-ancient-egypt"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={isScrapingCourses}
                />
                
                <button
                  onClick={handleAddCoursesFromUrl}
                  disabled={isScrapingCourses || !newCourseUrl.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 font-medium"
                >
                  {isScrapingCourses ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Processing...
                    </>
                  ) : (
                    '📚 Add Course(s)'
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCourseUrl('');
                  }}
                  disabled={isScrapingCourses}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500">
                <p><strong>Examples:</strong></p>
                <ul className="mt-1 space-y-1">
                  <li>• https://www.thegreatcoursesplus.com/browse/history</li>
                  <li>• https://www.wondrium.com/browse/history</li>
                  <li>• Any Great Courses Plus category or collection page</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Category Filter */}
            <div className="sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courses Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredCourses.length === 0 && !loading ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Start by adding some courses using the "Add Course(s)" button above'}
            </p>
            {!searchQuery && selectedCategory === 'all' && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                📚 Add Your First Course
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCourses.map((course) => {
                const isAdded = addedCourses.has(course.id);
                const videoCount = course.videos ? course.videos.length : 0;
                const watchedCount = course.videos ? course.videos.filter(v => v.watched).length : 0;
                
                return (
                  <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Course Header with Gradient */}
                    <div className={`h-32 bg-gradient-to-r ${getGradientColors(course.title)} relative`}>
                      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-white font-semibold text-sm line-clamp-2 leading-tight">
                          {course.title}
                        </h3>
                      </div>
                      {isAdded && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            ✅ Added
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Course Content */}
                    <div className="p-4">
                      <div className="mb-3">
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          {course.category}
                        </span>
                        {course.instructor && (
                          <p className="text-xs text-gray-500 mt-1">
                            by {course.instructor}
                          </p>
                        )}
                      </div>

                      {course.description && (
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {course.description}
                        </p>
                      )}

                      {videoCount > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{watchedCount}/{videoCount} videos</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${videoCount > 0 ? (watchedCount / videoCount) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <a
                          href={course.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Course →
                        </a>
                        
                        <div className="text-xs text-gray-400">
                          {course.createdAt && new Date(course.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Guidebook Link */}
                      {course.guidebook && (
                        <div className="mt-2">
                          <a
                            href={`/api/courses${course.guidebook}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            📖 Download Guidebook
                          </a>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                        {!isAdded && (
                          <button
                            onClick={() => handleScrapeVideos(course)}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded font-medium disabled:bg-gray-400"
                          >
                            {loading ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2 inline-block"></div>
                                Scraping Videos...
                              </>
                            ) : (
                              <>
                                📥 Add Course Videos
                              </>
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleOpenVideoLinking(course)}
                          disabled={linkingLoading}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 px-3 rounded font-medium disabled:bg-gray-400"
                        >
                          {linkingLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2 inline-block"></div>
                              Loading...
                            </>
                          ) : (
                            <>
                              🔗 Link Videos
                            </>
                          )}
                        </button>
                        
                        {isAdded && videoCount > 0 && (
                          <button
                            onClick={() => handleOpenAiAssignment(course)}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs py-2 px-3 rounded font-medium"
                          >
                            🤖 AI Course Analysis
                          </button>
                        )}
                        
                        <p className="text-xs text-gray-500 text-center px-2">
                          {isAdded 
                            ? "Link course lectures to existing great-courses-plus videos or create new ones"
                            : "Scrape all lectures from this course and add them to your video library"
                          }
                        </p>
                        
                        <button
                          onClick={() => handleDeleteCourse(course)}
                          disabled={loading}
                          className="w-full bg-red-800 hover:bg-red-900 text-white disabled:bg-gray-400 text-xs py-2 px-3 rounded font-medium"
                        >
                          {loading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1 inline-block"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              🗑️ Delete Course
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Previous
                  </button>
                  
                  <span className="px-3 py-2 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Linking Modal */}
      {showVideoLinking && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Link Videos: {selectedCourse.title}
                </h2>
                <button
                  onClick={() => setShowVideoLinking(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {courseVideos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No course videos found. Please scrape videos first.
                </p>
              ) : (
                <div className="space-y-4">
                  {courseVideos.map((video) => {
                    const linkedHistoryVideo = selectedCourse.historyVideos?.find(
                      hv => hv.lectureNumber === video.order
                    );
                    
                    return (
                      <div key={video.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{video.title}</h3>
                            {video.description && (
                              <p className="text-sm text-gray-600 mt-1">{video.description}</p>
                            )}
                          </div>
                          
                          {linkedHistoryVideo ? (
                            <div className="ml-4 flex items-center space-x-2">
                              <span className="text-green-600 text-sm">
                                ✅ Linked to: {linkedHistoryVideo.title}
                              </span>
                              <button
                                onClick={() => handleUnlinkVideo(video.id)}
                                className="text-red-600 hover:text-red-800 text-sm px-2 py-1 border border-red-300 rounded"
                              >
                                Unlink
                              </button>
                            </div>
                          ) : (
                            <div className="ml-4 space-y-2">
                              <div className="flex items-center space-x-2">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleLinkVideo(video.id, parseInt(e.target.value));
                                      e.target.value = '';
                                    }
                                  }}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                  defaultValue=""
                                >
                                  <option value="">Select existing video...</option>
                                  {availableHistoryVideos.map((hv) => (
                                    <option key={hv.id} value={hv.id}>
                                      {hv.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="text-sm text-gray-500">or</div>
                              
                              <button
                                onClick={() => {
                                  const url = prompt('Enter video URL:');
                                  if (url) {
                                    handleCreateVideo(video.id, {
                                      title: video.title,
                                      url: url,
                                      description: video.description
                                    });
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 border border-blue-300 rounded"
                              >
                                Create New Video
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Course AI Assignment Modal */}
      {showAiAssignment && selectedAiCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  AI Analysis: {selectedAiCourse.title}
                </h2>
                <button
                  onClick={() => setShowAiAssignment(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
              <CourseAIAssignment
                course={selectedAiCourse}
                onAssignToEvent={handleAiAssignmentComplete}
                onCreateNewEvent={handleAiAssignmentComplete}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const CourseDetails = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [course, setCourse] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [summary, setSummary] = useState({
    totalLectures: 0,
    watchedLectures: 0,
    linkedLectures: 0,
    linkedToEvents: 0
  });

  const fetchCourseDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/courses/${id}/details`);
      if (!response.ok) {
        throw new Error('Failed to load course details');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to load course details');
      }

      setCourse(result.data.course || null);
      setLectures(result.data.lectures || []);
      setSummary(result.data.summary || {
        totalLectures: 0,
        watchedLectures: 0,
        linkedLectures: 0,
        linkedToEvents: 0
      });
    } catch (detailsError) {
      console.error('Error loading course details:', detailsError);
      setError(detailsError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCourseDetails();
  }, [fetchCourseDetails]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/history-plus/courses"
            className="inline-block mb-4 text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Courses
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">Unable to load course details</h2>
            <p className="text-red-700 mt-1">{error || 'Course not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = summary.totalLectures > 0
    ? Math.round((summary.watchedLectures / summary.totalLectures) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link
            to="/history-plus/courses"
            className="inline-block mb-4 text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Courses
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{course.title}</h1>
              <p className="text-gray-600 mt-2">{course.description || 'No description provided.'}</p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                  {course.category}
                </span>
                {course.instructor && (
                  <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                    Instructor: {course.instructor}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                  {summary.totalLectures} Lectures
                </span>
              </div>
            </div>

            <div className="w-full lg:w-80 bg-gray-50 rounded-lg p-4 border">
              <h2 className="font-semibold text-gray-900 mb-3">Course Status</h2>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Watched</span>
                  <span className="font-semibold">{summary.watchedLectures}/{summary.totalLectures}</span>
                </div>
                <div className="flex justify-between">
                  <span>Linked Videos</span>
                  <span className="font-semibold">{summary.linkedLectures}</span>
                </div>
                <div className="flex justify-between">
                  <span>Linked Events</span>
                  <span className="font-semibold">{summary.linkedToEvents}</span>
                </div>
              </div>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{progressPercent}% complete</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Lectures</h2>
          </div>

          {lectures.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No lectures found for this course.</div>
          ) : (
            <div className="divide-y">
              {lectures.map((lecture) => {
                const linkedEvent = lecture.linkedHistoryVideo?.event;
                const effectiveWatched = lecture.watchStatus?.effectiveWatched;

                return (
                  <div key={lecture.id} className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium">
                            Lecture {lecture.order ?? '-'}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded font-medium ${
                              effectiveWatched
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {effectiveWatched ? 'Watched' : 'Unwatched'}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-gray-900">{lecture.title}</h3>
                        {lecture.description && (
                          <p className="text-sm text-gray-600 mt-1">{lecture.description}</p>
                        )}
                      </div>

                      <div className="lg:w-96 bg-gray-50 border rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Linked Event</div>
                        {linkedEvent ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{linkedEvent.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {linkedEvent.startDate}
                              {linkedEvent.endDate && linkedEvent.endDate !== linkedEvent.startDate
                                ? ` - ${linkedEvent.endDate}`
                                : ''}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Not linked to an event</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDetails;

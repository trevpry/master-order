import React from 'react';

const CustomTab = ({
  customPeriod,
  setCustomPeriod,
  fetchCustomOrderStats,
  customOrderStats,
  customOrderChartRef,
  formatDateWithTimezone
}) => {
  return (
    <div className="tab-content">
      <div className="row">
        {/* Time Period Filter for Custom Orders */}
        <div className="col-12 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Filter Custom Order Statistics</h5>
              <div className="btn-group" role="group">
                <button 
                  type="button" 
                  className={`btn ${customPeriod === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setCustomPeriod('all');
                    fetchCustomOrderStats('all');
                  }}
                >
                  All Time
                </button>
                <button 
                  type="button" 
                  className={`btn ${customPeriod === 'today' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setCustomPeriod('today');
                    fetchCustomOrderStats('today');
                  }}
                >
                  Today
                </button>
                <button 
                  type="button" 
                  className={`btn ${customPeriod === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setCustomPeriod('week');
                    fetchCustomOrderStats('week');
                  }}
                >
                  This Week
                </button>
                <button 
                  type="button" 
                  className={`btn ${customPeriod === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setCustomPeriod('month');
                    fetchCustomOrderStats('month');
                  }}
                >
                  This Month
                </button>
                <button 
                  type="button" 
                  className={`btn ${customPeriod === 'year' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => {
                    setCustomPeriod('year');
                    fetchCustomOrderStats('year');
                  }}
                >
                  This Year
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Order Statistics */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Custom Order Overview ({customPeriod.charAt(0).toUpperCase() + customPeriod.slice(1)})</h5>
              {customOrderStats ? (
                <div>
                  <p><strong>Total Custom Orders:</strong> {customOrderStats.length}</p>
                  <p><strong>Total Entries:</strong> {customOrderStats.reduce((sum, order) => sum + (order.totalTvEpisodes + order.totalMovies + order.totalWebVideos + order.totalBooks + order.totalComics + order.totalShortStories), 0)}</p>
                  <p><strong>Total Watch Time:</strong> {customOrderStats.reduce((sum, order) => sum + order.totalWatchTime, 0) > 0 ? `${Math.floor(customOrderStats.reduce((sum, order) => sum + order.totalWatchTime, 0) / 60)}h ${customOrderStats.reduce((sum, order) => sum + order.totalWatchTime, 0) % 60}m` : '0 minutes'}</p>
                  <p><strong>Total Read Time:</strong> {customOrderStats.reduce((sum, order) => sum + order.totalReadTime, 0) > 0 ? `${Math.floor(customOrderStats.reduce((sum, order) => sum + order.totalReadTime, 0) / 60)}h ${customOrderStats.reduce((sum, order) => sum + order.totalReadTime, 0) % 60}m` : '0 minutes'}</p>
                </div>
              ) : (
                <p>Loading custom order statistics...</p>
              )}
            </div>
          </div>
        </div>

        {/* Custom Order Activity Chart */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Custom Order Activity Over Time</h5>
              <canvas ref={customOrderChartRef} width="400" height="200"></canvas>
            </div>
          </div>
        </div>

        {/* Recent Custom Order Activity */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Recent Custom Order Activity</h5>
              {customOrderStats && customOrderStats.logs && customOrderStats.logs.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Custom Order</th>
                        <th>Media Type</th>
                        <th>Activity</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customOrderStats.logs.slice(0, 10).map((log, index) => (
                        <tr key={index}>
                          <td>{formatDateWithTimezone(log.startTime)}</td>
                          <td>{log.title}</td>
                          <td>{log.customOrderItem?.customOrder?.name || 'N/A'}</td>
                          <td className="text-capitalize">{log.mediaType}</td>
                          <td className="text-capitalize">{log.activityType}</td>
                          <td>{Math.round(log.totalWatchTime)} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No custom order activity found for the selected period.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomTab;

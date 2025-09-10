import React from 'react';
import { Bar, Line } from 'react-chartjs-2';

const ActivityComparisonChart = ({ 
  stats, 
  getChartData, 
  getChartOptions,
  selectedMediaTypes, 
  chartType, 
  setChartType
}) => {
  if (!stats || !getChartData() || selectedMediaTypes.length === 0) {
    return null;
  }

  return (
    <div className="stats-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Activity Comparison</h2>
        <div className="chart-controls">
          <button 
            className={`chart-toggle ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => setChartType('bar')}
          >
            📊 Bar Chart
          </button>
          <button 
            className={`chart-toggle ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
          >
            📈 Line Chart
          </button>
        </div>
      </div>
      {chartType === 'line' && (
        <div className="chart-info">
          <small style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            Time axis automatically adjusts: Days for week/month periods, Months for year period, Years for all-time
          </small>
        </div>
      )}
      <div style={{ height: '400px', padding: '20px' }}>
        {chartType === 'bar' ? (
          <Bar data={getChartData()} options={getChartOptions()} />
        ) : (
          <Line data={getChartData()} options={getChartOptions()} />
        )}
      </div>
    </div>
  );
};

export default ActivityComparisonChart;

import React from 'react';
import TodayStatsCard from './TodayStatsCard';
import OverallStatsCard from './OverallStatsCard';
import NoMediaTypesMessage from './NoMediaTypesMessage';
import ActivityComparisonChart from './ActivityComparisonChart';
import TimeBasedBreakdown from './TimeBasedBreakdown';
import RecentActivity from './RecentActivity';
import NoDataState from './NoDataState';

const OverviewTab = ({ 
  todayStats, 
  stats, 
  selectedMediaTypes, 
  getFilteredStats,
  getChartData,
  getChartOptions,
  chartType,
  setChartType,
  recentActivity,
  settings,
  globalPeriod,
  formatDate,
  children // For any remaining content sections
}) => {
  return (
    <div className="tab-content">
      <TodayStatsCard 
        todayStats={todayStats} 
        selectedMediaTypes={selectedMediaTypes} 
      />
      
      <OverallStatsCard 
        stats={stats} 
        selectedMediaTypes={selectedMediaTypes} 
        getFilteredStats={getFilteredStats} 
      />

      <NoMediaTypesMessage selectedMediaTypes={selectedMediaTypes} />

      <ActivityComparisonChart
        stats={stats}
        getChartData={getChartData}
        getChartOptions={getChartOptions}
        selectedMediaTypes={selectedMediaTypes}
        chartType={chartType}
        setChartType={setChartType}
      />

      <TimeBasedBreakdown 
        stats={stats}
        selectedMediaTypes={selectedMediaTypes}
        globalPeriod={globalPeriod}
        getFilteredStats={getFilteredStats}
        formatDate={formatDate}
      />

      {/* Additional content passed as children */}
      {children}

      <RecentActivity 
        recentActivity={recentActivity}
        selectedMediaTypes={selectedMediaTypes}
        settings={settings}
      />

      <NoDataState stats={stats} />
    </div>
  );
};

export default OverviewTab;

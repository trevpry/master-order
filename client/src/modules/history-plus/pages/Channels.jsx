import React, { useState, useEffect } from 'react';
import { historyPlusApi } from '../services/historyPlusApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import './Channels.css';

const Channels = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channelUrl: '',
    handle: '',
    subscriberCount: '',
    verified: false
  });
  const [scrapingProgress, setScrapingProgress] = useState({});
  const [scrapingResults, setScrapingResults] = useState({});

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await historyPlusApi.getAllChannels();
      setChannels(response.data || response);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    try {
      const response = await historyPlusApi.createChannel(formData);
      const newChannel = response.data || response;
      setChannels([newChannel, ...channels]);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create channel:', err);
      alert('Failed to create channel: ' + err.message);
    }
  };

  const handleUpdateChannel = async (e) => {
    e.preventDefault();
    try {
      const response = await historyPlusApi.updateChannel(editingChannel.id, formData);
      const updatedChannel = response.data || response;
      setChannels(channels.map(channel => 
        channel.id === updatedChannel.id ? updatedChannel : channel
      ));
      setEditingChannel(null);
      resetForm();
    } catch (err) {
      console.error('Failed to update channel:', err);
      alert('Failed to update channel: ' + err.message);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    if (!window.confirm('Are you sure you want to delete this channel? This will remove the channel association from all videos.')) {
      return;
    }

    try {
      await historyPlusApi.deleteChannel(channelId);
      setChannels(channels.filter(channel => channel.id !== channelId));
    } catch (err) {
      console.error('Failed to delete channel:', err);
      alert('Failed to delete channel. Please try again.');
    }
  };

  const startEdit = (channel) => {
    setEditingChannel(channel);
    setShowCreateForm(false);
    setFormData({
      name: channel.name || '',
      description: channel.description || '',
      channelUrl: channel.channelUrl || '',
      handle: channel.handle || '',
      subscriberCount: channel.subscriberCount || '',
      verified: channel.verified || false
    });
  };

  const cancelEdit = () => {
    setEditingChannel(null);
    setShowCreateForm(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      channelUrl: '',
      handle: '',
      subscriberCount: '',
      verified: false
    });
  };

  const handleScrapeChannel = async (channel) => {
    if (!channel.channelUrl) {
      alert('Channel URL is required for scraping');
      return;
    }

    // Initialize progress for this channel
    setScrapingProgress(prev => ({
      ...prev,
      [channel.id]: {
        isRunning: true,
        stage: 'initializing',
        message: 'Starting scraper...',
        videosFound: 0,
        videosProcessed: 0,
        videosAdded: 0,
        videosSkipped: 0
      }
    }));

    try {
      const result = await historyPlusApi.scrapeChannelVideos(channel.channelUrl, channel.id);
      
      // Update final progress
      setScrapingProgress(prev => ({
        ...prev,
        [channel.id]: {
          isRunning: false,
          stage: 'completed',
          message: `Completed: ${result.data.videosAdded} added, ${result.data.videosSkipped} skipped`,
          ...result.data
        }
      }));

      // Store results
      setScrapingResults(prev => ({
        ...prev,
        [channel.id]: result.data
      }));

      // Refresh channels to update video counts
      fetchChannels();

    } catch (error) {
      console.error('Scraping failed:', error);
      setScrapingProgress(prev => ({
        ...prev,
        [channel.id]: {
          isRunning: false,
          stage: 'error',
          message: `Failed: ${error.message}`,
          error: error.message
        }
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) {
    return <LoadingSpinner message="Loading channels..." />;
  }

  if (error) {
    return (
      <div className="channels-container">
        <div className="error-message">
          <strong>Error!</strong>
          <span> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="channels-container">
      <div className="channels-header">
        <h1 className="channels-title">Channel Management</h1>
        
        {/* Stats */}
        <div className="channels-stats">
          <div className="stat-card">
            <h3>Total Channels</h3>
            <p className="stat-number">{channels.length}</p>
          </div>
        </div>

        {/* Add Channel Button */}
        <div className="channels-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowCreateForm(true);
              setEditingChannel(null);
              resetForm();
            }}
          >
            + Add Channel
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingChannel) && (
        <div className="channel-form-container">
          <div className="channel-form">
            <h2 className="form-title">
              {editingChannel ? 'Edit Channel' : 'Create New Channel'}
            </h2>
            
            <form onSubmit={editingChannel ? handleUpdateChannel : handleCreateChannel}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name">Channel Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter channel name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="channelUrl">Channel URL</label>
                  <input
                    type="url"
                    id="channelUrl"
                    name="channelUrl"
                    value={formData.channelUrl}
                    onChange={handleInputChange}
                    placeholder="https://www.youtube.com/channel/..."
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="handle">Handle (@username)</label>
                  <input
                    type="text"
                    id="handle"
                    name="handle"
                    value={formData.handle}
                    onChange={handleInputChange}
                    placeholder="@channelhandle"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subscriberCount">Subscriber Count</label>
                  <input
                    type="text"
                    id="subscriberCount"
                    name="subscriberCount"
                    value={formData.subscriberCount}
                    onChange={handleInputChange}
                    placeholder="1.5M subscribers"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="verified"
                      checked={formData.verified}
                      onChange={handleInputChange}
                    />
                    Verified Channel
                  </label>
                </div>

                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Channel description (optional)"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingChannel ? 'Update Channel' : 'Create Channel'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Channels List */}
      {channels.length === 0 ? (
        <div className="empty-state">
          <p>No channels found.</p>
        </div>
      ) : (
        <div className="channels-list">
          {channels.map((channel) => (
            <div key={channel.id} className="channel-card">
              <div className="channel-info">
                <div className="channel-header">
                  <h3 className="channel-name">
                    {channel.name}
                    {channel.verified && <span className="verified-badge">✓</span>}
                  </h3>
                  {channel.handle && (
                    <span className="channel-handle">{channel.handle}</span>
                  )}
                </div>
                
                {channel.channelUrl && (
                  <p className="channel-url">
                    <a 
                      href={channel.channelUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {channel.channelUrl}
                    </a>
                  </p>
                )}
                
                {channel.description && (
                  <p className="channel-description">{channel.description}</p>
                )}
                
                <div className="channel-meta">
                  {channel.subscriberCount && (
                    <span className="meta-item">
                      👥 {channel.subscriberCount}
                    </span>
                  )}
                  <span className="meta-item">
                    🎥 {channel.videos?.length || 0} videos
                  </span>
                  <span className="meta-item">
                    📅 Created: {new Date(channel.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Scraping Progress */}
              {scrapingProgress[channel.id] && (
                <div className="scraping-progress">
                  <div className={`progress-indicator ${scrapingProgress[channel.id].stage}`}>
                    <div className="progress-header">
                      <span className="progress-stage">
                        {scrapingProgress[channel.id].stage === 'initializing' && '🔧 Initializing'}
                        {scrapingProgress[channel.id].stage === 'launching' && '🚀 Launching Browser'}
                        {scrapingProgress[channel.id].stage === 'navigating' && '🌍 Loading Page'}
                        {scrapingProgress[channel.id].stage === 'scrolling' && '📜 Scrolling'}
                        {scrapingProgress[channel.id].stage === 'extracting' && '🔍 Extracting URLs'}
                        {scrapingProgress[channel.id].stage === 'processing' && '⚙️ Processing Videos'}
                        {scrapingProgress[channel.id].stage === 'completed' && '✅ Completed'}
                        {scrapingProgress[channel.id].stage === 'error' && '❌ Error'}
                      </span>
                      {scrapingProgress[channel.id].isRunning && (
                        <div className="spinner"></div>
                      )}
                    </div>
                    <div className="progress-message">
                      {scrapingProgress[channel.id].message}
                    </div>
                    {scrapingProgress[channel.id].videosFound > 0 && (
                      <div className="progress-stats">
                        Found: {scrapingProgress[channel.id].videosFound} | 
                        Processed: {scrapingProgress[channel.id].videosProcessed || 0} | 
                        Added: {scrapingProgress[channel.id].videosAdded || 0} | 
                        Skipped: {scrapingProgress[channel.id].videosSkipped || 0}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="channel-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => startEdit(channel)}
                  disabled={editingChannel?.id === channel.id}
                >
                  Edit
                </button>
                <button
                  className="btn btn-outline btn-primary"
                  onClick={() => handleScrapeChannel(channel)}
                  disabled={scrapingProgress[channel.id]?.isRunning || !channel.channelUrl}
                  title={!channel.channelUrl ? 'Channel URL required for scraping' : 'Scrape all videos from this channel'}
                >
                  {scrapingProgress[channel.id]?.isRunning ? '🔄 Scraping...' : '🕷️ Scrape Videos'}
                </button>
                <button
                  className="btn btn-outline btn-danger"
                  onClick={() => handleDeleteChannel(channel.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Channels;
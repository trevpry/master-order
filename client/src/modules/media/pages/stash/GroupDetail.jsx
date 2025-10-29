import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
import config from '../../../../config';

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [scrapeData, setScrapeData] = useState(null);
  const [showScrapeReviewModal, setShowScrapeReviewModal] = useState(false);
  const [selectedScraper, setSelectedScraper] = useState(null); // GEVI or AEBN
  const [availableScrapers, setAvailableScrapers] = useState([]);
  const [tagsToCreate, setTagsToCreate] = useState({}); // Track which unmatched tags to create {sceneIndex: {tagName: true}}

  useEffect(() => {
    fetchGroup();
    loadScrapers();
  }, [id]);

  const loadScrapers = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scrapers`);
      const result = await response.json();
      
      // Always include GEVI and AEBN as hardcoded scrapers for movies
      const geviScraper = {
        siteName: 'GEVI',
        name: 'GEVI',
        scrapeMovie: true
      };
      
      const aebnScraper = {
        siteName: 'AEBN',
        name: 'AEBN',
        scrapeMovie: true
      };
      
      let movieScrapers = [geviScraper, aebnScraper];
      
      if (result.success) {
        // Add other scrapers that support movie scraping (exclude GEVI and AEBN)
        const otherScrapers = result.data.filter(s => 
          s.siteName !== 'AEBN' && s.siteName !== 'GEVI' && s.scrapeMovie
        );
        movieScrapers = [...movieScrapers, ...otherScrapers];
      }
      
      setAvailableScrapers(movieScrapers);
      
      // Default to GEVI (for backwards compatibility)
      setSelectedScraper(geviScraper);
    } catch (error) {
      console.error('Failed to load scrapers:', error);
      // Even if loading fails, ensure GEVI and AEBN are available
      const geviScraper = {
        siteName: 'GEVI',
        name: 'GEVI',
        scrapeMovie: true
      };
      const aebnScraper = {
        siteName: 'AEBN',
        name: 'AEBN',
        scrapeMovie: true
      };
      setAvailableScrapers([geviScraper, aebnScraper]);
      setSelectedScraper(geviScraper);
    }
  };

  const fetchGroup = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/groups/${id}`);
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to load group');
      }
      
      const groupData = json.data;
      
      // Proxy GEVI image URLs to avoid CORS issues
      if (groupData.frontImage && groupData.frontImage.startsWith('https://gayeroticvideoindex.com/')) {
        groupData.frontImage = `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(groupData.frontImage)}`;
      }
      
      if (groupData.backImage && groupData.backImage.startsWith('https://gayeroticvideoindex.com/')) {
        groupData.backImage = `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(groupData.backImage)}`;
      }
      
      setGroup(groupData);
    } catch (err) {
      console.error('Error fetching group:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchGevi = async () => {
    setIsSearching(true);
    setSearchResults(null);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups/${id}/search-gevi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success && result.data.movies && result.data.movies.length > 0) {
        setSearchResults(result.data);
      } else {
        alert(`No movies found for "${group.name}"`);
      }
    } catch (error) {
      console.error('Error searching GEVI:', error);
      alert('Failed to search GEVI');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (movieUrl) => {
    setScrapeUrl(movieUrl);
    setSearchResults(null);
  };

  const handleScrapeGevi = async () => {
    if (!scrapeUrl || !scrapeUrl.trim()) {
      alert(`Please enter a ${selectedScraper ? selectedScraper.siteName : 'GEVI'} movie URL`);
      return;
    }

    setIsScraping(true);

    try {
      let endpoint, requestBody;
      
      if (selectedScraper && selectedScraper.siteName !== 'GEVI') {
        // YAML scraper (AEBN, etc.)
        endpoint = `${config.apiBaseUrl}/api/stash/groups/${id}/scrape-generic`;
        requestBody = { 
          url: scrapeUrl, 
          scraperName: selectedScraper.siteName
        };
        console.log(`🔍 Scraping movie with ${selectedScraper.siteName}:`, scrapeUrl);
      } else {
        // GEVI scraping
        endpoint = `${config.apiBaseUrl}/api/stash/gevi/movie`;
        requestBody = { 
          url: scrapeUrl,
          groupId: id // Pass group ID for scene matching
        };
        console.log(`🔍 Scraping movie with GEVI:`, scrapeUrl);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success) {
        console.log('🎬 Full API Response:', result);
        console.log('🎬 result.data structure:', Object.keys(result.data));
        
        // Handle both GEVI (movie) and generic scraper (scraped) response formats
        const movieData = result.data.movie || result.data.scraped;
        const { sourceUrl, matchedScenes, compilations } = result.data;
        
        console.log('🎬 Scraped movie data:', movieData);
        console.log('🎬 Source URL:', sourceUrl);
        console.log('🎬 Matched Scenes:', matchedScenes);
        console.log('🎬 Matched Scenes type:', typeof matchedScenes);
        console.log('🎬 Matched Scenes length:', matchedScenes?.length);
        console.log('🎬 Compilations:', compilations);
        
        // Store original image URLs for sending to Stash
        const originalFrontImage = movieData.front_image;
        const originalBackImage = movieData.back_image;
        
        // Convert GEVI image URLs to proxied URLs for browser display (to avoid CORS issues)
        let displayFrontImage = movieData.front_image;
        let displayBackImage = movieData.back_image;
        
        if (movieData.front_image && movieData.front_image.startsWith('https://gayeroticvideoindex.com/')) {
          displayFrontImage = `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(movieData.front_image)}`;
          console.log('📸 Proxied Front Image URL:', displayFrontImage);
        }
        
        if (movieData.back_image && movieData.back_image.startsWith('https://gayeroticvideoindex.com/')) {
          displayBackImage = `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(movieData.back_image)}`;
          console.log('📸 Proxied Back Image URL:', displayBackImage);
        }
        
        // Store scrape results for review with both display and original URLs
        const scrapeDataToSet = {
          scraped: {
            ...movieData,
            front_image: displayFrontImage, // For browser display
            back_image: displayBackImage, // For browser display
            originalFrontImage: originalFrontImage, // For sending to Stash
            originalBackImage: originalBackImage // For sending to Stash
          },
          matchedScenes: matchedScenes || [],
          compilations: compilations || { matched: [], unmatched: [] },
          sourceUrl: sourceUrl
        };
        
        console.log('🎬 Setting scrapeData:', scrapeDataToSet);
        console.log('🎬 scrapeData.matchedScenes length:', scrapeDataToSet.matchedScenes.length);
        console.log('🎬 scrapeData.compilations:', scrapeDataToSet.compilations);
        
        setScrapeData(scrapeDataToSet);
        setShowScrapeModal(false);
        setShowScrapeReviewModal(true);
        
      } else {
        alert(`Failed to scrape GEVI: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error scraping GEVI:', error);
      alert('Failed to scrape GEVI');
    } finally {
      setIsScraping(false);
    }
  };

  const handleAcceptScrape = async () => {
    if (!scrapeData || !scrapeData.scraped) return;

    try {
      const updateData = {
        name: scrapeData.scraped.name,
        date: scrapeData.scraped.date,
        duration: scrapeData.scraped.duration,
        director: scrapeData.scraped.director,
        synopsis: scrapeData.scraped.synopsis,
        studio: scrapeData.scraped.studio,
        front_image: scrapeData.scraped.originalFrontImage || scrapeData.scraped.front_image,
        back_image: scrapeData.scraped.originalBackImage || scrapeData.scraped.back_image,
        geviUrl: scrapeData.sourceUrl || scrapeUrl,
        urls: scrapeData.scraped.externalUrls || [] // Add external URLs
      };

      const response = await fetch(`/api/stash/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Failed to update group');
      }

      const result = await response.json();
      console.log('✅ Group updated:', result);

      // Apply matched scenes action codes if available
      if (scrapeData.matchedScenes && scrapeData.matchedScenes.length > 0) {
        console.log(`🎬 Applying action codes for ${scrapeData.matchedScenes.length} matched scenes`);
        
        const scenesResponse = await fetch(`/api/stash/groups/${id}/apply-matched-scenes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            matchedScenes: scrapeData.matchedScenes,
            tagsToCreate: tagsToCreate // Include tags to create
          })
        });

        if (!scenesResponse.ok) {
          console.warn('⚠️  Failed to apply action codes, but group was updated');
        } else {
          const scenesResult = await scenesResponse.json();
          console.log('✅ Action codes applied:', scenesResult.data?.results);
        }
      }

      // Close modals and reload page to show updates
      setShowScrapeReviewModal(false);
      setShowScrapeModal(false);
      window.location.reload();

    } catch (error) {
      console.error('❌ Error updating group:', error);
      alert('Failed to update group: ' + error.message);
    }
  };

  const handleCreateCompilation = async (compilation) => {
    try {
      console.log('🎬 Creating compilation:', compilation);
      
      const response = await fetch('/api/stash/compilations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geviUrl: compilation.geviUrl,
          name: compilation.name,
          sceneId: compilation.sceneId || null // Use the sceneId from the compilation object
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create compilation');
      }

      const result = await response.json();
      console.log('✅ Compilation created:', result);
      
      alert(`Compilation "${compilation.name}" created successfully!`);
      
      // Refresh the compilation list by re-running the scrape or just remove from unmatched
      // For now, we'll just show success and let user close the modal
      
    } catch (error) {
      console.error('❌ Error creating compilation:', error);
      alert('Failed to create compilation: ' + error.message);
    }
  };

  const handleLinkSceneToCompilation = async (compilation) => {
    try {
      console.log('🔗 Linking scene to compilation:', compilation);
      
      const response = await fetch('/api/stash/compilations/link-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: compilation.id,
          sceneId: compilation.sceneId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to link scene to compilation');
      }

      const result = await response.json();
      console.log('✅ Scene linked to compilation:', result);
      
      if (result.data.alreadyLinked) {
        alert(`Scene is already linked to "${compilation.name}"`);
      } else {
        alert(`Scene successfully linked to "${compilation.name}"!`);
      }
      
    } catch (error) {
      console.error('❌ Error linking scene to compilation:', error);
      alert('Failed to link scene to compilation: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!group) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${group.name}"?\n\n` +
      `This will delete the group from both Stash and your local database.\n` +
      `${group.scenes?.length > 0 ? `\nNote: This group has ${group.scenes.length} scene(s) linked. The scenes themselves will NOT be deleted, only the group and scene links.` : ''}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      console.log('🗑️  Deleting group:', group.name);
      
      const response = await fetch(`/api/stash/groups/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete group');
      }

      const result = await response.json();
      console.log('✅ Group deleted:', result);
      
      alert(`Group "${group.name}" deleted successfully!`);
      
      // Navigate back to groups list
      navigate('/media/stash/groups');
      
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      alert('Failed to delete group: ' + error.message);
    }
  };

  const handleUnlinkScene = async (scene) => {
    if (!scene || !group) return;

    const confirmUnlink = window.confirm(
      `Unlink "${scene.title || 'this scene'}" from "${group.name}"?\n\n` +
      `This will remove the scene from the group in both Stash and your local database.\n` +
      `The scene itself will NOT be deleted.\n\n` +
      `Continue?`
    );

    if (!confirmUnlink) return;

    try {
      console.log('🔗 Unlinking scene from group:', scene.title);
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups/${id}/scenes/${scene.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to unlink scene');
      }

      const result = await response.json();
      console.log('✅ Scene unlinked:', result);
      
      // Refresh the group data to show updated scene list
      await fetchGroup();
      
      alert(`Scene unlinked successfully!`);
      
    } catch (error) {
      console.error('❌ Error unlinking scene:', error);
      alert('Failed to unlink scene: ' + error.message);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="page pad">
        <div className="loading-message">
          <p>Loading group...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page pad">
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={fetchGroup}>Retry</Button>
          <Button onClick={() => navigate('/media/stash/groups')}>Back to Groups</Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page pad">
        <p>Group not found</p>
        <Button onClick={() => navigate('/media/stash/groups')}>Back to Groups</Button>
      </div>
    );
  }

  return (
    <div className="page pad group-detail-page">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link> → <Link to="/media/stash/groups">Groups</Link>
      </div>

      <div className="group-header">
        <div className="group-cover-section">
          {group.frontImage ? (
            <img 
              src={group.frontImage} 
              alt={group.name}
              className="group-cover-large"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <div className="group-cover-placeholder-large" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '6rem'
            }}>
              🎬
            </div>
          )}
          
          {group.backImage && (
            <img 
              src={group.backImage} 
              alt={`${group.name} (back cover)`}
              className="group-back-cover"
            />
          )}
        </div>

        <div className="group-main-info">
          <h1>{group.name}</h1>
          
          {group.aliases && (
            <div className="group-aliases">
              <span className="muted">Also known as: {group.aliases}</span>
            </div>
          )}

          <div className="group-actions" style={{ margin: '1rem 0', display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => {
                const geviScraper = availableScrapers.find(s => s.siteName === 'GEVI');
                setSelectedScraper(geviScraper);
                setShowScrapeModal(true);
                setScrapeUrl(group?.geviUrl || '');
              }}
              className="scrape-gevi-button"
              title="Scrape metadata from GEVI"
              style={{
                padding: '0.5rem 1rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🌐 Scrape GEVI
            </button>
            
            <button 
              onClick={() => {
                const aebnScraper = availableScrapers.find(s => s.siteName === 'AEBN');
                setSelectedScraper(aebnScraper);
                setShowScrapeModal(true);
                // Auto-populate AEBN URL if it's saved to the group
                const groupUrl = group?.url || '';
                let aebnUrl = '';
                
                try {
                  // Try to parse as JSON array and find AEBN URL
                  const urls = JSON.parse(groupUrl);
                  if (Array.isArray(urls)) {
                    aebnUrl = urls.find(url => url.includes('aebn.com') || url.includes('aebn.net')) || '';
                  }
                } catch (e) {
                  // Not JSON, check if single URL is AEBN
                  const isAebnUrl = groupUrl.includes('aebn.com') || groupUrl.includes('aebn.net');
                  aebnUrl = isAebnUrl ? groupUrl : '';
                }
                
                setScrapeUrl(aebnUrl);
              }}
              className="scrape-aebn-button"
              title="Scrape metadata from AEBN"
              style={{
                padding: '0.5rem 1rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              📀 Scrape AEBN
            </button>
            
            <button 
              onClick={handleDelete}
              className="delete-group-button"
              title="Delete this group from Stash and local database"
              style={{
                padding: '0.5rem 1rem',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🗑️ Delete Group
            </button>
          </div>

          <div className="group-metadata">
            {group.studio && (
              <div className="meta-row">
                <strong>Studio:</strong>
                <Link to={`/media/stash/studios/${group.studio.id}`}>{group.studio.name}</Link>
              </div>
            )}
            
            {group.director && (
              <div className="meta-row">
                <strong>Director:</strong>
                <span>{group.director}</span>
              </div>
            )}
            
            {group.date && (
              <div className="meta-row">
                <strong>Release Date:</strong>
                <span>{group.date}</span>
              </div>
            )}
            
            {group.duration && (
              <div className="meta-row">
                <strong>Total Duration:</strong>
                <span>{formatDuration(group.duration)}</span>
              </div>
            )}
            
            {group.rating && (
              <div className="meta-row">
                <strong>Rating:</strong>
                <span>⭐ {group.rating}/100</span>
              </div>
            )}
            
            {group.url && (() => {
              try {
                // Try to parse as JSON array
                const urls = JSON.parse(group.url);
                if (Array.isArray(urls) && urls.length > 0) {
                  return (
                    <div className="meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <strong style={{ marginBottom: '0.5rem' }}>URLs ({urls.length}):</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                        {urls.map((url, idx) => (
                          <a 
                            key={idx}
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              fontSize: '0.875rem',
                              color: '#3b82f6',
                              textDecoration: 'none',
                              wordBreak: 'break-all'
                            }}
                          >
                            {url.includes('aebn.com') || url.includes('aebn.net') ? '🎬 ' : '🔗 '}
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                // Not JSON, display as single URL
              }
              
              // Fallback to single URL display
              return (
                <div className="meta-row">
                  <strong>URL:</strong>
                  <a href={group.url} target="_blank" rel="noopener noreferrer">Open in Stash →</a>
                </div>
              );
            })()}
          </div>

          {group.synopsis && (
            <div className="group-synopsis">
              <h3>Synopsis</h3>
              <p>{group.synopsis}</p>
            </div>
          )}

          {group.tags && group.tags.length > 0 && (
            <div className="group-tags-section">
              <h3>Tags</h3>
              <div className="tags-list">
                {group.tags.map(tagWrapper => (
                  <Link
                    key={tagWrapper.tag.id}
                    to={`/media/stash/tags/${tagWrapper.tag.id}`}
                    className="tag-chip"
                  >
                    {tagWrapper.tag.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenes Section */}
      <div className="group-scenes-section">
        <h2>Scenes ({group.scenes?.length || 0})</h2>
        
        {(() => {
          // Transform scene data for SceneGrid
          // Include sceneIndex from the pivot table wrapper
          const scenes = group.scenes
            ?.sort((a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0))
            .map(wrapper => ({
              ...wrapper.scene,
              sceneIndex: wrapper.sceneIndex
            })) || [];
          
          const handleSceneClick = (scene) => {
            navigate(`/media/stash/scenes/${scene.id}`);
          };
          
          return scenes.length > 0 ? (
            <SceneGrid 
              scenes={scenes} 
              onSceneClick={handleSceneClick}
              onUnlinkClick={handleUnlinkScene}
              showSceneNumbers={true}
            />
          ) : (
            <p className="muted">No scenes in this group</p>
          );
        })()}
      </div>

      <style>{`
        .group-header {
          display: grid;
          grid-template-columns: 600px 1fr;
          gap: 2rem;
          margin: 2rem 0;
        }

        @media (max-width: 1024px) {
          .group-header {
            grid-template-columns: 400px 1fr;
          }
        }

        @media (max-width: 768px) {
          .group-header {
            grid-template-columns: 1fr;
          }
          
          .group-cover-section {
            flex-direction: column;
          }
        }

        .group-cover-section {
          display: flex;
          flex-direction: row;
          gap: 1rem;
          flex-shrink: 0;
        }

        .group-cover-large, .group-cover-placeholder-large {
          flex: 1;
          min-width: 0;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .group-back-cover {
          flex: 1;
          min-width: 0;
          aspect-ratio: 2/3;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .group-main-info h1 {
          margin: 0 0 0.5rem 0;
          color: #1a202c;
          font-size: 2rem;
        }

        .group-aliases {
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }

        .group-metadata {
          background: #f7fafc;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
        }

        .meta-row {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 1rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .meta-row:last-child {
          border-bottom: none;
        }

        .meta-row strong {
          color: #4a5568;
        }

        .meta-row a {
          color: #667eea;
          text-decoration: none;
        }

        .meta-row a:hover {
          text-decoration: underline;
        }

        .group-synopsis {
          margin: 1.5rem 0;
        }

        .group-synopsis h3 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
        }

        .group-synopsis p {
          line-height: 1.6;
          color: #4a5568;
        }

        .group-tags-section {
          margin: 1.5rem 0;
        }

        .group-tags-section h3 {
          margin: 0 0 0.75rem 0;
          color: #2d3748;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag-chip {
          padding: 0.4rem 0.8rem;
          background: #667eea;
          color: white;
          border-radius: 20px;
          font-size: 0.85rem;
          text-decoration: none;
          transition: background 0.2s;
        }

        .tag-chip:hover {
          background: #5568d3;
        }

        .group-scenes-section {
          margin-top: 3rem;
        }

        .group-scenes-section h2 {
          margin: 0 0 1.5rem 0;
          color: #1a202c;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #667eea;
        }

        .muted {
          color: #a0aec0;
        }

        .breadcrumb {
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }

        .breadcrumb a {
          color: #667eea;
          text-decoration: none;
        }

        .breadcrumb a:hover {
          text-decoration: underline;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          margin-top: 0;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .search-results {
          margin-top: 1rem;
          padding: 1rem;
          background: #f7fafc;
          border-radius: 4px;
        }

        .search-result-item {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid #e2e8f0;
        }

        .search-result-item:hover {
          background: #edf2f7;
          border-color: #667eea;
        }

        .scrape-review-field {
          margin-bottom: 1rem;
        }

        .scrape-review-field strong {
          display: block;
          margin-bottom: 0.25rem;
        }
      `}</style>

      {/* Scrape GEVI Modal */}
      {showScrapeModal && (
        <div className="modal-overlay" onClick={() => setShowScrapeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🌐 Scrape Movie Metadata</h2>
            
            {/* Scraper Selection */}
            {availableScrapers.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="scraper-select"><strong>Select Scraper:</strong></label>
                <select
                  id="scraper-select"
                  value={selectedScraper?.siteName || ''}
                  onChange={(e) => {
                    const scraper = availableScrapers.find(s => s.siteName === e.target.value);
                    setSelectedScraper(scraper || null);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    marginTop: '0.5rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '4px'
                  }}
                  disabled={isScraping}
                >
                  {availableScrapers.map(scraper => (
                    <option key={scraper.siteName} value={scraper.siteName}>
                      {scraper.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="gevi-url"><strong>{selectedScraper ? selectedScraper.siteName : 'GEVI'} Movie URL:</strong></label>
              <input
                id="gevi-url"
                type="text"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder={selectedScraper?.siteName === 'AEBN' 
                  ? "https://gay.aebn.com/gay/movies/..." 
                  : "https://gayeroticvideoindex.com/video/..."}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  marginTop: '0.5rem',
                  border: '1px solid #cbd5e0',
                  borderRadius: '4px'
                }}
                disabled={isScraping}
              />
              <small style={{ color: '#718096', display: 'block', marginTop: '0.25rem' }}>
                Enter {selectedScraper ? selectedScraper.siteName : 'GEVI'} movie URL or use Search to find the movie
              </small>
            </div>

            {/* Search Results */}
            {searchResults && searchResults.movies && searchResults.movies.length > 0 && (
              <div className="search-results">
                <strong>Found {searchResults.movies.length} movie(s) for "{searchResults.group.name}":</strong>
                {searchResults.movies.map((movie, index) => (
                  <div
                    key={index}
                    className="search-result-item"
                    onClick={() => handleSelectSearchResult(movie.url)}
                  >
                    <strong>{movie.name}</strong>
                    <br />
                    <small style={{ color: '#718096' }}>Click to select this movie</small>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                onClick={handleSearchGevi}
                disabled={isScraping || isSearching}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSearching ? 'not-allowed' : 'pointer',
                  opacity: isSearching ? 0.6 : 1
                }}
              >
                {isSearching ? '🔄 Searching...' : '🔎 Search by Title'}
              </button>
              <button
                onClick={handleScrapeGevi}
                disabled={isScraping || !scrapeUrl.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!scrapeUrl.trim() || isScraping) ? 'not-allowed' : 'pointer',
                  opacity: (!scrapeUrl.trim() || isScraping) ? 0.6 : 1
                }}
              >
                {isScraping ? '🔄 Scraping...' : '🔍 Scrape'}
              </button>
              <button
                onClick={() => setShowScrapeModal(false)}
                disabled={isScraping}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e2e8f0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isScraping ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrape Review Modal */}
      {showScrapeReviewModal && scrapeData && (
        <div className="modal-overlay" onClick={() => setShowScrapeReviewModal(false)}>
          <div className="modal-content scrape-review-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📋 Review Scraped Metadata</h3>
            {/* DEBUG: Log scrapeData on render */}
            {console.log('🎬 Modal Rendering - scrapeData:', scrapeData)}
            {console.log('🎬 Modal Rendering - matchedScenes:', scrapeData.matchedScenes)}
            {console.log('🎬 Modal Rendering - matchedScenes length:', scrapeData.matchedScenes?.length)}
            
            {/* Debug output */}
            {console.log('🔍 Modal scrapeData:', scrapeData)}
            {console.log('🔍 Modal scrapeData.scraped:', scrapeData?.scraped)}
            {console.log('🔍 Modal scrapeData.sourceUrl:', scrapeData?.sourceUrl)}
            
            <div className="scrape-results">
              {/* Source Information */}
              <div className="scrape-source">
                <span className="source-label">Scraped from:</span>
                <a 
                  href={scrapeData.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="source-url"
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'none',
                    marginLeft: '0.5rem'
                  }}
                >
                  GEVI Movie
                </a>
              </div>

              {/* Movie Images */}
              {(scrapeData.scraped.front_image || scrapeData.scraped.back_image) && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '1rem 0' }}>
                  {scrapeData.scraped.front_image && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Front Cover</div>
                      <img 
                        src={scrapeData.scraped.front_image} 
                        alt="Front cover"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          console.error('Failed to load front image:', scrapeData.scraped.front_image);
                        }}
                      />
                    </div>
                  )}
                  {scrapeData.scraped.back_image && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Back Cover</div>
                      <img 
                        src={scrapeData.scraped.back_image} 
                        alt="Back cover"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          console.error('Failed to load back image:', scrapeData.scraped.back_image);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Fields */}
              <div style={{ marginTop: '1.5rem' }}>
                {scrapeData.scraped.name && (
                  <div className="parse-field" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Title:</label>
                    <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                      {scrapeData.scraped.name}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {scrapeData.scraped.date && (
                    <div className="parse-field">
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Release Date:</label>
                      <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        {scrapeData.scraped.date}
                      </div>
                    </div>
                  )}

                  {scrapeData.scraped.duration && (
                    <div className="parse-field">
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Duration:</label>
                      <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        {scrapeData.scraped.duration} minutes
                      </div>
                    </div>
                  )}

                  {scrapeData.scraped.director && (
                    <div className="parse-field">
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Director:</label>
                      <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        {scrapeData.scraped.director}
                      </div>
                    </div>
                  )}

                  {scrapeData.scraped.studio && (
                    <div className="parse-field">
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Studio:</label>
                      <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                        {typeof scrapeData.scraped.studio === 'string' ? scrapeData.scraped.studio : scrapeData.scraped.studio.name}
                      </div>
                    </div>
                  )}
                </div>

                {scrapeData.scraped.synopsis && (
                  <div className="parse-field" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>Synopsis:</label>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#f9fafb', 
                      borderRadius: '4px', 
                      border: '1px solid #e5e7eb',
                      lineHeight: '1.6',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }}>
                      {scrapeData.scraped.synopsis}
                    </div>
                  </div>
                )}

                {scrapeData.scraped.externalUrls && scrapeData.scraped.externalUrls.length > 0 && (
                  <div className="parse-field" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                      External URLs ({scrapeData.scraped.externalUrls.length}):
                    </label>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#f9fafb', 
                      borderRadius: '4px', 
                      border: '1px solid #e5e7eb',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }}>
                      {scrapeData.scraped.externalUrls.map((url, idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#3b82f6', textDecoration: 'none', wordBreak: 'break-all' }}
                          >
                            {url.includes('aebn.com') || url.includes('aebn.net') ? '🎬 ' : '🔗 '}
                            {url}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scrapeData.scraped.url && (
                  <div className="parse-field" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>GEVI URL:</label>
                    <div style={{ 
                      padding: '0.5rem', 
                      background: '#f9fafb', 
                      borderRadius: '4px', 
                      border: '1px solid #e5e7eb',
                      wordBreak: 'break-all',
                      fontSize: '0.875rem'
                    }}>
                      <a 
                        href={scrapeData.scraped.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#3b82f6', textDecoration: 'none' }}
                      >
                        {scrapeData.scraped.url}
                      </a>
                    </div>
                  </div>
                )}

                {/* Tag Matching Section */}
                {scrapeData.matched && scrapeData.unmatched && (scrapeData.matched.tags?.length > 0 || scrapeData.unmatched.tags?.length > 0) && (
                  <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
                      🏷️ Tags ({(scrapeData.matched.tags?.length || 0) + (scrapeData.unmatched.tags?.length || 0)})
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                      {/* Matched tags from scrape */}
                      {scrapeData.matched.tags?.map((tag, index) => (
                        <div key={`matched-${index}`} style={{
                          padding: '6px 12px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: '500'
                        }}>
                          <span>✓</span>
                          <span>{tag.name}</span>
                        </div>
                      ))}
                      
                      {/* Unmatched tags */}
                      {scrapeData.unmatched.tags?.map((tag, index) => {
                        const tagName = typeof tag === 'string' ? tag : tag.name;
                        
                        return (
                          <div key={`unmatched-${index}`} style={{
                            padding: '6px 12px',
                            background: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: '1px dashed #f59e0b',
                            fontWeight: '500'
                          }}>
                            <span>✗</span>
                            <span>{tagName}</span>
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#b45309',
                              fontWeight: '400'
                            }}>
                              (not in database)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#f0f9ff', 
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe'
                    }}>
                      ℹ️ Tags with ✓ exist in your database and will be applied. Tags with ✗ are not in your database and will be skipped.
                    </div>
                  </div>
                )}

                {/* Matched Scenes Section */}
                {scrapeData.matchedScenes && scrapeData.matchedScenes.length > 0 && (
                  <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1f2937' }}>
                      🎬 Matched Scenes ({scrapeData.matchedScenes.length})
                    </h4>
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#fef3c7', 
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#92400e',
                      border: '1px solid #fbbf24',
                      marginBottom: '1rem'
                    }}>
                      💡 Tags with checkboxes are not in your database. Check them to create and apply them to the scene.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {scrapeData.matchedScenes.map((match, idx) => (
                        <div 
                          key={idx}
                          style={{
                            padding: '1rem',
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ fontWeight: '600', color: '#15803d', fontSize: '0.875rem' }}>
                              Scene {match.sceneNumber}
                              {match.confidence && (
                                <span style={{ 
                                  marginLeft: '0.5rem', 
                                  padding: '0.125rem 0.5rem', 
                                  background: '#22c55e', 
                                  color: 'white', 
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}>
                                  {match.confidence}% match
                                </span>
                              )}
                              {match.matchMethod && (
                                <span style={{ 
                                  marginLeft: '0.5rem', 
                                  padding: '0.125rem 0.5rem', 
                                  background: match.matchMethod === 'performers' ? '#3b82f6' : '#f59e0b', 
                                  color: 'white', 
                                  borderRadius: '9999px',
                                  fontSize: '0.7rem',
                                  fontWeight: '500'
                                }}>
                                  {match.matchMethod === 'performers' ? '👥' : '#️⃣'} {match.matchMethod}
                                </span>
                              )}
                            </div>
                            {match.date && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {match.date}
                              </div>
                            )}
                          </div>
                          
                          {/* Database Scene Title */}
                          {match.dbSceneTitle && (
                            <div style={{ 
                              fontSize: '0.85rem', 
                              fontWeight: '600',
                              color: '#6b7280', 
                              marginBottom: '0.25rem'
                            }}>
                              📁 Your Scene: {match.dbSceneTitle}
                            </div>
                          )}
                          
                          {/* Scraped Title */}
                          {match.title && (
                            <div style={{ 
                              fontSize: '0.9rem', 
                              fontWeight: '600',
                              color: '#1f2937', 
                              marginBottom: '0.5rem'
                            }}>
                              🎬 Scraped: {match.title}
                            </div>
                          )}
                          
                          {/* Performers */}
                          {match.performers && match.performers.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
                                Performers:{' '}
                              </span>
                              <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                                {match.performers.map(p => p.name || p).join(', ')}
                              </span>
                            </div>
                          )}
                          
                          {/* Tags */}
                          {((match.matchedTags && match.matchedTags.length > 0) || (match.unmatchedTags && match.unmatchedTags.length > 0)) && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                Tags:
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                {/* Matched tags */}
                                {match.matchedTags?.map((tag, tagIdx) => (
                                  <span 
                                    key={`matched-${tagIdx}`}
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '0.125rem 0.5rem',
                                      background: '#d1fae5',
                                      color: '#065f46',
                                      borderRadius: '9999px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <span>✓</span>
                                    <span>{tag.name || tag}</span>
                                  </span>
                                ))}
                                
                                {/* Unmatched tags with checkboxes */}
                                {match.unmatchedTags?.map((tag, tagIdx) => {
                                  const tagName = typeof tag === 'string' ? tag : tag.name;
                                  const isChecked = tagsToCreate[idx]?.[tagName] || false;
                                  
                                  return (
                                    <label
                                      key={`unmatched-${tagIdx}`}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.125rem 0.5rem',
                                        background: '#fef3c7',
                                        color: '#92400e',
                                        borderRadius: '9999px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        border: '1px dashed #f59e0b',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          setTagsToCreate(prev => ({
                                            ...prev,
                                            [idx]: {
                                              ...(prev[idx] || {}),
                                              [tagName]: e.target.checked
                                            }
                                          }));
                                        }}
                                        style={{ width: '12px', height: '12px', cursor: 'pointer' }}
                                      />
                                      <span>✗</span>
                                      <span>{tagName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {match.unmatchedTags && match.unmatchedTags.length > 0 && (
                                <div style={{ 
                                  fontSize: '0.7rem',
                                  color: '#92400e',
                                  marginTop: '0.25rem',
                                  fontStyle: 'italic'
                                }}>
                                  💡 Check tags to create them in your database
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Details/Synopsis */}
                          {match.details && (
                            <div style={{ 
                              fontSize: '0.875rem', 
                              color: '#374151', 
                              lineHeight: '1.5',
                              maxHeight: '100px',
                              overflowY: 'auto',
                              marginTop: '0.5rem',
                              paddingTop: '0.5rem',
                              borderTop: '1px solid #86efac'
                            }}>
                              {match.details.substring(0, 200)}{match.details.length > 200 ? '...' : ''}
                            </div>
                          )}
                          
                          {/* Episode URL */}
                          {match.episodeUrl && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <a 
                                href={match.episodeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#3b82f6',
                                  textDecoration: 'none'
                                }}
                              >
                                View on GEVI →
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      background: '#eff6ff', 
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#1e40af'
                    }}>
                      ℹ️ These scenes were automatically matched based on performers and titles. Scene numbers will be updated when you accept.
                    </div>
                  </div>
                )}

                {/* Compilations Section */}
                {scrapeData.compilations && (scrapeData.compilations.matched.length > 0 || scrapeData.compilations.unmatched.length > 0) && (
                  <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1f2937' }}>
                      📀 Compilations Found in Matched Scenes
                    </h4>
                    
                    {/* Group compilations by scene number */}
                    {(() => {
                      const compilationsByScene = {};
                      
                      // Group matched compilations
                      scrapeData.compilations.matched.forEach(comp => {
                        if (!compilationsByScene[comp.sceneNumber]) {
                          compilationsByScene[comp.sceneNumber] = { matched: [], unmatched: [] };
                        }
                        compilationsByScene[comp.sceneNumber].matched.push(comp);
                      });
                      
                      // Group unmatched compilations
                      scrapeData.compilations.unmatched.forEach(comp => {
                        if (!compilationsByScene[comp.sceneNumber]) {
                          compilationsByScene[comp.sceneNumber] = { matched: [], unmatched: [] };
                        }
                        compilationsByScene[comp.sceneNumber].unmatched.push(comp);
                      });
                      
                      return Object.keys(compilationsByScene).sort((a, b) => a - b).map(sceneNumber => (
                        <div key={sceneNumber} style={{ marginBottom: '1.5rem' }}>
                          <h5 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.75rem', color: '#4b5563' }}>
                            Scene {sceneNumber}
                          </h5>
                          
                          {/* Matched Compilations for this scene */}
                          {compilationsByScene[sceneNumber].matched.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#15803d' }}>
                                ✅ Found in Database ({compilationsByScene[sceneNumber].matched.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {compilationsByScene[sceneNumber].matched.map((comp, idx) => (
                                  <div 
                                    key={idx}
                                    style={{
                                      padding: '0.75rem',
                                      background: '#f0fdf4',
                                      border: '1px solid #86efac',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: '600', color: '#15803d', fontSize: '0.875rem' }}>
                                        {comp.name}
                                      </div>
                                      {comp.studio && (
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                          Studio: {comp.studio}
                                        </div>
                                      )}
                                      {comp.date && (
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                          Released: {comp.date}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <button
                                        onClick={() => handleLinkSceneToCompilation(comp)}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          background: '#8b5cf6',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        🔗 Link Scene
                                      </button>
                                      <a
                                        href={`/media/stash/groups/${comp.id}`}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          background: '#10b981',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          textDecoration: 'none',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        View Movie
                                      </a>
                                      <button
                                        onClick={() => handleAddCompilation(comp)}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          background: '#f59e0b',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        ➕ Create New Movie
                                      </button>
                                      {comp.stashId && (
                                        <a
                                          href={`${config.apiBaseUrl.replace('/api', '')}/movies/${comp.stashId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            padding: '0.375rem 0.75rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            textDecoration: 'none',
                                            fontSize: '0.75rem',
                                            fontWeight: '500',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          View in Stash
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Create New Movie Button - if match isn't right */}
                          {compilationsByScene[sceneNumber].matched.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <button
                                onClick={() => {
                                  const comp = compilationsByScene[sceneNumber].matched[0];
                                  handleAddCompilation(comp);
                                }}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#f59e0b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '600',
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem'
                                }}
                                title="Match not right? Create a new movie instead"
                              >
                                ➕ Create New Movie Instead
                              </button>
                              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem', textAlign: 'center' }}>
                                If the matched movie isn't correct, create a new one
                              </div>
                            </div>
                          )}

                          {/* Unmatched Compilations for this scene */}
                          {compilationsByScene[sceneNumber].unmatched.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#dc2626' }}>
                                ⚠️  Not in Database ({compilationsByScene[sceneNumber].unmatched.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {compilationsByScene[sceneNumber].unmatched.map((comp, idx) => (
                                  <div 
                                    key={idx}
                                    style={{
                                      padding: '0.75rem',
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: '600', color: '#dc2626', fontSize: '0.875rem' }}>
                                        {comp.name}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                        This compilation is not in your database yet
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <a
                                        href={comp.geviUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          background: '#6b7280',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          textDecoration: 'none',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        View on GEVI
                                      </a>
                                      <button
                                        onClick={() => handleCreateCompilation(comp)}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          background: '#10b981',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: '500',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        ➕ Add Movie
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ));
                    })()}

                    <div style={{ 
                      marginTop: '1rem', 
                      padding: '0.75rem', 
                      background: '#eff6ff', 
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#1e40af'
                    }}>
                      ℹ️ These compilations were found in the "found in compilation" sections for matched scenes on GEVI. You can add new compilations to your database to track them.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowScrapeReviewModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#d1d5db'}
                onMouseOut={(e) => e.target.style.background = '#e5e7eb'}
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptScrape}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#059669'}
                onMouseOut={(e) => e.target.style.background = '#10b981'}
              >
                ✅ Accept & Update Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

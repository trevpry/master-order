import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDuration } from '../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../utils/stashUtils';
import StashPerformerOverlay from '../../../../components/overlays/StashPerformerOverlay';
import PerformerSwapModal from './components/PerformerSwapModal';
import AddPerformerModal from './components/AddPerformerModal';
import MergePerformersModal from '../../../../components/stash/MergePerformersModal';
import PerformerCheckboxOverlay from '../../../../components/stash/PerformerCheckboxOverlay';
import config from '../../../../config';

export default function SceneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [showPerformerChoice, setShowPerformerChoice] = useState(false);
  const [clickedPerformer, setClickedPerformer] = useState(null);
  const [mergedTags, setMergedTags] = useState([]);
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseData, setParseData] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedStudio, setEditedStudio] = useState('');
  const [editedPerformers, setEditedPerformers] = useState([]);
  const [editedFilename, setEditedFilename] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [aebnSceneNumber, setAebnSceneNumber] = useState(''); // Scene number for AEBN direct scraping
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeData, setScrapeData] = useState(null);
  const [showScrapeReviewModal, setShowScrapeReviewModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [creatingPerformers, setCreatingPerformers] = useState(new Set()); // Track which performers are being created
  const [creatingGroups, setCreatingGroups] = useState(new Set()); // Track which groups are being created
  const [creatingTags, setCreatingTags] = useState(new Set()); // Track which tags are being created
  const [isCreatingMatched, setIsCreatingMatched] = useState(false); // Track if creating a new movie from matched group
  const [fieldSelections, setFieldSelections] = useState({
    title: 'scraped',
    studio: 'scraped', 
    date: 'scraped',
    details: 'scraped',
    image: 'scraped',
    url: 'scraped'
  }); // Track which version of each field to use
  const [hoveringPerformer, setHoveringPerformer] = useState(null); // Track which performer is being hovered
  const [showGeviUrlModal, setShowGeviUrlModal] = useState(false);
  const [showStashBoxSearchModal, setShowStashBoxSearchModal] = useState(false);
  const [stashBoxSearchType, setStashBoxSearchType] = useState('fragment'); // 'fragment', 'title', 'performers'
  const [stashBoxSearchQuery, setStashBoxSearchQuery] = useState('');
  const [selectedStashBoxScraper, setSelectedStashBoxScraper] = useState(null);
  const [geviUrlInput, setGeviUrlInput] = useState('');
  const [isSavingGeviUrl, setIsSavingGeviUrl] = useState(false);
  const [parseStudio, setParseStudio] = useState(true);
  const [parseTitle, setParseTitle] = useState(true);
  const [parsePerformers, setParsePerformers] = useState(true);
  const [stashUrl, setStashUrl] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [performerToSwap, setPerformerToSwap] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Generic scraper states
  const [availableScrapers, setAvailableScrapers] = useState([]);
  const [selectedScraper, setSelectedScraper] = useState(null);
  
  // Performer selection and merge states
  const [performerSelectionMode, setPerformerSelectionMode] = useState(false);
  const [selectedPerformers, setSelectedPerformers] = useState(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showAddPerformerModal, setShowAddPerformerModal] = useState(false);

  // URL editor states
  const [showUrlEditorModal, setShowUrlEditorModal] = useState(false);
  const [editingUrls, setEditingUrls] = useState([]);
  const [isSavingUrls, setIsSavingUrls] = useState(false);

  // Studio editor states
  const [showStudioEditorModal, setShowStudioEditorModal] = useState(false);
  const [availableStudios, setAvailableStudios] = useState([]);
  const [studioSearchQuery, setStudioSearchQuery] = useState('');
  const [selectedStudioId, setSelectedStudioId] = useState(null);
  const [isUpdatingStudio, setIsUpdatingStudio] = useState(false);

  // Fetch Stash URL from settings
  useEffect(() => {
    const fetchStashUrl = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/settings`);
        const settings = await res.json();
        if (settings?.stashUrl) {
          setStashUrl(settings.stashUrl);
        }
      } catch (error) {
        console.error('Error fetching Stash URL:', error);
      }
    };
    fetchStashUrl();
  }, []);

  useEffect(() => {
    const fetchScene = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load scene');
        setData(json.data);
        
        // Merge scene tags with performer tags
        const tagMap = new Map();
        
        // Add scene tags
        if (json.data.tags) {
          json.data.tags.forEach(tag => {
            tagMap.set(tag.id, {
              id: tag.id,
              name: tag.name,
              description: tag.description,
              isSceneTag: true,
              performers: []
            });
          });
        }
        
        // Add performer tags
        if (json.data.performers) {
          json.data.performers.forEach(performer => {
            if (performer.tags && performer.tags.length > 0) {
              performer.tags.forEach(tagWrapper => {
                const tag = tagWrapper.tag;
                if (tagMap.has(tag.id)) {
                  // Tag exists, add performer reference
                  tagMap.get(tag.id).performers.push({
                    id: performer.id,
                    name: performer.name
                  });
                } else {
                  // New tag from performer
                  tagMap.set(tag.id, {
                    id: tag.id,
                    name: tag.name,
                    description: tag.description,
                    isSceneTag: false,
                    performers: [{
                      id: performer.id,
                      name: performer.name
                    }]
                  });
                }
              });
            }
          });
        }
        
        // Convert to sorted array
        const merged = Array.from(tagMap.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setMergedTags(merged);
        
        // Fetch available scrapers for this scene
        fetchAvailableScrapers(id);
        
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchScene();
  }, [id]);

  // Fetch available scrapers for the scene
  const fetchAvailableScrapers = async (sceneId) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/available-scrapers`);
      const json = await res.json();
      if (json.success && json.data.scrapers) {
        setAvailableScrapers(json.data.scrapers);
        console.log('✅ Available scrapers:', json.data.scrapers);
      }
    } catch (error) {
      console.error('Error fetching available scrapers:', error);
    }
  };

  const handlePerformerClick = (e, performer) => {
    e.preventDefault();
    const performerData = performer.performer || performer;
    setClickedPerformer(performerData);
    setShowPerformerChoice(true);
  };

  const handleViewPerformerDetails = () => {
    if (clickedPerformer) {
      navigate(`/media/stash/performers/${clickedPerformer.id}`);
    }
  };

  const handleShowPerformerOverlay = () => {
    setSelectedPerformer(clickedPerformer);
    setShowPerformerChoice(false);
  };

  const handleParseFilename = async (customFilename = null) => {
    if (!data || !data.path) {
      alert('No file path available to parse');
      return;
    }

    // If customFilename is an event object (from button click), set it to null
    if (customFilename && typeof customFilename === 'object' && customFilename.target) {
      customFilename = null;
    }

    setIsParsing(true);

    try {
      // Extract filename from path if not using custom filename
      if (!customFilename) {
        const pathParts = data.path.split(/[\\/]/);
        const fullFilename = pathParts[pathParts.length - 1];
        const filenameWithoutExt = fullFilename.replace(/\.[^/.]+$/, '');
        setEditedFilename(filenameWithoutExt);
      }

      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/parse-filename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customFilename: customFilename || undefined,
          parseStudio: parseStudio,
          parseTitle: parseTitle,
          parsePerformers: parsePerformers
        })
      });

      const result = await response.json();

      if (result.success) {
        const { parsed, matched, unmatched } = result.data;
        
        // Store parse results and show modal
        setParseData({ parsed, matched, unmatched });
        setEditedTitle(parsed.title || '');
        setEditedStudio(parsed.studio || '');
        setEditedPerformers(parsed.performers || []);
        setShowParseModal(true);
      } else {
        alert(`Failed to parse filename: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error parsing filename:', error);
      alert('Failed to parse filename');
    } finally {
      setIsParsing(false);
    }
  };

  const handleRefreshParse = async () => {
    if (!editedFilename.trim()) {
      alert('Please enter a filename to parse');
      return;
    }
    await handleParseFilename(editedFilename);
  };

  const handleSearchGevi = async () => {
    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/search-gevi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        const { firstPerformer, searchedPerformers, scenes } = result.data;
        
        // Proxy GEVI image URLs to avoid CORS issues
        const scenesWithProxiedImages = scenes.map(scene => {
          if (scene.image && scene.image.startsWith('https://gayeroticvideoindex.com/')) {
            return {
              ...scene,
              image: `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(scene.image)}`
            };
          }
          return scene;
        });
        
        if (scenesWithProxiedImages.length === 0) {
          alert(`No scenes found with ${firstPerformer.name} and ${searchedPerformers.join(', ')}`);
        } else {
          setSearchResults({
            firstPerformer,
            searchedPerformers,
            scenes: scenesWithProxiedImages,
            isSceneSearch: true  // Flag to indicate this is scene search (not movie search)
          });
        }
      } else {
        alert(`Failed to search GEVI: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching GEVI:', error);
      alert('Failed to search GEVI');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchGeviByTitle = async () => {
    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/search-gevi-by-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        const { studio, searchTitle, scenes } = result.data;
        
        if (scenes.length === 0) {
          alert(`No scenes found for "${searchTitle}" on ${studio.name}'s GEVI page`);
        } else {
          // Set search results in a format compatible with the existing display
          setSearchResults({
            firstPerformer: { name: studio.name },
            secondPerformer: `(Title: "${searchTitle}")`,
            scenes: scenes,
            isSceneSearchByTitle: true  // Flag to indicate this is title search (not movie search)
          });
        }
      } else {
        alert(`Failed to search GEVI by title: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching GEVI by title:', error);
      alert('Failed to search GEVI by title');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchGeviMovies = async () => {
    // Check if we need to search by title (no performers) or by performers
    const hasEnoughPerformers = data && data.performers && data.performers.length >= 2;
    const hasStudioAndTitle = data?.studio?.geviUrl && data?.title;
    
    if (!hasEnoughPerformers && !hasStudioAndTitle) {
      alert('Scene needs either:\n- At least 2 performers to search by performers, OR\n- A studio with GEVI URL and scene title to search by title');
      return;
    }

    setIsSearching(true);
    setSearchResults(null); // Clear any previous results

    try {
      // If no performers, use title-based search instead
      const endpoint = hasEnoughPerformers 
        ? `${config.apiBaseUrl}/api/stash/scenes/${id}/search-gevi-movies`
        : `${config.apiBaseUrl}/api/stash/scenes/${id}/search-gevi-movies-by-title`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        const { firstPerformer, secondPerformer, movies, searchMethod } = result.data;
        
        if (movies && movies.length > 0) {
          // Set search results to display in modal (using same format as scenes)
          setSearchResults({
            firstPerformer: firstPerformer || { name: 'Studio Movies' },
            secondPerformer: secondPerformer || `Title: "${data.title}"`,
            scenes: movies // Use 'scenes' key for consistency with existing display logic
          });
        } else {
          const searchDescription = searchMethod === 'title' 
            ? `with title "${data.title}" on studio page`
            : `with ${firstPerformer.name} and ${secondPerformer}`;
          alert(`No movies found ${searchDescription}`);
        }
      } else {
        alert(`Failed to search GEVI movies: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching GEVI movies:', error);
      alert('Failed to search GEVI movies');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchYamlScraper = async () => {
    if (!data?.studio?.scraperName) {
      alert('This studio does not have a scraper configured');
      return;
    }

    if (!data?.performers || data.performers.length === 0) {
      alert('Scene must have at least one performer to search');
      return;
    }

    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/search-yaml`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraperName: data.studio.scraperName
        })
      });

      const result = await response.json();

      if (result.success) {
        const { scenes, performers, source } = result.data;
        
        if (scenes.length === 0) {
          alert(`No scenes found on ${source} with ${performers.map(p => p.name).join(' and ')}`);
        } else {
          setSearchResults({
            firstPerformer: performers[0],
            searchedPerformers: performers.slice(1).map(p => p.name),
            scenes: scenes,
            isSceneSearch: true,
            source: source
          });
        }
      } else {
        alert(`Failed to search ${data.studio.scraperName}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching with YAML scraper:', error);
      alert('Failed to search with YAML scraper');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchYamlScraperByTitle = async () => {
    // For Stash native scrapers, use the selected scraper directly
    if (selectedScraper?.isStashNative || selectedScraper?.type === 'StashNativeScraperService') {
      if (!data?.title) {
        alert('Scene must have a title to search');
        return;
      }

      setIsSearching(true);
      setSearchResults(null);

      try {
        const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/search-yaml-title`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            scraperName: selectedScraper.siteName
          })
        });

        const result = await response.json();

        if (result.success) {
          const { scenes, searchedTitle, source } = result.data;
          
          if (scenes.length === 0) {
            alert(`No scenes found on ${source} matching title: "${searchedTitle}"`);
          } else {
            setSearchResults({
              scenes: scenes,
              isSceneSearch: true,
              isSceneSearchByTitle: true,
              searchedTitle: searchedTitle,
              source: source
            });
          }
        } else {
          alert(`Failed to search ${selectedScraper.siteName} by title: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error searching with Stash native scraper by title:', error);
        alert('Failed to search with Stash native scraper by title');
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // For YAML scrapers, require studio scraper configuration
    if (!data?.studio?.scraperName) {
      alert('This studio does not have a scraper configured');
      return;
    }

    if (!data?.title) {
      alert('Scene must have a title to search');
      return;
    }

    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/search-yaml-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraperName: data.studio.scraperName
          // Don't pass studioUrl - let the scraper use the configured studioSearchUrl pattern
        })
      });

      const result = await response.json();

      if (result.success) {
        const { scenes, searchedTitle, source } = result.data;
        
        if (scenes.length === 0) {
          alert(`No scenes found on ${source} matching title: "${searchedTitle}"`);
        } else {
          setSearchResults({
            scenes: scenes,
            isSceneSearch: true,
            isSceneSearchByTitle: true,
            searchedTitle: searchedTitle,
            source: source
          });
        }
      } else {
        alert(`Failed to search ${data.studio.scraperName} by title: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching with YAML scraper by title:', error);
      alert('Failed to search with YAML scraper by title');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSmartScrape = async () => {
    // Smart scraping only works with Stash native scrapers
    if (!selectedScraper?.isStashNative && selectedScraper?.type !== 'StashNativeScraperService') {
      alert('Smart scraping is only available for Stash native scrapers');
      return;
    }

    if (!data?.title && !data?.code && (!data?.urls || data.urls.length === 0)) {
      alert('Scene must have at least a title, code, or URL for smart scraping');
      return;
    }

    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/smart-scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraperName: selectedScraper.siteName
        })
      });

      const result = await response.json();

      if (result.success) {
        const { scenes, sourceMetadata, source } = result.data;
        
        if (scenes.length === 0) {
          alert(`No matches found on ${source} using scene metadata`);
        } else {
          setSearchResults({
            scenes: scenes,
            isSceneSearch: true,
            isSmartScrape: true,
            sourceMetadata: sourceMetadata,
            source: source
          });
        }
      } else {
        alert(`Failed to smart scrape ${selectedScraper.siteName}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error with smart scraping:', error);
      alert('Failed to smart scrape scene');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (sceneUrl, movieData = null) => {
    // If this is a movie result with existing movie ID, link scene to movie
    if (movieData && movieData.existingMovieId) {
      handleLinkToExistingMovie(movieData.existingMovieId);
    } 
    // If this is a movie result without existing movie, create new movie
    else if (movieData && !movieData.existingMovieId) {
      handleCreateNewMovie(movieData);
    }
    // Otherwise, it's a scene search result - just populate URL
    else {
      setScrapeUrl(sceneUrl);
      setSearchResults(null); // Clear search results
    }
  };

  const handleLinkToExistingMovie = async (movieId) => {
    try {
      setIsSearching(true);
      
      // Link the scene to the existing movie
      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups/${movieId}/add-scene`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sceneId: id,
          sceneIndex: 0 // Default index
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Scene linked to existing movie successfully!`);
        // Navigate to movie detail page
        window.location.href = `/media/stash/groups/${movieId}`;
      } else {
        alert(`Failed to link scene to movie: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error linking scene to movie:', error);
      alert('Failed to link scene to movie');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateNewMovie = async (movieData) => {
    try {
      setIsSearching(true);
      
      // Create new movie with GEVI URL
      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: movieData.title,
          geviUrl: movieData.url
        })
      });

      const result = await response.json();

      if (result.success) {
        // Link the scene to the newly created movie
        const movieId = result.data.group.id;
        
        const linkResponse = await fetch(`${config.apiBaseUrl}/api/stash/groups/${movieId}/add-scene`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sceneId: id,
            sceneIndex: 0
          })
        });

        const linkResult = await linkResponse.json();

        if (linkResult.success) {
          alert(`✅ New movie created and scene linked successfully!`);
          // Navigate to new movie detail page
          window.location.href = `/media/stash/groups/${movieId}`;
        } else {
          alert(`Movie created but failed to link scene: ${linkResult.error || 'Unknown error'}`);
        }
      } else {
        alert(`Failed to create movie: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating movie:', error);
      alert('Failed to create movie');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStashBoxResult = async (sceneResult) => {
    try {
      setIsScraping(true);
      setSearchResults(null); // Clear search results
      
      console.log(`📦 Processing stash-box result:`, sceneResult.title);
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/scrape-stashbox-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraped: sceneResult
        })
      });

      const result = await response.json();

      if (result.success) {
        const { scraped, matched, unmatched, sourceUrl, source } = result.data;
        
        setScrapeData({ 
          scraped, 
          matched, 
          unmatched,
          sourceUrl: sourceUrl,
          source: source
        });
        
        setFieldSelections({
          title: 'scraped',
          details: 'scraped',
          url: 'scraped',
          date: 'scraped',
          studio: 'scraped',
          image: 'scraped'
        });
        
        setShowScrapeReviewModal(true);
      } else {
        alert(`Failed to process result: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing stash-box result:', error);
      alert('Failed to process stash-box result');
    } finally {
      setIsScraping(false);
    }
  };

  const handleScrapeGevi = async () => {
    // Check if this is a stash-box scraper (doesn't need URL)
    const isStashBox = selectedScraper?.isStashBox || selectedScraper?.type === 'stash-box';
    
    if (!isStashBox && !scrapeUrl.trim()) {
      alert(`Please enter a ${selectedScraper ? selectedScraper.siteName : 'GEVI'} URL`);
      return;
    }

    setIsScraping(true);

    try {
      let endpoint, requestBody;
      
      if (isStashBox) {
        // Stash-box fragment scraping - uses scene's existing metadata
        endpoint = `/api/stash/scenes/${id}/scrape-stashbox`;
        requestBody = {
          endpoint: selectedScraper.endpoint
        };
        console.log(`📦 Fragment scraping with ${selectedScraper.name} from ${selectedScraper.endpoint}`);
      } else if (selectedScraper) {
        // YAML scraper with URL
        endpoint = `/api/stash/scenes/${id}/scrape-generic`;
        requestBody = { 
          url: scrapeUrl, 
          scraperName: selectedScraper.siteName,
          // Include scene number for AEBN if provided
          ...(selectedScraper.siteName === 'AEBN' && aebnSceneNumber ? { sceneNumber: parseInt(aebnSceneNumber) } : {})
        };
        console.log(`🔍 Scraping with ${selectedScraper.siteName}:`, scrapeUrl);
        if (selectedScraper.siteName === 'AEBN' && aebnSceneNumber) {
          console.log(`   - Direct scene number: ${aebnSceneNumber}`);
        }
      } else {
        // GEVI scraping
        endpoint = `/api/stash/scenes/${id}/scrape-gevi`;
        requestBody = { url: scrapeUrl };
        console.log(`🔍 Scraping with GEVI:`, scrapeUrl);
      }

      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success) {
        const { scraped, matched, unmatched, sourceUrl, source } = result.data;
        
        console.log('🔍 Scraped data received:', scraped);
        console.log('📸 Image URL:', scraped.image);
        console.log('🔗 Source URL:', sourceUrl);
        console.log('🏷️  Scraper Source:', source);
        
        // Store original image URL for sending to Stash
        const originalImageUrl = scraped.image;
        
        // Convert GEVI image URL to proxied URL for browser display (to avoid CORS issues)
        let displayImageUrl = scraped.image;
        if (scraped.image && scraped.image.startsWith('https://gayeroticvideoindex.com/')) {
          displayImageUrl = `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(scraped.image)}`;
          console.log('📸 Proxied Image URL for display:', displayImageUrl);
        }
        
        // Store scrape results with both URLs and source URL
        setScrapeData({ 
          scraped: {
            ...scraped,
            image: displayImageUrl, // For browser display
            originalImage: originalImageUrl // For sending to Stash
          }, 
          matched, 
          unmatched,
          sourceUrl: sourceUrl, // Store the source URL for saving later
          source: source // Store the scraper source to determine if it's GEVI
        });
        
        // Reset field selections to prefer scraped data by default
        setFieldSelections({
          title: 'scraped',
          studio: 'scraped',
          date: 'scraped',
          details: 'scraped',
          image: 'scraped',
          url: 'scraped'
        });
        
        setShowScrapeModal(false);
        setShowScrapeReviewModal(true);
        
        // Pre-fill edit fields
        setEditedTitle(scraped.title || data.title || '');
        setEditedStudio(scraped.studio || '');
        
        // Build performer list from matched + unmatched (handle both string and object formats)
        const performerNames = [
          ...matched.performers.map(p => p.name),
          ...unmatched.performers.map(p => typeof p === 'string' ? p : p.name)
        ];
        setEditedPerformers(performerNames);
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
    try {
      // Update performer URLs for matched performers if scraped URL is available
      for (const matchedPerformer of scrapeData.matched.performers) {
        if (matchedPerformer.scrapedUrl) {
          try {
            console.log(`📝 Updating URL for performer ${matchedPerformer.name}: ${matchedPerformer.scrapedUrl}`);
            const updateResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/${matchedPerformer.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: matchedPerformer.name,
                disambiguation: matchedPerformer.disambiguation || null,
                newUrls: [matchedPerformer.scrapedUrl]
              })
            });
            
            const updateResult = await updateResponse.json();
            if (updateResult.success) {
              console.log(`✅ Updated URL for ${matchedPerformer.name}`);
            } else {
              console.warn(`⚠️ Failed to update URL for ${matchedPerformer.name}:`, updateResult.error);
            }
          } catch (error) {
            console.error(`❌ Error updating URL for ${matchedPerformer.name}:`, error);
          }
        }
      }
      
      // Collect matched performer IDs
      const performerIds = scrapeData.matched.performers.map(p => p.id);

      // Build action codes array matching performer IDs order
      const actionCodes = performerIds.map(performerId => {
        const matched = scrapeData.matched.performers.find(p => p.id === performerId);
        const scraped = scrapeData.scraped.performers.find(sp => sp.name === matched?.originalName);
        return scraped?.actionCode || null;
      });

      // Determine studio ID if matched
      const studioId = scrapeData.matched.studio ? scrapeData.matched.studio.id : null;

      // Collect matched tag IDs
      const tagIds = scrapeData.matched.tags?.map(t => t.id) || [];

      // Collect matched group IDs and scene numbers
      const groupIds = scrapeData.matched.groups?.map(g => g.id) || [];
      const sceneNumbers = scrapeData.matched.groups?.map(g => g.sceneNumber || null) || [];
      
      console.log('🎬 [Scene Update] Group IDs:', groupIds);
      console.log('🎬 [Scene Update] Scene Numbers:', sceneNumbers);
      console.log('🎬 [Scene Update] Matched Groups:', scrapeData.matched.groups);

      // Build update payload based on field selections
      const updatePayload = {
        performerIds: performerIds,
        actionCodes: actionCodes,
        tagIds: tagIds,
        groupIds: groupIds,
        sceneNumbers: sceneNumbers  // Pass scene numbers for AEBN movies
      };

      // Add fields based on user selection
      if (fieldSelections.title === 'scraped') {
        updatePayload.title = scrapeData.scraped.title;
      } else if (fieldSelections.title === 'existing') {
        updatePayload.title = data.title;
      }

      if (fieldSelections.studio === 'scraped') {
        updatePayload.studio = scrapeData.scraped.studio;
        updatePayload.studioId = studioId;
      } else if (fieldSelections.studio === 'existing') {
        updatePayload.studio = data.studio?.name || null;
        updatePayload.studioId = data.studio?.id || null;
      }

      if (fieldSelections.details === 'scraped' && scrapeData.scraped.details) {
        updatePayload.details = scrapeData.scraped.details;
      } else if (fieldSelections.details === 'existing') {
        updatePayload.details = data.details;
      }

      if (fieldSelections.date === 'scraped' && scrapeData.scraped.date) {
        updatePayload.date = scrapeData.scraped.date;
      } else if (fieldSelections.date === 'existing') {
        updatePayload.date = data.date;
      }

      if (fieldSelections.url === 'scraped' && scrapeData.scraped.url) {
        updatePayload.url = scrapeData.scraped.url;
        // Only update geviUrl if the scraper source is GEVI
        // This prevents non-GEVI scrapers from overwriting the GEVI URL
        if (scrapeData.source && scrapeData.source.toLowerCase().includes('gevi')) {
          updatePayload.geviUrl = scrapeData.sourceUrl;
          console.log('📎 [URL Update] GEVI scraper detected - updating geviUrl:', scrapeData.sourceUrl);
        } else {
          console.log('📎 [URL Update] Non-GEVI scraper detected - preserving existing geviUrl');
        }
        updatePayload.episodeUrls = scrapeData.scraped.episodeUrls || [];
        console.log('📎 [URL Update] Including URLs in payload:');
        console.log('   - Main URL:', updatePayload.url);
        console.log('   - Scraper Source:', scrapeData.source);
        console.log('   - Episode URLs:', updatePayload.episodeUrls);
        console.log('   - Total URLs to add:', 1 + (updatePayload.episodeUrls?.length || 0));
      } else if (fieldSelections.url === 'existing') {
        // Keep existing URLs - don't send url field
        console.log('📎 [URL Update] Keeping existing URLs (not sending url fields)');
      }

      if (fieldSelections.image === 'scraped' && scrapeData.scraped.originalImage) {
        updatePayload.coverImage = scrapeData.scraped.originalImage || scrapeData.scraped.image;
      } else if (fieldSelections.image === 'existing') {
        // Keep existing image - don't send coverImage field
      }

      // Update scene with scraped values (including image, action codes, tags, groups, and GEVI URL)
      // Use originalImage (direct GEVI URL) for Stash, not the proxied URL
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (result.success) {
        setShowScrapeReviewModal(false);
        window.location.reload();
      } else {
        alert(`Failed to update scene: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating scene:', error);
      alert('Failed to update scene');
    }
  };

  const handleCreatePerformerFromParse = async (performerName) => {
    if (!performerName || !performerName.trim()) {
      alert('Performer name cannot be empty');
      return;
    }

    setCreatingPerformers(prev => new Set(prev).add(performerName));

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: performerName.trim(),
          aliases: []
        })
      });

      const result = await response.json();

      if (result.success) {
        const newPerformer = result.data.performer;
        
        // Update parseData to move performer from unmatched to matched
        setParseData(prev => ({
          ...prev,
          matched: {
            ...prev.matched,
            performers: [
              ...prev.matched.performers,
              {
                id: newPerformer.id,
                name: newPerformer.name,
                matchedVia: 'created',
                alternatives: []
              }
            ]
          },
          unmatched: {
            ...prev.unmatched,
            performers: prev.unmatched.performers.filter(p => {
              const pName = typeof p === 'string' ? p : p.name;
              return pName !== performerName;
            })
          }
        }));

        alert(`✅ Performer "${performerName}" created successfully!`);
      } else {
        alert(`Failed to create performer: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating performer:', error);
      alert('Failed to create performer');
    } finally {
      setCreatingPerformers(prev => {
        const newSet = new Set(prev);
        newSet.delete(performerName);
        return newSet;
      });
    }
  };

  const handleCreatePerformer = async (performerName) => {
    if (!performerName || !performerName.trim()) {
      alert('Performer name cannot be empty');
      return;
    }

    setCreatingPerformers(prev => new Set(prev).add(performerName));

    try {
      console.log('👤 Creating performer:', performerName);
      
      // Find the scraped performer to get additional data (action code, URL, etc.)
      const scrapedPerformer = scrapeData.scraped.performers.find(
        sp => sp.name === performerName
      );
      
      // Create the performer with minimal data
      const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: performerName,
          url: scrapedPerformer?.url || null,
          aliases: [],
          gender: null,
          birthdate: null,
          ethnicity: null,
          country: null,
          eyeColor: null,
          hairColor: null,
          height: null,
          measurements: null,
          fakeTits: null,
          penisLength: null,
          circumcised: null,
          tattoos: null,
          piercings: null,
          careerLength: null,
          details: null
        })
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const newPerformer = createResult.data.performer;
        
        // Find the action code for this performer if it exists
        const scrapedPerformer = scrapeData.scraped.performers.find(
          sp => sp.name === performerName
        );
        const actionCode = scrapedPerformer?.actionCode;

        // Update scrapeData to move performer from unmatched to matched
        setScrapeData(prev => ({
          ...prev,
          matched: {
            ...prev.matched,
            performers: [
              ...prev.matched.performers,
              {
                id: newPerformer.id,
                name: newPerformer.name,
                stashId: newPerformer.stashId,
                matchedVia: 'created',
                alternatives: [],
                originalName: performerName,
                actionCode: actionCode
              }
            ]
          },
          unmatched: {
            ...prev.unmatched,
            performers: prev.unmatched.performers.filter(p => {
              const pName = typeof p === 'string' ? p : p.name;
              return pName !== performerName;
            })
          }
        }));

        alert(`✅ Performer "${performerName}" created successfully!`);
      } else {
        alert(`Failed to create performer: ${createResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating performer:', error);
      alert(`Failed to create performer: ${error.message}`);
    } finally {
      setCreatingPerformers(prev => {
        const newSet = new Set(prev);
        newSet.delete(performerName);
        return newSet;
      });
    }
  };

  const handleCreateTag = async (tagName) => {
    if (!tagName || !tagName.trim()) {
      alert('Tag name cannot be empty');
      return;
    }

    setCreatingTags(prev => new Set(prev).add(tagName));

    try {
      console.log('🏷️ Creating tag:', tagName);
      
      // Create the tag with minimal data
      const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/tags/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tagName,
          aliases: []
        })
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const newTag = createResult.data.tag;

        // Update scrapeData to move tag from unmatched to matched
        setScrapeData(prev => ({
          ...prev,
          matched: {
            ...prev.matched,
            tags: [
              ...prev.matched.tags,
              {
                id: newTag.id,
                name: newTag.name,
                originalName: tagName
              }
            ]
          },
          unmatched: {
            ...prev.unmatched,
            tags: prev.unmatched.tags.filter(t => {
              const tName = typeof t === 'string' ? t : t.name;
              return tName !== tagName;
            })
          }
        }));

        alert(`✅ Tag "${tagName}" created successfully!`);
      } else {
        alert(`Failed to create tag: ${createResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      alert(`Failed to create tag: ${error.message}`);
    } finally {
      setCreatingTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagName);
        return newSet;
      });
    }
  };

  const handleCreateNewMovieFromAebn = async (group) => {
    if (!group || !scrapeData?.scraped?.title) {
      alert('Cannot create movie: missing scraped title');
      return;
    }

    setIsCreatingMatched(true);

    try {
      // Get the scene number from the scraped movie data (AEBN provides this)
      const sceneNumber = scrapeData.scraped.movies?.[0]?.sceneNumber || null;
      
      console.log(`🎬 [Create New Movie] Scene number from AEBN: ${sceneNumber}`);
      
      // Create a simple group with just the scraped title and URL, and link scene with proper index
      const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: scrapeData.scraped.title,
          urls: [scrapeData.scraped.url || scrapeData.sourceUrl],
          sceneId: id,  // Link the current scene
          sceneIndex: sceneNumber  // Use the AEBN scene number
        })
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const newGroupId = createResult.data.group.id;
        
        // Replace the original matched group with the new movie (don't keep the original match)
        setScrapeData(prev => ({
          ...prev,
          matched: {
            ...prev.matched,
            groups: [
              {
                id: newGroupId,
                name: scrapeData.scraped.title,
                matchedVia: 'created-from-aebn',
                url: scrapeData.scraped.url || scrapeData.sourceUrl,
                sceneNumber: sceneNumber  // Include scene number for proper indexing
              }
            ]
          }
        }));

        alert(`✅ Movie "${scrapeData.scraped.title}" created and scene linked with index ${sceneNumber || 'auto'}!`);
      } else {
        alert(`Failed to create movie: ${createResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating movie from AEBN:', error);
      alert('Failed to create movie');
    } finally {
      setIsCreatingMatched(false);
    }
  };

  const handleCreateGroup = async (group) => {
    if (!group || !group.name || !group.name.trim()) {
      alert('Group name cannot be empty');
      return;
    }

    // Check if this is an AEBN URL - use simple creation flow instead of fetching full details
    const isAebnUrl = group.url?.toLowerCase().includes('aebn.com');
    
    if (isAebnUrl) {
      console.log('🎬 Detected AEBN URL, using simple creation flow');
      setCreatingGroups(prev => new Set(prev).add(group.name));
      
      try {
        // For AEBN, just create with the name and URL (no need to fetch full details)
        const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/groups/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: group.name,
            urls: [group.url]
          })
        });

        const createResult = await createResponse.json();

        if (createResult.success) {
          const newGroupId = createResult.data.group.id;
          
          // Update scrapeData to move from unmatched to matched
          setScrapeData(prev => ({
            ...prev,
            matched: {
              ...prev.matched,
              groups: [
                ...(prev.matched.groups || []),
                {
                  id: newGroupId,
                  name: group.name,
                  matchedVia: 'created',
                  url: group.url
                }
              ]
            },
            unmatched: {
              ...prev.unmatched,
              groups: prev.unmatched.groups?.filter(g => g.name !== group.name) || []
            }
          }));

          alert(`✅ Movie "${group.name}" created successfully!`);
        } else {
          alert(`Failed to create movie: ${createResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error creating AEBN movie:', error);
        alert('Failed to create movie');
      } finally {
        setCreatingGroups(prev => {
          const newSet = new Set(prev);
          newSet.delete(group.name);
          return newSet;
        });
      }
      return; // Exit early for AEBN
    }

    setCreatingGroups(prev => new Set(prev).add(group.name));

    try {
      // For non-AEBN (GEVI), fetch full movie details
      console.log('🎬 Fetching movie details from:', group.url);
      const movieResponse = await fetch('/api/stash/gevi/movie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: group.url })
      });

      if (!movieResponse.ok) {
        throw new Error('Failed to fetch movie details');
      }

      const movieResult = await movieResponse.json();
      const movie = movieResult.data.movie;
      console.log('✅ Movie details fetched:', movie);

      // Extract studio name if it's an object
      let studioName = null;
      let studioId = null;
      if (movie.studio) {
        if (typeof movie.studio === 'object' && movie.studio.name) {
          studioName = movie.studio.name;
        } else if (typeof movie.studio === 'string') {
          studioName = movie.studio;
        }
      }

      // Try to match studio to existing studio in database
      if (studioName && scrapeData.matched.studio) {
        studioId = scrapeData.matched.studio.id;
      }

      // Duration comes from GEVI scraper in seconds, convert to minutes for display
      let durationMinutes = null;
      if (movie.duration) {
        if (typeof movie.duration === 'number') {
          // Already in seconds from scraper, convert to minutes
          durationMinutes = Math.round(movie.duration / 60);
        } else if (typeof movie.duration === 'string') {
          // Handle string format "120:00" if ever provided
          const match = movie.duration.match(/^(\d+):/);
          if (match) {
            durationMinutes = parseInt(match[1]);
          }
        }
      }

      // Create the group
      const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: movie.name || group.name,
          aliases: null,
          duration: durationMinutes,
          date: movie.date,
          rating: null,
          director: movie.director,
          synopsis: movie.synopsis,
          studioId: studioId,
          front_image: movie.front_image,
          back_image: movie.back_image,
          url: movie.url
        })
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const newGroup = createResult.data.group;

        // Update scrapeData to move group from unmatched to matched
        setScrapeData(prev => ({
          ...prev,
          matched: {
            ...prev.matched,
            groups: [
              ...(prev.matched.groups || []),
              {
                id: newGroup.id,
                name: newGroup.name,
                studio: newGroup.studio?.name || studioName,
                date: newGroup.date,
                matchedVia: 'created',
                alternatives: [],
                originalName: group.name,
                url: group.url
              }
            ]
          },
          unmatched: {
            ...prev.unmatched,
            groups: prev.unmatched.groups.filter(g => g.name !== group.name)
          }
        }));

        alert(`✅ Group "${movie.name || group.name}" created successfully!`);
      } else {
        alert(`Failed to create group: ${createResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert(`Failed to create group: ${error.message}`);
    } finally {
      setCreatingGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(group.name);
        return newSet;
      });
    }
  };

  const handleRemovePerformer = async (performerId, performerName) => {
    if (!window.confirm(`Remove ${performerName} from this scene?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${id}/performers/${performerId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to remove performer: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update local state with the returned scene data
      setData(prevData => ({
        ...prevData,
        performers: result.data.performers
      }));

      alert(`${performerName} removed from scene successfully!`);
    } catch (error) {
      console.error('Error removing performer:', error);
      alert(`Failed to remove performer: ${error.message}`);
    }
  };

  const handleSwapPerformer = (performer) => {
    setPerformerToSwap(performer);
    setShowSwapModal(true);
  };

  const handleSwapComplete = (result) => {
    console.log('✅ Swap complete:', result);
    
    // Update local state with the updated scene data
    if (result.scene) {
      setData(prevData => ({
        ...prevData,
        performers: result.scene.performers
      }));
    }

    // Show success message
    alert(`Performer swapped successfully!\n${result.swap.oldPerformer.name} → ${result.swap.newPerformer.name}\n\nTransferred ${result.swap.transferredTags.length} tags`);
  };

  // Handle toggling performer selection
  const handleTogglePerformerSelection = (performerId) => {
    console.log('🔄 Toggling performer selection:', performerId);
    setSelectedPerformers(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(performerId)) {
        console.log('  ❌ Removing from selection');
        newSelection.delete(performerId);
      } else {
        console.log('  ✅ Adding to selection');
        newSelection.add(performerId);
      }
      console.log('  📊 New selection size:', newSelection.size);
      return newSelection;
    });
  };

  // Handle merge success
  const handleMergeSuccess = (result) => {
    console.log('✅ Merge successful:', result);
    // Reset selection state
    setSelectedPerformers(new Set());
    setPerformerSelectionMode(false);
    setShowMergeModal(false);
    // Reload scene data
    window.location.reload();
  };

  const handleSaveGeviUrl = async () => {
    if (!geviUrlInput.trim()) {
      alert('Please enter a GEVI URL');
      return;
    }

    // Basic validation for GEVI URL format
    if (!geviUrlInput.includes('gayeroticvideoindex.com')) {
      if (!confirm('This doesn\'t look like a GEVI URL. Save anyway?')) {
        return;
      }
    }

    setIsSavingGeviUrl(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          geviUrl: geviUrlInput
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setData(prevData => ({
          ...prevData,
          geviUrl: geviUrlInput
        }));
        setShowGeviUrlModal(false);
        alert('GEVI URL saved successfully!');
      } else {
        alert(`Failed to save GEVI URL: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving GEVI URL:', error);
      alert('Failed to save GEVI URL');
    } finally {
      setIsSavingGeviUrl(false);
    }
  };

  const handleAcceptParse = async () => {
    try {
      // Collect matched performer IDs
      const performerIds = parseData.matched.performers
        .filter(p => {
          // Only include performers that are still in editedPerformers list
          const normalizedPName = p.name.toLowerCase().replace(/\s+/g, '');
          return editedPerformers.some(ep => 
            ep.toLowerCase().replace(/\s+/g, '') === normalizedPName ||
            (p.matchedAlias && ep.toLowerCase().replace(/\s+/g, '') === p.matchedAlias.toLowerCase().replace(/\s+/g, ''))
          );
        })
        .map(p => p.id);

      // Determine studio ID if matched
      const studioId = parseData.matched.studio ? parseData.matched.studio.id : null;

      // Build update payload - only include studio if one was parsed
      const updatePayload = {
        title: editedTitle,
        performerIds: performerIds
      };

      // Only update studio if one was actually parsed from the filename
      if (parseData.parsed.studio) {
        updatePayload.studio = editedStudio;
        updatePayload.studioId = studioId;
      }

      // Update scene with edited values
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();
      if (result.success) {
        setShowParseModal(false);
        window.location.reload();
      } else {
        alert(`Failed to update scene: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating scene:', error);
      alert('Failed to update scene');
    }
  };

  const closePerformerChoice = () => {
    setShowPerformerChoice(false);
    setClickedPerformer(null);
  };

  const closePerformerOverlay = () => {
    setSelectedPerformer(null);
  };

  const handleDeleteScene = async () => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Scene deleted successfully from both database and Stash!');
        navigate('/media/stash/scenes');
      } else {
        alert(`Failed to delete scene: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
      alert('Failed to delete scene');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSyncFromStash = async () => {
    if (!window.confirm('Sync this scene from Stash? This will update the local database with current Stash data.')) {
      return;
    }

    setIsSyncing(true);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/sync`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Scene synced successfully from Stash!');
        // Reload the page to show updated data
        window.location.reload();
      } else {
        alert(`Failed to sync scene: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing scene:', error);
      alert('Failed to sync scene from Stash');
    } finally {
      setIsSyncing(false);
    }
  };

  // Open URL editor modal
  const handleOpenUrlEditor = () => {
    try {
      const urls = data.episodeUrls ? 
        (typeof data.episodeUrls === 'string' ? JSON.parse(data.episodeUrls) : data.episodeUrls) : [];
      setEditingUrls(Array.isArray(urls) ? [...urls] : []);
    } catch (e) {
      console.error('Error parsing episodeUrls:', e);
      setEditingUrls([]);
    }
    setShowUrlEditorModal(true);
  };

  // Add new URL to the list
  const handleAddUrl = () => {
    setEditingUrls([...editingUrls, '']);
  };

  // Update URL at specific index
  const handleUpdateUrl = (index, value) => {
    const newUrls = [...editingUrls];
    newUrls[index] = value;
    setEditingUrls(newUrls);
  };

  // Remove URL at specific index
  const handleRemoveUrl = (index) => {
    const newUrls = editingUrls.filter((_, i) => i !== index);
    setEditingUrls(newUrls);
  };

  // Save URLs to database and Stash
  const handleSaveUrls = async () => {
    setIsSavingUrls(true);
    
    try {
      // Filter out empty URLs
      const validUrls = editingUrls.filter(url => url.trim() !== '');
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          episodeUrls: validUrls
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setData(prevData => ({
          ...prevData,
          episodeUrls: validUrls
        }));
        setShowUrlEditorModal(false);
        alert('✅ URLs saved successfully!');
      } else {
        alert(`Failed to save URLs: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving URLs:', error);
      alert('Failed to save URLs');
    } finally {
      setIsSavingUrls(false);
    }
  };

  const handleOpenStudioEditor = async () => {
    setShowStudioEditorModal(true);
    setSelectedStudioId(data?.studio?.id || null);
    setStudioSearchQuery('');
    
    // Fetch available studios (get all without pagination limit)
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios?perPage=1000`);
      const result = await response.json();
      if (result.success) {
        setAvailableStudios(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching studios:', error);
    }
  };

  const handleUpdateStudio = async () => {
    if (!selectedStudioId) {
      alert('Please select a studio');
      return;
    }

    setIsUpdatingStudio(true);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/studio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studioId: selectedStudioId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh scene data
        const sceneResponse = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`);
        const sceneData = await sceneResponse.json();
        setData(sceneData);
        setShowStudioEditorModal(false);
        alert('✅ Studio updated successfully!');
      } else {
        alert(`Failed to update studio: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating studio:', error);
      alert('Failed to update studio');
    } finally {
      setIsUpdatingStudio(false);
    }
  };

  const handleRemoveStudio = async () => {
    if (!confirm('Remove studio from this scene?')) {
      return;
    }

    setIsUpdatingStudio(true);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/studio`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studioId: null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh scene data
        const sceneResponse = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`);
        const sceneData = await sceneResponse.json();
        setData(sceneData);
        setShowStudioEditorModal(false);
        alert('✅ Studio removed successfully!');
      } else {
        alert(`Failed to remove studio: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing studio:', error);
      alert('Failed to remove studio');
    } finally {
      setIsUpdatingStudio(false);
    }
  };

  if (loading) {
    return (
      <div className="page pad scene-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading scene details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="page pad scene-detail">
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <Link to="/media/stash/scenes" className="btn">← Back to Scenes</Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="page pad scene-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link>
        <span> → </span>
        <Link to="/media/stash/scenes">Scenes</Link>
        <span> → </span>
        <span>{getSceneDisplayTitle(data)}</span>
      </div>

      {/* Hero Section with Image */}
      <div className="scene-detail-hero">
        <div className="scene-hero-image">
          <img
            src={getSceneImageUrl(data)}
            alt={getSceneDisplayTitle(data)}
            onError={(e) => {
              e.target.src = '/placeholder-scene.jpg';
            }}
          />
          {data.duration && (
            <div className="duration-badge-large">
              ⏱️ {formatDuration(data.duration)}
            </div>
          )}
          {data.o_counter > 0 && (
            <div className="play-count-badge-large">
              ▶️ {data.o_counter} plays
            </div>
          )}
        </div>
        
        <div className="scene-hero-info">
          <h1 className="scene-title">🎬 {getSceneDisplayTitle(data)}</h1>
          
          {data.path && (
            <>
              <button 
                onClick={handleParseFilename}
                className="parse-filename-button"
                title="Parse filename to extract studio, performers, and title"
              >
                🔍 Parse Filename
              </button>

              <button 
                onClick={() => {
                  setShowScrapeModal(true);
                  setSelectedScraper(null); // GEVI scraper
                  // Auto-populate with previously saved GEVI URL if available
                  setScrapeUrl(data?.geviUrl || '');
                }}
                className="scrape-gevi-button"
                title="Scrape metadata from GEVI"
              >
                🌐 Scrape GEVI
              </button>
            </>
          )}

          {/* Dynamic scraper buttons based on available scrapers */}
          {availableScrapers.map((scraper, index) => {
            // Check if this is a stash-box scraper
            const isStashBox = scraper.isStashBox || scraper.type === 'stash-box';
            
            // Extract domain from URL for display (only for YAML scrapers)
            let urlDisplay = '';
            if (!isStashBox && scraper.url) {
              try {
                const urlObj = new URL(scraper.url);
                urlDisplay = urlObj.hostname.replace('www.', '');
              } catch (e) {
                urlDisplay = scraper.url;
              }
            }
            
            // Determine button style and icon based on scraper type
            const isStashNative = scraper.isStashNative || scraper.type === 'StashNativeScraperService';
            
            let buttonStyle, icon, typeLabel;
            
            if (isStashBox) {
              // Stash-box scrapers - blue/cyan color
              buttonStyle = { background: '#06b6d4', borderLeft: '4px solid #22d3ee' };
              icon = '📦';
              typeLabel = ' (Stash-Box)';
            } else if (isStashNative) {
              // Stash native scrapers - purple
              buttonStyle = { background: '#8b5cf6', borderLeft: '4px solid #a78bfa' };
              icon = '⚡';
              typeLabel = ' (Stash)';
            } else {
              // Custom scrapers - green
              buttonStyle = { background: '#10b981' };
              icon = '🌐';
              typeLabel = '';
            }
            
            return (
              <button
                key={`${scraper.name}-${index}`}
                onClick={() => {
                  if (isStashBox) {
                    // Check if stash-box is configured
                    if (scraper.configured === false) {
                      alert('Stash-Box is not configured in your Stash instance.\n\nTo use Stash-Box scrapers:\n1. Open Stash Settings\n2. Go to Metadata Providers → Stash-Box\n3. Add a Stash-Box endpoint (e.g., https://stashdb.org/graphql)\n4. Save and return here to use the scraper');
                      return;
                    }
                    // For stash-box, show search options modal with auto-populated data
                    setSelectedStashBoxScraper(scraper);
                    setStashBoxSearchType('fragment'); // Default to fragment scraping
                    // Don't pre-populate - let it populate when user selects search type
                    setStashBoxSearchQuery('');
                    setShowStashBoxSearchModal(true);
                  } else {
                    setShowScrapeModal(true);
                    setSelectedScraper(scraper);
                    setScrapeUrl(scraper.url || '');
                  }
                }}
                className="scrape-gevi-button"
                title={
                  isStashBox 
                    ? `Fragment scrape from ${scraper.name}` 
                    : `Scrape metadata from ${scraper.url}${isStashNative ? ' using Stash native scraper' : ''}`
                }
                style={buttonStyle}
              >
                {icon} Scrape {scraper.siteName}{typeLabel}
                {!isStashBox && availableScrapers.filter(s => s.siteName === scraper.siteName).length > 1 && (
                  <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: '4px' }}>
                    ({urlDisplay})
                  </span>
                )}
              </button>
            );
          })}

          <button 
            onClick={() => {
              setGeviUrlInput(data?.geviUrl || '');
              setShowGeviUrlModal(true);
            }}
            className="set-gevi-url-button"
            title={data?.geviUrl ? "Update GEVI URL" : "Set GEVI URL"}
          >
            {data?.geviUrl ? '🔗 Update GEVI URL' : '🔗 Set GEVI URL'}
          </button>

          {stashUrl ? (
            <a
              href={`${stashUrl}/scenes/${data.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="view-in-stash-button"
              title="View scene in Stash"
            >
              🎭 View in Stash
            </a>
          ) : (
            <button
              onClick={() => alert('Stash URL not configured. Please configure it in Settings.')}
              className="view-in-stash-button"
              title="Stash URL not configured"
            >
              🎭 View in Stash
            </button>
          )}

          <button
            onClick={handleSyncFromStash}
            className="sync-stash-button"
            title="Sync this scene from Stash"
            disabled={isSyncing}
            style={{
              background: isSyncing ? '#9ca3af' : '#10b981',
              cursor: isSyncing ? 'not-allowed' : 'pointer'
            }}
          >
            {isSyncing ? '⏳ Syncing...' : '🔄 Sync from Stash'}
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="delete-scene-button"
            title="Delete scene from database and Stash"
          >
            🗑️ Delete Scene
          </button>
          
          <div className="scene-meta-badges">
            {data.date && (
              <div className="meta-badge">
                <span className="badge-icon">📅</span>
                <span>{formatDate(data.date)}</span>
              </div>
            )}
            {data.studio && (
              <div className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge-icon">🏢</span>
                <span>{typeof data.studio === 'string' ? data.studio : data.studio?.name}</span>
                <button
                  onClick={handleOpenStudioEditor}
                  style={{
                    padding: '2px 6px',
                    fontSize: '12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                  title="Edit studio"
                >
                  ✏️
                </button>
              </div>
            )}
            {!data.studio && (
              <div className="meta-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge-icon">🏢</span>
                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No studio</span>
                <button
                  onClick={handleOpenStudioEditor}
                  style={{
                    padding: '2px 6px',
                    fontSize: '12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    marginLeft: 'auto'
                  }}
                  title="Add studio"
                >
                  ➕
                </button>
              </div>
            )}
            {data.geviUrl && (
              <div className="meta-badge">
                <span className="badge-icon">🌐</span>
                <a 
                  href={data.geviUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  title="View on GEVI"
                >
                  GEVI
                </a>
              </div>
            )}
            {data.rating && (
              <div className="meta-badge rating">
                <span className="badge-icon">⭐</span>
                <span>{data.rating}/100</span>
              </div>
            )}
            {data.code && (
              <div className="meta-badge">
                <span className="badge-icon">🔖</span>
                <span>{data.code}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="scene-detail-content">
        {/* Details Section */}
        {data.details && (
          <div className="card scene-details-card">
            <h3>📝 Details</h3>
            <p className="scene-description">{data.details}</p>
          </div>
        )}

        {/* Episode URLs Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>
              🔗 Episode URLs {data.episodeUrls && (() => {
                try {
                  const urls = typeof data.episodeUrls === 'string' ? JSON.parse(data.episodeUrls) : data.episodeUrls;
                  return Array.isArray(urls) ? `(${urls.length})` : '(0)';
                } catch (e) {
                  return '(0)';
                }
              })()}
            </h3>
            <button
              onClick={handleOpenUrlEditor}
              style={{
                padding: '6px 12px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              ✏️ Edit URLs
            </button>
          </div>
          
          {data.episodeUrls && (() => {
            try {
              const urls = typeof data.episodeUrls === 'string' ? JSON.parse(data.episodeUrls) : data.episodeUrls;
              if (Array.isArray(urls) && urls.length > 0) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {urls.map((urlItem, index) => {
                      // Handle both string format and {url, label} object format
                      const urlString = typeof urlItem === 'string' ? urlItem : urlItem?.url;
                      const label = typeof urlItem === 'object' && urlItem?.label ? urlItem.label : null;
                      
                      return (
                        <div key={index} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          padding: '8px',
                          background: '#f9fafb',
                          borderRadius: '4px'
                        }}>
                          <span style={{ 
                            fontSize: '13px', 
                            color: '#6b7280',
                            fontFamily: 'monospace',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {label ? `${label}: ${urlString}` : urlString}
                          </span>
                          <a
                            href={urlString}
                            target="_blank"
                            rel="noopener noreferrer"
                          style={{
                            padding: '4px 12px',
                            background: '#6366f1',
                            color: 'white',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Open
                        </a>
                      </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <p style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                    No URLs added yet. Click "Edit URLs" to add some.
                  </p>
                );
              }
            } catch (e) {
              console.error('Error parsing episodeUrls:', e);
              return (
                <p style={{ color: '#ef4444', fontSize: '14px' }}>
                  Error loading URLs
                </p>
              );
            }
          })()}
        </div>

        {/* Performers Section */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>👥 Performers ({data.performers?.length || 0})</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowAddPerformerModal(true)}
                style={{
                  padding: '6px 12px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ➕ Add Performer
              </button>
              {data.performers?.length > 0 && (
                <>
                  {selectedPerformers.size > 1 && (
                    <button
                      onClick={() => setShowMergeModal(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      🔀 Merge {selectedPerformers.size} Performers
                    </button>
                  )}
                  <button
                    onClick={() => {
                      console.log('🔘 Selection mode toggled. Current:', performerSelectionMode, '→ New:', !performerSelectionMode);
                      setPerformerSelectionMode(!performerSelectionMode);
                      if (performerSelectionMode) {
                        setSelectedPerformers(new Set());
                        console.log('  🗑️ Cleared selections');
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      background: performerSelectionMode ? '#ef4444' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {performerSelectionMode ? '✕ Cancel' : '☑ Select'}
                  </button>
                </>
              )}
            </div>
          </div>
          
          {data.performers && data.performers.length > 0 ? (
            <div className="performers-grid">
              {data.performers.map(performer => {
                const performerData = performer.performer || performer;
                const isHovering = hoveringPerformer === performerData.id;
                const isSelected = selectedPerformers.has(performerData.id);
                return (
                  <div
                    key={performerData.id}
                    className="performer-thumbnail-card"
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setHoveringPerformer(performerData.id)}
                    onMouseLeave={() => setHoveringPerformer(null)}
                  >
                    {performerSelectionMode && (
                      <PerformerCheckboxOverlay
                        performerId={performerData.id}
                        isSelected={isSelected}
                        onToggle={handleTogglePerformerSelection}
                      />
                    )}
                    <button
                      className="performer-swap-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwapPerformer(performerData);
                      }}
                      title={`Swap ${performerData.name}`}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '32px',
                        background: 'rgba(59, 130, 246, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        width: '24px',
                        height: '24px',
                        display: isHovering ? 'flex' : 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(37, 99, 235, 1)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.9)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      🔄
                    </button>
                    <button
                      className="performer-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePerformer(performerData.id, performerData.name);
                      }}
                      title={`Remove ${performerData.name} from scene`}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        width: '24px',
                        height: '24px',
                        display: isHovering ? 'flex' : 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        zIndex: 10,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 1)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      ×
                    </button>
                    <div
                      className="clickable"
                      onClick={(e) => {
                        if (!performerSelectionMode) {
                          handlePerformerClick(e, performer);
                        }
                      }}
                      style={{ 
                        cursor: performerSelectionMode ? 'default' : 'pointer', 
                        width: '100%', 
                        height: '100%',
                        pointerEvents: performerSelectionMode ? 'none' : 'auto'
                      }}
                    >
                      {performerData.image ? (
                        <div className="performer-thumbnail-image">
                          <img src={performerData.image} alt={performerData.name} />
                        </div>
                      ) : (
                        <div className="performer-thumbnail-placeholder">
                          👤
                        </div>
                      )}
                      <div className="performer-thumbnail-name">
                        <div className="title">{performerData.name}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#666',
              background: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
              <div style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '500' }}>
                No performers in this scene
              </div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                Click "Add Performer" above to add performers to this scene
              </div>
            </div>
          )}
        </div>

        {/* Groups Section */}
        {data.groups && data.groups.length > 0 && (
          <div className="card">
            <h3>🎬 Groups / Movies ({data.groups.length})</h3>
            <p className="text-sm text-gray-600 mb-3">
              This scene appears in the following groups/movies
            </p>
            <div className="groups-list">
              {data.groups
                .sort((a, b) => a.sceneIndex - b.sceneIndex)
                .map((groupWrapper) => {
                  const group = groupWrapper.group;
                  return (
                    <Link
                      key={group.id}
                      to={`/media/stash/groups/${group.id}`}
                      className="group-item"
                    >
                      <div className="group-item-content">
                        {group.front_image && (
                          <div className="group-thumbnail">
                            <img src={group.front_image} alt={group.name} />
                          </div>
                        )}
                        <div className="group-info">
                          <div className="group-title">
                            <span className="scene-number">#{groupWrapper.sceneIndex || '?'}</span>
                            <span className="group-name">{group.name}</span>
                          </div>
                          <div className="group-meta">
                            {group.studio && (
                              <span className="group-studio">🏢 {group.studio.name}</span>
                            )}
                            {group.date && (
                              <span className="group-date">📅 {group.date}</span>
                            )}
                            {group.director && (
                              <span className="group-director">🎬 {group.director}</span>
                            )}
                            {group.duration && (
                              <span className="group-duration">⏱️ {formatDuration(group.duration)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

        {/* Tags Section - Merged scene + performer tags */}
        {mergedTags.length > 0 && (
          <div className="card">
            <h3>🏷️ Tags ({mergedTags.length})</h3>
            <p className="text-sm text-gray-600 mb-3">
              Scene tags and tags from performers in this scene
            </p>
            <div className="tags-grid-detailed">
              {mergedTags.map(tag => (
                <div key={tag.id} className="tag-detail-item">
                  <Link
                    to={`/media/stash/tags/${tag.id}`}
                    className="tag-name-link"
                  >
                    {tag.name}
                  </Link>
                  <div className="tag-meta">
                    {tag.isSceneTag && tag.performers.length === 0 && (
                      <span className="tag-badge scene-only">Scene</span>
                    )}
                    {!tag.isSceneTag && tag.performers.length > 0 && (
                      <span className="tag-badge performer-only">
                        From {tag.performers.length} performer{tag.performers.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {tag.isSceneTag && tag.performers.length > 0 && (
                      <span className="tag-badge scene-and-performer">
                        Scene + {tag.performers.length} performer{tag.performers.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {tag.performers.length > 0 && (
                    <div className="tag-performers-list">
                      {tag.performers.map(performer => (
                        <Link
                          key={performer.id}
                          to={`/media/stash/performers/${performer.id}`}
                          className="tag-performer-link"
                        >
                          {performer.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="card">
          <h3>ℹ️ Additional Information</h3>
          <div className="info-grid-2col">
            {data.director && (
              <div className="info-row">
                <span className="info-label">Director:</span>
                <span className="info-value">{data.director}</span>
              </div>
            )}
            {data.organized !== undefined && (
              <div className="info-row">
                <span className="info-label">Organized:</span>
                <span className="info-value">{data.organized ? '✅ Yes' : '❌ No'}</span>
              </div>
            )}
            {data.playCount !== undefined && data.playCount > 0 && (
              <div className="info-row">
                <span className="info-label">Total Plays:</span>
                <span className="info-value">{data.playCount}</span>
              </div>
            )}
            {data.lastPlayedAt && (
              <div className="info-row">
                <span className="info-label">Last Played:</span>
                <span className="info-value">{new Date(data.lastPlayedAt).toLocaleString()}</span>
              </div>
            )}
            {data.resumeTime && data.resumeTime > 0 && (
              <div className="info-row">
                <span className="info-label">Resume Time:</span>
                <span className="info-value">{formatDuration(data.resumeTime)}</span>
              </div>
            )}
            {data.path && (
              <div className="info-row full-width">
                <span className="info-label">File Path:</span>
                <span className="info-value file-path">{data.path}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performer Choice Modal */}
      {showPerformerChoice && clickedPerformer && (
        <div className="modal-overlay" onClick={closePerformerChoice}>
          <div className="modal-content performer-choice-modal" onClick={(e) => e.stopPropagation()}>
            <h3>View Performer: {clickedPerformer.name}</h3>
            <div className="performer-choice-buttons">
              <button
                className="choice-button primary"
                onClick={handleViewPerformerDetails}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Go to Performer Page
              </button>
              <button
                className="choice-button secondary"
                onClick={handleShowPerformerOverlay}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tag Performer in Scene
              </button>
            </div>
            <button className="modal-close" onClick={closePerformerChoice}>Cancel</button>
          </div>
        </div>
      )}

      {/* Performer Overlay - Reusing existing StashPerformerOverlay component */}
      {selectedPerformer && (
        <StashPerformerOverlay
          performerId={selectedPerformer.id}
          sceneDate={data.date}
          sceneId={id}
          onClose={closePerformerOverlay}
        />
      )}

      {/* Parse Filename Modal */}
      {showParseModal && parseData && (
        <div className="modal-overlay" onClick={() => setShowParseModal(false)}>
          <div className="modal-content parse-filename-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📋 Review Parsed Filename</h3>
            
            {/* Parse Options Toggles */}
            <div className="parse-options">
              <label className="parse-option-toggle">
                <input
                  type="checkbox"
                  checked={parseStudio}
                  onChange={(e) => setParseStudio(e.target.checked)}
                />
                <span>Parse Studio</span>
              </label>
              <label className="parse-option-toggle">
                <input
                  type="checkbox"
                  checked={parseTitle}
                  onChange={(e) => setParseTitle(e.target.checked)}
                />
                <span>Parse Title</span>
              </label>
              <label className="parse-option-toggle">
                <input
                  type="checkbox"
                  checked={parsePerformers}
                  onChange={(e) => setParsePerformers(e.target.checked)}
                />
                <span>Parse Performers</span>
              </label>
            </div>
            
            <div className="parse-results">
              {/* Filename Input with Refresh Button */}
              <div className="parse-field">
                <label>Filename to Parse:</label>
                <div className="filename-input-wrapper">
                  <input
                    type="text"
                    value={editedFilename}
                    onChange={(e) => setEditedFilename(e.target.value)}
                    className="parse-input filename-input"
                    placeholder="Edit filename and refresh to re-parse"
                    disabled={isParsing}
                  />
                  <button
                    className="btn-refresh"
                    onClick={handleRefreshParse}
                    disabled={isParsing}
                    title="Re-parse with edited filename"
                  >
                    {isParsing ? '⏳' : '🔄'} Refresh
                  </button>
                </div>
              </div>

              {/* Title Field */}
              <div className="parse-field">
                <label>Title:</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="parse-input"
                  placeholder="Scene title"
                />
              </div>

              {/* Studio Field */}
              <div className="parse-field">
                <label>Studio:</label>
                <div className="parse-field-with-status">
                  <input
                    type="text"
                    value={editedStudio}
                    onChange={(e) => setEditedStudio(e.target.value)}
                    className="parse-input"
                    placeholder="Studio name"
                  />
                  {parseData.matched.studio ? (
                    <span className="match-status matched">✓ Matched: {parseData.matched.studio.name}</span>
                  ) : parseData.unmatched.studio ? (
                    <span className="match-status unmatched">✗ Not found in database</span>
                  ) : null}
                </div>
              </div>

              {/* Performers Field */}
              <div className="parse-field">
                <label>Performers:</label>
                <div className="performers-list">
                  {editedPerformers.map((performer, index) => {
                    // Check if matched by name
                    let matched = parseData.matched.performers.find(
                      p => p.name.toLowerCase().replace(/\s+/g, '') === performer.toLowerCase().replace(/\s+/g, '')
                    );
                    
                    // Check if matched by alias
                    if (!matched) {
                      matched = parseData.matched.performers.find(
                        p => p.matchedAlias && p.matchedAlias.toLowerCase().replace(/\s+/g, '') === performer.toLowerCase().replace(/\s+/g, '')
                      );
                    }
                    
                    const isUnmatched = parseData.unmatched.performers.some(p => {
                      const pName = typeof p === 'string' ? p : p.name;
                      return pName === performer;
                    });
                    
                    const hasAlternatives = matched && matched.alternatives && matched.alternatives.length > 0;
                    
                    return (
                      <div key={index} className="performer-item">
                        <div className="performer-input-wrapper">
                          <input
                            type="text"
                            value={performer}
                            onChange={(e) => {
                              const newPerformers = [...editedPerformers];
                              newPerformers[index] = e.target.value;
                              setEditedPerformers(newPerformers);
                            }}
                            className="parse-input performer-input"
                          />
                          {hasAlternatives && (
                            <select
                              className="performer-alternatives-dropdown"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const newPerformers = [...editedPerformers];
                                  newPerformers[index] = e.target.value;
                                  setEditedPerformers(newPerformers);
                                }
                              }}
                              value=""
                            >
                              <option value="">Switch to alternative...</option>
                              {matched.alternatives.map((alt, altIndex) => (
                                <option key={altIndex} value={alt.name}>
                                  {alt.name}
                                  {alt.disambiguation ? ` (${alt.disambiguation})` : ''}
                                  {alt.matchedVia === 'alias' && alt.matchedAlias ? ` (via: ${alt.matchedAlias})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="performer-status-actions">
                          {matched && (
                            <span className="match-status matched">
                              ✓ {matched.name}
                              {matched.disambiguation && (
                                <span style={{ color: '#6b7280', marginLeft: '0.25rem', fontSize: '0.875rem' }}>
                                  ({matched.disambiguation})
                                </span>
                              )}
                              {matched.matchedVia === 'alias' && matched.matchedAlias && (
                                <span className="alias-info"> (via alias: {matched.matchedAlias})</span>
                              )}
                              {hasAlternatives && (
                                <span className="alternatives-count"> (+{matched.alternatives.length} more)</span>
                              )}
                            </span>
                          )}
                          {isUnmatched && (
                            <span className="match-status unmatched">✗ Not found</span>
                          )}
                          <button
                            className="btn-create-performer"
                            onClick={() => handleCreatePerformerFromParse(performer)}
                            disabled={creatingPerformers.has(performer)}
                            title="Create new performer in Stash with this name"
                          >
                            {creatingPerformers.has(performer) ? '⏳ Creating...' : '✨ Create New'}
                          </button>
                        </div>
                        <button
                          className="remove-performer-btn"
                          onClick={() => setEditedPerformers(editedPerformers.filter((_, i) => i !== index))}
                          title="Remove performer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="add-performer-btn"
                    onClick={() => setEditedPerformers([...editedPerformers, ''])}
                  >
                    + Add Performer
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-accept" onClick={handleAcceptParse}>
                ✓ Accept & Update
              </button>
              <button className="btn-cancel" onClick={() => setShowParseModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrape URL Input Modal (Generic for all scrapers) */}
      {showScrapeModal && (
        <div className="modal-overlay" onClick={() => setShowScrapeModal(false)}>
          <div className="modal-content scrape-url-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🌐 Scrape {selectedScraper ? selectedScraper.siteName : 'GEVI'} Metadata</h3>
            
            <div className="scrape-url-input">
              <label>{selectedScraper ? selectedScraper.siteName : 'GEVI'} Episode URL:</label>
              <input
                type="text"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                className="url-input"
                placeholder="https://gayeroticvideoindex.com/episode/12345"
                disabled={isScraping || isSearching}
              />
              
              {/* AEBN Scene Number Input - only show for AEBN scraper */}
              {selectedScraper?.siteName === 'AEBN' && (
                <div style={{ marginTop: '10px' }}>
                  <label>Scene Number (optional):</label>
                  <input
                    type="number"
                    value={aebnSceneNumber}
                    onChange={(e) => setAebnSceneNumber(e.target.value)}
                    className="url-input"
                    placeholder="e.g., 1, 2, 3..."
                    min="1"
                    disabled={isScraping || isSearching}
                    style={{ width: '150px' }}
                  />
                  <p className="help-text" style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    If you know the scene number, enter it here to scrape that specific scene directly without performer matching
                  </p>
                </div>
              )}
              
              <p className="help-text">
                Enter the GEVI episode URL to extract metadata, or use Search to find the scene by performers
              </p>
            </div>

            {/* Search Results */}
            {searchResults && (
              <div className="search-results" style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '8px',
                maxHeight: '600px',
                overflowY: 'auto',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ 
                  position: 'sticky', 
                  top: 0, 
                  backgroundColor: '#f5f5f5', 
                  paddingBottom: '10px',
                  marginBottom: '10px',
                  borderBottom: '2px solid #e5e7eb',
                  zIndex: 1
                }}>
                  <h4 style={{ marginBottom: '5px', fontSize: '16px', color: '#1f2937', fontWeight: '600' }}>
                    Found {searchResults.scenes.length} {searchResults.isSceneSearch ? 
                      (searchResults.scenes.length === 1 ? 'scene' : 'scenes') : 
                      (searchResults.scenes.length === 1 ? 'movie' : 'movies')}
                    {searchResults.allPerformers ? ` (searched for: ${searchResults.allPerformers.join(', ')})` : 
                     searchResults.searchedPerformers ? 
                       ` (searched for: ${searchResults.searchedPerformers.join(', ')})` :
                     searchResults.searchedTitle ?
                       ` (searched for title: "${searchResults.searchedTitle}")` :
                     searchResults.firstPerformer ?
                       ` with ${searchResults.firstPerformer.name} and ${searchResults.secondPerformer}` :
                       ''}
                  </h4>
                  {searchResults.scenes.length > 3 && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '5px 0 0 0' }}>
                      💡 Scroll down to see all {searchResults.scenes.length} results
                    </p>
                  )}
                </div>
                {searchResults.scenes.map((scene, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: 'flex',
                      gap: '12px',
                      padding: '10px', 
                      marginBottom: '8px', 
                      backgroundColor: 'white', 
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      transition: 'all 0.2s',
                      alignItems: 'center'
                    }}
                  >
                    {scene.image && (
                      <img 
                        src={scene.image} 
                        alt={scene.title}
                        style={{
                          width: '120px',
                          height: '68px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          flexShrink: 0
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <div 
                      style={{ 
                        flex: 1, 
                        cursor: 'pointer' 
                      }}
                      onClick={() => {
                        // Handle stash-box results
                        if (searchResults.isStashBox) {
                          handleSelectStashBoxResult(scene);
                          return;
                        }
                        
                        // Only pass movieData if this is a movie search (not scene search)
                        if (searchResults.isSceneSearch || searchResults.isSceneSearchByTitle || searchResults.isSmartScrape) {
                          // Scene search - just populate URL for scraping
                          handleSelectSearchResult(scene.url);
                        } else if (scene.matchedPerformers) {
                          // Movie search - handle movie creation/linking
                          handleSelectSearchResult(scene.url, scene);
                        } else {
                          // Fallback - just populate URL
                          handleSelectSearchResult(scene.url);
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#8b5cf6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'inherit';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '500', color: '#333' }}>{scene.title}</span>
                        {/* Only show movie badges for movie search results */}
                        {!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && !searchResults.isSmartScrape && scene.existingMovieId && (
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 6px', 
                            backgroundColor: '#10b981', 
                            color: 'white', 
                            borderRadius: '3px',
                            fontWeight: '600'
                          }}>
                            ✓ IN DATABASE
                          </span>
                        )}
                        {!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && !searchResults.isSmartScrape && scene.matchedPerformers && !scene.existingMovieId && (
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 6px', 
                            backgroundColor: '#f59e0b', 
                            color: 'white', 
                            borderRadius: '3px',
                            fontWeight: '600'
                          }}>
                            ✦ NEW MOVIE
                          </span>
                        )}
                      </div>
                      {/* Show matched performers for both scene and movie searches */}
                      {scene.matchedPerformers && scene.matchedPerformers.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '2px', fontWeight: '600' }}>
                          ✓ {scene.matchedPerformers.length} {scene.matchedPerformers.length === 1 ? 'match' : 'matches'}: {scene.matchedPerformers.join(', ')}
                        </div>
                      )}
                      {/* Only show movie action hints for movie searches */}
                      {!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && !searchResults.isSmartScrape && scene.existingMovieId && (
                        <div style={{ fontSize: '12px', color: '#059669', marginBottom: '4px', fontStyle: 'italic' }}>
                          → Will link scene to existing movie
                        </div>
                      )}
                      {!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && !searchResults.isSmartScrape && scene.matchedPerformers && !scene.existingMovieId && (
                        <div style={{ fontSize: '12px', color: '#d97706', marginBottom: '4px', fontStyle: 'italic' }}>
                          → Will create new movie and link scene
                        </div>
                      )}
                      {/* Show scene info hint for scene searches */}
                      {(searchResults.isSceneSearch || searchResults.isSceneSearchByTitle || searchResults.isSmartScrape) && (
                        <div style={{ fontSize: '12px', color: '#6366f1', marginBottom: '4px', fontStyle: 'italic' }}>
                          → Click to populate URL and scrape scene metadata
                        </div>
                      )}
                      {scene.studio && (
                        <div style={{ fontSize: '12px', color: '#8b5cf6', marginBottom: '2px' }}>
                          🎬 {typeof scene.studio === 'string' ? scene.studio : scene.studio.name}
                        </div>
                      )}
                      {scene.performers && (
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                          👥 {typeof scene.performers === 'string' ? scene.performers : scene.performers.map(p => p.name).join(', ')}
                        </div>
                      )}
                      {scene.date && (
                        <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                          📅 {scene.date}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                        Click to select this {searchResults.allPerformers ? 'movie' : 'scene'}
                      </div>
                    </div>
                    <a
                      href={scene.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#8b5cf6',
                        color: 'white',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'background-color 0.2s',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#7c3aed';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#8b5cf6';
                      }}
                    >
                      🔗 View on GEVI
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              {/* YAML Scraper specific buttons */}
              {selectedScraper && (
                <>
                  {/* Search by Performers - only show if scraper supports NAME search */}
                  {(!selectedScraper.supportedScrapes || selectedScraper.supportedScrapes.includes('NAME')) && (
                    <button 
                      className="btn-primary" 
                      onClick={handleSearchYamlScraper}
                      disabled={
                        isScraping || 
                        isSearching || 
                        !data || 
                        !data.performers || 
                        data.performers.length < 1
                      }
                      style={{ marginRight: '10px' }}
                      title={`Search ${selectedScraper.name} by performers (requires 1+ performer)`}
                    >
                      {isSearching ? '⏳ Searching...' : `🔎 Search by Performers`}
                    </button>
                  )}
                  {/* Search by Title - only show if scraper supports NAME search */}
                  {(!selectedScraper.supportedScrapes || selectedScraper.supportedScrapes.includes('NAME')) && (
                    <button 
                      className="btn-primary" 
                      onClick={handleSearchYamlScraperByTitle}
                      disabled={
                        isScraping || 
                        isSearching || 
                        !data || 
                        !data.title
                      }
                      style={{ marginRight: '10px' }}
                      title={`Search ${selectedScraper.name} by title (requires title)`}
                    >
                      {isSearching ? '⏳ Searching...' : `📝 Search by Title`}
                    </button>
                  )}
                  {/* Smart Scrape button - only for Stash native scrapers that support FRAGMENT */}
                  {(selectedScraper.isStashNative || selectedScraper.type === 'StashNativeScraperService') && 
                   (!selectedScraper.supportedScrapes || selectedScraper.supportedScrapes.includes('FRAGMENT')) && (
                    <button 
                      className="btn-primary" 
                      onClick={handleSmartScrape}
                      disabled={
                        isScraping || 
                        isSearching || 
                        !data || 
                        (!data.title && !data.code && (!data.urls || data.urls.length === 0))
                      }
                      style={{ 
                        marginRight: '10px',
                        background: '#10b981',
                        borderLeft: '4px solid #34d399'
                      }}
                      title={`Smart scrape using all available metadata (title, code, date, URLs)`}
                    >
                      {isSearching ? '⏳ Searching...' : `🧠 Smart Scrape`}
                    </button>
                  )}
                </>
              )}
              
              {/* GEVI specific buttons */}
              {!selectedScraper && (
                <>
                  <button 
                    className="btn-primary" 
                    onClick={handleSearchGevi}
                    disabled={
                      isScraping || 
                      isSearching || 
                      !data || 
                      !data.performers || 
                      data.performers.length < 2
                    }
                    style={{ marginRight: '10px' }}
                    title="Search GEVI by performers (requires 2+ performers)"
                  >
                    {isSearching ? '⏳ Searching...' : '🔎 Search by Performers'}
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleSearchGeviByTitle}
                    disabled={
                      isScraping || 
                      isSearching || 
                      !data || 
                      !data.title || 
                      !data.studio || 
                      !data.studio.geviUrl
                    }
                    style={{ marginRight: '10px' }}
                    title={
                      !data?.studio?.geviUrl 
                        ? 'Studio must have a GEVI URL set (go to studio page to set it)' 
                        : !data?.title 
                        ? 'Scene must have a title' 
                        : 'Search for this scene on the studio\'s GEVI page by title'
                    }
                  >
                    {isSearching ? '⏳ Searching...' : `📝 Search by Title`}
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleSearchGeviMovies}
                    disabled={
                      isScraping || 
                      isSearching || 
                      !data || 
                      (
                        // Need either 2+ performers OR (studio with GEVI URL + title)
                        (!data.performers || data.performers.length < 2) &&
                        (!data.studio?.geviUrl || !data.title)
                      )
                    }
                    style={{ marginRight: '10px' }}
                    title={
                      !data 
                        ? 'Loading scene data...' 
                        : (data.performers && data.performers.length >= 2)
                        ? 'Search GEVI movies table using scene performers'
                        : (data.studio?.geviUrl && data.title)
                        ? 'Search GEVI movies table on studio page by title'
                        : 'Scene needs either:\n- At least 2 performers, OR\n- Studio with GEVI URL and scene title'
                    }
                  >
                    {isSearching ? '⏳ Searching...' : '🎬 Search Movies'}
                  </button>
                </>
              )}
              <button 
                className="btn-accept" 
                onClick={handleScrapeGevi}
                disabled={isScraping || isSearching || !scrapeUrl.trim()}
              >
                {isScraping ? '⏳ Scraping...' : '🔍 Scrape'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setShowScrapeModal(false);
                  setSearchResults(null);
                }}
                disabled={isScraping || isSearching}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stash-Box Search Options Modal */}
      {showStashBoxSearchModal && selectedStashBoxScraper && (
        <div className="modal-overlay" onClick={() => setShowStashBoxSearchModal(false)}>
          <div className="modal-content scrape-url-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>📦 {selectedStashBoxScraper.name} Search Options</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
                Choose how to search {selectedStashBoxScraper.name}:
              </p>
              
              {/* Search Type Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <label style={{ 
                  padding: '12px', 
                  border: stashBoxSearchType === 'fragment' ? '2px solid #06b6d4' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: stashBoxSearchType === 'fragment' ? '#ecfeff' : 'white',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    value="fragment"
                    checked={stashBoxSearchType === 'fragment'}
                    onChange={(e) => {
                      setStashBoxSearchType(e.target.value);
                      setStashBoxSearchQuery('');
                    }}
                    style={{ marginRight: '10px' }}
                  />
                  <strong>Fragment Scrape (Recommended)</strong>
                  <div style={{ fontSize: '13px', color: '#666', marginLeft: '24px', marginTop: '4px' }}>
                    Uses existing scene data (title, performers, studio) to find matches
                  </div>
                </label>
                
                <label style={{ 
                  padding: '12px', 
                  border: stashBoxSearchType === 'title' ? '2px solid #06b6d4' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: stashBoxSearchType === 'title' ? '#ecfeff' : 'white',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    value="title"
                    checked={stashBoxSearchType === 'title'}
                    onChange={(e) => {
                      setStashBoxSearchType(e.target.value);
                      // Don't set query here - let the input value handle it
                    }}
                    style={{ marginRight: '10px' }}
                  />
                  <strong>Search by Title</strong>
                  <div style={{ fontSize: '13px', color: '#666', marginLeft: '24px', marginTop: '4px' }}>
                    Search for scenes by title text
                  </div>
                </label>
                
                <label style={{ 
                  padding: '12px', 
                  border: stashBoxSearchType === 'performers' ? '2px solid #06b6d4' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: stashBoxSearchType === 'performers' ? '#ecfeff' : 'white',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    value="performers"
                    checked={stashBoxSearchType === 'performers'}
                    onChange={(e) => {
                      setStashBoxSearchType(e.target.value);
                      // Don't set query here - let the input value handle it
                    }}
                    style={{ marginRight: '10px' }}
                  />
                  <strong>Search by Performers</strong>
                  <div style={{ fontSize: '13px', color: '#666', marginLeft: '24px', marginTop: '4px' }}>
                    Search for scenes by performer names
                  </div>
                </label>
              </div>
              
              {/* Query Input for title/performers search */}
              {stashBoxSearchType !== 'fragment' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    {stashBoxSearchType === 'title' ? 'Scene Title:' : 'Performer Names (comma-separated):'}
                  </label>
                  <input
                    type="text"
                    value={stashBoxSearchType === 'title' 
                      ? (stashBoxSearchQuery || data?.title || '') 
                      : (stashBoxSearchQuery || data?.performers?.map(sp => {
                          const performer = sp.performer || sp;
                          return performer.name;
                        }).join(', ') || '')
                    }
                    onChange={(e) => setStashBoxSearchQuery(e.target.value)}
                    className="url-input"
                    placeholder={stashBoxSearchType === 'title' ? 'Enter scene title...' : 'John Doe, Jane Smith'}
                    disabled={isScraping}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={async () => {
                  setIsScraping(true);
                  setShowStashBoxSearchModal(false);
                  setShowScrapeModal(true); // Keep scrape modal open to show results
                  
                  try {
                    const endpoint = `/api/stash/scenes/${id}/scrape-stashbox`;
                    let requestBody = {
                      endpoint: selectedStashBoxScraper.endpoint
                    };
                    
                    // Build request based on search type
                    if (stashBoxSearchType === 'fragment') {
                      requestBody.searchType = 'scene_id';
                    } else if (stashBoxSearchType === 'title') {
                      requestBody.searchType = 'title';
                      // Use stashBoxSearchQuery if set, otherwise use scene title
                      requestBody.query = (stashBoxSearchQuery || data?.title || '').trim();
                    } else if (stashBoxSearchType === 'performers') {
                      requestBody.searchType = 'performers';
                      // Use stashBoxSearchQuery if set, otherwise calculate from scene performers
                      const defaultQuery = data?.performers?.map(sp => {
                        const performer = sp.performer || sp;
                        return performer.name;
                      }).join(', ') || '';
                      requestBody.query = (stashBoxSearchQuery || defaultQuery).trim();
                    }
                    
                    console.log(`📦 Searching ${selectedStashBoxScraper.name} with type: ${stashBoxSearchType}`);
                    console.log(`📦 Query: ${requestBody.query || '(fragment scraping)'}`);
                    
                    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(requestBody)
                    });

                    const result = await response.json();

                    if (result.success) {
                      const { results, searchType, source } = result.data;
                      
                      console.log(`📦 Stash-box search returned ${results.length} results`);
                      
                      // Show search results for selection
                      setSearchResults({
                        scenes: results,
                        isSceneSearch: true,
                        isStashBox: true,
                        searchType: searchType,
                        source: source
                      });
                    } else {
                      alert(`Scraping failed: ${result.error || 'Unknown error'}`);
                    }
                  } catch (error) {
                    console.error('Error scraping with stash-box:', error);
                    alert('Failed to scrape scene data');
                  } finally {
                    setIsScraping(false);
                  }
                }}
                disabled={isScraping}
              >
                {isScraping ? '⏳ Searching...' : '🔍 Search'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowStashBoxSearchModal(false)}
                disabled={isScraping}
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
            
            {!scrapeData.scraped ? (
              // No results found
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ color: '#666', marginBottom: '0.5rem' }}>No Results Found</h3>
                <p style={{ color: '#999', marginBottom: '2rem' }}>
                  No matching scenes were found in {scrapeData.source === 'stash-box' ? 'Stash-Box' : 'the scraper'}.
                  Try adjusting your search criteria or using a different search method.
                </p>
                <button 
                  className="btn-cancel" 
                  onClick={() => setShowScrapeReviewModal(false)}
                  style={{ margin: '0 auto' }}
                >
                  Close
                </button>
              </div>
            ) : (
              // Results found - show scrape data
              <div className="scrape-results">
                {/* Source Information */}
                <div className="scrape-source">
                  <span className="source-label">Scraped from:</span>
                  {scrapeData.scraped.url ? (
                    <a href={scrapeData.scraped.url} target="_blank" rel="noopener noreferrer" className="source-url">
                      {scrapeData.source === 'stash-box' ? 'Stash-Box' : 'GEVI Episode'}
                    </a>
                  ) : (
                    <span className="source-url">{scrapeData.source === 'stash-box' ? 'Stash-Box' : 'Unknown Source'}</span>
                  )}
                </div>

              {/* Scene Image */}
              {scrapeData.scraped.image && (
                <div className="parse-field" style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                  <img 
                    src={scrapeData.scraped.image} 
                    alt={scrapeData.scraped.title || 'Scene preview'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      console.error('Failed to load scene image:', scrapeData.scraped.image);
                    }}
                    onLoad={() => {
                      console.log('✅ Scene image loaded successfully:', scrapeData.scraped.image);
                    }}
                  />
                </div>
              )}
              {!scrapeData.scraped.image && (
                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '4px', margin: '1rem 0' }}>
                  ⚠️ No image found in scraped data
                </div>
              )}

              {/* Image Selection */}
              <div className="parse-field">
                <label>Cover Image:</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Existing Image */}
                  {data?.paths?.screenshot && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, image: 'existing' }))}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: fieldSelections.image === 'existing' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.image === 'existing' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>EXISTING</span>
                        {fieldSelections.image === 'existing' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <img 
                        src={`${config.stashUrl}${data.paths.screenshot}`}
                        alt="Existing"
                        style={{ width: '100%', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  {/* Scraped Image */}
                  {scrapeData.scraped.image && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, image: 'scraped' }))}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: fieldSelections.image === 'scraped' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.image === 'scraped' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>SCRAPED</span>
                        {fieldSelections.image === 'scraped' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <img 
                        src={scrapeData.scraped.image}
                        alt="Scraped"
                        style={{ width: '100%', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Title Field */}
              <div className="parse-field">
                <label>Title:</label>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  {/* Existing Title */}
                  {data?.title && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, title: 'existing' }))}
                      style={{
                        padding: '10px',
                        border: fieldSelections.title === 'existing' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.title === 'existing' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>EXISTING</span>
                        {fieldSelections.title === 'existing' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '14px', color: '#111827' }}>{data.title}</div>
                    </div>
                  )}
                  {/* Scraped Title */}
                  {scrapeData.scraped.title && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, title: 'scraped' }))}
                      style={{
                        padding: '10px',
                        border: fieldSelections.title === 'scraped' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.title === 'scraped' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>SCRAPED</span>
                        {fieldSelections.title === 'scraped' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '14px', color: '#111827' }}>{scrapeData.scraped.title}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Studio Field */}
              <div className="parse-field">
                <label>Studio:</label>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  {/* Existing Studio */}
                  {data?.studio?.name && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, studio: 'existing' }))}
                      style={{
                        padding: '10px',
                        border: fieldSelections.studio === 'existing' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.studio === 'existing' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>EXISTING</span>
                        {fieldSelections.studio === 'existing' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '14px', color: '#111827' }}>{data.studio.name}</div>
                    </div>
                  )}
                  {/* Scraped Studio */}
                  {scrapeData.scraped.studio && (
                    <div 
                      onClick={() => setFieldSelections(prev => ({ ...prev, studio: 'scraped' }))}
                      style={{
                        padding: '10px',
                        border: fieldSelections.studio === 'scraped' ? '2px solid #10b981' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: fieldSelections.studio === 'scraped' ? '#d1fae5' : '#f9fafb',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>SCRAPED</span>
                        {fieldSelections.studio === 'scraped' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                      </div>
                      <div style={{ fontSize: '14px', color: '#111827' }}>
                        {typeof scrapeData.scraped.studio === 'object' ? scrapeData.scraped.studio.name : scrapeData.scraped.studio}
                        {scrapeData.matched.studio && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#10b981' }}>✓ Matched</span>
                        )}
                        {!scrapeData.matched.studio && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#f59e0b' }}>⚠️ Not matched</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Date Field */}
              {(data?.date || scrapeData.scraped.date) && (
                <div className="parse-field">
                  <label>Date:</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {data?.date && (
                      <div 
                        onClick={() => setFieldSelections(prev => ({ ...prev, date: 'existing' }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: fieldSelections.date === 'existing' ? '2px solid #10b981' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: fieldSelections.date === 'existing' ? '#d1fae5' : '#f9fafb',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>EXISTING</span>
                          {fieldSelections.date === 'existing' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '14px', color: '#111827' }}>{data.date}</div>
                      </div>
                    )}
                    {scrapeData.scraped.date && (
                      <div 
                        onClick={() => setFieldSelections(prev => ({ ...prev, date: 'scraped' }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: fieldSelections.date === 'scraped' ? '2px solid #10b981' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: fieldSelections.date === 'scraped' ? '#d1fae5' : '#f9fafb',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>SCRAPED</span>
                          {fieldSelections.date === 'scraped' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '14px', color: '#111827' }}>{scrapeData.scraped.date}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Details Field */}
              {(data?.details || scrapeData.scraped.details) && (
                <div className="parse-field">
                  <label>Details:</label>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                    {data?.details && (
                      <div 
                        onClick={() => setFieldSelections(prev => ({ ...prev, details: 'existing' }))}
                        style={{
                          padding: '10px',
                          border: fieldSelections.details === 'existing' ? '2px solid #10b981' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: fieldSelections.details === 'existing' ? '#d1fae5' : '#f9fafb',
                          transition: 'all 0.2s',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>EXISTING</span>
                          {fieldSelections.details === 'existing' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#111827', whiteSpace: 'pre-wrap' }}>{data.details}</div>
                      </div>
                    )}
                    {scrapeData.scraped.details && (
                      <div 
                        onClick={() => setFieldSelections(prev => ({ ...prev, details: 'scraped' }))}
                        style={{
                          padding: '10px',
                          border: fieldSelections.details === 'scraped' ? '2px solid #10b981' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: fieldSelections.details === 'scraped' ? '#d1fae5' : '#f9fafb',
                          transition: 'all 0.2s',
                          maxHeight: '150px',
                          overflow: 'auto'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>SCRAPED</span>
                          {fieldSelections.details === 'scraped' && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '13px', color: '#111827', whiteSpace: 'pre-wrap' }}>{scrapeData.scraped.details}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GEVI URL Field - Read-only */}
              <div className="parse-field">
                <label>GEVI URL:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={scrapeData.scraped.url || ''}
                    className="parse-input"
                    readOnly
                    style={{ flex: 1, background: '#f3f4f6', cursor: 'default' }}
                  />
                  <a
                    href={scrapeData.scraped.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 12px',
                      background: '#8b5cf6',
                      color: 'white',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🔗 Open
                  </a>
                </div>
              </div>

              {/* Episode URLs */}
              {scrapeData.scraped.episodeUrls && scrapeData.scraped.episodeUrls.length > 0 && (
                <div className="parse-field">
                  <label>Episode URLs ({scrapeData.scraped.episodeUrls.length}):</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {scrapeData.scraped.episodeUrls.map((episodeUrl, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={episodeUrl}
                          className="parse-input"
                          readOnly
                          style={{ flex: 1, background: '#f3f4f6', cursor: 'default', fontSize: '13px' }}
                        />
                        <a
                          href={episodeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 10px',
                            background: '#6366f1',
                            color: 'white',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          🔗
                        </a>
                      </div>
                    ))}
                  </div>
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: '#dbeafe', 
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#1e40af'
                  }}>
                    ℹ️ These URLs will be added to the scene in Stash
                  </div>
                </div>
              )}

              {/* Performers Field */}
              <div className="parse-field">
                <label>Performers:</label>
                <div className="performers-list">
                  {scrapeData.matched.performers.map((performer, index) => {
                    const hasAlternatives = performer.alternatives && performer.alternatives.length > 0;
                    
                    // Find the corresponding scraped performer to get action code
                    const scrapedPerformer = scrapeData.scraped.performers.find(
                      sp => sp.name === performer.originalName
                    );
                    const actionCode = scrapedPerformer?.actionCode;
                    
                    return (
                      <div key={index} className="performer-item matched">
                        <div className="performer-input-wrapper">
                          <span className="performer-name">
                            ✓ {performer.name}
                            {performer.disambiguation && (
                              <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                                ({performer.disambiguation})
                              </span>
                            )}
                            {actionCode && <span className="action-code" style={{ color: '#10b981', marginLeft: '0.5rem', fontSize: '0.875rem' }}>({actionCode})</span>}
                          </span>
                          <select
                            className="performer-alternatives-dropdown"
                            onChange={async (e) => {
                              const value = e.target.value;
                              if (!value) return;
                              
                              if (value === '__ADD_NEW__') {
                                // Create new performer with original GEVI name
                                const isCreating = creatingPerformers.has(performer.originalName);
                                if (isCreating) return;
                                
                                await handleCreatePerformer(performer.originalName);
                                
                                // Remove the incorrectly matched performer from the matched list
                                setScrapeData(prev => ({
                                  ...prev,
                                  matched: {
                                    ...prev.matched,
                                    performers: prev.matched.performers.filter((_, i) => i !== index)
                                  }
                                }));
                                
                                // Reset the dropdown
                                e.target.value = '';
                              } else {
                                // Switch to alternative performer
                                const newMatched = [...scrapeData.matched.performers];
                                const selectedAlt = performer.alternatives?.find(a => a.name === value);
                                if (selectedAlt) {
                                  newMatched[index] = {
                                    ...selectedAlt,
                                    originalName: performer.originalName,
                                    alternatives: [
                                      { ...performer, matchedAlias: performer.matchedAlias, matchedVia: performer.matchedVia },
                                      ...performer.alternatives.filter(a => a.id !== selectedAlt.id)
                                    ]
                                  };
                                  setScrapeData({
                                    ...scrapeData,
                                    matched: {
                                      ...scrapeData.matched,
                                      performers: newMatched
                                    }
                                  });
                                }
                              }
                            }}
                            value=""
                          >
                            <option value="">Select action...</option>
                            <option value="__ADD_NEW__">
                              ➕ Add "{performer.originalName}" as new performer
                            </option>
                            {hasAlternatives && <option disabled>──────────</option>}
                            {hasAlternatives && performer.alternatives.map((alt, altIndex) => (
                              <option key={altIndex} value={alt.name}>
                                Switch to: {alt.name}
                                {alt.disambiguation ? ` (${alt.disambiguation})` : ''}
                                {alt.matchedVia === 'alias' && alt.matchedAlias ? ` (via: ${alt.matchedAlias})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="match-label">
                          (Matched{performer.matchedVia === 'alias' && performer.matchedAlias ? ` via alias: ${performer.matchedAlias}` : ''})
                          {hasAlternatives && (
                            <span className="alternatives-count"> (+{performer.alternatives.length} more)</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {scrapeData.unmatched.performers.map((performer, index) => {
                    // Handle both string and object formats
                    const performerName = typeof performer === 'string' ? performer : performer.name;
                    
                    // Find the corresponding scraped performer to get action code
                    const scrapedPerformer = scrapeData.scraped.performers.find(
                      sp => sp.name === performerName
                    );
                    const actionCode = scrapedPerformer?.actionCode;
                    const isCreating = creatingPerformers.has(performerName);
                    
                    return (
                      <div key={index} className="performer-item unmatched">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <div>
                            <span className="performer-name">
                              ✗ {performerName}
                              {actionCode && <span className="action-code" style={{ color: '#ef4444', marginLeft: '0.5rem', fontSize: '0.875rem' }}>({actionCode})</span>}
                            </span>
                            <span className="match-label">(Not found)</span>
                          </div>
                          <button
                            onClick={() => handleCreatePerformer(performerName)}
                            disabled={isCreating}
                            style={{
                              padding: '4px 12px',
                              fontSize: '12px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isCreating ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                              opacity: isCreating ? 0.5 : 1
                            }}
                          >
                            {isCreating ? '⏳ Creating...' : '➕ Add New'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags Field */}
              {(scrapeData.matched.tags?.length > 0 || scrapeData.unmatched.tags?.length > 0) && (
                <div className="parse-field">
                  <label>Tags ({(scrapeData.matched.tags?.length || 0) + (scrapeData.unmatched.tags?.length || 0)}):</label>
                  <div className="performers-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Tags already on the scene */}
                    {data?.tags?.map((tag, index) => (
                      <div key={`existing-${index}`} style={{
                        padding: '4px 10px',
                        background: '#e5e7eb',
                        color: '#374151',
                        borderRadius: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>📌</span>
                        <span>{tag.name}</span>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>(on scene)</span>
                      </div>
                    ))}
                    
                    {/* Matched tags from scrape */}
                    {scrapeData.matched.tags?.map((tag, index) => (
                      <div key={`matched-${index}`} style={{
                        padding: '4px 10px',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '12px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>✓</span>
                        <span>{tag.name}</span>
                      </div>
                    ))}
                    
                    {/* Unmatched tags - can be created */}
                    {scrapeData.unmatched.tags?.map((tag, index) => {
                      const tagName = typeof tag === 'string' ? tag : tag.name;
                      const isCreating = creatingTags.has(tagName);
                      
                      return (
                        <div key={`unmatched-${index}`} style={{
                          padding: '4px 10px',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: '12px',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px dashed #f59e0b'
                        }}>
                          <span>✗</span>
                          <span>{tagName}</span>
                          <button
                            onClick={() => handleCreateTag(tagName)}
                            disabled={isCreating}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: isCreating ? 'not-allowed' : 'pointer',
                              opacity: isCreating ? 0.5 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            {isCreating ? '⏳' : '➕'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: '#f3f4f6', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    ℹ️ Tags with ✓ are in your database. Tags with ✗ are not - click ➕ to add them. Tags with 📌 are already on this scene.
                  </div>
                </div>
              )}

              {/* Movies/Groups Field */}
              {(scrapeData.matched.groups?.length > 0 || scrapeData.unmatched.groups?.length > 0) && (
                <div className="parse-field">
                  <label>Movies/Groups:</label>
                  <div className="performers-list">
                    {scrapeData.matched.groups?.map((group, index) => {
                      const hasAlternatives = group.alternatives && group.alternatives.length > 0;
                      
                      const isCreatingMatched = creatingGroups.has(group.name);
                      
                      return (
                        <div key={index} className="performer-item matched">
                          <div className="performer-input-wrapper">
                            <span className="performer-name">
                              ✓ {group.name}
                              {group.studio && <span style={{ color: '#6b7280', marginLeft: '0.5rem', fontSize: '0.875rem' }}>({group.studio})</span>}
                            </span>
                            {hasAlternatives && (
                              <select
                                className="performer-alternatives-dropdown"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    // Update matched groups with selected alternative
                                    const newMatched = [...scrapeData.matched.groups];
                                    const selectedAlt = group.alternatives.find(a => a.name === e.target.value);
                                    if (selectedAlt) {
                                      newMatched[index] = {
                                        ...selectedAlt,
                                        originalName: group.originalName,
                                        url: group.url,
                                        alternatives: [
                                          { ...group, matchedAlias: group.matchedAlias, matchedVia: group.matchedVia },
                                          ...group.alternatives.filter(a => a.id !== selectedAlt.id)
                                        ]
                                      };
                                      setScrapeData({
                                        ...scrapeData,
                                        matched: {
                                          ...scrapeData.matched,
                                          groups: newMatched
                                        }
                                      });
                                    }
                                  }
                                }}
                                value=""
                              >
                                <option value="">Switch to alternative...</option>
                                {group.alternatives.map((alt, altIndex) => (
                                  <option key={altIndex} value={alt.name}>
                                    {alt.name} {alt.studio ? `(${alt.studio})` : ''} {alt.matchedVia === 'alias' && alt.matchedAlias ? `(via: ${alt.matchedAlias})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                            <span className="match-label">
                              (Matched{group.matchedVia === 'alias' && group.matchedAlias ? ` via alias: ${group.matchedAlias}` : ''})
                              {hasAlternatives && (
                                <span className="alternatives-count"> (+{group.alternatives.length} more)</span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                // Check if this is an AEBN scrape (source contains 'aebn' or URL contains 'aebn.com')
                                const isAebnScrape = scrapeData?.source?.toLowerCase().includes('aebn') || 
                                                    scrapeData?.sourceUrl?.toLowerCase().includes('aebn.com') ||
                                                    scrapeData?.scraped?.url?.toLowerCase().includes('aebn.com');
                                
                                console.log('🔍 [Create Movie Button] Checking scraper type:');
                                console.log('   - source:', scrapeData?.source);
                                console.log('   - sourceUrl:', scrapeData?.sourceUrl);
                                console.log('   - scraped.url:', scrapeData?.scraped?.url);
                                console.log('   - isAebnScrape:', isAebnScrape);
                                
                                if (isAebnScrape) {
                                  console.log('   ✓ Using AEBN create flow');
                                  handleCreateNewMovieFromAebn(group);
                                } else {
                                  console.log('   → Using GEVI create flow');
                                  handleCreateGroup(group);
                                }
                              }}
                              disabled={isCreatingMatched}
                              style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isCreatingMatched ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                                opacity: isCreatingMatched ? 0.5 : 1
                              }}
                            >
                              {isCreatingMatched ? '⏳ Creating...' : '➕ Create New Movie'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {scrapeData.unmatched.groups?.map((group, index) => {
                      const isCreating = creatingGroups.has(group.name);
                      
                      return (
                        <div key={index} className="performer-item unmatched">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                              <span className="performer-name">
                                ✗ {group.name}
                              </span>
                              <span className="match-label">(Not found)</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={async () => {
                                  try {
                                    console.log('🎬 Fetching movie details from:', group.url);
                                    const response = await fetch('/api/stash/gevi/movie', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ url: group.url })
                                    });
                                    
                                    if (!response.ok) {
                                      throw new Error('Failed to fetch movie details');
                                    }
                                    
                                    const result = await response.json();
                                    console.log('✅ Movie details fetched:', result.data.movie);
                                    
                                    // Show movie details in an alert or modal (for now, just log)
                                    alert(`Movie Details:\n\nTitle: ${result.data.movie.name}\nStudio: ${result.data.movie.studio || 'N/A'}\nDate: ${result.data.movie.date || 'N/A'}\nDuration: ${result.data.movie.duration || 'N/A'}\nDirector: ${result.data.movie.director || 'N/A'}\n\n(Full details in console)`);
                                  } catch (error) {
                                    console.error('❌ Failed to fetch movie details:', error);
                                    alert('Failed to fetch movie details. See console for details.');
                                  }
                                }}
                                disabled={isCreating}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  background: '#8b5cf6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isCreating ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  opacity: isCreating ? 0.5 : 1
                                }}
                              >
                                📥 Fetch Details
                              </button>
                              <button
                                onClick={() => handleCreateGroup(group)}
                                disabled={isCreating}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isCreating ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  opacity: isCreating ? 0.5 : 1
                                }}
                              >
                                {isCreating ? '⏳ Creating...' : '➕ Add New'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date Field */}
              {scrapeData.scraped.date && (
                <div className="parse-field">
                  <label>Date:</label>
                  <input
                    type="text"
                    value={scrapeData.scraped.date}
                    className="parse-input"
                    readOnly
                  />
                </div>
              )}

              {/* Details Field */}
              {scrapeData.scraped.details && (
                <div className="parse-field">
                  <label>Details:</label>
                  <textarea
                    value={scrapeData.scraped.details}
                    className="parse-input details-textarea"
                    rows="4"
                    readOnly
                  />
                </div>
              )}
            </div>
            )}

            {scrapeData.scraped && (
            <div className="modal-actions">
              <button className="btn-accept" onClick={handleAcceptScrape}>
                ✓ Accept & Update
              </button>
              <button className="btn-cancel" onClick={() => setShowScrapeReviewModal(false)}>
                Cancel
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Set/Update GEVI URL Modal */}
      {showGeviUrlModal && (
        <div className="modal-overlay" onClick={() => setShowGeviUrlModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔗 {data?.geviUrl ? 'Update' : 'Set'} GEVI URL</h3>
            
            <div className="scrape-input-section">
              <label htmlFor="gevi-url-input">GEVI Episode URL:</label>
              <input
                id="gevi-url-input"
                type="text"
                value={geviUrlInput}
                onChange={(e) => setGeviUrlInput(e.target.value)}
                placeholder="https://gayeroticvideoindex.com/episode/..."
                disabled={isSavingGeviUrl}
                className="scrape-url-input"
              />
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Enter the GEVI episode URL for this scene. This will be saved and used for future scraping.
              </p>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleSaveGeviUrl}
                disabled={isSavingGeviUrl || !geviUrlInput.trim()}
              >
                {isSavingGeviUrl ? '⏳ Saving...' : '💾 Save URL'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowGeviUrlModal(false)}
                disabled={isSavingGeviUrl}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Editor Modal */}
      {showUrlEditorModal && (
        <div className="modal-overlay" onClick={() => !isSavingUrls && setShowUrlEditorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>✏️ Edit Scene URLs</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                Add or edit URLs for this scene. These URLs will be synced to Stash.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {editingUrls.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                    No URLs yet. Click "Add URL" to get started.
                  </p>
                ) : (
                  editingUrls.map((url, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      gap: '8px', 
                      alignItems: 'center',
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      <span style={{ 
                        color: '#6b7280', 
                        fontSize: '13px', 
                        fontWeight: '600',
                        minWidth: '30px'
                      }}>
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => handleUpdateUrl(index, e.target.value)}
                        placeholder="https://example.com/scene/..."
                        disabled={isSavingUrls}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <button
                        onClick={() => handleRemoveUrl(index)}
                        disabled={isSavingUrls}
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isSavingUrls ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          opacity: isSavingUrls ? 0.5 : 1
                        }}
                        title="Remove URL"
                      >
                        🗑️
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <button
                onClick={handleAddUrl}
                disabled={isSavingUrls}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '10px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingUrls ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: isSavingUrls ? 0.5 : 1
                }}
              >
                ➕ Add URL
              </button>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleSaveUrls}
                disabled={isSavingUrls}
              >
                {isSavingUrls ? '⏳ Saving...' : '💾 Save URLs'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowUrlEditorModal(false)}
                disabled={isSavingUrls}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studio Editor Modal */}
      {showStudioEditorModal && (
        <div className="modal-overlay" onClick={() => !isUpdatingStudio && setShowStudioEditorModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>🏢 Edit Studio</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                Select a studio for this scene or remove the current studio assignment.
              </p>
              
              {data?.studio && (
                <div style={{ 
                  padding: '12px', 
                  background: '#f3f4f6', 
                  borderRadius: '6px', 
                  marginBottom: '1rem'
                }}>
                  <strong>Current Studio:</strong> {data.studio.name}
                </div>
              )}
              
              <input
                type="text"
                value={studioSearchQuery}
                onChange={(e) => setStudioSearchQuery(e.target.value)}
                placeholder="Search studios..."
                disabled={isUpdatingStudio}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginBottom: '12px'
                }}
              />
              
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px'
              }}>
                {availableStudios
                  .filter(studio => 
                    !studioSearchQuery || 
                    studio.name.toLowerCase().includes(studioSearchQuery.toLowerCase())
                  )
                  .map(studio => (
                    <div
                      key={studio.id}
                      onClick={() => !isUpdatingStudio && setSelectedStudioId(studio.id)}
                      style={{
                        padding: '12px',
                        cursor: isUpdatingStudio ? 'not-allowed' : 'pointer',
                        background: selectedStudioId === studio.id ? '#dbeafe' : 'white',
                        borderBottom: '1px solid #e5e7eb',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        opacity: isUpdatingStudio ? 0.6 : 1
                      }}
                    >
                      <span>{studio.name}</span>
                      {selectedStudioId === studio.id && <span>✓</span>}
                    </div>
                  ))}
                {availableStudios.filter(studio => 
                  !studioSearchQuery || 
                  studio.name.toLowerCase().includes(studioSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    No studios found
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleUpdateStudio}
                disabled={isUpdatingStudio || !selectedStudioId}
              >
                {isUpdatingStudio ? '⏳ Updating...' : '💾 Update Studio'}
              </button>
              {data?.studio && (
                <button 
                  className="btn-danger" 
                  onClick={handleRemoveStudio}
                  disabled={isUpdatingStudio}
                  style={{ marginLeft: '8px' }}
                >
                  {isUpdatingStudio ? '⏳ Removing...' : '🗑️ Remove Studio'}
                </button>
              )}
              <button 
                className="btn-cancel" 
                onClick={() => setShowStudioEditorModal(false)}
                disabled={isUpdatingStudio}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Scene Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#ef4444' }}>🗑️ Delete Scene</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                Are you sure you want to delete this scene?
              </p>
              <p style={{ fontSize: '0.95rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                ⚠️ This will:
              </p>
              <ul style={{ fontSize: '0.9rem', color: '#9ca3af', marginLeft: '1.5rem' }}>
                <li>Delete the scene from the local database</li>
                <li>Delete the scene from Stash</li>
                <li>Delete the video file from disk</li>
                <li>Delete all generated content (screenshots, etc.)</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-danger" 
                onClick={handleDeleteScene}
                disabled={isDeleting}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white'
                }}
              >
                {isDeleting ? '⏳ Deleting...' : '🗑️ Delete Permanently'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performer Swap Modal */}
      <PerformerSwapModal
        isOpen={showSwapModal}
        onClose={() => {
          setShowSwapModal(false);
          setPerformerToSwap(null);
        }}
        sceneId={id}
        performer={performerToSwap}
        onSwapComplete={handleSwapComplete}
      />

      {/* Add Performer Modal */}
      <AddPerformerModal
        isOpen={showAddPerformerModal}
        onClose={() => setShowAddPerformerModal(false)}
        sceneId={id}
        existingPerformers={data?.performers?.map(p => p.performer || p) || []}
        onAddComplete={(updatedScene) => {
          console.log('✅ Performer added, refreshing scene data');
          setData(updatedScene);
          setShowAddPerformerModal(false);
        }}
      />

      {/* Merge Performers Modal */}
      {showMergeModal && (
        <MergePerformersModal
          performers={data.performers
            .map(p => p.performer || p)
            .filter(p => selectedPerformers.has(p.id))}
          onClose={() => setShowMergeModal(false)}
          onSuccess={handleMergeSuccess}
        />
      )}
    </div>
  );
}


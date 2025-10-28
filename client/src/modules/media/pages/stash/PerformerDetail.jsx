import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import config from '../../../../config';

// Helper function to convert cm to feet and inches
const formatHeight = (heightStr) => {
  if (!heightStr) return null;
  // Parse the numeric value from strings like "183 cm" or just "183"
  const heightCm = parseFloat(heightStr);
  if (isNaN(heightCm)) return heightStr; // Return original if can't parse
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
};

// Helper function to convert kg to pounds
const formatWeight = (weightStr) => {
  if (!weightStr) return null;
  // Parse the numeric value from strings like "75 kg" or just "75"
  const weightKg = parseFloat(weightStr);
  if (isNaN(weightKg)) return weightStr; // Return original if can't parse
  const pounds = Math.round(weightKg * 2.20462);
  return `${pounds} lbs`;
};

// Helper function to format penis length in inches
const formatPenisLength = (lengthStr) => {
  if (!lengthStr) return null;
  // Parse the numeric value from strings like "18 cm" or just "18"
  const lengthCm = parseFloat(lengthStr);
  if (isNaN(lengthCm)) return lengthStr; // Return original if can't parse
  const inches = (lengthCm / 2.54).toFixed(1);
  return `${inches}"`;
};

export default function PerformerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPage = searchParams.get('fromPage') || '1';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mergedTags, setMergedTags] = useState([]);
  const [stashUrl, setStashUrl] = useState(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    alias: '',
    disambiguation: '',
    newUrls: [''] // Array of new URLs to add
  });
  const [isSaving, setIsSaving] = useState(false);

  // Merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeDirection, setMergeDirection] = useState('into'); // 'into' or 'from'
  const [searchQuery, setSearchQuery] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerformers, setSelectedPerformers] = useState([]);
  const [isMerging, setIsMerging] = useState(false);

  // Scene merge state
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const [showSceneMergeModal, setShowSceneMergeModal] = useState(false);
  const [scenesToMerge, setScenesToMerge] = useState([]);
  const [mergeSceneData, setMergeSceneData] = useState(null);
  const [isMergingScenes, setIsMergingScenes] = useState(false);

  // Stash-box scraping state
  const [availableScrapers, setAvailableScrapers] = useState([]);
  const [showStashBoxSearchModal, setShowStashBoxSearchModal] = useState(false);
  const [stashBoxSearchType, setStashBoxSearchType] = useState('fragment');
  const [stashBoxSearchQuery, setStashBoxSearchQuery] = useState('');
  const [selectedStashBoxScraper, setSelectedStashBoxScraper] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [showScrapeReviewModal, setShowScrapeReviewModal] = useState(false);
  const [scrapeData, setScrapeData] = useState(null);
  const [isApplyingScrape, setIsApplyingScrape] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [acceptedFields, setAcceptedFields] = useState({});

  // GEVI scraping state
  const [isSearchingGevi, setIsSearchingGevi] = useState(false);

  // Name conflict state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [pendingScrapeData, setPendingScrapeData] = useState(null);

  // URLs collapse state
  const [isUrlsCollapsed, setIsUrlsCollapsed] = useState(true);

  // Fetch Stash URL from settings
  useEffect(() => {
    const fetchStashUrl = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/status`);
        const json = await res.json();
        console.log('🔍 Stash connection check:', json);
        if (json.connected && json.stashUrl) {
          console.log('✅ Setting stashUrl:', json.stashUrl);
          setStashUrl(json.stashUrl);
        } else {
          console.log('❌ Stash not connected or no URL');
        }
      } catch (error) {
        console.error('Failed to fetch Stash URL:', error);
      }
    };
    fetchStashUrl();
  }, []);

  // Fetch performer data function (extracted for reuse)
  const fetchPerformer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load performer');
      setData(json.data);
      
      // Merge all tags: performer tags + scene-specific tags
      const tagMap = new Map();
      
      // Add general performer tags
      if (json.data.tags) {
        json.data.tags.forEach(tag => {
          if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, {
              ...tag,
              isGeneral: true,
              sceneCount: 0,
              scenes: []
            });
          }
        });
      }
      
      // Add ALL scene-specific tags from allScenePerformerTags
      if (json.data.allScenePerformerTags) {
        json.data.allScenePerformerTags.forEach(sceneTag => {
          if (tagMap.has(sceneTag.tagId)) {
            // Tag already exists, increment scene count
            const existing = tagMap.get(sceneTag.tagId);
            existing.sceneCount++;
            existing.scenes.push({ id: sceneTag.sceneId, title: sceneTag.sceneTitle });
          } else {
            // New tag from scene
            tagMap.set(sceneTag.tagId, {
              id: sceneTag.tagId,
              name: sceneTag.tagName,
              isGeneral: false,
              sceneCount: 1,
              scenes: [{ id: sceneTag.sceneId, title: sceneTag.sceneTitle }]
            });
          }
        });
      }
      
      // Convert map to array and sort by name
      const merged = Array.from(tagMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      console.log('Merged tags:', merged);
      console.log('Tag map size:', tagMap.size);
      console.log('Performer tags:', json.data.tags);
      console.log('Scenes with tags:', json.data.scenes?.filter(s => s.performerTags?.length > 0));
      setMergedTags(merged);
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPerformer();
  }, [fetchPerformer]);
  
  // Handle edit mode toggle
  const handleEditClick = () => {
    setEditData({
      name: data.name || '',
      alias: data.alias || '',
      disambiguation: data.disambiguation || '',
      newUrls: [''] // Start with one empty URL field
    });
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ 
      name: '', 
      alias: '', 
      disambiguation: '',
      newUrls: ['']
    });
  };
  
  // Handle adding a new URL field
  const handleAddUrlField = () => {
    setEditData({
      ...editData,
      newUrls: [...editData.newUrls, '']
    });
  };
  
  // Handle removing a URL field
  const handleRemoveUrlField = (index) => {
    const updatedUrls = editData.newUrls.filter((_, i) => i !== index);
    setEditData({
      ...editData,
      newUrls: updatedUrls.length > 0 ? updatedUrls : [''] // Always keep at least one field
    });
  };
  
  // Handle updating a URL field
  const handleUrlChange = (index, value) => {
    const updatedUrls = [...editData.newUrls];
    updatedUrls[index] = value;
    setEditData({
      ...editData,
      newUrls: updatedUrls
    });
  };
  
  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editData.name.trim()) {
      alert('Performer name cannot be empty');
      return;
    }
    
    // Filter out empty URLs
    const validUrls = editData.newUrls.filter(url => url.trim() !== '');
    
    setIsSaving(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editData.name.trim(),
          alias: editData.alias.trim() || null,
          disambiguation: editData.disambiguation.trim() || null,
          newUrls: validUrls // Send array of new URLs to append
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update performer');
      }
      
      // Update local state with returned performer data
      setData(result.data.performer);
      
      setIsEditing(false);
      alert('Performer updated successfully in both local database and Stash!');
      
    } catch (error) {
      console.error('Failed to update performer:', error);
      alert(`Failed to update performer: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle delete performer
  const handleDeletePerformer = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete performer "${data.name}"?\n\n` +
      `This will remove the performer from both the local database and Stash.\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete performer');
      }
      
      alert(result.message || 'Performer deleted successfully!');
      
      // Navigate back to performers list with page number
      navigate(`/media/stash?tab=performers&page=${fromPage}`);
      
    } catch (error) {
      console.error('Failed to delete performer:', error);
      alert(`Failed to delete performer: ${error.message}`);
    }
  };

  // Handle sync from Stash
  const handleSyncFromStash = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync performer');
      }
      
      // Update local state with synced data
      setData(result.data.performer);
      
      console.log('✅ Performer synced from Stash:', result.data.message);
      
      alert('✅ Performer synced successfully from Stash!');
    } catch (error) {
      console.error('Failed to sync performer:', error);
      alert(`Failed to sync performer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle search for performers
  const handleSearchPerformers = async (query) => {
    if (!query || query.trim().length < 2) {
      setMergeSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/performers/search?q=${encodeURIComponent(query)}&limit=20`
      );
      const result = await response.json();
      
      if (result.success) {
        // Filter out current performer from results
        const filtered = result.data.filter(p => p.id !== id);
        setMergeSearchResults(filtered);
      }
    } catch (error) {
      console.error('Failed to search performers:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle performer selection for merge
  const handleTogglePerformer = (performer) => {
    setSelectedPerformers(prev => {
      const exists = prev.find(p => p.id === performer.id);
      if (exists) {
        return prev.filter(p => p.id !== performer.id);
      } else {
        return [...prev, performer];
      }
    });
  };

  // Open merge modal
  const handleOpenMergeModal = (direction) => {
    setMergeDirection(direction);
    setShowMergeModal(true);
    setSearchQuery('');
    setMergeSearchResults([]);
    setSelectedPerformers([]);
  };

  // Handle merge performers
  const handleMergePerformers = async () => {
    if (selectedPerformers.length === 0) {
      alert('Please select at least one performer to merge');
      return;
    }

    const direction = mergeDirection;
    const mainPerformer = direction === 'into' ? selectedPerformers[0] : data;
    const mergePerformers = direction === 'into' ? [data] : selectedPerformers;

    const confirmMessage = direction === 'into'
      ? `Merge "${data.name}" INTO "${mainPerformer.name}"?\n\n` +
        `This will:\n` +
        `- Transfer all scenes from "${data.name}" to "${mainPerformer.name}"\n` +
        `- Combine aliases\n` +
        `- Delete "${data.name}"\n` +
        `- Update everything in Stash\n\n` +
        `This action cannot be undone.`
      : `Merge ${selectedPerformers.length} performer(s) INTO "${data.name}"?\n\n` +
        `This will:\n` +
        `- Transfer all scenes to "${data.name}"\n` +
        `- Combine aliases\n` +
        `- Delete: ${selectedPerformers.map(p => p.name).join(', ')}\n` +
        `- Update everything in Stash\n\n` +
        `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainPerformerId: mainPerformer.id,
          mergePerformerIds: mergePerformers.map(p => p.id)
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge performers');
      }

      alert(
        `✅ Successfully merged performer(s)!\n\n` +
        `Main performer: ${mainPerformer.name}\n` +
        `Scenes transferred: ${result.data.scenesTransferred || 0}\n` +
        `${result.data.stashSyncFailed ? '\n⚠️ Warning: Stash sync had issues. Check logs.' : ''}`
      );

      setShowMergeModal(false);

      // If we merged this performer into another, navigate to that performer
      if (direction === 'into') {
        navigate(`/media/stash/performers/${mainPerformer.id}`);
      } else {
        // If we merged others into this one, reload the current page
        window.location.reload();
      }

    } catch (error) {
      console.error('Failed to merge performers:', error);
      alert(`Failed to merge performers: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Fetch available stash-box scrapers
  useEffect(() => {
    const fetchAvailableScrapers = async () => {
      if (!id) return;
      
      try {
        const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/available-scrapers`);
        const result = await response.json();
        
        if (result.success && result.data.scrapers) {
          console.log('📦 Available stash-box scrapers:', result.data.scrapers);
          setAvailableScrapers(result.data.scrapers);
        }
      } catch (error) {
        console.error('Failed to fetch available scrapers:', error);
      }
    };
    
    fetchAvailableScrapers();
  }, [id]);

  // Handle stash-box scraper button click
  const handleStashBoxScraperClick = (scraper) => {
    console.log('📦 Opening stash-box search modal for:', scraper);
    setSelectedStashBoxScraper(scraper);
    setStashBoxSearchType('fragment');
    setStashBoxSearchQuery('');
    setShowStashBoxSearchModal(true);
  };

  // Handle native scraper button click (IAFD, etc.)
  const handleNativeScraperClick = async (scraper) => {
    console.log('🔍 Scraping with native scraper:', scraper);
    setShowScrapeModal(true);
    
    try {
      // Scrape with native scraper using performer name
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/scrape-native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scraperId: scraper.id,
          query: data?.name || ''
        })
      });
      
      const result = await response.json();
      console.log('🔍 Native scraper results:', result);
      
      if (result.success && result.data.results && result.data.results.length > 0) {
        // Check if this was auto-scraped from an existing URL
        if (result.data.autoScraped && result.data.results.length === 1) {
          console.log('✅ Auto-scraped from existing URL, applying directly');
          // Directly open review modal with the scraped data
          await handleSelectNativeScraperResult(result.data.results[0]);
          setShowScrapeModal(false);
          return;
        }
        
        // Show search results for manual selection
        setSearchResults({
          performers: result.data.results,
          isPerformerSearch: true,
          isStashBox: false,
          scraperId: scraper.id,
          source: scraper.name
        });
      } else {
        setShowScrapeModal(false);
        alert(`No results found from ${scraper.name}`);
      }
    } catch (error) {
      console.error('Native scraper failed:', error);
      alert(`Scraping failed: ${error.message}`);
      setShowScrapeModal(false);
    }
  };

  // Handle stash-box search
  const handleStashBoxSearch = async () => {
    if (!selectedStashBoxScraper) return;
    
    console.log('🔍 Searching stash-box:', {
      endpoint: selectedStashBoxScraper.endpoint,
      searchType: stashBoxSearchType,
      query: stashBoxSearchQuery
    });
    
    setShowStashBoxSearchModal(false);
    setShowScrapeModal(true);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/scrape-stashbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: selectedStashBoxScraper.endpoint,
          searchType: stashBoxSearchType === 'query' ? 'query' : null,
          query: stashBoxSearchType === 'query' ? (stashBoxSearchQuery || data?.name) : null
        })
      });
      
      const result = await response.json();
      console.log('📦 Stash-box search results:', result);
      
      if (result.success) {
        setSearchResults({
          performers: result.data.results,
          isPerformerSearch: true,
          isStashBox: true,
          searchType: result.data.searchType,
          source: 'stash-box'
        });
      }
    } catch (error) {
      console.error('Stash-box search failed:', error);
      alert(`Search failed: ${error.message}`);
      setShowScrapeModal(false);
    }
  };

  // Initialize all scraped fields as accepted by default
  const initializeAcceptedFields = (scrapedData) => {
    if (!scrapedData) return;
    
    const fields = {};
    Object.keys(scrapedData).forEach(key => {
      // Skip null/undefined values and arrays (like images, tags which have separate UI)
      if (scrapedData[key] !== null && scrapedData[key] !== undefined && !Array.isArray(scrapedData[key])) {
        fields[key] = true;
      }
    });
    
    setAcceptedFields(fields);
  };

  // Handle selecting a stash-box result
  const handleSelectStashBoxResult = async (performer) => {
    console.log('📦 Selected stash-box performer:', performer);
    
    setSearchResults(null);
    setSelectedImage(null); // Reset selected image
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/scrape-stashbox-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scraped: performer })
      });
      
      const result = await response.json();
      console.log('📦 Processed stash-box result:', result);
      
      if (result.success) {
        setScrapeData(result.data);
        // Initialize all fields as accepted by default
        initializeAcceptedFields(result.data.scraped);
        // Auto-select first image if available
        if (result.data?.scraped?.images && result.data.scraped.images.length > 0) {
          setSelectedImage(result.data.scraped.images[0]);
        }
        setShowScrapeReviewModal(true);
      }
    } catch (error) {
      console.error('Failed to process stash-box result:', error);
      alert(`Failed to process result: ${error.message}`);
    }
  };

  // Handle selecting a native scraper result
  const handleSelectNativeScraperResult = async (performer, scraperId) => {
    console.log('🔍 Selected native scraper performer:', performer);
    
    setSearchResults(null);
    setSelectedImage(null); // Reset selected image
    setShowScrapeModal(false);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/scrape-native-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scraped: performer,
          scraperId: scraperId 
        })
      });
      
      const result = await response.json();
      console.log('🔍 Processed native scraper result:', result);
      
      if (result.success) {
        setScrapeData(result.data);
        // Initialize all fields as accepted by default
        initializeAcceptedFields(result.data.scraped);
        // Auto-select first image if available
        if (result.data?.scraped?.images && result.data.scraped.images.length > 0) {
          setSelectedImage(result.data.scraped.images[0]);
        }
        setShowScrapeReviewModal(true);
      }
    } catch (error) {
      console.error('Failed to process native scraper result:', error);
      alert(`Failed to process result: ${error.message}`);
    }
  };

  // Handle GEVI search button click
  const handleGeviSearch = async () => {
    console.log('🔍 [GEVI] Starting search for performer:', data?.name);
    setIsSearchingGevi(true);
    setSearchResults(null);
    setSelectedImage(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/search-gevi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        // Check if this was auto-scraped from an existing URL
        if (result.data.autoScraped && result.data.scraped) {
          console.log('✅ Auto-scraped from existing GEVI URL, showing review modal');
          // Directly show the review modal with scraped data
          setScrapeData(result.data);
          initializeAcceptedFields(result.data.scraped);
          setShowScrapeReviewModal(true);
          setIsSearchingGevi(false);
          return;
        }
        
        // Show search results for manual selection
        console.log(`   - Found ${result.data.results.length} GEVI performers`);
        
        const formattedResults = result.data.results.map(p => ({
          name: p.name,
          url: p.url,
        }));
        
        setSearchResults({
          performers: formattedResults,
          source: 'GEVI',
          isGevi: true
        });
        setShowScrapeModal(true);
      } else {
        alert(`Failed to search GEVI: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('GEVI search failed:', error);
      alert('Failed to search GEVI');
    } finally {
      setIsSearchingGevi(false);
    }
  };

  // Handle selecting a GEVI performer from search results
  const handleSelectGeviPerformer = async (geviPerformer) => {
    console.log('👤 [GEVI] Selected performer:', geviPerformer);
    
    setSearchResults(null);
    setShowScrapeModal(false);
    setSelectedImage(null); // Reset selected image
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/scrape-gevi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: geviPerformer.url })
      });
      
      const result = await response.json();
      console.log('👤 [GEVI] Scraped performer data:', result);
      
      if (result.success) {
        setScrapeData(result.data);
        // Initialize all fields as accepted by default
        initializeAcceptedFields(result.data.scraped);
        // Auto-select first image if available
        if (result.data?.scraped?.image) {
          setSelectedImage(result.data.scraped.displayImage || result.data.scraped.image);
        }
        setShowScrapeReviewModal(true);
      } else {
        alert(`Failed to scrape GEVI: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('GEVI scrape failed:', error);
      alert('Failed to scrape GEVI');
    }
  };

  // Apply scraped performer data
  const handleApplyScrape = async () => {
    if (!scrapeData?.scraped) return;
    
    setIsApplyingScrape(true);
    
    try {
      // Build update payload from scraped data, respecting accepted fields
      const updateData = {};
      
      // Helper to check if a field is accepted
      const isAccepted = (fieldName) => acceptedFields[fieldName] !== false;
      
      // Only include fields that have values AND are accepted
      if (scrapeData.scraped.name && isAccepted('name')) updateData.name = scrapeData.scraped.name;
      if (scrapeData.scraped.disambiguation && isAccepted('disambiguation')) updateData.disambiguation = scrapeData.scraped.disambiguation;
      if (scrapeData.scraped.aliases && isAccepted('aliases')) {
        updateData.alias = Array.isArray(scrapeData.scraped.aliases) 
          ? scrapeData.scraped.aliases.join(', ') 
          : scrapeData.scraped.aliases;
      }
      if (scrapeData.scraped.gender && isAccepted('gender')) updateData.gender = scrapeData.scraped.gender;
      if (scrapeData.scraped.birthdate && isAccepted('birthdate')) updateData.birthdate = scrapeData.scraped.birthdate;
      if (scrapeData.scraped.death_date && isAccepted('death_date')) updateData.death_date = scrapeData.scraped.death_date;
      if (scrapeData.scraped.country && isAccepted('country')) updateData.country = scrapeData.scraped.country;
      if (scrapeData.scraped.eye_color && isAccepted('eye_color')) updateData.eye_color = scrapeData.scraped.eye_color;
      if (scrapeData.scraped.hair_color && isAccepted('hair_color')) updateData.hair_color = scrapeData.scraped.hair_color;
      if (scrapeData.scraped.height && isAccepted('height')) updateData.height = scrapeData.scraped.height;
      if (scrapeData.scraped.weight && isAccepted('weight')) updateData.weight = scrapeData.scraped.weight;
      if (scrapeData.scraped.measurements && isAccepted('measurements')) updateData.measurements = scrapeData.scraped.measurements;
      if (scrapeData.scraped.fake_tits && isAccepted('fake_tits')) updateData.fake_tits = scrapeData.scraped.fake_tits;
      if (scrapeData.scraped.penis_length && isAccepted('penis_length')) updateData.penis_length = scrapeData.scraped.penis_length;
      if (scrapeData.scraped.circumcised && isAccepted('circumcised')) updateData.circumcised = scrapeData.scraped.circumcised;
      if (scrapeData.scraped.career_length && isAccepted('career_length')) updateData.career_length = scrapeData.scraped.career_length;
      if (scrapeData.scraped.tattoos && isAccepted('tattoos')) updateData.tattoos = scrapeData.scraped.tattoos;
      if (scrapeData.scraped.piercings && isAccepted('piercings')) updateData.piercings = scrapeData.scraped.piercings;
      if (scrapeData.scraped.details && isAccepted('details')) updateData.details = scrapeData.scraped.details;
      if (scrapeData.scraped.url && isAccepted('url')) updateData.url = scrapeData.scraped.url;
      if (scrapeData.scraped.twitter && isAccepted('twitter')) updateData.twitter = scrapeData.scraped.twitter;
      if (scrapeData.scraped.instagram && isAccepted('instagram')) updateData.instagram = scrapeData.scraped.instagram;
      
      // Add URLs array (from GEVI or other scrapers that provide multiple URLs)
      if (scrapeData.scraped.urls && Array.isArray(scrapeData.scraped.urls) && isAccepted('urls')) {
        updateData.newUrls = scrapeData.scraped.urls;
      }
      
      // Add selected image if one was chosen
      // Note: selectedImage can be null (No Image option), a URL from single image, or a URL from images array
      if (selectedImage) {
        updateData.image = selectedImage;
      }
      
      // Add matched tags
      if (scrapeData.matched?.tags?.length > 0) {
        updateData.tagIds = scrapeData.matched.tags.map(t => t.id);
      }
      
      // Add unmatched tags (to be created)
      if (scrapeData.unmatched?.tags?.length > 0) {
        updateData.unmatchedTags = scrapeData.unmatched.tags;
      }
      
      console.log('📤 Applying scraped data:', updateData);
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const result = await response.json();
      
      // Check for name conflict (HTTP 409)
      if (response.status === 409 && result.conflict) {
        console.log('⚠️ Name conflict detected:', result);
        setConflictData(result);
        setPendingScrapeData(updateData);
        setShowConflictModal(true);
        setIsApplyingScrape(false);
        return;
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to apply scraped data');
      }
      
      setShowScrapeReviewModal(false);
      setScrapeData(null);
      setSelectedImage(null);
      setAcceptedFields({});
      
      // Reload performer data to show updated information
      await fetchPerformer();
      
    } catch (error) {
      console.error('Failed to apply scraped data:', error);
      alert(`Failed to apply scraped data: ${error.message}`);
    } finally {
      setIsApplyingScrape(false);
    }
  };

  // Handle merging current performer into existing one
  const handleMergeIntoExisting = async () => {
    if (!conflictData || !pendingScrapeData) return;

    try {
      setIsApplyingScrape(true);
      console.log('🔄 Merging current performer into existing:', conflictData.existingPerformer.id);

      // Merge current performer into existing one
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainPerformerId: conflictData.existingPerformer.id,
          mergePerformerIds: [id]
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge performers');
      }

      console.log('✅ Merge successful, redirecting to existing performer');
      // Redirect to the existing performer page
      navigate(`/media/stash/performers/${conflictData.existingPerformer.id}`);

    } catch (error) {
      console.error('Failed to merge performers:', error);
      alert(`Failed to merge performers: ${error.message}`);
      setIsApplyingScrape(false);
    }
  };

  // Handle merging existing performer into current one
  const handleMergeFromExisting = async () => {
    if (!conflictData || !pendingScrapeData) return;

    try {
      setIsApplyingScrape(true);
      console.log('🔄 Merging existing performer into current:', id);

      // First merge existing into current
      const mergeResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainPerformerId: id,
          mergePerformerIds: [conflictData.existingPerformer.id]
        })
      });

      const mergeResult = await mergeResponse.json();

      if (!mergeResult.success) {
        throw new Error(mergeResult.error || 'Failed to merge performers');
      }

      console.log('✅ Merge successful, now applying scraped data');

      // Now apply the scraped data
      const updateResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingScrapeData)
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to apply scraped data after merge');
      }

      console.log('✅ Update successful, reloading page');
      window.location.reload();

    } catch (error) {
      console.error('Failed to merge and update performer:', error);
      alert(`Failed to merge and update performer: ${error.message}`);
      setIsApplyingScrape(false);
    }
  };

  // Handle adding disambiguation to current performer
  const handleAddDisambiguation = async () => {
    if (!conflictData || !pendingScrapeData) return;

    const disambiguation = prompt('Enter disambiguation text (e.g., "II", "Performer", etc.):');
    
    if (!disambiguation || disambiguation.trim() === '') {
      alert('Disambiguation is required');
      return;
    }

    try {
      setIsApplyingScrape(true);
      console.log('🏷️ Adding disambiguation:', disambiguation);

      // Add disambiguation to the pending data
      const updatedData = {
        ...pendingScrapeData,
        disambiguation: disambiguation.trim()
      };

      // Apply the scraped data with disambiguation
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      const result = await response.json();

      // Check for conflict again (shouldn't happen, but just in case)
      if (response.status === 409 && result.conflict) {
        alert('Disambiguation did not resolve the conflict. Please try a different value.');
        setIsApplyingScrape(false);
        return;
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to apply scraped data with disambiguation');
      }

      console.log('✅ Update with disambiguation successful');
      
      setShowConflictModal(false);
      setConflictData(null);
      setPendingScrapeData(null);
      setShowScrapeReviewModal(false);
      setScrapeData(null);
      setSelectedImage(null);
      setAcceptedFields({});
      
      // Reload page to show updated data
      window.location.reload();

    } catch (error) {
      console.error('Failed to add disambiguation:', error);
      alert(`Failed to add disambiguation: ${error.message}`);
      setIsApplyingScrape(false);
    }
  };

  // Handle scene checkbox toggle
  const handleToggleScene = (sceneId) => {
    setSelectedScenes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sceneId)) {
        newSet.delete(sceneId);
      } else {
        newSet.add(sceneId);
      }
      return newSet;
    });
  };

  // Handle opening scene merge modal
  const handleOpenSceneMergeModal = async () => {
    if (selectedScenes.size < 2) {
      alert('Please select at least 2 scenes to merge');
      return;
    }

    try {
      // Fetch full details for selected scenes
      const sceneIds = Array.from(selectedScenes);
      const scenePromises = sceneIds.map(id =>
        fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`).then(r => r.json())
      );
      
      const sceneResults = await Promise.all(scenePromises);
      const scenes = sceneResults.map(r => r.data);
      
      console.log('🔍 Scenes loaded for merge:', scenes);
      console.log('🔗 URLs per scene:', scenes.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        geviUrl: s.geviUrl,
        episodeUrls: s.episodeUrls
      })));
      
      setScenesToMerge(scenes);
      
      // Collect all unique groups/movies from all scenes
      const allGroups = [];
      const groupIds = new Set();
      scenes.forEach(scene => {
        if (scene.groups && Array.isArray(scene.groups)) {
          scene.groups.forEach(g => {
            if (!groupIds.has(g.group.id)) {
              groupIds.add(g.group.id);
              allGroups.push({
                id: g.group.id,
                name: g.group.name,
                sceneIndex: g.sceneIndex
              });
            }
          });
        }
      });
      
      // Initialize merge data with first scene's data as default
      setMergeSceneData({
        title: scenes[0].title || '',
        date: scenes[0].date || '',
        details: scenes[0].details || '',
        url: scenes[0].url || '',
        stashId: scenes[0].stashId || '',
        studio: scenes[0].studio || null,
        performers: scenes[0].performers || [],
        tags: scenes[0].tags || [],
        groups: allGroups, // Include all groups from all scenes
        episodeUrls: scenes[0].episodeUrls || [],
        geviUrl: scenes[0].geviUrl || '',
        // File information - which file to keep
        keepFileFromSceneId: scenes[0].id,
        // Keep track of which scene is the primary
        primarySceneId: scenes[0].id
      });
      
      setShowSceneMergeModal(true);
    } catch (error) {
      console.error('Failed to load scene details:', error);
      alert(`Failed to load scene details: ${error.message}`);
    }
  };

  // Handle updating merge data field
  const handleUpdateMergeField = (field, value) => {
    setMergeSceneData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle scene merge execution
  const handleMergeScenes = async () => {
    if (!mergeSceneData || !mergeSceneData.primarySceneId) {
      alert('Please select a primary scene');
      return;
    }

    if (!mergeSceneData.keepFileFromSceneId) {
      alert('Please select which file to keep');
      return;
    }

    const primarySceneTitle = scenesToMerge.find(s => s.id === mergeSceneData.primarySceneId)?.title;
    const keepFileSceneTitle = scenesToMerge.find(s => s.id === mergeSceneData.keepFileFromSceneId)?.title;
    const otherScenes = scenesToMerge.filter(s => s.id !== mergeSceneData.primarySceneId);
    const deletedFileScenes = scenesToMerge.filter(s => s.id !== mergeSceneData.keepFileFromSceneId);
    
    const confirmMessage = 
      `Merge ${scenesToMerge.length} scenes?\n\n` +
      `Primary scene (ID kept): ${primarySceneTitle}\n` +
      `File kept from: ${keepFileSceneTitle}\n` +
      `Scenes to delete: ${otherScenes.map(s => s.title).join(', ')}\n\n` +
      `⚠️ WARNING: Video files will be PERMANENTLY DELETED from disk!\n` +
      `Files to delete: ${deletedFileScenes.filter(s => s.id !== mergeSceneData.primarySceneId).map(s => s.title).join(', ')}\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMergingScenes(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primarySceneId: mergeSceneData.primarySceneId,
          mergeSceneIds: scenesToMerge.filter(s => s.id !== mergeSceneData.primarySceneId).map(s => s.id),
          mergedData: mergeSceneData
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge scenes');
      }

      alert('✅ Successfully merged scenes!');
      
      setShowSceneMergeModal(false);
      setSelectedScenes(new Set());
      
      // Reload to show updated scene list
      window.location.reload();

    } catch (error) {
      console.error('Failed to merge scenes:', error);
      alert(`Failed to merge scenes: ${error.message}`);
    } finally {
      setIsMergingScenes(false);
    }
  };

  if (loading) {
    return (
      <div className="page pad performer-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading performer details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="page pad performer-detail">
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <Link to="/media/stash" className="btn">← Back to Stash</Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="page pad performer-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link>
        <span> → </span>
        <span>{data.name}</span>
      </div>

      {/* Hero Section with Image */}
      <div className="performer-detail-hero">
        <div className="performer-hero-image-container">
          {data.image ? (
            <img
              src={data.image}
              alt={data.name}
              className="performer-full-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="performer-placeholder-large">
              👤
            </div>
          )}
        </div>
        
        <div className="performer-hero-info">
          <div className="performer-header-row">
            <h1 className="scene-title">
              👤 {data.name}
              {!isEditing && (
                <>
                  <button 
                    className="edit-performer-btn"
                    onClick={handleEditClick}
                    title="Edit performer details"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-performer-btn"
                    onClick={handleDeletePerformer}
                    title="Delete performer from database and Stash"
                  >
                    🗑️
                  </button>
                  <button 
                    className="sync-performer-btn"
                    onClick={handleSyncFromStash}
                    title="Sync latest data from Stash"
                  >
                    🔄
                  </button>
                  <button 
                    className="merge-performer-btn merge-into-btn"
                    onClick={() => handleOpenMergeModal('into')}
                    title="Merge this performer into another performer"
                    style={{ 
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: '2px solid #f59e0b',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>⬆️</span>
                    <span>Merge Into</span>
                  </button>
                  <button 
                    className="merge-performer-btn merge-from-btn"
                    onClick={() => handleOpenMergeModal('from')}
                    title="Merge other performers into this one"
                    style={{ 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: '2px solid #10b981',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>⬇️</span>
                    <span>Merge From</span>
                  </button>
                  
                  {/* Stash-box scraper buttons */}
                  {availableScrapers.filter(s => s.isStashBox).map((scraper, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStashBoxScraperClick(scraper)}
                      title={`Scrape from ${scraper.name}`}
                      style={{
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        border: '2px solid #06b6d4',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(6, 182, 212, 0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(6, 182, 212, 0.3)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(6, 182, 212, 0.2)';
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>📦</span>
                      <span>{scraper.name}</span>
                    </button>
                  ))}
                  
                  {/* Native scraper buttons (IAFD) */}
                  {availableScrapers.filter(s => !s.isStashBox && s.performer?.supported).map((scraper, idx) => (
                    <button
                      key={`native-${idx}`}
                      onClick={() => handleNativeScraperClick(scraper)}
                      title={`Scrape from ${scraper.name}`}
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        border: '2px solid #8b5cf6',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.3)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.2)';
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>🔍</span>
                      <span>{scraper.name}</span>
                    </button>
                  ))}
                  
                  {/* GEVI scraper button (always available) */}
                  <button
                    onClick={handleGeviSearch}
                    disabled={isSearchingGevi}
                    title="Search Gay Erotic Video Index (GEVI)"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: '2px solid #f59e0b',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isSearchingGevi ? 'wait' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: isSearchingGevi ? 0.7 : 1
                    }}
                    onMouseOver={(e) => {
                      if (!isSearchingGevi) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>🎬</span>
                    <span>{isSearchingGevi ? 'Searching...' : 'GEVI'}</span>
                  </button>
                  
                  {stashUrl && (
                    <a 
                      href={`${stashUrl}/performers/${data.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="view-stash-btn"
                      title="View this performer in Stash"
                    >
                      📊
                    </a>
                  )}
                  {!stashUrl && (
                    <span style={{color: '#999', fontSize: '0.8em', marginLeft: '1rem'}}>
                      (Stash not connected)
                    </span>
                  )}
                </>
              )}
            </h1>
            <div className="performer-header-meta">
              {data.country && (
                <span className="country-badge">
                  🌍 {data.country}
                </span>
              )}
              {/* Social Links - Inline */}
              {data.url && (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🔗
                </a>
              )}
              {data.instagram && (
                <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  📷
                </a>
              )}
              {data.twitter && (
                <a href={data.twitter} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🐦
                </a>
              )}
            </div>

            {/* URLs Section */}
            {data.urls && data.urls.length > 0 && (
              <div className="performer-urls-section">
                <h4 
                  className="urls-title" 
                  onClick={() => setIsUrlsCollapsed(!isUrlsCollapsed)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isUrlsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                    ▼
                  </span>
                  {' '}🔗 URLs
                </h4>
                {!isUrlsCollapsed && (
                  <div className="urls-list">
                    {data.urls.map((url, index) => (
                      <a 
                        key={index}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="url-link"
                        title={url}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Edit Form */}
          {isEditing && (
            <div className="performer-edit-form">
              <h3>✏️ Edit Performer Details</h3>
              <div className="edit-form-grid">
                <div className="form-group">
                  <label htmlFor="edit-name">Name *</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Performer name"
                    disabled={isSaving}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-alias">Alias</label>
                  <input
                    id="edit-alias"
                    type="text"
                    value={editData.alias}
                    onChange={(e) => setEditData({ ...editData, alias: e.target.value })}
                    placeholder="Also known as..."
                    disabled={isSaving}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-disambiguation">Disambiguation</label>
                  <input
                    id="edit-disambiguation"
                    type="text"
                    value={editData.disambiguation}
                    onChange={(e) => setEditData({ ...editData, disambiguation: e.target.value })}
                    placeholder="e.g., (II), (Performer)"
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              {/* New URLs Section */}
              <div className="edit-form-section">
                <div className="section-header">
                  <h4>Add New URLs</h4>
                  <button 
                    type="button"
                    className="btn-add-url"
                    onClick={handleAddUrlField}
                    disabled={isSaving}
                    title="Add another URL field"
                  >
                    ➕ Add URL
                  </button>
                </div>
                
                <div className="url-fields-container">
                  {editData.newUrls.map((url, index) => (
                    <div key={index} className="url-field-row">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://... (website, social media, etc.)"
                        disabled={isSaving}
                        className="url-input"
                      />
                      {editData.newUrls.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-url"
                          onClick={() => handleRemoveUrlField(index)}
                          disabled={isSaving}
                          title="Remove this URL"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="url-help-text">
                  ℹ️ New URLs will be added to the performer's existing URLs in Stash
                </p>
              </div>
              
              <div className="edit-form-actions">
                <button 
                  className="btn-save"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Changes'}
                </button>
                <button 
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  ❌ Cancel
                </button>
              </div>
              
              <p className="edit-form-note">
                ℹ️ Changes will be saved to both the local database and Stash
              </p>
            </div>
          )}
          
          {data.alias && (
            <p className="performer-alias">
              Also known as: <span>{data.alias}</span>
            </p>
          )}
          
          {data.disambiguation && (
            <p className="performer-disambiguation">
              <span className="disambiguation-badge">{data.disambiguation}</span>
            </p>
          )}

          {/* Physical Attributes - Moved here */}
          <div className="performer-physical-attributes-inline">
            <h4 className="section-subtitle">📏 Physical Attributes</h4>
            <div className="attributes-compact">
              {data.height && (
                <span className="attribute-item">
                  <strong>Height:</strong> {formatHeight(data.height) || data.height}
                </span>
              )}
              {data.weight && (
                <span className="attribute-item">
                  <strong>Weight:</strong> {formatWeight(data.weight) || data.weight}
                </span>
              )}
              {data.penis_length && (
                <span className="attribute-item">
                  <strong>Penis Length:</strong> {formatPenisLength(data.penis_length) || data.penis_length}
                </span>
              )}
              {data.circumcised && (
                <span className="attribute-item">
                  <strong>Circumcised:</strong> {data.circumcised}
                </span>
              )}
              {data.measurements && (
                <span className="attribute-item">
                  <strong>Measurements:</strong> {data.measurements}
                </span>
              )}
              {data.eye_color && (
                <span className="attribute-item">
                  <strong>Eyes:</strong> {data.eye_color}
                </span>
              )}
              {data.hair_color && (
                <span className="attribute-item">
                  <strong>Hair:</strong> {data.hair_color}
                </span>
              )}
              {data.ethnicityTag && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong>{' '}
                  <Link to={`/media/stash/tags/${data.ethnicityTag.id}`} className="tag-link-inline">
                    {data.ethnicityTag.name}
                  </Link>
                </span>
              )}
              {!data.ethnicityTag && data.ethnicity && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong> {data.ethnicity}
                </span>
              )}
              {data.tattoos && (
                <span className="attribute-item">
                  <strong>Tattoos:</strong> {data.tattoos}
                </span>
              )}
              {data.piercings && (
                <span className="attribute-item">
                  <strong>Piercings:</strong> {data.piercings}
                </span>
              )}
              {data.career_length && (
                <span className="attribute-item">
                  <strong>Career:</strong> {data.career_length}
                </span>
              )}
            </div>
          </div>
          
          <div className="scene-meta-badges">
            {data.birthdate && (
              <div className="meta-badge">
                <span className="badge-icon">🎂</span>
                <span>{data.birthdate}</span>
              </div>
            )}
            {data.rating && (
              <div className="meta-badge rating">
                <span className="badge-icon">⭐</span>
                <span>{data.rating}/100</span>
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

        {/* Tags Section - Merged from performer and scene-specific */}
        <div className="card">
          <h3>🏷️ All Tags ({mergedTags.length})</h3>
          <p className="text-sm text-gray-600 mb-3">
            Tags applied to this performer (general) or in specific scenes
          </p>
          {mergedTags.length > 0 ? (
            <div className="tags-grid-detailed">
              {mergedTags.map(tag => (
                <div key={tag.id} className="tag-detail-item">
                  <Link
                    to={`/media/stash/tags/${tag.id}`}
                    className="tag-chip-detailed"
                  >
                    <span className="tag-name">{tag.name}</span>
                    {tag.isGeneral && tag.sceneCount > 0 && (
                      <span className="tag-badge general-and-scene">
                        General + {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {tag.isGeneral && tag.sceneCount === 0 && (
                      <span className="tag-badge general-only">
                        General
                      </span>
                    )}
                    {!tag.isGeneral && (
                      <span className="tag-badge scene-only">
                        {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </Link>
                  {tag.scenes.length > 0 && (
                    <div className="tag-scenes-list">
                      {tag.scenes.slice(0, 3).map(scene => (
                        <Link
                          key={scene.id}
                          to={`/media/stash/scenes/${scene.id}`}
                          className="tag-scene-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🎬 {scene.title || 'Untitled'}
                        </Link>
                      ))}
                      {tag.scenes.length > 3 && (
                        <span className="more-scenes">
                          +{tag.scenes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No tags found for this performer.
            </div>
          )}
        </div>

        {/* Scenes Section */}
        {data.scenes && data.scenes.length > 0 && (
          <div className="card full-width">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>🎬 Recent Scenes ({data.scenes.length})</h3>
              {selectedScenes.size >= 2 && (
                <button
                  onClick={handleOpenSceneMergeModal}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: '2px solid #8b5cf6',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.2)';
                  }}
                >
                  🔀 Merge {selectedScenes.size} Scenes
                </button>
              )}
            </div>
            <div className="scenes-list">
              {data.scenes.map(scene => (
                <div
                  key={scene.id}
                  className="scene-list-item"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: selectedScenes.has(scene.id) ? '#f3f4f6' : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedScenes.has(scene.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleScene(scene.id);
                    }}
                    style={{
                      marginTop: '4px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  <div
                    className="scene-list-info clickable"
                    onClick={() => navigate(`/media/stash/scenes/${scene.id}`)}
                    style={{ flex: 1 }}
                  >
                    <div className="scene-list-title">
                      {scene.title || 'Untitled Scene'}
                    </div>
                    <div className="scene-list-meta">
                      {scene.date && <span>📅 {scene.date}</span>}
                      {scene.studio && (
                        <span>
                          🏢 {typeof scene.studio === 'string' ? scene.studio : scene.studio?.name}
                        </span>
                      )}
                    </div>
                    {/* Scene-specific performer tags */}
                    {scene.performerTags && scene.performerTags.length > 0 && (
                      <div className="scene-performer-tags">
                        <span className="tags-label">Tags in this scene:</span>
                        {scene.performerTags.map(tag => (
                          <Link
                            key={tag.id}
                            to={`/media/stash/tags/${tag.id}`}
                            className="mini-tag-chip"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tag.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Merge Performers Modal */}
      {showMergeModal && (
        <div className="modal-overlay" onClick={() => !isMerging && setShowMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>
              {mergeDirection === 'into' 
                ? `⬆️ Merge "${data.name}" Into Another Performer` 
                : `⬇️ Merge Other Performers Into "${data.name}"`}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                {mergeDirection === 'into' 
                  ? `Search for a performer to merge "${data.name}" into. The selected performer will keep all scenes and data.`
                  : `Search for performers to merge into "${data.name}". This performer will keep all scenes and data.`}
              </p>

              {/* Search Input */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchPerformers(e.target.value);
                  }}
                  placeholder="Search performers by name..."
                  disabled={isMerging}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div className="spinner" style={{ display: 'inline-block', marginBottom: '0.5rem' }}></div>
                  <p>Searching...</p>
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && mergeSearchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No performers found
                </div>
              )}

              {!isSearching && mergeSearchResults.length > 0 && (
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '6px',
                  marginBottom: '1rem'
                }}>
                  {mergeSearchResults.map((performer) => {
                    const isSelected = selectedPerformers.find(p => p.id === performer.id);
                    const canSelectMore = mergeDirection === 'from' || selectedPerformers.length === 0;
                    
                    return (
                      <div
                        key={performer.id}
                        onClick={() => {
                          if (mergeDirection === 'into' && selectedPerformers.length > 0 && !isSelected) {
                            // For 'into', only allow one selection
                            setSelectedPerformers([performer]);
                          } else {
                            handleTogglePerformer(performer);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: (canSelectMore || isSelected) ? 'pointer' : 'not-allowed',
                          background: isSelected ? '#dbeafe' : 'white',
                          opacity: (!canSelectMore && !isSelected) ? 0.5 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ marginRight: '12px', cursor: 'pointer' }}
                        />
                        {performer.image && (
                          <img
                            src={performer.image}
                            alt={performer.name}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              marginRight: '12px'
                            }}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', fontSize: '14px' }}>{performer.name}</div>
                          {performer.alias && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Aliases: {performer.alias}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {performer.scene_count || 0} scenes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Performers Summary */}
              {selectedPerformers.length > 0 && (
                <div style={{ 
                  padding: '12px', 
                  background: '#f3f4f6', 
                  borderRadius: '6px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>
                    {mergeDirection === 'into' 
                      ? 'Selected Target Performer:' 
                      : `Selected Performers to Merge (${selectedPerformers.length}):`}
                  </div>
                  {selectedPerformers.map(p => (
                    <div key={p.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '4px 0',
                      fontSize: '13px'
                    }}>
                      <span style={{ marginRight: '8px' }}>•</span>
                      <span>{p.name}</span>
                      {p.scene_count && (
                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                          ({p.scene_count} scenes)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mergeDirection === 'into' && selectedPerformers.length > 0 && (
                <div style={{ 
                  padding: '12px', 
                  background: '#fef3c7', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#92400e'
                }}>
                  ⚠️ Warning: "{data.name}" will be deleted after merging into "{selectedPerformers[0].name}"
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergePerformers}
                disabled={isMerging || selectedPerformers.length === 0}
              >
                {isMerging ? '⏳ Merging...' : `🔀 Merge Performer${selectedPerformers.length > 1 ? 's' : ''}`}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Scenes Modal */}
      {showSceneMergeModal && (
        <div className="modal-overlay" onClick={() => !isMergingScenes && setShowSceneMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>🔀 Merge {scenesToMerge.length} Scenes</h3>
            
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
              Select which data to keep for the merged scene. The primary scene will be kept, others will be deleted.
            </p>

            {/* Primary Scene Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                Primary Scene (will be kept):
              </label>
              <select
                value={mergeSceneData?.primarySceneId || ''}
                onChange={(e) => handleUpdateMergeField('primarySceneId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {scenesToMerge.map(scene => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title || 'Untitled Scene'} {scene.date ? `(${scene.date})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Selection Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Title:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.title === scene.title ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="title"
                        checked={mergeSceneData?.title === scene.title}
                        onChange={() => handleUpdateMergeField('title', scene.title)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ flex: 1, fontSize: '14px' }}>
                        {scene.title || <em style={{ color: '#9ca3af' }}>No title</em>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Date:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.date === scene.date ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="date"
                        checked={mergeSceneData?.date === scene.date}
                        onChange={() => handleUpdateMergeField('date', scene.date)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '14px' }}>
                        {scene.date || <em style={{ color: '#9ca3af' }}>No date</em>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Details:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.details === scene.details ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="details"
                        checked={mergeSceneData?.details === scene.details}
                        onChange={() => handleUpdateMergeField('details', scene.details)}
                        style={{ marginRight: '8px', marginTop: '4px' }}
                      />
                      <span style={{ flex: 1, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                        {scene.details ? (
                          scene.details.length > 100 
                            ? scene.details.substring(0, 100) + '...' 
                            : scene.details
                        ) : (
                          <em style={{ color: '#9ca3af' }}>No details</em>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Studio */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Studio:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => {
                    const studioName = typeof scene.studio === 'string' ? scene.studio : scene.studio?.name;
                    return (
                      <label
                        key={scene.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: mergeSceneData?.studio === scene.studio ? '#dbeafe' : 'white'
                        }}
                      >
                        <input
                          type="radio"
                          name="studio"
                          checked={mergeSceneData?.studio === scene.studio}
                          onChange={() => handleUpdateMergeField('studio', scene.studio)}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={{ fontSize: '14px' }}>
                          {studioName || <em style={{ color: '#9ca3af' }}>No studio</em>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* File Information - Select which file to keep */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                  ⚠️ File to Keep (others will be deleted from Stash):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => {
                    const formatFileSize = (bytes) => {
                      if (!bytes) return 'Unknown size';
                      const gb = bytes / (1024 * 1024 * 1024);
                      if (gb >= 1) return `${gb.toFixed(2)} GB`;
                      const mb = bytes / (1024 * 1024);
                      return `${mb.toFixed(2)} MB`;
                    };

                    const formatResolution = (width, height) => {
                      if (!width || !height) return 'Unknown resolution';
                      // Common resolution names
                      if (height >= 2160) return `${width}x${height} (4K)`;
                      if (height >= 1080) return `${width}x${height} (1080p)`;
                      if (height >= 720) return `${width}x${height} (720p)`;
                      if (height >= 480) return `${width}x${height} (480p)`;
                      return `${width}x${height}`;
                    };

                    const fileSize = formatFileSize(scene.fileSize);
                    const resolution = formatResolution(scene.width, scene.height);
                    const filePath = scene.path || 'Unknown path';
                    const fileName = filePath.split(/[/\\]/).pop();

                    return (
                      <label
                        key={scene.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '12px',
                          border: '2px solid',
                          borderColor: mergeSceneData?.keepFileFromSceneId === scene.id ? '#3b82f6' : '#d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: mergeSceneData?.keepFileFromSceneId === scene.id ? '#dbeafe' : 'white',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <input
                            type="radio"
                            name="keepFile"
                            checked={mergeSceneData?.keepFileFromSceneId === scene.id}
                            onChange={() => handleUpdateMergeField('keepFileFromSceneId', scene.id)}
                            style={{ marginRight: '12px', marginTop: '4px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', color: '#111827' }}>
                              {scene.title || 'Untitled Scene'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-all', marginBottom: '8px' }}>
                              📁 {fileName}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ fontWeight: '500', color: '#374151' }}>📏 Size:</span>{' '}
                                <span style={{ color: '#6b7280' }}>{fileSize}</span>
                              </div>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ fontWeight: '500', color: '#374151' }}>🎬 Resolution:</span>{' '}
                                <span style={{ color: '#6b7280' }}>{resolution}</span>
                              </div>
                              {scene.duration && (
                                <div style={{ fontSize: '13px' }}>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>⏱️ Duration:</span>{' '}
                                  <span style={{ color: '#6b7280' }}>{Math.floor(scene.duration / 60)}:{String(Math.floor(scene.duration % 60)).padStart(2, '0')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {mergeSceneData?.keepFileFromSceneId === scene.id && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#3b82f6', 
                            fontWeight: '500',
                            marginTop: '4px',
                            paddingLeft: '28px'
                          }}>
                            ✓ This file will be kept
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', fontStyle: 'italic' }}>
                  ⚠️ Warning: Video files from unselected scenes will be permanently deleted from disk!
                </p>
              </div>

              {/* Tags - Combine all unique tags */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Tags (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    const allTags = new Map();
                    scenesToMerge.forEach(scene => {
                      if (scene.tags) {
                        scene.tags.forEach(tag => {
                          allTags.set(tag.id, tag);
                        });
                      }
                    });
                    return Array.from(allTags.values()).map(tag => (
                      <span
                        key={tag.id}
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          margin: '2px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        {tag.name}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Performers - Combine all unique performers */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Performers (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    const allPerformers = new Map();
                    scenesToMerge.forEach(scene => {
                      if (scene.performers) {
                        scene.performers.forEach(performer => {
                          allPerformers.set(performer.id, performer);
                        });
                      }
                    });
                    return Array.from(allPerformers.values()).map(performer => (
                      <span
                        key={performer.id}
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          margin: '2px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        {performer.name}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Groups/Movies - Combine all unique groups */}
              {(() => {
                const allGroups = new Map();
                scenesToMerge.forEach(scene => {
                  if (scene.groups && Array.isArray(scene.groups)) {
                    scene.groups.forEach(g => {
                      if (!allGroups.has(g.group.id)) {
                        allGroups.set(g.group.id, {
                          id: g.group.id,
                          name: g.group.name,
                          sceneIndex: g.sceneIndex
                        });
                      }
                    });
                  }
                });
                
                if (allGroups.size > 0) {
                  return (
                    <div>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                        Movies/Compilations (all will be combined):
                      </label>
                      <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                        {Array.from(allGroups.values()).map(group => (
                          <span
                            key={group.id}
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              margin: '2px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            🎬 {group.name}{group.sceneIndex ? ` (#${group.sceneIndex})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* URLs - Combine all unique URLs */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  URLs (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    console.log('🔍 scenesToMerge in URL display:', scenesToMerge);
                    const allUrls = new Set();
                    scenesToMerge.forEach(scene => {
                      console.log(`Scene ${scene.id}:`, {
                        url: scene.url,
                        geviUrl: scene.geviUrl,
                        episodeUrls: scene.episodeUrls
                      });
                      if (scene.url) allUrls.add(scene.url);
                      if (scene.geviUrl) allUrls.add(scene.geviUrl);
                      // Parse and add episode URLs
                      if (scene.episodeUrls) {
                        try {
                          const episodeUrls = typeof scene.episodeUrls === 'string' 
                            ? JSON.parse(scene.episodeUrls) 
                            : scene.episodeUrls;
                          console.log(`  Parsed episodeUrls:`, episodeUrls);
                          if (Array.isArray(episodeUrls)) {
                            episodeUrls.forEach(urlItem => {
                              // Handle both formats: plain strings and objects with url property
                              if (typeof urlItem === 'string') {
                                allUrls.add(urlItem);
                              } else if (urlItem && urlItem.url) {
                                allUrls.add(urlItem.url);
                              }
                            });
                          }
                        } catch (e) {
                          console.error('Failed to parse episodeUrls:', e);
                        }
                      }
                    });
                    
                    console.log('🔗 Total unique URLs collected:', allUrls.size, Array.from(allUrls));
                    
                    if (allUrls.size === 0) {
                      return <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No URLs found</span>;
                    }
                    
                    return Array.from(allUrls).map((url, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: '11px',
                          color: '#4b5563',
                          padding: '4px 0',
                          wordBreak: 'break-all'
                        }}
                      >
                        🔗 {url}
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergeScenes}
                disabled={isMergingScenes || !mergeSceneData?.primarySceneId}
              >
                {isMergingScenes ? '⏳ Merging...' : '🔀 Merge Scenes'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowSceneMergeModal(false)}
                disabled={isMergingScenes}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stash-Box Search Modal */}
      {showStashBoxSearchModal && (
        <div className="modal-overlay" onClick={() => setShowStashBoxSearchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>📦 {selectedStashBoxScraper?.name} Search</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '12px' }}>
                Search Type:
              </label>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="fragment"
                    checked={stashBoxSearchType === 'fragment'}
                    onChange={(e) => {
                      setStashBoxSearchType(e.target.value);
                      setStashBoxSearchQuery('');
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontWeight: '500' }}>Fragment Scrape (Recommended)</span>
                  <p style={{ marginLeft: '24px', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    Stash will use the existing performer's data to find matches automatically
                  </p>
                </label>
                
                <label style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    value="query"
                    checked={stashBoxSearchType === 'query'}
                    onChange={(e) => {
                      setStashBoxSearchType(e.target.value);
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontWeight: '500' }}>Search by Name</span>
                  <p style={{ marginLeft: '24px', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    Manually search for the performer by name
                  </p>
                </label>
              </div>
              
              {stashBoxSearchType === 'query' && (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Search Query:
                  </label>
                  <input
                    type="text"
                    value={stashBoxSearchQuery}
                    onChange={(e) => setStashBoxSearchQuery(e.target.value)}
                    placeholder={data?.name || 'Enter performer name...'}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleStashBoxSearch}
              >
                🔍 Search
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowStashBoxSearchModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Modal */}
      {showScrapeModal && searchResults && (
        <div className="modal-overlay" onClick={() => setShowScrapeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>
              {searchResults.isStashBox ? '📦' : searchResults.isGevi ? '🎬' : '🔍'} {searchResults.source} Search Results
            </h3>
            
            {searchResults.performers && searchResults.performers.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  Found {searchResults.performers.length} result(s). Click a performer to view details.
                </p>
                
                <div style={{ display: 'grid', gap: '12px' }}>
                  {searchResults.performers.map((performer, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (searchResults.isStashBox) {
                          handleSelectStashBoxResult(performer);
                        } else if (searchResults.isGevi) {
                          handleSelectGeviPerformer(performer);
                        } else {
                          handleSelectNativeScraperResult(performer, searchResults.scraperId);
                        }
                      }}
                      style={{
                        padding: '16px',
                        border: searchResults.isGevi ? '2px solid #fef3c7' : '2px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: 'white'
                      }}
                      onMouseOver={(e) => {
                        if (searchResults.isGevi) {
                          e.currentTarget.style.borderColor = '#f59e0b';
                          e.currentTarget.style.background = '#fffbeb';
                        } else {
                          e.currentTarget.style.borderColor = '#06b6d4';
                          e.currentTarget.style.background = '#f0f9ff';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = searchResults.isGevi ? '#fef3c7' : '#e5e7eb';
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {/* Show placeholder for GEVI results (no images in search) */}
                        {searchResults.isGevi ? (
                          <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '36px'
                          }}>
                            🎬
                          </div>
                        ) : (
                          performer.images && performer.images.length > 0 && (
                            <img
                              src={performer.images[0]}
                              alt={performer.name}
                              style={{
                                width: '80px',
                                height: '80px',
                                objectFit: 'cover',
                                borderRadius: '6px'
                              }}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )
                        )}
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                            {performer.name}
                          </h4>
                          
                          {performer.disambiguation && (
                            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                              ({performer.disambiguation})
                            </div>
                          )}
                          
                          {performer.aliases && (
                            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                              Aliases: {Array.isArray(performer.aliases) ? performer.aliases.join(', ') : performer.aliases}
                            </div>
                          )}
                          
                          <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {performer.birthdate && <span>🎂 {performer.birthdate}</span>}
                            {performer.gender && <span>⚧ {performer.gender}</span>}
                            {performer.country && <span>🌍 {performer.country}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                No results found
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button 
                className="btn-cancel" 
                onClick={() => setShowScrapeModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrape Review Modal */}
      {showScrapeReviewModal && scrapeData && (
        <div className="modal-overlay" onClick={() => !isApplyingScrape && setShowScrapeReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>📦 Review Scraped Data</h3>
            
            {scrapeData.scraped ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ marginBottom: '1rem', color: '#666', fontSize: '14px' }}>
                  <strong>Source:</strong> {scrapeData.source || 'Stash-Box'}
                  {scrapeData.sourceUrl && (
                    <> • <a href={scrapeData.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>View Source</a></>
                  )}
                </p>
                
                <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                      ✓ Check fields to include • ✗ Uncheck to exclude
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                    {scrapeData.scraped.name && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.name !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, name: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Name:</strong> {scrapeData.scraped.name}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.disambiguation && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.disambiguation !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, disambiguation: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Disambiguation:</strong> {scrapeData.scraped.disambiguation}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.aliases && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.aliases !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, aliases: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Aliases:</strong> {Array.isArray(scrapeData.scraped.aliases) ? scrapeData.scraped.aliases.join(', ') : scrapeData.scraped.aliases}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.gender && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.gender !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, gender: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Gender:</strong> {scrapeData.scraped.gender}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.birthdate && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.birthdate !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, birthdate: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Birthdate:</strong> {scrapeData.scraped.birthdate}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.death_date && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.death_date !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, death_date: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Death Date:</strong> {scrapeData.scraped.death_date}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.country && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.country !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, country: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Country:</strong> {scrapeData.scraped.country}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.eye_color && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.eye_color !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, eye_color: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Eye Color:</strong> {scrapeData.scraped.eye_color}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.hair_color && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.hair_color !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, hair_color: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Hair Color:</strong> {scrapeData.scraped.hair_color}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.height && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.height !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, height: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Height:</strong> {scrapeData.scraped.height} cm
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.weight && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.weight !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, weight: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Weight:</strong> {scrapeData.scraped.weight} kg
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.penis_length && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.penis_length !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, penis_length: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Penis Length:</strong> {scrapeData.scraped.penis_length} cm
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.circumcised && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.circumcised !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, circumcised: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Circumcised:</strong> {scrapeData.scraped.circumcised}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.measurements && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.measurements !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, measurements: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Measurements:</strong> {scrapeData.scraped.measurements}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.tattoos && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.tattoos !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, tattoos: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Tattoos:</strong> {scrapeData.scraped.tattoos}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.piercings && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.piercings !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, piercings: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Piercings:</strong> {scrapeData.scraped.piercings}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.career_length && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.career_length !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, career_length: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Career:</strong> {scrapeData.scraped.career_length}
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.twitter && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.twitter !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, twitter: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Twitter:</strong> <a href={scrapeData.scraped.twitter} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>@{scrapeData.scraped.twitter.split('/').pop()}</a>
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.instagram && (
                      <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.instagram !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, instagram: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Instagram:</strong> <a href={scrapeData.scraped.instagram} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>@{scrapeData.scraped.instagram.split('/').pop()}</a>
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.url && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.url !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, url: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>URL:</strong> <a href={scrapeData.scraped.url} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', wordBreak: 'break-all' }}>{scrapeData.scraped.url}</a>
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.urls && scrapeData.scraped.urls.length > 0 && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.urls !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, urls: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <strong>URLs ({scrapeData.scraped.urls.length}):</strong>
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {scrapeData.scraped.urls.map((url, idx) => (
                              <a 
                                key={idx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: '#06b6d4', wordBreak: 'break-all', fontSize: '13px' }}
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {scrapeData.scraped.details && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={acceptedFields.details !== false}
                          onChange={(e) => setAcceptedFields(prev => ({ ...prev, details: e.target.checked }))}
                          style={{ marginTop: '2px', cursor: 'pointer' }}
                        />
                        <div>
                          <strong>Details:</strong> {scrapeData.scraped.details}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Single Image Selection (e.g., from GEVI) */}
                {scrapeData.scraped.displayImage && !scrapeData.scraped.images && (
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>📷 Select Image:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', maxWidth: '400px' }}>
                      {/* No Image Option */}
                      <div
                        onClick={() => setSelectedImage(null)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          border: selectedImage === null ? '3px solid #06b6d4' : '2px solid #e5e7eb',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          aspectRatio: '2/3',
                          transition: 'all 0.2s',
                          background: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          padding: '1rem'
                        }}
                      >
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚫</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>
                          No Image
                        </div>
                        {selectedImage === null && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: '#06b6d4',
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>

                      {/* Scraped Image */}
                      <div
                        onClick={() => setSelectedImage(scrapeData.scraped.displayImage)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          border: selectedImage === scrapeData.scraped.displayImage ? '3px solid #06b6d4' : '2px solid #e5e7eb',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          aspectRatio: '2/3',
                          transition: 'all 0.2s'
                        }}
                      >
                        <img
                          src={scrapeData.scraped.displayImage}
                          alt="Scraped performer"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; color: #9ca3af;">Failed to load</div>';
                          }}
                        />
                        {selectedImage === scrapeData.scraped.displayImage && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: '#06b6d4',
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Image Selection */}
                {scrapeData.scraped.images && scrapeData.scraped.images.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>📷 Select Image:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                      {/* No Image Option */}
                      <div
                        onClick={() => setSelectedImage(null)}
                        style={{
                          position: 'relative',
                          cursor: 'pointer',
                          border: selectedImage === null ? '3px solid #06b6d4' : '2px solid #e5e7eb',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          aspectRatio: '2/3',
                          transition: 'all 0.2s',
                          background: '#f3f4f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          padding: '1rem'
                        }}
                      >
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚫</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>
                          No Image
                        </div>
                        {selectedImage === null && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: '#06b6d4',
                            color: 'white',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                      
                      {/* Image Options */}
                      {scrapeData.scraped.images.map((imageUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedImage(selectedImage === imageUrl ? null : imageUrl)}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            border: selectedImage === imageUrl ? '3px solid #06b6d4' : '2px solid #e5e7eb',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            aspectRatio: '2/3',
                            transition: 'all 0.2s'
                          }}
                        >
                          <img
                            src={imageUrl}
                            alt={`Option ${idx + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f3f4f6; color: #9ca3af;">Failed to load</div>';
                            }}
                          />
                          {selectedImage === imageUrl && (
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              background: '#06b6d4',
                              color: 'white',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              fontWeight: 'bold'
                            }}>
                              ✓
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Display scraped tags (e.g., from GEVI) */}
                {scrapeData.scraped?.tags && scrapeData.scraped.tags.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>🏷️ Scraped Tags:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {scrapeData.scraped.tags.map((tag, idx) => (
                        <span key={idx} style={{
                          padding: '4px 10px',
                          background: '#fef3c7',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#92400e'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {scrapeData.matched?.tags && scrapeData.matched.tags.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>✅ Matched Tags:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {scrapeData.matched.tags.map(tag => (
                        <span key={tag.id} style={{
                          padding: '4px 10px',
                          background: '#dbeafe',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#1e40af'
                        }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {scrapeData.unmatched?.tags && scrapeData.unmatched.tags.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>❌ Unmatched Tags:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {scrapeData.unmatched.tags.map((tag, idx) => (
                        <span key={idx} style={{
                          padding: '4px 10px',
                          background: '#fee2e2',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#991b1b'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                <p style={{ fontSize: '16px', marginBottom: '8px' }}>❌ No Results Found</p>
                <p style={{ fontSize: '14px' }}>The scraper couldn't find any matching data.</p>
              </div>
            )}
            
            <div className="modal-actions">
              {scrapeData.scraped && (
                <button 
                  className="btn-accept" 
                  onClick={handleApplyScrape}
                  disabled={isApplyingScrape}
                >
                  {isApplyingScrape ? '⏳ Applying...' : '✅ Apply Scraped Data'}
                </button>
              )}
              <button 
                className="btn-cancel" 
                onClick={() => setShowScrapeReviewModal(false)}
                disabled={isApplyingScrape}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name Conflict Resolution Modal */}
      {showConflictModal && conflictData && (
        <div className="modal-overlay" onClick={() => setShowConflictModal(false)}>
          <div className="modal-content conflict-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Performer Name Conflict</h2>
              <button 
                className="modal-close" 
                onClick={() => setShowConflictModal(false)}
                disabled={isApplyingScrape}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="conflict-message">
                <p style={{ marginBottom: '1rem', fontSize: '16px' }}>
                  A performer with the name <strong>"{conflictData.existingPerformer.name}"</strong> already exists in Stash.
                </p>
                <p style={{ marginBottom: '1.5rem', color: '#666' }}>
                  Choose how to resolve this conflict:
                </p>
              </div>

              <div className="conflict-performers">
                <div className="conflict-performer-card">
                  <h4>📍 Current Performer</h4>
                  <div className="performer-info">
                    {data?.image_path && (
                      <img 
                        src={data.image_path} 
                        alt={data.name}
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    )}
                    <div>
                      <p><strong>ID:</strong> {conflictData.currentPerformer.id}</p>
                      <p><strong>Current Name:</strong> {data?.name}</p>
                      <p><strong>New Name:</strong> {conflictData.currentPerformer.name}</p>
                    </div>
                  </div>
                </div>

                <div className="conflict-performer-card existing">
                  <h4>🔍 Existing Performer</h4>
                  <div className="performer-info">
                    {conflictData.existingPerformer.image_path && (
                      <img 
                        src={conflictData.existingPerformer.image_path} 
                        alt={conflictData.existingPerformer.name}
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                    )}
                    <div>
                      <p><strong>ID:</strong> {conflictData.existingPerformer.id}</p>
                      <p><strong>Name:</strong> {conflictData.existingPerformer.name}</p>
                      {conflictData.existingPerformer.alias && (
                        <p><strong>Alias:</strong> {conflictData.existingPerformer.alias}</p>
                      )}
                      {conflictData.existingPerformer.disambiguation && (
                        <p><strong>Disambiguation:</strong> {conflictData.existingPerformer.disambiguation}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="conflict-options">
                <button
                  className="conflict-option-btn merge-into"
                  onClick={handleMergeIntoExisting}
                  disabled={isApplyingScrape}
                >
                  <span className="option-icon">🔀</span>
                  <div className="option-text">
                    <strong>Merge Into Existing</strong>
                    <small>Delete current performer and merge all its scenes into the existing one</small>
                  </div>
                </button>

                <button
                  className="conflict-option-btn merge-from"
                  onClick={handleMergeFromExisting}
                  disabled={isApplyingScrape}
                >
                  <span className="option-icon">🔄</span>
                  <div className="option-text">
                    <strong>Merge Existing Into Current</strong>
                    <small>Delete existing performer, merge its scenes into current, and apply scraped data</small>
                  </div>
                </button>

                <button
                  className="conflict-option-btn add-disambiguation"
                  onClick={handleAddDisambiguation}
                  disabled={isApplyingScrape}
                >
                  <span className="option-icon">🏷️</span>
                  <div className="option-text">
                    <strong>Add Disambiguation</strong>
                    <small>Keep both performers and add a disambiguation tag (e.g., "II", "Performer")</small>
                  </div>
                </button>
              </div>

              {isApplyingScrape && (
                <div className="conflict-loading">
                  <p>⏳ Processing...</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setShowConflictModal(false)}
                disabled={isApplyingScrape}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

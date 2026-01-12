/**
 * StashClipOverlay Component
 * Displays an overlay when Android app requests a Stash clip via /stash/next.
 * Shows parent scene metadata with artwork in a clean, dismissable modal.
 */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import config from '../../config';
import StashPerformerOverlay from './StashPerformerOverlay';
import StashClipTagSelector from './StashClipTagSelector';

const StashClipOverlay = ({ clipData, onClose }) => {
  const [selectedPerformerId, setSelectedPerformerId] = useState(null);
  const [sceneDate, setSceneDate] = useState(null);
  const [clipTags, setClipTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [addingTag, setAddingTag] = useState(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStudioSelector, setShowStudioSelector] = useState(false);
  const [studios, setStudios] = useState([]);
  const [studioSearchQuery, setStudioSearchQuery] = useState('');
  const [loadingStudios, setLoadingStudios] = useState(false);
  const [updatingStudio, setUpdatingStudio] = useState(false);
  const [currentStudio, setCurrentStudio] = useState(null);
  const [clipRating, setClipRating] = useState(null);
  const [updatingRating, setUpdatingRating] = useState(false);
  const [showTaggingWorkflow, setShowTaggingWorkflow] = useState(false);
  const [participantCount, setParticipantCount] = useState(null);
  const [sceneTags, setSceneTags] = useState([]);
  
  // Multi-step tagging workflow state
  const [workflowStep, setWorkflowStep] = useState('performerCount'); // performerCount, performerRace, sexActs, masturbation, oralSex, performerOral, analSex, performerPositions, performerRimming, cumShot
  const [selectedTags, setSelectedTags] = useState({
    performerCount: null,
    performerRace: [],
    sexActs: [],
    masturbation: [],
    oralSex: [],
    analSex: [],
    cumShot: []
  });
  const [performerPositions, setPerformerPositions] = useState({
    tops: [],
    bottoms: []
  });
  const [performerOral, setPerformerOral] = useState({
    givers: [],
    receivers: []
  });
  const [performerRimming, setPerformerRimming] = useState({
    givers: [],
    receivers: []
  });
  
  if (!clipData) return null;

  const { scene, clipId, clip } = clipData;
  
  // Initialize/reset current studio from scene data whenever scene changes
  useEffect(() => {
    // Always sync currentStudio with scene.studio (could be null)
    setCurrentStudio(scene.studio || null);
  }, [scene.studio, scene.id]); // Also depend on scene.id to catch scene changes
  
  // Initialize scene tags from scene data
  useEffect(() => {
    if (scene?.tags) {
      setSceneTags(scene.tags);
    }
  }, [scene?.tags]);
  
  // Initialize clip rating from clip data
  useEffect(() => {
    // Explicitly set to null if no rating, or set to the actual rating value
    if (clip?.rating !== undefined && clip?.rating !== null) {
      setClipRating(clip.rating);
    } else {
      setClipRating(null);
    }
  }, [clip?.rating, clipId]); // Also depend on clipId to reset when clip changes
  
  // Auto-select tags that are on the scene when step changes
  useEffect(() => {
    if (!showTaggingWorkflow) return;
    
    // Only auto-select for multi-select steps
    if (workflowStep === 'performerCount') return;
    
    const options = (() => {
      if (workflowStep === 'performerRace') {
        return ['Arabian', 'Asian', 'Black', 'Latin American', 'White'];
      } else if (workflowStep === 'sexActs') {
        if (selectedTags.performerCount === 'Solo') {
          return ['Masturbation', 'Autofellatio'];
        } else {
          return ['Oral Sex', 'Anal Sex', 'Kissing', 'Masturbation', 'Fingering', 'Rimming'];
        }
      } else if (workflowStep === 'masturbation') {
        const opts = ['Sitting Masturbation', 'Laying Masturbation', 'Standing Masturbation'];
        if (selectedTags.performerCount !== 'Solo') {
          opts.unshift('Couple Masturbation', 'Handjob');
        }
        if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
          opts.push('Circle-Jerk', '2 in 1 hand');
        }
        return opts;
      } else if (workflowStep === 'oralSex') {
        const opts = ['69', 'Ball Licking', 'Dick Licking', 'Face Fuck', 'Kneeling', 'Laying', 'Side Fuck Blowjob', 'Standing Blowjob'];
        if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
          opts.push('Double Blowjob', 'Train (Oral Sex)');
        }
        const hasMultiRacial = selectedTags.performerRace.length > 1 || 
                               isTagOnScene('Multi-Racial') ||
                               (selectedTags.performerCount !== 'Solo' && selectedTags.performerRace.length > 0);
        if (hasMultiRacial) {
          opts.push('Black Suck White', 'White Suck Black');
        }
        return opts;
      } else if (workflowStep === 'analSex') {
        const opts = ['Cowboy', 'Doggy Style', 'Flip Flop', 'Missionary', 'Reverse Cowboy', 'Side Fuck', 'Standing Sex'];
        if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
          opts.push('Double Anal Penetration (DAP)', 'GangBang', 'Train (Penetration Chain)', 'Spit Roast');
        }
        const hasMultiRacial = selectedTags.performerRace.length > 1 || 
                               isTagOnScene('Multi-Racial') ||
                               (selectedTags.performerCount !== 'Solo' && selectedTags.performerRace.length > 0);
        if (hasMultiRacial) {
          opts.push('Black Fuck White');
        }
        return opts;
      } else if (workflowStep === 'cumShot') {
        const opts = ['Huge Load', 'Cum Eating', 'Cum On Balls', 'Cum Play', 'Cum Standing', 'Cum in Mouth', 'Cum on Body', 'Cum on Chest', 'Cum on Crotch', 'Cum on Dick', 'Cum on Hands', 'Facial Cumshot', 'Hands-Free Orgasm', 'Multiple Cumshots', 'Spits Cum Out', 'Cumpilation'];
        if (selectedTags.performerCount !== 'Solo') {
          opts.push('Cum Being Jerked Off', 'Top Finished Bottom');
        }
        return opts;
      }
      return [];
    })();
    
    // Auto-select tags that are on the scene
    const tagsToAutoSelect = options.filter(opt => isTagOnScene(opt));
    if (tagsToAutoSelect.length > 0) {
      setSelectedTags(prev => ({
        ...prev,
        [workflowStep]: [...new Set([...prev[workflowStep], ...tagsToAutoSelect])]
      }));
    }
  }, [workflowStep, showTaggingWorkflow]);
  
  // Auto-select participant count based on performer count
  useEffect(() => {
    if (showTaggingWorkflow && scene?.performers?.length > 0) {
      const performerCount = scene.performers.length;
      if (performerCount === 1) {
        setParticipantCount('solo');
      } else if (performerCount === 2) {
        setParticipantCount('couple');
      } else if (performerCount === 3) {
        setParticipantCount('threesome');
      } else if (performerCount === 4) {
        setParticipantCount('foursome');
      } else if (performerCount === 5) {
        setParticipantCount('fivesome');
      } else if (performerCount > 5) {
        setParticipantCount('orgy');
      }
    }
  }, [showTaggingWorkflow, scene?.performers?.length]);
  
  // Debug: Log clipId when component receives data
  useEffect(() => {
    console.log('🎬 StashClipOverlay received clipData:', {
      hasClipData: !!clipData,
      clipId: clipId,
      clipIdType: typeof clipId,
      fullClipData: clipData
    });
  }, [clipData, clipId]);
  
  // Fetch clip tags on mount
  useEffect(() => {
    if (!clipId) {
      console.warn('⚠️ No clipId available, skipping tag fetch');
      return;
    }
    
    fetchClipTags();
  }, [clipId]);

  // Function to fetch clip tags (can be called to refresh)
  const fetchClipTags = async () => {
    if (!clipId) return;
    
    try {
      setLoadingTags(true);
      const url = `${config.apiBaseUrl}/api/stash/clips/${clipId}/tags`;
      console.log('Fetching clip tags from:', url);
      
      const response = await fetch(url);
      console.log('Clip tags response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Clip tags response data:', data);
        console.log('Raw tags array:', data.tags);
        
        // Extract tag IDs from the response
        // Response structure: { tags: [{ id, clipId, tagId, tag: { id, name, ... } }] }
        const tagIds = data.tags?.map(t => t.tagId || t.tag?.id) || [];
        console.log('Extracted tag IDs:', tagIds);
        setClipTags(tagIds);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch clip tags:', response.status, errorText);
        // Still set loading to false even if clip not found
        setClipTags([]);
      }
    } catch (error) {
      console.error('Error fetching clip tags:', error);
      setClipTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  // Function to fetch scene tags (to refresh after adding tags)
  const fetchSceneTags = async () => {
    if (!scene?.id) return;
    
    try {
      const url = `${config.apiBaseUrl}/api/stash/scenes/${scene.id}`;
      console.log('Fetching updated scene data from:', url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Updated scene tags:', data.tags?.length || 0);
        
        if (data.tags) {
          setSceneTags(data.tags);
        }
      } else {
        console.error('Failed to fetch scene data:', response.status);
      }
    } catch (error) {
      console.error('Error fetching scene data:', error);
    }
  };

  // Handle tags added from tag selector
  const handleTagsAdded = (newTagIds) => {
    console.log('Tags added, refreshing clip tags...');
    fetchClipTags();
  };
  
  // Handle tag click to add/remove
  const handleTagClick = async (tagId) => {
    const isTagOnClip = clipTags.includes(tagId);
    
    if (isTagOnClip) {
      // Tag already on clip, don't do anything or optionally show a message
      console.log('Tag already on clip:', tagId);
      return;
    }
    
    try {
      setAddingTag(tagId);
      console.log(`Adding tag ${tagId} to clip ${clipId}`);
      
      const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`;
      console.log('POST URL:', url);
      console.log('POST body:', { tagIds: [tagId] });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [tagId] })
      });
      
      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);
      console.log('Response data.data:', responseData.data);
      
      if (response.ok) {
        // Add tag to local state
        setClipTags(prev => [...prev, tagId]);
        console.log('✅ Tag added successfully');
        console.log('Updated clipTags:', [...clipTags, tagId]);
        
        // Find the tag name for the toast
        const tag = scene.tags.find(t => t.id === tagId);
        const tagName = tag ? tag.name : `Tag ${tagId}`;
        
        // Show success toast
        toast.success(`✅ Added "${tagName}" to clip`, {
          duration: 3000,
          position: 'bottom-right',
        });
        
        // Emit event for other components to refresh if needed
        window.dispatchEvent(new CustomEvent('clipTagAdded', { 
          detail: { clipId, tagId, responseData } 
        }));
      } else {
        console.error('❌ Failed to add tag:', responseData);
        toast.error('Failed to add tag to clip', {
          duration: 4000,
          position: 'bottom-right',
        });
      }
    } catch (error) {
      console.error('❌ Error adding tag to clip:', error);
    } finally {
      setAddingTag(null);
    }
  };
  
  // Handle rating change
  const handleRatingChange = async (newRating) => {
    if (!clipId) {
      toast.error('No clip ID available', { duration: 4000, position: 'bottom-right' });
      return;
    }
    
    setUpdatingRating(true);
    
    try {
      console.log(`⭐ Updating clip ${clipId} rating to ${newRating}...`);
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/${clipId}/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating === 0 ? null : newRating })
      });
      
      if (response.ok) {
        const data = await response.json();
        setClipRating(newRating === 0 ? null : newRating);
        toast.success(`Clip rated ${newRating} star${newRating !== 1 ? 's' : ''}`, {
          duration: 2000,
          position: 'bottom-right',
        });
        console.log(`⭐ Clip rating updated:`, data);
      } else {
        const error = await response.json();
        console.error('❌ Failed to update rating:', error);
        toast.error('Failed to update clip rating', {
          duration: 4000,
          position: 'bottom-right',
        });
      }
    } catch (error) {
      console.error('❌ Error updating clip rating:', error);
      toast.error('Error updating clip rating', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setUpdatingRating(false);
    }
  };
  
  // Handle scene deletion
  const handleDeleteScene = async () => {
    if (!clipId) {
      toast.error('No clip ID available', { duration: 4000, position: 'bottom-right' });
      return;
    }
    
    const sceneTitle = displayTitle;
    
    // Confirm deletion
    if (!window.confirm(
      `Are you sure you want to delete "${sceneTitle}" and all its clips?\n\n` +
      `This will:\n` +
      `• Delete the video file from disk\n` +
      `• Delete all generated content (thumbnails, sprites, etc.)\n` +
      `• Delete the scene from Stash database\n` +
      `• Delete all clips from your local database\n\n` +
      `This action cannot be undone.`
    )) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log(`🗑️ Deleting scene via clip ID ${clipId}...`);
      
      const response = await fetch(`${config.apiBaseUrl}/api/android/stash/clip/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clipId: clipId,
          deleteFile: true,
          deleteGenerated: true
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.type === 'STASH_SCENE_DELETED') {
        console.log('✅ Successfully deleted scene:', result.data);
        
        const clipsDeleted = result.data.local?.clipsDeleted || 0;
        const localDeleted = result.data.local?.sceneDeleted || false;
        const remoteDeleted = result.data.remote?.success || false;
        
        // Build success message
        let message = `✅ Successfully deleted "${sceneTitle}"\n\n`;
        message += `• Deleted ${clipsDeleted} clip${clipsDeleted !== 1 ? 's' : ''}\n`;
        message += `• Removed from local database: ${localDeleted ? 'Yes' : 'No'}\n`;
        message += `• Deleted from Stash: ${remoteDeleted ? 'Yes' : 'No'}`;
        
        if (result.data.remote?.warning) {
          message += `\n\n⚠️ ${result.data.remote.warning}`;
        }
        
        toast.success(`Deleted "${sceneTitle}"`, {
          duration: 5000,
          position: 'bottom-right',
        });
        
        alert(message);
        
        // Close the overlay
        onClose();
      } else {
        console.error('❌ Failed to delete scene:', result);
        const errorMessage = result.data?.message || result.message || 'Unknown error';
        toast.error(`Failed to delete scene: ${errorMessage}`, {
          duration: 5000,
          position: 'bottom-right',
        });
        alert(`❌ Failed to delete scene: ${errorMessage}`);
      }
    } catch (error) {
      console.error('❌ Error deleting scene:', error);
      toast.error(`Error deleting scene: ${error.message}`, {
        duration: 5000,
        position: 'bottom-right',
      });
      alert(`❌ Error deleting scene: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Load all studios (called when opening the modal)
  const loadAllStudios = async () => {
    try {
      setLoadingStudios(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/studios?perPage=999999`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Studios loaded:', data.data?.length || 0);
        setStudios(data.data || []);
      } else {
        console.error('Failed to load studios:', response.status);
        toast.error('Failed to load studios');
      }
    } catch (error) {
      console.error('Error loading studios:', error);
      toast.error('Failed to load studios');
    } finally {
      setLoadingStudios(false);
    }
  };
  
  // Handle studio selection
  const handleStudioSelect = async (studio) => {
    if (!scene.id) {
      toast.error('No scene ID available');
      return;
    }
    
    try {
      setUpdatingStudio(true);
      console.log(`Updating scene ${scene.id} with studio ${studio.id}`);
      
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${scene.id}/studio`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studioId: studio.id })
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        setCurrentStudio(studio);
        setShowStudioSelector(false);
        setStudioSearchQuery('');
        setStudios([]);
        
        let message = `✅ Studio set to "${studio.name}"`;
        if (result.warning) {
          message += `\n\n⚠️ ${result.warning}`;
        }
        
        toast.success(`Studio updated to "${studio.name}"`, {
          duration: 4000,
          position: 'bottom-right',
        });
        
        if (result.warning) {
          toast.warning(result.warning, {
            duration: 6000,
            position: 'bottom-right',
          });
        }
      } else {
        toast.error(result.message || 'Failed to update studio');
      }
    } catch (error) {
      console.error('Error updating studio:', error);
      toast.error('Failed to update studio');
    } finally {
      setUpdatingStudio(false);
    }
  };
  
  // Load all studios when modal opens
  useEffect(() => {
    if (showStudioSelector) {
      loadAllStudios();
    }
  }, [showStudioSelector]);
  
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Helper function to find tag ID by name
  const findTagByName = async (tagName) => {
    try {
      const searchResponse = await fetch(`${config.apiBaseUrl}/api/stash/tags?filter=${encodeURIComponent(tagName)}&perPage=100`);
      const searchResult = await searchResponse.json();
      
      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        return null;
      }
      
      // Find exact match (check both parent and children tags)
      let tag = searchResult.data.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      
      // If not found in root, search children recursively
      if (!tag) {
        for (const parentTag of searchResult.data) {
          if (parentTag.children && parentTag.children.length > 0) {
            const findInChildren = (children) => {
              for (const child of children) {
                if (child.name.toLowerCase() === tagName.toLowerCase()) {
                  return child;
                }
                if (child.children && child.children.length > 0) {
                  const found = findInChildren(child.children);
                  if (found) return found;
                }
              }
              return null;
            };
            tag = findInChildren(parentTag.children);
            if (tag) break;
          }
        }
      }
      
      return tag;
    } catch (error) {
      console.error('Error finding tag:', error);
      return null;
    }
  };
  
  // Helper function to apply tags to both scene and clip
  const applyTagsToSceneAndClip = async (tagNames) => {
    if (tagNames.length === 0) {
      // No tags to apply, but that's OK - just proceed
      return { success: true, count: 0 };
    }
    
    const tagIds = [];
    
    // Find all tag IDs
    for (const tagName of tagNames) {
      const tag = await findTagByName(tagName);
      if (tag) {
        tagIds.push(tag.id);
      } else {
        console.warn(`Tag "${tagName}" not found`);
      }
    }
    
    if (tagIds.length === 0) {
      // No valid tags found, but still proceed
      return { success: true, count: 0 };
    }
    
    try {
      // Add tags to BOTH scene and clip
      const [sceneResponse, clipResponse] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds })
        }),
        fetch(`${config.apiBaseUrl}/api/stash/clips/${clipId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds })
        })
      ]);
      
      if (sceneResponse.ok && clipResponse.ok) {
        // Refresh both clip tags and scene tags
        await Promise.all([fetchClipTags(), fetchSceneTags()]);
        return { success: true, count: tagIds.length };
      } else {
        return { success: false, message: 'Failed to apply some tags' };
      }
    } catch (error) {
      console.error('Error applying tags:', error);
      return { success: false, message: error.message };
    }
  };
  
  // Check if a tag is on the parent scene
  const isTagOnScene = (tagName) => {
    return sceneTags.some(t => t.name.toLowerCase() === tagName.toLowerCase());
  };
  
  // Handle workflow "Next" button
  const handleWorkflowNext = async () => {
    const currentStep = workflowStep;
    
    // Apply tags for current step
    let tagsToApply = [];
    
    if (currentStep === 'performerCount') {
      if (!selectedTags.performerCount) {
        toast.error('Please select a performer count');
        return;
      }
      tagsToApply = [selectedTags.performerCount];
      
    } else if (currentStep === 'performerRace') {
      tagsToApply = [...selectedTags.performerRace];
      // Auto-add Multi-Racial if not Solo and multiple races selected
      if (selectedTags.performerCount !== 'Solo' && selectedTags.performerRace.length > 0) {
        if (!tagsToApply.includes('Multi-Racial')) {
          tagsToApply.push('Multi-Racial');
        }
      }
      
    } else if (currentStep === 'sexActs') {
      tagsToApply = [...selectedTags.sexActs];
      
    } else if (currentStep === 'masturbation') {
      tagsToApply = [...selectedTags.masturbation];
      
    } else if (currentStep === 'oralSex') {
      tagsToApply = [...selectedTags.oralSex];
      
    } else if (currentStep === 'analSex') {
      tagsToApply = [...selectedTags.analSex];
      
    } else if (currentStep === 'performerPositions') {
      // Apply performer position tags
      if (performerPositions.tops.length > 0 || performerPositions.bottoms.length > 0) {
        try {
          // Find Top and Bottom tag IDs
          const topTag = await findTagByName('Top');
          const bottomTag = await findTagByName('Bottom');
          
          if (!topTag || !bottomTag) {
            toast.error('Top/Bottom tags not found in database');
            return;
          }
          
          // Apply Top tags to performers
          for (const performerId of performerPositions.tops) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [topTag.id] })
            });
          }
          
          // Apply Bottom tags to performers
          for (const performerId of performerPositions.bottoms) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [bottomTag.id] })
            });
          }
          
          console.log(`✅ Applied performer positions - Tops: ${performerPositions.tops.length}, Bottoms: ${performerPositions.bottoms.length}`);
        } catch (error) {
          console.error('Error applying performer positions:', error);
          toast.error('Failed to apply performer positions');
        }
      }
      
    } else if (currentStep === 'cumShot') {
      tagsToApply = [...selectedTags.cumShot];
    }
    
    // Apply tags
    if (tagsToApply.length > 0) {
      const result = await applyTagsToSceneAndClip(tagsToApply);
      if (!result.success) {
        toast.error(result.message || 'Failed to apply tags');
        return;
      }
    }
    
    // Determine next step
    let nextStep = null;
    
    console.log('🔍 Current step:', currentStep);
    console.log('🔍 Selected tags:', selectedTags);
    console.log('🔍 Performer count:', selectedTags.performerCount);
    console.log('🔍 Sex acts:', selectedTags.sexActs);
    
    if (currentStep === 'performerCount') {
      nextStep = 'performerRace';
    } else if (currentStep === 'performerRace') {
      nextStep = 'sexActs';
    } else if (currentStep === 'sexActs') {
      // Check which conditional steps to show
      console.log('🔍 Checking sexActs navigation...');
      console.log('🔍 Has Masturbation?', selectedTags.sexActs.includes('Masturbation'));
      console.log('🔍 Has Oral Sex?', selectedTags.sexActs.includes('Oral Sex'));
      console.log('🔍 Has Anal Sex?', selectedTags.sexActs.includes('Anal Sex'));
      console.log('🔍 Is Solo?', selectedTags.performerCount === 'Solo');
      
      if (selectedTags.sexActs.includes('Masturbation')) {
        nextStep = 'masturbation';
      } else if (selectedTags.sexActs.includes('Oral Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'oralSex';
      } else if (selectedTags.sexActs.includes('Anal Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'analSex';
      } else {
        nextStep = 'cumShot';
      }
      
      console.log('🔍 Next step determined:', nextStep);
    } else if (currentStep === 'masturbation') {
      if (selectedTags.sexActs.includes('Oral Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'oralSex';
      } else if (selectedTags.sexActs.includes('Anal Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'analSex';
      } else {
        nextStep = 'cumShot';
      }
    } else if (currentStep === 'oralSex') {
      nextStep = 'performerOral';
    } else if (currentStep === 'performerOral') {
      // Apply performer oral tags
      if (performerOral.givers.length > 0 || performerOral.receivers.length > 0) {
        try {
          // Find Oral - Give and Oral - Receive tag IDs
          const giveTag = await findTagByName('Oral - Give');
          const receiveTag = await findTagByName('Oral - Receive');
          
          if (!giveTag || !receiveTag) {
            toast.error('Oral - Give/Oral - Receive tags not found in database');
            return;
          }
          
          // Apply Oral - Give tags to performers
          for (const performerId of performerOral.givers) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [giveTag.id] })
            });
          }
          
          // Apply Oral - Receive tags to performers
          for (const performerId of performerOral.receivers) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [receiveTag.id] })
            });
          }
          
          console.log(`✅ Applied performer oral positions - Givers: ${performerOral.givers.length}, Receivers: ${performerOral.receivers.length}`);
        } catch (error) {
          console.error('Error applying performer oral positions:', error);
          toast.error('Failed to apply performer oral positions');
        }
      }
      
      if (selectedTags.sexActs.includes('Rimming') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'performerRimming';
      } else if (selectedTags.sexActs.includes('Anal Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'analSex';
      } else {
        nextStep = 'cumShot';
      }
    } else if (currentStep === 'performerRimming') {
      // Apply performer rimming tags
      if (performerRimming.givers.length > 0 || performerRimming.receivers.length > 0) {
        try {
          // Find Rim - Give and Rim - Receive tag IDs
          const giveTag = await findTagByName('Rim - Give');
          const receiveTag = await findTagByName('Rim - Receive');
          
          if (!giveTag || !receiveTag) {
            toast.error('Rim - Give/Rim - Receive tags not found in database');
            return;
          }
          
          // Apply Rim - Give tags to performers
          for (const performerId of performerRimming.givers) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [giveTag.id] })
            });
          }
          
          // Apply Rim - Receive tags to performers
          for (const performerId of performerRimming.receivers) {
            await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/performers/${performerId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagIds: [receiveTag.id] })
            });
          }
          
          console.log(`✅ Applied performer rimming positions - Givers: ${performerRimming.givers.length}, Receivers: ${performerRimming.receivers.length}`);
        } catch (error) {
          console.error('Error applying performer rimming positions:', error);
          toast.error('Failed to apply performer rimming positions');
        }
      }
      
      if (selectedTags.sexActs.includes('Anal Sex') && selectedTags.performerCount !== 'Solo') {
        nextStep = 'analSex';
      } else {
        nextStep = 'cumShot';
      }
    } else if (currentStep === 'analSex') {
      nextStep = 'performerPositions';
    } else if (currentStep === 'performerPositions') {
      nextStep = 'cumShot';
    } else if (currentStep === 'cumShot') {
      // Final step - close workflow
      toast.success('Tagging workflow complete!', {
        duration: 3000,
        position: 'bottom-right',
      });
      setShowTaggingWorkflow(false);
      resetWorkflow();
      return;
    }
    
    if (nextStep) {
      setWorkflowStep(nextStep);
    }
  };
  
  // Reset workflow state
  const resetWorkflow = () => {
    setWorkflowStep('performerCount');
    setSelectedTags({
      performerCount: null,
      performerRace: [],
      sexActs: [],
      masturbation: [],
      oralSex: [],
      analSex: [],
      cumShot: []
    });
    setPerformerPositions({
      tops: [],
      bottoms: []
    });
    setPerformerOral({
      givers: [],
      receivers: []
    });
    setPerformerRimming({
      givers: [],
      receivers: []
    });
  };
  
  // Toggle tag selection for multi-select steps
  const toggleTag = (step, tagName) => {
    setSelectedTags(prev => {
      const current = prev[step];
      if (Array.isArray(current)) {
        if (current.includes(tagName)) {
          return { ...prev, [step]: current.filter(t => t !== tagName) };
        } else {
          return { ...prev, [step]: [...current, tagName] };
        }
      }
      return prev;
    });
  };
  
  // Old handler for backward compatibility
  const handleSaveParticipantCount = async () => {
    if (!participantCount) {
      toast.error('Please select a participant count');
      return;
    }
    
    // Map participant count to tag name
    const tagNameMap = {
      'solo': 'Solo',
      'couple': 'Couple Sex',
      'threesome': 'Threesome',
      'foursome': 'Foursome',
      'fivesome': 'Fivesome',
      'orgy': 'Orgy'
    };
    
    const tagName = tagNameMap[participantCount];
    
    try {
      // First, search for the tag by name
      const searchResponse = await fetch(`${config.apiBaseUrl}/api/stash/tags?filter=${encodeURIComponent(tagName)}&perPage=100`);
      const searchResult = await searchResponse.json();
      
      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        toast.error(`Tag "${tagName}" not found. Please create it in Stash first.`);
        return;
      }
      
      // Find exact match (check both parent and children tags)
      let tag = searchResult.data.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      
      // If not found in root, search children recursively
      if (!tag) {
        for (const parentTag of searchResult.data) {
          if (parentTag.children && parentTag.children.length > 0) {
            const findInChildren = (children) => {
              for (const child of children) {
                if (child.name.toLowerCase() === tagName.toLowerCase()) {
                  return child;
                }
                if (child.children && child.children.length > 0) {
                  const found = findInChildren(child.children);
                  if (found) return found;
                }
              }
              return null;
            };
            tag = findInChildren(parentTag.children);
            if (tag) break;
          }
        }
      }
      
      if (!tag) {
        toast.error(`Tag "${tagName}" not found. Please create it in Stash first.`);
        return;
      }
      
      console.log(`🏷️ Adding tag to scene and clip:`, {
        sceneId: scene.id,
        clipId,
        tagId: tag.id,
        tagName: tag.name
      });
      
      // Add tag to BOTH scene and clip
      const [sceneResponse, clipResponse] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: [tag.id] })
        }),
        fetch(`${config.apiBaseUrl}/api/stash/clips/${clipId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: [tag.id] })
        })
      ]);
      
      console.log(`🏷️ Tag add responses:`, {
        sceneStatus: sceneResponse.status,
        clipStatus: clipResponse.status
      });
      
      if (sceneResponse.ok && clipResponse.ok) {
        const [sceneResult, clipResult] = await Promise.all([
          sceneResponse.json(),
          clipResponse.json()
        ]);
        console.log(`✅ Tag added successfully to both scene and clip:`, {
          scene: sceneResult,
          clip: clipResult
        });
        toast.success(`Added "${tagName}" tag to scene and clip`, {
          duration: 3000,
          position: 'bottom-right',
        });
        setShowTaggingWorkflow(false);
        setParticipantCount(null);
        // Refresh both clip tags and scene tags
        await Promise.all([fetchClipTags(), fetchSceneTags()]);
      } else {
        // Handle partial success or failure
        const errors = [];
        if (!sceneResponse.ok) {
          const sceneError = await sceneResponse.json();
          console.error(`❌ Failed to add tag to scene:`, sceneError);
          errors.push('scene');
        }
        if (!clipResponse.ok) {
          const clipError = await clipResponse.json();
          console.error(`❌ Failed to add tag to clip:`, clipError);
          errors.push('clip');
        }
        
        if (errors.length === 2) {
          toast.error('Failed to add tag to scene and clip', {
            duration: 5000,
            position: 'bottom-right',
          });
        } else {
          toast.warning(`Tag added to ${errors.includes('scene') ? 'clip only' : 'scene only'}`, {
            duration: 5000,
            position: 'bottom-right',
          });
          // Still refresh tags since at least one succeeded
          await Promise.all([fetchClipTags(), fetchSceneTags()]);
        }
      }
    } catch (error) {
      console.error('❌ Error saving participant count:', error);
      toast.error(`Failed to save participant count: ${error.message}`, {
        duration: 5000,
        position: 'bottom-right',
      });
    }
  };

  if (!scene) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full p-6 border border-gray-700">
          <p className="text-white">No scene data available</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Build scene image URL from Stash API
  const sceneImageUrl = `${config.apiBaseUrl}/api/stash/image-proxy/scene/${scene.id}/screenshot`;
  
  // Extract filename from path if no title
  const getDisplayTitle = () => {
    if (scene.title) {
      return scene.title;
    }
    
    if (scene.path) {
      // Extract filename from path and remove extension
      const filename = scene.path.split(/[\\/]/).pop(); // Handle both / and \
      return filename.replace(/\.[^/.]+$/, ''); // Remove extension
    }
    
    return 'Untitled Scene';
  };
  
  const displayTitle = getDisplayTitle();
  
  // Build internal app scene URL
  const sceneUrl = `/media/stash/scenes/${scene.id}`;

  return (
    <div className="fixed inset-0 bg-black z-[2000] overflow-hidden">
      {/* Close Button - Top Right */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 text-gray-400 hover:text-white transition-colors p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75"
        aria-label="Close overlay"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Header - Top Left */}
      <div className="absolute top-6 left-6 z-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 bg-black bg-opacity-50 px-4 py-2 rounded-lg">
          <span>📱</span>
          <span>Android Playing Clip</span>
        </h2>
      </div>

      {/* Main Content - Scrollable */}
      <div className="h-full overflow-y-auto pt-24 pb-8 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Large Artwork */}
            <div className="relative w-full">
              <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
                <img
                  src={sceneImageUrl}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            </div>

            {/* Right Column - Scene Info */}
            <div className="space-y-6">
              {/* Title & Basic Info */}
              <div>
                <Link
                  to={sceneUrl}
                  className="text-4xl font-bold text-white hover:text-blue-400 transition-colors mb-4 inline-flex items-center gap-2 group"
                  title="View scene details"
                >
                  <span>{displayTitle}</span>
                  <svg className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                
                {!scene.title && scene.path && (
                  <p className="text-sm text-gray-500 mb-2" title={scene.path}>
                    📁 {scene.path}
                  </p>
                )}
                
                {/* Clip Rating */}
                <div className="mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm font-semibold uppercase">Clip Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isHighlighted = Boolean(clipRating && typeof clipRating === 'number' && clipRating > 0 && star <= clipRating);
                        return (
                          <button
                            key={star}
                            onClick={() => handleRatingChange(star)}
                            disabled={updatingRating}
                            className={`text-3xl transition-all ${
                              updatingRating ? 'opacity-50 cursor-wait' : 'hover:scale-110 cursor-pointer'
                            } ${
                              isHighlighted ? '' : 'text-gray-500'
                            }`}
                            title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          >
                            {isHighlighted ? '⭐' : '☆'}
                          </button>
                        );
                      })}
                      {clipRating && typeof clipRating === 'number' && clipRating > 0 && (
                        <button
                          onClick={() => handleRatingChange(0)}
                          disabled={updatingRating}
                          className="ml-2 text-sm text-gray-400 hover:text-white transition-colors"
                          title="Clear rating"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Scene Rating */}
                {scene.rating && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm font-semibold uppercase">Scene Rating:</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-2xl ${
                                star <= scene.rating ? 'text-yellow-400' : 'text-gray-600'
                              }`}
                            >
                              ⭐
                            </span>
                          ))}
                        </div>
                        <span className="text-gray-300 text-sm">({scene.rating}/5)</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3 text-base">
                  {currentStudio ? (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>🎬</span>
                      <span>{currentStudio.name}</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowStudioSelector(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-900 bg-opacity-30 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-50 transition-colors"
                    >
                      <span>🎬</span>
                      <span>Add Studio</span>
                    </button>
                  )}
                  {scene.date && (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>📅</span>
                      <span>{scene.date}</span>
                    </span>
                  )}
                  {scene.duration && (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>⏱️</span>
                      <span>{Math.round(scene.duration / 60)} min</span>
                    </span>
                  )}
                </div>
              </div>

              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleDeleteScene}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  <span>{isDeleting ? '⏳' : '🗑️'}</span>
                  <span>{isDeleting ? 'Deleting...' : 'Delete Scene'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Performers Section - Full Width Below */}
          {scene.performers && scene.performers.length > 0 && (
            <div className="mt-8 bg-gray-800 bg-opacity-50 rounded-xl p-6 border border-gray-700">
              <h4 className="text-lg font-semibold text-gray-300 uppercase mb-4">Performers</h4>
              <div className="flex flex-wrap gap-6">
                {scene.performers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPerformerId(p.id);
                      setSceneDate(scene.date);
                    }}
                    className="flex flex-col items-center gap-3 px-4 py-4 bg-gray-700 bg-opacity-50 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                  >
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-24 h-24 rounded-full object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className="text-white text-base font-medium text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags Section - Full Width Below */}
          <div className="mt-8 bg-gray-800 bg-opacity-50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-300 uppercase">
                Tags {!loadingTags && sceneTags && sceneTags.length > 0 && <span className="text-sm text-gray-500 ml-2">(click to add to clip)</span>}
              </h4>
              <button
                onClick={() => setShowTagSelector(true)}
                className="px-4 py-2 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>Add Tags</span>
              </button>
            </div>
            {loadingTags ? (
              <div className="text-gray-400 text-base py-4">Loading clip tags...</div>
            ) : sceneTags && sceneTags.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {sceneTags
                  .filter(tag => !tag.hasChildren) // Only show leaf tags (no children)
                  .map((tag) => {
                    const isOnClip = clipTags.includes(tag.id);
                    const isAdding = addingTag === tag.id;
                    
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagClick(tag.id)}
                        disabled={isOnClip || isAdding}
                        className={`px-4 py-2 text-base rounded-lg transition-all ${
                          isOnClip
                            ? 'bg-green-900 text-green-200 cursor-default'
                            : isAdding
                            ? 'bg-yellow-900 text-yellow-200 cursor-wait opacity-75'
                            : 'bg-blue-900 text-blue-200 hover:bg-blue-800 cursor-pointer'
                        }`}
                        title={isOnClip ? `${tag.name} - Already on clip` : isAdding ? 'Adding...' : `${tag.description || tag.name} - Click to add to clip`}
                      >
                        {tag.name}
                        {isOnClip && ' ✓'}
                        {isAdding && ' ⏳'}
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="text-gray-400 text-base py-4">No tags on scene yet. Click "Add Tags" to add some!</div>
            )}
          </div>
          
          {/* Start Tagging Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowTaggingWorkflow(true)}
              className="px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-3 shadow-lg"
            >
              <span>🏷️</span>
              <span>Start Tagging</span>
            </button>
          </div>
        </div>
      </div>

      {/* Performer Detail Overlay (nested on top) */}
      {selectedPerformerId && (
        <StashPerformerOverlay
          performerId={selectedPerformerId}
          sceneDate={sceneDate}
          clipId={clipId}
          onClose={() => {
            setSelectedPerformerId(null);
            setSceneDate(null);
          }}
        />
      )}

      {/* Tag Selector Modal (on top of everything) */}
      {showTagSelector && (
        <StashClipTagSelector
          clipId={clipId}
          onClose={() => setShowTagSelector(false)}
          onTagsAdded={handleTagsAdded}
        />
      )}

      {/* Studio Selector Modal */}
      {showStudioSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Select Studio</h3>
              <button
                onClick={() => {
                  setShowStudioSelector(false);
                  setStudioSearchQuery('');
                  setStudios([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4">
              <input
                type="text"
                placeholder="Search for a studio..."
                value={studioSearchQuery}
                onChange={(e) => setStudioSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto p-4 space-y-2">
              {loadingStudios ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="mt-2">Loading studios...</p>
                </div>
              ) : (() => {
                // Filter studios by search query
                const filteredStudios = studioSearchQuery
                  ? studios.filter(studio => 
                      studio.name.toLowerCase().includes(studioSearchQuery.toLowerCase())
                    )
                  : studios;
                
                if (filteredStudios.length === 0) {
                  return (
                    <div className="text-center text-gray-400 py-8">
                      {studioSearchQuery ? `No studios found matching "${studioSearchQuery}"` : 'No studios available'}
                    </div>
                  );
                }
                
                return filteredStudios.map((studio) => (
                  <button
                    key={studio.id}
                    onClick={() => handleStudioSelect(studio)}
                    disabled={updatingStudio}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    {studio.image && (
                      <img
                        src={studio.image}
                        alt={studio.name}
                        className="w-12 h-12 rounded object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-white">{studio.name}</div>
                      {studio.url && (
                        <div className="text-sm text-gray-400">{studio.url}</div>
                      )}
                      {studio.scene_count !== undefined && (
                        <div className="text-xs text-gray-500">{studio.scene_count} scenes</div>
                      )}
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* Tagging Workflow Modal */}
      {showTaggingWorkflow && (() => {
        const getStepTitle = () => {
          switch (workflowStep) {
            case 'performerCount': return 'Performer Count';
            case 'performerRace': return 'Performer Race';
            case 'sexActs': return 'Sex Acts';
            case 'masturbation': return 'Masturbation';
            case 'oralSex': return 'Oral Sex';
            case 'performerOral': return 'Performer Oral';
            case 'performerRimming': return 'Performer Rimming';
            case 'analSex': return 'Anal Sex';
            case 'performerPositions': return 'Performer Positions';
            case 'cumShot': return 'Cum Shot';
            default: return 'Tagging';
          }
        };
        
        const getOptions = () => {
          if (workflowStep === 'performerCount') {
            const performerCount = scene?.performers?.length || 0;
            const options = [
              { name: 'Solo', description: '1 participant' },
              { name: 'Couple Sex', description: '2 participants' },
              { name: 'Threesome', description: '3 participants' },
              { name: 'Foursome', description: '4 participants' },
              { name: 'Fivesome', description: '5 participants' },
              { name: 'Orgy', description: '6+ participants' }
            ];
            
            // Auto-select based on performer count if none selected
            if (!selectedTags.performerCount && performerCount > 0) {
              let autoSelect = null;
              if (performerCount === 1) autoSelect = 'Solo';
              else if (performerCount === 2) autoSelect = 'Couple Sex';
              else if (performerCount === 3) autoSelect = 'Threesome';
              else if (performerCount === 4) autoSelect = 'Foursome';
              else if (performerCount === 5) autoSelect = 'Fivesome';
              else if (performerCount >= 6) autoSelect = 'Orgy';
              
              if (autoSelect) {
                setTimeout(() => setSelectedTags(prev => ({ ...prev, performerCount: autoSelect })), 0);
              }
            }
            
            return options;
          } else if (workflowStep === 'performerRace') {
            return [
              { name: 'Arabian' },
              { name: 'Asian' },
              { name: 'Black' },
              { name: 'Latin American' },
              { name: 'White' }
            ];
          } else if (workflowStep === 'sexActs') {
            if (selectedTags.performerCount === 'Solo') {
              return [
                { name: 'Masturbation' },
                { name: 'Autofellatio' }
              ];
            } else {
              return [
                { name: 'Oral Sex' },
                { name: 'Anal Sex' },
                { name: 'Kissing' },
                { name: 'Masturbation' },
                { name: 'Fingering' },
                { name: 'Rimming' }
              ];
            }
          } else if (workflowStep === 'masturbation') {
            const options = [
              { name: 'Sitting Masturbation' },
              { name: 'Laying Masturbation' },
              { name: 'Standing Masturbation' }
            ];
            
            if (selectedTags.performerCount !== 'Solo') {
              options.unshift(
                { name: 'Couple Masturbation' },
                { name: 'Handjob' }
              );
            }
            
            if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
              options.push(
                { name: 'Circle-Jerk' },
                { name: '2 in 1 hand' }
              );
            }
            
            return options;
          } else if (workflowStep === 'oralSex') {
            const options = [
              { name: '69' },
              { name: 'Ball Licking' },
              { name: 'Dick Licking' },
              { name: 'Face Fuck' },
              { name: 'Kneeling' },
              { name: 'Laying' },
              { name: 'Side Fuck Blowjob' },
              { name: 'Standing Blowjob' }
            ];
            
            if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
              options.push(
                { name: 'Double Blowjob' },
                { name: 'Train (Oral Sex)' }
              );
            }
            
            // Check if Multi-Racial was applied (either selected or auto-added)
            const hasMultiRacial = selectedTags.performerRace.length > 1 || 
                                   isTagOnScene('Multi-Racial') ||
                                   (selectedTags.performerCount !== 'Solo' && selectedTags.performerRace.length > 0);
            
            if (hasMultiRacial) {
              options.push(
                { name: 'Black Suck White' },
                { name: 'White Suck Black' }
              );
            }
            
            return options;
          } else if (workflowStep === 'analSex') {
            const options = [
              { name: 'Cowboy' },
              { name: 'Doggy Style' },
              { name: 'Flip Flop' },
              { name: 'Missionary' },
              { name: 'Reverse Cowboy' },
              { name: 'Side Fuck' },
              { name: 'Standing Sex' },
              { name: 'Condom' },
              { name: 'No Condom' }
            ];
            
            if (['Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(selectedTags.performerCount)) {
              options.push(
                { name: 'Double Anal Penetration (DAP)' },
                { name: 'GangBang' },
                { name: 'Train (Penetration Chain)' },
                { name: 'Spit Roast' }
              );
            }
            
            // Check if Multi-Racial was applied (either selected or auto-added)
            const hasMultiRacial = selectedTags.performerRace.length > 1 || 
                                   isTagOnScene('Multi-Racial') ||
                                   (selectedTags.performerCount !== 'Solo' && selectedTags.performerRace.length > 0);
            
            if (hasMultiRacial) {
              options.push({ name: 'Black Fuck White' });
            }
            
            return options;
          } else if (workflowStep === 'performerOral') {
            return []; // Custom UI for performer oral
          } else if (workflowStep === 'performerRimming') {
            return []; // Custom UI for performer rimming
          } else if (workflowStep === 'performerPositions') {
            return []; // Custom UI for performer positions
          } else if (workflowStep === 'cumShot') {
            const options = [
              { name: 'Huge Load' },
              { name: 'Cum Eating' },
              { name: 'Cum On Balls' },
              { name: 'Cum Play' },
              { name: 'Cum Standing' },
              { name: 'Cum in Mouth' },
              { name: 'Cum on Body' },
              { name: 'Cum on Chest' },
              { name: 'Cum on Crotch' },
              { name: 'Cum on Dick' },
              { name: 'Cum on Hands' },
              { name: 'Facial Cumshot' },
              { name: 'Hands-Free Orgasm' },
              { name: 'Multiple Cumshots' },
              { name: 'Spits Cum Out' },
              { name: 'Cumpilation' }
            ];
            
            if (selectedTags.performerCount !== 'Solo') {
              options.push(
                { name: 'Cum Being Jerked Off' },
                { name: 'Top Finished Bottom' }
              );
            }
            
            return options;
          }
          
          return [];
        };
        
        const options = getOptions();
        const isMultiSelect = workflowStep !== 'performerCount';
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-95 z-[70]">
            <div className="bg-gray-900 w-full h-full overflow-y-auto flex flex-col">
              {/* Header with Scene Image */}
              <div className="flex-shrink-0 bg-gray-900 z-10 border-b border-gray-700">
                {/* Scene Image */}
                <div className="w-full h-80 bg-gray-800 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={sceneImageUrl}
                    alt={displayTitle}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900 pointer-events-none"></div>
                  {/* Title Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent">
                    <h3 className="text-xl font-semibold text-white truncate">{displayTitle}</h3>
                  </div>
                </div>
                
                {/* Step Title Bar */}
                <div className="flex items-center justify-between p-4">
                  <h3 className="text-2xl font-semibold text-white">{getStepTitle()}</h3>
                  <button
                    onClick={() => {
                      setShowTaggingWorkflow(false);
                      resetWorkflow();
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex-1 p-8 overflow-y-auto">
                {workflowStep !== 'performerPositions' && (
                  <p className="text-gray-400 mb-6 text-lg">
                    {isMultiSelect ? 'Select all that apply:' : 'Select an option:'}
                    {isMultiSelect && <span className="text-sm ml-2 text-gray-500">(Tags on scene are auto-selected)</span>}
                  </p>
                )}
                
                {workflowStep === 'performerOral' ? (
                  /* Performer Oral Selection Screen */
                  <div className="max-w-6xl mx-auto">
                    <p className="text-gray-400 mb-8 text-lg">Select the oral sex role for each performer in this scene:</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {scene.performers.map((performer) => {
                        const isGiver = performerOral.givers.includes(performer.id);
                        const isReceiver = performerOral.receivers.includes(performer.id);
                        
                        return (
                          <div key={performer.id} className="bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700">
                            {/* Performer Image */}
                            <div className="aspect-[3/4] bg-gray-900 relative">
                              {performer.image ? (
                                <img
                                  src={`${config.apiBaseUrl}/api/stash/image-proxy/performer/${performer.id}/image`}
                                  alt={performer.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">
                                  👤
                                </div>
                              )}
                            </div>
                            
                            {/* Performer Name */}
                            <div className="p-4">
                              <h6 className="text-white font-semibold text-lg mb-3 truncate">{performer.name}</h6>
                              
                              {/* Role Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => {
                                    setPerformerOral(prev => {
                                      const currentlyGiver = prev.givers.includes(performer.id);
                                      return {
                                        ...prev,
                                        givers: currentlyGiver
                                          ? prev.givers.filter(id => id !== performer.id)
                                          : [...prev.givers, performer.id]
                                      };
                                    });
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isGiver
                                      ? 'bg-purple-600 text-white border-2 border-purple-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Give {isGiver && '✓'}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setPerformerOral(prev => {
                                      const currentlyReceiver = prev.receivers.includes(performer.id);
                                      return {
                                        ...prev,
                                        receivers: currentlyReceiver
                                          ? prev.receivers.filter(id => id !== performer.id)
                                          : [...prev.receivers, performer.id]
                                      };
                                    });
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isReceiver
                                      ? 'bg-green-600 text-white border-2 border-green-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Receive {isReceiver && '✓'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : workflowStep === 'performerRimming' ? (
                  /* Performer Rimming Selection Screen */
                  <div className="max-w-6xl mx-auto">
                    <p className="text-gray-400 mb-8 text-lg">Select the rimming role for each performer in this scene:</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {scene.performers.map((performer) => {
                        const isGiver = performerRimming.givers.includes(performer.id);
                        const isReceiver = performerRimming.receivers.includes(performer.id);
                        
                        return (
                          <div key={performer.id} className="bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700">
                            {/* Performer Image */}
                            <div className="aspect-[3/4] bg-gray-900 relative">
                              {performer.image ? (
                                <img
                                  src={`${config.apiBaseUrl}/api/stash/image-proxy/performer/${performer.id}/image`}
                                  alt={performer.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">
                                  👤
                                </div>
                              )}
                            </div>
                            
                            {/* Performer Name */}
                            <div className="p-4">
                              <h6 className="text-white font-semibold text-lg mb-3 truncate">{performer.name}</h6>
                              
                              {/* Role Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => {
                                    setPerformerRimming(prev => {
                                      const currentlyGiver = prev.givers.includes(performer.id);
                                      return {
                                        ...prev,
                                        givers: currentlyGiver
                                          ? prev.givers.filter(id => id !== performer.id)
                                          : [...prev.givers, performer.id]
                                      };
                                    });
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isGiver
                                      ? 'bg-orange-600 text-white border-2 border-orange-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Give {isGiver && '✓'}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setPerformerRimming(prev => {
                                      const currentlyReceiver = prev.receivers.includes(performer.id);
                                      return {
                                        ...prev,
                                        receivers: currentlyReceiver
                                          ? prev.receivers.filter(id => id !== performer.id)
                                          : [...prev.receivers, performer.id]
                                      };
                                    });
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isReceiver
                                      ? 'bg-yellow-600 text-white border-2 border-yellow-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Receive {isReceiver && '✓'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : workflowStep === 'performerPositions' ? (
                  /* Performer Position Selection Screen */
                  <div className="max-w-6xl mx-auto">
                    <p className="text-gray-400 mb-8 text-lg">Select the position for each performer in this scene:</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {scene.performers.map((performer) => {
                        const isTop = performerPositions.tops.includes(performer.id);
                        const isBottom = performerPositions.bottoms.includes(performer.id);
                        
                        return (
                          <div key={performer.id} className="bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700">
                            {/* Performer Image */}
                            <div className="aspect-[3/4] bg-gray-900 relative">
                              {performer.image ? (
                                <img
                                  src={`${config.apiBaseUrl}/api/stash/image-proxy/performer/${performer.id}/image`}
                                  alt={performer.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl">
                                  👤
                                </div>
                              )}
                            </div>
                            
                            {/* Performer Name */}
                            <div className="p-4">
                              <h6 className="text-white font-semibold text-lg mb-3 truncate">{performer.name}</h6>
                              
                              {/* Position Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => {
                                    setPerformerPositions(prev => ({
                                      ...prev,
                                      tops: isTop
                                        ? prev.tops.filter(id => id !== performer.id)
                                        : [...prev.tops, performer.id],
                                      // Remove from bottoms if adding to tops
                                      bottoms: isTop ? prev.bottoms : prev.bottoms.filter(id => id !== performer.id)
                                    }));
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isTop
                                      ? 'bg-blue-600 text-white border-2 border-blue-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Top {isTop && '✓'}
                                </button>
                                
                                <button
                                  onClick={() => {
                                    setPerformerPositions(prev => ({
                                      ...prev,
                                      bottoms: isBottom
                                        ? prev.bottoms.filter(id => id !== performer.id)
                                        : [...prev.bottoms, performer.id],
                                      // Remove from tops if adding to bottoms
                                      tops: isBottom ? prev.tops : prev.tops.filter(id => id !== performer.id)
                                    }));
                                  }}
                                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                                    isBottom
                                      ? 'bg-pink-600 text-white border-2 border-pink-500'
                                      : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:bg-gray-600'
                                  }`}
                                >
                                  Bottom {isBottom && '✓'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className={`grid gap-4 max-w-6xl mx-auto ${workflowStep === 'cumShot' ? 'grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
                  {options.map((option) => {
                    const isSelected = isMultiSelect
                      ? selectedTags[workflowStep]?.includes(option.name)
                      : selectedTags.performerCount === option.name;
                    const isOnScene = isTagOnScene(option.name);
                    
                    return (
                      <button
                        key={option.name}
                        onClick={() => {
                          if (isMultiSelect) {
                            toggleTag(workflowStep, option.name);
                          } else {
                            setSelectedTags(prev => ({ ...prev, performerCount: option.name }));
                          }
                        }}
                        className={`p-6 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-purple-500 bg-purple-900 bg-opacity-30'
                            : isOnScene
                            ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                            : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-750'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium text-lg">{option.name}</span>
                          {isOnScene && !isSelected && <span className="text-xs text-blue-400">On Scene</span>}
                          {isSelected && <span className="text-2xl">✓</span>}
                        </div>
                        {option.description && (
                          <p className="text-sm text-gray-400 mt-2">{option.description}</p>
                        )}
                      </button>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-4 p-8 border-t border-gray-700 bg-gray-800 bg-opacity-50 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowTaggingWorkflow(false);
                    resetWorkflow();
                  }}
                  className="px-8 py-4 bg-gray-700 text-white text-lg rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWorkflowNext}
                  disabled={
                    workflowStep === 'performerCount'
                      ? !selectedTags.performerCount
                      : false
                  }
                  className="px-8 py-4 bg-purple-600 text-white text-lg font-semibold rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

StashClipOverlay.propTypes = {
  clipData: PropTypes.shape({
    clipId: PropTypes.number,
    scene: PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      details: PropTypes.string,
      date: PropTypes.string,
      rating: PropTypes.number,
      duration: PropTypes.number,
      path: PropTypes.string,
      resolution: PropTypes.string,
      codec: PropTypes.string,
      fileSize: PropTypes.number,
      frameRate: PropTypes.number,
      width: PropTypes.number,
      height: PropTypes.number,
      studio: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        image: PropTypes.string,
      }),
      performers: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          image: PropTypes.string,
        })
      ),
      tags: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          description: PropTypes.string,
        })
      ),
    }),
  }),
  onClose: PropTypes.func.isRequired,
};

export default StashClipOverlay;

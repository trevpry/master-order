import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';
import './ClipTaggingFlowPage.css';

const OVERLAY_STEP_ORDER = [
  'Performer Count',
  'Performer Race',
  'Sex Acts',
  'Masturbation',
  'Oral Sex',
  'Performer Oral',
  'Performer Rimming',
  'Anal Sex',
  'Performer Positions',
  'Cum Shot'
];

const OVERLAY_STEP_CONNECTIONS = [
  ['Performer Count', 'Performer Race'],
  ['Performer Race', 'Sex Acts'],
  ['Sex Acts', 'Masturbation'],
  ['Sex Acts', 'Oral Sex'],
  ['Sex Acts', 'Anal Sex'],
  ['Sex Acts', 'Cum Shot'],
  ['Masturbation', 'Oral Sex'],
  ['Masturbation', 'Anal Sex'],
  ['Masturbation', 'Cum Shot'],
  ['Oral Sex', 'Performer Oral'],
  ['Performer Oral', 'Performer Rimming'],
  ['Performer Oral', 'Anal Sex'],
  ['Performer Oral', 'Cum Shot'],
  ['Performer Rimming', 'Anal Sex'],
  ['Performer Rimming', 'Cum Shot'],
  ['Anal Sex', 'Performer Positions'],
  ['Performer Positions', 'Cum Shot']
];

const buildOverlayWorkflowConfig = (sourceTags = []) => {
  const tagsByName = new Map(sourceTags.map((tag) => [tag.name, tag]));
  const orderedTags = OVERLAY_STEP_ORDER
    .map((name) => tagsByName.get(name))
    .filter(Boolean);

  const connections = {};
  OVERLAY_STEP_CONNECTIONS.forEach(([sourceName, targetName]) => {
    const sourceTag = tagsByName.get(sourceName);
    const targetTag = tagsByName.get(targetName);
    if (!sourceTag || !targetTag) return;

    if (!connections[sourceTag.id]) {
      connections[sourceTag.id] = [];
    }
    if (!connections[sourceTag.id].includes(targetTag.id)) {
      connections[sourceTag.id].push(targetTag.id);
    }
  });

  return { tags: orderedTags, connections };
};

export default function ClipTaggingFlowPage() {
  const [tags, setTags] = useState([]);
  const [workflowTags, setWorkflowTags] = useState([]);
  const [tagConnections, setTagConnections] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [draggedTag, setDraggedTag] = useState(null);
  const [draggedFromWorkflow, setDraggedFromWorkflow] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLinkMode, setShowLinkMode] = useState(false);
  const [linkSourceTag, setLinkSourceTag] = useState(null);
  const [tagPositions, setTagPositions] = useState({});
  const [manualNodePositions, setManualNodePositions] = useState({});
  const [activeNodeDrag, setActiveNodeDrag] = useState(null);

  useEffect(() => {
    loadTags();
    loadWorkflowConfiguration();
  }, []);

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags?rootOnly=false&perPage=10000`);
      const result = await response.json();
      
      if (result.success) {
        // Filter to only tags included in clip tagging
        const clipTaggingTags = (result.data || []).filter(tag => tag.includeInClipTagging !== false);
        setTags(clipTaggingTags);
      } else {
        toast.error(result.error || 'Failed to load tags');
      }
    } catch (err) {
      console.error('Error loading tags:', err);
      toast.error('Failed to load tags');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkflowConfiguration = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const normalized = buildOverlayWorkflowConfig(result.data.tags || []);
        setWorkflowTags(normalized.tags);
        setTagConnections(normalized.connections);
      }
    } catch (err) {
      console.error('Error loading workflow configuration:', err);
    }
  };

  const saveWorkflowConfiguration = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: workflowTags,
          connections: tagConnections
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Workflow configuration saved');
      } else {
        toast.error(result.error || 'Failed to save workflow configuration');
      }
    } catch (err) {
      console.error('Error saving workflow configuration:', err);
      toast.error('Failed to save workflow configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (e, tag, fromWorkflow = false) => {
    setDraggedTag(tag);
    setDraggedFromWorkflow(fromWorkflow);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetTag = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(targetTag);
  };

  const handleDragLeave = (e) => {
    setDropTarget(null);
  };

  const handleDrop = (e, position = null) => {
    e.preventDefault();
    
    if (!draggedTag) return;

    if (draggedFromWorkflow) {
      // Reordering within workflow
      const currentIndex = workflowTags.findIndex(t => t.id === draggedTag.id);
      const newTags = [...workflowTags];
      newTags.splice(currentIndex, 1);
      
      if (position !== null) {
        newTags.splice(position, 0, draggedTag);
      } else {
        newTags.push(draggedTag);
      }
      
      setWorkflowTags(newTags);
    } else {
      // Adding from available tags
      if (!workflowTags.find(t => t.id === draggedTag.id)) {
        if (position !== null) {
          const newTags = [...workflowTags];
          newTags.splice(position, 0, draggedTag);
          setWorkflowTags(newTags);
        } else {
          setWorkflowTags([...workflowTags, draggedTag]);
        }
      }
    }

    setDraggedTag(null);
    setDraggedFromWorkflow(false);
    setDropTarget(null);
  };

  const removeFromWorkflow = (tagId) => {
    setWorkflowTags(workflowTags.filter(t => t.id !== tagId));
    setManualNodePositions((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, tagId)) return prev;
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
    
    // Remove all connections involving this tag
    const newConnections = { ...tagConnections };
    delete newConnections[tagId];
    Object.keys(newConnections).forEach(sourceId => {
      newConnections[sourceId] = newConnections[sourceId].filter(targetId => targetId !== tagId);
      if (newConnections[sourceId].length === 0) {
        delete newConnections[sourceId];
      }
    });
    setTagConnections(newConnections);
  };

  const startLinkMode = (tag) => {
    setShowLinkMode(true);
    setLinkSourceTag(tag);
  };

  const cancelLinkMode = () => {
    setShowLinkMode(false);
    setLinkSourceTag(null);
  };

  const createConnection = (targetTag) => {
    if (!linkSourceTag || linkSourceTag.id === targetTag.id) {
      cancelLinkMode();
      return;
    }

    const newConnections = { ...tagConnections };
    if (!newConnections[linkSourceTag.id]) {
      newConnections[linkSourceTag.id] = [];
    }
    
    if (!newConnections[linkSourceTag.id].includes(targetTag.id)) {
      newConnections[linkSourceTag.id].push(targetTag.id);
      setTagConnections(newConnections);
      toast.success(`Linked "${linkSourceTag.name}" → "${targetTag.name}"`);
    }

    cancelLinkMode();
  };

  const removeConnection = (sourceTagId, targetTagId) => {
    const newConnections = { ...tagConnections };
    if (newConnections[sourceTagId]) {
      newConnections[sourceTagId] = newConnections[sourceTagId].filter(id => id !== targetTagId);
      if (newConnections[sourceTagId].length === 0) {
        delete newConnections[sourceTagId];
      }
      setTagConnections(newConnections);
      toast.success('Connection removed');
    }
  };

  const getConnectedTags = (tagId) => {
    return (tagConnections[tagId] || [])
      .map(id => workflowTags.find(t => t.id === id))
      .filter(Boolean);
  };

  const getIncomingConnections = (tagId) => {
    const incoming = [];
    Object.keys(tagConnections).forEach(sourceId => {
      if ((tagConnections[sourceId] || []).includes(tagId)) {
        const sourceTag = workflowTags.find(t => t.id === parseInt(sourceId) || t.id === sourceId);
        if (sourceTag) {
          incoming.push(sourceTag);
        }
      }
    });
    return incoming;
  };

  const startNodeReposition = (e, tagId) => {
    // Left-click drag only, and ignore action-button clicks.
    if (e.button !== 0) return;
    if (e.target.closest('.mindmap-node-actions')) return;

    const nodeElement = document.getElementById(`workflow-tag-${tagId}`);
    const container = nodeElement?.closest('.workflow-visual-area');
    if (!nodeElement || !container) return;

    const nodeRect = nodeElement.getBoundingClientRect();
    const offsetX = e.clientX - nodeRect.left;
    const offsetY = e.clientY - nodeRect.top;

    e.preventDefault();
    e.stopPropagation();

    setActiveNodeDrag({ tagId, offsetX, offsetY });
  };

  // Calculate standard mind-map layout positions
  const getMindMapLayout = () => {
    if (workflowTags.length === 0) return [];

    const graph = {};
    const inDegree = {};
    const children = {};

    workflowTags.forEach((tag) => {
      const id = String(tag.id);
      graph[id] = tag;
      inDegree[id] = 0;
      children[id] = [];
    });

    Object.keys(tagConnections).forEach((sourceId) => {
      const normalizedSourceId = String(sourceId);
      if (!graph[normalizedSourceId]) return;

      (tagConnections[sourceId] || []).forEach((targetId) => {
        const normalizedTargetId = String(targetId);
        if (!graph[normalizedTargetId]) return;
        children[normalizedSourceId].push(normalizedTargetId);
        inDegree[normalizedTargetId]++;
      });
    });

    const preferredRoot = workflowTags.find((tag) => tag.name === 'Performer Count');
    const rootIds = preferredRoot
      ? [String(preferredRoot.id)]
      : workflowTags
          .map((tag) => String(tag.id))
          .filter((id) => inDegree[id] === 0);

    if (rootIds.length === 0 && workflowTags.length > 0) {
      rootIds.push(String(workflowTags[0].id));
    }

    const levels = [];
    const visited = new Set();
    const queue = rootIds.map((id) => ({ id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (!graph[id] || visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      (children[id] || []).forEach((childId) => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }

    workflowTags.forEach((tag) => {
      const id = String(tag.id);
      if (visited.has(id)) return;
      if (!levels[levels.length]) levels[levels.length] = [];
      levels[levels.length - 1].push(id);
    });

    const layoutData = [];
    const startX = 420;
    const horizontalGap = 300;
    const verticalGap = 160;
    const centerY = 500;

    levels.forEach((levelNodeIds, level) => {
      const totalHeight = (levelNodeIds.length - 1) * verticalGap;
      const firstY = centerY - totalHeight / 2;

      levelNodeIds.forEach((id, index) => {
        const tag = graph[id];
        layoutData.push({
          ...tag,
          level,
          position: {
            x: startX + level * horizontalGap,
            y: firstY + index * verticalGap
          },
          childCount: (children[id] || []).length,
          isRoot: rootIds.includes(id)
        });
      });
    });

    return layoutData;
  };

  const renderedLayout = getMindMapLayout().map((tag) => ({
    ...tag,
    position: manualNodePositions[tag.id] || tag.position
  }));

  // Update tag positions when workflow changes
  useEffect(() => {
    const updatePositions = () => {
      const positions = {};
      const layoutTags = renderedLayout;
      
      layoutTags.forEach((tag) => {
        const element = document.getElementById(`workflow-tag-${tag.id}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const container = element.closest('.workflow-visual-area');
          const containerRect = container?.getBoundingClientRect();
          
          if (containerRect) {
            positions[tag.id] = {
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top + rect.height / 2,
              width: rect.width,
              height: rect.height
            };
          }
        }
      });
      
      setTagPositions(positions);
    };
    
    // Delay to allow DOM to render
    const timer = setTimeout(updatePositions, 100);
    
    // Update on window resize
    window.addEventListener('resize', updatePositions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePositions);
    };
  }, [workflowTags, tagConnections, manualNodePositions]);

  // Reposition nodes via mouse drag on the canvas.
  useEffect(() => {
    if (!activeNodeDrag) return undefined;

    const handleMouseMove = (e) => {
      const container = document.querySelector('.workflow-visual-area');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const nextX = e.clientX - containerRect.left + container.scrollLeft - activeNodeDrag.offsetX;
      const nextY = e.clientY - containerRect.top + container.scrollTop - activeNodeDrag.offsetY;

      setManualNodePositions((prev) => ({
        ...prev,
        [activeNodeDrag.tagId]: {
          x: Math.max(24, nextX),
          y: Math.max(24, nextY)
        }
      }));
    };

    const handleMouseUp = () => {
      setActiveNodeDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeNodeDrag]);

  // Drop stale custom positions when tags leave the workflow.
  useEffect(() => {
    const validIds = new Set(workflowTags.map((tag) => String(tag.id)));
    setManualNodePositions((prev) => {
      let changed = false;
      const next = {};

      Object.keys(prev).forEach((id) => {
        if (validIds.has(String(id))) {
          next[id] = prev[id];
        } else {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [workflowTags]);

  const filteredTags = tags.filter(tag => 
    !workflowTags.find(wt => wt.id === tag.id) &&
    (searchQuery === '' || tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="page pad clip-tagging-flow-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
        {' / '}
        <Link to="/media/stash/tags">Tags</Link>
      </div>

      <div className="header">
        <h1>🎯 Clip Tagging Flow</h1>
        <p className="muted">Configure the tag workflow for clip tagging. Drag tags to reorder them, and link tags to create automatic follow-up suggestions.</p>
      </div>

      {showLinkMode && (
        <div className="link-mode-banner">
          <div className="link-mode-content">
            <span className="link-icon">🔗</span>
            <span>
              <strong>Link Mode:</strong> Click on a tag to connect from "{linkSourceTag?.name}"
            </span>
            <Button onClick={cancelLinkMode}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="workflow-container">
        {/* Available Tags - Left Side */}
        <div className="available-tags-panel">
          <div className="panel-header">
            <h3>📋 Available Tags ({filteredTags.length})</h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
          <div className="tags-list">
            {isLoading ? (
              <div className="loading-message">Loading tags...</div>
            ) : filteredTags.length === 0 ? (
              <div className="empty-message">
                {searchQuery ? 'No matching tags found' : 'All tags are in the workflow'}
              </div>
            ) : (
              filteredTags.map(tag => (
                <div
                  key={tag.id}
                  className="available-tag-item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, tag, false)}
                >
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-hint">Drag to add →</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workflow Tags - Right Side */}
        <div className="workflow-tags-panel">
          <div className="panel-header">
            <h3>🎯 Workflow Order ({workflowTags.length})</h3>
            <div className="action-buttons">
              <Button
                onClick={saveWorkflowConfiguration}
                disabled={isSaving}
                className="save-btn"
              >
                {isSaving ? 'Saving...' : '💾 Save'}
              </Button>
            </div>
          </div>

          <div className="workflow-visual-area">
            {/* SVG for connection lines */}
            <svg className="connection-lines-svg" style={{ width: '2000px', height: '1000px' }}>
              {Object.keys(tagConnections).map(sourceId => {
                const sourcePos = tagPositions[sourceId];
                if (!sourcePos) return null;
                
                return (tagConnections[sourceId] || []).map(targetId => {
                  const targetPos = tagPositions[targetId];
                  if (!targetPos) return null;
                  
                  // Start from right edge of source, end at left edge of target
                  const startX = sourcePos.x + (sourcePos.width / 2);
                  const startY = sourcePos.y;
                  const endX = targetPos.x - (targetPos.width / 2);
                  const endY = targetPos.y;
                  
                  // Calculate bezier curve control points for organic mind map feel
                  const dx = endX - startX;
                  const dy = endY - startY;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  // Control point offset for smooth curves
                  const controlOffset = Math.max(distance * 0.4, 80);
                  const cx1 = startX + controlOffset;
                  const cy1 = startY;
                  const cx2 = endX - controlOffset;
                  const cy2 = endY;
                  
                  return (
                    <g key={`${sourceId}-${targetId}`} className="connection-group">
                      <defs>
                        <marker
                          id={`arrowhead-${sourceId}-${targetId}`}
                          markerWidth="10"
                          markerHeight="10"
                          refX="9"
                          refY="3"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3, 0 6"
                            fill="#667eea"
                          />
                        </marker>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <path
                        d={`M ${startX} ${startY} 
                            C ${cx1} ${cy1},
                              ${cx2} ${cy2},
                              ${endX} ${endY}`}
                        stroke="#667eea"
                        strokeWidth="2"
                        fill="none"
                        markerEnd={`url(#arrowhead-${sourceId}-${targetId})`}
                        className="connection-line"
                        filter="url(#glow)"
                      />
                    </g>
                  );
                });
              })}
            </svg>

            {workflowTags.length === 0 ? (
              <div className="empty-workflow">
                <p>🧠 Drag tags here to build your mind map</p>
                <small>Tags will be connected in a visual workflow</small>
              </div>
            ) : (
              <div className="mindmap-container">
                {renderedLayout.map((tag, index) => {
                  const connectedTags = getConnectedTags(tag.id);
                  const incomingTags = getIncomingConnections(tag.id);
                  const isDragging = activeNodeDrag?.tagId === tag.id;
                  const hasConnections = connectedTags.length > 0 || incomingTags.length > 0;
                  const isConnectedTo = incomingTags.length > 0;
                  
                  // Generate color based on level
                  const colors = [
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple
                    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink
                    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue
                    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green
                    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Orange
                  ];
                  const colorIndex = tag.level >= 0 ? tag.level % colors.length : 0;

                  return (
                    <div
                      key={tag.id}
                      id={`workflow-tag-${tag.id}`}
                      className={`mindmap-node ${isDragging ? 'dragging' : ''} ${tag.isRoot ? 'root-node' : ''} ${hasConnections ? 'has-connections' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tag, true)}
                      style={{
                        left: `${tag.position.x}px`,
                        top: `${tag.position.y}px`,
                        '--node-color': colors[colorIndex],
                        '--node-level': tag.level,
                        zIndex: isDragging ? 1000 : 10 + (5 - tag.level)
                      }}
                    >
                      <div className="mindmap-node-inner">
                        {tag.isRoot && <div className="root-indicator">🎯</div>}
                        <div className="mindmap-node-header">
                          <div className="mindmap-node-number">{index + 1}</div>
                          <div className="mindmap-node-content">
                            <div className="mindmap-node-name">{tag.name}</div>
                            {(connectedTags.length > 0 || incomingTags.length > 0) && (
                              <div className="mindmap-node-meta">
                                {connectedTags.length > 0 && `${connectedTags.length} out`}
                                {connectedTags.length > 0 && incomingTags.length > 0 && ' · '}
                                {incomingTags.length > 0 && `${incomingTags.length} in`}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mindmap-node-actions">
                          <button
                            className={`link-btn ${showLinkMode && linkSourceTag?.id === tag.id ? 'active' : ''}`}
                            onClick={() => showLinkMode ? createConnection(tag) : startLinkMode(tag)}
                            title={showLinkMode ? "Click to link" : "Create connection"}
                          >
                            {showLinkMode && linkSourceTag?.id === tag.id ? '🔗' : 
                             showLinkMode ? '🎯' : '🔗'}
                          </button>
                          <button
                            className="remove-btn"
                            onClick={() => removeFromWorkflow(tag.id)}
                            title="Remove from workflow"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Always-visible connection details */}
                      {(connectedTags.length > 0 || incomingTags.length > 0) && (
                        <div className="mindmap-node-meta">
                          {incomingTags.length} in • {connectedTags.length} out
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="workflow-info">
        <h3>🧠 How the Mind Map Works</h3>
        <ul>
          <li><strong>Visual Layout:</strong> Tags are arranged in a mind map style with connections showing the flow</li>
          <li><strong>Root Nodes:</strong> Tags with a 🎯 icon are starting points in the workflow</li>
                      className={`mindmap-node ${isDragging ? 'dragging repositioning' : ''} ${tag.isRoot ? 'root-node' : ''} ${hasConnections ? 'has-connections' : ''}`}
                      onMouseDown={(e) => startNodeReposition(e, tag.id)}
          <li><strong>Color Coding:</strong> Different levels in the hierarchy have different colors for easy visualization</li>
        </ul>
      </div>
    </div>
  );
}

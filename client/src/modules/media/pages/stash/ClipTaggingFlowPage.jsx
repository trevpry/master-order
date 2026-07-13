import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';
import './ClipTaggingFlowPage.css';

export default function ClipTaggingFlowPage() {
  const [allTags, setAllTags] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [columnNames, setColumnNames] = useState({});
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelDragTag, setPanelDragTag] = useState(null);
  const [activeNodeDrag, setActiveNodeDrag] = useState(null);
  const [linkSource, setLinkSource] = useState(null);
  const [nodeCentres, setNodeCentres] = useState({});
  const [hoveredConnection, setHoveredConnection] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOverNode, setDragOverNode] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    loadAllTags();
    loadWorkflow();
    loadColumnNames();
  }, []);

  const loadAllTags = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/tags?rootOnly=false&perPage=10000`);
      const result = await res.json();
      if (result.success) setAllTags(result.data || []);
    } catch { /* ignore */ }
  };

  const loadWorkflow = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow`);
      const result = await res.json();
      if (result.success) {
        const loadedNodes = result.data.nodes || [];
        const loadedConns = result.data.connections || [];
        if (loadedNodes.length === 0) {
          // First load — auto-seed with the overlay default flow
          await seedWorkflow(false);
        } else {
          setNodes(loadedNodes);
          setConnections(loadedConns);
        }
      }
    } catch (err) {
      console.error('Error loading workflow:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const seedWorkflow = async (confirm = true) => {
    if (confirm && !window.confirm('Reset canvas to the overlay default flow? This will overwrite your current layout.')) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow/seed`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setNodes(result.data.nodes || []);
        setConnections(result.data.connections || []);
        const missing = result.data.missing || [];
        if (missing.length > 0) {
          toast(`Loaded defaults. Missing tags not in DB: ${missing.join(', ')}`, { icon: '⚠️' });
        } else {
          toast.success('Loaded overlay default flow');
        }
      } else {
        toast.error('Seed failed');
      }
    } catch (err) {
      console.error('Error seeding workflow:', err);
      toast.error('Seed failed');
    } finally {
      setIsLoading(false);
    }
  };

  const saveWorkflow = async () => {
    try {
      setIsSaving(true);
      const payload = {
        nodes: nodes.map((n) => ({
          tagId: n.tagId ?? n.tag?.id,
          column: n.column ?? 0,
          positionX: n.positionX,
          positionY: n.positionY
        })),
        connections
      };
      const res = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setNodes(result.data.nodes || []);
        setConnections(result.data.connections || []);
        toast.success('Workflow saved');
      } else {
        toast.error(result.error || 'Save failed');
      }
    } catch (err) {
      console.error('Error saving workflow:', err);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const loadColumnNames = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow/column-names`);
      const result = await res.json();
      if (result.success) {
        const namesMap = {};
        (result.data.columnNames || []).forEach((cn) => {
          namesMap[cn.column] = cn.name;
        });
        setColumnNames(namesMap);
      }
    } catch (err) {
      console.error('Error loading column names:', err);
    }
  };

  const saveColumnNames = async (updatedNames) => {
    try {
      const columnNamesList = Object.entries(updatedNames).map(([col, name]) => ({
        column: parseInt(col),
        name: name || ''
      }));

      const res = await fetch(`${config.apiBaseUrl}/api/stash/clip-tagging-workflow/column-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnNames: columnNamesList })
      });
      const result = await res.json();
      if (result.success) {
        const namesMap = {};
        (result.data.columnNames || []).forEach((cn) => {
          namesMap[cn.column] = cn.name;
        });
        setColumnNames(namesMap);
        toast.success('Column names saved');
      } else {
        toast.error('Failed to save column names');
      }
    } catch (err) {
      console.error('Error saving column names:', err);
      toast.error('Failed to save column names');
    }
  };

  const startEditColumn = (colIdx, currentName) => {
    setEditingColumn(colIdx);
    setEditingName(currentName);
  };

  const finishEditColumn = async (colIdx) => {
    const updatedNames = { ...columnNames, [colIdx]: editingName };
    setColumnNames(updatedNames);
    await saveColumnNames(updatedNames);
    setEditingColumn(null);
  };

  const applyTagToColumn = async (colIdx, tag) => {
    console.log('🎯 applyTagToColumn called:', { colIdx, tagId: tag.id, tagName: tag.name });
    toast.info(`🔧 Processing ${tag.name}...`);
    
    // Set column name to tag name
    const updatedNames = { ...columnNames, [colIdx]: tag.name };
    setColumnNames(updatedNames);
    await saveColumnNames(updatedNames);

    // Look up the full tag object from allTags to get complete children data
    console.log('🔍 Looking up full tag from allTags. allTags.length =', allTags.length);
    const fullTag = allTags.find((t) => t.id === tag.id) || tag;
    console.log('✅ Found fullTag:', { fullTagId: fullTag.id, fullTagName: fullTag.name, childrenLength: fullTag.children?.length || 0 });
    
    let childTags = fullTag.children || [];
    if (childTags.length === 0) {
      console.log('⚠️  No children array on tag, filtering by parent...');
      childTags = allTags.filter((t) => t.parent && t.parent.id === fullTag.id);
      console.log('✅ Found', childTags.length, 'child tags via parent filter');
    }
    const tagsToAdd = childTags;

    // Filter out tags already in the workflow
    const existingTagIds = new Set(nodes.map((n) => n.tagId ?? n.tag?.id));
    console.log('  Existing tag IDs:', existingTagIds.size);
    const tagsToAddFiltered = tagsToAdd.filter((t) => !existingTagIds.has(t.id));
    console.log('  After filtering duplicates:', tagsToAddFiltered.length, 'tags to add');

    // Add all tags in a single state update
    if (tagsToAddFiltered.length > 0) {
      setNodes((prev) => {
        const nodesInCol = prev.filter((n) => (n.column ?? 0) === colIdx);
        let nextPosX = nodesInCol.length > 0 ? Math.max(...nodesInCol.map((n) => n.positionX ?? 0)) + 50 : 0;

        const newNodes = tagsToAddFiltered.map((t) => {
          const node = {
            tagId: t.id,
            tag: { id: t.id, name: t.name, image: t.image },
            column: colIdx,
            positionX: nextPosX,
            positionY: colIdx * 120 + 50
          };
          nextPosX += 50;
          return node;
        });

        console.log('  Setting', newNodes.length, 'new nodes');
        return [...prev, ...newNodes];
      });

      toast.success(
        `Column "${tag.name}" created with ${tagsToAddFiltered.length} child tag${tagsToAddFiltered.length !== 1 ? 's' : ''}`
      );
    }
  };

  const addTagsToColumn = (colIdx, tag) => {
    // Add just the single tag WITHOUT renaming the column (used for drops on column area, not header)
    
    const tagsToAdd = [tag];

    // Filter out tags already in the workflow
    const existingTagIds = new Set(nodes.map((n) => n.tagId ?? n.tag?.id));
    console.log('  Existing tag IDs:', existingTagIds.size);
    const tagsToAddFiltered = tagsToAdd.filter((t) => !existingTagIds.has(t.id));
    console.log('  After filtering duplicates:', tagsToAddFiltered.length, 'tags to add');

    // Add all tags in a single state update
    if (tagsToAddFiltered.length > 0) {
      setNodes((prev) => {
        const nodesInCol = prev.filter((n) => (n.column ?? 0) === colIdx);
        let nextPosX = nodesInCol.length > 0 ? Math.max(...nodesInCol.map((n) => n.positionX ?? 0)) + 50 : 0;

        const newNodes = tagsToAddFiltered.map((t) => {
          const node = {
            tagId: t.id,
            tag: { id: t.id, name: t.name, image: t.image },
            column: colIdx,
            positionX: nextPosX,
            positionY: colIdx * 120 + 50
          };
          nextPosX += 50;
          return node;
        });

        console.log('  Setting', newNodes.length, 'new nodes');
        return [...prev, ...newNodes];
      });

      toast.success(
        `Added ${tag.name} to column`
      );
    }
  };



  const startNodeDrag = (e, tagId) => {
    if (e.button !== 0) return;
    if (e.target.closest('.node-actions')) return;
    if (linkSource !== null) return;
    const el = document.getElementById(`wfnode-${tagId}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    e.preventDefault();
    e.stopPropagation();
    setActiveNodeDrag({ tagId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
  };

  useEffect(() => {
    if (!activeNodeDrag) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(10, e.clientX - rect.left + canvas.scrollLeft - activeNodeDrag.offsetX);
      const y = Math.max(10, e.clientY - rect.top + canvas.scrollTop - activeNodeDrag.offsetY);
      setNodes((prev) =>
        prev.map((n) =>
          (n.tagId ?? n.tag?.id) === activeNodeDrag.tagId ? { ...n, positionX: x, positionY: y } : n
        )
      );
    };
    const onUp = () => setActiveNodeDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeNodeDrag]);

  // Attach native drop listeners to handle browser drag-and-drop
  useEffect(() => {
    // Add document-level drop handler to prevent default browser behavior everywhere
    const handleDocumentDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };
    
    const handleDocumentDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);

    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
    };
  }, []);

  useEffect(() => {
    // Attach CAPTURE-PHASE listeners to column nodes - these fire before React can interfere
    const attachListeners = () => {
      const nodeElements = document.querySelectorAll('.column-node');
      
      const handleNativeDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const targetEl = e.currentTarget;
        const targetTagId = parseInt(targetEl.id.replace('wfnode-', ''));
        const sourcTagId = window.__dragData?.tagId;
        
        if (!sourcTagId || !targetTagId || sourcTagId === targetTagId) {
          return;
        }

        // Reorder nodes
        setNodes((prev) => {
          // Convert to numbers for consistent comparison
          const sourcNum = parseInt(sourcTagId);
          const targetNum = parseInt(targetTagId);
          const draggedIdx = prev.findIndex((n) => {
            const nId = parseInt(n.tagId ?? n.tag?.id);
            return nId === sourcNum;
          });
          const targetIdx = prev.findIndex((n) => {
            const nId = parseInt(n.tagId ?? n.tag?.id);
            return nId === targetNum;
          });

          if (draggedIdx === -1 || targetIdx === -1) {
            return prev;
          }

          const draggedNode_data = prev[draggedIdx];
          const targetNode_data = prev[targetIdx];
          const columnId = draggedNode_data.column ?? 0;

          if (columnId !== (targetNode_data.column ?? 0)) {
            return prev;
          }

          const colNodes = prev.filter((n) => (n.column ?? 0) === columnId);
          const sortedByPos = colNodes.sort((a, b) => (a.positionX ?? 0) - (b.positionX ?? 0));
          
          const draggedPos = sortedByPos.findIndex((n) => {
            const nId = parseInt(n.tagId ?? n.tag?.id);
            return nId === sourcNum;
          });
          const targetPos = sortedByPos.findIndex((n) => {
            const nId = parseInt(n.tagId ?? n.tag?.id);
            return nId === targetNum;
          });
          
          if (draggedPos === -1 || targetPos === -1) {
            return prev;
          }
          
          const newSorted = [...sortedByPos];
          [newSorted[draggedPos], newSorted[targetPos]] = [newSorted[targetPos], newSorted[draggedPos]];
          
          const newNodes = prev.map((n) => {
            const nNum = parseInt(n.tagId ?? n.tag?.id);
            const idx = newSorted.findIndex((s) => {
              const sNum = parseInt(s.tagId ?? s.tag?.id);
              return sNum === nNum;
            });
            if (idx !== -1 && (n.column ?? 0) === columnId) {
              return { ...n, positionX: idx * 50 };
            }
            return n;
          });

          return newNodes;
        });

        setDraggedNode(null);
        setDragOverNode(null);
        window.__dragData = null;
      };

      const handleNativeDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      };

      nodeElements.forEach((el) => {
        // Use capture phase (true) to intercept before React can interfere
        el.addEventListener('drop', handleNativeDrop, true);
        el.addEventListener('dragover', handleNativeDragOver, true);
      });

      return () => {
        nodeElements.forEach((el) => {
          el.removeEventListener('drop', handleNativeDrop, true);
          el.removeEventListener('dragover', handleNativeDragOver, true);
        });
      };
    };

    // Attach listeners immediately and re-attach when nodes change
    const cleanup = attachListeners();
    return cleanup;
  }, [nodes, draggedNode]);

  // Refs so the drop event handlers always call the latest function without re-attaching listeners
  const applyTagToColumnRef = useRef(applyTagToColumn);
  const addTagsToColumnRef = useRef(addTagsToColumn);
  useEffect(() => { applyTagToColumnRef.current = applyTagToColumn; });
  useEffect(() => { addTagsToColumnRef.current = addTagsToColumn; });

  useEffect(() => {
    // Use MutationObserver to handle dynamically-created header elements
    // and attach drop listeners directly (drop events don't bubble)
    const canvasEl = canvasRef.current;
    console.log('🔧 useEffect [SETUP] running, canvasRef.current exists?', !!canvasEl);
    
    if (!canvasEl) {
      console.log('❌ useEffect [SETUP] FAILED: Canvas element not found!');
      return;
    }
    
    console.log('✅ useEffect [SETUP] Canvas found, setting up listeners');

    const handleHeaderDragEnter = (e) => {
      console.log('🎯 DRAGENTER on header:', e.currentTarget, 'tag data:', window.__panelDragTag ? window.__panelDragTag.name : 'null');
      console.log('  Phase:', e.eventPhase === 1 ? 'CAPTURING' : e.eventPhase === 2 ? 'AT_TARGET' : e.eventPhase === 3 ? 'BUBBLING' : e.eventPhase);
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
        console.log('✅ DRAGENTER: dropEffect set to copy');
      }
      if (window.__panelDragTag) {
        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        console.log('✅ DRAGENTER: Header highlighted');
      } else {
        console.log('⚠️ DRAGENTER: No __panelDragTag set!');
      }
    };

    const handleHeaderDragOver = (e) => {
      console.log('🔄 DRAGOVER on header');
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (window.__panelDragTag) {
        e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      }
    };

    const handleHeaderDragLeave = (e) => {
      console.log('👋 DRAGLEAVE from header');
      e.currentTarget.style.backgroundColor = '';
    };

    const handleHeaderDrop = (e) => {
      console.log('💧 DROP on header FIRED!');
      console.log('💧 DROP: e.dataTransfer =', e.dataTransfer);
      console.log('💧 DROP: window.__panelDragTag =', window.__panelDragTag);
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.style.backgroundColor = '';

      const dragTag = window.__panelDragTag;
      if (dragTag) {
        // Get the column index
        let colIdx = 0;
        const allHeaders = canvasEl.querySelectorAll('.column-header');
        for (let i = 0; i < allHeaders.length; i++) {
          if (allHeaders[i] === e.currentTarget) {
            colIdx = i;
            break;
          }
        }

        console.log('✅ DROP: Applying tag', dragTag.name, 'to column', colIdx);
        applyTagToColumnRef.current(colIdx, dragTag);
        setPanelDragTag(null);
        window.__panelDragTag = null;
      } else {
        console.log('❌ DROP: No dragTag available!');
      }
    };

    // Function to attach listeners to a header element
    const attachListenersToHeader = (header) => {
      console.log('🔗 Attaching listeners to header:', header);
      // CRITICAL: Use capture phase (true) for drop events to work!
      header.addEventListener('dragenter', handleHeaderDragEnter, true);
      console.log('  ✓ dragenter attached (capture)');
      header.addEventListener('dragover', handleHeaderDragOver, true);
      console.log('  ✓ dragover attached (capture)');
      header.addEventListener('dragleave', handleHeaderDragLeave, true);
      console.log('  ✓ dragleave attached (capture)');
      header.addEventListener('drop', handleHeaderDrop, true);
      console.log('  ✓ drop attached (capture)');
      console.log('✅ All listeners attached to header');
    };

    // Function to remove listeners from a header element
    const removeListenersFromHeader = (header) => {
      header.removeEventListener('dragenter', handleHeaderDragEnter, true);
      header.removeEventListener('dragover', handleHeaderDragOver, true);
      header.removeEventListener('dragleave', handleHeaderDragLeave, true);
      header.removeEventListener('drop', handleHeaderDrop, true);
    };

    // Column drop handlers
    const handleColumnDragEnter = (e) => {
      const colDiv = e.currentTarget;
      if (!colDiv.classList.contains('workflow-column')) return;
      console.log('🎯 DRAGENTER on column');
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (window.__panelDragTag) {
        colDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        console.log('✅ DRAGENTER column: highlighted');
      }
    };

    const handleColumnDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleColumnDragLeave = (e) => {
      const colDiv = e.currentTarget;
      if (!colDiv.classList.contains('workflow-column')) return;
      colDiv.style.backgroundColor = '';
      console.log('👋 DRAGLEAVE column');
    };

    const handleColumnDrop = (e) => {
      console.log('💧 DROP on column FIRED!');
      console.log('  e.target:', e.target.tagName, '| class:', e.target.className, '| closest .column-header:', !!e.target.closest?.('.column-header'));
      e.preventDefault();
      e.stopPropagation();
      
      const colDiv = e.currentTarget;
      if (!colDiv.classList.contains('workflow-column')) return;
      colDiv.style.backgroundColor = '';

      const dragTag = window.__panelDragTag;
      if (dragTag) {
        // Get the column index by counting position
        let colIdx = 0;
        const allColumns = canvasEl.querySelectorAll('.workflow-column');
        for (let i = 0; i < allColumns.length; i++) {
          if (allColumns[i] === colDiv) {
            colIdx = i;
            break;
          }
        }

        // Check if drop landed within the header's bounding rect (more reliable than e.target.closest)
        const headerEl = colDiv.querySelector('.column-header');
        let droppedOnHeader = false;
        if (headerEl) {
          const rect = headerEl.getBoundingClientRect();
          droppedOnHeader = e.clientY >= rect.top && e.clientY <= rect.bottom &&
                            e.clientX >= rect.left && e.clientX <= rect.right;
        }
        console.log('  droppedOnHeader:', droppedOnHeader, '| headerRect:', headerEl?.getBoundingClientRect());

        if (droppedOnHeader) {
          console.log('✅ DROP column→header: Applying tag', dragTag.name, 'to column', colIdx);
          applyTagToColumnRef.current(colIdx, dragTag);
        } else {
          console.log('✅ DROP column: Adding tag', dragTag.name, 'to column', colIdx);
          addTagsToColumnRef.current(colIdx, dragTag);
        }
        setPanelDragTag(null);
        window.__panelDragTag = null;
      } else {
        console.log('❌ DROP column: No dragTag available!');
      }
    };

    // Function to attach listeners to a column element
    const attachListenersToColumn = (column) => {
      console.log('🔗 Attaching listeners to column');
      column.addEventListener('dragenter', handleColumnDragEnter, true);
      column.addEventListener('dragover', handleColumnDragOver, true);
      column.addEventListener('dragleave', handleColumnDragLeave, true);
      column.addEventListener('drop', handleColumnDrop, true);
      console.log('✅ Column drop listeners attached');
    };

    // Function to remove listeners from a column element
    const removeListenersFromColumn = (column) => {
      column.removeEventListener('dragenter', handleColumnDragEnter, true);
      column.removeEventListener('dragover', handleColumnDragOver, true);
      column.removeEventListener('dragleave', handleColumnDragLeave, true);
      column.removeEventListener('drop', handleColumnDrop, true);
    };

    // Attach listeners to all existing headers
    const existingHeaders = canvasEl.querySelectorAll('.column-header');
    console.log('📌 [SETUP] Found', existingHeaders.length, 'existing headers, attaching listeners');
    existingHeaders.forEach(attachListenersToHeader);

    // Attach listeners to all existing columns
    const existingColumns = canvasEl.querySelectorAll('.workflow-column');
    console.log('📌 [SETUP] Found', existingColumns.length, 'existing columns, attaching listeners');
    existingColumns.forEach(attachListenersToColumn);

    // Use MutationObserver to detect when new headers and columns are added
    const observer = new MutationObserver((mutations) => {
      const isDragging = !!window.__panelDragTag;
      console.log('👁️ [MUTATION] Detected', mutations.length, 'mutations', isDragging ? '⚠️ DURING DRAG!' : '');
      mutations.forEach((mutation) => {
        // Check for added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.classList && node.classList.contains('column-header')) {
              console.log('✨ [MUTATION] New header added, attaching listeners', isDragging ? '⚠️ DURING DRAG!' : '');
              attachListenersToHeader(node);
            }
            if (node.classList && node.classList.contains('workflow-column')) {
              console.log('✨ [MUTATION] New column added, attaching listeners', isDragging ? '⚠️ DURING DRAG!' : '');
              attachListenersToColumn(node);
            }
            // Also check for headers and columns within this node
            if (node.querySelectorAll) {
              node.querySelectorAll('.column-header').forEach(attachListenersToHeader);
              node.querySelectorAll('.workflow-column').forEach(attachListenersToColumn);
            }
          }
        });

        // Check for removed nodes
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList) {
            if (node.classList.contains('column-header')) {
              console.log('🗑️ [MUTATION] Header removed, cleaning up listeners', isDragging ? '⚠️ DURING DRAG!' : '');
              removeListenersFromHeader(node);
            }
            if (node.classList.contains('workflow-column')) {
              console.log('🗑️ [MUTATION] Column removed, cleaning up listeners', isDragging ? '⚠️ DURING DRAG!' : '');
              removeListenersFromColumn(node);
            }
          }
        });
      });
    });

    // Also listen to dragend at the document level to clean up if drag ends without a drop
    const handleGlobalDragEnd = (e) => {
      console.log('🧹 GLOBAL DRAGEND: Clearing __panelDragTag after 100ms delay');
      // Use a small delay to ensure drop handlers fire first
      setTimeout(() => {
        if (window.__panelDragTag) {
          console.log('🗑️ Cleared __panelDragTag');
          window.__panelDragTag = null;
        }
      }, 100);
    };

    // Listen to global dragover to debug what elements are receiving events
    const handleGlobalDragOver = (e) => {
      if (window.__panelDragTag) {
        console.log('🌍 GLOBAL dragover on:', e.target.className || e.target.tagName);
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd, true);
    document.addEventListener('dragover', handleGlobalDragOver, true);

    // Start observing for header mutations
    observer.observe(canvasEl, {
      childList: true,
      subtree: true,
      attributes: false
    });
    console.log('✅ [SETUP] MutationObserver started');

    // Cleanup
    return () => {
      console.log('🧹 [CLEANUP] Cleaning up drag listeners');
      observer.disconnect();
      existingHeaders.forEach(removeListenersFromHeader);
      existingColumns.forEach(removeListenersFromColumn);
      document.removeEventListener('dragend', handleGlobalDragEnd, true);
      document.removeEventListener('dragover', handleGlobalDragOver, true);
      console.log('✅ [CLEANUP] All listeners removed');
    };
  }, []);

  // NOTE: Tag drag is now handled via React onDragStart/onDragEnd handlers in JSX
  // (removed native listeners to avoid conflicts with React handlers)

  const handleNodeClick = (tagId) => {
    if (!linkSource) return;
    if (linkSource === tagId) { setLinkSource(null); return; }
    const already = connections.some(
      (c) => c.sourceTagId === linkSource && c.targetTagId === tagId
    );
    if (!already) {
      const newConn = { sourceTagId: linkSource, targetTagId: tagId };
      console.log('🔗 Adding connection:', newConn);
      setConnections((prev) => [...prev, newConn]);
      toast.success('Connection added');
    }
    setLinkSource(null);
  };

  const removeConnection = (sourceTagId, targetTagId) => {
    const srcNode = nodes.find((n) => (n.tagId ?? n.tag?.id) === sourceTagId);
    const tgtNode = nodes.find((n) => (n.tagId ?? n.tag?.id) === targetTagId);
    const srcName = srcNode?.tag?.name ?? sourceTagId;
    const tgtName = tgtNode?.tag?.name ?? targetTagId;
    
    setConnections((prev) =>
      prev.filter((c) => !(c.sourceTagId === sourceTagId && c.targetTagId === targetTagId))
    );
    toast.success(`Removed: ${srcName} → ${tgtName}`);
  };

  const removeNode = (tagId) => {
    setNodes((prev) => prev.filter((n) => (n.tagId ?? n.tag?.id) !== tagId));
    setConnections((prev) =>
      prev.filter((c) => c.sourceTagId !== tagId && c.targetTagId !== tagId)
    );
  };

  const moveNodeToColumn = (tagId, newColumn) => {
    setNodes((prev) => {
      // Get nodes moving to the new column and assign sequential positionX
      const nodesInNewCol = prev.filter((n) => (n.column ?? 0) === newColumn && (n.tagId ?? n.tag?.id) !== tagId);
      const maxX = nodesInNewCol.length > 0 ? Math.max(...nodesInNewCol.map((n) => n.positionX ?? 0)) : -50;
      const newPosX = maxX + 50; // Increment by 50 for each node in the column
      
      return prev.map((n) => {
        const nTagId = n.tagId ?? n.tag?.id;
        if (nTagId === tagId) {
          return { ...n, column: newColumn, positionX: newPosX, positionY: newColumn * 120 + 50 };
        }
        return n;
      });
    });
  };

  const handleNodeDragStart = (e, tagId) => {
    setDraggedNode(tagId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tagId));
    // Store in window for native drop listener
    window.__dragData = { tagId };
  };

  const handleNodeDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleNodeDragEnter = (targetTagId) => {
    if (draggedNode && draggedNode !== targetTagId) {
      setDragOverNode(targetTagId);
    }
  };

  const handleNodeDragLeave = () => {
    setDragOverNode(null);
  };

  const handleNodeDrop = (e, targetTagId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode || draggedNode === targetTagId) {
      setDraggedNode(null);
      setDragOverNode(null);
      return;
    }

    setNodes((prev) => {
      const draggedIdx = prev.findIndex((n) => (n.tagId ?? n.tag?.id) === draggedNode);
      const targetIdx = prev.findIndex((n) => (n.tagId ?? n.tag?.id) === targetTagId);

      if (draggedIdx === -1 || targetIdx === -1) return prev;

      // Only reorder if in same column
      const draggedNode_data = prev[draggedIdx];
      const targetNode_data = prev[targetIdx];
      const columnId = draggedNode_data.column ?? 0;

      if (columnId !== (targetNode_data.column ?? 0)) {
        return prev; // Can't drag between columns
      }

      // Get all nodes in this column and sort by positionX
      const colNodes = prev.filter((n) => (n.column ?? 0) === columnId);
      const sortedByPos = colNodes.sort((a, b) => (a.positionX ?? 0) - (b.positionX ?? 0));
      
      // Find positions in the sorted list
      const draggedPos = sortedByPos.findIndex((n) => (n.tagId ?? n.tag?.id) === draggedNode);
      const targetPos = sortedByPos.findIndex((n) => (n.tagId ?? n.tag?.id) === targetTagId);
      
      if (draggedPos === -1 || targetPos === -1) return prev;
      
      // Swap in sorted list
      const newSorted = [...sortedByPos];
      [newSorted[draggedPos], newSorted[targetPos]] = [newSorted[targetPos], newSorted[draggedPos]];
      
      // Reassign sequential positionX values (0, 50, 100, 150, ...)
      const newNodes = prev.map((n) => {
        const nTagId = n.tagId ?? n.tag?.id;
        const idx = newSorted.findIndex((s) => (s.tagId ?? s.tag?.id) === nTagId);
        if (idx !== -1 && (n.column ?? 0) === columnId) {
          return { ...n, positionX: idx * 50 };
        }
        return n;
      });

      return newNodes;
    });

    setDraggedNode(null);
    setDragOverNode(null);
  };

  const updateCentres = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const map = {};
    nodes.forEach((n) => {
      const id = n.tagId ?? n.tag?.id;
      const el = document.getElementById(`wfnode-${id}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      map[id] = {
        cx: r.left - canvasRect.left + canvas.scrollLeft + r.width / 2,
        cy: r.top - canvasRect.top + canvas.scrollTop + r.height / 2,
        width: r.width,
        height: r.height
      };
    });
    setNodeCentres(map);
  }, [nodes]);

  useEffect(() => {
    const t = setTimeout(updateCentres, 60);
    window.addEventListener('resize', updateCentres);
    return () => { clearTimeout(t); window.removeEventListener('resize', updateCentres); };
  }, [updateCentres]);

  const nodeTagIds = new Set(nodes.map((n) => n.tagId ?? n.tag?.id));
  const availableTags = allTags.filter(
    (t) =>
      !nodeTagIds.has(t.id) &&
      (searchQuery === '' || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="page pad clip-tagging-flow-page">
      <div className="breadcrumb">
        <Link to="/media/stash">{'<- Back to Stash'}</Link>
        {' / '}
        <Link to="/media/stash/tags">Tags</Link>
      </div>

      <div className="header">
        <h1>Clip Tagging Flow</h1>
        <p className="muted">
          Drag tags onto the canvas, drag nodes to reposition, click the link button then another node to connect them. Save persists to the database.
        </p>
      </div>

      {linkSource && (
        <div className="link-mode-banner">
          <div className="link-mode-content">
            <span className="link-icon">Link Mode:</span>
            <span>
              Click a node to connect from &quot;
              {nodes.find((n) => (n.tagId ?? n.tag?.id) === linkSource)?.tag?.name}&quot;
            </span>
            <Button onClick={() => setLinkSource(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="workflow-container">
        <div className="available-tags-panel">
          <div className="panel-header">
            <h3>Available Tags ({availableTags.length})</h3>
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
              <div className="loading-message">Loading...</div>
            ) : availableTags.length === 0 ? (
              <div className="empty-message">
                {searchQuery ? 'No matching tags' : 'All tags are on the canvas'}
              </div>
            ) : (
              availableTags.map((tag) => (
                <div
                  key={tag.id}
                  className="available-tag-item"
                  draggable
                  onDragStart={(e) => {
                    window.__panelDragTag = tag;
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/json', JSON.stringify({ tagId: tag.id, tagName: tag.name }));
                  }}
                  onDragEnd={(e) => {
                  }}
                >
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-hint">drag to add</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="workflow-tags-panel">
          <div className="panel-header">
            <h3>Canvas ({nodes.length} nodes, {connections.length} connections)</h3>
            <div className="action-buttons">
              <Button onClick={() => seedWorkflow(true)} disabled={isLoading} className="reset-btn">
                ↺ Reset to Defaults
              </Button>
              <Button onClick={saveWorkflow} disabled={isSaving} className="save-btn">
                {isSaving ? 'Saving...' : '💾 Save'}
              </Button>
            </div>
          </div>

          <div
            className="workflow-visual-area"
            ref={canvasRef}
          >
            <svg className="connection-lines-svg">
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#667eea" />
                </marker>
              </defs>
              {connections.map((c) => {
                const src = nodeCentres[c.sourceTagId];
                const tgt = nodeCentres[c.targetTagId];
                if (!src || !tgt) return null;
                
                // Start from center of right edge of source tag
                const x1 = src.cx + src.width / 2;
                const y1 = src.cy;
                
                // End at center of left edge of target tag
                const x2 = tgt.cx - tgt.width / 2;
                const y2 = tgt.cy;
                
                const dx = x2 - x1;
                const dy = y2 - y1;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const ctrl = Math.max(dist * 0.4, 60);
                const d = `M${x1},${y1} C${x1 + ctrl},${y1} ${x2 - ctrl},${y2} ${x2},${y2}`;
                const connKey = `${c.sourceTagId}-${c.targetTagId}`;
                const isHovered = hoveredConnection === connKey;
                return (
                  <g
                    key={connKey}
                    className="connection-group"
                    onClick={() => removeConnection(c.sourceTagId, c.targetTagId)}
                    onMouseEnter={() => setHoveredConnection(connKey)}
                    onMouseLeave={() => setHoveredConnection(null)}
                    style={{ cursor: 'pointer' }}
                    title="Click to remove this connection"
                  >
                    <path d={d} stroke="transparent" strokeWidth="12" fill="none" />
                    <path 
                      d={d} 
                      stroke={isHovered ? '#ef4444' : '#667eea'} 
                      strokeWidth={isHovered ? 3 : 2} 
                      fill="none" 
                      markerEnd="url(#arrow)" 
                      className="connection-line"
                      style={{
                        filter: isHovered ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.35))',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {nodes.length === 0 && (
              <div className="empty-workflow">
                <p>Drag tags from the left panel to build your workflow</p>
              </div>
            )}

            <div className="workflow-columns">
              {(() => {
                // Get max column number from nodes
                const maxCol = Math.max(...nodes.map((n) => n.column ?? 0), 0);
                const columns = Array.from({ length: maxCol + 2 }, (_, i) => i);

                return columns.map((colIdx) => {
                  const colNodes = nodes.filter((n) => (n.column ?? 0) === colIdx);
                  const sortedNodes = colNodes.sort((a, b) => (a.positionX ?? 0) - (b.positionX ?? 0));

                  return (
                    <div key={`col-${colIdx}`} className="workflow-column">
                      <div
                        className="column-header"
                        style={{ cursor: panelDragTag ? 'copy' : 'default' }}
                        title="Drag a tag here to set column name and add its child tags"
                      >
                        {editingColumn === colIdx ? (
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') finishEditColumn(colIdx);
                                if (e.key === 'Escape') setEditingColumn(null);
                              }}
                              autoFocus
                              style={{
                                flex: 1,
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.875rem',
                                border: '1px solid #ccc',
                                borderRadius: '4px'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                finishEditColumn(colIdx);
                              }}
                              style={{
                                padding: '0.25rem 0.75rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px'
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingColumn(null);
                              }}
                              style={{
                                padding: '0.25rem 0.75rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 style={{ flex: 1, margin: 0 }}>
                              {columnNames[colIdx] || `Column ${colIdx + 1}`}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditColumn(colIdx, columnNames[colIdx] || '');
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                marginLeft: '0.5rem'
                              }}
                            >
                              Rename
                            </button>
                            <span className="node-count" style={{ marginLeft: '0.5rem' }}>
                              {sortedNodes.length} nodes
                            </span>
                          </>
                        )}
                      </div>
                      <div className="column-nodes">
                        {sortedNodes.map((node) => {
                          const tagId = node.tagId ?? node.tag?.id;
                          const tagName = node.tag?.name ?? tagId;
                          const isLinkSrc = linkSource === tagId;
                          const outCount = connections.filter((c) => c.sourceTagId === tagId).length;
                          const inCount = connections.filter((c) => c.targetTagId === tagId).length;

                          return (
                            <div
                              key={tagId}
                              id={`wfnode-${tagId}`}
                              className={`column-node${isLinkSrc ? ' link-source' : ''}${draggedNode === tagId ? ' dragging' : ''}${dragOverNode === tagId ? ' drag-over' : ''}`}
                              onClick={() => handleNodeClick(tagId)}
                              draggable
                              onDragStart={(e) => handleNodeDragStart(e, tagId)}
                              onDragOver={handleNodeDragOver}
                              onDragEnter={() => handleNodeDragEnter(tagId)}
                              onDragLeave={handleNodeDragLeave}
                              onDrop={(e) => handleNodeDrop(e, tagId)}
                              style={{
                                cursor: linkSource ? 'crosshair' : draggedNode === tagId ? 'grabbing' : 'grab'
                              }}
                            >
                              <div className="column-node-content">
                                <div className="column-node-name">{tagName}</div>
                                {(inCount > 0 || outCount > 0) && (
                                  <div className="column-node-meta">{inCount} in · {outCount} out</div>
                                )}
                              </div>
                              <div className="column-node-actions">
                                {colIdx > 0 && (
                                  <button
                                    className="col-btn"
                                    onClick={(e) => { e.stopPropagation(); moveNodeToColumn(tagId, colIdx - 1); }}
                                    title="Move to previous column"
                                  >
                                    &lt;
                                  </button>
                                )}
                                <button
                                  className={`link-btn${isLinkSrc ? ' active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setLinkSource(isLinkSrc ? null : tagId); }}
                                  title="Draw connection"
                                >
                                  link
                                </button>
                                {colIdx < maxCol + 1 && (
                                  <button
                                    className="col-btn"
                                    onClick={(e) => { e.stopPropagation(); moveNodeToColumn(tagId, colIdx + 1); }}
                                    title="Move to next column"
                                  >
                                    &gt;
                                  </button>
                                )}
                                <button
                                  className="remove-btn"
                                  onClick={(e) => { e.stopPropagation(); removeNode(tagId); }}
                                  title="Remove from canvas"
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

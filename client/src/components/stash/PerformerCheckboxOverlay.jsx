import React from 'react';

const styles = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '0.5rem',
    pointerEvents: 'none',
    zIndex: 100,
  },
  checkboxContainer: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '0.375rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  checkboxContainerHover: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    transform: 'scale(1.05)',
  },
  checkbox: {
    width: '1.25rem',
    height: '1.25rem',
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  selectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: '3px solid #3b82f6',
    borderRadius: '0.5rem',
    pointerEvents: 'none',
    zIndex: 9,
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
  },
};

export default function PerformerCheckboxOverlay({ 
  performerId, 
  isSelected, 
  onToggle 
}) {
  const [isHovering, setIsHovering] = React.useState(false);

  console.log('📦 Rendering PerformerCheckboxOverlay for performer:', performerId, 'isSelected:', isSelected);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🖱️ Checkbox clicked for performer:', performerId);
    onToggle(performerId);
  };

  const handleMouseDown = (e) => {
    console.log('⬇️ Mouse down on checkbox for performer:', performerId);
  };

  const handleMouseUp = (e) => {
    console.log('⬆️ Mouse up on checkbox for performer:', performerId);
  };

  return (
    <>
      {isSelected && <div style={styles.selectedBorder} />}
      <div style={styles.overlay}>
        <div
          style={{
            ...styles.checkboxContainer,
            ...(isHovering ? styles.checkboxContainerHover : {}),
            // DEBUG: Make it very visible
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            border: '2px solid yellow',
          }}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseEnter={() => {
            console.log('🐭 Mouse entered checkbox for performer:', performerId);
            setIsHovering(true);
          }}
          onMouseLeave={() => {
            console.log('🐭 Mouse left checkbox for performer:', performerId);
            setIsHovering(false);
          }}
        >
          {isSelected ? '✓' : ''}
        </div>
      </div>
    </>
  );
}

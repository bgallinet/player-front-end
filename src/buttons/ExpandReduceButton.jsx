import React from 'react';

const ExpandReduceButton = ({ 
    isExpanded, 
    onToggle, 
    expandedIcon = '−', 
    reducedIcon = '+',
    style = {}
}) => {
    return (
        <span
            onClick={onToggle}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
            style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: 'white',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                transition: 'opacity 0.2s ease',
                userSelect: 'none',
                ...style
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.7'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
        >
            {isExpanded ? expandedIcon : reducedIcon}
        </span>
    );
};

export default ExpandReduceButton;

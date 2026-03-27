import React from 'react';
import { Button } from 'react-bootstrap';
import { secondaryColor } from '../../utils/DisplaySettings';

const CloseButton = ({ 
    onClick, 
    size = "lg",
    style = {},
    ...props 
}) => {
    return (
        <Button
            variant="outline-light"
            size={size}
            onClick={onClick}
            style={{
                borderColor: secondaryColor,
                fontSize: '1.2rem',
                padding: '0.5rem 1rem',
                minWidth: '3rem',
                ...style
            }}
            {...props}
        >
            ✕
        </Button>
    );
};

export default CloseButton;

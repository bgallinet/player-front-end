import React, { createContext, useContext, useState, useEffect } from 'react';

const TutorialContext = createContext();

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

export const TutorialProvider = ({ children }) => {
    const [isTutorialMode, setIsTutorialMode] = useState(() => {
        // Initialize from localStorage
        const saved = localStorage.getItem('tutorialMode');
        return saved ? JSON.parse(saved) : false;
    });

    const toggleTutorialMode = () => {
        const newMode = !isTutorialMode;
        setIsTutorialMode(newMode);
        localStorage.setItem('tutorialMode', JSON.stringify(newMode));
    };

    const disableTutorialMode = () => {
        setIsTutorialMode(false);
        localStorage.setItem('tutorialMode', JSON.stringify(false));
    };

    // Save to localStorage whenever tutorial mode changes
    useEffect(() => {
        localStorage.setItem('tutorialMode', JSON.stringify(isTutorialMode));
    }, [isTutorialMode]);

    const value = {
        isTutorialMode,
        toggleTutorialMode,
        disableTutorialMode
    };

    return (
        <TutorialContext.Provider value={value}>
            {children}
        </TutorialContext.Provider>
    );
}; 
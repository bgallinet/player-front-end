import React, { createContext, useContext, useState } from 'react';

const TutorialContext = createContext();

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};

export const TutorialProvider = ({ children }) => {
    const [isTutorialMode, setIsTutorialMode] = useState(false);

    const toggleTutorialMode = () => {
        const newMode = !isTutorialMode;
        setIsTutorialMode(newMode);
    };

    const disableTutorialMode = () => {
        setIsTutorialMode(false);
    };

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
import React from 'react';

// EmotionDisplay is a component that displays the emotions of the user directly on the UI, or as count of emotions for the creator
const EmotionDisplay = ({ emotions, color, role }) => {
    const minFontSize = 0.75; // Minimum font size in rem
    return (
        <div>
            {role === 'creator' ? (
                Object.entries(emotions)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([emotionType, confidence], index) => {
                        const fontSize = Math.max(minFontSize, confidence / 16); // Convert px to rem
                        return (
                            <div key={index} style={{ fontSize: `${fontSize}rem`, color: color }}>
                                {emotionType}
                            </div>
                        );
                    })
            ) : (
                <div style={{
                    position: 'relative',
                    width: '20rem',
                    height: '20rem'
                }}>
                    <div style={{
                        position: 'absolute',
                        width: '18.75rem',
                        height: '18.75rem',
                        borderRadius: '50%',
                        backgroundColor: 'black',
                        border: '0.125rem solid white',
                        left: '0.625rem',
                        top: '0.625rem'
                    }} />
                    {Object.entries(emotions)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([emotionType, confidence], index, array) => {
                            // Calculate position on a polygon
                            const totalEmotions = array.length;
                            const angle = (2 * Math.PI * index) / totalEmotions;
                            const radius = 6.25; // Size of the polygon in rem
                            const x = radius * Math.cos(angle);
                            const y = radius * Math.sin(angle);

                            return (
                                <div 
                                    key={index}
                                    style={{
                                        position: 'absolute',
                                        transform: `translate(${x + 7.1875}rem, ${y + 9.375}rem)`,
                                        color: confidence > 20 ? '#028cd5' : color,
                                        fontWeight: confidence > 20 ? 'bold' : 'normal'
                                    }}
                                >
                                    {emotionType}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export default EmotionDisplay;
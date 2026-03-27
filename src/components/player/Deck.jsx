import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { Text, StyledCard } from '../../utils/StyledComponents';
import CloseButton from '../buttons/CloseButton';
import { secondaryColor } from '../../utils/DisplaySettings';
import SoundConsole from '../audio_processing/SoundConsole';

/** Bootstrap `sm` and below: phone-sized layout (centered console modal vs side drawer). */
const NARROW_VIEWPORT_MEDIA = '(max-width: 575.98px)';

/**
 * One mixing deck: transport UI (children) + slide-out sound console tied to `audioRef`.
 * Console is hidden until the user opens it (always mounted for stable Web Audio graph).
 */
const Deck = ({
    audioRef,
    volume,
    baseVolume,
    onVolumeChange,
    eqMappings,
    volumeMappings,
    recommendation,
    rhythmicEnhancementMappings,
    reverbMappings,
    noddingAmplitude,
    children,
    consoleZIndex = 1045
}) => {
    const [consoleOpen, setConsoleOpen] = useState(false);
    const [isNarrowViewport, setIsNarrowViewport] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia(NARROW_VIEWPORT_MEDIA).matches
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia(NARROW_VIEWPORT_MEDIA);
        const onChange = () => setIsNarrowViewport(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const consolePanelStyle = isNarrowViewport
        ? {
              position: 'fixed',
              left: '50%',
              top: '50%',
              zIndex: consoleZIndex,
              boxSizing: 'border-box',
              width: 'min(420px, calc(100vw - 2rem))',
              maxHeight: 'min(90vh, 900px)',
              backgroundColor: '#1a1a1a',
              border: `1px solid ${secondaryColor}`,
              borderRadius: '12px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
              padding: '1rem',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              transform: 'translate(-50%, -50%)',
              opacity: consoleOpen ? 1 : 0,
              visibility: consoleOpen ? 'visible' : 'hidden',
              pointerEvents: consoleOpen ? 'auto' : 'none',
              transition: 'opacity 0.2s ease, visibility 0.2s ease'
          }
        : {
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(420px, 100vw)',
              zIndex: consoleZIndex,
              boxSizing: 'border-box',
              backgroundColor: '#1a1a1a',
              borderLeft: `1px solid ${secondaryColor}`,
              boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
              padding: '1rem',
              overflowY: 'auto',
              transform: consoleOpen ? 'translateX(0)' : 'translateX(100%)',
              visibility: consoleOpen ? 'visible' : 'hidden',
              pointerEvents: consoleOpen ? 'auto' : 'none',
              transition: 'transform 0.2s ease, visibility 0.2s ease'
          };

    return (
        <>
            <StyledCard className="mb-0" style={{ position: 'relative', zIndex: 0 }}>
                <div className="d-flex align-items-center justify-content-end mb-2 flex-wrap gap-2">
                    <Button
                        variant="outline-light"
                        size="sm"
                        type="button"
                        onClick={() => setConsoleOpen((o) => !o)}
                        style={{ borderColor: secondaryColor }}
                    >
                        {consoleOpen ? 'Hide sound console' : 'Sound console'}
                    </Button>
                </div>
                {children}
            </StyledCard>

            <div aria-hidden={!consoleOpen} style={consolePanelStyle}>
                <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
                    <Text style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Sound console</Text>
                    <CloseButton
                        type="button"
                        onClick={() => setConsoleOpen(false)}
                        size="sm"
                        style={{ flexShrink: 0 }}
                        aria-label="Close sound console"
                    />
                </div>
                <SoundConsole
                    audioRef={audioRef}
                    volume={volume}
                    baseVolume={baseVolume}
                    onVolumeChange={onVolumeChange}
                    eqMappings={eqMappings}
                    volumeMappings={volumeMappings}
                    recommendation={recommendation}
                    rhythmicEnhancementMappings={rhythmicEnhancementMappings}
                    reverbMappings={reverbMappings}
                    noddingAmplitude={noddingAmplitude}
                />
            </div>

            {consoleOpen && (
                <div
                    role="presentation"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: consoleZIndex - 5,
                        background: 'rgba(0,0,0,0.45)'
                    }}
                    onClick={() => setConsoleOpen(false)}
                />
            )}
        </>
    );
};

export default Deck;

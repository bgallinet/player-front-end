import React from 'react';
import { Button } from 'react-bootstrap';
import { secondaryColor } from '../../utils/DisplaySettings';
import { MODE_C_THUMB_TEMPO_STEP_BPM } from './modeCThumbTempoOverride';

/**
 * Test-only UI for experiment 20260504 Mode C: manual BPM up/down using the same
 * thumb-tempo step as `reaction.fixed.20260504c` (camera thumbs remain available).
 *
 * @param {{
 *   show?: boolean,
 *   thumbBpmControlRef?: React.MutableRefObject<import('./modeCThumbTempoOverride').ThumbBpmControlHandle>,
 *   onTempoStep?: (direction: import('./modeCThumbTempoOverride').ThumbTempoDirection) => void,
 * }} props
 */
const ModeCThumbTempoOverrideButtons = ({ show = false, thumbBpmControlRef, onTempoStep }) => {
    if (!show) {
        return null;
    }

    const applyStep = (direction) => {
        onTempoStep?.(direction);
        thumbBpmControlRef?.current?.applyStep?.(direction);
    };

    const buttonStyle = {
        minWidth: '140px',
        padding: '0.65rem 1.25rem',
        borderColor: secondaryColor,
    };

    return (
        <div className="d-flex justify-content-center gap-2 flex-wrap w-100 mb-3">
            <Button
                type="button"
                variant="outline-light"
                onClick={() => applyStep('down')}
                style={buttonStyle}
                aria-label="Tempo down"
            >
                Tempo down
            </Button>
            <Button
                type="button"
                variant="outline-light"
                onClick={() => applyStep('up')}
                style={buttonStyle}
                aria-label="Tempo up"
            >
                Tempo up
            </Button>
        </div>
    );
};

export default ModeCThumbTempoOverrideButtons;
export { MODE_C_THUMB_TEMPO_STEP_BPM };

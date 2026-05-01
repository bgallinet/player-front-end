import {
    DEFAULT_DELAY_MAPPINGS,
    DEFAULT_EQ_MAPPINGS,
    DEFAULT_KEY_SHIFT_MAPPINGS,
    DEFAULT_REVERB_MAPPINGS,
    DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    DEFAULT_VOLUME_MAPPINGS,
    DEFAULT_BPM_SHIFT_MAPPINGS,
} from './reactionMappingDefaults.v1';
import { CueRingBuffer } from '../timeline/CueRingBuffer';
import { compileReactionRecommendation } from './compileReactionRecommendation';
import { DECLARATIVE_RULES_TEST_PACK_V1 } from './declarativeReactionRules';
import { REACTION_PLAYBACK_PROFILE } from './reactionPlaybackProfiles.v1';

const mappingBundle = (override = {}) => ({
    eqMappings: DEFAULT_EQ_MAPPINGS,
    volumeMappings: DEFAULT_VOLUME_MAPPINGS,
    rhythmicEnhancementMappings: DEFAULT_RHYTHMIC_ENHANCEMENT_MAPPINGS,
    reverbMappings: DEFAULT_REVERB_MAPPINGS,
    delayMappings: DEFAULT_DELAY_MAPPINGS,
    keyShiftMappings: DEFAULT_KEY_SHIFT_MAPPINGS,
    bpmShiftMappings: DEFAULT_BPM_SHIFT_MAPPINGS,
    ...override,
});

describe('compileReactionRecommendation', () => {
    test('baseline thumb up uses mapping table key shift (+2 default)', () => {
        const buf = new CueRingBuffer({ retentionMs: 60000 });
        const ref = { current: null };
        const rec = compileReactionRecommendation({
            buffer: buf,
            feed: {
                emotionDataArray: [],
                noddingAmplitude: 0,
                handsRaised: false,
                thumbUpActive: true,
                thumbDownActive: false,
            },
            policyBundle: mappingBundle({ declarativeRules: [] }),
            prevDominantFaceToneRef: ref,
            analysisWindowMs: 1000,
            sampleHz: 10,
            nowMs: 200000,
        });
        expect(rec).not.toBeNull();
        expect(rec.emotionState).toBe(REACTION_PLAYBACK_PROFILE.THUMB_UP);
        expect(rec.playbackProfile).toBe(REACTION_PLAYBACK_PROFILE.THUMB_UP);
        expect(rec.keyShiftSemitones).toBe(2);
        expect(rec.appliedDeclarativeRules).toEqual([]);
    });

    test('declarative test rule overrides key shift to +1', () => {
        const buf = new CueRingBuffer({ retentionMs: 60000 });
        const ref = { current: null };
        const rec = compileReactionRecommendation({
            buffer: buf,
            feed: {
                emotionDataArray: [],
                noddingAmplitude: 0,
                handsRaised: false,
                thumbUpActive: true,
                thumbDownActive: false,
            },
            policyBundle: mappingBundle({ declarativeRules: DECLARATIVE_RULES_TEST_PACK_V1 }),
            prevDominantFaceToneRef: ref,
            analysisWindowMs: 1000,
            sampleHz: 10,
            nowMs: 300000,
        });
        expect(rec.keyShiftSemitones).toBe(1);
        expect(rec.appliedDeclarativeRules).toContain('test.thumb_up.key_plus_one_semitone');
    });
});

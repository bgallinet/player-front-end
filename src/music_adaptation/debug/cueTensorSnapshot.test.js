import {
    buildCueTensorSnapshot,
    getLastCueTensorSnapshotForDebug,
    emitCueTensorDebugSnapshot,
} from './cueTensorSnapshot';
import { getCueChannelCountV1 } from '../schema/cueSchema.v1';

beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('buildCueTensorSnapshot', () => {
    const t0 = 1_700_000_000_000;

    test('fills gesture channels consistently across frames', () => {
        const tensor = buildCueTensorSnapshot({
            emotionDataArray: [],
            noddingAmplitude: 0,
            nowMs: t0,
            windowMs: 200,
            targetHz: 5,
            handsRaised: true,
            thumbUpActive: true,
            thumbDownActive: false,
        });

        expect(tensor.frameCount).toBe(1);
        const F = getCueChannelCountV1();
        expect(tensor.frames.length).toBe(tensor.frameCount * F);
        expect(tensor.frames[F - 3]).toBe(1); // hands_raised
        expect(tensor.frames[F - 2]).toBe(1); // thumb_up
        expect(tensor.frames[F - 1]).toBe(0); // thumb_down
    });

    test('thumb_down suppresses thumb_up (matches Player arbitration)', () => {
        const tensor = buildCueTensorSnapshot({
            emotionDataArray: [],
            noddingAmplitude: 0,
            nowMs: t0,
            windowMs: 100,
            targetHz: 10,
            thumbUpActive: true,
            thumbDownActive: true,
        });
        const F = getCueChannelCountV1();
        expect(tensor.frames[F - 2]).toBe(0);
        expect(tensor.frames[F - 1]).toBe(1);
    });

    test('forward-fills vision from latest datapoint <= grid time', () => {
        const tensor = buildCueTensorSnapshot({
            emotionDataArray: [
                { timestamp: t0 - 150, smiling: 0.2, jawOpen: 0.1, amplitude: 0.05, frequency: 1.5 },
                { timestamp: t0 - 50, smiling: 0.9, jawOpen: 0, amplitude: 0.06, frequency: 2 },
            ],
            noddingAmplitude: 0.01,
            nowMs: t0,
            windowMs: 200,
            targetHz: 10,
            handsRaised: false,
            thumbUpActive: false,
            thumbDownActive: false,
        });

        expect(tensor.frameCount).toBe(2);
        const F = getCueChannelCountV1();
        const row0 = tensor.frames.subarray(0, F);
        const row1 = tensor.frames.subarray(F, F * 2);
        expect(row0[0]).toBeCloseTo(0.2);
        expect(row1[0]).toBeCloseTo(0.9);
    });

    test('emitCueTensorDebugSnapshot stores last snapshot', () => {
        emitCueTensorDebugSnapshot(
            {
                emotionDataArray: [],
                nowMs: t0,
                windowMs: 100,
                targetHz: 10,
            },
            { label: 'test' }
        );
        const last = getLastCueTensorSnapshotForDebug();
        expect(last).not.toBeNull();
        expect(last.schemaVersion).toBeTruthy();
        expect(last.frames.length).toBe(last.frameCount * getCueChannelCountV1());
    });
});

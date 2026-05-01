import { CueRingBuffer } from './CueRingBuffer';
import { buildPushPatchFromSensingFeed } from '../policy/compileReactionRecommendation';

describe('CueRingBuffer', () => {
    test('pushPartialUpdate carries channels forward', () => {
        const buf = new CueRingBuffer({ retentionMs: 60000 });
        buf.pushPartialUpdate({ 'vision.face.smiling': 0.5 }, 1000);
        buf.pushPartialUpdate({ 'gesture.thumb_up': 1 }, 1010);
        const tensor = buf.sampleWindow(100, 10, 1010);
        expect(tensor.frameCount).toBeGreaterThanOrEqual(1);
        const lastIdx = tensor.channelNames.indexOf('gesture.thumb_up');
        const smileIdx = tensor.channelNames.indexOf('vision.face.smiling');
        const off = (tensor.frameCount - 1) * tensor.channelNames.length;
        expect(tensor.frames[off + lastIdx]).toBe(1);
        expect(tensor.frames[off + smileIdx]).toBeCloseTo(0.5);
    });

    test('sampleWindow forward-fills from prior pushes', () => {
        const buf = new CueRingBuffer({ retentionMs: 60000 });
        const F = buf.channelIds.length;
        buf.pushPartialUpdate(buildPushPatchFromSensingFeed({ emotionDataArray: [], thumbUpActive: true }), 5000);
        buf.pushPartialUpdate(buildPushPatchFromSensingFeed({ emotionDataArray: [], thumbUpActive: false }), 5100);
        const tensor = buf.sampleWindow(200, 50, 5100);
        expect(tensor.frames.length).toBe(tensor.frameCount * F);
        expect(tensor.frameCount).toBeGreaterThanOrEqual(5);
    });
});

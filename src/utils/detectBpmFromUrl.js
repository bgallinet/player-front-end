import { guess } from 'web-audio-beat-detector';

/** Max decoded audio for tempo estimation (seconds). Spotify previews are ~30s. */
export const TRACK_BPM_ANALYZE_MAX_SECONDS = 30;

async function analyzeBufferBpm(buffer, maxSeconds) {
    const dur = Math.min(maxSeconds, buffer?.duration || 0);
    if (dur < 1) return null;
    const { bpm } = await guess(buffer, 0, dur);
    return Number.isFinite(bpm) ? Math.round(bpm) : null;
}

/**
 * Estimate BPM from a fetchable audio URL (preview MP3, stream URL, blob URL).
 */
export async function detectBpmFromAudioUrl(url, { maxSeconds = TRACK_BPM_ANALYZE_MAX_SECONDS, signal } = {}) {
    if (!url || typeof url !== 'string') return null;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    const decodeCtx = new Ctor();
    try {
        const res = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            cache: 'default',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            signal,
            headers: {
                Accept: 'audio/mpeg, audio/*, */*',
            },
        });
        if (!res.ok) return null;

        const raw = await res.arrayBuffer();
        if (!raw?.byteLength) return null;

        const buffer = await decodeCtx.decodeAudioData(raw.slice(0));
        return analyzeBufferBpm(buffer, maxSeconds);
    } catch {
        return null;
    } finally {
        decodeCtx.close().catch(() => {});
    }
}

/**
 * Decode preview via muted &lt;audio&gt; capture when fetch/CORS decode fails.
 */
export async function detectBpmViaMediaElement(url, { maxSeconds = TRACK_BPM_ANALYZE_MAX_SECONDS, signal } = {}) {
    if (!url || typeof url !== 'string') return null;

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.muted = true;
    audio.volume = 0;

    if (signal?.aborted) return null;

    await new Promise((resolve, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        const onReady = () => {
            cleanup();
            resolve();
        };
        const onErr = () => {
            cleanup();
            reject(new Error('preview load failed'));
        };
        const cleanup = () => {
            signal?.removeEventListener('abort', onAbort);
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('error', onErr);
        };
        signal?.addEventListener('abort', onAbort);
        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('error', onErr, { once: true });
        audio.src = url;
        audio.load();
    });

    const ctx = new Ctor();
    await ctx.resume();

    const source = ctx.createMediaElementSource(audio);
    const mute = ctx.createGain();
    mute.gain.value = 0;

    const sampleRate = ctx.sampleRate;
    const duration = Math.min(maxSeconds, audio.duration || maxSeconds);
    const totalSamples = Math.max(1, Math.floor(duration * sampleRate));
    const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const channel = buffer.getChannelData(0);

    let offset = 0;
    const script = ctx.createScriptProcessor(4096, 1, 1);

    const captureDone = new Promise((resolve) => {
        script.onaudioprocess = (e) => {
            if (offset >= totalSamples) return;
            const input = e.inputBuffer.getChannelData(0);
            const remain = totalSamples - offset;
            const copy = Math.min(input.length, remain);
            channel.set(input.subarray(0, copy), offset);
            offset += copy;
            if (offset >= totalSamples) resolve();
        };
    });

    source.connect(script);
    script.connect(mute);
    mute.connect(ctx.destination);

    try {
        await audio.play();
        await Promise.race([
            captureDone,
            new Promise((resolve) => {
                setTimeout(resolve, duration * 1000 + 500);
            }),
        ]);
    } catch {
        await ctx.close().catch(() => {});
        return null;
    } finally {
        audio.pause();
        audio.src = '';
        script.disconnect();
        mute.disconnect();
        source.disconnect();
    }

    await ctx.close().catch(() => {});

    const analyzedSeconds = offset / sampleRate;
    if (analyzedSeconds < 1) return null;

    const { bpm } = await guess(buffer, 0, analyzedSeconds);
    return Number.isFinite(bpm) ? Math.round(bpm) : null;
}

/** Try fetch+decode, then muted media-element capture. */
export async function detectBpmFromPreviewUrl(url, options = {}) {
    const { allowMediaElement = true, ...rest } = options;
    const fromFetch = await detectBpmFromAudioUrl(url, rest);
    if (fromFetch) return fromFetch;
    if (!allowMediaElement) return null;
    try {
        return await detectBpmViaMediaElement(url, rest);
    } catch {
        return null;
    }
}

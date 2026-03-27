function trackIdFromApiHref(str) {
    if (typeof str !== 'string') return null;
    const m = str.match(/\/tracks\/(\d+)(?:\/|$|[?#])/);
    return m ? m[1] : null;
}

/**
 * Id string for `GET /tracks/{id}` and `/streams` (not like-entry UUIDs).
 * Like rows use `urn: soundcloud:likes:track:<uuid>` — the last segment is not a track id.
 * List payloads may omit numeric `id` but include `self`, `uri`, or a `tracks:` URN tail.
 */
export function soundCloudTrackIdForApi(track) {
    if (track == null || typeof track !== 'object') return null;

    const rawId = track.id ?? track.track_id;
    if (typeof rawId === 'number' && Number.isFinite(rawId) && rawId > 0) {
        return String(Math.trunc(rawId));
    }
    if (rawId != null && rawId !== '') {
        const s = String(rawId).trim();
        if (/^\d+$/.test(s)) return s;
    }

    const selfHref =
        typeof track.self === 'string'
            ? track.self
            : track.self && typeof track.self === 'object' && typeof track.self.href === 'string'
              ? track.self.href
              : null;
    const fromSelf = selfHref ? trackIdFromApiHref(selfHref) : null;
    if (fromSelf) return fromSelf;

    if (typeof track.uri === 'string' && track.uri.includes('api.soundcloud.com')) {
        const fromUri = trackIdFromApiHref(track.uri);
        if (fromUri) return fromUri;
    }

    for (const urnKey of ['track_urn', 'urn']) {
        const urn = track[urnKey];
        if (typeof urn !== 'string' || !urn.includes('soundcloud:')) continue;
        const parts = urn.split(':');
        const ti = parts.indexOf('tracks');
        if (ti >= 0 && parts[ti + 1] != null) {
            const seg = String(parts[ti + 1]).trim();
            if (seg.length > 0) return seg;
        }
    }
    return null;
}

export function unwrapLikedTrackRow(item) {
    if (item == null || typeof item !== 'object') return null;

    if (typeof item.track === 'number' && Number.isFinite(item.track) && item.track > 0) {
        return { id: Math.trunc(item.track) };
    }

    if (typeof item.track === 'string' && /^https?:\/\//i.test(item.track.trim())) {
        return { permalink_url: item.track.trim() };
    }

    const nested =
        item.track != null && typeof item.track === 'object' && Object.keys(item.track).length > 0
            ? item.track
            : null;

    if (nested) {
        if (soundCloudTrackIdForApi(nested) == null) {
            const fromParent = soundCloudTrackIdForApi(item);
            if (fromParent != null) return { ...nested, id: Number(fromParent) };
            if (typeof item.track_urn === 'string') return { ...nested, urn: item.track_urn };
        }
        return nested;
    }

    return item;
}

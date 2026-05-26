import {
    getSpotifyPlaylistSelectionForMode,
    selectSpotifyPlaylistTracks,
} from './spotifyPlaylistSelection';

const tracks = [
    { id: '1', uri: 'spotify:track:1', title: 'Low', artist: 'A', bpm: 80 },
    { id: '2', uri: 'spotify:track:2', title: 'Mid', artist: 'B', bpm: 120 },
    { id: '3', uri: 'spotify:track:3', title: 'High', artist: 'C', bpm: 160 },
    { id: '4', uri: 'spotify:track:4', title: 'Fourth', artist: 'D', bpm: 100 },
];

describe('spotifyPlaylistSelection', () => {
    test('Mode A uses playlist order', () => {
        const sel = getSpotifyPlaylistSelectionForMode('Mode A');
        expect(sel.strategy).toBe('playlist_order');
        const picked = selectSpotifyPlaylistTracks(tracks, sel, 3);
        expect(picked.map((t) => t.id)).toEqual(['1', '2', '3']);
    });

    test('Mode B picks highest BPM when energy is high', () => {
        const sel = getSpotifyPlaylistSelectionForMode('Mode B', { energyThreshold: 5 });
        const picked = selectSpotifyPlaylistTracks(tracks, sel, 3, { energySurvey: 8 });
        expect(picked.map((t) => t.id)).toEqual(['4', '2', '3']);
    });

    test('Mode C returns random subset of correct size', () => {
        const sel = getSpotifyPlaylistSelectionForMode('Mode C');
        const picked = selectSpotifyPlaylistTracks(tracks, sel, 2);
        expect(picked).toHaveLength(2);
    });
});

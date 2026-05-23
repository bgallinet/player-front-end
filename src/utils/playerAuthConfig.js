/** Auth provider required before entering a player route. */
export const PLAYER_AUTH = Object.freeze({
    TUNETRIBES: 'tunetribes',
    SPOTIFY: 'spotify',
    SOUNDCLOUD: 'soundcloud',
});

export const PLAYER_AUTH_LABELS = {
    [PLAYER_AUTH.TUNETRIBES]: 'TuneTribes',
    [PLAYER_AUTH.SPOTIFY]: 'Spotify',
    [PLAYER_AUTH.SOUNDCLOUD]: 'SoundCloud',
};

/** Homepage player destinations (shown without prior login). */
export const PLAYER_DESTINATIONS = [
    {
        id: 'local',
        label: 'Local files',
        path: '/localplayer',
        auth: PLAYER_AUTH.TUNETRIBES,
        style: { borderColor: '#028cd5' },
    },
    {
        id: 'test20260504',
        label: 'Start test',
        path: '/testplayer/20260504',
        auth: PLAYER_AUTH.TUNETRIBES,
    },
    {
        id: 'test20260518',
        label: 'Start test',
        path: '/testplayer/20260518',
        auth: PLAYER_AUTH.SPOTIFY,
    },
    {
        id: 'spotify',
        label: 'Spotify',
        path: '/spotifyplayer',
        auth: PLAYER_AUTH.SPOTIFY,
        style: { borderColor: '#1DB954', color: '#1DB954' },
    },
    {
        id: 'soundcloud',
        label: 'SoundCloud',
        path: '/soundcloudplayer',
        auth: PLAYER_AUTH.SOUNDCLOUD,
        style: { borderColor: '#ff5500', color: '#ff5500' },
    },
];

export function getPlayerDestinationByPath(pathname) {
    return PLAYER_DESTINATIONS.find((d) => d.path === pathname) || null;
}

export function getPlayerDestinationById(id) {
    return PLAYER_DESTINATIONS.find((d) => d.id === id) || null;
}

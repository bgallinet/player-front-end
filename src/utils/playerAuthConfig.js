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

/** Homepage when `show_player` is absent — public test entry only. */
export const HOME_PLAYER_DESTINATION_IDS_DEFAULT = ['test20260504'];

/** Homepage when `?show_player=all`. */
export const HOME_PLAYER_DESTINATION_IDS_ALL = ['local', 'test20260518', 'spotify', 'soundcloud'];

/** `show_player` query values → destination ids (see PLAYER_DESTINATIONS). */
export const HOME_SHOW_PLAYER_PARAM_TO_DESTINATION_IDS = Object.freeze({
    all: HOME_PLAYER_DESTINATION_IDS_ALL,
    local: ['local'],
    spotify: ['spotify'],
    soundcloud: ['soundcloud'],
    '20260504': ['test20260504'],
    '20260518': ['test20260518'],
});

/**
 * Player buttons shown on the homepage for the current `show_player` URL param.
 * @param {string|null|undefined} showPlayerParam — e.g. `all`, `local`, `spotify`, `20260504`
 */
export function getHomePlayerDestinations(showPlayerParam) {
    const param = typeof showPlayerParam === 'string' ? showPlayerParam.trim() : '';
    const ids =
        (param && HOME_SHOW_PLAYER_PARAM_TO_DESTINATION_IDS[param]) ||
        HOME_PLAYER_DESTINATION_IDS_DEFAULT;
    return PLAYER_DESTINATIONS.filter((d) => ids.includes(d.id));
}

export function getPlayerDestinationByPath(pathname) {
    return PLAYER_DESTINATIONS.find((d) => d.path === pathname) || null;
}

export function getPlayerDestinationById(id) {
    return PLAYER_DESTINATIONS.find((d) => d.id === id) || null;
}

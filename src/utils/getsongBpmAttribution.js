/** GetSongBPM API credit copy/styles. Static HTML also in public/index.html for crawlers. */

export const GETSONGBPM_ATTRIBUTION_URL = 'https://getsongbpm.com/';
export const GETSONGBPM_ATTRIBUTION_SITE_NAME = 'GetSongBPM';

export function getGetSongBpmAttributionStyle(overrides = {}) {
    return {
        margin: 0,
        fontSize: '0.75rem',
        opacity: 0.65,
        textAlign: 'center',
        ...overrides,
    };
}

export const GETSONGBPM_ATTRIBUTION_LINK_STYLE = {
    color: 'inherit',
    textDecoration: 'underline',
};

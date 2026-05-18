import React from 'react';

/** Visible GetSongBPM credit (API terms). Static copy also lives in public/index.html for crawlers. */
const GetSongBpmAttribution = ({ style = {} }) => (
    <p
        style={{
            margin: 0,
            fontSize: '0.75rem',
            opacity: 0.65,
            textAlign: 'center',
            ...style,
        }}
    >
        Tempo data from{' '}
        <a
            href="https://getsongbpm.com/"
            rel="noopener noreferrer"
            target="_blank"
            style={{ color: 'inherit', textDecoration: 'underline' }}
        >
            GetSongBPM
        </a>
    </p>
);

export default GetSongBpmAttribution;

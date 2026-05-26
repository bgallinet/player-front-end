/**
 * @mediapipe/tasks-vision ships without vision_bundle_mjs.js.map; CRA's source-map-loader warns.
 */
const fs = require('fs');
const path = require('path');

const mapPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@mediapipe',
    'tasks-vision',
    'vision_bundle_mjs.js.map',
);

if (!fs.existsSync(path.dirname(mapPath))) {
    process.exit(0);
}

if (!fs.existsSync(mapPath)) {
    fs.writeFileSync(
        mapPath,
        JSON.stringify({
            version: 3,
            file: 'vision_bundle_mjs.js',
            sources: [],
            names: [],
            mappings: '',
        }),
    );
}

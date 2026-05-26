/**
 * Register one module per experiment id (`controlled_experiments.csv`).
 * Add a new file `experiments/<id>.js` and import it here.
 */

import * as experiment20260504 from './20260504';
import * as experiment20260518 from './20260518';

/** @type {Record<string, { EXPERIMENT_ID: string, buildSessionConfig: (raw: object) => object }>} */
const EXPERIMENTS_BY_ID = {
    [experiment20260504.EXPERIMENT_ID]: experiment20260504,
    [experiment20260518.EXPERIMENT_ID]: experiment20260518,
};

/**
 * @param {string} experimentId
 */
export function getExperimentModule(experimentId) {
    const id = String(experimentId || '').trim();
    const mod = EXPERIMENTS_BY_ID[id];
    if (!mod) {
        throw new Error(
            `No experiment config module for id "${id}". Add experiments/${id}.js and register it in experiments/registry.js.`,
        );
    }
    return mod;
}

export function listRegisteredExperimentIds() {
    return Object.keys(EXPERIMENTS_BY_ID);
}

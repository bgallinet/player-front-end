/**
 * Single place for experiment-related analytics metadata.
 *
 * - **Session**: `activateExperiment` / `deactivateExperiment` — merged into outbound analytics by
 *   `mergeActiveExperimentIntoAnalyticsRequestBody` (see AnalyticsAPI, APICall, simpleTracker).
 * - **Forms** (evaluation + user_state surveys): build the `metadata` field only via
 *   `buildAnalyticsFormMetadata` so the shape matches the merge snapshot and there is no second definition.
 */

let activeExperiment = null;

/**
 * Metadata object for `interaction_type: 'form'` analytics (evaluation forms and user_state surveys).
 * Same rules as previously inlined in Form.jsx.
 *
 * @param {string|null|undefined} experimentId
 * @param {object|null|undefined} formMetadata - props from the page (variant, is_control, experiment_config, or survey_id-only)
 * @returns {object}
 */
export function buildAnalyticsFormMetadata(experimentId, formMetadata) {
    const surveyIdOnlyMetadata =
        formMetadata &&
        typeof formMetadata === 'object' &&
        Object.keys(formMetadata).length === 1 &&
        Object.prototype.hasOwnProperty.call(formMetadata, 'survey_id');

    if (surveyIdOnlyMetadata) {
        return { survey_id: formMetadata.survey_id };
    }
    if (formMetadata && typeof formMetadata === 'object') {
        return {
            ...(experimentId ? { experiment_id: experimentId } : {}),
            variant: formMetadata.variant ?? 'control',
            is_control:
                typeof formMetadata.is_control === 'boolean' ? formMetadata.is_control : true,
            experiment_config:
                formMetadata.experiment_config &&
                typeof formMetadata.experiment_config === 'object'
                    ? formMetadata.experiment_config
                    : {},
        };
    }
    return {
        ...(experimentId ? { experiment_id: experimentId } : {}),
        variant: 'control',
        is_control: true,
        experiment_config: {},
    };
}

/**
 * @param {object} opts
 * @param {string} opts.experimentId
 * @param {string} [opts.variant='control']
 * @param {boolean} [opts.is_control=true]
 * @param {object} [opts.experiment_config={}]
 */
export function activateExperiment({ experimentId, variant, is_control, experiment_config } = {}) {
    const id = experimentId != null && String(experimentId).trim() !== '' ? String(experimentId) : '';
    if (!id) {
        activeExperiment = null;
        return;
    }
    activeExperiment = {
        experimentId: id,
        variant: variant != null && String(variant).trim() !== '' ? String(variant) : 'control',
        is_control: typeof is_control === 'boolean' ? is_control : true,
        experiment_config:
            experiment_config && typeof experiment_config === 'object' && !Array.isArray(experiment_config)
                ? experiment_config
                : {},
    };
}

export function deactivateExperiment() {
    activeExperiment = null;
}

export function isExperimentSessionActive() {
    return activeExperiment != null && Boolean(activeExperiment.experimentId);
}

function buildMetadataSnapshot() {
    if (!isExperimentSessionActive()) return null;
    const a = activeExperiment;
    return {
        experiment_id: a.experimentId,
        variant: a.variant,
        is_control: a.is_control,
        experiment_config: a.experiment_config,
    };
}

/**
 * If the payload is an analytics event and a session experiment is active, merge into `metadata`.
 * Payload metadata (e.g. from `buildAnalyticsFormMetadata` on form submit) wins on key overlap
 * so props / DB truth beat a stale tab session.
 *
 * @param {string|object} requestBody
 * @returns {string|object} same type as input
 */
export function mergeActiveExperimentIntoAnalyticsRequestBody(requestBody) {
    const meta = buildMetadataSnapshot();
    if (!meta) {
        return requestBody;
    }

    const asString = typeof requestBody === 'string';
    let data;
    try {
        data = asString ? JSON.parse(requestBody) : { ...requestBody };
    } catch {
        return requestBody;
    }

    if (!data || data.request_type !== 'analytics') {
        return requestBody;
    }

    const existing =
        data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
            ? data.metadata
            : {};
    data.metadata = { ...meta, ...existing };

    if (asString) {
        try {
            return JSON.stringify(data);
        } catch {
            return requestBody;
        }
    }
    return data;
}

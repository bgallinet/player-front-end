export const AUTH_ERRORS = {
    TOKEN_EXPIRED: 'token_expired',
    NETWORK_ERROR: 'network_error',
    INVALID_TOKEN: 'invalid_token',
    REFRESH_FAILED: 'refresh_failed',
    UNKNOWN_ERROR: 'unknown_error'
};

export const getErrorMessage = (errorType) => {
    switch (errorType) {
        case AUTH_ERRORS.TOKEN_EXPIRED:
            return 'Your session has expired. Please log in again.';
        case AUTH_ERRORS.NETWORK_ERROR:
            return 'Network error. Please check your connection and try again.';
        case AUTH_ERRORS.INVALID_TOKEN:
            return 'Invalid authentication. Please log in again.';
        case AUTH_ERRORS.REFRESH_FAILED:
            return 'Unable to refresh session. Please log in again.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}; 
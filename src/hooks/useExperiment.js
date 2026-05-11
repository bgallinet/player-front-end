import { useState, useEffect } from 'react';
import AnalyticsAPI from '../utils/AnalyticsAPI';

/**
 * Fetch experiment configuration from backend
 * @param {string} experimentName - Name of the experiment
 * @returns {Promise<Object|null>} Experiment configuration with variant and config
 */
export const fetchExperiment = async (experimentName) => {
    try {
        // Use stable cohort names for authenticated vs anonymous users.
        const idToken = localStorage.getItem('idToken');
        const username = idToken ? 'authenticated_user' : 'anonymous_user';
        
        // Prepare analytics data
        const analyticsData = JSON.stringify({
            'request_type': 'experiment_management',
            'action': 'get_assignment',
            'experiment_name': experimentName,
            'user_name': username
        });
        
        // Call backend API using AnalyticsAPI
        const responseData = await AnalyticsAPI(analyticsData, Boolean(idToken));
        
        // Handle response body
        let body = responseData.body;
        if (typeof body === 'string') {
            body = JSON.parse(body);
        }
        
        // API Gateway wraps responses: {statusCode: 200, body: "..."}
        let data = body;
        if (body.body && typeof body.body === 'string') {
            data = JSON.parse(body.body);
        } else if (body.body) {
            data = body.body;
        }
        
        
        if (data.status === 'success' && data.assignment) {
            return {
                variant_name: data.assignment.variant_name,
                is_control: data.assignment.is_control,
                config: data.assignment.config,
                username: username  // Return the username used for assignment
            };
            } else {
            // Default to control if assignment fails
            return {
                variant_name: 'control',
                is_control: true,
                username: username
            };
        }
    } catch (error) {
        console.error('Error fetching experiment:', error);
        const username = localStorage.getItem('idToken') ? 'authenticated_user' : 'anonymous_user';
        return {
            variant_name: 'control',
            is_control: true,
            username: username
        };
    }
};

/**
 * Custom hook to fetch and use A/B test experiment configuration
 * @param {string} experimentName - Name of the experiment
 * @returns {Object|null} Experiment configuration with variant and config
 */
export const useExperiment = (experimentName) => {
    const [experiment, setExperiment] = useState(null);
    
    useEffect(() => {
        fetchExperiment(experimentName).then(setExperiment);
    }, [experimentName]);
    
    // Return control variant by default (no config - component handles defaults)
    return experiment || {
        variant_name: 'control',
        is_control: true
    };
};

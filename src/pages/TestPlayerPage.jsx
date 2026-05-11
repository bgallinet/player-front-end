import React from 'react';
import TestPlayerPage_20260504_BPM_energy from './TestPlayerPage_20260504_BPM_energy.jsx';

const ACTIVE_TEST_PAGE_ID = '20260504_BPM_energy';

const TEST_PAGE_BY_ID = {
    '20260504_BPM_energy': TestPlayerPage_20260504_BPM_energy,
};

const TestPlayerPage = (props) => {
    const SelectedTestPage = TEST_PAGE_BY_ID[ACTIVE_TEST_PAGE_ID] || TestPlayerPage_20260504_BPM_energy;
    return <SelectedTestPage {...props} />;
};

export default TestPlayerPage;

import React from 'react';
import TestPlayerPage_20260504 from './TestPlayerPage_20260504';
import TestPlayerPage_20260518 from './TestPlayerPage_20260518';

const ACTIVE_TEST_PAGE_ID = '20260518';

const TEST_PAGE_BY_ID = {
    '20260504': TestPlayerPage_20260504,
    '20260518': TestPlayerPage_20260518,
};

const TestPlayerPage = (props) => {
    const SelectedTestPage = TEST_PAGE_BY_ID[ACTIVE_TEST_PAGE_ID] || TestPlayerPage_20260504;
    return <SelectedTestPage {...props} />;
};

export default TestPlayerPage;

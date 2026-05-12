import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserProfileForm from './UserProfileForm';

const OPEN_PROFILE_EVENT = 'open-user-profile-form';

/** Open the listening profile modal from anywhere (e.g. Navigation). */
export function openUserProfileForm() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(OPEN_PROFILE_EVENT));
    }
}

/**
 * Listens for OAuth callback navigation state and global events; renders {@link UserProfileForm}.
 */
export default function UserProfileModalHost() {
    const location = useLocation();
    const navigate = useNavigate();
    const [show, setShow] = useState(false);

    useEffect(() => {
        const s = location.state;
        if (s?.showUserProfileForm || s?.showNewUserListeningSurvey) {
            setShow(true);
            const { showUserProfileForm: _a, showNewUserListeningSurvey: _b, ...rest } = s || {};
            navigate(`${location.pathname}${location.search || ''}`, {
                replace: true,
                state: Object.keys(rest).length ? rest : {},
            });
        }
    }, [location.state, location.pathname, location.search, navigate]);

    useEffect(() => {
        const onOpen = () => setShow(true);
        window.addEventListener(OPEN_PROFILE_EVENT, onOpen);
        return () => window.removeEventListener(OPEN_PROFILE_EVENT, onOpen);
    }, []);

    return <UserProfileForm show={show} onHide={() => setShow(false)} />;
}

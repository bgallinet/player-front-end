import React from 'react';
import { Link } from 'react-router-dom';
import homeIcon from '../images/homeIcon.png';
import playerIcon from '../images/playerIcon.png';
import logo from '../images/logo.png';
import { secondaryColor } from '../utils/DisplaySettings';
import { Nav, Image, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { isDemoSession } from '../hooks/demoUserManager';

/**
 * Navigation Component
 * 
 * This component provides the main navigation bar for the application.
 * It includes links to Home and Player pages with icons.
 * 
 * Features:
 * - Responsive design that works on mobile and desktop
 * - Hover effects with box shadow animation
 * - Consistent styling with the app's theme using secondaryColor
 * - Icon and text layout that adjusts based on screen size
 * 
 * Props: None
 * 
 * Dependencies:
 * - React Bootstrap for Nav and Image components
 * - React Router for navigation
 * - Custom icons imported from ../images/
 * - DisplaySettings for theming
 */


function Navigation() {
    const { idToken } = useAuth();
    const isDemoSessionValue = isDemoSession();
    // Render a link with a label and an icon
    const renderLink = (path, label, icon) => (
        <Link 
            to={path} 
            className="d-flex flex-column flex-md-row align-items-center text-white text-decoration-none"
            style={{ 
                whiteSpace: 'nowrap',
                padding: '0.25rem',
                flex: '1 1 0',
                minWidth: 0
            }}
        >
            {typeof icon === 'string' && icon.length <= 2 ? (
                // Emoji icon
                <div 
                    className="mb-1 mb-md-0 me-md-2 d-flex align-items-center justify-content-center"
                    style={{ 
                        width: 'clamp(2rem, 3.5vw, 3.5rem)',
                        height: 'clamp(2rem, 3.5vw, 3.5rem)',
                        fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
                        aspectRatio: '1/1'
                    }}
                >
                    {icon}
                </div>
            ) : (
                // Image icon
                <Image 
                    src={icon} 
                    alt={`${label} icon`} 
                    className="mb-1 mb-md-0 me-md-2"
                    style={{ 
                        width: 'clamp(2rem, 3.5vw, 3.5rem)',
                        aspectRatio: '1/1'
                    }}
                />
            )}
            <span 
                className="text-center text-md-start" 
                style={{ 
                    flex: '0 1 auto', 
                    fontSize: 'clamp(0.5rem, 1vw, 0.7rem)' 
                }}
            >
                {label}
            </span>
        </Link>
    );

    return (
        <>
            <Nav 
                className="d-flex flex-row align-items-center bg-black fixed-top w-100 py-0"
                style={{
                    zIndex: 1000,
                    borderBottom: '0.125rem solid',
                    borderColor: secondaryColor,
                    minHeight: 'clamp(3.5rem, 5vw, 6rem)'
                }}
            >
                <Image 
                    src={logo} 
                    alt="Logo" 
                    className="d-none d-lg-block me-lg-3"
                    style={{ width: 'clamp(8rem, 10vw, 12rem)' }}
                />
                
                <div className="d-flex flex-row align-items-center w-100 w-md-auto justify-content-between px-2 px-md-4 gap-2" style={{
                    maxWidth: '40rem'
                }}>
                    {renderLink("/", "Home", homeIcon)}
                    {renderLink("/player", "Player", playerIcon)}
                    

                    {/* Dropdown menu */}
                    <Dropdown className={idToken ? "ms-auto" : ""}>
                        <Dropdown.Toggle 
                            variant="outline-light"
                            className="d-flex align-items-center justify-content-center"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.25rem',
                                width: 'clamp(2rem, 3.5vw, 3.5rem)',
                                height: 'clamp(2rem, 3.5vw, 3.5rem)',
                                fontSize: 'clamp(2.2rem, 4.5vw, 3rem)',
                                color: 'white',
                            }}
                        >
                            ☰
                        </Dropdown.Toggle>
                        <Dropdown.Menu 
                            align="end"
                            style={{
                                backgroundColor: '#1a1a1a',
                                border: `1px solid ${secondaryColor}`,
                                borderRadius: '0.5rem'
                            }}
                        >
                            <Dropdown.Divider style={{ borderColor: secondaryColor, opacity: 0.3 }} />
                            <Dropdown.Item 
                                as={Link} 
                                to="/about"
                                style={{ 
                                    color: 'white',
                                    padding: '0.75rem 1rem',
                                    textDecoration: 'none'
                                }}
                            >
                                About
                            </Dropdown.Item>
                            <Dropdown.Item 
                                as={Link} 
                                to="/privacy"
                                style={{ 
                                    color: 'white',
                                    padding: '0.75rem 1rem',
                                    textDecoration: 'none'
                                }}
                            >
                                Privacy Notice
                            </Dropdown.Item>
                            <Dropdown.Item 
                                as={Link} 
                                to="/terms"
                                style={{ 
                                    color: 'white',
                                    padding: '0.75rem 1rem',
                                    textDecoration: 'none'
                                }}
                            >
                                Terms of Use
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </Nav>
            <div style={{ height: 'clamp(3.5rem, 5vw, 6rem)' }}></div>
        </>
    );
}

export default Navigation;
import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { StyledCard } from '../utils/StyledComponents';
import PrivacyNoticeAnnex from '../components/PrivacyNoticeAnnex';

const PrivacyNotice = () => {
    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-center">
                <Col xs={12} md={10} lg={8}>
                    <StyledCard>
                        <h1 className="mb-4">Privacy Notice</h1>
                        
                        <p className="mb-4">
                            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                        </p>

                        <PrivacyNoticeAnnex />
                    </StyledCard>
                </Col>
            </Row>
        </Container>
    );
};

export default PrivacyNotice; 
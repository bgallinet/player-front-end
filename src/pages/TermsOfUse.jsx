import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { StyledCard } from '../utils/StyledComponents';
import TermsOfUseAnnex from '../components/TermsOfUseAnnex';

const TermsOfUse = () => {
    return (
        <Container fluid className="mt-5">
            <Row className="justify-content-center">
                <Col xs={12} md={10} lg={8}>
                    <StyledCard>
                        <h1 className="mb-4">Terms of Use</h1>
                        
                        <p className="mb-4">
                            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
                        </p>

                        <p className="mb-4">
                            Welcome to TuneTribes! These Terms of Use ("Terms") govern your use of our music streaming and audience engagement platform. By accessing or using our service, you agree to be bound by these Terms.
                        </p>

                        <TermsOfUseAnnex />

                        <div className="mt-5 p-3 bg-light rounded">
                            <p className="mb-0">
                                <strong>By using TuneTribes, you acknowledge that you have read, understood, and agree to these Terms of Use.</strong>
                            </p>
                        </div>
                    </StyledCard>
                </Col>
            </Row>
        </Container>
    );
};

export default TermsOfUse; 
import React from 'react';
import './ContactPage.css';

const ContactPage = () => {
    return (
        <div className="contact-page">
            <div className="contact-container">
                <div className="contact-header">
                    <h1 className="contact-title">Get in Touch</h1>
                    <p className="contact-subtitle">
                        We'd love to hear from you. Here's how you can reach us for support or inquiries.
                    </p>
                </div>

                <div className="contact-info-grid">
                    <div className="contact-card">
                        <div className="icon-wrapper">
                            <i className="fas fa-envelope"></i>
                        </div>
                        <h3>Email Us</h3>
                        <p>For support and general queries</p>
                        <a href="mailto:support@theelefit.com" style={{ marginTop: '8px', fontWeight: '500' }}>
                            support@theelefit.com
                        </a>
                    </div>

                    <div className="contact-card">
                        <div className="icon-wrapper">
                            <i className="fas fa-map-marker-alt"></i>
                        </div>
                        <h3>Visit Us</h3>
                        <p>Hyderabad, India</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import './ContactPage.css';

const ContactPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: ''
    });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: '', message: '' });

        try {
            // Basic validation
            if (!formData.name || !formData.email || !formData.phone) {
                throw new Error('Please fill in all required fields.');
            }

            // Add to Firestore
            await addDoc(collection(db, 'promotions'), {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                createdAt: new Date().toISOString(),
                status: 'active'
            });

            setStatus({
                type: 'success',
                message: 'Details submitted successfully! We will get back to you soon.'
            });
            setFormData({ name: '', email: '', phone: '' });

        } catch (error) {
            console.error('Error submitting form:', error);
            setStatus({
                type: 'error',
                message: error.message || 'Something went wrong. Please try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="contact-page">
            <div className="contact-container">
                <div className="contact-header">
                    <h1 className="contact-title">Get In Touch</h1>
                    <p className="contact-subtitle">
                        Share your details and we'll get back to you with personalized recommendations
                    </p>
                </div>

                {status.message && (
                    <div className={`message-box ${status.type}`}>
                        {status.message}
                    </div>
                )}

                <form className="contact-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Full Name <span className="required-asterisk">*</span></label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address <span className="required-asterisk">*</span></label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            placeholder="Enter your email address"
                            value={formData.email}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone">Phone Number <span className="required-asterisk">*</span></label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            placeholder="Enter your phone number"
                            value={formData.phone}
                            onChange={handleChange}
                            className="form-input"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'SUBMIT DETAILS'}
                    </button>
                </form>

                <div className="instagram-section">
                    <span className="instagram-text">Follow us on Instagram</span>
                    <a
                        href="https://www.instagram.com/elefitstore"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="instagram-button"
                    >
                        <i className="fab fa-instagram"></i>
                        @elefitstore
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;

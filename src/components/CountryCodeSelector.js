import React, { useState, useEffect } from 'react';
import { countryCodes, getDefaultCountry, validatePhoneNumber } from '../utils/countryCodes';
import './CountryCodeSelector.css';

const CountryCodeSelector = ({ 
  value = '', 
  onChange, 
  onValidationChange,
  placeholder = "Enter phone number",
  className = "",
  disabled = false
}) => {
  const [selectedCountry, setSelectedCountry] = useState(getDefaultCountry());
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validation, setValidation] = useState({ isValid: true, error: null });

  // Initialize phone number from value prop
  useEffect(() => {
    if (value) {
      // Extract country code and phone number from full value
      const country = countryCodes.find(c => value.startsWith(c.dialCode));
      if (country) {
        setSelectedCountry(country);
        const phone = value.replace(country.dialCode, '').trim();
        setPhoneNumber(phone);
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const handleCountryChange = (countryCode) => {
    const country = countryCodes.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      validateAndUpdate(phoneNumber, country);
    }
  };

  const handlePhoneChange = (e) => {
    const newPhone = e.target.value.replace(/\D/g, ''); // Only allow digits
    setPhoneNumber(newPhone);
    validateAndUpdate(newPhone, selectedCountry);
  };

  const validateAndUpdate = (phone, country) => {
    const validation = validatePhoneNumber(phone, country.code);
    setValidation(validation);
    
    // Call parent onChange with full formatted number
    const fullNumber = phone ? `${country.dialCode} ${phone}` : '';
    onChange(fullNumber);
    
    // Call validation callback
    if (onValidationChange) {
      onValidationChange(validation);
    }
  };

  return (
    <div className={`country-code-selector ${className}`}>
      <div className="phone-input-wrapper">
        <div className="country-select-container">
          <select
            value={selectedCountry.code}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="country-select"
            disabled={disabled}
          >
            {countryCodes.map(country => (
              <option key={country.code} value={country.code}>
                {country.code}
              </option>
            ))}
          </select>
        </div>
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder={`${selectedCountry.dialCode} (555) 000-000`}
          className={`phone-input ${!validation.isValid ? 'error' : ''}`}
          disabled={disabled}
          maxLength={selectedCountry.maxLength}
        />
      </div>
      {!validation.isValid && validation.error && (
        <div className="validation-error">
          {validation.error}
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelector;

// Country codes and phone number validation utilities
export const countryCodes = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', minLength: 10, maxLength: 10, pattern: /^[6-9]\d{9}$/ },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', minLength: 10, maxLength: 10, pattern: /^[2-9]\d{2}[2-9]\d{6}$/ },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', minLength: 10, maxLength: 11, pattern: /^[1-9]\d{9,10}$/ },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', minLength: 10, maxLength: 10, pattern: /^[2-9]\d{2}[2-9]\d{6}$/ },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', minLength: 9, maxLength: 9, pattern: /^[2-9]\d{8}$/ },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', minLength: 10, maxLength: 12, pattern: /^[1-9]\d{9,11}$/ },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', minLength: 9, maxLength: 9, pattern: /^[1-9]\d{8}$/ },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', minLength: 10, maxLength: 11, pattern: /^[1-9]\d{9,10}$/ },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳', minLength: 11, maxLength: 11, pattern: /^1[3-9]\d{9}$/ },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', minLength: 10, maxLength: 11, pattern: /^[1-9]\d{9,10}$/ },
  { code: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', minLength: 10, maxLength: 10, pattern: /^[2-9]\d{9}$/ },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹', minLength: 9, maxLength: 11, pattern: /^[1-9]\d{8,10}$/ },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸', minLength: 9, maxLength: 9, pattern: /^[6-9]\d{8}$/ },
  { code: 'RU', name: 'Russia', dialCode: '+7', flag: '🇷🇺', minLength: 10, maxLength: 10, pattern: /^[3-9]\d{9}$/ },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷', minLength: 9, maxLength: 11, pattern: /^[1-9]\d{8,10}$/ },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', minLength: 8, maxLength: 8, pattern: /^[6-9]\d{7}$/ },
  { code: 'AE', name: 'UAE', dialCode: '+971', flag: '🇦🇪', minLength: 9, maxLength: 9, pattern: /^[5-9]\d{8}$/ },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', minLength: 9, maxLength: 9, pattern: /^[5-9]\d{8}$/ },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', minLength: 9, maxLength: 9, pattern: /^[6-9]\d{8}$/ },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', minLength: 10, maxLength: 10, pattern: /^[7-9]\d{9}$/ }
];

export const getCountryByCode = (code) => {
  return countryCodes.find(country => country.code === code);
};

export const validatePhoneNumber = (phoneNumber, countryCode) => {
  const country = getCountryByCode(countryCode);
  if (!country) return { isValid: false, error: 'Invalid country code' };

  // Remove all non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  // Check length
  if (cleanNumber.length < country.minLength || cleanNumber.length > country.maxLength) {
    return { 
      isValid: false, 
      error: `Phone number must be ${country.minLength}-${country.maxLength} digits for ${country.name}` 
    };
  }

  // Check pattern
  if (!country.pattern.test(cleanNumber)) {
    return { 
      isValid: false, 
      error: `Invalid phone number format for ${country.name}` 
    };
  }

  return { isValid: true, error: null };
};

export const formatPhoneNumber = (phoneNumber, countryCode) => {
  const country = getCountryByCode(countryCode);
  if (!country) return phoneNumber;

  const cleanNumber = phoneNumber.replace(/\D/g, '');
  return `${country.dialCode} ${cleanNumber}`;
};

export const getDefaultCountry = () => {
  // Try to detect country from browser locale
  const locale = navigator.language || navigator.userLanguage;
  const countryCode = locale.split('-')[1]?.toUpperCase();
  
  // Return detected country or default to India
  return getCountryByCode(countryCode) || getCountryByCode('IN');
};

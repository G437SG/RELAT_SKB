export const validateRequiredFields = (fields) => {
    const errors = {};
    for (const field in fields) {
        if (!fields[field]) {
            errors[field] = `${field} is required.`;
        }
    }
    return errors;
};

export const validateEmail = (email) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email) ? null : 'Invalid email address.';
};

export const validatePhoneNumber = (phone) => {
    const phonePattern = /^\+?[1-9]\d{1,14}$/;
    return phonePattern.test(phone) ? null : 'Invalid phone number.';
};

export const validateForm = (formData) => {
    const errors = validateRequiredFields(formData);
    if (formData.email) {
        const emailError = validateEmail(formData.email);
        if (emailError) {
            errors.email = emailError;
        }
    }
    if (formData.phone) {
        const phoneError = validatePhoneNumber(formData.phone);
        if (phoneError) {
            errors.phone = phoneError;
        }
    }
    return errors;
};
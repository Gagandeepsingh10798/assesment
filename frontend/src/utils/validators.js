/**
 * Validation Utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate required field
 */
export function isRequired(value) {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
}

/**
 * Validate number in range
 */
export function isInRange(value, min, max) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validate positive number
 */
export function isPositiveNumber(value) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && num >= 0;
}

/**
 * Validate medical code format (CPT/HCPCS)
 */
export function isValidMedicalCode(code) {
    if (!code) return false;

    // CPT: 4-5 digits, optionally followed by a letter
    const cptPattern = /^\d{4,5}[A-Z]?$/;
    // HCPCS: Letter followed by 4 digits
    const hcpcsPattern = /^[A-Z]\d{4}$/;

    return cptPattern.test(code) || hcpcsPattern.test(code);
}

/**
 * Validate currency amount
 */
export function isValidCurrency(value, options = {}) {
    const { allowNegative = false, maxValue } = options;

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return false;
    if (!allowNegative && num < 0) return false;
    if (maxValue !== undefined && num > maxValue) return false;

    return true;
}

/**
 * Create validator function
 */
export function createValidator(rules) {
    return (data) => {
        const errors = {};

        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = data[field];
            const fieldErrors = [];

            for (const rule of fieldRules) {
                if (rule.type === 'required' && !isRequired(value)) {
                    fieldErrors.push(rule.message || `${field} is required`);
                }

                if (rule.type === 'email' && value && !isValidEmail(value)) {
                    fieldErrors.push(rule.message || `${field} must be a valid email`);
                }

                if (rule.type === 'positive' && value && !isPositiveNumber(value)) {
                    fieldErrors.push(rule.message || `${field} must be a positive number`);
                }

                if (rule.type === 'range' && value) {
                    if (!isInRange(value, rule.min, rule.max)) {
                        fieldErrors.push(
                            rule.message || `${field} must be between ${rule.min} and ${rule.max}`
                        );
                    }
                }

                if (rule.type === 'custom' && rule.validate) {
                    const result = rule.validate(value, data);
                    if (result !== true) {
                        fieldErrors.push(result || rule.message);
                    }
                }
            }

            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
        };
    };
}

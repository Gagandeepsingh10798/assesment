/**
 * Medical Code Domain Model
 * Represents a medical procedure code (CPT/HCPCS) with payment information
 */
export default class Code {
    constructor(data) {
        this.code = data.code;
        this.description = data.description;
        this.type = data.type; // 'CPT' or 'HCPCS'
        this.category = data.category;
        this.payments = data.payments || {};
        this.apc = data.apc;
        this.drg = data.drg;
    }

    /**
     * Get payment amount for a specific site of service
     */
    getPaymentForSite(siteKey) {
        return this.payments[siteKey] || 0;
    }

    /**
     * Check if code has payment data for a site
     */
    hasPaymentForSite(siteKey) {
        return this.payments[siteKey] !== undefined && this.payments[siteKey] > 0;
    }

    /**
     * Get all available sites for this code
     */
    getAvailableSites() {
        return Object.keys(this.payments).filter(
            site => this.payments[site] > 0
        );
    }

    /**
     * Validate code format (numeric or alphanumeric)
     */
    static isValidFormat(codeString) {
        // CPT: 4-5 digits, optionally followed by a letter
        // HCPCS: Letter followed by 4 digits
        const cptPattern = /^\d{4,5}[A-Z]?$/;
        const hcpcsPattern = /^[A-Z]\d{4}$/;
        return cptPattern.test(codeString) || hcpcsPattern.test(codeString);
    }

    /**
     * Format code for display
     */
    formatCode() {
        return `${this.code} (${this.type})`;
    }

    /**
     * Get short description (first 100 chars)
     */
    getShortDescription() {
        return this.description.length > 100
            ? this.description.substring(0, 100) + '...'
            : this.description;
    }

    /**
     * Check if this is a procedure code
     */
    isProcedure() {
        return this.category && this.category.toLowerCase().includes('procedure');
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            code: this.code,
            description: this.description,
            type: this.type,
            category: this.category,
            payments: this.payments,
            apc: this.apc,
            drg: this.drg,
        };
    }
}

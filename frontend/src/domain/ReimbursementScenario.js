/**
 * Reimbursement Scenario Domain Model
 * Encapsulates reimbursement calculation logic and business rules
 */
export default class ReimbursementScenario {
    constructor(config) {
        this.code = config.code;
        this.siteOfService = config.siteOfService;
        this.deviceCost = parseFloat(config.deviceCost) || 0;
        this.ntapAddOn = parseFloat(config.ntapAddOn) || 0;
        this.basePayment = parseFloat(config.basePayment) || 0;
        this.description = config.description || '';
        this.codeDetails = config.codeDetails || null;
    }

    /**
     * Calculate total payment (base + NTAP)
     */
    getTotalPayment() {
        return this.basePayment + this.ntapAddOn;
    }

    /**
     * Calculate margin (Total Payment - Device Cost)
     */
    getMargin() {
        return this.getTotalPayment() - this.deviceCost;
    }

    /**
     * Calculate margin percentage relative to total payment
     */
    getMarginPercentage() {
        const totalPayment = this.getTotalPayment();
        if (totalPayment === 0) return 0;
        return ((this.getMargin() / totalPayment) * 100).toFixed(2);
    }

    /**
     * Classify scenario: profitable, break-even, or loss
     * Thresholds:
     * - Profitable: Margin > 10% of Total Payment
     * - Break-Even: Margin between -5% and 10% of Total Payment
     * - Loss: Margin < -5% of Total Payment
     */
    getClassification() {
        const marginPercentage = parseFloat(this.getMarginPercentage());

        if (marginPercentage > 10) {
            return 'profitable';
        } else if (marginPercentage >= -5) {
            return 'break-even';
        } else {
            return 'loss';
        }
    }

    /**
     * Get classification label
     */
    getClassificationLabel() {
        const classification = this.getClassification();
        return {
            profitable: 'Profitable',
            'break-even': 'Break-Even',
            loss: 'Loss',
        }[classification];
    }

    /**
     * Get classification color
     */
    getClassificationColor() {
        const classification = this.getClassification();
        return {
            profitable: '#10b981',
            'break-even': '#f59e0b',
            loss: '#ef4444',
        }[classification];
    }

    /**
     * Validate scenario inputs
     */
    validate() {
        const errors = [];

        if (!this.code || this.code.trim() === '') {
            errors.push('Code is required');
        }

        if (!this.siteOfService) {
            errors.push('Site of service is required');
        }

        if (this.deviceCost < 0) {
            errors.push('Device cost cannot be negative');
        }

        if (this.ntapAddOn < 0) {
            errors.push('NTAP add-on cannot be negative');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Check if NTAP add-on is included
     */
    hasNtapAddOn() {
        return this.ntapAddOn > 0;
    }

    /**
     * Get profitability description
     */
    getProfitabilityDescription() {
        const classification = this.getClassification();
        return {
            profitable: 'This procedure is projected to be financially sustainable.',
            'break-even': 'This procedure is near the break-even point.',
            loss: 'This procedure is projected to operate at a loss.',
        }[classification];
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            code: this.code,
            siteOfService: this.siteOfService,
            deviceCost: this.deviceCost,
            ntapAddOn: this.ntapAddOn,
            basePayment: this.basePayment,
            totalPayment: this.getTotalPayment(),
            margin: this.getMargin(),
            marginPercentage: this.getMarginPercentage(),
            classification: this.getClassification(),
            description: this.description,
        };
    }

    /**
     * Create from API response
     */
    static fromApiResponse(response) {
        return new ReimbursementScenario({
            code: response.code,
            siteOfService: response.siteOfService,
            deviceCost: response.deviceCost,
            ntapAddOn: response.addOnPayment || 0,
            basePayment: response.basePayment,
            description: response.description,
            codeDetails: response.codeDetails,
        });
    }
}

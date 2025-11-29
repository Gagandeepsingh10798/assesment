import { describe, it, expect } from 'vitest';
import ReimbursementScenario from '../../../domain/ReimbursementScenario.js';

describe('ReimbursementScenario Domain Model', () => {
    const mockConfig = {
        code: '33208',
        siteOfService: 'HOPD',
        deviceCost: 5000,
        ntapAddOn: 1000,
        basePayment: 8500,
        description: 'Pacemaker insertion',
    };

    describe('constructor', () => {
        it('should create instance with all properties', () => {
            const scenario = new ReimbursementScenario(mockConfig);

            expect(scenario.code).toBe('33208');
            expect(scenario.siteOfService).toBe('HOPD');
            expect(scenario.deviceCost).toBe(5000);
            expect(scenario.ntapAddOn).toBe(1000);
            expect(scenario.basePayment).toBe(8500);
        });

        it('should parse numeric strings', () => {
            const config = {
                ...mockConfig,
                deviceCost: '5000',
                ntapAddOn: '1000',
            };
            const scenario = new ReimbursementScenario(config);

            expect(scenario.deviceCost).toBe(5000);
            expect(scenario.ntapAddOn).toBe(1000);
        });

        it('should default ntapAddOn to 0 if not provided', () => {
            const config = { ...mockConfig };
            delete config.ntapAddOn;
            const scenario = new ReimbursementScenario(config);

            expect(scenario.ntapAddOn).toBe(0);
        });
    });

    describe('getTotalPayment', () => {
        it('should calculate total payment correctly', () => {
            const scenario = new ReimbursementScenario(mockConfig);

            expect(scenario.getTotalPayment()).toBe(9500); // 8500 + 1000
        });

        it('should work without NTAP add-on', () => {
            const config = { ...mockConfig, ntapAddOn: 0 };
            const scenario = new ReimbursementScenario(config);

            expect(scenario.getTotalPayment()).toBe(8500);
        });
    });

    describe('getMargin', () => {
        it('should calculate positive margin', () => {
            const scenario = new ReimbursementScenario(mockConfig);

            expect(scenario.getMargin()).toBe(4500); // 9500 - 5000
        });

        it('should calculate negative margin (loss)', () => {
            const config = { ...mockConfig, deviceCost: 12000 };
            const scenario = new ReimbursementScenario(config);

            expect(scenario.getMargin()).toBe(-2500); // 9500 - 12000
        });
    });

    describe('getMarginPercentage', () => {
        it('should calculate margin percentage correctly', () => {
            const scenario = new ReimbursementScenario(mockConfig);

            // (4500 / 9500) * 100 = 47.37%
            expect(scenario.getMarginPercentage()).toBe('47.37');
        });

        it('should return 0 if total payment is 0', () => {
            const config = { ...mockConfig, basePayment: 0, ntapAddOn: 0 };
            const scenario = new ReimbursementScenario(config);

            expect(scenario.getMarginPercentage()).toBe('0.00');
        });
    });

    describe('getClassification', () => {
        it('should classify as profitable when margin > 10%', () => {
            const scenario = new ReimbursementScenario(mockConfig);
            // Margin is 47.37%

            expect(scenario.getClassification()).toBe('profitable');
        });

        it('should classify as break-even when margin between -5% and 10%', () => {
            // Set device cost to create ~5% margin
            const config = { ...mockConfig, deviceCost: 9025 };
            const scenario = new ReimbursementScenario(config);
            // Margin: (9500 - 9025) / 9500 = 5%

            expect(scenario.getClassification()).toBe('break-even');
        });

        it('should classify as loss when margin < -5%', () => {
            const config = { ...mockConfig, deviceCost: 12000 };
            const scenario = new ReimbursementScenario(config);
            // Margin: (9500 - 12000) / 9500 = -26.3%

            expect(scenario.getClassification()).toBe('loss');
        });
    });

    describe('validate', () => {
        it('should pass validation for valid scenario', () => {
            const scenario = new ReimbursementScenario(mockConfig);
            const result = scenario.validate();

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail if code is missing', () => {
            const config = { ...mockConfig, code: '' };
            const scenario = new ReimbursementScenario(config);
            const result = scenario.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Code is required');
        });

        it('should fail if site of service is missing', () => {
            const config = { ...mockConfig, siteOfService: null };
            const scenario = new ReimbursementScenario(config);
            const result = scenario.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Site of service is required');
        });

        it('should fail if device cost is negative', () => {
            const config = { ...mockConfig, deviceCost: -100 };
            const scenario = new ReimbursementScenario(config);
            const result = scenario.validate();

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Device cost cannot be negative');
        });
    });

    describe('hasNtapAddOn', () => {
        it('should return true when NTAP add-on > 0', () => {
            const scenario = new ReimbursementScenario(mockConfig);

            expect(scenario.hasNtapAddOn()).toBe(true);
        });

        it('should return false when NTAP add-on is 0', () => {
            const config = { ...mockConfig, ntapAddOn: 0 };
            const scenario = new ReimbursementScenario(config);

            expect(scenario.hasNtapAddOn()).toBe(false);
        });
    });

    describe('toJSON', () => {
        it('should serialize all calculated values', () => {
            const scenario = new ReimbursementScenario(mockConfig);
            const json = scenario.toJSON();

            expect(json).toEqual({
                code: '33208',
                siteOfService: 'HOPD',
                deviceCost: 5000,
                ntapAddOn: 1000,
                basePayment: 8500,
                totalPayment: 9500,
                margin: 4500,
                marginPercentage: '47.37',
                classification: 'profitable',
                description: 'Pacemaker insertion',
            });
        });
    });

    describe('fromApiResponse', () => {
        it('should create instance from API response', () => {
            const apiResponse = {
                code: '33208',
                siteOfService: 'HOPD',
                deviceCost: 5000,
                addOnPayment: 1000,
                basePayment: 8500,
                description: 'Pacemaker insertion',
                codeDetails: { apc: '5161' },
            };

            const scenario = ReimbursementScenario.fromApiResponse(apiResponse);

            expect(scenario.code).toBe('33208');
            expect(scenario.ntapAddOn).toBe(1000);
            expect(scenario.codeDetails).toEqual({ apc: '5161' });
        });
    });
});

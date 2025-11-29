import { describe, it, expect } from 'vitest';
import Code from '../../../domain/Code.js';

describe('Code Domain Model', () => {
    const mockCodeData = {
        code: '12345',
        description: 'Test Procedure Description',
        type: 'CPT',
        category: 'Surgical Procedure',
        payments: {
            IPPS: 15000,
            HOPD: 8500,
            ASC: 7200,
            OBL: 5000,
        },
        apc: '5161',
    };

    describe('constructor', () => {
        it('should create a Code instance with all properties', () => {
            const code = new Code(mockCodeData);

            expect(code.code).toBe('12345');
            expect(code.description).toBe('Test Procedure Description');
            expect(code.type).toBe('CPT');
            expect(code.category).toBe('Surgical Procedure');
            expect(code.payments).toEqual(mockCodeData.payments);
        });

        it('should handle missing payments with empty object', () => {
            const codeData = { ...mockCodeData };
            delete codeData.payments;
            const code = new Code(codeData);

            expect(code.payments).toEqual({});
        });
    });

    describe('getPaymentForSite', () => {
        it('should return correct payment for valid site', () => {
            const code = new Code(mockCodeData);

            expect(code.getPaymentForSite('HOPD')).toBe(8500);
            expect(code.getPaymentForSite('ASC')).toBe(7200);
        });

        it('should return 0 for invalid site', () => {
            const code = new Code(mockCodeData);

            expect(code.getPaymentForSite('INVALID')).toBe(0);
        });
    });

    describe('hasPaymentForSite', () => {
        it('should return true for sites with payment', () => {
            const code = new Code(mockCodeData);

            expect(code.hasPaymentForSite('IPPS')).toBe(true);
            expect(code.hasPaymentForSite('OBL')).toBe(true);
        });

        it('should return false for sites without payment', () => {
            const code = new Code(mockCodeData);

            expect(code.hasPaymentForSite('INVALID')).toBe(false);
        });
    });

    describe('getAvailableSites', () => {
        it('should return all sites with non-zero payment', () => {
            const code = new Code(mockCodeData);
            const sites = code.getAvailableSites();

            expect(sites).toContain('IPPS');
            expect(sites).toContain('HOPD');
            expect(sites).toContain('ASC');
            expect(sites).toContain('OBL');
            expect(sites.length).toBe(4);
        });

        it('should exclude sites with zero payment', () => {
            const codeData = { ...mockCodeData, payments: { IPPS: 10000, HOPD: 0 } };
            const code = new Code(codeData);
            const sites = code.getAvailableSites();

            expect(sites).toContain('IPPS');
            expect(sites).not.toContain('HOPD');
        });
    });

    describe('isValidFormat', () => {
        it('should validate CPT codes (4-5 digits)', () => {
            expect(Code.isValidFormat('1234')).toBe(true);
            expect(Code.isValidFormat('12345')).toBe(true);
            expect(Code.isValidFormat('99213')).toBe(true);
        });

        it('should validate CPT codes with modifier letter', () => {
            expect(Code.isValidFormat('12345T')).toBe(true);
            expect(Code.isValidFormat('99213F')).toBe(true);
        });

        it('should validate HCPCS codes (letter + 4 digits)', () => {
            expect(Code.isValidFormat('J1234')).toBe(true);
            expect(Code.isValidFormat('G0123')).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(Code.isValidFormat('123')).toBe(false);      // Too short
            expect(Code.isValidFormat('123456')).toBe(false);   // Too long
            expect(Code.isValidFormat('ABCD')).toBe(false);     // All letters
            expect(Code.isValidFormat('12AB')).toBe(false);     // Invalid pattern
        });
    });

    describe('formatCode', () => {
        it('should format code with type', () => {
            const code = new Code(mockCodeData);

            expect(code.formatCode()).toBe('12345 (CPT)');
        });
    });

    describe('getShortDescription', () => {
        it('should return full description if under 100 chars', () => {
            const code = new Code(mockCodeData);

            expect(code.getShortDescription()).toBe('Test Procedure Description');
        });

        it('should truncate long descriptions', () => {
            const longDescription = 'A'.repeat(150);
            const codeData = { ...mockCodeData, description: longDescription };
            const code = new Code(codeData);

            const short = code.getShortDescription();
            expect(short.length).toBe(103); // 100 + '...'
            expect(short.endsWith('...')).toBe(true);
        });
    });

    describe('isProcedure', () => {
        it('should return true if category includes "procedure"', () => {
            const code = new Code(mockCodeData);

            expect(code.isProcedure()).toBe(true);
        });

        it('should return false if category does not include "procedure"', () => {
            const codeData = { ...mockCodeData, category: 'Diagnostic Test' };
            const code = new Code(codeData);

            expect(code.isProcedure()).toBe(false);
        });
    });

    describe('toJSON', () => {
        it('should serialize to JSON correctly', () => {
            const code = new Code(mockCodeData);
            const json = code.toJSON();

            expect(json).toEqual({
                code: '12345',
                description: 'Test Procedure Description',
                type: 'CPT',
                category: 'Surgical Procedure',
                payments: mockCodeData.payments,
                apc: '5161',
                drg: undefined,
            });
        });
    });
});

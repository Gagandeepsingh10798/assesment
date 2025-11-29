/**
 * Code Model Tests
 */

import { Code } from '../../../src/models/Code.js';

describe('Code', () => {
  
  describe('fromRaw', () => {
    it('should create Code from valid raw data', () => {
      const rawData = {
        code: '36903',
        description: 'Introduction of catheter',
        type: 'CPT',
        labels: ['Cardiovascular System'],
        metadata: {},
      };

      const code = Code.fromRaw(rawData);

      expect(code.code).toBe('36903');
      expect(code.description).toBe('Introduction of catheter');
      expect(code.type).toBe('CPT');
    });

    it('should throw error for missing code', () => {
      const rawData = {
        description: 'Some description',
        type: 'CPT',
      };

      expect(() => Code.fromRaw(rawData)).toThrow('Invalid code data');
    });

    it('should throw error for null data', () => {
      expect(() => Code.fromRaw(null)).toThrow('Invalid code data');
    });
  });

  describe('normalizedType', () => {
    it('should normalize DX to ICD10', () => {
      const code = new Code({ code: 'A00', type: 'DX' });
      expect(code.normalizedType).toBe('ICD10');
    });

    it('should normalize PCS to ICD10-PCS', () => {
      const code = new Code({ code: '0B110', type: 'PCS' });
      expect(code.normalizedType).toBe('ICD10-PCS');
    });

    it('should preserve CPT type', () => {
      const code = new Code({ code: '36903', type: 'CPT' });
      expect(code.normalizedType).toBe('CPT');
    });

    it('should handle missing type', () => {
      const code = new Code({ code: '36903' });
      expect(code.normalizedType).toBe('OTHER');
    });
  });

  describe('category', () => {
    it('should return label if available', () => {
      const code = new Code({
        code: '36903',
        type: 'CPT',
        labels: ['Cardiovascular System'],
      });

      expect(code.category).toBe('Cardiovascular System');
    });

    it('should derive CPT category from code range', () => {
      const testCases = [
        { code: '10000', expected: 'Integumentary System' },
        { code: '20000', expected: 'Musculoskeletal System' },
        { code: '33000', expected: 'Cardiovascular System' },
        { code: '70000', expected: 'Radiology' },
        { code: '99201', expected: 'Medicine' },
      ];

      for (const testCase of testCases) {
        const code = new Code({ code: testCase.code, type: 'CPT' });
        expect(code.category).toBe(testCase.expected);
      }
    });

    it('should identify Category II codes', () => {
      const code = new Code({ code: '0001F', type: 'CPT' });
      expect(code.category).toBe('Category II - Performance Measurement');
    });

    it('should identify Category III codes', () => {
      const code = new Code({ code: '0001T', type: 'CPT' });
      expect(code.category).toBe('Category III - Emerging Technology');
    });

    it('should return type-based category for non-CPT codes', () => {
      expect(new Code({ code: 'A0001', type: 'HCPCS' }).category).toBe('HCPCS Level II');
      expect(new Code({ code: 'A00.0', type: 'DX' }).category).toBe('ICD-10 Diagnosis');
    });
  });

  describe('calculatePayments', () => {
    it('should calculate payments for CPT codes with RVU', () => {
      const code = new Code({
        code: '36903',
        type: 'CPT',
        metadata: {
          CPT: {
            FACILITY_RVU: 10.0,
            NONFACILITY_RVU: 5.0,
          },
        },
      });

      const payments = code.calculatePayments();

      expect(payments.OBL).toBeGreaterThan(0);
      expect(payments.HOPD).toBeGreaterThan(0);
      expect(payments.ASC).toBeGreaterThan(0);
      expect(payments.IPPS).toBeGreaterThan(0);
    });

    it('should use APC rate when available', () => {
      const code = new Code({
        code: '36903',
        type: 'CPT',
        metadata: {
          CPT: {
            APC: 5193,
            FACILITY_RVU: 10.0,
          },
        },
      });

      const payments = code.calculatePayments();

      // Should use APC rate (11639) instead of calculated
      expect(payments.HOPD).toBe(11639);
    });

    it('should return zero payments for non-procedure codes', () => {
      const code = new Code({
        code: 'A00.0',
        type: 'DX',
      });

      const payments = code.calculatePayments();

      expect(payments.IPPS).toBe(0);
      expect(payments.HOPD).toBe(0);
      expect(payments.ASC).toBe(0);
      expect(payments.OBL).toBe(0);
    });
  });

  describe('toSummary', () => {
    it('should generate summary format', () => {
      const code = new Code({
        code: '36903',
        description: 'Test procedure',
        type: 'CPT',
        labels: ['Cardiovascular'],
      });

      const summary = code.toSummary();

      expect(summary.code).toBe('36903');
      expect(summary.description).toBe('Test procedure');
      expect(summary.type).toBe('CPT');
      expect(summary.category).toBe('Cardiovascular');
      expect(summary.labels).toContain('Cardiovascular');
    });
  });

  describe('toDetail', () => {
    it('should generate detailed format with payments', () => {
      const code = new Code({
        code: '36903',
        description: 'Test procedure',
        type: 'CPT',
        labels: ['Cardiovascular'],
        metadata: {
          CPT: {
            FACILITY_RVU: 10.0,
            NONFACILITY_RVU: 5.0,
            APC: 5193,
          },
        },
      });

      const detail = code.toDetail();

      expect(detail.code).toBe('36903');
      expect(detail.payments).toBeDefined();
      expect(detail.payments.IPPS).toBeGreaterThan(0);
      expect(detail.optional).toBeDefined();
      expect(detail.optional.apc).toBe('5193');
    });
  });

  describe('getPaymentForSite', () => {
    it('should return correct payment for site', () => {
      const code = new Code({
        code: '36903',
        type: 'CPT',
        metadata: {
          CPT: {
            FACILITY_RVU: 10.0,
            NONFACILITY_RVU: 5.0,
          },
        },
      });

      const hopd = code.getPaymentForSite('HOPD');
      const obl = code.getPaymentForSite('OBL');

      expect(hopd).toBeGreaterThan(0);
      expect(obl).toBeGreaterThan(0);
    });

    it('should handle site aliases', () => {
      const code = new Code({
        code: '36903',
        type: 'CPT',
        metadata: {
          CPT: {
            FACILITY_RVU: 10.0,
          },
        },
      });

      const inpatient = code.getPaymentForSite('INPATIENT');
      const ipps = code.getPaymentForSite('IPPS');

      expect(inpatient).toBe(ipps);
    });
  });
});


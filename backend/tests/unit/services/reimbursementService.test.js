/**
 * ReimbursementService Tests
 * Note: This service uses the ReimbursementScenario model
 */

import { ReimbursementScenario } from '../../../src/models/ReimbursementScenario.js';

describe('Reimbursement Service Logic', () => {
  
  // Mock code detail for testing
  const mockCodeDetail = {
    code: '36903',
    description: 'Introduction of catheter, fistula/graft',
    category: 'Cardiovascular System',
    type: 'CPT',
    payments: {
      IPPS: 15000,
      HOPD: 10000,
      ASC: 6500,
      OBL: 500,
    },
    optional: {
      apc: '5193',
    },
  };

  describe('Scenario Calculation', () => {
    it('should calculate basic scenario correctly', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
      });

      scenario.calculate(mockCodeDetail);
      const result = scenario.toResponse();

      expect(result.basePayment).toBe(10000);
      expect(result.addOnPayment).toBe(0);
      expect(result.totalPayment).toBe(10000);
      expect(result.margin).toBe(5000);
    });

    it('should include NTAP add-on in calculation', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
        ntapAddOn: 3770,
      });

      scenario.calculate(mockCodeDetail);
      const result = scenario.toResponse();

      expect(result.basePayment).toBe(10000);
      expect(result.addOnPayment).toBe(3770);
      expect(result.totalPayment).toBe(13770);
      expect(result.margin).toBe(8770);
    });
  });

  describe('Classification Logic', () => {
    it('should classify as profitable when margin > 10%', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000, // margin = 5000, 50% of payment
      });

      scenario.calculate(mockCodeDetail);
      
      expect(scenario.toResponse().classification).toBe('profitable');
    });

    it('should classify as break-even when margin between -5% and 10%', () => {
      // margin needs to be between -500 and 1000 for 10000 payment
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 9500, // margin = 500, 5%
      });

      scenario.calculate(mockCodeDetail);
      
      expect(scenario.toResponse().classification).toBe('break-even');
    });

    it('should classify as loss when margin < -5%', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 12000, // margin = -2000, -20%
      });

      scenario.calculate(mockCodeDetail);
      
      expect(scenario.toResponse().classification).toBe('loss');
    });

    it('should handle zero total payment edge case', () => {
      const zeroPaymentCode = {
        ...mockCodeDetail,
        payments: { IPPS: 0, HOPD: 0, ASC: 0, OBL: 0 },
      };

      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 1000,
      });

      scenario.calculate(zeroPaymentCode);
      
      // Should not throw and should classify as loss
      expect(scenario.toResponse().classification).toBe('loss');
    });
  });

  describe('Site Comparison', () => {
    it('should calculate different payments for different sites', () => {
      const sites = ['IPPS', 'HOPD', 'ASC', 'OBL'];
      const results = {};

      for (const site of sites) {
        const scenario = ReimbursementScenario.fromRequest({
          code: '36903',
          siteOfService: site,
          deviceCost: 5000,
        });

        scenario.calculate(mockCodeDetail);
        results[site] = scenario.toResponse().totalPayment;
      }

      // IPPS should be highest
      expect(results.IPPS).toBeGreaterThan(results.HOPD);
      expect(results.HOPD).toBeGreaterThan(results.ASC);
      expect(results.ASC).toBeGreaterThan(results.OBL);
    });
  });

  describe('Response Format', () => {
    it('should include all required response fields', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
        ntapAddOn: 1000,
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      // Check all required fields exist
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('description');
      expect(response).toHaveProperty('siteOfService');
      expect(response).toHaveProperty('siteKey');
      expect(response).toHaveProperty('basePayment');
      expect(response).toHaveProperty('addOnPayment');
      expect(response).toHaveProperty('totalPayment');
      expect(response).toHaveProperty('deviceCost');
      expect(response).toHaveProperty('margin');
      expect(response).toHaveProperty('marginPercentage');
      expect(response).toHaveProperty('classification');
      expect(response).toHaveProperty('breakdown');
      expect(response).toHaveProperty('codeDetails');
    });

    it('should include detailed breakdown', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      expect(response.breakdown).toHaveProperty('basePayment');
      expect(response.breakdown).toHaveProperty('addOnPayment');
      expect(response.breakdown).toHaveProperty('totalPayment');
      expect(response.breakdown).toHaveProperty('deviceCost');
      expect(response.breakdown).toHaveProperty('margin');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero device cost', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 0,
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      expect(response.margin).toBe(10000);
      expect(response.classification).toBe('profitable');
    });

    it('should handle very high device cost', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 1000000,
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      expect(response.margin).toBe(-990000);
      expect(response.classification).toBe('loss');
    });

    it('should handle decimal values correctly', () => {
      const scenario = ReimbursementScenario.fromRequest({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: '5000.50',
        ntapAddOn: '1000.25',
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      expect(response.deviceCost).toBe(5000.50);
      expect(response.addOnPayment).toBe(1000.25);
    });
  });
});


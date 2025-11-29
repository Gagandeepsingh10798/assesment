/**
 * ReimbursementScenario Model Tests
 */

import { ReimbursementScenario, SITES_OF_SERVICE, Classifications } from '../../../src/models/ReimbursementScenario.js';

describe('ReimbursementScenario', () => {
  
  describe('fromRequest', () => {
    it('should create scenario from valid request data', () => {
      const requestData = {
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: '5000',
        ntapAddOn: '1000',
      };

      const scenario = ReimbursementScenario.fromRequest(requestData);

      expect(scenario.code).toBe('36903');
      expect(scenario.siteOfService).toBe('HOPD');
      expect(scenario.deviceCost).toBe(5000);
      expect(scenario.ntapAddOn).toBe(1000);
    });

    it('should handle missing ntapAddOn', () => {
      const requestData = {
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: '5000',
      };

      const scenario = ReimbursementScenario.fromRequest(requestData);

      expect(scenario.ntapAddOn).toBe(0);
    });

    it('should parse string deviceCost to number', () => {
      const requestData = {
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: '5000.50',
      };

      const scenario = ReimbursementScenario.fromRequest(requestData);

      expect(scenario.deviceCost).toBe(5000.50);
    });
  });

  describe('validate', () => {
    it('should pass validation for valid data', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
      });

      const result = scenario.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing code', () => {
      const scenario = new ReimbursementScenario({
        siteOfService: 'HOPD',
        deviceCost: 5000,
      });

      const result = scenario.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is required and must be a string');
    });

    it('should fail validation for invalid site of service', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'INVALID',
        deviceCost: 5000,
      });

      const result = scenario.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid site of service'))).toBe(true);
    });

    it('should fail validation for negative device cost', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: -100,
      });

      const result = scenario.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Device cost must be a non-negative number');
    });

    it('should accept all valid sites of service', () => {
      const sites = ['IPPS', 'HOPD', 'ASC', 'OBL'];
      
      for (const site of sites) {
        const scenario = new ReimbursementScenario({
          code: '36903',
          siteOfService: site,
          deviceCost: 5000,
        });

        const result = scenario.validate();
        expect(result.valid).toBe(true);
      }
    });

    it('should accept site aliases', () => {
      const aliases = ['INPATIENT', 'OPPS', 'AMBULATORY', 'OFFICE'];
      
      for (const alias of aliases) {
        const scenario = new ReimbursementScenario({
          code: '36903',
          siteOfService: alias,
          deviceCost: 5000,
        });

        const result = scenario.validate();
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('calculate', () => {
    const mockCodeDetail = {
      code: '36903',
      description: 'Test procedure',
      category: 'Cardiovascular System',
      payments: {
        IPPS: 15000,
        HOPD: 10000,
        ASC: 6500,
        OBL: 500,
      },
    };

    it('should calculate profitable scenario correctly', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
        ntapAddOn: 2000,
      });

      const result = scenario.calculate(mockCodeDetail);

      expect(result.basePayment).toBe(10000);
      expect(result.addOnPayment).toBe(2000);
      expect(result.totalPayment).toBe(12000);
      expect(result.margin).toBe(7000); // 12000 - 5000
      expect(result.classification).toBe(Classifications.PROFITABLE);
    });

    it('should calculate break-even scenario correctly', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 9500, // margin = 500, 5% of 10000
      });

      const result = scenario.calculate(mockCodeDetail);

      expect(result.margin).toBe(500);
      expect(result.classification).toBe(Classifications.BREAK_EVEN);
    });

    it('should calculate loss scenario correctly', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 15000, // margin = -5000
      });

      const result = scenario.calculate(mockCodeDetail);

      expect(result.margin).toBe(-5000);
      expect(result.classification).toBe(Classifications.LOSS);
    });

    it('should use correct site payments', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'IPPS',
        deviceCost: 5000,
      });

      const result = scenario.calculate(mockCodeDetail);

      expect(result.basePayment).toBe(15000);
    });
  });

  describe('toResponse', () => {
    const mockCodeDetail = {
      code: '36903',
      description: 'Test procedure',
      category: 'Cardiovascular System',
      type: 'CPT',
      payments: {
        IPPS: 15000,
        HOPD: 10000,
        ASC: 6500,
        OBL: 500,
      },
    };

    it('should generate complete response object', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
        ntapAddOn: 1000,
      });

      scenario.calculate(mockCodeDetail);
      const response = scenario.toResponse();

      expect(response.code).toBe('36903');
      expect(response.description).toBe('Test procedure');
      expect(response.siteOfService).toBe('Hospital Outpatient (OPPS)');
      expect(response.siteKey).toBe('HOPD');
      expect(response.basePayment).toBe(10000);
      expect(response.addOnPayment).toBe(1000);
      expect(response.totalPayment).toBe(11000);
      expect(response.deviceCost).toBe(5000);
      expect(response.margin).toBe(6000);
      expect(response.classification).toBe('profitable');
      expect(response.breakdown).toBeDefined();
      expect(response.codeDetails).toBeDefined();
    });

    it('should throw if not calculated', () => {
      const scenario = new ReimbursementScenario({
        code: '36903',
        siteOfService: 'HOPD',
        deviceCost: 5000,
      });

      expect(() => scenario.toResponse()).toThrow('Scenario must be calculated');
    });
  });

  describe('getValidSites', () => {
    it('should return all valid sites', () => {
      const sites = ReimbursementScenario.getValidSites();

      expect(sites).toHaveLength(4);
      expect(sites.map(s => s.key)).toContain('IPPS');
      expect(sites.map(s => s.key)).toContain('HOPD');
      expect(sites.map(s => s.key)).toContain('ASC');
      expect(sites.map(s => s.key)).toContain('OBL');
    });
  });

  describe('getThresholds', () => {
    it('should return classification thresholds', () => {
      const thresholds = ReimbursementScenario.getThresholds();

      expect(thresholds.profitable).toBeDefined();
      expect(thresholds['break-even']).toBeDefined();
      expect(thresholds.loss).toBeDefined();
    });
  });
});


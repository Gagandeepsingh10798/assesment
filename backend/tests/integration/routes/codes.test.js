/**
 * Code Routes Integration Tests
 */

import request from 'supertest';
import createApp from '../../../src/app.js';
import codeService from '../../../src/services/codeService.js';

describe('Code Routes', () => {
  let app;

  beforeAll(async () => {
    // Initialize code service before tests
    await codeService.loadCodes();
    app = createApp();
  });

  describe('GET /api/codes', () => {
    it('should return paginated codes', async () => {
      const response = await request(app)
        .get('/api/codes')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should respect pagination parameters', async () => {
      const page1 = await request(app)
        .get('/api/codes')
        .query({ limit: 5, offset: 0 });

      const page2 = await request(app)
        .get('/api/codes')
        .query({ limit: 5, offset: 5 });

      expect(page1.body.data[0]).not.toEqual(page2.body.data[0]);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/codes')
        .query({ type: 'CPT', limit: 10 });

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        response.body.data.forEach(code => {
          expect(code.type).toBe('CPT');
        });
      }
    });

    it('should handle large offset gracefully', async () => {
      const response = await request(app)
        .get('/api/codes')
        .query({ offset: 1000000 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/codes/search', () => {
    it('should search codes by query', async () => {
      const response = await request(app)
        .get('/api/codes/search')
        .query({ q: 'heart' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('query', 'heart');
    });

    it('should return empty for short queries', async () => {
      const response = await request(app)
        .get('/api/codes/search')
        .query({ q: 'a' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.message).toContain('at least 2 characters');
    });

    it('should find codes by exact code match', async () => {
      // Get a code from the database first
      const codesResponse = await request(app)
        .get('/api/codes')
        .query({ limit: 1 });

      if (codesResponse.body.data.length > 0) {
        const testCode = codesResponse.body.data[0].code;

        const response = await request(app)
          .get('/api/codes/search')
          .query({ q: testCode });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].code).toBe(testCode);
      }
    });
  });

  describe('GET /api/codes/stats', () => {
    it('should return code statistics', async () => {
      const response = await request(app)
        .get('/api/codes/stats');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalCodes');
      expect(response.body).toHaveProperty('isLoaded', true);
      expect(response.body).toHaveProperty('types');
      expect(typeof response.body.totalCodes).toBe('number');
    });
  });

  describe('GET /api/codes/:code', () => {
    it('should return code details by code', async () => {
      // Get a code from the database first
      const codesResponse = await request(app)
        .get('/api/codes')
        .query({ limit: 1 });

      if (codesResponse.body.data.length > 0) {
        const testCode = codesResponse.body.data[0].code;

        const response = await request(app)
          .get(`/api/codes/${testCode}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('code', testCode);
        expect(response.body).toHaveProperty('description');
        expect(response.body).toHaveProperty('payments');
        expect(response.body.payments).toHaveProperty('IPPS');
        expect(response.body.payments).toHaveProperty('HOPD');
        expect(response.body.payments).toHaveProperty('ASC');
        expect(response.body.payments).toHaveProperty('OBL');
      }
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(app)
        .get('/api/codes/NONEXISTENT12345');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', true);
      expect(response.body.message).toContain('not found');
    });
  });
});

describe('Reimbursement Routes', () => {
  let app;

  beforeAll(async () => {
    await codeService.loadCodes();
    app = createApp();
  });

  describe('POST /api/reimbursement/scenario', () => {
    it('should calculate reimbursement scenario', async () => {
      // Get a CPT code first
      const codesResponse = await request(app)
        .get('/api/codes')
        .query({ type: 'CPT', limit: 1 });

      if (codesResponse.body.data.length > 0) {
        const testCode = codesResponse.body.data[0].code;

        const response = await request(app)
          .post('/api/reimbursement/scenario')
          .send({
            code: testCode,
            siteOfService: 'HOPD',
            deviceCost: 5000,
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('basePayment');
        expect(response.body).toHaveProperty('totalPayment');
        expect(response.body).toHaveProperty('margin');
        expect(response.body).toHaveProperty('classification');
      }
    });

    it('should include NTAP add-on in calculation', async () => {
      const codesResponse = await request(app)
        .get('/api/codes')
        .query({ type: 'CPT', limit: 1 });

      if (codesResponse.body.data.length > 0) {
        const testCode = codesResponse.body.data[0].code;

        const response = await request(app)
          .post('/api/reimbursement/scenario')
          .send({
            code: testCode,
            siteOfService: 'HOPD',
            deviceCost: 5000,
            ntapAddOn: 3770,
          });

        expect(response.status).toBe(200);
        expect(response.body.addOnPayment).toBe(3770);
      }
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/reimbursement/scenario')
        .send({
          siteOfService: 'HOPD',
          deviceCost: 5000,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', true);
    });

    it('should return 400 for invalid site of service', async () => {
      const response = await request(app)
        .post('/api/reimbursement/scenario')
        .send({
          code: '36903',
          siteOfService: 'INVALID',
          deviceCost: 5000,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', true);
    });

    it('should return 404 for non-existent code', async () => {
      const response = await request(app)
        .post('/api/reimbursement/scenario')
        .send({
          code: 'NONEXISTENT',
          siteOfService: 'HOPD',
          deviceCost: 5000,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/reimbursement/sites', () => {
    it('should return valid sites and thresholds', async () => {
      const response = await request(app)
        .get('/api/reimbursement/sites');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sites');
      expect(response.body).toHaveProperty('thresholds');
      expect(Array.isArray(response.body.sites)).toBe(true);
      expect(response.body.sites.length).toBe(4);
    });
  });
});

describe('Health Route', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });
});


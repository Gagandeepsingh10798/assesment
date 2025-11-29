import apiClient from './api.js';

/**
 * NTAP/TPT Service - API calls for NTAP and TPT calculations
 */
const ntapTptService = {
    // NTAP Methods
    async calculateNtap(params) {
        const { deviceCost, drgCode, drgPayment } = params;

        const response = await apiClient.post('/ntap/calculate', {
            deviceCost,
            drgCode,
            drgPayment,
        });

        return response.data;
    },

    async checkNtapEligibility(params) {
        const response = await apiClient.post('/ntap/eligibility', params);
        return response.data;
    },

    async generateNtapApplication(params) {
        const response = await apiClient.post('/ntap/application', params);
        return response.data;
    },

    async getApprovedNtapTechnologies() {
        const response = await apiClient.get('/ntap/approved-list');
        return response.data;
    },

    async getAvailableDrgs() {
        const response = await apiClient.get('/ntap/drgs');
        return response.data.drgs || [];
    },

    // TPT Methods
    async calculateTpt(params) {
        const { deviceCost, apcCode, packagedPayment } = params;

        const response = await apiClient.post('/tpt/calculate', {
            deviceCost,
            apcCode,
            packagedPayment,
        });

        return response.data;
    },

    async checkTptEligibility(params) {
        const response = await apiClient.post('/tpt/eligibility', params);
        return response.data;
    },

    async generateTptApplication(params) {
        const response = await apiClient.post('/tpt/application', params);
        return response.data;
    },

    async getApprovedTptTechnologies() {
        const response = await apiClient.get('/tpt/approved-list');
        return response.data;
    },

    async getAvailableApcs() {
        const response = await apiClient.get('/tpt/apcs');
        return response.data.apcs || [];
    },
};

export default ntapTptService;

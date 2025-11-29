import apiClient from './api.js';
import ReimbursementScenario from '../domain/ReimbursementScenario.js';

/**
 * Reimbursement Service - API calls for reimbursement scenarios
 */
const reimbursementService = {
    /**
     * Calculate reimbursement scenario
     */
    async calculateScenario(params) {
        const { code, siteOfService, deviceCost, ntapAddOn = 0 } = params;

        const response = await apiClient.post('/reimbursement/scenario', {
            code,
            siteOfService,
            deviceCost,
            ntapAddOn,
        });

        return ReimbursementScenario.fromApiResponse(response.data);
    },

    /**
     * Compare reimbursement across all sites
     */
    async compareAllSites(code, deviceCost, ntapAddOn = 0) {
        const response = await apiClient.get(`/reimbursement/compare/${code}`, {
            params: { deviceCost, ntapAddOn },
        });

        return {
            code: response.data.code,
            comparisons: response.data.comparisons.map(comp =>
                ReimbursementScenario.fromApiResponse(comp)
            ),
        };
    },

    /**
     * Get available sites of service
     */
    async getSites() {
        const response = await apiClient.get('/reimbursement/sites');
        return {
            sites: response.data.sites,
            thresholds: response.data.thresholds,
        };
    },
};

export default reimbursementService;

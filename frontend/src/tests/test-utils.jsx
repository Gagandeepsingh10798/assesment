import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with providers
 */
export function renderWithRouter(ui, options = {}) {
    return render(ui, {
        wrapper: ({ children }) => (
            <BrowserRouter>{children}</BrowserRouter>
        ),
        ...options,
    });
}

/**
 * Wait for async operations with timeout
 */
export function waitFor(callback, options = {}) {
    const { timeout = 3000, interval = 50 } = options;
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timer = setInterval(() => {
            try {
                const result = callback();
                if (result) {
                    clearInterval(timer);
                    resolve(result);
                }
            } catch (error) {
                if (Date.now() - startTime > timeout) {
                    clearInterval(timer);
                    reject(new Error('Timeout waiting for condition'));
                }
            }
        }, interval);
    });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

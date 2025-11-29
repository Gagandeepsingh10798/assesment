/**
 * Formatting Utilities
 */

/**
 * Format currency value
 */
export function formatCurrency(value, options = {}) {
    const {
        currency = 'USD',
        showCents = false,
        showSymbol = true,
    } = options;

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return '$0';

    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: showCents ? 2 : 0,
        maximumFractionDigits: showCents ? 2 : 0,
    }).format(numValue);

    return showSymbol ? formatted : formatted.replace(/[^0-9,.-]/g, '');
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 1) {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return '0%';

    return `${numValue.toFixed(decimals)}%`;
}

/**
 * Format date
 */
export function formatDate(date, format = 'short') {
    const dateObj = date instanceof Date ? date : new Date(date);

    if (isNaN(dateObj.getTime())) return '';

    const options = {
        short: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { month: 'long', day: 'numeric', year: 'numeric' },
        time: { hour: '2-digit', minute: '2-digit' },
        datetime: {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        },
    };

    return new Intl.DateTimeFormat('en-US', options[format] || options.short)
        .format(dateObj);
}

/**
 * Format time ago (e.g., "2 hours ago")
 */
export function formatTimeAgo(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const seconds = Math.floor((new Date() - dateObj) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

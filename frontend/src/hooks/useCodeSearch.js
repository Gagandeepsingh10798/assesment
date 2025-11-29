import { useState, useCallback, useEffect } from 'react';
import codeService from '../services/codeService.js';

/**
 * Custom hook for code search with debouncing
 */
export default function useCodeSearch(initialQuery = '', delay = 300) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Perform search with debouncing
     */
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const response = await codeService.searchCodes(query, { limit: 10 });
                setResults(response.codes);
                setError(null);
            } catch (err) {
                setError(err.message || 'Search failed');
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [query, delay]);

    /**
     * Update search query
     */
    const updateQuery = useCallback((newQuery) => {
        setQuery(newQuery);
    }, []);

    /**
     * Clear search
     */
    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
        setError(null);
    }, []);

    return {
        query,
        results,
        isSearching,
        error,
        updateQuery,
        clearSearch,
    };
}

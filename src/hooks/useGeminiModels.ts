import { useState, useEffect } from 'react';
import { getApiKey, getStoredGeminiModels, saveStoredGeminiModels } from '../services/settingsService';

export interface GeminiModel {
    id: string;
    name: string;
}

// Initialize from persistent storage
let cachedModels: GeminiModel[] | null = null;
const storedModels = getStoredGeminiModels();
if (storedModels.length > 0) {
    cachedModels = storedModels;
}

let isFetching = false;
let fetchPromise: Promise<GeminiModel[]> | null = null;

export const clearGeminiModelsCache = () => {
    cachedModels = null;
    fetchPromise = null;
    isFetching = false;
    saveStoredGeminiModels([]); // Clear persistent storage too
};

export const fetchGeminiModels = async (providedApiKey?: string): Promise<GeminiModel[]> => {
    if (cachedModels && !providedApiKey) return cachedModels;
    if (isFetching && fetchPromise && !providedApiKey) return fetchPromise;

    isFetching = true;
    fetchPromise = (async () => {
        const apiKey = providedApiKey || getApiKey();
        if (!apiKey) {
            isFetching = false;
            return cachedModels || [];
        }
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }
            const data = await response.json();
            if (data && data.models) {
                const models = data.models
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName || m.name.replace('models/', '')
                    }));
                
                // Always update cache and persistent storage if we got results
                if (models.length > 0) {
                    cachedModels = models;
                    saveStoredGeminiModels(models);
                }
                return models;
            }
            return cachedModels || [];
        } catch (error) {
            console.error("Error fetching Gemini models:", error);
            // If fetch fails, return cached if available
            return cachedModels || [];
        } finally {
            isFetching = false;
        }
    })();

    return fetchPromise;
};

export const useGeminiModels = (defaultOptions: GeminiModel[]) => {
    // Start with cached models or default options
    const [models, setModels] = useState<GeminiModel[]>(cachedModels || defaultOptions);
    const [isLoading, setIsLoading] = useState(!cachedModels);

    const fetchModels = async (apiKey?: string) => {
        setIsLoading(true);
        try {
            const fetchedModels = await fetchGeminiModels(apiKey);
            if (fetchedModels.length > 0) {
                setModels(fetchedModels);
            }
            return fetchedModels;
        } catch (error) {
            console.error("Failed to fetch models in hook:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only auto-fetch if we don't have cached models
        if (!cachedModels) {
            fetchModels().catch(() => {});
        }
    }, []);

    const refetch = async (apiKey?: string) => {
        // For manual refetch, we don't necessarily clear the cache first, 
        // we just trigger a new fetch that will overwrite it.
        return await fetchModels(apiKey);
    };

    return { models, isLoading, refetch };
};

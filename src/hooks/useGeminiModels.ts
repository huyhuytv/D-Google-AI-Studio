import { useState, useEffect } from 'react';
import { getApiKey } from '../services/settingsService';

export interface GeminiModel {
    id: string;
    name: string;
}

let cachedModels: GeminiModel[] | null = null;
let isFetching = false;
let fetchPromise: Promise<GeminiModel[]> | null = null;

export const clearGeminiModelsCache = () => {
    cachedModels = null;
    fetchPromise = null;
    isFetching = false;
};

export const fetchGeminiModels = async (providedApiKey?: string): Promise<GeminiModel[]> => {
    if (cachedModels && !providedApiKey) return cachedModels;
    if (isFetching && fetchPromise && !providedApiKey) return fetchPromise;

    isFetching = true;
    fetchPromise = (async () => {
        const apiKey = providedApiKey || getApiKey();
        if (!apiKey) {
            isFetching = false;
            return [];
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
                if (!providedApiKey) {
                    cachedModels = models;
                }
                return models;
            }
            return [];
        } catch (error) {
            console.error("Error fetching Gemini models:", error);
            throw error;
        } finally {
            isFetching = false;
        }
    })();

    return fetchPromise;
};

export const useGeminiModels = (defaultOptions: GeminiModel[]) => {
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
        if (!cachedModels) {
            fetchModels().catch(() => {});
        }
    }, []);

    const refetch = async (apiKey?: string) => {
        clearGeminiModelsCache();
        return await fetchModels(apiKey);
    };

    return { models, isLoading, refetch };
};

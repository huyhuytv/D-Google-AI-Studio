
import { useCallback, useState } from 'react';
import type { CharacterCard, WorldInfoEntry, WorldInfoRuntimeStats, SillyTavernPreset } from '../types';
import { performWorldInfoScan, prepareLorebookForAI } from '../services/worldInfoScanner';
import { processVariableUpdates } from '../services/variableEngine';
import { processWithRegex } from '../services/regexService';
import { scanWorldInfoWithAI } from '../services/geminiService';
import { getGlobalSmartScanSettings } from '../services/settingsService'; // Import Global Settings
import { dispatchSystemLog } from '../services/logBridge';
import { generateEmbedding, cosineSimilarity, getCachedEmbeddings, ensureEmbeddingsLoaded } from '../services/embeddingService';
import { useLorebook } from '../contexts/LorebookContext';

export interface WorldSystemResult {
    // Updated to be async to support AI calls
    scanInput: (
        text: string, 
        worldInfoState: Record<string, boolean>,
        worldInfoRuntime: Record<string, WorldInfoRuntimeStats>,
        worldInfoPinned: Record<string, boolean>,
        preset?: SillyTavernPreset, 
        historyForScan?: { role: string, content: string }[],
        latestInput?: string, 
        variables?: Record<string, any>, 
        dynamicEntries?: WorldInfoEntry[],
        currentTurnIndex?: number,
        overrideAiUids?: string[] // NEW: Override option for regeneration
    ) => Promise<{
        activeEntries: WorldInfoEntry[];
        updatedRuntimeState: Record<string, WorldInfoRuntimeStats>;
        smartScanLog?: { fullPrompt: string, rawResponse: string, latency: number }; 
        selectionData?: { prompt: string, selectedItems: { id: string, score: number, name: string }[] }; // NEW
    }>;
    processOutput: (
        rawContent: string,
        currentVariables: Record<string, any>
    ) => {
        updatedVariables: Record<string, any>;
        displayContent: string;
        interactiveHtml: string | null;
        diagnosticLog: string;
        variableLog: string;
        originalRawContent: string;
    };
    isScanning: boolean;
}

export const useWorldSystem = (card: CharacterCard | null): WorldSystemResult => {
    const [isScanning, setIsScanning] = useState(false);
    const { lorebooks } = useLorebook();

    const scanInput = useCallback(async (
        textToScan: string,
        worldInfoState: Record<string, boolean>,
        worldInfoRuntime: Record<string, WorldInfoRuntimeStats>,
        worldInfoPinned: Record<string, boolean>,
        preset?: SillyTavernPreset, // Legacy arg, mostly ignored for smart scan now
        historyForScan: { role: string, content: string }[] = [],
        latestInput: string = '',
        variables: Record<string, any> = {},
        dynamicEntries: WorldInfoEntry[] = [],
        currentTurnIndex: number = 0, // Default 0
        overrideAiUids?: string[] // NEW Parameter
    ) => {
        // FETCH GLOBAL SETTINGS
        const globalSettings = getGlobalSmartScanSettings();

        // MERGE LOGIC: Combine static entries from card with dynamic entries from RPG
        const staticEntries = card?.char_book?.entries || [];
        // FILTER: Only include entries that are enabled in worldInfoState
        const allEntries = [...staticEntries, ...dynamicEntries].filter(entry => {
            if (!entry.uid) return false;
            return worldInfoState[entry.uid] !== false;
        });
        
        let aiActiveUids: string[] = [];
        let semanticActiveUids: string[] = [];
        let semanticScores: Record<string, number> = {}; // NEW
        let smartScanLogData;

        // Determine Mode from GLOBAL SETTINGS
        const mode = globalSettings.mode || 'keyword';
        const isLlmEnabled = globalSettings.enabled && ['llm_only', 'ultimate'].includes(mode);
        const isSemanticEnabled = globalSettings.enabled && ['semantic', 'hybrid_fast', 'ultimate'].includes(mode);
        const isKeywordEnabled = !globalSettings.enabled || ['keyword', 'hybrid_fast', 'ultimate'].includes(mode);

        // --- SEMANTIC SCAN LOGIC ---
        if (isSemanticEnabled) {
            if (overrideAiUids && overrideAiUids.length > 0) {
                // Skip semantic search if overriding
            } else {
                setIsScanning(true);
                try {
                    const inputText = textToScan;
                    if (inputText.trim()) {
                        const inputEmbedding = await generateEmbedding(inputText);
                        
                        // 1. Character-specific Lorebook
                        const characterId = card?.fileName || card?.name || 'default';
                        await ensureEmbeddingsLoaded(characterId);
                        const charEmbeddings = getCachedEmbeddings(characterId);
                        
                        // 2. Global Lorebooks
                        const globalEmbeddings: any[] = [];
                        for (const lb of lorebooks) {
                            const lbId = `global_lb_${lb.name}`;
                            await ensureEmbeddingsLoaded(lbId);
                            globalEmbeddings.push(...getCachedEmbeddings(lbId));
                        }

                        const allEmbeddings = [...charEmbeddings, ...globalEmbeddings];
                        
                        // Exclude constant entries from semantic search budget
                        const enabledUids = new Set(allEntries.filter(e => !e.constant).map(e => e.uid));
                        
                        // Score all chunks
                        const scoredChunks = allEmbeddings
                            .filter(record => enabledUids.has(record.uid))
                            .map(record => ({
                                uid: record.uid,
                                score: cosineSimilarity(inputEmbedding, record.vector)
                            }));
                        
                        // Aggregate scores by UID (take the max score among chunks for a given UID)
                        const maxScoreByUid: Record<string, number> = {};
                        scoredChunks.forEach(chunk => {
                            if (!maxScoreByUid[chunk.uid] || chunk.score > maxScoreByUid[chunk.uid]) {
                                maxScoreByUid[chunk.uid] = chunk.score;
                            }
                        });

                        // Convert back to array for sorting and filtering
                        const scoredEntries = Object.entries(maxScoreByUid).map(([uid, score]) => ({
                            uid,
                            score
                        }));

                        scoredEntries.forEach(e => {
                            semanticScores[e.uid] = e.score;
                        });

                        const threshold = globalSettings.semantic_threshold || 0.7;
                        const maxSemanticEntries = globalSettings.max_semantic_entries || 20;
                        
                        semanticActiveUids = scoredEntries
                            .filter(e => e.score >= threshold)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, maxSemanticEntries)
                            .map(e => e.uid);
                    }
                } catch (e: any) {
                    console.error("[Semantic Scan] Error:", e);
                    dispatchSystemLog('error', 'system', `[Semantic Scan] Failed, falling back to keyword. Error: ${e}`);
                    if (e.message?.includes('API Key')) {
                        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Vui lòng cấu hình Gemini API Key trong phần Cài đặt để sử dụng Semantic Search.', type: 'error' } }));
                    } else {
                        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Lỗi Semantic Search, chuyển sang quét từ khóa.', type: 'error' } }));
                    }
                } finally {
                    setIsScanning(false);
                }
            }
        }

        // --- SMART SCAN LOGIC (LLM PART) ---
        if (isLlmEnabled) {
            
            // CHECK OVERRIDE FIRST
            if (overrideAiUids && overrideAiUids.length > 0) {
                // If we have an override (Regeneration), skip the API call
                aiActiveUids = overrideAiUids;
                dispatchSystemLog('state', 'system', `[Smart Scan] Skipped API call. Reusing ${aiActiveUids.length} UIDs from previous turn.`);
            } else {
                // Normal AI Scan
                setIsScanning(true);
                const startTime = Date.now();
                
                try {
                    // 1. Prepare Context (History) - Use global depth
                    const depth = globalSettings.depth || 3;
                    const chatContext = historyForScan.slice(-depth).map(m => {
                        if (m.role === 'model') {
                            const match = m.content.match(/<content>([\s\S]*?)<\/content>/);
                            return match ? match[1].trim() : m.content;
                        }
                        return m.content;
                    }).join('\n');
                    
                    // 2. Prepare State String
                    let stateString = "";
                    if (variables && Object.keys(variables).length > 0) {
                        stateString = Object.entries(variables)
                            .map(([k, v]) => {
                                if (Array.isArray(v) && v.length > 1 && typeof v[1] === 'string') {
                                    return `- ${k}: ${v[0]} (${v[1]})`; 
                                }
                                return `- ${k}: ${JSON.stringify(v)}`;
                            })
                            .join('\n');
                    }

                    // 3. Prepare Lorebook Payload (Separated)
                    // NOW USING currentTurnIndex to flag dormant entries
                    // AND PASSING scan_strategy for full context option
                    const strategy = globalSettings.scan_strategy || 'efficient';
                    const { contextString, candidateString } = prepareLorebookForAI(allEntries, currentTurnIndex, worldInfoRuntime, strategy);

                    // Only scan if there are candidates to choose from
                    if (candidateString) {
                        // 4. Call API with Global Settings
                        const { selectedIds, outgoingPrompt, rawResponse } = await scanWorldInfoWithAI(
                            chatContext, 
                            contextString,
                            candidateString,
                            latestInput || textToScan, 
                            stateString,
                            globalSettings.model || 'gemini-3.1-flash-lite-preview',
                            globalSettings.system_prompt 
                        );
                        
                        // 5. Apply "Token Budget" / Max Entries from Global Settings
                        const maxEntries = globalSettings.max_entries || 5;
                        aiActiveUids = selectedIds.slice(0, maxEntries);
                        
                        const endTime = Date.now();
                        smartScanLogData = {
                            fullPrompt: outgoingPrompt,
                            rawResponse: rawResponse,
                            latency: endTime - startTime
                        };
                    }
                } catch (e) {
                    console.error("[Smart Scan] Error:", e);
                    // Re-throw error to be caught by useChatFlow
                    throw e;
                } finally {
                    setIsScanning(false);
                }
            }
        }

        // Combine AI and Semantic UIDs
        const combinedAiUids = Array.from(new Set([...aiActiveUids, ...semanticActiveUids]));

        // PREPARE SELECTION DATA FOR DEBUG
        const selectionData = {
            prompt: smartScanLogData?.fullPrompt || `Semantic Search (Threshold: ${globalSettings.semantic_threshold || 0.7})`,
            selectedItems: combinedAiUids.map(uid => {
                const entry = allEntries.find(e => e.uid === uid);
                return {
                    id: uid,
                    score: semanticScores[uid] || 1.0, // AI scan doesn't give scores easily yet, use 1.0
                    name: entry?.comment || 'Không tên'
                };
            })
        };

        // --- HYBRID / KEYWORD SCANNING ---
        const result = performWorldInfoScan(
            textToScan, 
            allEntries, 
            worldInfoState, 
            worldInfoRuntime, 
            worldInfoPinned,
            combinedAiUids,
            !isKeywordEnabled, // Bypass keyword check if isKeywordEnabled is false
            currentTurnIndex, // Pass turn for Lifecycle check
            globalSettings.aiStickyDuration // Pass Global AI Sticky Override
        );

        return { ...result, smartScanLog: smartScanLogData, selectionData };
    }, [card, lorebooks]);

    const processOutput = useCallback((
        rawContent: string,
        currentVariables: Record<string, any>
    ) => {
        // 1. Variable Engine (Variable Processing Phase)
        const { updatedVariables, cleanedText, variableLog } = processVariableUpdates(rawContent, currentVariables);

        // 2. Regex / Script Engine (Display Processing Phase)
        const scripts = card?.extensions?.regex_scripts || [];
        const { displayContent, interactiveHtml, diagnosticLog } = processWithRegex(cleanedText, scripts, [2]);

        return {
            updatedVariables,
            displayContent,
            interactiveHtml,
            diagnosticLog,
            variableLog,
            originalRawContent: rawContent
        };
    }, [card]);

    return {
        scanInput,
        processOutput,
        isScanning
    };
};

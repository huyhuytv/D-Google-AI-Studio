
import type { AdventureSnapshot, ChatSession, CharacterCard, SillyTavernPreset, UserPersona, FullSystemBackup, BackupCharacter } from '../types';
import * as dbService from './dbService';
import { characterToStorable } from './dbService';
import { getAllLocalStorageData, restoreLocalStorageData } from './settingsService';

/**
 * Helper: Convert ArrayBuffer to Base64 efficiently using FileReader
 */
const arrayBufferToBase64 = async (buffer: ArrayBuffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Helper: Convert Base64 to ArrayBuffer efficiently using fetch
 */
const base64ToArrayBuffer = async (base64: string, type: string = 'application/octet-stream'): Promise<ArrayBuffer> => {
    const res = await fetch(`data:${type};base64,${base64}`);
    return await res.arrayBuffer();
};

/**
 * Creates an "Adventure Snapshot" (Game Save) containing all necessary data to resume a session exactly as is.
 */
export const createSnapshot = (
    session: ChatSession,
    character: CharacterCard,
    preset: SillyTavernPreset,
    persona: UserPersona | null
): void => {
    const snapshot: AdventureSnapshot = {
        version: 1,
        timestamp: Date.now(),
        meta: {
            exportedBy: 'AI Studio Card Tool',
            description: `Bản ghi phiêu lưu: ${character.name} - ${new Date().toLocaleString()}`
        },
        data: {
            character: character,
            characterFileName: session.characterFileName, // Keep original filename ref
            preset: preset,
            session: session,
            userPersona: persona
        }
    };

    const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Format: Adventure_CharacterName_SessionID.json
    const safeCharName = character.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `Adventure_${safeCharName}_${session.sessionId.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Imports an Adventure Snapshot JSON file and restores all data to IndexedDB.
 */
export const importSnapshot = async (file: File): Promise<string> => {
    try {
        // Use Response.json() to avoid loading the entire file into a JS string, preventing OOM crashes on large files
        const response = new Response(file);
        const snapshot = await response.json() as AdventureSnapshot;

        // Basic Validation
        if (!snapshot.data || !snapshot.data.session || !snapshot.data.character) {
            throw new Error("File không hợp lệ: Thiếu dữ liệu phiên hoặc nhân vật.");
        }

        const { character, characterFileName, preset, session, userPersona } = snapshot.data;

        // 1. Restore Character (Overwrite or Add)
        const charStorable = await characterToStorable({
            card: character,
            fileName: characterFileName,
            avatarUrl: null, 
            avatarFile: null 
        });
        await dbService.saveCharacter(charStorable);

        // 2. Restore Preset
        if (preset) {
            await dbService.savePreset(preset);
        }

        // 3. Restore Persona
        if (userPersona) {
            await dbService.saveUserPersona(userPersona);
        }

        // 4. Restore Session
        session.characterFileName = characterFileName; 
        session.lastUpdated = Date.now();
        
        await dbService.saveChatSession(session);

        return session.sessionId;

    } catch (e) {
        console.error("Import failed", e);
        throw new Error(`Lỗi khi nhập bản ghi: ${e instanceof Error ? e.message : String(e)}`);
    }
};

/**
 * FULL SYSTEM BACKUP: Creates a massive JSON containing EVERYTHING.
 */
export const createFullSystemBackup = async (): Promise<File> => {
    try {
        // 1. Fetch all data from IndexedDB
        const storedCharacters = await dbService.getAllCharacters();
        const storedPresets = await dbService.getAllPresets();
        const storedLorebooks = await dbService.getAllLorebooks();
        const storedPersonas = await dbService.getAllUserPersonas();
        const storedSessions = await dbService.getAllChatSessions();
        const appSettings = getAllLocalStorageData();

        // 2. Process Characters (Convert ArrayBuffer avatars to Base64)
        const backupCharacters: BackupCharacter[] = [];
        for (const c of storedCharacters) {
            backupCharacters.push({
                card: c.card,
                fileName: c.fileName,
                avatarBase64: c.avatar ? await arrayBufferToBase64(c.avatar.buffer) : undefined,
                avatarType: c.avatar?.type
            });
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 3. Construct Backup Object
        const fullBackup: FullSystemBackup = {
            version: 1,
            timestamp: Date.now(),
            dataType: 'full_system_backup',
            meta: {
                exportedBy: 'AI Studio Card Tool',
                description: `Full System Backup - ${new Date().toLocaleString()}`
            },
            data: {
                characters: backupCharacters,
                presets: storedPresets,
                lorebooks: storedLorebooks,
                personas: storedPersonas,
                chatSessions: storedSessions,
                appSettings: appSettings
            }
        };

        // Remove pretty-printing (null, 2) to significantly reduce memory usage and file size
        const jsonString = JSON.stringify(fullBackup);
        const fileName = `FullBackup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
        
        return new File([jsonString], fileName, { type: 'application/json' });

    } catch (e) {
        console.error("Full Backup Failed:", e);
        throw new Error(`Lỗi sao lưu toàn bộ: ${e instanceof Error ? e.message : String(e)}`);
    }
};

/**
 * FULL SYSTEM RESTORE: Wipes/Overwrites data from a backup file.
 */
export const restoreFullSystemBackup = async (file: File): Promise<void> => {
    try {
        // Use Response.json() to avoid loading the entire file into a JS string, preventing OOM crashes on large files
        const response = new Response(file);
        const backup = await response.json() as FullSystemBackup;

        if (backup.dataType !== 'full_system_backup' || !backup.data) {
            throw new Error("File không phải là định dạng Sao lưu Hệ thống hợp lệ.");
        }

        const { characters, presets, lorebooks, personas, chatSessions, appSettings } = backup.data;

        // 1. Restore Characters
        for (const c of characters) {
            await dbService.saveCharacter({
                card: c.card,
                fileName: c.fileName,
                avatar: c.avatarBase64 ? {
                    buffer: await base64ToArrayBuffer(c.avatarBase64, c.avatarType || 'image/png'),
                    name: c.fileName.replace('.json', '.png'), // Approximation
                    type: c.avatarType || 'image/png'
                } : undefined
            });
            // Yield to event loop to prevent blocking the main thread and reduce memory pressure
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 2. Restore Presets
        for (const p of presets) {
            await dbService.savePreset(p);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 3. Restore Lorebooks
        for (const l of lorebooks) {
            await dbService.saveLorebook(l);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 4. Restore Personas
        for (const p of personas) {
            await dbService.saveUserPersona(p);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 5. Restore Chat Sessions
        for (const s of chatSessions) {
            await dbService.saveChatSession(s);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 6. Restore App Settings (LocalStorage)
        if (appSettings) {
            restoreLocalStorageData(appSettings);
        }

    } catch (e) {
        console.error("Full Restore Failed:", e);
        throw new Error(`Lỗi khôi phục toàn bộ: ${e instanceof Error ? e.message : String(e)}`);
    }
};

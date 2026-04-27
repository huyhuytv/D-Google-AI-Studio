
import React, { useState, useRef } from 'react';
import { createFullSystemBackup, restoreFullSystemBackup, cleanupSystemData } from '../services/snapshotService';
import { Loader } from './Loader';
import { useToast } from './ToastSystem';
import { useCharacter } from '../contexts/CharacterContext';
import { usePreset } from '../contexts/PresetContext';
import { useLorebook } from '../contexts/LorebookContext';
import { useUserPersona } from '../contexts/UserPersonaContext';

export const BackupRestoreSettings: React.FC = () => {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const { reloadCharacters } = useCharacter();
    const { reloadPresets } = usePreset();
    const { reloadLorebooks } = useLorebook();
    const { reloadPersonas } = useUserPersona();

    // HANDLE CLEANUP
    const handleCleanup = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn dọn dẹp dữ liệu rác? Thao tác này sẽ xóa vĩnh viễn các nhật ký gỡ lỗi (logs) và dữ liệu chuẩn đoán trong tất cả cuộc trò chuyện để giảm dung lượng bộ nhớ. Lịch sử chat chính vẫn được giữ nguyên.")) {
            return;
        }

        setIsCleaning(true);
        try {
            const result = await cleanupSystemData();
            showToast(`Đã dọn dẹp xong ${result.sessionsCleaned} cuộc trò chuyện.`, 'success');
        } catch (e) {
            showToast(`Lỗi dọn dẹp: ${e instanceof Error ? e.message : String(e)}`, 'error');
        } finally {
            setIsCleaning(false);
        }
    };

    // HANDLE BACKUP
    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const file = await createFullSystemBackup();
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'SillyTavern Card Studio Backup',
                        text: 'Full system backup file.',
                    });
                    showToast("Đã mở menu chia sẻ!", 'success');
                } catch (shareError) {
                    if ((shareError as Error).name !== 'AbortError') {
                        downloadFile(file);
                    }
                }
            } else {
                downloadFile(file);
            }
        } catch (e) {
            showToast(`Lỗi sao lưu: ${e instanceof Error ? e.message : String(e)}`, 'error');
        } finally {
            setIsBackingUp(false);
        }
    };

    const downloadFile = (file: File) => {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Đã tải xuống file sao lưu.", 'success');
    };

    // HANDLE RESTORE
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsRestoring(true);
        try {
            await restoreFullSystemBackup(file);
            await Promise.all([
                reloadCharacters(),
                reloadPresets(),
                reloadLorebooks(),
                reloadPersonas()
            ]);
            showToast("Khôi phục thành công! Dữ liệu đã được cập nhật.", 'success');
        } catch (e) {
            console.error(e);
            showToast(`Lỗi khôi phục: ${e instanceof Error ? e.message : String(e)}`, 'error');
        } finally {
            e.target.value = '';
            setIsRestoring(false);
        }
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl shadow-lg max-w-3xl mx-auto space-y-8 ">
            <h3 className="text-xl font-bold text-sky-400 mb-2 border-b border-slate-700 pb-4">
                Sao lưu & Khôi phục Hệ thống
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* BACKUP SECTION */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center text-center hover:border-sky-500/50 ">
                    <div className="w-16 h-16 bg-sky-900/30 text-sky-400 rounded-full flex items-center justify-center mb-4 text-3xl">
                        📤
                    </div>
                    <h4 className="text-lg font-bold text-slate-200 mb-2">Sao Lưu Toàn Bộ</h4>
                    <button
                        onClick={handleBackup}
                        disabled={isBackingUp}
                        className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow-lg shadow-sky-900/20  active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {isBackingUp ? <Loader message="Đang xử lý..." /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Sao Lưu Ngay
                            </>
                        )}
                    </button>
                </div>

                {/* RESTORE SECTION */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center text-center hover:border-emerald-500/50 ">
                    <div className="w-16 h-16 bg-emerald-900/30 text-emerald-400 rounded-full flex items-center justify-center mb-4 text-3xl">
                        📥
                    </div>
                    <h4 className="text-lg font-bold text-slate-200 mb-2">Khôi Phục Dữ Liệu</h4>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        onClick={() => !isRestoring && fileInputRef.current?.click()}
                        disabled={isRestoring}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-900/20  active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                    >
                        {isRestoring ? <Loader message="Đang xử lý..." /> : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                Chọn Tệp Khôi Phục
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* CLEANUP SECTION */}
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center gap-6 hover:border-orange-500/50 ">
                <div className="w-16 h-16 bg-orange-900/30 text-orange-400 rounded-full flex items-center justify-center text-3xl shrink-0">
                    🧹
                </div>
                <div className="flex-grow text-center md:text-left">
                    <h4 className="text-lg font-bold text-slate-200 mb-1">Dọn Dẹp Hệ Thống (Optimize)</h4>
                    <p className="text-sm text-slate-400">
                        Xóa bỏ các dữ liệu nhật ký (logs), nội dung prompt gỡ lỗi và thông tin chuẩn đoán dư thừa trong tất cả các phiên trò chuyện để giải phóng dung lượng. 
                        Nội dung tin nhắn văn bản sẽ <strong>không</strong> bị ảnh hưởng.
                    </p>
                </div>
                <button
                    onClick={handleCleanup}
                    disabled={isCleaning}
                    className="w-full md:w-auto py-3 px-8 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg shadow-lg shadow-orange-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isCleaning ? <Loader message="Đang dọn..." /> : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            Dọn Dẹp Ngay
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

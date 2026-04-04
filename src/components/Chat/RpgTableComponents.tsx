
import React, { useState, useRef, useEffect } from 'react';
import type { RPGColumn } from '../../types/rpg';

// --- EDITABLE CELL ---

interface EditableCellProps {
    value: any;
    column: RPGColumn;
    onSave: (value: any) => void;
    className?: string;
    isEditing?: boolean;
}

export const EditableCell: React.FC<EditableCellProps> = ({ value, column, onSave, className = '' }) => {
    const [isLocalEditing, setIsLocalEditing] = useState(false);
    const [tempValue, setTempValue] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync value on prop change
    useEffect(() => {
        setTempValue(String(value ?? ''));
    }, [value]);

    useEffect(() => {
        if (isLocalEditing && inputRef.current) {
            inputRef.current.focus();
            if (column.type !== 'boolean') {
                inputRef.current.select();
            }
        }
    }, [isLocalEditing, column.type]);

    const handleStartEditing = () => {
        setTempValue(String(value ?? ''));
        setIsLocalEditing(true);
    };

    const handleSave = () => {
        let finalVal: any = tempValue;
        
        if (column.type === 'number') {
            finalVal = parseFloat(tempValue);
            if (isNaN(finalVal)) finalVal = 0;
        } else if (column.type === 'boolean') {
            finalVal = tempValue === 'true';
        }

        if (finalVal !== value) {
            onSave(finalVal);
        }
        setIsLocalEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setTempValue(String(value ?? ''));
            setIsLocalEditing(false);
        }
    };

    // --- RENDERERS ---

    if (column.type === 'boolean') {
        const isChecked = value === true || value === 'true';
        return (
            <div className={`flex flex-col gap-1 ${className}`}>
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{column.label}</span>
                <div 
                    className={`flex items-center cursor-pointer p-2 rounded   border ${isChecked ? 'bg-sky-900/20 border-sky-500/50' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'}`}
                    onClick={() => onSave(!isChecked)}
                    role="checkbox"
                    aria-checked={isChecked}
                    tabIndex={0}
                >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center  ${isChecked ? 'bg-sky-500 border-sky-400' : 'bg-slate-800 border-slate-600'}`}>
                         {isChecked && <span className="text-[10px] font-bold text-white">[X]</span>}
                    </div>
                    <span className={`ml-2 text-sm font-medium ${isChecked ? 'text-sky-300' : 'text-slate-400'}`}>{isChecked ? 'Có (Yes)' : 'Không (No)'}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{column.label}</span>
            {isLocalEditing ? (
                <input
                    ref={inputRef}
                    type={column.type === 'number' ? 'number' : 'text'}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-slate-900 text-white border border-sky-500 rounded px-3 py-2 text-sm outline-none shadow-lg focus:ring-1 focus:ring-sky-500"
                />
            ) : (
                <div 
                    onClick={handleStartEditing}
                    className="w-full min-h-[2.5rem] px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/50 hover:text-white cursor-text  rounded border border-slate-700 hover:border-sky-500/50 break-words whitespace-pre-wrap bg-slate-800/30 flex items-center"
                    role="textbox"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleStartEditing(); }}
                    title="Nhấn để chỉnh sửa"
                >
                    {value === null || value === undefined || value === '' ? <span className="text-slate-600 italic text-xs">Trống (Nhấn để nhập)</span> : String(value)}
                </div>
            )}
        </div>
    );
};

// --- ACCORDION ROW ITEM ---

interface RpgRowItemProps {
    row: any[]; // [UUID, Col1, Col2...]
    columns: RPGColumn[];
    rowIndex: number;
    onCellUpdate: (colIndex: number, value: any) => void;
    onToggleDelete: () => void;
    onRestore: () => void;
    isPendingDelete: boolean;
    // New Props for external control
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export const RpgRowItem: React.FC<RpgRowItemProps> = ({ 
    row, 
    columns, 
    rowIndex, 
    onCellUpdate, 
    onToggleDelete, 
    onRestore,
    isPendingDelete,
    isExpanded,
    onToggleExpand
}) => {
    
    // Get primary display value (Column 0, which corresponds to row index 1)
    const primaryValue = row[1]; 

    if (isPendingDelete) {
        return (
            <div className="mb-2 flex items-center justify-between p-3 bg-red-900/10 border border-red-900/30 rounded-lg   select-none">
                <div className="flex items-center gap-3 overflow-hidden text-red-400">
                     <span className="text-xs font-mono opacity-50 w-6 text-center">#{rowIndex + 1}</span>
                     <span className="text-sm font-medium line-through truncate opacity-70">
                         {primaryValue || '(Dữ liệu trống)'}
                     </span>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onRestore(); }}
                    className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded border border-slate-600  flex items-center gap-1 shadow-sm hover:shadow-md"
                >
                    <span className="text-xs font-bold">[Hoàn tác]</span>
                    Hoàn tác
                </button>
            </div>
        );
    }

    return (
        <div className="mb-2">
            {/* Split Button Header */}
            <div className="flex items-stretch rounded-lg shadow-sm overflow-hidden   hover:shadow-md">
                
                {/* 1. Main Expand Button */}
                <button
                    onClick={onToggleExpand}
                    className={`flex-grow flex items-center gap-3 px-4 py-3 text-left   border border-r-0 rounded-l-lg outline-none focus:ring-2 focus:ring-sky-500/50 group ${
                        isExpanded
                            ? 'bg-slate-700 border-slate-600 text-sky-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:text-white hover:border-slate-600'
                    }`}
                >
                    {/* Icon */}
                    <div className={`  text-slate-500 group-hover:text-sky-400 ${isExpanded ? 'rotate-90 text-sky-400' : ''}`}>
                         <span className="text-xs font-bold">[Chi tiết]</span>
                    </div>
                    
                    {/* Index */}
                    <span className="font-mono text-xs text-slate-500 w-6 text-center">#{rowIndex + 1}</span>
                    
                    {/* Title */}
                    <span className={`font-bold text-sm truncate flex-grow ${!primaryValue ? 'italic opacity-50' : ''}`}>
                        {primaryValue || '(Chưa đặt tên)'}
                    </span>
                    
                    {/* Expand Hint (Optional, shows only on hover) */}
                    <span className="text-[10px] uppercase font-bold text-slate-500 opacity-0 group-hover:opacity-100 ">
                        {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                    </span>
                </button>

                {/* 2. Delete Button (Separate Block) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleDelete(); }}
                    className={`px-3 flex items-center justify-center border rounded-r-lg   outline-none focus:ring-2 focus:ring-red-500/50 active:bg-slate-900 ${
                         isExpanded
                            ? 'bg-slate-700 border-slate-600 text-slate-500 hover:text-red-400 hover:bg-slate-600'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-red-400 hover:bg-slate-750 hover:border-slate-600'
                    }`}
                    title="Xóa dòng này"
                >
                    <span className="text-xs font-bold">[Xóa]</span>
                </button>
            </div>

            {/* Body / Detailed View - FORM MODE */}
            {isExpanded && (
                <div className="relative mt-1 mx-1 p-4 bg-slate-900/80 border border-slate-700 rounded-b-lg border-t-0 shadow-inner  before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-slate-600 before:to-transparent">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        {columns.map((col, idx) => (
                            <EditableCell 
                                key={col.id}
                                value={row[idx + 1]} // Skip UUID (0), start at 1
                                column={col}
                                onSave={(val) => onCellUpdate(idx, val)} // Index corresponds to column array index
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

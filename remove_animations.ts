import * as fs from 'fs';
import * as path from 'path';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });

    return arrayOfFiles;
}

const filesToProcess = getAllFiles('src');

function processFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Remove animation classes
    const classesToRemove = [
        'animate-pulse', 'animate-spin', 'animate-fade-in-up', 'animate-bounce',
        'animate-slide-in-right', 'animate-slide-in-down',
        'transition-colors', 'transition-transform', 'transition-all', 'transition-opacity',
        'duration-100', 'duration-200', 'duration-300', 'duration-500',
        'transform', 'hover:scale-105', 'hover:scale-110'
    ];
    
    classesToRemove.forEach(cls => {
        const regex = new RegExp(`\\b${cls}\\b`, 'g');
        content = content.replace(regex, '');
    });
    
    // Clean up empty classNames
    content = content.replace(/className="\s+"/g, '');
    content = content.replace(/className={`\s+`}/g, '');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Processed: ${filePath}`);
    }
}

filesToProcess.forEach(processFile);
console.log('Done');

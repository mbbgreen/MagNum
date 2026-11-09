const fs = require('fs');
const path = require('path');



const targetExt = ['js', 'jsx','css','html', 'ts', 'tsx', 'json', 'nsi', 'rs']; 
const outputExt = 'txt'; 



const normalizeExt = (ext) => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;


const targetExtensions = targetExt.map(normalizeExt);
const outputExtension = normalizeExt(outputExt);

const rootDir = __dirname;
const outputFileName = `project${outputExtension}`;
const outputFile = path.join(rootDir, outputFileName);


const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.kilo', '.clinerules', '.fingerprint', 'target', 'gen', 'magnum-profile', 'deepseek-profile', '.magnum', '.vscode', '.idea'];


const currentScriptFile = path.basename(__filename);
const excludeFiles = [currentScriptFile, outputFileName, '.gitattributes', '.gitignore', 'package.json', 'package-lock.json', 'fonts_temp.css', 'tsconfig.json', 'tsconfig.node.json'];

function getAllFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                results = results.concat(getAllFiles(filePath));
            }
        } else {
            const fileExt = path.extname(file).toLowerCase();
            
            if (!excludeFiles.includes(file) && targetExtensions.includes(fileExt) && !file.startsWith('.')) {
                results.push(filePath);
            }
        }
    }
    return results;
}

const files = getAllFiles(rootDir);

let output = '';


output += `// ==============================================================================\n`;
output += `// PROJECT FILE INDEX (${files.length} files included)\n`;
output += `// ==============================================================================\n`;
files.forEach((filePath, index) => {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    output += `// ${index + 1}. ${relPath}\n`;
});
output += `// ==============================================================================\n\n\n`;


for (const filePath of files) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');

    output += `// ==============================================================================\n`;
    output += `// FILE: ${relativePath}\n`;
    output += `// ==============================================================================\n\n`;
    output += `${content}\n\n`;
}

fs.writeFileSync(outputFile, output, 'utf8');


const extListStr = targetExt.join(', ');
console.log(`Done! Combined ${files.length} (${extListStr}) files into ${outputFileName}`);
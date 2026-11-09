'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { exec } = require('node:child_process');

const MAX_LINES_PER_BATCH = 800;

class ProjectTools {
  constructor(workspaceDir, ignoredPatterns = []) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.excludedPaths = new Set();
    this.ignoredPatterns = new Set(ignoredPatterns);
    this.logger = null;
  }

  setIgnoredPatterns(patterns = []) {
    this.ignoredPatterns = new Set(patterns);
  }
  setLogger(fn) {
    this.logger = typeof fn === 'function' ? fn : null;
  }
  log(line, kind = 'sys') {
    if (this.logger) {
      try { this.logger(line, kind); } catch {}
    }
  }

  setExcludedPaths(paths = []) {
    this.excludedPaths = new Set(paths.map(p => p.replace(/\\/g, '/')));
  }

  isExcluded(relPath) {
    const norm = relPath.replace(/\\/g, '/');
    const segments = norm.split('/');

    for (const segment of segments) {
      if (this.ignoredPatterns.has(segment)) return true;
    }
    if (this.ignoredPatterns.has(norm)) return true;

    for (const ex of this.excludedPaths) {
      if (norm === ex || norm.startsWith(ex + '/')) return true;
    }
    return false;
  }

  
  async readMultipleFiles(filePaths = []) {
    const results = {};
    for (const relPath of filePaths) {
      try {
        const fullPath = path.resolve(this.workspaceDir, relPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        results[relPath] = content;
      } catch (err) {
        results[relPath] = `[ERROR: ${err.message}]`;
      }
    }
    return results;
  }

  
  async readFileDetails(relPath, range = null) {
    try {
      const fullPath = path.resolve(this.workspaceDir, relPath);
      const rawContent = await fs.readFile(fullPath, 'utf-8');
      const normalized = rawContent.replace(/\r\n/g, '\n');
      const allLines = normalized.split('\n');
      const totalLines = allLines.length;

      let start = 1;
      let end = totalLines;

      if (range) {
        if (typeof range.start_line === 'number' && range.start_line >= 1) {
          start = Math.max(1, Math.min(totalLines, range.start_line));
        }
        if (typeof range.end_line === 'number' && range.end_line >= start) {
          end = Math.min(totalLines, range.end_line);
        }
      }

      const selectedLines = [];
      for (let i = start; i <= end; i++) {
        selectedLines.push({
          lineNum: i,
          text: allLines[i - 1]
        });
      }

      return {
        path: relPath.replace(/\\/g, '/'),
        exists: true,
        totalLines,
        startLine: start,
        endLine: end,
        lines: selectedLines,
        error: null
      };
    } catch (err) {
      return {
        path: relPath.replace(/\\/g, '/'),
        exists: false,
        totalLines: 0,
        startLine: 0,
        endLine: 0,
        lines: [],
        error: err.message
      };
    }
  }

  
  async prepareFileChunks(filePaths = [], ranges = {}, maxLinesPerBatch = MAX_LINES_PER_BATCH, onProgress = null) {
    const fileDetailsList = [];
    for (const filePath of filePaths) {
      const range = ranges[filePath] || null;
      if (typeof onProgress === 'function') {
        onProgress(filePath, range);
      }
      const details = await this.readFileDetails(filePath, range);
      fileDetailsList.push(details);
    }

    let totalRequestedLines = 0;
    for (const f of fileDetailsList) {
      totalRequestedLines += f.error ? 1 : f.lines.length;
    }

    const rawChunks = [];
    let currentChunkSegments = [];
    let currentChunkLineCount = 0;

    for (const fileDetail of fileDetailsList) {
      if (fileDetail.error) {
        if (currentChunkLineCount >= maxLinesPerBatch && currentChunkSegments.length > 0) {
          rawChunks.push(currentChunkSegments);
          currentChunkSegments = [];
          currentChunkLineCount = 0;
        }
        currentChunkSegments.push({
          path: fileDetail.path,
          error: fileDetail.error,
          totalFileLines: 0,
          startLine: 0,
          endLine: 0,
          isComplete: false,
          isStartOfFile: false,
          isEndOfFile: false,
          lines: []
        });
        currentChunkLineCount += 1;
        continue;
      }

      let lineOffset = 0;
      const fileLines = fileDetail.lines;

      while (lineOffset < fileLines.length) {
        const capacity = maxLinesPerBatch - currentChunkLineCount;
        if (capacity <= 0) {
          rawChunks.push(currentChunkSegments);
          currentChunkSegments = [];
          currentChunkLineCount = 0;
          continue;
        }

        const countToTake = Math.min(fileLines.length - lineOffset, capacity);
        const segmentLines = fileLines.slice(lineOffset, lineOffset + countToTake);
        const startLine = segmentLines[0].lineNum;
        const endLine = segmentLines[segmentLines.length - 1].lineNum;
        const isStartOfFile = (startLine === fileDetail.startLine);
        const isEndOfFile = (endLine === fileDetail.endLine);
        const isComplete = (isStartOfFile && isEndOfFile && segmentLines.length === fileDetail.totalLines);

        currentChunkSegments.push({
          path: fileDetail.path,
          error: null,
          totalFileLines: fileDetail.totalLines,
          startLine,
          endLine,
          isStartOfFile,
          isEndOfFile,
          isComplete,
          lines: segmentLines
        });

        lineOffset += countToTake;
        currentChunkLineCount += countToTake;

        if (currentChunkLineCount >= maxLinesPerBatch && lineOffset < fileLines.length) {
          rawChunks.push(currentChunkSegments);
          currentChunkSegments = [];
          currentChunkLineCount = 0;
        }
      }
    }

    if (currentChunkSegments.length > 0) {
      rawChunks.push(currentChunkSegments);
    }

    if (rawChunks.length === 0) {
      rawChunks.push([]);
    }

    const totalBatches = rawChunks.length;
    const formattedChunks = [];

    for (let i = 0; i < totalBatches; i++) {
      const segments = rawChunks[i];
      let chunkLinesCount = 0;
      for (const seg of segments) {
        chunkLinesCount += seg.error ? 1 : seg.lines.length;
      }

      
      const pendingList = [];
      for (let j = i + 1; j < totalBatches; j++) {
        for (const futureSeg of rawChunks[j]) {
          if (futureSeg.error) continue;
          const existing = pendingList.find(p => p.path === futureSeg.path);
          if (existing) {
            existing.endLine = Math.max(existing.endLine, futureSeg.endLine);
            existing.count += futureSeg.lines.length;
          } else {
            pendingList.push({
              path: futureSeg.path,
              startLine: futureSeg.startLine,
              endLine: futureSeg.endLine,
              count: futureSeg.lines.length
            });
          }
        }
      }

      const formattedMessage = this.formatFileChunkMessage({
        segments,
        chunkLinesCount,
        batchIndex: i + 1,
        totalBatches,
        totalRequestedLines,
        pendingList
      });

      formattedChunks.push({
        batchIndex: i + 1,
        totalBatches,
        chunkLinesCount,
        totalRequestedLines,
        hasMore: (i + 1) < totalBatches,
        pendingCount: pendingList.reduce((acc, p) => acc + p.count, 0),
        formattedMessage
      });
    }

    return formattedChunks;
  }

  
  formatFileChunkMessage({ segments, chunkLinesCount, batchIndex, totalBatches, totalRequestedLines, pendingList }) {
    const isMultiPart = totalBatches > 1;
    const isFinal = batchIndex === totalBatches;

    let msg = '';
    if (isMultiPart) {
      if (!isFinal) {
        msg += `=== TOOL RESULT: MULTI-PART FILE DELIVERY (BATCH ${batchIndex} OF ${totalBatches}) ===\n`;
        msg += `⚠️ NOTICE: The requested files exceed the single-request limit (${MAX_LINES_PER_BATCH} lines). Delivering in chunks.\n`;
        msg += `📊 Batch ${batchIndex} lines: ${chunkLinesCount} lines | Total code requested: ${totalRequestedLines} lines.\n`;
      } else {
        msg += `=== TOOL RESULT: MULTI-PART FILE DELIVERY (FINAL BATCH ${totalBatches} OF ${totalBatches}) ===\n`;
        msg += `✅ FINAL BATCH: All ${totalRequestedLines} lines across all requested files are now delivered.\n`;
      }
    } else {
      msg += `=== TOOL RESULT: FILE INSPECTION (${chunkLinesCount} lines) ===\n`;
    }
    msg += `================================================================================\n\n`;

    for (const seg of segments) {
      if (seg.error) {
        msg += `📄 FILE: ${seg.path}\n`;
        msg += `❌ ERROR: ${seg.error}\n\n`;
        continue;
      }

      let statusTag = '';
      if (seg.isComplete) {
        statusTag = `[COMPLETE - Lines 1 to ${seg.totalFileLines} of ${seg.totalFileLines}]`;
      } else {
        const startTag = seg.isStartOfFile ? 'Start of file' : `Continuation from line ${seg.startLine}`;
        const endTag = seg.isEndOfFile ? 'End of file' : `CONTINUED IN NEXT BATCH at line ${seg.endLine + 1}`;
        statusTag = `[PARTIAL - Lines ${seg.startLine} to ${seg.endLine} of ${seg.totalFileLines} | ${startTag} -> ${endTag}]`;
      }

      msg += `📄 FILE: ${seg.path} ${statusTag}\n`;
      msg += `--------------------------------------------------------------------------------\n`;
      for (const line of seg.lines) {
        msg += `${line.lineNum} | ${line.text}\n`;
      }
      msg += `--------------------------------------------------------------------------------\n\n`;
    }

    msg += `================================================================================\n`;
    if (isMultiPart && !isFinal) {
      msg += `⏳ REMAINING CONTENT TO BE DELIVERED IN NEXT BATCHES:\n`;
      for (const pend of pendingList) {
        msg += `  • ${pend.path}: Lines ${pend.startLine} to ${pend.endLine} (${pend.count} lines pending)\n`;
      }
      msg += `\n🛑 CRITICAL INSTRUCTION:\n`;
      msg += `1. File inspection is currently INCOMPLETE. Do NOT write patches, create files, or conclude yet.\n`;
      msg += `2. You must wait until all ${totalBatches} batches are delivered before taking any action.\n`;
      msg += `3. Acknowledge this batch and receive the next chunk by replying ONLY with:\n`;
      msg += `\`\`\`json\n`;
      msg += `{\n`;
      msg += `  "thought": "Received batch ${batchIndex}/${totalBatches}. Awaiting batch ${batchIndex + 1}.",\n`;
      msg += `  "action": "continue_reading"\n`;
      msg += `}\n`;
      msg += `\`\`\`\n`;
    } else if (isMultiPart && isFinal) {
      msg += `🎉 ALL REQUESTED FILES FULLY DELIVERED (${totalBatches}/${totalBatches} batches complete).\n`;
      msg += `You now have the full contents of all files in context. You may now inspect, analyze, and proceed with your next action:\n`;
      msg += `("patch_file", "create_file", "execute_command", "read_files", or "finish")\n`;
    } else {
      msg += `✅ All requested files loaded successfully (${totalRequestedLines} lines total).\n`;
      msg += `Please analyze the code and proceed with your next action.\n`;
    }
    msg += `================================================================================`;

    return msg;
  }

  
  async patchFile(filePath, searchCode, replaceCode) {
    try {
      const fullPath = path.resolve(this.workspaceDir, filePath);
      let content = await fs.readFile(fullPath, 'utf-8');
      const isCRLF = content.includes('\r\n');
      const normalizedContent = content.replace(/\r\n/g, '\n');

      let cleanSearch = searchCode.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
      let cleanReplace = replaceCode.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');

      
      const normalizeSpaces = (s) => s.replace(/\u00A0/g, ' ').replace(/[ \t]+/g, ' ').trim();

      
      if (normalizedContent.includes(cleanSearch)) {
        const updated = normalizedContent.replace(cleanSearch, cleanReplace);
        await fs.writeFile(fullPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf-8');
        return { success: true, message: `Successfully updated ${filePath}` };
      }

      
      const stripNumbers = (code) => code.split('\n').map((l) => l.replace(/^\s*\d+[\s:|]+\s?/, '')).join('\n');
      const noNumSearch = stripNumbers(cleanSearch);
      const noNumReplace = stripNumbers(cleanReplace);
      if (normalizedContent.includes(noNumSearch)) {
        const updated = normalizedContent.replace(noNumSearch, noNumReplace);
        await fs.writeFile(fullPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf-8');
        return { success: true, message: `Successfully updated ${filePath}` };
      }

      
      const searchLines = cleanSearch.split('\n');
      const contentLines = normalizedContent.split('\n');

      let matchIndex = -1;
      for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
        let match = true;
        for (let j = 0; j < searchLines.length; j++) {
          const cLine = normalizeSpaces(contentLines[i + j]);
          const sLine = normalizeSpaces(searchLines[j]);

          
          if (cLine !== sLine && cLine.replace(/\\\\/g, '\\') !== sLine.replace(/\\\\/g, '\\')) {
            match = false;
            break;
          }
        }
        if (match) {
          matchIndex = i;
          break;
        }
      }

      if (matchIndex !== -1) {
        
        const fileBaseIndent = contentLines[matchIndex].match(/^\s*/)[0];
        const searchBaseIndent = searchLines[0].match(/^\s*/)[0];

        const adjustedReplaceLines = cleanReplace.split('\n').map((line) => {
          if (!line.trim()) return '';
          if (line.startsWith(searchBaseIndent)) {
            return fileBaseIndent + line.slice(searchBaseIndent.length);
          }
          return fileBaseIndent + line.replace(/^\s*/, '');
        });

        contentLines.splice(matchIndex, searchLines.length, ...adjustedReplaceLines);
        const updated = contentLines.join('\n');
        await fs.writeFile(fullPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf-8');
        return { success: true, message: `Successfully updated ${filePath}` };
      }

      
      if (searchLines.length === 1 && searchLines[0].includes('=')) {
        const varPrefix = searchLines[0].split('=')[0].trim();
        const foundIdx = contentLines.findIndex(l => normalizeSpaces(l).startsWith(varPrefix + ' =') || normalizeSpaces(l).startsWith(varPrefix + '='));
        if (foundIdx !== -1) {
          const fileBaseIndent = contentLines[foundIdx].match(/^\s*/)[0];
          contentLines[foundIdx] = fileBaseIndent + cleanReplace.trim();
          const updated = contentLines.join('\n');
          await fs.writeFile(fullPath, isCRLF ? updated.replace(/\n/g, '\r\n') : updated, 'utf-8');
          return { success: true, message: `Successfully updated ${filePath} (matched by variable anchor)` };
        }
      }

      return {
        success: false,
        error: `Search block was not found in ${filePath}. Check indentation, backslashes, or surrounding code.`
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }


  async patchBatch(patches = []) {
    const results = [];
    const seen = new Set();
    const uniquePatches = [];
    for (const p of patches) {
      const k = p.file + '||' + p.search + '||' + p.replace;
      if (seen.has(k)) continue;
      seen.add(k);
      uniquePatches.push(p);
    }

    const fileGroups = {};
    for (const p of uniquePatches) {
      if (!fileGroups[p.file]) fileGroups[p.file] = [];
      fileGroups[p.file].push(p);
    }

    const appliedAnchors = new Map();

    for (const [file, patchList] of Object.entries(fileGroups)) {
      for (const p of patchList) {
        const anchors = appliedAnchors.get(file);
        if (anchors && anchors.has(p.search) && (p.replace || '').includes(p.search)) {
          try {
            const fullPath = path.resolve(this.workspaceDir, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            if (content.includes(p.search)) {
              results.push({ file, success: true, message: 'Skipped duplicate patch (anchor still present)' });
              this.log('skipped duplicate ' + file, 'out');
              continue;
            }
          } catch (e) {  }
        }

        const res = await this.patchFile(file, p.search, p.replace);
        results.push({ file, success: res.success, message: res.message || res.error });
        this.log(res.success ? 'patched ' + file : 'patch failed ' + file + ': ' + (res.message || res.error), res.success ? 'out' : 'err');

        if (res.success && (p.replace || '').includes(p.search)) {
          if (!appliedAnchors.has(file)) appliedAnchors.set(file, new Set());
          appliedAnchors.get(file).add(p.search);
        }
      }
    }

    const allSuccess = results.every(r => r.success);
    return {
      success: allSuccess,
      total: results.length,
      successful: results.filter(r => r.success).length,
      details: results
    };
  }
  async createFile(filePath, content) {
    try {
      const fullPath = path.resolve(this.workspaceDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      this.log(`+ created ${filePath}`, 'out');
      return { success: true, message: `Created new file ${filePath}` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async executeCommand(command) {
    return new Promise((resolve) => {
      exec(command, { cwd: this.workspaceDir, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        let output = stdout || '';
        if (stderr) output += `\n[STDERR]:\n${stderr}`;
        if (error) output += `\n[ERROR]:\n${error.message}`;

        if (output.length > 5000) {
          output = output.slice(0, 5000) + '\n...[Output truncated]';
        }
          this.log(`$ ${command}`, 'cmd');
          if (stdout) this.log(stdout.trim(), 'out');
          if (stderr) this.log(stderr.trim(), 'err');
          if (error) this.log(`[exit error] ${error.message}`, 'err');
          resolve({
          success: !error,
          output: output.trim() || 'Command executed with no console output.'
        });
      });
    });
  }

  
  async listDirectory(targetPath, depth = 3, maxPerDir = 50) {
    const base = path.resolve(targetPath || this.workspaceDir);
    const safeDepth = Math.min(Math.max(Number(depth) || 3, 1), 4);
    const build = async (dir, d) => {
      if (d > safeDepth) return '';
      let res = '';
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const showing = entries.slice(0, maxPerDir);
        for (const e of showing) {
          const indent = '  '.repeat(d);
          if (e.isDirectory()) {
            res += `${indent}📁 ${e.name}/
`;
            res += await build(path.join(dir, e.name), d + 1);
          } else {
            res += `${indent}📄 ${e.name}
`;
          }
        }
        if (entries.length > showing.length) {
          res += `${'  '.repeat(d)}↳ ... (${entries.length - showing.length} more items omitted)
`;
        }
      } catch (e) {
        res += `[ERROR: ${e.message}]
`;
      }
      return res;
    };
    const tree = await build(base, 0);
    return { path: base, tree: tree || 'Directory is empty.' };
  }
  
  async searchCode(query, maxResults = 25, rootDir = null) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Query parameter is required' };
    }

    const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf', '.zip', '.tar', '.gz', '.lock', '.map', '.exe', '.dll', '.bin'];

    const matches = [];
    const searchRoot = rootDir ? path.resolve(rootDir) : this.workspaceDir;
    const searchDir = async (dir) => {
      if (matches.length >= maxResults) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= maxResults) break;

          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(this.workspaceDir, fullPath).replace(/\\/g, '/');
          
          if (this.isExcluded(relPath) || this.isExcluded(entry.name)) continue;

          if (entry.isDirectory()) {
            await searchDir(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (BINARY_EXTS.includes(ext)) continue;

            try {
              const stat = await fs.stat(fullPath);
              if (stat.size > 1024 * 1024) continue; 

              const content = await fs.readFile(fullPath, 'utf-8');
              if (content.includes(query)) {
                const lines = content.replace(/\r\n/g, '\n').split('\n');
                const relPath = path.relative(this.workspaceDir, fullPath).replace(/\\/g, '/');

                for (let i = 0; i < lines.length; i++) {
                  if (lines[i].includes(query)) {
                    matches.push({
                      file: relPath,
                      line: i + 1,
                      snippet: lines[i].trim().slice(0, 160)
                    });
                    if (matches.length >= maxResults) break;
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}
    };

    await searchDir(searchRoot);

    return {
      query,
      root: searchRoot,
      totalMatches: matches.length,
      hasMore: matches.length >= maxResults,
      matches
    };
  }

  
  async getProjectTree(depth = 4, maxPerDir = 20) {
    const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp4', '.mp3', '.pdf', '.zip', '.tar', '.map', '.lock'];

    const build = async (currentDir, currentDepth) => {
      if (currentDepth > depth) return '';
      let res = '';
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        const filtered = entries.filter(e => {
          const rel = path.relative(this.workspaceDir, path.join(currentDir, e.name)).replace(/\\/g, '/');
          if (this.isExcluded(rel) || this.isExcluded(e.name)) return false;

          if (!e.isDirectory() && BINARY_EXTS.includes(path.extname(e.name).toLowerCase())) return false;
          return true;
        });

        const showing = filtered.slice(0, maxPerDir);
        const omittedCount = filtered.length - showing.length;

        for (const entry of showing) {
          const fullPath = path.join(currentDir, entry.name);
          const indent = '  '.repeat(currentDepth);

          if (entry.isDirectory()) {
            res += `${indent}📁 ${entry.name}/\n`;
            res += await build(fullPath, currentDepth + 1);
          } else {
            res += `${indent}📄 ${entry.name}\n`;
          }
        }

        if (omittedCount > 0) {
          const indent = '  '.repeat(currentDepth);
          res += `${indent}↳ ... (${omittedCount} more files omitted)\n`;
        }
      } catch (e) {}
      return res;
    };

    return (await build(this.workspaceDir, 0)) || 'Directory is empty.';
  }
}

module.exports = ProjectTools;

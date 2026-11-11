'use strict';

const SYSTEM_PROMPT = `# MAGNUM — FAST AUTONOMOUS SOFTWARE ENGINEER

You are MAGNUM, an execution-oriented, ultra-fast autonomous software engineer.
You interact directly with the local codebase and Windows system using structured JSON commands.

You MUST reply with a SINGLE markdown code block containing your JSON decision:
\`\`\`json
{
  "thought": "Short reasoning (max 2 sentences)",
  "action": "ACTION_NAME",
  "params": { ... }
}
\`\`\`

## ⚡ CRITICAL RULES (SPEED & USER-DIRECTED TASKS)
1. USER-DIRECTED SOLUTION (ABSOLUTE HIGHEST PRIORITY):
   - If the user explicitly tells you what to change, names the file, or asks to remove/delete a section:
     DO NOT over-analyze. DO NOT search unrelated files. DO NOT debate architecture. DO NOT plan.
   - Immediately inspect that specific file with "read_files", verify the target line, and apply the exact patch with "patch_file" in the very next turn!
   - Target task completion: 2 TO 3 TURNS MAXIMUM.
2. PERMISSION TO DELETE & EDIT:
   - When asked to delete, remove, or clean up code, DO IT IMMEDIATELY without hesitation. You have full authority to modify or remove code as requested.
3. PREFER DIRECT READING:
   - If the file is obvious from the user request or project tree, NEVER search. Read it directly.
4. NO DUPLICATE READS:
   - Once file content is delivered, do NOT re-read the exact same lines.
5. FAST THINKING:
   - Keep "thought" strictly under 2 sentences. English only.
6. USE PROVIDED PROJECT TREE:
   - The full file tree of the user's workspace is ALREADY provided below under "PROJECT FILE TREE".
   - DO NOT call "list_dir" on "." or root unless the user explicitly asks to scan an external directory outside the workspace!

## AVAILABLE ACTIONS:

1. READ FILES (up to 5,000 lines at once):
   {"thought": "Inspecting target file", "action": "read_files", "params": {"files": ["src/App.tsx"]}}

2. PATCH FILE (Single or Multi-patch in 1 turn):
   {"thought": "Applying edits", "action": "patch_file", "params": {"patches": [{"file": "a.js", "search": "old", "replace": "new"}]}}

3. SEARCH CODE (Fast Grep - use ONLY if file name is unknown):
   {"thought": "Finding symbol", "action": "search_code", "params": {"query": "function authenticate"}}

4. EXECUTE COMMAND (Shell commands, builds, tests, AND web downloads):
   - Runs ANY cmd/PowerShell command with a 5-minute timeout.
   - You can download web assets (models, zips, textures) using curl or powershell:
   {"thought": "Downloading asset", "action": "execute_command", "params": {"command": "powershell -Command \"Invoke-WebRequest -Uri 'https://site.com/file.zip' -OutFile 'assets/file.zip'\""}}

5. LIST ANY DIRECTORY (inside OR outside workspace):
   - Accepts ANY absolute Windows path to inspect files before reading:
   {"thought": "Checking directory", "action": "list_dir", "params": {"path": "D:\\OtherProject", "depth": 2}}

6. CREATE FILE:
   {"thought": "Creating file", "action": "create_file", "params": {"file": "test/agent.test.js", "content": "..."}}

7. READ FILE RANGE (for files > 5,000 lines):
   {"thought": "Reading remaining lines", "action": "read_file", "params": {"file": "huge.js", "start_line": 5001, "end_line": 10000}}

8. CONTINUE READING (multi-part chunks):
   {"thought": "Awaiting next batch", "action": "continue_reading"}

9. FINISH:
   {"thought": "Completed", "action": "finish", "params": {"summary": "**خلاصه:** بخش مورد نظر با موفقیت حذف شد."}}
10. BROWSE WEB (MagNum Embedded Browser — a REAL Chromium page rendered live inside the user's MagNum UI panel):
- {"thought": "Opening docs", "action": "browse_web", "params": {"query": "react useeffect documentation"}}  // Google search inside the embedded browser
- {"thought": "Opening site", "action": "browse_web", "params": {"url": "https://example.com"}}              // direct navigation
- ⚠️ DISTINCT FROM DEEPSEEK'S OWN BUILT-IN WEB SEARCH. Use ONLY when the user asks to open/inspect/analyze a webpage or search results inside MagNum's Browser tab, or when you need live content of a specific page.
11. READ PAGE (read the CURRENT page of the embedded browser as numbered lines — works on whatever the USER is viewing right now):
- {"thought": "Reading results", "action": "read_page", "params": {"start_line": 1, "end_line": 150}}
- Omit params to get the first 150 lines. Request further ranges to read ANY part of the page. Then analyze and answer in the user's language.
   (Write finish summary in user's language with code tokens in backticks).
`;

function unescapeJsonString(str) {
  if (!str) return '';
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}




function fixRawNewlinesInJsonStrings(json) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) {
        
        if (!'ntrfbu"\\/'.includes(ch)) {
          out += '\\' + ch;
        } else {
          out += ch;
        }
        escaped = false;
        continue;
      }
      if (ch === '\\') { escaped = true; out += ch; continue; }
      if (ch === '"') { inString = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') inString = true;
    out += ch;
  }
  return out;
}


function extractCleanThoughtForUI(text) {
  if (!text || typeof text !== 'string') return '';
  
  
  const clean = text.replace(/^(?:json|Copy|Download)\s*/gim, '').trim();

  
  const thoughtMatch = clean.match(/"thought"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (thoughtMatch) {
    return unescapeJsonString(thoughtMatch[1]);
  }

  
  const beforeJson = clean.split('```')[0].trim();
  if (beforeJson && !beforeJson.startsWith('{')) {
    return beforeJson;
  }

  return 'Planning codebase actions...';
}


function unescapePartial(s) {
  try {
    return JSON.parse('"' + s + '"');
  } catch {
    return String(s)
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      .replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
}

function extractSafeLiveStream(text) {
  if (!text || typeof text !== 'string') return { thought: '', prose: '' };

  const clean = text.replace(/^(?:json|Copy|Download|CopyDownload|CopyCode)\s*/gim, '').trim();

  
  const thoughtMatch = clean.match(/"thought"\s*:\s*"((?:\\.|[^"\\])*)/);
  let liveThought = '';
  if (thoughtMatch) {
    liveThought = unescapePartial(thoughtMatch[1]);
  }

  
  const hasJsonBlock = clean.includes('```json') || clean.includes('```') || clean.startsWith('{') || clean.includes('"action"');

  let prose = '';
  
  
  if (!hasJsonBlock) {
    prose = clean;
  } else {
    
    const beforeBlock = clean.split('```')[0].trim();
    if (beforeBlock && !beforeBlock.startsWith('{') && !beforeBlock.includes('"action"')) {
      prose = beforeBlock;
    }
  }

  return {
    thought: liveThought,
    prose
  };
}

const MODE_PROMPTS = {
  plan: `
=== ACTIVE MODE: PLAN (read-only planning, like Cursor Plan mode) ===
1. You MUST NOT use "patch_file", "create_file", or "execute_command" in this mode.
2. Only investigate with "read_files" and "search_code".
3. Then use "finish" with a structured implementation plan in "summary":
   - Goal
   - Numbered step-by-step actions
   - Exact files to modify/create
   - Risks & edge cases
   - Verification steps (commands/tests to run later)`,
  debug: `
=== ACTIVE MODE: DEBUG (systematic root-cause debugging, like Cursor Debug mode) ===
Follow this STRICT loop:
1. REPRODUCE: run the failing command/test with "execute_command" to see the real error.
2. EVIDENCE: "search_code" the error string / involved symbols, then "read_files" on suspects. Never guess.
3. HYPOTHESIZE: state ONE concrete root-cause hypothesis in "thought".
4. VERIFY: confirm it with evidence (code paths, temporary logs, tests).
5. FIX: apply the MINIMAL targeted "patch_file" that fixes the root cause, not symptoms.
6. CONFIRM: re-run the failing command/test with "execute_command" to prove the fix, then "finish" with root cause + fix summary.`,
  ask: `
=== ACTIVE MODE: ASK (read-only Q&A, like Cursor Ask mode) ===
1. You MUST NOT modify anything: no "patch_file", no "create_file".
2. Investigate with "read_files" / "search_code" only.
3. Answer clearly with references to exact files and line numbers.
4. Use "finish" with the full answer in "summary".`,
  multitask: `
=== ACTIVE MODE: MULTITASK (structured multi-subtask execution) ===
1. First turn: decompose the request into numbered independent subtasks in "thought".
2. Execute subtasks one by one; keep each subtask's patches in its own batch.
3. State progress briefly in "thought" after each subtask.
4. At the end run a final verification with "execute_command" and "finish" with a per-subtask status report.`
};

const AGENT_STRINGS = {
  en: {
    readFiles: 'Read files:',
    fullFile: 'full file',
    linesRange: (a, b) => `lines ${a}–${b}`,
    lineLabel: (n) => `line ${n}`,
    searchLabel: 'Searched for:',
    results: (n) => `(${n} result${n === 1 ? '' : 's'})`,
    noMatch: 'No matches found.',
    patchesLabel: (a, b) => `Applied patches (${a}/${b}):`,
    patchOk: 'patch applied successfully.',
    patchErr: (m) => `error - ${m}`,
    rejected: (f) => `Changes to \`${f}\` were rejected by the user.`,
    rateLimitGemini: '**Gemini rate limit reached (daily quota).** AI Studio replied: "You\'ve reached your rate limit." This Google account\'s quota for today is exhausted.\n• Wait until the quota resets (usually next day), or\n• Switch to DeepSeek from the model pill and re-send this prompt.\nThe task was stopped safely; nothing was lost.\n• MagNum now blocks new Gemini requests during an automatic cooldown window to protect the account.'
  },
  fa: {
    readFiles: 'بررسی فایل‌ها:',
    fullFile: 'کل فایل',
    linesRange: (a, b) => `خطوط ${a} تا ${b}`,
    lineLabel: (n) => `خط ${n}`,
    searchLabel: 'جستجو برای:',
    results: (n) => `(${n} نتیجه)`,
    noMatch: 'موردی یافت نشد.',
    patchesLabel: (a, b) => `اعمال پچ‌ها (${a}/${b}):`,
    patchOk: 'پچ با موفقیت اعمال شد.',
    patchErr: (m) => `خطا - ${m}`,
    rejected: (f) => `تغییرات فایل \`${f}\` توسط کاربر لغو شد.`,
    rateLimitGemini: '**به سقف مصرف روزانهٔ جمنای رسیدیم.** پاسخ AI Studio: «You\'ve reached your rate limit». سهمیهٔ امروز این حساب گوگل تمام شده است.\n• تا شارژ مجدد سهمیه (معمولاً روز بعد) صبر کنید، یا\n• از پیل مدل به دیپ‌سیک سوییچ کنید و همین پرامپت را دوباره بفرستید.\nتسک به‌صورت امن متوقف شد؛ هیچ تغییری از دست نرفته است.\n• مگنوم تا پایان پنجرهٔ خنک‌سازی به‌صورت خودکار هیچ درخواست جدیدی به جمنای نمی‌فرستد.'
  }
};


const RATE_LIMIT_TEXT_RE = /reached your rate limit|please try again later|reached your quota|quota for the day|wait for it to reset|upgrade to go further|too many requests|resource.{0,12}exhausted|\b429\b/i;
function looksLikeRateLimit(text) {
  return typeof text === 'string' && RATE_LIMIT_TEXT_RE.test(text);
}

class CodingAgent {
  constructor(driver, tools, onEvent = null, browser = null) {
    this.driver = driver;
    this.tools = tools;
    this.onEvent = onEvent;
    this.browser = browser;
    this.isStopped = false;
    this.pendingChunks = [];
    this.patchResolver = null; 
    this.commandResolver = null;
    this._systemPromptSent = false;
  }

  
  resolvePendingPatch(approved = true) {
    if (typeof this.patchResolver === 'function') {
      this.patchResolver(approved);
      this.patchResolver = null;
    }
  }

  resolvePendingCommand(approved = true) {
    if (typeof this.commandResolver === 'function') {
      this.commandResolver(approved);
      this.commandResolver = null;
    }
  }

  stop() {
    this.isStopped = true;
    this.pendingChunks = [];
    if (this.patchResolver) {
      this.patchResolver(false);
      this.patchResolver = null;
    }
    if (this.commandResolver) {
      this.commandResolver(false);
      this.commandResolver = null;
    }
    if (this.driver) {
      this.driver.abort();
    }
  }

  emit(event, data) {
    if (typeof this.onEvent === 'function') {
      try {
        this.onEvent(event, data);
      } catch (e) {
        console.error('Error emitting event:', e);
      }
    }
  }

  async randomDelay(minMs = 3000, maxMs = 7000, label = 'Anti-Bot Delay') {
    if (this.isStopped) return;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const sec = (delay / 1000).toFixed(1);
    console.log(`⏳ [${label}] Waiting ${sec}s to pace requests naturally...`);
    this.emit('agent_status', { text: `Natural pause (${sec}s) to protect account...` });

    const startTime = Date.now();
    while (Date.now() - startTime < delay) {
      if (this.isStopped) break;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  calculateReadingPacing() {
    return Math.floor(Math.random() * 600) + 1000; 
  }

  parseResponse(text) {
    if (!text || typeof text !== 'string') return null;

    
    const cleanText = text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/^(?:json|Copy|Download)\s*/gim, '')
      .trim();

    let jsonString = '';
    const allBlocks = [...cleanText.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
    const blockMatch = allBlocks.length ? allBlocks[allBlocks.length - 1] : null;
    if (blockMatch) {
      jsonString = blockMatch[1].trim();
    } else if (cleanText.trim().startsWith('{')) {
      
      const trimmed = cleanText.trim();
      let depth = 0, inStr = false, esc = false, end = -1;
      for (let i = 0; i < trimmed.length; i++) {
        const c = trimmed[i];
        if (inStr) {
          if (esc) { esc = false; }
          else if (c === '\\') { esc = true; }
          else if (c === '"') { inStr = false; }
        } else {
          if (c === '"') { inStr = true; }
          else if (c === '{') { depth++; }
          else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
      }
      if (end !== -1) jsonString = trimmed.substring(0, end + 1).trim();
    } else {
      const firstBrace = cleanText.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let inStr = false;
        let esc = false;
        let end = -1;
        for (let i = firstBrace; i < cleanText.length; i++) {
          const c = cleanText[i];
          if (inStr) {
            if (esc) { esc = false; }
            else if (c === '\\') { esc = true; }
            else if (c === '"') { inStr = false; }
          } else {
            if (c === '"') { inStr = true; }
            else if (c === '{') { depth++; }
            else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
        }
        if (end !== -1) {
          jsonString = cleanText.substring(firstBrace, end + 1).trim();
        }
      }
    }

    if (!jsonString) {
      return this.fallbackExtractAction(cleanText);
    }

    try {
      return JSON.parse(jsonString);
    } catch (firstErr) {
      try {
        
        let repaired = fixRawNewlinesInJsonStrings(jsonString).replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch (secondErr) {
        return this.fallbackExtractAction(cleanText);
      }
    }
  }

  fallbackExtractAction(text) {
    const actionMatch = text.match(/"action"\s*:\s*"([^"]+)"/);
    if (!actionMatch) return null;

    const action = actionMatch[1];
    const thoughtMatch = text.match(/"thought"\s*:\s*"((?:\\.|[^"\\])*)"/);
    const thought = thoughtMatch ? unescapeJsonString(thoughtMatch[1]) : '';

    if (action === 'finish') {
      const summaryMatch = text.match(/"(?:summary|answer|message)"\s*:\s*"((?:\\.|[^"\\])*)"/);
      return {
        thought,
        action: 'finish',
        params: { summary: summaryMatch ? unescapeJsonString(summaryMatch[1]) : text.slice(0, 500) }
      };
    }

    if (action === 'execute_command') {
      
      const cmdMatch = text.match(/"command"\s*:\s*"((?:\\.|[^"\\])*)"/) ||
                       text.match(/"cmd"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const command = cmdMatch ? unescapeJsonString(cmdMatch[1]) : '';
      return { thought, action: 'execute_command', params: { command } };
    }

    if (action === 'read_files' || action === 'read_file') {
      const filesMatch = text.match(/"files"\s*:\s*\[([\s\S]*?)\]/);
      let files = [];
      if (filesMatch) {
        files = filesMatch[1].match(/"([^"]+)"/g)?.map(f => f.replace(/"/g, '')) || [];
      }
      const singleFile = text.match(/"file"\s*:\s*"([^"]+)"/);
      if (singleFile) files.push(singleFile[1]);
      return { thought, action: 'read_files', params: { files } };
    }

    if (action === 'patch_file') {
      const grab = (re) => Array.from(text.matchAll(re)).map(m => m[1]);
      const files = grab(/"file"\s*:\s*"((?:\\.|[^"\\])*)"/g);
      const searches = grab(/"search"\s*:\s*"((?:\\.|[^"\\])*)"/g);
      const replaces = grab(/"replace"\s*:\s*"((?:\\.|[^"\\])*)"/g);
      const patches = [];
      for (let i = 0; i < files.length && i < searches.length; i++) {
        patches.push({
          file: unescapeJsonString(files[i]),
          search: unescapeJsonString(searches[i]),
          replace: i < replaces.length ? unescapeJsonString(replaces[i]) : ''
        });
      }
      const seenPatch = new Set();
      const uniquePatches = patches.filter(p => { const k = p.file + '||' + p.search + '||' + p.replace; if (seenPatch.has(k)) return false; seenPatch.add(k); return true; });
      if (uniquePatches.length > 0) return { thought, action: 'patch_file', params: { patches: uniquePatches } };
      return null; 
    }

    return { thought, action, params: {} };
  }

  async run(task, options = {}) {
    this.isStopped = false;
    this.pendingChunks = [];
    const L = AGENT_STRINGS[options.lang === 'fa' ? 'fa' : 'en'] || AGENT_STRINGS.en;
    const P = options.provider === 'gemini' ? 'Gemini' : 'DeepSeek';
    let lastReadSignature = null;
let lastListSignature = null; // اضافه شد
    let consecutiveFormatRetries = 0;

    const isFirstMessage = (options.isFirstMessage !== undefined)
      ? Boolean(options.isFirstMessage)
      : !this._systemPromptSent;
    const systemPromptAlreadySent = (options.systemPromptSent !== undefined)
      ? Boolean(options.systemPromptSent)
      : this._systemPromptSent;

    if (typeof options.deepThink === 'boolean' && options.provider !== 'gemini' && this.driver?.setDeepThink) {
      await this.driver.setDeepThink(options.deepThink);
    }
    if (options.provider === 'gemini' && typeof options.thinkingLevel === 'string' && this.driver?.setThinkingLevel) {
      await this.driver.setThinkingLevel(options.thinkingLevel);
    }

    const modeInstructions = options.skill && MODE_PROMPTS[options.skill] ? MODE_PROMPTS[options.skill] : '';

    let initialMessage;
    const sendingFullPrompt = isFirstMessage || !systemPromptAlreadySent;

    if (sendingFullPrompt) {
      
      const projectTree = (typeof options.projectTree === 'string')
        ? options.projectTree
        : await this.tools.getProjectTree();
      console.log(`\n🔍 Scanning workspace tree...`);
      this.emit('agent_status', { text: 'Scanning workspace tree...' });
      if (this.isStopped) return;

      const providerSpecificNote = options.provider === 'gemini'
        ? `
⚠️ OUTPUT FORMAT (CRITICAL — GEMINI/AI STUDIO):
Your ENTIRE response must be a SINGLE \`\`\`json code block. Start immediately with \`\`\`json and end with \`\`\`. No preamble, no prose, no <pre>, no raw text outside the block.`
        : '';
      initialMessage = `${SYSTEM_PROMPT}${providerSpecificNote}
${modeInstructions}

=== PROJECT FILE TREE ===
${projectTree}
========================

USER TASK:
${task}
`;
      console.log(`📤 Sending FULL system prompt + task to ${P}...`);
      this.emit('agent_status', { text: `Sending system prompt & task to ${P}...` });
    } else {
      
      const treeSection = (typeof options.treeUpdate === 'string' && options.treeUpdate)
        ? `\n=== WORKSPACE STRUCTURE UPDATED (files/folders added or removed since your last turn) ===\n${options.treeUpdate}\n========================\n`
        : '';
      if (treeSection) {
        console.log('🌲 Workspace structure changed since last turn — sending updated file tree...');
        this.emit('agent_status', { text: 'Workspace changed — refreshing project tree...' });
      }
      const providerFollowUpNote = options.provider === 'gemini'
        ? `\
⚠️ GEMINI FORMAT: reply with ONE \`\`\`json block only — nothing before or after it.`
        : '';
      initialMessage = `${modeInstructions}NEW USER TASK (continuing in this existing chat session):
${task}
${treeSection}
Remember: Follow the MAGNUM system instructions you already received.
Reply ONLY with a single JSON action block.${providerFollowUpNote}`;
      console.log('📤 Sending FOLLOW-UP task only (system prompt already in context)...');
      this.emit('agent_status', { text: `Sending follow-up task to ${P}...` });
    }

    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 150) + 150));
    if (this.isStopped) return;

    let lastSentMessage = initialMessage;
    await this.driver.sendMessage(initialMessage, options);
    if (sendingFullPrompt) this._systemPromptSent = true;

    
    const liveUrl = await this.driver.getChatUrl();
    if (liveUrl && liveUrl.includes('/chat/')) {
      this.emit('chat_url_captured', { url: liveUrl });
    }

    let maxSteps = 30;
    let taskFinished = false;
    let rateLimitStop = false;
    let noNewStop = false;
    let loopRepeatCount = 0;

    while (maxSteps-- > 0) {
      if (this.isStopped) break;

      this.emit('agent_status', { text: `${P} is thinking...` });

      
      let lastStreamSignature = '';
      let response;
      let rateLimitAttempts = 0;
      const MAX_RATE_LIMIT_RETRIES = 3;

      while (true) {
        if (this.isStopped) break;
        try {
          response = await this.driver.waitForCompletion(
            null, 
            (statusText) => {
              if (this.isStopped) return;
              this.emit('agent_status', { text: statusText });
            },
            (attempt, max) => {
              if (this.isStopped) return;
              this.emit('network_retry', { attempt, max, text: `Network error — retrying (${attempt}/${max})...` });
            }
          );
          break; 
        } catch (waitErr) {
          
          if (waitErr.code === 'CAPTCHA_REQUIRED') {
            if (waitErr.code === 'NO_NEW_RESPONSE' || (waitErr.message && waitErr.message.includes('NO_NEW_RESPONSE'))) {
            console.warn('⚠️ Stale-answer protection: no new model response detected — stopping safely.');
            noNewStop = true;
            break;
          }
          throw waitErr;
          }

          if (waitErr.code === 'GEMINI_RATE_LIMIT' || (waitErr.message && waitErr.message.includes('GEMINI_RATE_LIMIT'))) {
            console.warn('⚠️ Gemini rate limit / quota reached — stopping task with a clear notice.');
            rateLimitStop = true;
            break; 
          }

          if (waitErr.code === 'LENGTH_LIMIT_REACHED' || (waitErr.message && waitErr.message.includes('LENGTH_LIMIT_REACHED'))) {
            if (rateLimitAttempts >= MAX_RATE_LIMIT_RETRIES) {
              throw new Error('DeepSeek rate limit persisted after multiple retries.');
            }
            rateLimitAttempts++;

            
            const cooldownSec = Math.floor(Math.random() * (105 - 65 + 1)) + 65;
            console.log(`⏳ [Rate Limit Pause] DeepSeek throttled. Pausing for ${cooldownSec}s...`);

            const startTime = Date.now();
            while (Date.now() - startTime < cooldownSec * 1000) {
              if (this.isStopped) return;
              const rem = Math.ceil((cooldownSec * 1000 - (Date.now() - startTime)) / 1000);
              this.emit('agent_status', {
                text: `DeepSeek rate limit pause (${rem}s remaining to protect account)...`
              });
              await new Promise(r => setTimeout(r, 1000));
            }

            if (this.isStopped) return;

            
            console.log('🔄 Rate limit cleared. Re-sending the current turn message to DeepSeek...');
            this.emit('agent_status', { text: 'Rate limit cleared. Re-sending payload to DeepSeek...' });
            await this.driver.sendMessage(lastSentMessage);
            continue; 
          }
          throw waitErr;
        }
      }

      this.emit('agent_streaming_end', {});
      if (rateLimitStop) {
        this.emit('gemini_rate_limit', { provider: 'gemini' });
        const msg = L.rateLimitGemini;
        this.emit('agent_status', { text: 'Gemini rate limit reached — waiting for quota reset or provider switch.' });
        this.emit('agent_message', { role: 'agent', text: msg, thought: '', action: 'finish' });
        this.emit('task_finished', { summary: msg });
        taskFinished = true;
        break; 
      }
      if (this.isStopped) break;

      
      
        if (noNewStop) {
          const msg = options.lang === 'fa'
            ? '**پاسخ جدیدی از مدل دریافت نشد.** محافظ ضد پاسخ قدیمی جلوی نمایش جواب اشتباه (متعلق به تسک قبلی) را گرفت؛ هیچ تغییری اعمال نشد. لطفاً پرامپت را دوباره بفرستید.'
            : '**No new model response was detected for this turn.** The stale-answer protection blocked a wrong (previous-turn) answer; no changes were made. Please re-send your prompt.';
          this.emit('agent_status', { text: 'No new response detected — task stopped safely.' });
          this.emit('agent_message', { role: 'agent', text: msg, thought: '', action: 'finish' });
          this.emit('task_finished', { summary: msg });
          taskFinished = true;
          break;
        }

      if (looksLikeRateLimit(response)) {
        console.warn('⚠️ Rate-limit banner detected in model response — stopping without any retry.');
        rateLimitStop = true;
        break;
      }

      const decision = this.parseResponse(response);

      if (this.pendingChunks.length > 0) {
        const nextChunk = this.pendingChunks.shift();
        const fullThought = decision?.thought || 'Receiving next file chunk...';

        this.emit('agent_message', {
          role: 'agent',
          text: `Delivering files: Batch ${nextChunk.batchIndex} of ${nextChunk.totalBatches} (${nextChunk.chunkLinesCount} lines)`,
          thought: fullThought,
          action: 'continue_reading'
        });

        await this.randomDelay(800, 1500, 'Chunk Delivery');
        if (this.isStopped) break;

        this.emit('agent_status', { text: `Sending Batch ${nextChunk.batchIndex}/${nextChunk.totalBatches} to ${P}...` });
        lastSentMessage = nextChunk.formattedMessage;
        await this.driver.sendMessage(nextChunk.formattedMessage);
        continue;
      }

      if (!decision || !decision.action) {
        consecutiveFormatRetries++;
        if (consecutiveFormatRetries > 2) {
          const limitMsg = options.lang === 'fa'
            ? '**پاسخ مدل قابل استفاده نبود (۳ تلاش پشت‌سرهم).** هیچ تغییری اعمال نشد؛ پرامپت را دوباره بفرستید یا مدل را عوض کنید.'
            : '**Model response was unusable (3 consecutive attempts).** No changes were made. Re-send your prompt or switch model.';
          this.emit('agent_message', { role: 'agent', text: limitMsg, thought: '', action: 'finish' });
          this.emit('task_finished', { summary: limitMsg });
          taskFinished = true;
          break;
        }
        console.log('⚠️ Response is not JSON action. Model output was:\n', response.slice(-300));
        await this.randomDelay(2000, 3500, 'Format Retry');
        if (this.isStopped) break;

        const formatRetryMsg = 'Please proceed with your next codebase action inside a ```json ``` block (e.g. "read_files", "search_code", "patch_file", or "finish").';
        lastSentMessage = formatRetryMsg;
        await this.driver.sendMessage(formatRetryMsg);
        continue;
      }

      const fullThought = decision.thought || '';
      console.log(`\n💭 Thought: ${fullThought || 'Processing...'}`);
      console.log(`⚡ Action: [${decision.action}]`);

      if (decision.action === 'finish') {
        const summary = decision.params?.summary || decision.params?.answer || decision.params?.message || 'Completed successfully.';
        console.log('\n🎉 Task Finished!');
        
        this.emit('agent_streaming_end', {});
        this.emit('agent_message', {
          role: 'agent',
          text: summary,
          thought: fullThought,
          action: 'finish'
        });
        this.emit('task_finished', { summary });
        taskFinished = true;
        break;
      }

      let toolFeedback = '';

      if (decision.action === 'read_files' || decision.action === 'read_file') {
        let files = [];
        let ranges = {};

        if (decision.action === 'read_file') {
          const singleFile = decision.params?.file;
          if (singleFile) {
            files = [singleFile];
            if (decision.params.start_line || decision.params.end_line) {
              ranges[singleFile] = {
                start_line: decision.params.start_line,
                end_line: decision.params.end_line
              };
            }
          }
        } else {
          files = decision.params?.files || [];
          ranges = decision.params?.ranges || {};
        }

        const currentSignature = files.map(f => {
          const r = ranges[f];
          return `${f}:${r ? `${r.start_line || 1}-${r.end_line || 'end'}` : 'FULL'}`;
        }).sort().join('|');

        if (currentSignature === lastReadSignature) {
          loopRepeatCount++;
          console.log(`🛑 Loop detected (${loopRepeatCount}x): same file & range re-requested.`);
          toolFeedback = loopRepeatCount >= 2
            ? `⚠️ HARD STOP: You requested the EXACT same files/ranges ${loopRepeatCount} times in a row. Their content is ALREADY in your context above. Further identical read_files will be IGNORED.
- If you located the issue: reply with "patch_file" NOW.
- If you need a symbol location: reply with "search_code" NOW.
- If you have enough context: reply with "finish" NOW.`
            : `⚠️ NOTICE: You just received these exact files and line ranges in the immediately preceding turn.
Their full content is already displayed right above in your conversation history.
- Do NOT re-read the exact same lines.
- If you need another part of the file (e.g. lines 5001+), specify "start_line" and "end_line".
- If you found the issue, proceed immediately with "patch_file".
- If you need to locate a specific function, use "search_code".`;
        } else {
          loopRepeatCount = 0;
          lastReadSignature = currentSignature;
           console.log(`📖 Reading ${files.length} file(s):`, files.join(', '));
           const fileRangeDesc = files.map(f => {
             const r = ranges[f];
             return r ? `${f} (lines ${r.start_line || 1}-${r.end_line || 'end'})` : `${f} (full)`;
           }).join(', ');
           this.emit('agent_status', { text: `Reading: ${fileRangeDesc}` });

           const chunks = await this.tools.prepareFileChunks(files, ranges, 2000, (filePath, range) => {
             const rText = range && (range.start_line || range.end_line)
               ? ` (lines ${range.start_line || 1}-${range.end_line || 'end'})`
               : ' (full file)';
             this.emit('agent_status', { text: `Reading file: ${filePath}${rText}` });
           });


             const linesSummary = files.map(f => {
               const r = ranges[f];
               return r && (r.start_line || r.end_line) 
                 ? `• \`${f}\` (${L.linesRange(r.start_line || 1, r.end_line || '∞')})` 
                 : `• \`${f}\` (${L.fullFile})`;
             }).join('\n');

             const chatText = `**${L.readFiles}**\n${linesSummary}`;

            if (chunks.length === 1) {
              this.emit('agent_message', {
                role: 'agent',
                text: chatText,
                thought: fullThought,
                action: decision.action,
                files
              });
             toolFeedback = chunks[0].formattedMessage;
           } else {
             const firstChunk = chunks[0];
             this.pendingChunks = chunks.slice(1);

             this.emit('agent_message', {
               role: 'agent',
               text: fullThought || `Reading ${files.length} file(s): ${fileRangeDesc} (Batch 1 of ${chunks.length})`,
               thought: fullThought,
               action: 'read_files',
               files
             });
             toolFeedback = firstChunk.formattedMessage;
           }
         }
      }
      else if (decision.action === 'search_code') {
        const query = decision.params?.query || '';
        console.log(`🔍 Searching code for: "${query}"`);
        const searchResult = await this.tools.searchCode(query, 25, decision.params?.root || null);

            let searchMatchesText = searchResult.matches && searchResult.matches.length > 0
              ? searchResult.matches.slice(0, 5).map(m => `• \`${m.file}\` (${L.lineLabel(m.line)}): \`${m.snippet}\``).join('\n')
              : `• *${L.noMatch}*`;

            this.emit('agent_message', {
              role: 'agent',
              text: `**${L.searchLabel}** \`${query}\` ${L.results(searchResult.totalMatches)}\n${searchMatchesText}`,
              thought: fullThought,
              action: 'search_code'
            });

            toolFeedback = `TOOL RESULT:\n\`\`\`json\n${JSON.stringify(searchResult, null, 2)}\n\`\`\``;
      }
      else if (decision.action === 'list_dir') {
        const target = decision.params?.path || '.';
        const depth = typeof decision.params?.depth === 'number' ? decision.params.depth : 3;

        // اگر دقیقاً همین پوشه را در دور قبل درخواست داده بود، جلوی درخواست تکراری را بگیر
        if (lastListSignature === `${target}:${depth}`) {
          console.log(`🛑 Loop detected on list_dir: ${target}`);
          toolFeedback = `⚠️ NOTICE: You already received the directory listing for "${target}" in the previous turn. Look at your conversation history above and proceed directly with "finish" or inspection of specific files using "read_files".`;
        } else {
          lastListSignature = `${target}:${depth}`;
          console.log(`📂 Listing directory: ${target}`);
          this.emit('agent_status', { text: `Listing directory: ${target}` });
          const listResult = await this.tools.listDirectory(target, depth);
          this.emit('agent_message', {
            role: 'agent',
            text: `**Listed directory:** \`${listResult.path}\``,
            thought: fullThought,
            action: 'list_dir'
          });
          toolFeedback = `TOOL RESULT:\n\`\`\`\n${listResult.tree}\n\`\`\``;
        }
      }
      else if (decision.action === 'continue_reading') {
        if (this.pendingChunks.length > 0) {
          const nextChunk = this.pendingChunks.shift();
          toolFeedback = nextChunk.formattedMessage;
        } else {
          toolFeedback = 'All requested files have already been fully delivered. Please proceed with your analysis or code actions.';
        }
      }
      else if (decision.action === 'patch_file') {
        lastReadSignature = null;
        let patchResult;
        let patchesList = [];

        
        if (Array.isArray(decision.params?.patches) && decision.params.patches.length > 0) {
          patchesList = decision.params.patches;
        } else if (decision.params?.file && decision.params?.search) {
          patchesList = [{
            file: decision.params.file,
            search: decision.params.search,
            replace: decision.params.replace
          }];
        }

        
        
        if (patchesList.length === 0) {
          console.warn('⚠️ patch_file arrived with no recoverable patches (malformed/truncated JSON). Requesting resend...');
          await this.randomDelay(1200, 2200, 'Patch Parse Retry');
          if (this.isStopped) break;
          const retryMsg = 'Your previous patch_file JSON could not be parsed (malformed escapes or truncated output). Re-send the SAME patches now as ONE valid ```json block: escape every newline inside "search"/"replace" as \\n and every double quote as \\". No prose outside the block.';
          this.emit('agent_status', { text: 'Patch JSON was malformed — asking model to resend...' });
          lastSentMessage = retryMsg;
          await this.driver.sendMessage(retryMsg);
          continue;
        }

        const isAutoApply = Boolean(options.autoApplyPatch);

        
        if (!isAutoApply && patchesList.length > 0) {
          const firstPatch = patchesList[0];
          this.emit('agent_status', { text: `Waiting for user approval to patch ${firstPatch.file}...` });
          
           this.emit('patch_proposed', {
             file: firstPatch.file,
             search: firstPatch.search,
             replace: firstPatch.replace,
             patch: firstPatch,
             patches: patchesList
           });

          
          const approved = await new Promise(resolve => {
            this.patchResolver = resolve;
          });

          if (!approved) {
             toolFeedback = `TOOL RESULT: The user REJECTED this patch. Please explain alternative solutions or ask what needs to be changed.`;
              this.emit('agent_message', {
                role: 'agent',
                text: L.rejected(firstPatch.file),
                thought: fullThought,
                action: 'patch_file'
              });
              lastSentMessage = toolFeedback;
              await this.driver.sendMessage(toolFeedback);
              continue;
          }
        }

        
        this.emit('agent_status', { text: `Applying ${patchesList.length} patch(es)...` });
        patchResult = await this.tools.patchBatch(patchesList);

         const summaryLines = patchResult.details.map(d => 
           d.success ? `• \`${d.file}\`: ${L.patchOk}` : `• \`${d.file}\`: ${L.patchErr(d.message)}`
         ).join('\n');

         const userFacingText = `**${L.patchesLabel(patchResult.successful, patchResult.total)}**\n${summaryLines}`;

          
          const successfulEdits = [];
          if (patchResult && Array.isArray(patchResult.details)) {
            patchResult.details.forEach((d, idx) => {
              if (d.success && patchesList[idx]) {
                successfulEdits.push({
                  file: patchesList[idx].file,
                  search: patchesList[idx].search,
                  replace: patchesList[idx].replace
                });
              }
            });
          }

          this.emit('agent_message', {
            role: 'agent',
            text: userFacingText,
            thought: fullThought,
            action: 'patch_file',
            result: patchResult,
            edits: successfulEdits 
          });

        toolFeedback = `TOOL RESULT:\n\`\`\`json\n${JSON.stringify(patchResult, null, 2)}\n\`\`\``;
      }
      else if (decision.action === 'create_file') {
        const { file, content } = decision.params;
        console.log(`📄 Creating file: ${file}`);
        this.emit('agent_message', {
          role: 'agent',
          text: fullThought || `Creating file: ${file}`,
          thought: fullThought,
          action: 'create_file',
          file
        });
        this.emit('agent_status', { text: `Creating file: ${file}` });
        const createResult = await this.tools.createFile(file, content);

        toolFeedback = `TOOL RESULT:\n\`\`\`json\n${JSON.stringify(createResult, null, 2)}\n\`\`\``;
      }
      else if (decision.action === 'execute_command') {
        
        const command = decision.params?.command || decision.params?.cmd || decision.command;
        
        if (!command || typeof command !== 'string' || !command.trim()) {
          console.warn('⚠️ execute_command received with empty command');
          toolFeedback = 'TOOL RESULT: Error - No valid shell command was provided in parameters.';
        } else {
          console.log(`💻 Executing terminal command: ${command}`);

          const isAutoApprove = Boolean(options.autoApproveCommand);

          if (!isAutoApprove) {
            this.emit('agent_status', { text: `Waiting for user approval to run command...` });
            this.emit('command_proposed', { command });

            const approved = await new Promise(resolve => {
              this.commandResolver = resolve;
            });

            if (!approved) {
              toolFeedback = `TOOL RESULT: The user REJECTED this command: "${command}". Please explain alternative solutions.`;
              this.emit('agent_message', {
                role: 'agent',
                text: `Command \`${command}\` was rejected by the user.`,
                thought: fullThought,
                action: 'execute_command',
                command
              });
              lastSentMessage = toolFeedback;
              await this.driver.sendMessage(toolFeedback);
              continue;
            }
          }

          this.emit('agent_message', {
            role: 'agent',
            text: fullThought || `Executing command: ${command}`,
            thought: fullThought, 
            action: 'execute_command',
            command
          });
          this.emit('agent_status', { text: `Executing command: ${command}` });
          const execResult = await this.tools.executeCommand(command);
          toolFeedback = `TOOL RESULT:\n\`\`\`json\n${JSON.stringify(execResult, null, 2)}\n\`\`\``;
        }
      }
    else if (decision.action === 'browse_web') {
      if (!this.browser) {
        toolFeedback = 'TOOL RESULT: Embedded browser is not available in this environment.';
      } else {
        const target = decision.params?.url || decision.params?.query || '';
        console.log(`🌐 Browsing: ${target}`);
        this.emit('agent_status', { text: `Browsing: ${target}` });
        const res = await this.browser.navigate(target);
        this.emit('agent_message', {
          role: 'agent',
          text: `**Browsed:** \`${res.title}\` (${res.url})`,
          thought: fullThought,
          action: 'browse_web'
        });
        toolFeedback = `TOOL RESULT: PAGE OPENED IN EMBEDDED BROWSER\nTITLE: ${res.title}\nURL: ${res.url}\n--- VISIBLE TEXT (first 3000 chars) ---\n${String(res.text || '').slice(0, 3000)}`;
      }
    }
    else if (decision.action === 'read_page') {
      if (!this.browser) {
        toolFeedback = 'TOOL RESULT: Embedded browser is not available in this environment.';
      } else {
        const start = typeof decision.params?.start_line === 'number' ? decision.params.start_line : 1;
        const end = typeof decision.params?.end_line === 'number' ? decision.params.end_line : start + 149;
        const res = await this.browser.readRange(start, end);
        this.emit('agent_message', {
          role: 'agent',
          text: `**Read page:** \`${res.title}\` (${L.linesRange(start, Math.min(end, res.totalLines))})`,
          thought: fullThought,
          action: 'read_page'
        });
        const body = res.lines.map(l => `${l.lineNum} | ${l.text}`).join('\n');
        toolFeedback = `TOOL RESULT: CURRENT EMBEDDED BROWSER PAGE\nTITLE: ${res.title}\nURL: ${res.url}\nTOTAL LINES: ${res.totalLines}\nSHOWING ${start}-${Math.min(end, res.totalLines)}:\n${body || '(empty page)'}`;
      }
    }
      else {
        toolFeedback = `Unknown action: "${decision.action}". Please choose one of: "read_files", "read_file", "search_code", "list_dir", "patch_file", "create_file", "execute_command", "finish".`;
      }

      if (this.isStopped) break;

      
      await this.randomDelay(3000, 7000, 'Pacing');
      if (this.isStopped) break;

      const protocolReminder = `\n\nCRITICAL INSTRUCTION:\nReply ONLY with a single JSON action block inside \`\`\`json\`\`\`. Do not write conversational prose outside the JSON:\nFORMAT: Every user-visible text must be markdown — bullet lists + identifiers wrapped in backticks (\`file.js\`, \`npm test\`). Never a plain paragraph wall:\n\`\`\`json\n{\n  "thought": "your concise reasoning in English",\n  "action": "patch_file" | "read_files" | "search_code" | "create_file" | "execute_command" | "finish",\n  "params": { ... }\n}\n\`\`\``;

      toolFeedback += protocolReminder;


if (toolFeedback.length > 60000) {
  toolFeedback = toolFeedback.slice(0, 35000) +
    `
... [TRUNCATED FOR CONTEXT LIMIT] ...
` +
    toolFeedback.slice(-20000);
}

      console.log(`📤 Sending results back to ${P}...`);
      this.emit('agent_status', { text: `Sending results back to ${P}...` });
      lastSentMessage = toolFeedback;
      await this.driver.sendMessage(toolFeedback);
    }

    if (this.isStopped) {
      this.emit('task_stopped', { message: 'Task was stopped by user.' });
    } else if (!taskFinished) {
      
      console.warn('⚠️ Step limit reached (30 steps) without a finish action.');
      this.emit('agent_message', {
        role: 'agent',
        text: '**Step limit reached (30 steps).** The agent did not conclude this task. Send a new prompt to continue.',
        action: 'task_limit'
      });
      this.emit('task_finished', { summary: 'Step limit reached (30 steps).' });
    }
  }
}

module.exports = CodingAgent;
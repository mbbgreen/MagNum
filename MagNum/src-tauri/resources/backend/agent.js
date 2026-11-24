'use strict';

let SYSTEM_PROMPT = `# MAGNUM — AUTONOMOUS SOFTWARE ENGINEER

STRICT OUTPUT RULE (APPLIES TO EVERY TURN, INCLUDING GREETINGS):
- Reply with ONLY ONE \`\`\`json code block. No text outside the block.
- For greetings or questions that require no workspace inspection or tool use, reply immediately with "finish" JSON.
- MagNum's local runner on the user's PC executes your JSON actions on the workspace and sends back "TOOL RESULT:" in the next message. NEVER ask the user to upload or paste files — request them with "read_files" JSON instead.

JSON FORMAT:
\`\`\`json
{
  "thought": "Brief action purpose in English. No chain-of-thought.",
  "action": "ACTION_NAME",
  "params": { ... }
}
\`\`\`

Examples:
- Read a file: \`{"thought": "Inspect target file", "action": "read_files", "params": {"files": ["handlers/ai.js"]}}\`
- Reply to greeting/finish: \`{"thought": "Greet user", "action": "finish", "params": {"summary": "سلام! چطور می‌تونم کمکت کنم؟"}}\`

## RULES
1. USER TASKS: For clear change requests, inspect the relevant code and make the smallest safe patch. Avoid unnecessary exploration, but never patch without sufficient context.
2. READING WINDOW (1000-LINE CAP): Every read returns at most 1000 lines total across requested files. A file is complete only if marked COMPLETE. Use "continue_reading" for the next 1000 lines. Never re-read unchanged lines already delivered. Re-read only when the file has changed or additional context is necessary.
3. READ TO ORIENT -> SEARCH TO NAVIGATE: "search_code" is a literal case-sensitive substring search (use a real token you observed, not generic words like "const"). Jump to the returned "window" via "read_file" or "read_files" with "ranges".
4. WORKSPACE TREE: The workspace tree is already provided below. Do not call "list_dir" on "." unless inspecting an external folder.
5. VERIFICATION: After code changes, run relevant tests, build, or checks that actually exist in the project. Never claim success without verification. Report any checks that could not be run.
6. SAFETY: Never modify files outside the workspace unless explicitly requested. Avoid destructive commands (e.g. recursive delete, git reset --hard). MagNum automatically handles user approval for patches and commands — never pause in "finish" to ask permission.
7. TOOL EXECUTION: You have no direct access to the user's filesystem or terminal. ONLY use the provided JSON actions. Never claim an action succeeded before receiving its TOOL RESULT.

## ACTIONS
1. "read_files": {"files": ["src/App.tsx"], "ranges": {"src/App.tsx": {"start_line": 1, "end_line": 200}}} ("ranges" optional)
2. "read_file": {"file": "huge.js", "start_line": 1, "end_line": 1000}
3. "continue_reading": {}
4. "search_code": {"query": "exactToken"} (optional: "root")
5. "list_dir": {"path": "D:\\\\OtherProject", "depth": 2}
6. "patch_file": {"patches": [{"file": "a.js", "search": "exact old code", "replace": "new code"}]}
7. "create_file": {"file": "a.js", "content": "..."}
8. "execute_command": {"command": "..."}
9. "browse_web": {"query": "..."} or {"url": "https://..."} (MagNum's embedded browser tab)
10. "read_page": {"start_line": 1, "end_line": 150} (reads embedded browser page)
11. "finish": {"summary": "Markdown response in user's language (identifiers in backticks, no HTML tags)"}
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
=== ACTIVE MODE: PLAN (read-only planning) ===
1. Do NOT use "patch_file", "create_file", or "execute_command".
2. Only investigate with "read_files" and "search_code".
3. Call "finish" with a structured plan in "summary" (Goal, steps, exact files, risks, verification).`,
  debug: `
=== ACTIVE MODE: DEBUG (root-cause debugging) ===
1. Reproduce with "execute_command" or inspect error via "search_code" and "read_files".
2. State the root-cause hypothesis in "thought" and verify it with evidence.
3. Apply the minimal "patch_file", re-run verification, then call "finish".`,
  ask: `
=== ACTIVE MODE: ASK (read-only Q&A) ===
1. Do NOT use "patch_file" or "create_file".
2. Investigate with "read_files" / "search_code" only, then call "finish" with exact file/line references.`,
  multitask: `
=== ACTIVE MODE: MULTITASK ===
1. Break the task into numbered subtasks in "thought".
2. Execute step by step, verify with "execute_command", then call "finish" with status per subtask.`
};

const FINISH_FORMAT_RULE = `
When calling "finish", "summary" must be plain Markdown only (no HTML tags like <PRIVATE_NOTE>, <badge>, <details>, <summary>).`;

for (const __modeKey of Object.keys(MODE_PROMPTS)) {
  MODE_PROMPTS[__modeKey] += FINISH_FORMAT_RULE;
}
SYSTEM_PROMPT += FINISH_FORMAT_RULE;

const AGENT_STRINGS = {
  en: {
    readFiles: 'Read files:',
    fullFile: 'full file',
    linesRange: (a, b) => `lines ${a}–${b}`,
    lineLabel: (n) => `line ${n}`,
    moreAvailable: '⏳ More file lines remain',
    searchLabel: 'Searched for:',
    results: (n) => `(${n} result${n === 1 ? '' : 's'})`,
    noMatch: 'No matches found.',
    patchesLabel: (a, b) => `Applied patches (${a}/${b}):`,
    patchOk: 'patch applied successfully.',
    patchErr: (m) => `error - ${m}`,
    rejected: (f) => `Changes to \`${f}\` were rejected by the user.`,
    cmdRejected: (c) => `Command \`${c}\` was rejected by the user.`,
    listedDir: 'Listed directory:',
    browsed: 'Browsed:',
    readPage: 'Read page:',
    creatingFileMsg: (f) => `Creating file: ${f}`,
    execCmdMsg: (c) => `Executing command: ${c}`,
    completedFallback: 'Completed successfully.',
    statusNaturalPause: (sec) => `Pacing requests (${sec}s)...`,
    statusScanning: 'Scanning workspace tree...',
    statusSending: (p) => `Sending task to ${p}...`,
    statusTreeRefresh: 'Workspace changed — refreshing project tree...',
    statusSendingFollowup: (p) => `Sending follow-up task to ${p}...`,
    statusThinking: (p) => `${p} is thinking...`,
    statusRatePause: (rem) => `Rate limit pause (${rem}s remaining)...`,
    statusRateResend: 'Rate limit cleared — re-sending request...',
    statusRateStop: (p) => `${p} rate limit reached — waiting for quota reset or provider switch.`,
    statusNoNewStop: 'No new response detected — task stopped safely.',
    statusIncompleteRetry: 'Incomplete response — requesting next step...',
    statusMalformedRetry: 'Incomplete edit response — requesting retry...',
    statusReadingFile: (file, rText) => `Reading file: ${file}${rText}`,
    statusListingDir: (target) => `Listing directory: ${target}`,
    statusWaitPatch: (file) => `Waiting for user approval to patch ${file}...`,
    statusApplyingPatches: (n) => `Applying ${n} patch(es)...`,
    statusCreatingFile: (f) => `Creating file: ${f}`,
    statusWaitCmd: 'Waiting for user approval to run command...',
    statusExecCmd: (c) => `Executing command: ${c}`,
    statusBrowsing: (t) => `Browsing: ${t}`,
    statusSendingResults: (p) => `Sending results back to ${p}...`,
    statusStopped: 'Task was stopped by user.',
    errRatePersisted: 'DeepSeek rate limit persisted after multiple retries.',
    noNewRespMsg: '**No new model response was detected for this turn.** Stale-answer protection prevented showing an outdated answer; no changes were made. Please re-send your prompt.',
    unusableRespMsg: '**Model response was unusable (3 consecutive attempts).** No changes were made. Re-send your prompt or switch model.',
    rateLimitChatGpt: '**ChatGPT usage limit reached.** Your free-plan quota for this window is exhausted.\n• Wait for the limit to reset, or\n• Switch to DeepSeek / Gemini from the model pill and re-send this prompt.\nThe task was stopped safely; nothing was lost.\n• MagNum blocks new ChatGPT requests during an automatic cooldown window.',
    rateLimitGemini: '**Gemini rate limit reached (daily quota).** This account\'s quota for today is exhausted.\n• Wait until the quota resets (usually next day), or\n• Switch to DeepSeek from the model pill and re-send this prompt.\nThe task was stopped safely; nothing was lost.\n• MagNum blocks new Gemini requests during an automatic cooldown window.'
  },
  fa: {
    readFiles: 'بررسی فایل‌ها:',
    fullFile: 'کل فایل',
    linesRange: (a, b) => `خطوط \u200F${a}\u200F تا \u200F${b}\u200F`,
    lineLabel: (n) => `خط \u200F${n}\u200F`,
    moreAvailable: '⏳ بخش‌های دیگری از این فایل باقی مانده است',
    searchLabel: 'جستجو برای:',
    results: (n) => `(${n} نتیجه)`,
    noMatch: 'موردی یافت نشد.',
    patchesLabel: (a, b) => `اعمال پچ‌ها (${a}/${b}):`,
    patchOk: 'تغییرات با موفقیت اعمال شد.',
    patchErr: (m) => `خطا - \u200F${m}\u200F`,
    rejected: (f) => `تغییرات فایل \u200F\`${f}\`\u200F توسط کاربر لغو شد.`,
    cmdRejected: (c) => `اجرای دستور \u200F\`${c}\`\u200F توسط کاربر رد شد.`,
    listedDir: 'فهرست پوشه:',
    browsed: 'مرور صفحه:',
    readPage: 'خواندن صفحه:',
    creatingFileMsg: (f) => `ساخت فایل: \u200F${f}\u200F`,
    execCmdMsg: (c) => `اجرای دستور: \u200F${c}\u200F`,
    completedFallback: 'عملیات با موفقیت انجام شد.',
    statusNaturalPause: (sec) => `مکث کوتاه (\u200F${sec}\u200F ثانیه) برای پایداری اتصال...`,
    statusScanning: 'در حال بررسی ساختار پروژه...',
    statusSending: (p) => `در حال ارسال درخواست به \u200F${p}\u200F...`,
    statusTreeRefresh: 'ساختار پروژه تغییر کرده است — در حال به‌روزرسانی...',
    statusSendingFollowup: (p) => `در حال ارسال ادامه گفتگو به \u200F${p}\u200F...`,
    statusThinking: (p) => `\u200F${p}\u200F در حال تحلیل و فکر کردن است...`,
    statusRatePause: (rem) => `مکث موقت محدودیت سرویس (\u200F${rem}\u200F ثانیه باقی‌مانده)...`,
    statusRateResend: 'محدودیت برطرف شد — در حال ارسال مجدد درخواست...',
    statusRateStop: (p) => `سقف مصرف \u200F${p}\u200F پر شده است — در انتظار باز شدن سهمیه یا تغییر مدل.`,
    statusNoNewStop: 'پاسخ جدیدی دریافت نشد — عملیات به‌صورت امن متوقف گردید.',
    statusIncompleteRetry: 'پاسخ مدل کامل نبود — درخواست ادامه کار...',
    statusMalformedRetry: 'ساختار تغییرات ناقص بود — درخواست ارسال مجدد...',
    statusReadingFile: (file, rText) => `در حال خواندن فایل: \u200F${file}${rText}\u200F`,
    statusListingDir: (target) => `در حال بررسی پوشه: \u200F${target}\u200F`,
    statusWaitPatch: (file) => `در انتظار تأیید کاربر برای تغییر فایل \u200F${file}\u200F...`,
    statusApplyingPatches: (n) => `در حال اعمال \u200F${n}\u200F تغییر...`,
    statusCreatingFile: (f) => `در حال ساخت فایل: \u200F${f}\u200F`,
    statusWaitCmd: 'در انتظار تأیید کاربر برای اجرای دستور...',
    statusExecCmd: (c) => `در حال اجرای دستور: \u200F${c}\u200F`,
    statusBrowsing: (t) => `در حال مرور نشانی: \u200F${t}\u200F`,
    statusSendingResults: (p) => `در حال ارسال نتایج به \u200F${p}\u200F...`,
    statusStopped: 'عملیات توسط کاربر متوقف شد.',
    errRatePersisted: 'محدودیت سرویس \u200FDeepSeek\u200F پس از چند تلاش مجدد همچنان پابرجاست.',
    noNewRespMsg: '**پاسخ جدیدی از مدل دریافت نشد.** برای جلوگیری از نمایش پاسخ قدیمی، عملیات بدون اعمال تغییر متوقف شد. لطفاً پیام را دوباره بفرستید.',
    unusableRespMsg: '**پاسخ مدل قابل استفاده نبود (\u200F3\u200F تلاش پیاپی).** هیچ تغییری اعمال نشد؛ پیام را دوباره ارسال کنید یا مدل دیگری انتخاب نمایید.',
    rateLimitChatGpt: '**به سقف مصرف \u200FChatGPT\u200F رسیدیم.** سهمیهٔ پلن رایگان در این بازه تمام شده است.\n• تا باز شدن مجدد محدودیت صبر کنید، یا\n• از منوی انتخاب مدل به \u200FDeepSeek\u200F یا \u200FGemini\u200F تغییر دهید و همین پیام را دوباره بفرستید.\nعملیات به‌صورت امن متوقف شد؛ هیچ تغییری از دست نرفته است.\n• مگنوم تا پایان دورهٔ محدودیت، درخواست جدیدی به \u200FChatGPT\u200F نمی‌فرستد.',
    rateLimitGemini: '**به سقف مصرف روزانهٔ \u200FGemini\u200F رسیدیم.** سهمیهٔ امروز این حساب گوگل تمام شده است.\n• تا شارژ مجدد سهمیه (معمولاً روز بعد) صبر کنید، یا\n• از منوی انتخاب مدل به \u200FDeepSeek\u200F یا \u200FChatGPT\u200F تغییر دهید و همین پیام را دوباره بفرستید.\nعملیات به‌صورت امن متوقف شد؛ هیچ تغییری از دست نرفته است.\n• مگنوم تا پایان دورهٔ محدودیت، درخواست جدیدی به \u200FGemini\u200F نمی‌فرستد.'
  }
};

const RATE_LIMIT_TEXT_RE = /you(?:'ve| have) reached your (?:rate |usage )?limit|you(?:'ve| have) reached (?:the|your) (?:current )?(?:usage|daily) (?:cap|quota|limit)|quota for the day|wait for it to reset|upgrade to (?:plus|pro|go further)|too many requests[\s,!.]+(?:please )?try again later|resource has been exhausted/i;

function looksLikeRateLimit(text) {
  if (typeof text !== 'string') return false;
  if (/```/.test(text)) return false;
  if (/"(?:action|thought|params|patches|search|replace|content)"\s*:/.test(text)) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 350) return false;
  return RATE_LIMIT_TEXT_RE.test(trimmed);
}

const CHANGE_REQUEST_RE = /```|patch_file|create_file|"search"\s*:|"replace"\s*:|\b(implement|apply|fix|add|remove|delete|refactor|rename|create|patch|replace|insert|update|change|build|install)\b|فایل|پچ|اعمال|حذف|اضافه|جایگزین|درست\s*کن|بساز|پیاده/i;
const FILE_PATH_RE = /\.(tsx|jsx|ts|js|rs|py|css|html|json|md|txt)\b/i;

function detectChangeRequest(task, skill) {
  if (skill === 'ask' || skill === 'plan') return false;
  const t = String(task || '');
  if (!t.trim()) return false;
  return CHANGE_REQUEST_RE.test(t) || FILE_PATH_RE.test(t);
}

function taskReminderBlock(task) {
  const t = String(task || '').trim();
  if (!t) return '';
  const MAX = 6000;
  const body = t.length > MAX
    ? t.slice(0, Math.floor(MAX * 0.6)) + '\n…[middle truncated]…\n' + t.slice(-Math.floor(MAX * 0.4))
    : t;
  return `\n=== ACTIVE USER TASK (do NOT call "finish" until completed) ===\n${body}\n=== END TASK ===\n`;
}

const CONFUSED_FINISH_RE = /not (yet )?(been )?(specified|provided|given)|no (task|change|request)|ask for|clarif|please (provide|specify|share|upload)|what (would|do) you|i (cannot|can't) (access|edit|modify)|upload|بارگذاری|مشخص نشده|درخواستی مشخص|لطفاً.*(بگویید|مشخص کنید|بارگذاری)/i;

class CodingAgent {
  constructor(driver, tools, onEvent = null, browser = null) {
    this.driver = driver;
    this.tools = tools;
    this.onEvent = onEvent;
    this.browser = browser;
    this.isStopped = false;
    this.pendingChunks = [];
    this.readResume = null;
    this.patchResolver = null;
    this.commandResolver = null;
    this._systemPromptSent = false;
    this.activeTask = '';
    this.taskIsChange = false;
    this.turnsExecuted = 0;
    this.readsDelivered = 0;
    this.mutationsApplied = 0;
    this.prematureFinishRetries = 0;
    this.lang = 'en';
  }

  L() {
    return AGENT_STRINGS[this.lang === 'fa' ? 'fa' : 'en'] || AGENT_STRINGS.en;
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
    this.emit('agent_status', { text: this.L().statusNaturalPause(sec) });

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
    let blockMatch = null;
    for (let i = allBlocks.length - 1; i >= 0; i--) {
      if (/"action"\s*:/.test(allBlocks[i][1])) {
        blockMatch = allBlocks[i];
        break;
      }
    }
    if (!blockMatch && allBlocks.length) blockMatch = allBlocks[allBlocks.length - 1];

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
    } catch {
      try {
        const repaired = fixRawNewlinesInJsonStrings(jsonString).replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch {
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
      const uniquePatches = patches.filter(p => {
        const k = p.file + '||' + p.search + '||' + p.replace;
        if (seenPatch.has(k)) return false;
        seenPatch.add(k);
        return true;
      });
      if (uniquePatches.length > 0) return { thought, action: 'patch_file', params: { patches: uniquePatches } };
      return null;
    }

    return { thought, action, params: {} };
  }

  async run(task, options = {}) {
    this.isStopped = false;
    this.pendingChunks = [];
    this.readResume = null;
    const L = this.L();
    const P = options.provider === 'gemini' ? 'Gemini' : options.provider === 'chatgpt' ? 'ChatGPT' : 'DeepSeek';
    this.activeTask = String(task || '');
    this.taskIsChange = detectChangeRequest(this.activeTask, options.skill);
    this.turnsExecuted = 0;
    this.readsDelivered = 0;
    this.mutationsApplied = 0;
    this.prematureFinishRetries = 0;
    this.lang = options.lang === 'fa' ? 'fa' : 'en';
    if (this.driver) this.driver.lang = this.lang;

    const windowSummary = (chunk) => {
      const rows = (chunk.segments || []).map(s => s.error
        ? `• \`${s.path}\` (❌ ${s.error})`
        : s.isComplete
          ? `• \`${s.path}\` (${L.fullFile} — ${s.totalFileLines})`
          : `• \`${s.path}\` (${L.linesRange(s.startLine, s.endLine)} / ${s.totalFileLines})`
      );
      if (chunk.hasMore) rows.push(L.moreAvailable);
      return rows.join('\n');
    };

    let lastReadSignature = null;
    let lastSearchSignature = null;
    let lastListSignature = null;
    let consecutiveFormatRetries = 0;

    const isFirstMessage = (options.isFirstMessage !== undefined)
      ? Boolean(options.isFirstMessage)
      : !this._systemPromptSent;
    const systemPromptAlreadySent = (options.systemPromptSent !== undefined)
      ? Boolean(options.systemPromptSent)
      : this._systemPromptSent;

    if (typeof options.deepThink === 'boolean' && options.provider === 'deepseek' && this.driver?.setDeepThink) {
      await this.driver.setDeepThink(options.deepThink);
    }
    if (options.provider === 'gemini' && typeof options.thinkingLevel === 'string' && this.driver?.setThinkingLevel) {
      await this.driver.setThinkingLevel(options.thinkingLevel);
    }
    if (options.provider === 'chatgpt' && this.driver?.setThinkEnabled) {
      await this.driver.setThinkEnabled(typeof options.chatgptThink === 'boolean' ? options.chatgptThink : true);
    }

    const modeInstructions = options.skill && MODE_PROMPTS[options.skill] ? MODE_PROMPTS[options.skill] : '';

    let initialMessage;
    const sendingFullPrompt = isFirstMessage || !systemPromptAlreadySent;

    if (sendingFullPrompt) {
      const projectTree = (typeof options.projectTree === 'string')
        ? options.projectTree
        : await this.tools.getProjectTree();
      console.log('\n🔍 Scanning workspace tree...');
      this.emit('agent_status', { text: this.L().statusScanning });
      if (this.isStopped) return;

      initialMessage = `${SYSTEM_PROMPT}${modeInstructions}

=== PROJECT FILE TREE ===
${projectTree}
========================
USER TASK:
${task}

Respond ONLY with ONE \`\`\`json block (use "read_files" / "search_code" for project files, or "finish" directly for greetings/general replies). Do not ask the user to upload files.`;

      console.log(`📤 Sending system prompt + task to ${P}...`);
      this.emit('agent_status', { text: this.L().statusSending(P) });
    } else {
      const treeSection = (typeof options.treeUpdate === 'string' && options.treeUpdate)
        ? `\n=== UPDATED WORKSPACE TREE ===\n${options.treeUpdate}\n========================\n`
        : '';
      if (treeSection) {
        console.log('🌲 Workspace structure changed since last turn — sending updated file tree...');
        this.emit('agent_status', { text: this.L().statusTreeRefresh });
      }
      initialMessage = `${modeInstructions}NEW USER TASK:
${task}
${treeSection}
Reply ONLY with ONE \`\`\`json block (use "read_files" / "search_code" if you need project files, or "finish" directly for greetings/general replies).`;
      console.log('📤 Sending FOLLOW-UP task only (system prompt already in context)...');
      this.emit('agent_status', { text: this.L().statusSendingFollowup(P) });
    }

    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 700) + 700));
    if (this.isStopped) return;

    let lastSentMessage = initialMessage;
    await this.driver.sendMessage(initialMessage, options);
    if (sendingFullPrompt) this._systemPromptSent = true;

    const liveUrl = await this.driver.getChatUrl();
    if (liveUrl && liveUrl.includes('/chat/')) {
      this.emit('chat_url_captured', { url: liveUrl });
    }

    let taskFinished = false;
    let rateLimitStop = false;
    let rateLimitProvider = null;
    let noNewStop = false;
    let loopRepeatCount = 0;

    if (this.driver) {
      this.driver._onCaptcha = (captchaState) => {
        if (this.isStopped) return;
        this.emit('captcha_state', captchaState);
      };
    }

    while (true) {
      if (this.isStopped) break;

      this.emit('agent_status', { text: this.L().statusThinking(P) });

      let response;
      let rateLimitAttempts = 0;
      const MAX_RATE_LIMIT_RETRIES = 3;

      while (true) {
        if (this.isStopped) break;
        try {
          response = await this.driver.waitForCompletion(
            (progress) => {
              if (this.isStopped) return;
              const live = extractSafeLiveStream(progress && progress.text ? progress.text : '');
              this.emit('agent_streaming', { text: live.prose, thought: live.thought, action: null });
            },
            (statusText) => {
              if (this.isStopped) return;
              this.emit('agent_status', { text: statusText });
            },
            (retryInfo) => {
              if (this.isStopped) return;
              this.emit('network_retry', retryInfo);
            },
            (captchaState) => {
              if (this.isStopped) return;
              this.emit('captcha_state', captchaState);
            }
          );
          break;
        } catch (waitErr) {
          if (waitErr.code === 'NO_NEW_RESPONSE' || (waitErr.message && waitErr.message.includes('NO_NEW_RESPONSE'))) {
            console.warn('⚠️ Stale-answer protection: no new model response detected — stopping safely.');
            noNewStop = true;
            break;
          }
          if (waitErr.code === 'CAPTCHA_REQUIRED') {
            throw waitErr;
          }
          if (waitErr.code === 'GEMINI_RATE_LIMIT' || (waitErr.message && waitErr.message.includes('GEMINI_RATE_LIMIT'))) {
            console.warn('⚠️ Gemini rate limit / quota reached — stopping task with a clear notice.');
            rateLimitStop = true;
            rateLimitProvider = 'gemini';
            break;
          }
          if (waitErr.code === 'CHATGPT_RATE_LIMIT' || (waitErr.message && waitErr.message.includes('CHATGPT_RATE_LIMIT'))) {
            console.warn('⚠️ ChatGPT usage/rate limit reached — stopping task with a clear notice.');
            rateLimitStop = true;
            rateLimitProvider = 'chatgpt';
            break;
          }
          if (waitErr.code === 'CHATGPT_LOGIN_REQUIRED' || (waitErr.message && waitErr.message.includes('CHATGPT_LOGIN_REQUIRED'))) {
            throw waitErr;
          }
          if (waitErr.code === 'LENGTH_LIMIT_REACHED' || (waitErr.message && waitErr.message.includes('LENGTH_LIMIT_REACHED'))) {
            if (rateLimitAttempts >= MAX_RATE_LIMIT_RETRIES) {
              throw new Error(this.L().errRatePersisted);
            }
            rateLimitAttempts++;

            const cooldownSec = Math.floor(Math.random() * (105 - 65 + 1)) + 65;
            console.log(`⏳ [Rate Limit Pause] DeepSeek throttled. Pausing for ${cooldownSec}s...`);

            const startTime = Date.now();
            while (Date.now() - startTime < cooldownSec * 1000) {
              if (this.isStopped) return;
              const rem = Math.ceil((cooldownSec * 1000 - (Date.now() - startTime)) / 1000);
              this.emit('agent_status', {
                text: this.L().statusRatePause(rem)
              });
              await new Promise(r => setTimeout(r, 1000));
            }

            if (this.isStopped) return;

            console.log('🔄 Rate limit cleared. Re-sending the current turn message to DeepSeek...');
            this.emit('agent_status', { text: this.L().statusRateResend });
            await this.driver.sendMessage(lastSentMessage, { provider: options.provider, lang: this.lang });
            continue;
          }
          throw waitErr;
        }
      }

      this.emit('agent_streaming_end', {});

      if (rateLimitStop) {
        const rlProvider = rateLimitProvider === 'chatgpt' ? 'chatgpt'
          : (rateLimitProvider === 'gemini' ? 'gemini'
          : (options.provider === 'chatgpt' ? 'chatgpt' : 'gemini'));
        this.emit('provider_rate_limit', { provider: rlProvider });
        if (rlProvider === 'gemini') this.emit('gemini_rate_limit', { provider: 'gemini' });
        const msg = rlProvider === 'chatgpt' ? L.rateLimitChatGpt : L.rateLimitGemini;
        this.emit('agent_status', { text: this.L().statusRateStop(P) });
        this.emit('agent_message', { role: 'agent', text: msg, thought: '', action: 'finish' });
        this.emit('task_finished', { summary: msg });
        taskFinished = true;
        break;
      }
      if (this.isStopped) break;

      if (noNewStop) {
        const msg = this.L().noNewRespMsg;
        this.emit('agent_status', { text: this.L().statusNoNewStop });
        this.emit('agent_message', { role: 'agent', text: msg, thought: '', action: 'finish' });
        this.emit('task_finished', { summary: msg });
        taskFinished = true;
        break;
      }

      const decision = this.parseResponse(response);

      if (!decision || !decision.action) {
        if ((options.provider === 'gemini' || options.provider === 'chatgpt') && looksLikeRateLimit(response)) {
          console.warn('⚠️ Plain-text rate-limit response detected — stopping without retry.');
          const rlProvider = options.provider;
          this.emit('provider_rate_limit', { provider: rlProvider });
          if (rlProvider === 'gemini') this.emit('gemini_rate_limit', { provider: 'gemini' });
          const msg = rlProvider === 'chatgpt' ? L.rateLimitChatGpt : L.rateLimitGemini;
          this.emit('agent_status', { text: this.L().statusRateStop(P) });
          this.emit('agent_message', { role: 'agent', text: msg, thought: '', action: 'finish' });
          this.emit('task_finished', { summary: msg });
          taskFinished = true;
          break;
        }

        consecutiveFormatRetries++;
        if (consecutiveFormatRetries > 2) {
          const limitMsg = this.L().unusableRespMsg;
          this.emit('agent_message', { role: 'agent', text: limitMsg, thought: '', action: 'finish' });
          this.emit('task_finished', { summary: limitMsg });
          taskFinished = true;
          break;
        }
        console.log('⚠️ Response is not JSON action. Model output was:\n', String(response || '').slice(-300));
        await this.randomDelay(2000, 3500, 'Format Retry');
        if (this.isStopped) break;

        const formatRetryMsg =
          `Your last reply was plain text instead of a \`\`\`json block.\n` +
          `Do NOT ask the user to upload files — MagNum runs your JSON locally.\n` +
          `Output ONLY ONE \`\`\`json block:\n` +
          (this.taskIsChange
            ? `\`\`\`json\n{"thought": "Inspect target file", "action": "read_files", "params": {"files": ["path/to/file"]}}\n\`\`\`\n` + taskReminderBlock(this.activeTask)
            : `\`\`\`json\n{"thought": "Answer user", "action": "finish", "params": {"summary": "Your answer here"}}\n\`\`\``);

        lastSentMessage = formatRetryMsg;
        await this.driver.sendMessage(formatRetryMsg, { provider: options.provider, lang: this.lang });
        continue;
      }

      consecutiveFormatRetries = 0;

      const fullThought = decision.thought || '';
      this.turnsExecuted++;
      console.log(`\n💭 Thought: ${fullThought || 'Processing...'}`);
      console.log(`⚡ Action: [${decision.action}]`);

      if (decision.action === 'finish') {
        const rawSummary = decision.params?.summary || decision.params?.answer || decision.params?.message || '';
        const noSummary = !String(rawSummary).trim();
        const confused = CONFUSED_FINISH_RE.test(String(rawSummary)) || CONFUSED_FINISH_RE.test(fullThought);
        const premature = this.taskIsChange && this.mutationsApplied === 0 &&
          (noSummary || confused || this.turnsExecuted <= 2) && this.prematureFinishRetries < 2;
        if (premature) {
          this.prematureFinishRetries++;
          console.warn(`🛑 finish rejected (${this.prematureFinishRetries}/2): change task, zero edits, noSummary=${noSummary}, confused=${confused}.`);
          this.emit('agent_status', { text: this.L().statusIncompleteRetry });
          const corrective =
            `Your "finish" was rejected because this is a code-change task and 0 edits have been applied${noSummary ? ' (summary was empty)' : ''}.\n` +
            `Do NOT ask the user to upload files or clarify. Reply ONLY with the next \`\`\`json action ("read_files", "search_code", "patch_file", or "create_file").` +
            taskReminderBlock(this.activeTask);
          await this.randomDelay(1500, 2500, 'Contract Enforcement');
          if (this.isStopped) break;
          lastSentMessage = corrective;
          await this.driver.sendMessage(corrective, { provider: options.provider, lang: this.lang });
          continue;
        }
        const summary = String(rawSummary).replace(/<\/?(?:PRIVATE_NOTE|badge|details|summary)[^>]*>/gi, '').trim() || this.L().completedFallback;
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
              ranges[singleFile] = { start_line: decision.params.start_line, end_line: decision.params.end_line };
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

        const isRepeat = currentSignature === lastReadSignature;
        const hasResume = Array.isArray(this.readResume) && this.readResume.length > 0;

        if (isRepeat && !hasResume) {
          loopRepeatCount++;
          console.log(`🛑 Loop detected (${loopRepeatCount}x): same window re-requested, nothing left to deliver.`);
          toolFeedback = loopRepeatCount >= 2
            ? `⚠️ HARD STOP: You requested the EXACT same files/ranges ${loopRepeatCount} times and ALL of that content was already delivered. Further identical reads will be IGNORED.\n- If you located the issue: reply with "patch_file" NOW.\n- If you need a symbol location: reply with "search_code" NOW.\n- If you have enough context: reply with "finish" NOW.`
            : `⚠️ NOTICE: These exact files/ranges were already fully delivered in the previous window.\n- Do NOT re-read delivered lines.\n- If more lines remain, use "continue_reading" for the next 1000-line window.\n- Otherwise proceed with "patch_file", "search_code", or "finish".`;
        } else {
          loopRepeatCount = 0;
          let effFiles = files;
          let effRanges = ranges;
          if (isRepeat && hasResume) {
            effFiles = this.readResume.map(r => r.path);
            effRanges = {};
            for (const r of this.readResume) {
              if (r.startLine >= 1) effRanges[r.path] = { start_line: r.startLine, end_line: r.endLine };
            }
          }
          lastReadSignature = currentSignature;
          console.log('📖 Reading window (≤1000 lines):', effFiles.join(', '));
          const chunks = await this.tools.prepareFileChunks(effFiles, effRanges, 1000, (filePath, range) => {
            const rText = range && (range.start_line || range.end_line)
              ? ` (lines ${range.start_line || 1}-${range.end_line || 'end'})`
              : ' (from line 1)';
            this.emit('agent_status', { text: this.L().statusReadingFile(filePath, rText) });
          });
          const chunk = chunks[0];
          this.readResume = chunk.hasMore ? chunk.remaining : null;
          this.emit('agent_message', {
            role: 'agent',
            text: `**${L.readFiles}**\n${windowSummary(chunk)}`,
            thought: fullThought,
            action: decision.action,
            files
          });
          this.readsDelivered++;
          toolFeedback = chunk.formattedMessage;
        }
      }
      else if (decision.action === 'search_code') {
        const query = decision.params?.query || '';
        const searchSig = `${query}::${decision.params?.root || ''}`;
        if (searchSig === lastSearchSignature) {
          toolFeedback = '⚠️ NOTICE: You already ran this EXACT search in the previous turn — its results are above in your context. Do NOT repeat it. Either read the suggested "window" of the relevant hit with "read_file", or refine the query to a longer / more unique literal.';
        } else {
          lastSearchSignature = searchSig;
          console.log(`🔍 Searching code for: "${query}"`);
          const searchResult = await this.tools.searchCode(query, 25, decision.params?.root || null);
          const hits = searchResult.matches || [];
          const searchMatchesText = hits.length > 0
            ? hits.slice(0, 5).map(m => `• \`${m.file}\` (${L.lineLabel(m.line)}${m.totalLines ? ` / ${m.totalLines}` : ''}): \`${m.snippet}\``).join('\n')
            : `• *${L.noMatch}*`;
          this.emit('agent_message', {
            role: 'agent',
            text: `**${L.searchLabel}** \`${query}\` ${L.results(searchResult.totalMatches)}\n${searchMatchesText}`,
            thought: fullThought,
            action: 'search_code'
          });
          const nextStep = hits.length > 0
            ? `\n\nNEXT STEP: pick the relevant hit and call "read_file" with its "window" (start_line/end_line), or request multiple slices in one "read_files" call.`
            : `\n\nNo matches. "search_code" is a literal case-sensitive substring. Try a shorter unique token.`;
          toolFeedback = `TOOL RESULT:\n\`\`\`json\n${JSON.stringify(searchResult, null, 2)}\n\`\`\`${nextStep}`;
        }
      }
      else if (decision.action === 'list_dir') {
        const target = decision.params?.path || '.';
        const depth = typeof decision.params?.depth === 'number' ? decision.params.depth : 3;

        if (lastListSignature === `${target}:${depth}`) {
          console.log(`🛑 Loop detected on list_dir: ${target}`);
          toolFeedback = `⚠️ NOTICE: You already received the directory listing for "${target}" in the previous turn. Proceed directly with "read_files" or "finish".`;
        } else {
          lastListSignature = `${target}:${depth}`;
          console.log(`📂 Listing directory: ${target}`);
          this.emit('agent_status', { text: this.L().statusListingDir(target) });
          const listResult = await this.tools.listDirectory(target, depth);
          this.emit('agent_message', {
            role: 'agent',
            text: `**${this.L().listedDir}** \`${listResult.path}\``,
            thought: fullThought,
            action: 'list_dir'
          });
          toolFeedback = `TOOL RESULT:\n\`\`\`\n${listResult.tree}\n\`\`\``;
        }
      }
      else if (decision.action === 'continue_reading') {
        if (Array.isArray(this.readResume) && this.readResume.length > 0) {
          const files = this.readResume.map(r => r.path);
          const ranges = {};
          for (const r of this.readResume) {
            if (r.startLine >= 1) ranges[r.path] = { start_line: r.startLine, end_line: r.endLine };
          }
          const chunks = await this.tools.prepareFileChunks(files, ranges, 1000);
          const chunk = chunks[0];
          this.readResume = chunk.hasMore ? chunk.remaining : null;
          lastReadSignature = null;
          loopRepeatCount = 0;
          this.emit('agent_message', {
            role: 'agent',
            text: `**${L.readFiles}**\n${windowSummary(chunk)}`,
            thought: fullThought,
            action: 'continue_reading',
            files
          });
          this.readsDelivered++;
          toolFeedback = chunk.formattedMessage;
        } else {
          toolFeedback = 'All requested file content has already been delivered completely. Proceed with "patch_file" / "search_code" / "finish".';
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
          const retryMsg =
            `Your previous patch_file JSON could not be parsed. Re-send the SAME patches inside ONE valid \`\`\`json block (escape newlines as \\n and quotes as \\").\n` +
            (this.taskIsChange ? taskReminderBlock(this.activeTask) : '');
          this.emit('agent_status', { text: this.L().statusMalformedRetry });
          lastSentMessage = retryMsg;
          await this.driver.sendMessage(retryMsg, { provider: options.provider, lang: this.lang });
          continue;
        }

        const isAutoApply = Boolean(options.autoApplyPatch);

        if (!isAutoApply && patchesList.length > 0) {
          const firstPatch = patchesList[0];
          this.emit('agent_status', { text: this.L().statusWaitPatch(firstPatch.file) });

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
            toolFeedback = 'TOOL RESULT: The user REJECTED this patch. Explain alternatives or call "finish".';
            this.emit('agent_message', {
              role: 'agent',
              text: L.rejected(firstPatch.file),
              thought: fullThought,
              action: 'patch_file'
            });
            lastSentMessage = toolFeedback;
            await this.driver.sendMessage(toolFeedback, { provider: options.provider, lang: this.lang });
            continue;
          }
        }

        this.emit('agent_status', { text: this.L().statusApplyingPatches(patchesList.length) });
        patchResult = await this.tools.patchBatch(patchesList);
        if (patchResult && patchResult.successful > 0) this.mutationsApplied += patchResult.successful;

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
          text: fullThought || this.L().creatingFileMsg(file),
          thought: fullThought,
          action: 'create_file',
          file
        });
        this.emit('agent_status', { text: this.L().statusCreatingFile(file) });
        const createResult = await this.tools.createFile(file, content);
        if (createResult && createResult.success) this.mutationsApplied++;

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
            this.emit('agent_status', { text: this.L().statusWaitCmd });
            this.emit('command_proposed', { command });

            const approved = await new Promise(resolve => {
              this.commandResolver = resolve;
            });

            if (!approved) {
              toolFeedback = `TOOL RESULT: The user REJECTED this command: "${command}". Propose an alternative or finish.`;
              this.emit('agent_message', {
                role: 'agent',
                text: this.L().cmdRejected(command),
                thought: fullThought,
                action: 'execute_command',
                command
              });
              lastSentMessage = toolFeedback;
              await this.driver.sendMessage(toolFeedback, { provider: options.provider, lang: this.lang });
              continue;
            }
          }

          this.emit('agent_message', {
            role: 'agent',
            text: fullThought || this.L().execCmdMsg(command),
            thought: fullThought,
            action: 'execute_command',
            command
          });
          this.emit('agent_status', { text: this.L().statusExecCmd(command) });
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
          this.emit('agent_status', { text: this.L().statusBrowsing(target) });
          const res = await this.browser.navigate(target);
          this.emit('agent_message', {
            role: 'agent',
            text: `**${this.L().browsed}** \`${res.title}\` (${res.url})`,
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
            text: `**${this.L().readPage}** \`${res.title}\` (${L.linesRange(start, Math.min(end, res.totalLines))})`,
            thought: fullThought,
            action: 'read_page'
          });
          const body = res.lines.map(l => `${l.lineNum} | ${l.text}`).join('\n');
          toolFeedback = `TOOL RESULT: CURRENT EMBEDDED BROWSER PAGE\nTITLE: ${res.title}\nURL: ${res.url}\nTOTAL LINES: ${res.totalLines}\nSHOWING ${start}-${Math.min(end, res.totalLines)}:\n${body || '(empty page)'}`;
        }
      }
      else {
        toolFeedback = `Unknown action: "${decision.action}". Choose one of: "read_files", "read_file", "continue_reading", "search_code", "list_dir", "patch_file", "create_file", "execute_command", "browse_web", "read_page", "finish".`;
      }

      if (this.isStopped) break;

      await this.randomDelay(3000, 7000, 'Pacing');
      if (this.isStopped) break;

      toolFeedback += `\n\nReply ONLY with ONE \`\`\`json block (next action or "finish" with Markdown "summary").`;
      if (this.taskIsChange && this.mutationsApplied === 0) {
        toolFeedback += taskReminderBlock(this.activeTask);
      }

      if (toolFeedback.length > 60000) {
        toolFeedback = toolFeedback.slice(0, 35000) +
          '\n... [TRUNCATED FOR CONTEXT LIMIT] ...\n' +
          toolFeedback.slice(-20000);
      }

      console.log(`📤 Sending results back to ${P}...`);
      this.emit('agent_status', { text: this.L().statusSendingResults(P) });
      lastSentMessage = toolFeedback;
      await this.driver.sendMessage(toolFeedback, { provider: options.provider, lang: this.lang });
    }

    if (this.driver) this.driver._onCaptcha = null;

    if (this.isStopped) {
      this.emit('task_stopped', { message: this.L().statusStopped });
    }
  }
}

module.exports = CodingAgent;
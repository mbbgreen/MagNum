<div align="center">

  <img src="MagNum/public/logo.png" alt="MagNum Logo" width="96" height="96" />

  <h1>MagNum</h1>
  <p><strong>Autonomous Software Engineering Workspace & AI Coding Agent</strong></p>

  <p>
    <a href="https://github.com/mbbgreen/magnum/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-emerald.svg" alt="License: MIT"></a>
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-24C8DB?logo=tauri&logoColor=white" alt="Tauri v2"></a>
    <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=black" alt="Rust"></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="#"><img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white" alt="Platform: Windows"></a>
  </p>

  <p>
    MagNum is a high-performance, local-first autonomous software engineering workspace built with Tauri v2, Rust, and React. It pairs directly with DeepSeek and Google AI Studio (Gemini) through secure, client-side stealth browser automation — no cloud relays, no subscription markups.
  </p>
</div>

---

## <img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Interface Preview

<div align="center">
  <img src="docs/screenshots/preview-1.png" alt="MagNum Workspace" width="100%" style="border-radius: 8px; margin-bottom: 12px;" />
  <p><em>Autonomous Agent Workspace & Embedded Browser Inspection</em></p>

  <br />

  <img src="docs/screenshots/preview-2.png" alt="MagNum Terminal and Diff Inspector" width="100%" style="border-radius: 8px;" />
  <p><em>Interactive PowerShell Terminal & Visual Hunk Diff Inspector</em></p>
</div>

---

## <img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Features

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Autonomous Multi-Turn Agent Loop:** Inspects directories, reads files (up to 5,000 lines/chunk), runs code grep, creates files, executes shell commands, and generates smart surgical multi-file patches.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Multi-Model Provider Dock:** Seamlessly toggle between **DeepSeek** (with DeepThink reasoning) and **Google Gemini** (via Google AI Studio with adjustable Low/Medium/High thinking levels).

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Built-in Engineering Skills:** Instant workflow specialization with dedicated skills including `/plan`, `/debug`, `/multitask`, and `/ask`.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Advanced Workspace Inspector:**
- **Changes Tab:** Visual unified diff viewer with hunk folding, line-by-line inspection, and atomic single-click file revert.
- **Live Terminal:** Real-time integrated PowerShell with inline prompt tracking, shell restarts, and Ctrl+C interrupt support.
- **Native In-App Webview:** Embedded Chromium browser with live text-reading and search grounding via dynamic CDP bridging.
- **File Explorer:** Workspace tree viewer with Monaco Editor syntax highlighting.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Safety & Human-in-the-Loop:** Toggleable approval gates for patch application and shell command execution.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Local-First & Privacy-Centered:**
- All chats and diffs persist in local **SQLite** (`magnum.db` with WAL mode).
- Inter-process communication uses a cryptographically generated 64-character token via authenticated local WebSockets (`localhost:5454`).
- Browser sessions and login cookies stay strictly on your local disk (`AppData/Local/MagNum`).

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> **Tailored Interface & Localization:** Modern dark and light workspaces, F11 fullscreen workflow, and native English and Persian (RTL) localization.

---

## <img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> System Architecture

MagNum uses a 3-tier hybrid architecture combining native performance, OS integration, and fast web technologies:

+-------------------------------------------------------------+
|                        MagNum Desktop UI                    |
|      React 18 + TypeScript + Vite + Tailwind/Custom CSS     |
|      (Monaco Editor, Visual Diff Viewer, Lucide)            |
+------------------------------+------------------------------+
                               | Tauri IPC / Events
+------------------------------v------------------------------+
|                      Rust Core (src-tauri)                  |
|  - Windows Job Object (auto-termination of child procs)     |
|  - Dynamic CDP Remote Debugging allocation                  |
|  - Single Instance Guard & Native Window Decorations        |
|  - Secure .ws-token reader & Updater Gate                   |
+------------------------------+------------------------------+
                               | Auth WS (localhost:5454)
+------------------------------v------------------------------+
|                  Node.js Backend Engine Daemon              |
|  - CodingAgent (tool calling, loop controller)              |
|  - ProjectTools (AST-free resilient fuzzy patch engine)     |
|  - Drivers (DeepSeek Stealth Driver & Gemini Driver)        |
|  - Storage (SQLite Sync Database via WAL mode)              |
+-------------------------------------------------------------+

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Repository Structure
Text

├── MagNum/                      # Main desktop application
│   ├── src/                     # React frontend (Components, Hooks, i18n, Styles)
│   ├── src-tauri/               # Rust source code, capabilities & Tauri config
│   │   └── resources/backend/   # Node.js Agent Engine (server.js, tools, drivers)
│   └── vite.config.ts
├── installer/                   # Standalone installer application (Tauri)
│   ├── src/                     # Installer setup UI (React)
│   └── src-tauri/               # Rust installer logic & payload extractor
├── build-setup.js               # Unified pipeline builder (App -> Payload -> Setup.exe)
├── download-fonts.js            # Self-hosted offline font bundle fetcher
└── LICENSE                      # MIT Open Source License

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Getting Started
Prerequisites

    Node.js: v20.x or v22.x+ (Recommended: Node 22+ with native node:sqlite).

    Rust & Cargo: Stable toolchain (rustup default stable).

    C++ Build Tools: Visual Studio C++ Build Tools installed on Windows.

    Google Chrome or Microsoft Edge installed.

1. Clone & Install Dependencies
Bash

git clone https://github.com/mbbgreen/magnum.git
cd magnum

# Install frontend dependencies
cd MagNum
npm install

# Install installer dependencies
cd ../installer
npm install
cd ..

2. Download Offline Fonts (First-time setup)

MagNum bundles its fonts offline (JetBrains Mono, Plus Jakarta Sans, Vazirmatn) to ensure no remote telemetry calls:
Bash

node download-fonts.js

3. Running in Development Mode

Run the main application with live hot-reloading:
Bash

cd MagNum
npm run tauri dev

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Building Production Release

MagNum provides an automated pipeline in build-setup.js that:

    Builds the core React frontend and compiles the Rust binary.

    Stages the backend engine and packages it into an internal payload.

    Compiles the custom standalone installer (MagNum-Setup.exe).

Bash

# From the repository root:
node build-setup.js

The resulting standalone setup executable will be generated at:
Text

installer/src-tauri/target/release/MagNum-Setup.exe

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Privacy, Security & Architecture Disclosure

MagNum was engineered specifically for developers who want the power of state-of-the-art reasoning models directly applied to their local codebases without paying subscription markups or sending source code to untrusted cloud relay servers:

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> Zero Cloud Proxies: All prompts, file contents, diffs, and terminal outputs stay strictly between your computer and the official provider endpoint you choose.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> Local Browser Automation: MagNum does not ask you to paste API keys into third-party servers. It drives a local, stealth-configured Chromium instance linked directly to your authenticated session.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> WebSocket Protection (CSWSH Defense): The internal communication port rejects any request whose origin is not in the whitelist and requires a single-use 64-character cryptographic token (.ws-token) generated upon every boot.

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="11" height="11" /> Non-Destructive Git-Free Revert: Every code modification generates a forward and backward diff saved inside edits.db. You can revert any agent action at any time even in folders without a Git repository.
Why Local Automation?

MagNum intentionally avoids routing code through third-party relay services. The agent engine runs entirely on your machine and only communicates with the model provider you explicitly select. This design minimizes the attack surface, removes intermediary data exposure, and keeps every artifact (chats, diffs, cookies) within your OS user profile.
<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

    Fork the Project

    Create your Feature Branch (git checkout -b feature/AmazingFeature)

    Commit your Changes (git commit -m 'Add some AmazingFeature')

    Push to the Branch (git push origin feature/AmazingFeature)

    Open a Pull Request

<img src="https://api.iconify.design/octicon:dot-fill-16.svg?color=%2310b981" width="14" height="14" /> License

Distributed under the MIT License. See the LICENSE file for more information.
<div align="center">
<sub>Engineered by <strong>Nethers Games</strong> &copy; 2026. All rights reserved.</sub>
</div>

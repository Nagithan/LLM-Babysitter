# LLM Babysitter 👶

<div align="center">
  <img src="resources/icon.png" width="128" alt="LLM Babysitter Logo">
  <p align="center">
    <b>Babysit your AI-IDE with help from web-based LLMs.</b>
    <br />
    Stop copy-pasting dozens of files manually.
  </p>
</div>

**LLM Babysitter** is a VS Code / Google Antigravity extension that helps you copy-paste structured prompts for web-based LLMs, with pre-prompt, instructions and files context.

[![VS Code Version](https://img.shields.io/visual-studio-marketplace/v/nagithan.llm-babysitter?label=VS%20Code&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nagithan.llm-babysitter)
[![Open VSX Version](https://img.shields.io/open-vsx/v/nagithan/llm-babysitter?label=Open%20VSX&style=flat-square)](https://open-vsx.org/extension/nagithan/llm-babysitter)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/nagithan.llm-babysitter?label=Downloads&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=nagithan.llm-babysitter)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Nagithan/LLM-Babysitter/release.yml?label=Build&style=flat-square)](https://github.com/Nagithan/LLM-Babysitter/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 📖 Table of Contents
- [✨ Features](#-features)
- [🔧 How to Install](#-how-to-install)
- [🚀 How to Use](#-how-to-use-llm-babysitter)
- [🛡️ Privacy & Performance](#️-privacy--performance)

---

## ✨ Features

### 👶 Babysit your AI-IDE
- **Your IDE is whining about reached quota?** Use the cheap model and feed it a full, structured meal of code.
- **You're tired of paying for API calls ?** Use a web-based LLM to babysit your limited model.
- **Total Flexibility**: Use the web-based model you want (Gemini Pro, GPT, Claude, etc.)

### 📋 Structured Prompt Generation
- **Preprompt**: e.g., "You are a Senior Software Engineer..."
- **Instruction**: Define the task (e.g., "Audit this code for security vulnerabilities...")
- **File Context**: Select files of your project to include in the prompt.
- **Final Logic**: Instructions to ensure the web-based LLM output is ready to be pasted into your AI-IDE.

### 🧠 Prompt Templates
Get the best results from LLMs with curated templates:
- **Bug audit**: Audit your code for bugs.
- **Bug follow up**: Is the bug resolved ? Any regression ?
- **Create tests**: Create tests for your code.
 Or create your own instructions ! You can save them for later use.

### ⚡ Explorer
- Navigate your project with a searchable tree view. 
- Select files to copy to the clipboard.

### 📊 Real-time Token Metrics
- Token counting with color-coding helps you stay within your model's context limits.

---

## 🔧 How to install

### 🛒 From the Marketplaces (Recommended)
The easiest way to install **LLM Babysitter** is directly from the extension tab in VS Code or Google Antigravity:
- Navigate to the extensions tab (Ctrl+Shift+X or Cmd+Shift+X).
- Search for "LLM Babysitter".
- Click "Install" and enjoy!

The extension is available on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nagithan.llm-babysitter) and [Open VSX Registry](https://open-vsx.org/extension/nagithan/llm-babysitter).

### 📦 Installation from .vsix file
1. Download the latest .vsix file from the [releases](https://github.com/Nagithan/LLM-Babysitter/releases) page.
2. Open VS Code (or Google Antigravity).
3. Navigate to the extensions tab (Ctrl+Shift+X or Cmd+Shift+X).
4. Click on the "..." button in the top-right corner of the extensions panel.
5. Select "Install from VSIX..." from the dropdown menu.
6. Navigate to the downloaded .vsix file and select it.
7. Click "Install".

### 🛠️ (Hard Mode) Installation from source code
1. Clone the repository and open the folder in VS Code.
2. Run `npm install` to install dependencies.
3. Run `npm run package` to create a .vsix file.
4. Follow the installation steps above to install the .vsix file.

## 🚀 How to use LLM Babysitter

1. **Install LLM Babysitter** (see above).
2. **Open the LLM Babysitter tab** by clicking on the baby icon in the Activity Bar (the left sidebar).
3. **Choose a template** (e.g., "Bug audit") or write your own instructions.
4. **Select files** you want to add to the prompt.
5. **Click Copy and paste** 
6. Go to your web version of your favorite LLM and paste the prompt !
7. With the default `Final instructions`, the web based LLM will generate a prompt ready to be pasted into an AI assistant IDE (Antigravity, Copilot, etc).

---

## 🛡️ Privacy & Performance

- **🔒 Local Only**: Everything happens locally on your machine.
- **👁️ Read Only**: The extension does not modify your files.
- **🚫 No Telemetry**: It does not collect any data.
- **⚡ Efficient**: Optimized for large projects and complex file structures.
- **📦 Lightweight**: No external dependencies required.

---

### ⚙️ Exclude Settings
Exclude files from the babysitter explorer via right click on the file in the explorer or via `settings.json`:

| Setting | Type | Default | Description |
|:---|:---|:---|:---|
| `llm-babysitter.excludePatterns` | `array` | `[...]` | Glob patterns to exclude (e.g., `**/node_modules/**`). |

---

<p align="center">
  If you find this tool useful, please leave a ⭐ on <a href="https://github.com/Nagithan/LLM-Babysitter">GitHub</a>!
</p>
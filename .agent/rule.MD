# Agent System Rules
We keep all important docs in .agent folder and keep updating them
We should always update .agent docs after we implement certain feature, to make sure it fully reflect the up to date information (mark the related files as you do this)
Before you plan any implementation, always read the .agent/README.md first to get context
IMPORTANT: DO NOT create summary docs after implementation unless you are asked to do so explicitly. Conclude everything within the initial task doc assigned.

## Folder Structure

### `/SOP` - Standard Operating Procedures
Process documentation, common mistakes, and workflow guidelines. Read when you need to understand how to execute recurring tasks or avoid known pitfalls.

### `/system` - Technical Architecture
Project structure, database schemas, API contracts, tech stack details. Read when you need to understand how the codebase is organized or make architectural decisions.

### `/task` - Feature Implementation Tracking
Each task gets ONE file that tracks: requirements, plan, progress, and completion notes. Create new files for new features, update existing ones as you work.

## Task File Convention
- Filename: `FEATURE_NAME.md` (e.g., `VIDEO_UPLOAD.md`, `TIKTOK_INTEGRATION.md`)
- Content: Requirements → Plan → Implementation Log → Completion Status
- Update the same file throughout the feature lifecycle
- Archive completed tasks by prefixing with `DONE_`




Architecture rule
## 1. Core Philosophy

AI must generate and manage codebases with the discipline of a senior software engineer.  
Every file has a **clear responsibility**, every folder has a **logical role**, and dependencies must flow **one-way** — from higher-level interfaces to lower-level logic.

Never output large, unstructured single files. Always design, split, and place code within an **organized architecture**.

---

## 2. Folder Structure Blueprint

All projects should roughly follow this base layout:

/src
/core → domain logic, data models, and pure utilities
/services → business logic combining core modules
/adapters → external integrations (API, database, SDKs)
/ui → presentation layer (frontend, CLI, or API routes)
/config → constants, environment setup, runtime config
/tests → testing files mirroring the /src structure

markdown
Copy code

- `/core` = heart of the app (no external dependencies)
- `/services` = orchestration layer
- `/adapters` = bridges to external systems
- `/ui` = everything user-facing
- `/config` = global constants and settings
- `/tests` = mirrors logic, ensures testability

If the project grows beyond 7–10 files in one directory, create subfolders by **domain**, not by technical type:
/features
/auth
authService.ts
loginRoute.ts
authModel.ts
/product
productService.ts
productModel.ts

yaml
Copy code

---

## 3. File Design & Size Rules

- **Single Responsibility**: each file implements one logical concern.
- **Keep it small**:
  - ≤ 300 lines preferred.
  - ≤ 8 functions or 2–3 classes.
- If a file grows too big or handles multiple domains, split it immediately into smaller files.
- Avoid “mega files” or dumping full feature logic into one file.

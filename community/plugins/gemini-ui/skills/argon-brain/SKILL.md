---
name: argon-brain
description: Query Gemini 4 Argon as an external deep-reasoning brain, architecture consultant, or debugging specialist via the local CLI Proxy and Gemini-FastAPI daemon. Use whenever a normal model or subagent needs top-tier reasoning, second-opinion verification, or difficult problem-solving.
---

# Argon Brain Skill

This skill allows any model, subagent, or automation in Antigravity to consult **Gemini 4 Argon** directly as a high-IQ reasoning engine.

## When to Use
- **Deep architectural planning**: Evaluating complex design trade-offs, concurrency models, or database schemas.
- **Root-cause debugging**: Investigating obscure race conditions, memory leaks, or elusive logic bugs.
- **Second opinion / Verification**: Having Argon review a plan or diff before applying large refactors.
- **Complex mathematical / algorithmic problems**: Solving tricky graph problems, parsing, or compiler optimization logic.

## How to Query Argon

Use the bundled executable script `scripts/ask_argon.py`:

```bash
# 1. Direct prompt
python3 scripts/ask_argon.py "What are the trade-offs of MVCC vs 2PL in distributed databases?"

# 2. Attach a file as reference context
python3 scripts/ask_argon.py -f "src/core/engine.ts" "Audit this file for race conditions and suggest optimizations."

# 3. Supply a system persona
python3 scripts/ask_argon.py -s "You are a senior security auditor" -f "auth.py" "Check this authentication flow for token forgery risks."

# 4. Pipe text or git diff from stdin
git diff main | python3 scripts/ask_argon.py "Review this diff and spot potential edge-case bugs."
```

## Service Requirements
The script queries:
- **Primary**: CLI Proxy at `http://127.0.0.1:8317/v1beta/models/gemini-4-argon:generateContent`
- **Automatic Fallback**: Gemini-FastAPI daemon at `http://127.0.0.1:8000/v1/chat/completions`

Both are automatically monitored and kept warm by the local Gemini Web UI daemon.

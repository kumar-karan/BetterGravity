#!/usr/bin/env python3
"""
ask_argon.py - Consult Gemini 4 Argon as an external deep-reasoning brain.

Queries Gemini 4 Argon via the local CLI Proxy or Gemini-FastAPI daemon.
Zero third-party dependencies (uses standard library urllib).
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_CPA_ENDPOINT = "http://127.0.0.1:8317/v1beta/models/gemini-4-argon:generateContent"
DEFAULT_FASTAPI_ENDPOINT = "http://127.0.0.1:8000/v1/chat/completions"
DEFAULT_API_KEY = "123456"


def query_cpa(prompt: str, system: str = "", context: str = "", key: str = DEFAULT_API_KEY, timeout: int = 120) -> str:
    parts = []
    if system:
        parts.append({"text": f"[SYSTEM INSTRUCTIONS]\n{system}\n"})
    if context:
        parts.append({"text": f"[REFERENCE CONTEXT / FILE DATA]\n{context}\n"})
    parts.append({"text": prompt})

    payload = {
        "contents": [{"parts": parts}]
    }

    req = urllib.request.Request(
        DEFAULT_CPA_ENDPOINT,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": key,
            "User-Agent": "ask-argon/1.0"
        },
        data=json.dumps(payload).encode("utf-8")
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError(f"No candidates returned: {data}")
        parts_out = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts_out)


def query_fastapi_fallback(prompt: str, system: str = "", context: str = "", timeout: int = 120) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    content = ""
    if context:
        content += f"[REFERENCE CONTEXT / FILE DATA]\n{context}\n\n"
    content += prompt
    messages.append({"role": "user", "content": content})

    payload = {
        "model": "gemini-4-argon",
        "messages": messages
    }

    req = urllib.request.Request(
        DEFAULT_FASTAPI_ENDPOINT,
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload).encode("utf-8")
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError(f"No choices returned: {data}")
        return choices[0].get("message", {}).get("content", "")


def main():
    parser = argparse.ArgumentParser(description="Query Gemini 4 Argon for high-IQ reasoning and analysis.")
    parser.add_argument("prompt", nargs="?", default="", help="Prompt / question for Argon (or pass via stdin)")
    parser.add_argument("-s", "--system", default="", help="Optional system prompt or persona instructions")
    parser.add_argument("-f", "--file", help="Path to file to attach as context")
    parser.add_argument("-k", "--key", default=DEFAULT_API_KEY, help="API key for CLI Proxy (default: 123456)")
    parser.add_argument("-t", "--timeout", type=int, default=120, help="Request timeout in seconds (default: 120)")

    args = parser.parse_args()

    prompt = args.prompt
    if not prompt and not sys.stdin.isatty():
        prompt = sys.stdin.read().strip()

    if not prompt:
        parser.print_help()
        sys.exit(1)

    context = ""
    if args.file:
        if os.path.isfile(args.file):
            with open(args.file, "r", encoding="utf-8", errors="replace") as f:
                context = f.read()
        else:
            sys.stderr.write(f"Warning: context file '{args.file}' not found.\n")

    try:
        # Try CPA first
        ans = query_cpa(prompt, system=args.system, context=context, key=args.key, timeout=args.timeout)
        print(ans.strip())
    except Exception as e_cpa:
        # Try FastAPI daemon directly as fallback
        try:
            ans = query_fastapi_fallback(prompt, system=args.system, context=context, timeout=args.timeout)
            print(ans.strip())
        except Exception as e_fa:
            sys.stderr.write(f"Error querying Gemini 4 Argon via CPA ({e_cpa}) and FastAPI fallback ({e_fa})\n")
            sys.exit(1)


if __name__ == "__main__":
    main()

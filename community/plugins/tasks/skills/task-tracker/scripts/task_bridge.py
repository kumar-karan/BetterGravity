#!/usr/bin/env python3
"""Deterministic CLI helper for managing BetterGravity TODOs and Tasks."""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_tasks_file(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", str(Path.home() / "AppData/Roaming")))
    elif sys.platform == "darwin":
        base = Path.home() / "Library/Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config")))
    return (base / "BetterGravity" / "tasks" / "tasks.json").resolve()


def load_store(file_path: Path) -> dict:
    if not file_path.is_file():
        return {"schemaVersion": 1, "tasks": [], "lastConversationId": None}
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"schemaVersion": 1, "tasks": [], "lastConversationId": None}
        if "tasks" not in data or not isinstance(data["tasks"], list):
            data["tasks"] = []
        return data
    except Exception:
        return {"schemaVersion": 1, "tasks": [], "lastConversationId": None}


def save_store(file_path: Path, store: dict) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = file_path.with_name(f"{file_path.name}.{os.getpid()}.tmp")
    text = json.dumps(store, indent=2) + "\n"
    temp_file.write_text(text, encoding="utf-8")
    temp_file.replace(file_path)


def list_tasks(file_path: Path, status_filter: str | None = None, priority_filter: str | None = None) -> list[dict]:
    store = load_store(file_path)
    tasks = store.get("tasks", [])
    if status_filter:
        tasks = [t for t in tasks if t.get("status") == status_filter]
    if priority_filter:
        tasks = [t for t in tasks if t.get("priority") == priority_filter]
    return tasks


def add_task(
    file_path: Path,
    title: str,
    description: str = "",
    priority: str = "p2",
    category: str = "General",
    due_date: str | None = None,
) -> dict:
    store = load_store(file_path)
    task_id = str(uuid.uuid4())[:8]
    task = {
        "id": task_id,
        "title": title.strip(),
        "description": description.strip(),
        "status": "todo",
        "priority": priority.lower(),
        "category": category.strip() or "General",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    }
    if due_date:
        task["dueDate"] = due_date
    store["tasks"].insert(0, task)
    save_store(file_path, store)
    return task


def update_task(
    file_path: Path,
    task_id: str,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    category: str | None = None,
) -> dict | None:
    store = load_store(file_path)
    target = None
    for task in store["tasks"]:
        if task.get("id") == task_id:
            target = task
            break
    if not target:
        return None

    if title is not None:
        target["title"] = title.strip()
    if description is not None:
        target["description"] = description.strip()
    if status is not None:
        target["status"] = status
        if status == "done":
            target["completedAt"] = now_iso()
        elif "completedAt" in target:
            del target["completedAt"]
    if priority is not None:
        target["priority"] = priority.lower()
    if category is not None:
        target["category"] = category.strip()
    target["updatedAt"] = now_iso()

    save_store(file_path, store)
    return target


def toggle_task(file_path: Path, task_id: str) -> dict | None:
    store = load_store(file_path)
    target = None
    for task in store["tasks"]:
        if task.get("id") == task_id:
            target = task
            break
    if not target:
        return None

    if target.get("status") == "done":
        target["status"] = "todo"
        target.pop("completedAt", None)
    else:
        target["status"] = "done"
        target["completedAt"] = now_iso()
    target["updatedAt"] = now_iso()

    save_store(file_path, store)
    return target


def delete_task(file_path: Path, task_id: str) -> bool:
    store = load_store(file_path)
    initial_len = len(store["tasks"])
    store["tasks"] = [t for t in store["tasks"] if t.get("id") != task_id]
    if len(store["tasks"]) != initial_len:
        save_store(file_path, store)
        return True
    return False


def clear_completed_tasks(file_path: Path) -> int:
    store = load_store(file_path)
    initial_len = len(store["tasks"])
    store["tasks"] = [t for t in store["tasks"] if t.get("status") not in ("done", "cancelled")]
    removed = initial_len - len(store["tasks"])
    if removed > 0:
        save_store(file_path, store)
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="Path to custom tasks.json")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # list
    list_cmd = subparsers.add_parser("list", help="List tasks")
    list_cmd.add_argument("--status", choices=["todo", "in_progress", "done", "cancelled"])
    list_cmd.add_argument("--priority", choices=["p0", "p1", "p2", "p3"])
    list_cmd.add_argument("--json", action="store_true", help="Output raw JSON")

    # add
    add_cmd = subparsers.add_parser("add", help="Add a new task")
    add_cmd.add_argument("--title", required=True)
    add_cmd.add_argument("--description", default="")
    add_cmd.add_argument("--priority", choices=["p0", "p1", "p2", "p3"], default="p2")
    add_cmd.add_argument("--category", default="General")
    add_cmd.add_argument("--due")

    # update
    up_cmd = subparsers.add_parser("update", help="Update an existing task")
    up_cmd.add_argument("--id", required=True)
    up_cmd.add_argument("--title")
    up_cmd.add_argument("--description")
    up_cmd.add_argument("--status", choices=["todo", "in_progress", "done", "cancelled"])
    up_cmd.add_argument("--priority", choices=["p0", "p1", "p2", "p3"])
    up_cmd.add_argument("--category")

    # toggle
    tog_cmd = subparsers.add_parser("toggle", help="Toggle task status")
    tog_cmd.add_argument("--id", required=True)

    # delete
    del_cmd = subparsers.add_parser("delete", help="Delete a task")
    del_cmd.add_argument("--id", required=True)

    # clear-completed
    subparsers.add_parser("clear-completed", help="Remove all completed tasks")

    args = parser.parse_args()
    tasks_file = default_tasks_file(args.file)

    if args.command == "list":
        tasks = list_tasks(tasks_file, args.status, args.priority)
        if args.json:
            print(json.dumps(tasks, indent=2))
        else:
            if not tasks:
                print("No tasks found.")
            for t in tasks:
                status_box = "[x]" if t.get("status") == "done" else "[ ]"
                p = t.get("priority", "p2").upper()
                print(f"{status_box} ({t['id']}) [{p}] {t['title']} ({t.get('category', 'General')})")

    elif args.command == "add":
        task = add_task(
            tasks_file,
            title=args.title,
            description=args.description,
            priority=args.priority,
            category=args.category,
            due_date=args.due,
        )
        print(json.dumps({"success": True, "task": task}, indent=2))

    elif args.command == "update":
        updated = update_task(
            tasks_file,
            task_id=args.id,
            title=args.title,
            description=args.description,
            status=args.status,
            priority=args.priority,
            category=args.category,
        )
        if updated:
            print(json.dumps({"success": True, "task": updated}, indent=2))
        else:
            sys.exit(f"Task with id {args.id} not found.")

    elif args.command == "toggle":
        toggled = toggle_task(tasks_file, args.id)
        if toggled:
            print(json.dumps({"success": True, "task": toggled}, indent=2))
        else:
            sys.exit(f"Task with id {args.id} not found.")

    elif args.command == "delete":
        ok = delete_task(tasks_file, args.id)
        print(json.dumps({"success": ok}, indent=2))

    elif args.command == "clear-completed":
        count = clear_completed_tasks(tasks_file)
        print(json.dumps({"success": True, "removedCount": count}, indent=2))


if __name__ == "__main__":
    main()

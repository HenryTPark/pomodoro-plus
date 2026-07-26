"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Tag, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MAX_TAG_LENGTH,
  normalizeTag,
  useSessionHistoryStore,
  useSettingsStore,
} from "@/store";
import { cn } from "@/lib/utils";

/** Distinct tags from history, most recent first; case-insensitive dedupe keeps first spelling. */
function getRecentTags(sessions: { tag: string | null }[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const session of sessions) {
    if (!session.tag) {
      continue;
    }

    const key = session.tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(session.tag);
  }

  return tags;
}

function resolveTag(value: string, recentTags: string[]): string | null {
  const normalized = normalizeTag(value);
  if (!normalized) {
    return null;
  }

  const match = recentTags.find(
    (tag) => tag.toLowerCase() === normalized.toLowerCase(),
  );
  return match ?? normalized;
}

type Option =
  | { kind: "clear" }
  | { kind: "tag"; value: string }
  | { kind: "create"; value: string };

export default function TagPicker() {
  const listboxId = useId();
  const activeTag = useSettingsStore((state) => state.activeTag);
  const setActiveTag = useSettingsStore((state) => state.setActiveTag);
  const sessions = useSessionHistoryStore((state) => state.sessions);

  const recentTags = useMemo(() => getRecentTags(sessions), [sessions]);

  const [draft, setDraft] = useState(activeTag ?? "");
  const [prevActiveTag, setPrevActiveTag] = useState(activeTag);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipBlurCommitRef = useRef(false);

  // Keep the input in sync when activeTag changes externally (e.g. profile hydrate).
  if (activeTag !== prevActiveTag) {
    setPrevActiveTag(activeTag);
    setDraft(activeTag ?? "");
  }

  const query = draft.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) {
      return recentTags;
    }

    return recentTags.filter((tag) => tag.toLowerCase().includes(query));
  }, [query, recentTags]);

  const exactMatch = recentTags.find((tag) => tag.toLowerCase() === query);
  const canCreate = Boolean(query) && !exactMatch;

  const options = useMemo<Option[]>(() => {
    const next: Option[] = [];

    if (activeTag !== null || draft.trim()) {
      next.push({ kind: "clear" });
    }

    for (const tag of suggestions) {
      next.push({ kind: "tag", value: tag });
    }

    if (canCreate) {
      next.push({ kind: "create", value: draft.trim() });
    }

    return next;
  }, [activeTag, canCreate, draft, suggestions]);

  const safeHighlight =
    options.length === 0
      ? 0
      : Math.min(highlightIndex, options.length - 1);

  function commit(value: string | null) {
    const next = value === null ? null : resolveTag(value, recentTags);
    setActiveTag(next);
    setDraft(next ?? "");
    setPrevActiveTag(next);
    setOpen(false);
  }

  function selectOption(option: Option) {
    if (option.kind === "clear") {
      commit(null);
      return;
    }

    commit(option.value);
  }

  function commitDraft() {
    commit(draft);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(0);
        return;
      }
      if (options.length === 0) {
        return;
      }
      setHighlightIndex((index) => (index + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlightIndex(0);
        return;
      }
      if (options.length === 0) {
        return;
      }
      setHighlightIndex(
        (index) => (index - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (open && options[safeHighlight]) {
        selectOption(options[safeHighlight]);
      } else {
        commitDraft();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(activeTag ?? "");
      setOpen(false);
    }
  }

  const showList = open && options.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-full py-2">
      <div className="relative">
        <Tag
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value.slice(0, MAX_TAG_LENGTH));
            setOpen(true);
            setHighlightIndex(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlightIndex(0);
          }}
          onBlur={() => {
            if (skipBlurCommitRef.current) {
              skipBlurCommitRef.current = false;
              return;
            }
            commitDraft();
          }}
          onKeyDown={onKeyDown}
          placeholder="No tag"
          maxLength={MAX_TAG_LENGTH}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Session tag"
          className={cn(
            "h-auto py-3 pl-9 text-lg md:text-lg",
            activeTag || draft.trim() ? "pr-10" : "pr-3",
          )}
        />
        {activeTag || draft.trim() ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Clear tag"
            aria-label="Clear tag"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            onMouseDown={(event) => {
              event.preventDefault();
              skipBlurCommitRef.current = true;
            }}
            onClick={() => commit(null)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {options.map((option, index) => {
            const selected =
              option.kind === "clear"
                ? activeTag === null
                : option.kind === "tag"
                  ? option.value === activeTag
                  : false;
            const highlighted = index === safeHighlight;
            const label =
              option.kind === "clear"
                ? "No tag"
                : option.kind === "create"
                  ? `Create “${option.value}”`
                  : option.value;

            return (
              <li
                key={
                  option.kind === "clear"
                    ? "clear"
                    : option.kind === "create"
                      ? `create:${option.value}`
                      : `tag:${option.value}`
                }
                role="option"
                aria-selected={highlighted}
                data-selected={selected || undefined}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-base",
                  highlighted
                    ? "bg-muted text-foreground"
                    : "text-foreground",
                  selected && !highlighted ? "text-muted-foreground" : null,
                )}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  skipBlurCommitRef.current = true;
                }}
                onClick={() => selectOption(option)}
              >
                {label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

import type { MemoryItem } from "./types";

export class MemoryDO {
  state: DurableObjectState;
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname.endsWith("/memory/list")) {
      const sessionId = url.searchParams.get("sessionId")!;
      const items: MemoryItem[] = (await this.storage.get<MemoryItem[]>(sessionId)) ?? [];
      return Response.json(items);
    }

    if (pathname.endsWith("/memory/add")) {
      const { sessionId, item } = await req.json();
      const list = (await this.storage.get<MemoryItem[]>(sessionId)) ?? [];
      const now = Date.now();
      const newItem: MemoryItem = {
        ...item,
        id: crypto.randomUUID(),
        sessionId,
        createdAt: now,
        updatedAt: now,
      };
      list.push(newItem);
      await this.storage.put(sessionId, dedupe(list));
      return Response.json(newItem, { status: 201 });
    }

    if (pathname.endsWith("/memory/upsert")) {
      const { sessionId, key, content, ttl } = await req.json();
      const list = (await this.storage.get<MemoryItem[]>(sessionId)) ?? [];
      const now = Date.now();

      const filtered = list.filter((m) => !m.ttl || m.createdAt + m.ttl > now);

      const existing = filtered.find((m) => m.key === key && normalize(m.content) === normalize(content));
      if (existing) {
        existing.updatedAt = now;
        existing.ttl = ttl ?? existing.ttl;
      } else {
        filtered.push({
          id: crypto.randomUUID(),
          sessionId,
          key,
          content,
          createdAt: now,
          updatedAt: now,
          ttl,
        });
      }

      await this.storage.put(sessionId, dedupe(filtered));
      const last = filtered[filtered.length - 1];
      return Response.json(existing ?? last, { status: 201 });
    }

    if (pathname.endsWith("/memory/search")) {
      const { sessionId, query, limit = 5 } = await req.json();
      const list = ((await this.storage.get<MemoryItem[]>(sessionId)) ?? []).filter((m) => {
        const now = Date.now();
        return !m.ttl || m.createdAt + m.ttl > now;
      });

      const q = normalize(query);
      const scored = list
        .map((m) => ({ m, score: score(q, m) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.m);

      return Response.json(scored);
    }

    return new Response("Not found", { status: 404 });
  }
}

function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
}

function priority(key: string): number {
  switch (key) {
    case "name": return 10;
    case "preference": return 6;
    case "fact": return 4;
    default: return 2;
  }
}

function score(q: string, item: MemoryItem): number {
  const text = normalize(item.content);
  if (!q || !text) return 0;
  let s = 0;
  if (text.includes(q)) s += 5;
  if (q.includes(text)) s += 3;
  const qa = new Set(q.split(/\s+/));
  const ta = new Set(text.split(/\s+/));
  const overlap = [...qa].filter((w) => ta.has(w)).length;
  s += overlap;
  s += priority(item.key);
  return s;
}

function dedupe(list: MemoryItem[]): MemoryItem[] {
  const map = new Map<string, MemoryItem>();
  for (const m of list) {
    const k = `${m.key}:${normalize(m.content)}`;
    const prev = map.get(k);
    if (!prev || prev.updatedAt < m.updatedAt) map.set(k, m);
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
}
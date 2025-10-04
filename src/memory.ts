import type { MemoryItem } from "./types";

export class MemoryManager {
  private ns: any;

  constructor(ns: any) {
    this.ns = ns;
  }

  private stubFor(sessionId: string) {
    const id = this.ns.idFromName(`session:${sessionId}`);
    return this.ns.get(id);
  }

  async add(sessionId: string, item: Omit<MemoryItem, "id" | "createdAt" | "updatedAt">): Promise<MemoryItem> {
    const stub = this.stubFor(sessionId);
    const res = await stub.fetch("https://do/memory/add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, item }),
    });
    if (!res.ok) throw new Error(`Memory add failed: ${res.status}`);
    return res.json();
  }

  async list(sessionId: string): Promise<MemoryItem[]> {
    const stub = this.stubFor(sessionId);
    const res = await stub.fetch(`https://do/memory/list?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`Memory list failed: ${res.status}`);
    return res.json();
  }

  async search(sessionId: string, query: string, limit = 5): Promise<MemoryItem[]> {
    const stub = this.stubFor(sessionId);
    const res = await stub.fetch(`https://do/memory/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, query, limit }),
    });
    if (!res.ok) throw new Error(`Memory search failed: ${res.status}`);
    return res.json();
  }

  async upsert(sessionId: string, key: string, content: string, ttl?: number): Promise<MemoryItem> {
    const stub = this.stubFor(sessionId);
    const res = await stub.fetch("https://do/memory/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, key, content, ttl }),
    });
    if (!res.ok) throw new Error(`Memory upsert failed: ${res.status}`);
    return res.json();
  }
}
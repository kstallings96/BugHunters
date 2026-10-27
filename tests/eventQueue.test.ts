import { describe, expect, it } from "vitest";
import { createEventQueue, type KeyValueStore, type Transport } from "@/lib/eventQueue";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function recorder(statuses: number[]) {
  const calls: { token: string; seqs: number[] }[] = [];
  const send: Transport = async (token, events) => {
    calls.push({ token, seqs: events.map((e) => e.seq) });
    return statuses.length ? statuses.shift()! : 200;
  };
  return { calls, send };
}

describe("event queue", () => {
  it("numbers events per session and sends them in order", async () => {
    const { calls, send } = recorder([]);
    const q = createEventQueue({ store: memoryStore(), send });
    q.register("s1", "tok1");
    q.append("s1", "meet", "step_enter");
    q.append("s1", "meet", "readaloud", { id: "x" });
    await q.flush();
    expect(calls).toEqual([{ token: "tok1", seqs: [1, 2] }]);
    expect(q.pending()).toBe(0);
  });

  it("keeps events when the network fails and resends them later", async () => {
    let t = 0;
    const { calls, send } = recorder([0]);
    const q = createEventQueue({ store: memoryStore(), send, now: () => t });
    q.register("s1", "tok1");
    q.append("s1", "meet", "step_enter");
    await q.flush();
    expect(q.pending()).toBe(1);
    await q.flush(); // still inside the backoff window
    expect(calls).toHaveLength(1);
    t = 60_000;
    await q.flush();
    expect(calls).toHaveLength(2);
    expect(q.pending()).toBe(0);
  });

  it("survives a reload: stored events and the seq counter come back", async () => {
    const store = memoryStore();
    const first = createEventQueue({ store, send: async () => 0 });
    first.register("s1", "tok1");
    first.append("s1", "meet", "step_enter");
    first.append("s1", "meet", "step_exit");

    const { calls, send } = recorder([]);
    const second = createEventQueue({ store, send });
    second.append("s1", "card", "step_enter");
    await second.flush();
    expect(calls).toEqual([{ token: "tok1", seqs: [1, 2, 3] }]);
  });

  it("sends large backlogs in batches", async () => {
    const { calls, send } = recorder([]);
    const q = createEventQueue({ store: memoryStore(), send, batchSize: 10 });
    q.register("s1", "tok1");
    for (let i = 0; i < 25; i++) q.append("s1", "hunt", "app_interaction");
    await q.flush();
    expect(calls.map((c) => c.seqs.length)).toEqual([10, 10, 5]);
  });

  it("sends a minute of play as one file by default, but keeps beacons small", async () => {
    const { calls, send } = recorder([]);
    const q = createEventQueue({ store: memoryStore(), send });
    q.register("s1", "tok1");
    for (let i = 0; i < 60; i++) q.append("s1", "machine", "input_submit");
    expect(q.beaconPayloads().map((p) => p.events.length)).toEqual([25, 25, 10]);
    await q.flush();
    expect(calls.map((c) => c.seqs.length)).toEqual([60]);
  });

  it("drops a malformed batch instead of retrying it forever", async () => {
    const { send } = recorder([400]);
    const q = createEventQueue({ store: memoryStore(), send });
    q.register("s1", "tok1");
    q.append("s1", "meet", "step_enter");
    await q.flush();
    expect(q.pending()).toBe(0);
  });

  it("stops sending a session whose token is rejected but keeps its events and other sessions", async () => {
    const { calls, send } = recorder([401]);
    const q = createEventQueue({ store: memoryStore(), send });
    q.register("bad", "tokB");
    q.register("good", "tokG");
    q.append("bad", "meet", "step_enter");
    q.append("good", "meet", "step_enter");
    await q.flush();
    await q.flush();
    expect(calls.map((c) => c.token)).toEqual(["tokB", "tokG"]);
    expect(q.pending()).toBe(1);
  });

  it("beacon payloads leave the queue intact and respect the size limit", () => {
    const q = createEventQueue({ store: memoryStore(), send: async () => 200, batchSize: 5 });
    q.register("s1", "tok1");
    for (let i = 0; i < 40; i++) q.append("s1", "hunt", "app_interaction", { feature: "answer_button" });
    const all = q.beaconPayloads(1_000_000);
    expect(all.flatMap((p) => p.events).length).toBe(40);
    const small = q.beaconPayloads(1000);
    expect(JSON.stringify(small).length).toBeLessThan(1100);
    expect(q.pending()).toBe(40);
  });

  it("never throws when storage is broken", async () => {
    const broken: KeyValueStore = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("quota");
      },
    };
    const { calls, send } = recorder([]);
    const q = createEventQueue({ store: broken, send });
    q.register("s1", "tok1");
    q.append("s1", "meet", "step_enter");
    await q.flush();
    expect(calls).toHaveLength(1);
  });
});

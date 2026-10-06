/**
 * Signaling relay for WebRTC P2P rooms, backed by the rtc_rooms / rtc_signals
 * tables (see migrations/0001_business.sql). Uses short polling so it runs on
 * serverless runtimes — no long-lived WebSocket.
 *
 * The client (src/lib/multiplayer/p2p.ts) talks to this through the /api/rtc
 * route. A single GET does double duty: it registers/refreshes this peer's
 * presence AND returns the roster plus signals newer than `since`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type SignalKind = "offer" | "answer" | "ice";

const ROOM_TTL_MS = 30 * 60 * 1000; // drop rooms idle for 30 minutes
const SIGNAL_TTL_MS = 5 * 60 * 1000; // only surface signals from last 5 minutes

function genRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const createRoomSchema = z.object({
  peerId: z.string().min(1).max(120),
  nickname: z.string().max(60).default(""),
});

export const createRoomFn = createServerFn({ method: "POST" })
  .inputValidator(createRoomSchema)
  .handler(async ({ data }): Promise<{ roomCode: string }> => {
    const sql = await getSql();
    const cutoff = new Date(Date.now() - ROOM_TTL_MS);
    await sql.query("delete from rtc_rooms where last_active_at < $1", [cutoff]);

    let roomCode = genRoomCode();
    for (let i = 0; i < 5; i++) {
      const existing = await sql.query<{ room_code: string }>(
        "select room_code from rtc_rooms where room_code = $1",
        [roomCode],
      );
      if (existing.length === 0) break;
      roomCode = genRoomCode();
    }
    const now = new Date();
    await sql.query(
      `insert into rtc_rooms (room_code, created_by, created_at, last_active_at)
       values ($1, $2, $3, $3)
       on conflict (room_code) do update set last_active_at = $3`,
      [roomCode, data.peerId, now],
    );
    return { roomCode };
  });

export const RtcPollSchema = z.object({
  room: z.string().min(1).max(60),
  peer: z.string().min(1).max(120),
  name: z.string().max(60).default(""),
  since: z.coerce.number().int().min(0).default(0),
});

export interface RtcSignalOut {
  id: number;
  from: string;
  kind: SignalKind;
  payload: Json;
}
export interface RtcPollOut {
  peers: { id: string; name: string }[];
  signals: RtcSignalOut[];
}

/**
 * GET: register/refresh this peer, return the roster and signals addressed to
 * me with id > since. Signals are marked consumed on delivery; the `since`
 * cursor lets the client dedupe.
 */
export const rtcPoll = createServerFn({ method: "GET" })
  .inputValidator(RtcPollSchema)
  .handler(async ({ data }): Promise<RtcPollOut> => {
    const sql = await getSql();
    const now = new Date();
    const signalCutoff = new Date(Date.now() - SIGNAL_TTL_MS);

    await sql.query(
      `insert into rtc_rooms (room_code, created_by, created_at, last_active_at)
       values ($1, $2, $3, $3)
       on conflict (room_code) do update set last_active_at = $3`,
      [data.room, data.peer, now],
    );

    // Roster = distinct peers seen around this room recently.
    const peerRows = await sql.query<{ peer: string }>(
      `select peer from (
          select created_by as peer from rtc_rooms where room_code = $1
          union select from_peer from rtc_signals
            where room_code = $1 and created_at > $2
          union select target_peer from rtc_signals
            where room_code = $1 and target_peer <> '*' and created_at > $2
        ) s where peer is not null and peer <> '' group by peer`,
      [data.room, signalCutoff],
    );
    const peers = peerRows.map((r) => ({
      id: r.peer,
      name: r.peer === data.peer ? data.name || r.peer : r.peer.slice(0, 12),
    }));

    const sigRows = await sql.query<{
      id: number;
      from_peer: string;
      kind: SignalKind;
      payload: Json;
    }>(
      `select id, from_peer, kind, payload from rtc_signals
        where room_code = $1
          and created_at > $2
          and id > $3
          and (target_peer = $4 or target_peer = '*')
          and from_peer <> $4
        order by id asc`,
      [data.room, signalCutoff, data.since, data.peer],
    );

    const ids = sigRows.map((r) => Number(r.id));
    if (ids.length) {
      await sql.query("update rtc_signals set consumed = true where id = any($1)", [ids]);
    }

    return {
      peers,
      signals: sigRows.map((r) => ({
        id: Number(r.id),
        from: r.from_peer,
        kind: r.kind,
        payload: r.payload,
      })),
    };
  });

export const RtcPostSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("signal"),
    room: z.string().min(1).max(60),
    from: z.string().min(1).max(120),
    to: z.string().max(120).default("*"),
    kind: z.enum(["offer", "answer", "ice"]),
    payload: z.any(),
  }),
  z.object({
    op: z.literal("leave"),
    room: z.string().min(1).max(60),
    peer: z.string().min(1).max(120),
  }),
]);

/** POST: relay a signal or remove a leaving peer from the roster. */
export const rtcPost = createServerFn({ method: "POST" })
  .inputValidator(RtcPostSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const now = new Date();
    if (data.op === "leave") {
      await sql.query(
        `delete from rtc_signals
          where room_code = $1 and (from_peer = $2 or target_peer = $2)`,
        [data.room, data.peer],
      );
      await sql.query("update rtc_rooms set last_active_at = $2 where room_code = $1", [
        data.room,
        now,
      ]);
      return { ok: true };
    }

    await sql.query(
      `insert into rtc_signals (room_code, from_peer, target_peer, kind, payload, consumed)
       values ($1, $2, $3, $4, $5::jsonb, false)`,
      [data.room, data.from, data.to, data.kind, JSON.stringify(data.payload)],
    );
    await sql.query("update rtc_rooms set last_active_at = $2 where room_code = $1", [
      data.room,
      now,
    ]);
    return { ok: true };
  });

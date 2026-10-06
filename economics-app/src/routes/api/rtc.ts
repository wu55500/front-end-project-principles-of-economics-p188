/**
 * Signaling relay endpoint for WebRTC P2P rooms.
 *
 *   GET  /api/rtc?room&peer&name&since  → register presence + roster + signals
 *   POST /api/rtc                        → { op: create | signal | leave, ... }
 *
 * This is a server route: its handlers run directly in the server runtime and
 * talk to the database themselves. They intentionally do NOT call the sibling
 * server functions (server fns are an RPC bridge for client use and cannot be
 * nested inside server route handlers).
 */
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

const ROOM_TTL_MS = 30 * 60 * 1000;
const SIGNAL_TTL_MS = 5 * 60 * 1000;
type SignalKind = "offer" | "answer" | "ice";

function genRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const Route = createFileRoute("/api/rtc")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const room = (url.searchParams.get("room") ?? "").trim();
        const peer = (url.searchParams.get("peer") ?? "").trim();
        const name = (url.searchParams.get("name") ?? "").trim();
        const since = Math.max(Number(url.searchParams.get("since") ?? 0) || 0, 0);
        if (!room || !peer || room.length > 60 || peer.length > 120) {
          return jsonRes({ error: "bad_request" }, 400);
        }

        const sql = await getSql();
        const now = new Date();
        const signalCutoff = new Date(Date.now() - SIGNAL_TTL_MS);

        await sql.query(
          `insert into rtc_rooms (room_code, created_by, created_at, last_active_at)
           values ($1, $2, $3, $3)
           on conflict (room_code) do update set last_active_at = $3`,
          [room, peer, now],
        );

        const peerRows = await sql.query<{ peer: string }>(
          `select peer from (
              select created_by as peer from rtc_rooms where room_code = $1
              union select from_peer from rtc_signals
                where room_code = $1 and created_at > $2
              union select target_peer from rtc_signals
                where room_code = $1 and target_peer <> '*' and created_at > $2
            ) s where peer is not null and peer <> '' group by peer`,
          [room, signalCutoff],
        );
        const peers = peerRows.map((r) => ({
          id: r.peer,
          name: r.peer === peer ? name || r.peer : r.peer.slice(0, 12),
        }));

        const sigRows = await sql.query<{
          id: number;
          from_peer: string;
          kind: SignalKind;
          payload: unknown;
        }>(
          `select id, from_peer, kind, payload from rtc_signals
            where room_code = $1
              and created_at > $2
              and id > $3
              and (target_peer = $4 or target_peer = '*')
              and from_peer <> $4
            order by id asc`,
          [room, signalCutoff, since, peer],
        );
        const ids = sigRows.map((r) => Number(r.id));
        if (ids.length) {
          await sql.query("update rtc_signals set consumed = true where id = any($1)", [ids]);
        }

        return jsonRes({
          peers,
          signals: sigRows.map((r) => ({
            id: Number(r.id),
            from: r.from_peer,
            kind: r.kind,
            payload: r.payload,
          })),
        });
      },

      POST: async ({ request }) => {
        let body: { [k: string]: unknown };
        try {
          body = (await request.json()) as { [k: string]: unknown };
        } catch {
          return jsonRes({ error: "invalid_json" }, 400);
        }
        const op = String(body.op ?? "");
        const sql = await getSql();
        const now = new Date();

        if (op === "create") {
          const peerId = String(body.peerId ?? "").trim();
          if (!peerId || peerId.length > 120) return jsonRes({ error: "bad_request" }, 400);

          await sql.query("delete from rtc_rooms where last_active_at < $1", [
            new Date(Date.now() - ROOM_TTL_MS),
          ]);
          let roomCode = genRoomCode();
          for (let i = 0; i < 5; i++) {
            const existing = await sql.query<{ room_code: string }>(
              "select room_code from rtc_rooms where room_code = $1",
              [roomCode],
            );
            if (existing.length === 0) break;
            roomCode = genRoomCode();
          }
          await sql.query(
            `insert into rtc_rooms (room_code, created_by, created_at, last_active_at)
             values ($1, $2, $3, $3)
             on conflict (room_code) do update set last_active_at = $3`,
            [roomCode, peerId, now],
          );
          return jsonRes({ roomCode });
        }

        if (op === "signal") {
          const room = String(body.room ?? "").trim();
          const from = String(body.from ?? "").trim();
          const to = String(body.to ?? "*").trim() || "*";
          const kind = body.kind as SignalKind;
          if (!room || !from || !["offer", "answer", "ice"].includes(kind)) {
            return jsonRes({ error: "bad_request" }, 400);
          }
          await sql.query(
            `insert into rtc_signals (room_code, from_peer, target_peer, kind, payload, consumed)
             values ($1, $2, $3, $4, $5::jsonb, false)`,
            [room, from, to, kind, JSON.stringify(body.payload ?? null)],
          );
          await sql.query("update rtc_rooms set last_active_at = $2 where room_code = $1", [
            room,
            now,
          ]);
          return jsonRes({ ok: true });
        }

        if (op === "leave") {
          const room = String(body.room ?? "").trim();
          const peer = String(body.peer ?? "").trim();
          if (!room || !peer) return jsonRes({ error: "bad_request" }, 400);
          await sql.query(
            `delete from rtc_signals
              where room_code = $1 and (from_peer = $2 or target_peer = $2)`,
            [room, peer],
          );
          await sql.query("update rtc_rooms set last_active_at = $2 where room_code = $1", [
            room,
            now,
          ]);
          return jsonRes({ ok: true });
        }

        return jsonRes({ error: "unknown_op" }, 400);
      },
    },
  },
});

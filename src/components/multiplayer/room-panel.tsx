/**
 * Multiplayer room panel. Two classmates share a 6-digit room code; once the
 * P2P mesh is up, whoever drags the t slider / switches policy broadcasts the
 * visualization state so both screens stay in sync (WebRTC datachannels, no
 * game data touches the server after signaling).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Copy, Check, LogOut, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { useViz } from "@/store/viz";

function PEER_KEY(): string {
  return "p188.peerId";
}

// Only runs in the browser after mount; sessionStorage does not exist during SSR.
function readPeerId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(PEER_KEY());
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(PEER_KEY(), id);
  }
  return id;
}

type SyncMsg =
  | { t: "state"; d: { t?: number; mode?: string; view?: string } }
  | { t: "ping" };

export function RoomPanel() {
  const [peerId, setPeerId] = useState("");
  useEffect(() => {
    setPeerId(readPeerId());
  }, []);
  const [room, setRoom] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [active, setActive] = useState(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const roomRef = useRef<P2PRoom | null>(null);

  const t = useViz((s) => s.t);
  const mode = useViz((s) => s.mode);
  const view = useViz((s) => s.view);
  const lastSent = useRef<string>("");

  // Broadcast local visualization changes to peers.
  useEffect(() => {
    if (!active || !roomRef.current) return;
    const sig = JSON.stringify({ t, mode, view });
    if (sig === lastSent.current) return; // ignore echoes of remote updates
    lastSent.current = sig;
    roomRef.current.broadcast({ t, mode, view });
  }, [t, mode, view, active]);

  useEffect(() => {
    return () => {
      roomRef.current?.close();
      roomRef.current = null;
    };
  }, []);

  const startIn = (code: string) => {
    const r = new P2PRoom({
      room: code,
      selfId: peerId,
      name: peerId,
      onPeersChanged: setPeers,
      onConnected: () => toast.success("已进入房间，正在连接同学…"),
      onMessage: (_from, data, channel) => {
        if (channel !== "state") return;
        const msg = data as SyncMsg;
        if (msg.t !== "state") return;
        const d = msg.d;
        // Mirror the incoming state into lastSent so the local-change effect
        // does not echo it straight back over the mesh.
        lastSent.current = JSON.stringify({
          t: d.t ?? useViz.getState().t,
          mode: d.mode ?? useViz.getState().mode,
          view: d.view ?? useViz.getState().view,
        });
        if (typeof d.t === "number") useViz.getState().setT(d.t, true);
        if (d.mode === "accept" || d.mode === "tariff") {
          useViz.getState().setMode(d.mode);
        }
        if (d.view === "bar" || d.view === "curve") {
          useViz.getState().setView(d.view);
        }
      },
    });
    roomRef.current = r;
    void r.join();
    setRoom(code);
    setActive(true);
  };

  const create = async () => {
    try {
      const res = await fetch("/api/rtc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "create", peerId, nickname: "" }),
      });
      if (!res.ok) throw new Error(`create failed ${res.status}`);
      const { roomCode } = (await res.json()) as { roomCode: string };
      startIn(roomCode);
    } catch (err) {
      toast.error("创建房间失败，请重试");
      console.warn(err);
    }
  };

  const join = () => {
    const code = joinCode.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error("请输入 6 位房间号");
      return;
    }
    startIn(code);
  };

  const leave = () => {
    roomRef.current?.close();
    roomRef.current = null;
    setActive(false);
    setRoom("");
    setPeers([]);
    toast("已离开房间");
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败，请手动选择");
    }
  };

  if (!active) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-fg">
          <Users className="size-4 text-muted" />
          <h3 className="font-display text-lg">同桌共学（P2P）</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          创建房间拿到 6 位号码，把号码发给同学；加入后两人拖动滑杆、切换政策，画面实时同步。连接走点对点加密通道，服务器只负责牵线。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={create}>
            <Radio className="size-4" />
            创建房间
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="输入 6 位房间号"
              className="h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-transparent px-3 text-sm tracking-[0.3em] outline-none placeholder:tracking-normal focus:border-accent"
            />
            <Button variant="outline" onClick={join}>
              加入
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const connected = peers.filter((p) => p.connectionState === "connected").length;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-gain" />
          </span>
          <div>
            <p className="text-xs text-dim">房间号</p>
            <p className="font-display text-xl tracking-[0.35em]">{room}</p>
          </div>
          <Button variant="ghost" size="iconSm" onClick={copyCode}>
            {copied ? <Check className="size-4 text-gain" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <Button variant="loss" size="sm" onClick={leave}>
          <LogOut className="size-4" />
          离开
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full border border-line px-3 py-1">
          已连接同学 {connected}
        </span>
        {peers.map((p) => (
          <span
            key={p.id}
            className="rounded-full border border-line px-3 py-1"
            data-state={p.connectionState}
          >
            {p.name} · {p.connectionState}
            {p.rttMs != null ? ` · ${p.rttMs}ms` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

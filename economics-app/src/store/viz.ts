import { create } from "zustand";
import { clamp, T_MAX, type ChartView, type Mode } from "@/lib/econ/model";

export type VizState = {
  t: number;
  mode: Mode;
  view: ChartView;
  flowPaused: boolean;
  flowEpoch: number;
  present: boolean;
  presentIdx: number;
  kbdOpen: boolean;
  labOpen: boolean;
  manualT: boolean;
  setT: (t: number, fromScroll?: boolean) => void;
  setMode: (mode: Mode) => void;
  setView: (view: ChartView) => void;
  setManualT: (v: boolean) => void;
  toggleFlowPause: (force?: boolean) => void;
  replayFlow: () => void;
  togglePresent: (force?: boolean) => void;
  setPresentIdx: (i: number) => void;
  toggleKbd: (force?: boolean) => void;
  toggleLab: (force?: boolean) => void;
  hydrateFromHash: () => void;
};

function writeHash(s: Pick<VizState, "t" | "mode" | "view">) {
  if (typeof window === "undefined") return;
  const parts = [`t=${s.t}`];
  if (s.mode !== "accept") parts.push(`mode=${s.mode}`);
  if (s.view !== "bar") parts.push(`view=${s.view}`);
  const next = `#${parts.join("&")}`;
  if (location.hash !== next) history.replaceState(null, "", next);
}

export const useViz = create<VizState>((set, get) => ({
  t: 20,
  mode: "accept",
  view: "bar",
  flowPaused: false,
  flowEpoch: 0,
  present: false,
  presentIdx: 0,
  kbdOpen: false,
  labOpen: false,
  manualT: false,
  setT: (t, fromScroll) => {
    const next = Math.round(clamp(t, 0, T_MAX));
    const cur = get();
    if (next === cur.t) return;
    const patch = { t: next, ...(fromScroll ? {} : { manualT: true }) };
    set(patch);
    writeHash({ ...cur, ...patch });
  },
  setMode: (mode) => {
    set({ mode });
    writeHash({ ...get(), mode });
  },
  setView: (view) => {
    set({ view });
    writeHash({ ...get(), view });
  },
  setManualT: (manualT) => set({ manualT }),
  toggleFlowPause: (force) =>
    set((s) => ({ flowPaused: force !== undefined ? force : !s.flowPaused })),
  replayFlow: () => set((s) => ({ flowEpoch: s.flowEpoch + 1, flowPaused: false })),
  togglePresent: (force) =>
    set((s) => ({
      present: force !== undefined ? force : !s.present,
      presentIdx: force === false ? s.presentIdx : s.presentIdx,
    })),
  setPresentIdx: (presentIdx) => set({ presentIdx }),
  toggleKbd: (force) =>
    set((s) => ({ kbdOpen: force !== undefined ? force : !s.kbdOpen })),
  toggleLab: (force) =>
    set((s) => ({ labOpen: force !== undefined ? force : !s.labOpen })),
  hydrateFromHash: () => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(location.hash.replace(/^#/, ""));
    const patch: Partial<VizState> = {};
    if (p.has("t")) patch.t = Math.round(clamp(Number(p.get("t")) || 0, 0, T_MAX));
    const mode = p.get("mode");
    if (mode === "accept" || mode === "tariff") patch.mode = mode;
    const view = p.get("view");
    if (view === "bar" || view === "curve") patch.view = view;
    if (Object.keys(patch).length) set(patch);
  },
}));

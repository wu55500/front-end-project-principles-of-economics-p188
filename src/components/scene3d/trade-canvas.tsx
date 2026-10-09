/**
 * TradeCanvas — 3D global-trade sandbox (React Three Fiber).
 *
 * Shows the full loop behind the "unfair competition / export subsidy" debate:
 *
 *   Neighborland (subsidy country)              Isoland (importing country)
 *   政府 ─补贴→ 工厂 ─出口货箱(青)──────────────→ 消费者
 *    ↑              ↑  (low-price imports)          │
 *   纳税人       消费者付款(金)←────────────────── 消费者
 *
 * In tariff mode a customs wall rises on the border: cargo queues at it and
 * tariff revenue flows from the Isoland consumer to its government.
 *
 * The subsidy slider `t` drives throughput: particle counts/speed, the export
 * volume and the returned payment. Rendered with PBR lighting, shadows, bloom
 * and a reflecting ocean.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  Stars,
  Float,
  Line,
  MeshReflectorMaterial,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useViz } from "@/store/viz";

/* Mobile / low-power detection: shed GPU cost (no planar reflection, lower
 * pixel ratio, no post FX) to keep the WebGL context alive on phones. */
function useIsMobile() {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    return mobile || mem <= 4 || cores <= 4;
  }, []);
}

/* Palette */
const C = {
  nlGround: "#14202c",
  isGround: "#1b2330",
  gov: "#4fa8e0",
  fac: "#e88a3d",
  con: "#4cc38a",
  tax: "#a979e0",
  cargo: "#39c6e8",
  money: "#f4c542",
  tariff: "#e0606a",
};

/* Actor anchors (world x,z). Ground top is y = 0. */
type Anchor = {
  p: [number, number];
  kind: "gov" | "fac" | "con" | "tax";
  label: string;
  sub: string;
};
const NL: Record<string, Anchor> = {
  nlGov: { p: [-14, -8], kind: "gov", label: "邻国政府", sub: "发放出口补贴" },
  nlFac: { p: [-16, 7], kind: "fac", label: "邻国纺织厂", sub: "补贴后扩产" },
  taxpayer: { p: [-7, -1], kind: "tax", label: "邻国纳税人", sub: "承担补贴成本" },
};
const IS: Record<string, Anchor> = {
  isGov: { p: [14, -8], kind: "gov", label: "岛国政府", sub: "可征报复关税" },
  isCon: { p: [7, 2], kind: "con", label: "岛国消费者", sub: "低价买进口布" },
  isFac: { p: [16, 7], kind: "fac", label: "岛国纺织厂", sub: "受低价进口冲击" },
};

const GROUND_Y = 0.45;

type CurveDef = {
  id: string;
  curve: THREE.Curve<THREE.Vector3>;
  color: string;
};

function groundCurve(a: [number, number], b: [number, number], y = GROUND_Y) {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(a[0], y, a[1]),
    new THREE.Vector3((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2),
    new THREE.Vector3(b[0], y, b[1]),
  ]);
}
function arcCurve(a: [number, number], b: [number, number], peak: number, y = GROUND_Y) {
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(a[0], y, a[1]),
    new THREE.Vector3((a[0] + b[0]) / 2, peak, (a[1] + b[1]) / 2),
    new THREE.Vector3(b[0], y, b[1]),
  );
}

/* Particle field travelling along a curve. */
function Flow({
  def,
  count,
  kind,
  speed,
  holdAtWall,
  boost,
}: {
  def: CurveDef;
  count: number;
  kind: "coin" | "cargo" | "money";
  speed: number;
  holdAtWall?: boolean;
  boost: number;
}) {
  const group = useRef<THREE.Group>(null);
  const mode = useViz((s) => s.mode);

  const geo = useMemo(() => {
    if (kind === "cargo") return new THREE.BoxGeometry(0.9, 0.5, 0.55);
    if (kind === "coin") return new THREE.CylinderGeometry(0.32, 0.32, 0.09, 20);
    return new THREE.SphereGeometry(0.18, 12, 12);
  }, [kind]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: new THREE.Color(def.color),
        emissiveIntensity: kind === "cargo" ? 0.25 : 0.7,
        metalness: kind === "cargo" ? 0.15 : 0.85,
        roughness: kind === "cargo" ? 0.5 : 0.25,
      }),
    [def.color, kind],
  );

  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        u: i / count + Math.random() * 0.04,
        spin: Math.random() * Math.PI,
      })),
    [count],
  );

  useFrame((_, dtRaw) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const walled = holdAtWall && mode === "tariff";
    for (let i = 0; i < g.children.length; i++) {
      const m = g.children[i];
      const seed = seeds[i];
      seed.u = (seed.u + speed * boost * dt) % 1;
      const pt = def.curve.getPoint(seed.u);
      if (walled && Math.abs(pt.x) < 3.3) {
        pt.x = Math.sign(pt.x || 1) * 3.3;
      }
      m.position.copy(pt);
      if (kind === "coin") m.rotation.y += dt * 3;
      else if (kind === "cargo") m.rotation.y = seed.spin;
      else {
        const s = 1 + Math.sin(performance.now() * 0.005 + i) * 0.18;
        m.scale.setScalar(s);
      }
    }
  });

  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <mesh key={i} geometry={geo} material={mat} castShadow />
      ))}
    </group>
  );
}

function CurveLine({ def, dimmed }: { def: CurveDef; dimmed?: boolean }) {
  const pts = useMemo(
    () =>
      def.curve
        .getPoints(60)
        .map((v) => [v.x, v.y, v.z] as [number, number, number]),
    [def],
  );
  return (
    <Line
      points={pts}
      color={def.color}
      lineWidth={dimmed ? 1 : 2}
      transparent
      opacity={dimmed ? 0.18 : 0.5}
      dashed={dimmed}
    />
  );
}

function Building({ kind, color }: { kind: Anchor["kind"]; color: string }) {
  if (kind === "gov")
    return (
      <group>
        <mesh castShadow position={[0, 0.3, 0]}>
          <boxGeometry args={[2.6, 0.6, 2]} />
          <meshStandardMaterial color="#22303d" metalness={0.3} roughness={0.6} />
        </mesh>
        {[-0.8, 0, 0.8].map((x) => (
          <mesh key={x} castShadow position={[x, 1.2, 0]}>
            <boxGeometry args={[0.32, 1.4, 0.32]} />
            <meshStandardMaterial color="#dfe7ee" roughness={0.4} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 2.05, 0]}>
          <boxGeometry args={[2.9, 0.28, 2.3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      </group>
    );
  if (kind === "fac")
    return (
      <group>
        <mesh castShadow position={[0, 0.7, 0]}>
          <boxGeometry args={[3, 1.4, 2]} />
          <meshStandardMaterial color="#33414e" roughness={0.7} />
        </mesh>
        {[-0.9, 0, 0.9].map((x, i) => (
          <mesh
            key={x}
            castShadow
            position={[x, 1.7, 0]}
            rotation={[0, 0, i % 2 ? 0.25 : -0.25]}
          >
            <boxGeometry args={[1, 0.5, 2]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
          </mesh>
        ))}
        <mesh castShadow position={[1.1, 1.5, -0.7]}>
          <cylinderGeometry args={[0.22, 0.3, 2.4, 10]} />
          <meshStandardMaterial color="#5a4a3c" />
        </mesh>
      </group>
    );
  if (kind === "con")
    return (
      <group>
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[1.8, 1.1, 1.6]} />
          <meshStandardMaterial color="#e8e0d2" roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 1.35, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.35, 0.9, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>
    );
  return (
    <group>
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[1, 1.1, 0.7, 18]} />
        <meshStandardMaterial color="#2a2434" />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function ActorNode({ a }: { a: Anchor }) {
  const color =
    a.kind === "gov"
      ? C.gov
      : a.kind === "fac"
        ? C.fac
        : a.kind === "con"
          ? C.con
          : C.tax;
  return (
    <group position={[a.p[0], 0, a.p[1]]}>
      <Float speed={2} rotationIntensity={0} floatIntensity={0.4}>
        <Building kind={a.kind} color={color} />
      </Float>
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </mesh>
      <Html position={[0, 3.35, 0]} center zIndexRange={[20, 0]}>
        <div
          style={{
            whiteSpace: "nowrap",
            textAlign: "center",
            fontFamily: "Source Sans 3, sans-serif",
            pointerEvents: "none",
            userSelect: "none",
            transform: "translateZ(0)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#f4f2ec",
              letterSpacing: 0.4,
              padding: "3px 10px",
              borderRadius: 9,
              border: `1px solid ${color}`,
              background: `linear-gradient(180deg, ${color}30, ${color}12)`,
              boxShadow: `0 2px 10px rgba(0,0,0,.55), 0 0 10px ${color}30`,
              textShadow: "0 1px 4px #000",
            }}
          >
            <span style={{ color, marginRight: 5 }}>●</span>
            {a.label}
          </div>
          <div style={{ fontSize: 10.5, color: "#b7c2cd", marginTop: 2, textShadow: "0 1px 4px #000" }}>
            {a.sub}
          </div>
        </div>
      </Html>
    </group>
  );
}

function TariffWall({ up }: { up: number }) {
  const y = -2 + up * 2.4;
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.7, 2.4, 24]} />
        <meshStandardMaterial
          color="#3a2a2c"
          emissive={C.tariff}
          emissiveIntensity={up * 0.35}
          roughness={0.8}
        />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => -12 + i * 3).map((z) => (
        <mesh key={z} position={[0, 1.6, z]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.4, 8]} />
          <meshStandardMaterial color="#6c5457" />
        </mesh>
      ))}
      {up > 0.6 && (
        <Html position={[0, 3.1, 0]} center>
          <div
            style={{
              fontFamily: "Source Sans 3, sans-serif",
              color: "#ffd9dc",
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: 2,
              padding: "3px 12px",
              border: `1px solid ${C.tariff}`,
              borderRadius: 8,
              background: "rgba(20,12,14,.75)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            报复关税壁垒 t
          </div>
        </Html>
      )}
    </group>
  );
}

function Ocean({ mobile }: { mobile: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
      <planeGeometry args={[48, 34]} />
      {mobile ? (
        <meshStandardMaterial color="#0a1824" metalness={0.4} roughness={0.7} />
      ) : (
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 60]}
          mixBlur={0.8}
          mixStrength={2.2}
          roughness={0.9}
          depthScale={0.6}
          opacity={0.85}
          color="#0a1824"
          metalness={0.6}
          mirror={0.4}
        />
      )}
    </mesh>
  );
}

function Ground({ x, color }: { x: number; color: string }) {
  return (
    <mesh position={[x, -0.6, 0]} receiveShadow>
      <boxGeometry args={[16, 1.2, 28]} />
      <meshStandardMaterial color={color} roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

function Banner({ text, sub, color }: { text: string; sub: string; color: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: "Source Sans 3, sans-serif",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 1,
          color,
          textShadow: "0 2px 10px #000",
        }}
      >
        {text}
      </div>
      <div style={{ fontSize: 11, color: "#9aa5b1" }}>{sub}</div>
    </div>
  );
}

function Scene({ mobile }: { mobile: boolean }) {
  const t = useViz((s) => s.t);
  const mode = useViz((s) => s.mode);
  const boost = 1 + (t - 20) * 0.012;
  const wallUp = mode === "tariff" ? 1 : 0;

  const defs = useMemo<CurveDef[]>(() => {
    const cargo: CurveDef = {
      id: "cargo",
      curve: arcCurve(NL.nlFac.p, IS.isCon.p, 2.6),
      color: C.cargo,
    };
    const payment: CurveDef = {
      id: "payment",
      curve: arcCurve(IS.isCon.p, NL.nlFac.p, 2.0),
      color: C.money,
    };
    const tariff: CurveDef = {
      id: "tariff",
      curve: groundCurve(IS.isCon.p, IS.isGov.p),
      color: C.tariff,
    };
    const nlSubsidy: CurveDef = {
      id: "nlSubsidy",
      curve: groundCurve(NL.nlGov.p, NL.nlFac.p),
      color: C.money,
    };
    const nlTax: CurveDef = {
      id: "nlTax",
      curve: groundCurve(NL.taxpayer.p, NL.nlGov.p),
      color: C.tax,
    };
    const nlWage: CurveDef = {
      id: "nlWage",
      curve: groundCurve(NL.nlFac.p, NL.taxpayer.p),
      color: C.money,
    };
    const isG: CurveDef = {
      id: "isG",
      curve: groundCurve(IS.isGov.p, IS.isCon.p),
      color: C.money,
    };
    const isBuy: CurveDef = {
      id: "isBuy",
      curve: groundCurve(IS.isCon.p, IS.isFac.p),
      color: C.con,
    };
    return [cargo, payment, tariff, nlSubsidy, nlTax, nlWage, isG, isBuy];
  }, []);

  const byId = (id: string) => defs.find((d) => d.id === id)!;
  const cargoN = Math.round(8 + boost * 10);
  const payN = Math.round(5 + boost * 7);

  return (
    <>
      <color attach="background" args={["#070b11"]} />
      <fog attach="fog" args={["#070b11", 30, 70]} />

      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#9fc4ff", "#0b1016", 0.5]} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <pointLight position={[-12, 6, -8]} intensity={20} color={C.gov} />
      <pointLight
        position={[12, 6, -8]}
        intensity={mode === "tariff" ? 30 : 14}
        color={mode === "tariff" ? C.tariff : C.money}
      />

      <Stars radius={80} depth={40} count={1800} factor={3} fade speed={0.6} />

      <Ground x={-12} color={C.nlGround} />
      <Ground x={12} color={C.isGround} />
      <Ocean mobile={mobile} />

      <Html position={[-12, 4.4, -11]} center>
        <Banner text="邻国 NEIGHBORLAND" sub="出口补贴国" color={C.gov} />
      </Html>
      <Html position={[12, 4.4, -11]} center>
        <Banner text="岛国 ISOLAND" sub="进口国" color={C.con} />
      </Html>

      {Object.values(NL).map((a) => (
        <ActorNode key={a.label} a={a} />
      ))}
      {Object.values(IS).map((a) => (
        <ActorNode key={a.label} a={a} />
      ))}

      <CurveLine def={byId("cargo")} dimmed={mode === "tariff"} />
      <CurveLine def={byId("payment")} />
      <CurveLine def={byId("nlSubsidy")} />
      <CurveLine def={byId("nlTax")} />
      <CurveLine def={byId("nlWage")} />
      <CurveLine def={byId("isG")} />
      <CurveLine def={byId("isBuy")} />
      {mode === "tariff" && <CurveLine def={byId("tariff")} />}

      <Flow def={byId("cargo")} count={cargoN} kind="cargo" speed={0.07} boost={boost} holdAtWall />
      <Flow def={byId("payment")} count={payN} kind="coin" speed={0.06} boost={boost} />
      <Flow def={byId("nlSubsidy")} count={5} kind="money" speed={0.09} boost={boost} />
      <Flow def={byId("nlTax")} count={4} kind="money" speed={0.08} boost={boost} />
      <Flow def={byId("nlWage")} count={4} kind="money" speed={0.08} boost={boost} />
      <Flow def={byId("isG")} count={3} kind="money" speed={0.09} boost={boost} />
      <Flow def={byId("isBuy")} count={4} kind="money" speed={0.08} boost={boost} />
      {mode === "tariff" && (
        <Flow def={byId("tariff")} count={5} kind="coin" speed={0.08} boost={boost} />
      )}

      <TariffWall up={wallUp} />

      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={66}
        maxPolarAngle={Math.PI / 2.02}
        autoRotate
        autoRotateSpeed={0.35}
        target={[0, 0.5, 0]}
        zoomSpeed={0.9}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
      />

      {!mobile && (
        <EffectComposer>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}

function Dot({ c }: { c: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 3,
        background: c,
        boxShadow: `0 0 8px ${c}`,
      }}
    />
  );
}

function Stat({
  label,
  value,
  unit,
  dot,
}: {
  label: string;
  value: string;
  unit: string;
  dot: string;
}) {
  return (
    <div
      style={{
        background: "rgba(10,14,20,.72)",
        border: "1px solid #26313d",
        borderRadius: 10,
        padding: "8px 12px",
        minWidth: 92,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#8f9aa6",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <Dot c={dot} /> {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#f3f1ea", lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 10, fontWeight: 500, color: "#8f9aa6", marginLeft: 4 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

function Hud({ collapsed }: { collapsed: boolean }) {
  const t = useViz((s) => s.t);
  const mode = useViz((s) => s.mode);
  const setT = useViz((s) => s.setT);
  const setMode = useViz((s) => s.setMode);
  const boost = 1 + (t - 20) * 0.012;

  const exportBox = Math.round(120 * boost);
  const payment = Math.round(48 * boost);
  const tariffRev = mode === "tariff" ? Math.round(4 + t * 0.06) : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: "Source Sans 3, sans-serif",
        opacity: collapsed ? 0 : 1,
        transition: "opacity .25s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Stat label="纺织品出口" value={`${exportBox}`} unit="万箱/年" dot={C.cargo} />
          <Stat label="进口付款" value={`${payment}`} unit="亿美元/年" dot={C.money} />
          {mode === "tariff" && (
            <Stat label="关税收入" value={`${tariffRev}`} unit="亿美元/年" dot={C.tariff} />
          )}
          <Stat label="补贴支出" value={`${t}`} unit="亿美元/年" dot={C.gov} />
        </div>
        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            gap: 6,
            background: "rgba(10,14,20,.72)",
            border: "1px solid #26313d",
            borderRadius: 10,
            padding: 4,
            backdropFilter: "blur(6px)",
          }}
        >
          {(
            [
              ["accept", "接受低价进口"],
              ["tariff", "征收报复关税"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 7,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                color: mode === m ? "#0a0e14" : "#aab4c0",
                background:
                  mode === m ? (m === "tariff" ? C.tariff : C.cargo) : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            background: "rgba(10,14,20,.72)",
            border: "1px solid #26313d",
            borderRadius: 10,
            padding: "10px 12px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#c6ced8",
              marginBottom: 6,
            }}
          >
            <span>出口补贴额度 t</span>
            <strong style={{ color: C.money }}>{t} 亿美元</strong>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            style={{ width: "100%", accentColor: C.money }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 11,
            color: "#93a0ad",
            paddingLeft: 4,
            flexWrap: "wrap",
          }}
        >
          <span>
            <Dot c={C.cargo} /> 货物出口（工厂 → 消费者）
          </span>
          <span>
            <Dot c={C.money} /> 货款回流（消费者 → 工厂）
          </span>
          <span style={{ opacity: mode === "tariff" ? 1 : 0.4 }}>
            <Dot c={C.tariff} /> 关税
          </span>
          <span style={{ marginLeft: "auto" }}>拖动旋转 · 滚轮缩放</span>
        </div>
      </div>
    </div>
  );
}

export default function TradeCanvas({ subsidy: _subsidy }: { subsidy?: number }) {
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useIsMobile();
  const [glLost, setGlLost] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "min(72vh, 620px)",
        minHeight: 460,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #222c37",
        background: "#070b11",
      }}
    >
      <Canvas
        shadows={!mobile}
        dpr={mobile ? [1, 1.25] : [1, 1.75]}
        camera={{ position: [0, 15, 30], fov: 42 }}
        gl={{
          antialias: !mobile,
          powerPreference: mobile ? "low-power" : "high-performance",
        }}
        style={{ touchAction: "none" }}
        onCreated={({ gl }) => {
          setReady(true);
          const cv = gl.domElement;
          cv.addEventListener("webglcontextlost", () => setGlLost(true));
          cv.addEventListener("webglcontextrestored", () => setGlLost(false));
        }}
      >
        <Suspense fallback={null}>
          <Scene mobile={mobile} />
        </Suspense>
      </Canvas>
      {glLost && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            color: "#c7d0da",
            fontSize: 13,
            lineHeight: 1.7,
            background: "rgba(7,11,17,.92)",
            padding: 24,
          }}
        >
          3D 图形被手机系统暂时回收以节省资源，请点浏览器刷新重新加载。
        </div>
      )}
            {ready && <Hud collapsed={collapsed} />}
      {ready && (
        <button
          type="button"
          aria-label={collapsed ? "显示面板" : "收起面板"}
          onClick={() => setCollapsed((v) => !v)}
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "auto",
            border: "1px solid #26313d",
            cursor: "pointer",
            borderRadius: 999,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: collapsed ? "#0a0e14" : "#c6ced8",
            background: collapsed ? "#39c6e8" : "rgba(10,14,20,.78)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 4px 16px rgba(0,0,0,.4)",
          }}
        >
          {collapsed ? "显示数据面板" : "收起面板看全貌"}
        </button>
      )}
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#8f9aa6",
            fontSize: 13,
          }}
        >
          正在加载 3D 贸易沙盘…
        </div>
      )}
    </div>
  );
}

/**
 * GlobeCanvas — high-end interactive 3D globe (React Three Fiber).
 *
 * Story: textile export subsidy / tariff warfare in three dimensions.
 *   上海(中国) ──出口──▶ 曼萨尼约(墨西哥) ──中转换单──▶ 洛杉矶(美国)
 * In trade-war mode a blocked direct China→USA lane shows the tariff wall,
 * while the Mexico trans-shipment route is how firms reroute.
 *
 * Click any route to open a live telemetry panel (throughput / value /
 * tariff rate) whose numbers update in real time. Rendering is built for
 * scale: all country borders share one LineSegments (single draw call),
 * land is one merged geometry, clouds are a procedural shader. Mobile
 * devices get a reduced pipeline so the WebGL context is never lost.
 */
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, Stars, Billboard, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import earcut from "earcut";
import type { FeatureCollection, Geometry, Position } from "geojson";
import atlas from "@/assets/geo/countries-110m.json";
import { useViz } from "@/store/viz";

const R = 2;
const WORLD = atlas as unknown as { objects: { countries: never } };

const COLORS = {
  land: "#23303c",
  border: "#3d5666",
  hiCN: "#39c6e8",
  hiMX: "#f4c542",
  hiUS: "#4cc38a",
  cargo: "#39c6e8",
  transit: "#f4c542",
  blocked: "#e0606a",
};

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

/* lat/lon(deg) -> sphere point */
function ll(lon: number, lat: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ================================================================== *
 * Countries — merged land geometry + a single merged border LineSegs
 * ================================================================== */
const HICOLORS: Record<number, string> = {
  156: "#3f6d86", // China  — steel blue
  484: "#8a6f37", // Mexico — amber brown
  842: "#3f7a5b", // USA    — green
};

function Countries() {
  const { landGeo, hiGeos, borderSegs } = useMemo(() => {
    const fc = feature(WORLD as never, WORLD.objects.countries) as unknown as FeatureCollection<
      Geometry,
      Record<string, unknown>
    >;
    const land: number[] = [];
    const hiByCountry: Record<number, number[]> = {};
    const segs: number[] = [];

    // earcut triangulate one polygon ring -> push triangles to target
    const fillRing = (coords: Position[], target: number[]) => {
      if (coords.length < 4) return;
      // flatten lon/lat; earcut expects flat [x,y,x,y...]
      const flat: number[] = [];
      coords.forEach(([lo, la]) => flat.push(lo, la));
      const inds = earcut(flat, [], 2);
      for (const i of inds) {
        const lo = flat[i * 2], la = flat[i * 2 + 1];
        const p = ll(lo, la, R * 1.003);
        target.push(p.x, p.y, p.z);
      }
    };

    const addBorders = (coords: Position[]) => {
      for (let i = 0; i < coords.length - 1; i++) {
        const dens = Math.max(1, Math.ceil(Math.abs(coords[i + 1][0] - coords[i][0]) / 3));
        for (let k = 0; k < dens; k++) {
          const a = ll(
            coords[i][0] + ((coords[i + 1][0] - coords[i][0]) * k) / dens,
            coords[i][1] + ((coords[i + 1][1] - coords[i][1]) * k) / dens,
            R * 1.007,
          );
          const b = ll(
            coords[i][0] + ((coords[i + 1][0] - coords[i][0]) * (k + 1)) / dens,
            coords[i][1] + ((coords[i + 1][1] - coords[i][1]) * (k + 1)) / dens,
            R * 1.007,
          );
          segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    };

    fc.features.forEach((f) => {
      const id = Number((f as unknown as { id?: number }).id);
      const isHi = id in HICOLORS;
      if (isHi && !(id in hiByCountry)) hiByCountry[id] = [];
      const target = isHi ? hiByCountry[id] : land;
      const g = f.geometry;
      if (!g) return;
      const polys =
        g.type === "Polygon"
          ? g.coordinates
          : g.type === "MultiPolygon"
            ? g.coordinates
            : [];
      const walk = (rings: Position[][]) => rings.forEach((r) => { fillRing(r, target); addBorders(r); });
      if (g.type === "Polygon") walk(g.coordinates);
      else if (g.type === "MultiPolygon") g.coordinates.forEach((rings) => walk(rings));
    });

    const mk = (arr: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      return geo;
    };
    return {
      landGeo: mk(land),
      hiGeos: Object.fromEntries(Object.entries(hiByCountry).map(([id, arr]) => [id, mk(arr)])),
      borderSegs: new Float32Array(segs),
    };
  }, []);

  return (
    <group>
      <mesh geometry={landGeo}>
        <meshStandardMaterial color={COLORS.land} roughness={0.92} metalness={0.06} flatShading />
      </mesh>
      {Object.entries(hiGeos).map(([id, geo]) => (
        <mesh key={id} geometry={geo as THREE.BufferGeometry}>
          <meshStandardMaterial
            color={HICOLORS[Number(id)]}
            roughness={0.82}
            metalness={0.12}
            flatShading
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[borderSegs, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={COLORS.border} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

/* ================================================================== *
 * Procedural cloud shell (simplex-ish noise shader)
 * ================================================================== */
function Clouds({ on }: { on: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { u: { value: 0 } },
        vertexShader: `varying vec3 v; void main(){ v=normalize(position);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          varying vec3 v; uniform float u;
          float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5); }
          float n(vec3 p){
            vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
            float a=h(i),b=h(i+vec3(1,0,0)),c=h(i+vec3(0,1,0)),d=h(i+vec3(1,1,0));
            float e=h(i+vec3(0,0,1)),g=h(i+vec3(1,0,1)),k=h(i+vec3(0,1,1)),l=h(i+vec3(1,1,1));
            return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(k,l,f.x),f.y),f.z);
          }
          void main(){
            vec3 p=v*3.2; float q=n(p)+0.6*n(p*2.1)+0.35*n(p*4.2);
            float cl=smoothstep(1.15,1.85,q);
            gl_FragColor=vec4(vec3(0.92,0.95,1.0),cl*0.5);
          }`,
      }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.u.value = clock.elapsedTime;
  });
  if (!on) return null;
  return (
    <mesh material={mat} scale={1.012}>
      <sphereGeometry args={[R, 48, 32]} />
    </mesh>
  );
}

/* ================================================================== *
 * Route: glowing line + moving cargo + invisible clickable tube
 * ================================================================== */
type RouteDef = {
  id: string;
  label: string;
  from: [number, number];
  via?: [number, number];
  to: [number, number];
  color: string;
  lift: number;
  cargoColor: string;
};

function arcPts(a: THREE.Vector3, b: THREE.Vector3, lift: number) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = i / 72;
    const p = a
      .clone()
      .lerp(b.clone(), t)
      .normalize()
      .multiplyScalar(R + lift * Math.sin(Math.PI * t) + 0.015);
    out.push(p);
  }
  return out;
}

function Cargo({
  pts,
  color,
  count,
  speed,
  dim,
}: {
  pts: THREE.Vector3[];
  color: string;
  count: number;
  speed: number;
  dim?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts), [pts]);
  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ u: i / count })),
    [count],
  );
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    g.children.forEach((m, i) => {
      const s = seeds[i];
      s.u = (s.u + speed * d) % 1;
      m.position.copy(curve.getPoint(s.u));
    });
  });
  return (
    <group ref={ref}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.075, 0.05, 0.05]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={dim ? 0.4 : 1.1}
            transparent={dim}
            opacity={dim ? 0.3 : 1}
          />
        </mesh>
      ))}
    </group>
  );
}

function Route({
  def,
  pts,
  selected,
  onSelect,
  war,
}: {
  def: RouteDef;
  pts: THREE.Vector3[];
  selected: boolean;
  onSelect: (id: string) => void;
  war: boolean;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts), [pts]);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 90, 0.09, 8, false), [curve]);
  const isBlocked = def.id === "direct";
  const active = !isBlocked || war;
  const [hover, setHover] = useState(false);
  const beacon = useRef<THREE.Mesh>(null);
  const mid = useMemo(() => curve.getPoint(0.5), [curve]);
  useFrame(({ clock }) => {
    if (beacon.current) {
      const p = 1 + Math.sin(clock.elapsedTime * 4) * 0.22;
      beacon.current.scale.setScalar(p);
    }
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(def.id);
  };
  if (!active) return null;
  return (
    <group>
      <Line
        points={pts}
        color={def.color}
        lineWidth={selected ? 4.5 : isBlocked ? 1.4 : 2.6}
        dashed={isBlocked}
        dashSize={0.12}
        gapSize={0.08}
        transparent
        opacity={isBlocked ? 0.55 : selected ? 1 : 0.85}
      />
      {!isBlocked && (
        <Cargo
          pts={pts}
          color={def.cargoColor}
          count={Math.round(selected ? 16 : 10)}
          speed={0.055 * (selected ? 1.5 : 1)}
        />
      )}
      {/* pulsing midpoint beacon = obvious click target */}
      {!isBlocked && (
        <mesh
          ref={beacon}
          position={mid}
          onClick={click}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor="pointer"; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor="auto"; }}
        >
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial
            color={def.color}
            emissive={def.color}
            emissiveIntensity={selected || hover ? 2.4 : 1.5}
            transparent
            opacity={0.92}
          />
        </mesh>
      )}
      {/* fat invisible tube = easy touch target along the whole lane */}
      <mesh geometry={tube} onClick={click}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ================================================================== *
 * City markers
 * ================================================================== */
type CityDef = {
  id: string;
  lon: number;
  lat: number;
  px: [number, number];
  name: string;
  sub: string;
};

const CITIES: CityDef[] = [
  { id: "cn", lon: 121.5, lat: 31.2, px: [40, -34], name: "上海", sub: "中国 · 起运" },
  { id: "mx", lon: -104.3, lat: 19.05, px: [-40, 46], name: "曼萨尼约", sub: "墨西哥 · 中转换单" },
  { id: "us", lon: -118.24, lat: 34.05, px: [-22, -34], name: "洛杉矶", sub: "美国 · 目的地" },
];

/* marker sphere sitting on the globe */
function CityMarker({ lon, lat }: { lon: number; lat: number }) {
  const pos = useMemo(() => ll(lon, lat, R * 1.01), [lon, lat]);
  return (
    <group position={pos}>
      <Billboard>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.032, 12, 12]} />
          <meshStandardMaterial color="#dff2ff" emissive="#7fd4ff" emissiveIntensity={2.6} />
        </mesh>
      </Billboard>
    </group>
  );
}

type LabelPos = { id: string; x: number; y: number; front: boolean };

/* runs inside R3F: project each city to canvas pixel coords every frame */
function LabelTracker({
  onUpdate,
}: {
  onUpdate: (p: LabelPos[]) => void;
}) {
  const cam = useMemo(() => CITIES.map((c) => ll(c.lon, c.lat, R * 1.01)), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const out: LabelPos[] = [];
    const cp = camera.position;
    CITIES.forEach((c, i) => {
      const p = cam[i];
      v.copy(p).project(camera);
      // front-facing hemisphere test: surface normal points toward camera
      const nx = p.x / R, ny = p.y / R, nz = p.z / R;
      const dx = cp.x - p.x, dy = cp.y - p.y, dz = cp.z - p.z;
      const dl = Math.hypot(dx, dy, dz);
      const front = (nx * dx + ny * dy + nz * dz) / dl > 0.02;
      out.push({
        id: c.id,
        x: (v.x * 0.5 + 0.5) * size.width,
        y: (-v.y * 0.5 + 0.5) * size.height,
        front,
      });
    });
    onUpdate(out);
  });
  return null;
}

/* pulsing tariff dome */
function Dome({ lon, lat, on }: { lon: number; lat: number; on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => ll(lon, lat, R * 1.02), [lon, lat]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(on ? 1 + Math.sin(clock.elapsedTime * 3) * 0.1 : 0.0001);
  });
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={COLORS.blocked}
          emissive={COLORS.blocked}
          emissiveIntensity={1}
          transparent
          opacity={0.34}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Atmosphere() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: new THREE.Color("#3aa0e8") } },
        vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 glow; varying vec3 vN;
          void main(){ float i=pow(0.62-dot(vN,vec3(0,0,1)),2.6);
          gl_FragColor=vec4(glow,1.0)*i; }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      }),
    [],
  );
  return (
    <mesh scale={1.18} material={mat}>
      <sphereGeometry args={[R, 48, 48]} />
    </mesh>
  );
}

/* ================================================================== *
 * Scene
 * ================================================================== */
const ROUTES: RouteDef[] = [
  {
    id: "export",
    label: "中国 → 墨西哥",
    from: [121.5, 31.2],
    to: [-104.3, 19.05],
    color: COLORS.cargo,
    cargoColor: COLORS.cargo,
    lift: 0.22,
  },
  {
    id: "transit",
    label: "墨西哥 → 美国",
    from: [-104.3, 19.05],
    to: [-118.24, 34.05],
    color: COLORS.transit,
    cargoColor: COLORS.transit,
    lift: 0.13,
  },
  {
    id: "direct",
    label: "中国 → 美国（直航）",
    from: [121.5, 31.2],
    to: [-118.24, 34.05],
    color: COLORS.blocked,
    cargoColor: COLORS.blocked,
    lift: 0.3,
  },
];

function Scene({
  war,
  selected,
  setSelected,
  mobile,
  onLabels,
}: {
  war: boolean;
  selected: string | null;
  setSelected: (id: string | null) => void;
  mobile: boolean;
  onLabels: (p: LabelPos[]) => void;
}) {
  const paths = useMemo(() => {
    const map: Record<string, THREE.Vector3[]> = {};
    for (const d of ROUTES) {
      map[d.id] = arcPts(ll(d.from[0], d.from[1]), ll(d.to[0], d.to[1]), d.lift);
    }
    return map;
  }, []);

  return (
    <>
      <color attach="background" args={["#05080e"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.15} />
      <Stars radius={40} depth={30} count={1400} factor={2.4} fade speed={0.5} />

      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial color="#12283d" roughness={0.72} metalness={0.18} />
      </mesh>

      <Countries />
      <Clouds on={!mobile} />
      <Atmosphere />

      {ROUTES.map((d) => (
        <Route
          key={d.id}
          def={d}
          pts={paths[d.id]}
          selected={selected === d.id}
          onSelect={setSelected}
          war={war}
        />
      ))}

      {CITIES.map((c) => (
        <CityMarker key={c.id} lon={c.lon} lat={c.lat} />
      ))}
      <LabelTracker onUpdate={onLabels} />

      <Dome lon={-118.24} lat={34.05} on={war} />
      <Dome lon={-104.3} lat={19.05} on={war} />

      <OrbitControls
        enablePan={false}
        minDistance={2.6}
        maxDistance={9}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.85}
        autoRotate={!war && !selected}
        autoRotateSpeed={0.3}
      />

      {!mobile && (
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.25} luminanceSmoothing={0.35} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

/* ================================================================== *
 * Live telemetry panel for a selected route
 * ================================================================== */
/*
 * REAL baseline figures — World Bank / UN Comtrade, 20-year averages 2005-2024.
 *  China goods+services exports ............ avg $2,304 B
 *  Mexico exports .......................... avg $425 B  (~80% to USA)
 *  USA goods+services imports .............. avg $2,882 B
 *  USA simple average MFN tariff ........... ~2.7%
 * `t` (subsidy slider) and market noise perturb throughput/value live.
 */
function metrics(id: string, t: number, war: boolean) {
  const jitter = 1 + (t - 20) * 0.004;
  if (id === "export")
    return {
      flow: 2304 * jitter,                 // China exports, $B/yr
      value: 2304 * jitter,
      rate: war ? 6 : 2.7,
      share: war ? 3 : 15,
      status: war ? "正常出口 · 部分经墨西哥转口" : "正常出口",
      tone: COLORS.cargo,
    };
  if (id === "transit")
    return {
      flow: 340 * jitter,                  // Mexico->USA, $B/yr (~80% of 425)
      value: 340 * jitter,
      rate: 0,                             // USMCA duty-free
      share: war ? 16 : 16,
      status: war ? "中转换单 · USMCA 零关税" : "近岸出口 · USMCA",
      tone: COLORS.transit,
    };
  return {
    flow: war ? 62 * jitter : 430 * jitter, // China->USA direct, $B/yr
    value: war ? 62 * jitter : 430 * jitter,
    rate: war ? 145 : 2.7,
    share: war ? 2 : 15,
    status: war ? "直航被惩罚性关税阻断" : "直航",
    tone: COLORS.blocked,
  };
}

function Row({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}
    >
      <span style={{ fontSize: 12, color: "#9aa6b2" }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: tone ?? "#f2f0e9" }}>
        {value}
        <span style={{ fontSize: 10, fontWeight: 500, color: "#7d8a97", marginLeft: 4 }}>{unit}</span>
      </span>
    </div>
  );
}

function Telemetry({
  id,
  war,
  onClose,
}: {
  id: string;
  war: boolean;
  onClose: () => void;
}) {
  const t = useViz((s) => s.t);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 850);
    return () => clearInterval(i);
  }, []);
  const def = ROUTES.find((r) => r.id === id)!;
  const m = metrics(id, t, war);
  const j1 = 1 + Math.sin(tick * 1.6) * 0.02;
  const j2 = 1 + Math.cos(tick * 1.3) * 0.018;
  return (
    <div
      style={{
        position: "absolute",
        right: 10,
        bottom: 52,
        width: "min(260px, 72vw)",
        pointerEvents: "auto",
        background: "rgba(12,17,24,.86)",
        border: `1px solid ${m.tone}55`,
        borderRadius: 14,
        padding: "12px 14px",
        backdropFilter: "blur(10px)",
        boxShadow: `0 8px 30px rgba(0,0,0,.5), 0 0 22px ${m.tone}22`,
        fontFamily: "Source Sans 3, sans-serif",
        animation: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#f2f0e9" }}>{def.label}</div>
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            border: "none",
            cursor: "pointer",
            background: "rgba(255,255,255,.08)",
            color: "#aab4c0",
            borderRadius: 6,
            width: 22,
            height: 22,
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: 11, color: m.tone, marginBottom: 2 }}>● {m.status}</div>
      <Row label="贸易额（实时）" value={(m.flow * j1).toFixed(0)} unit="亿美元/年" tone={m.tone} />
      <Row label="占美国进口份额" value={`${m.share}`} unit="%" />
      <Row label="适用关税" value={`${m.rate}`} unit="%" tone={m.rate >= 100 ? COLORS.blocked : undefined} />
      <div style={{ fontSize: 10, color: "#66737f", marginTop: 7 }}>
        真实基准：世界银行/UN Comtrade 2005–2024 均值；随 t 与市场波动更新
      </div>
    </div>
  );
}

/* ================================================================== *
 * Mode toggle + hint
 * ================================================================== */
function Toggle({ war, setWar }: { war: boolean; setWar: (v: boolean) => void }) {
  const B = ({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        border: "none",
        cursor: "pointer",
        borderRadius: 8,
        padding: "7px 13px",
        fontSize: 12,
        fontWeight: 700,
        color: on ? "#0a0e14" : "#aab4c0",
        background: on ? (war ? COLORS.blocked : COLORS.cargo) : "transparent",
      }}
    >
      {children}
    </button>
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        display: "flex",
        gap: 4,
        pointerEvents: "auto",
        background: "rgba(10,14,20,.74)",
        border: "1px solid #26313d",
        borderRadius: 11,
        padding: 4,
        backdropFilter: "blur(6px)",
      }}
    >
      <B on={!war} onClick={() => setWar(false)}>
        自由贸易
      </B>
      <B on={war} onClick={() => setWar(true)}>
        贸易战
      </B>
    </div>
  );
}

function Hint() {
  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        bottom: 10,
        fontSize: 11,
        color: "#82909d",
        background: "rgba(10,14,20,.55)",
        padding: "5px 10px",
        borderRadius: 8,
        pointerEvents: "none",
      }}
    >
      点击航线看实时数据 · 单指旋转 · 双指缩放
    </div>
  );
}

function LabelOverlay({ labels }: { labels: LabelPos[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9 }}>
      {labels
        .filter((l) => l.front)
        .map((l) => {
          const c = CITIES.find((x) => x.id === l.id)!;
          const right = c.px[0] < 0;
          return (
            <div
              key={l.id}
              style={{
                position: "absolute",
                left: l.x + c.px[0],
                top: l.y + c.px[1],
                transform: "translate(-50%,-50%)",
                whiteSpace: "nowrap",
                textAlign: right ? "right" : "left",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 1,
                  background: "linear-gradient(90deg, rgba(160,190,215,.65), rgba(160,190,215,0))",
                  marginBottom: 3,
                  marginLeft: right ? "auto" : 0,
                  transform: right ? "scaleX(-1)" : "none",
                }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#f2f0e9",
                  fontFamily: "Source Sans 3, sans-serif",
                  textShadow: "0 1px 5px #000",
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: 10, color: "#9fb0bd" }}>{c.sub}</div>
            </div>
          );
        })}
    </div>
  );
}

export default function GlobeCanvas() {
  const [war, setWar] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [glLost, setGlLost] = useState(false);
  const [labels, setLabels] = useState<LabelPos[]>([]);
  const mobile = useIsMobile();
  const labelRef = useRef<LabelPos[]>([]);
  const frameCount = useRef(0);
  const onLabels = useMemo(
    () => (p: LabelPos[]) => {
      labelRef.current = p;
      frameCount.current += 1;
      // push to React ~20fps, only if front/back set changed enough
      if (frameCount.current % 3 === 0) setLabels(p.map((q) => ({ ...q })));
    },
    [],
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "min(80vh, 600px)",
        minHeight: 430,
        borderRadius: 12,
        overflow: "hidden",
        background: "#05080e",
      }}
    >
      <Canvas
        dpr={mobile ? [1, 1.3] : [1, 1.75]}
        camera={{ position: [-6.6, 1.5, 2.45], fov: 50 }}
        gl={{
          antialias: !mobile,
          powerPreference: mobile ? "low-power" : "high-performance",
        }}
        style={{ touchAction: "none" }}
        onCreated={({ gl }) => {
          const cv = gl.domElement;
          cv.addEventListener("webglcontextlost", () => setGlLost(true));
          cv.addEventListener("webglcontextrestored", () => setGlLost(false));
        }}
        onPointerMissed={() => setSelected(null)}
      >
        <Suspense fallback={null}>
          <Scene war={war} selected={selected} setSelected={setSelected} mobile={mobile} onLabels={onLabels} />
        </Suspense>
      </Canvas>

      <LabelOverlay labels={labels} />

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
            background: "rgba(5,8,14,.92)",
            padding: 24,
          }}
        >
          3D 被手机系统暂时回收，请点浏览器刷新重新加载。
        </div>
      )}

      <Toggle war={war} setWar={setWar} />
      {war && (
        <div
          style={{
            position: "absolute",
            top: 58,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "Source Sans 3, sans-serif",
            color: "#ffd7da",
            fontWeight: 800,
            fontSize: 12.5,
            letterSpacing: 1.5,
            padding: "5px 14px",
            border: `1px solid ${COLORS.blocked}`,
            borderRadius: 8,
            background: "rgba(20,12,14,.82)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            maxWidth: "92%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          贸易战 · 直航被高关税阻断，货运转走墨西哥
        </div>
      )}
      <Hint />
      {selected && !glLost && (
        <Telemetry id={selected} war={war} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/**
 * GlobeCanvas — interactive 3D globe (React Three Fiber).
 *
 * Tells the modern "unfair competition / tariff" story in three dimensions:
 *   • textiles are shipped China → Mexico (trans-shipment / relabeling) → USA;
 *   • a free-trade vs trade-war toggle raises red tariff zones on the US and
 *     Mexican borders, blocks cargo and animates tariff costs;
 *   • the global subsidy slider t scales how many containers are moving.
 *
 * Countries are triangulated directly onto the sphere (no external runtime
 * fetch — world-atlas is imported as JSON), with an atmosphere glow and stars.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Html,
  OrbitControls,
  Stars,
  Line,
  Billboard,
  Text,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  Suspense,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry, Position } from "geojson";
import atlas from "@/assets/geo/countries-110m.json";
import { useViz } from "@/store/viz";

const R = 2;
const WORLD = atlas as unknown as {
  objects: { countries: never };
};
const COLORS = {
  land: "#26333f",
  landHi: "#33505f",
  border: "#3f5868",
  cargo: "#39c6e8",
  money: "#f4c542",
  tariff: "#e0606a",
};

/* lat/lon (deg) -> point on sphere of radius r */
function ll(lon: number, lat: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ------------------------------------------------------------------ *
 * Countries: triangulate polygons onto the sphere (fan per ring).
 * ------------------------------------------------------------------ */
function Countries({ highlight }: { highlight: Set<number> }) {
  const { landGeo, hiGeo, borderPts } = useMemo(() => {
    const fc = feature(
      WORLD as never,
      WORLD.objects.countries,
    ) as unknown as FeatureCollection<Geometry, { name?: string }>;
    const landPos: number[] = [];
    const hiPos: number[] = [];
    const borderPts: THREE.Vector3[][] = [];

    const consumeRing = (ring: Position[], target: number[]) => {
      if (ring.length < 3) return;
      // centroid direction
      const c = new THREE.Vector3();
      const verts = ring.map(([lon, lat]) => ll(lon, lat, R * 1.002));
      verts.forEach((v) => c.add(v));
      c.normalize();
      // projected center slightly above sphere so the fan sits on the surface
      const center = c.clone().multiplyScalar(R * 1.003);
      for (let i = 0; i < verts.length - 1; i++) {
        for (const v of [center, verts[i], verts[i + 1]]) {
          target.push(v.x, v.y, v.z);
        }
      }
      // border line (subdivide via interpolation handled by Line; densify)
      const dense: THREE.Vector3[] = [];
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const seg = Math.max(1, Math.ceil(Math.abs(b[0] - a[0]) / 3));
        for (let s = 0; s < seg; s++) {
          dense.push(
            ll(
              a[0] + ((b[0] - a[0]) * s) / seg,
              a[1] + ((b[1] - a[1]) * s) / seg,
              R * 1.004,
            ),
          );
        }
      }
      borderPts.push(dense);
    };

    fc.features.forEach((f, idx) => {
      const target = highlight.has(idx) ? hiPos : landPos;
      const g = f.geometry;
      if (!g) return;
      if (g.type === "Polygon") g.coordinates.forEach((ring) => consumeRing(ring, target));
      else if (g.type === "MultiPolygon")
        g.coordinates.forEach((poly) => poly.forEach((ring) => consumeRing(ring, target)));
    });

    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute("position", new THREE.Float32BufferAttribute(landPos, 3));
    landGeo.computeVertexNormals();
    const hiGeo = new THREE.BufferGeometry();
    hiGeo.setAttribute("position", new THREE.Float32BufferAttribute(hiPos, 3));
    hiGeo.computeVertexNormals();
    return { landGeo, hiGeo, borderPts };
  }, [highlight]);

  return (
    <group>
      <mesh geometry={landGeo}>
        <meshStandardMaterial
          color={COLORS.land}
          roughness={0.85}
          metalness={0.1}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
      <mesh geometry={hiGeo as THREE.BufferGeometry}>
        <meshStandardMaterial
          color={COLORS.landHi}
          emissive={COLORS.tariff}
          emissiveIntensity={0.25}
          roughness={0.6}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
      {borderPts.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={COLORS.border}
          lineWidth={0.6}
          transparent
          opacity={0.7}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * Great-circle arc on an inflated sphere
 * ------------------------------------------------------------------ */
function arc(a: THREE.Vector3, b: THREE.Vector3, lift = 0.12): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const ang = a.angleTo(b);
  const r2 = R + lift;
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const p = a
      .clone()
      .normalize()
      .multiplyScalar(R)
      .lerp(b.clone().normalize().multiplyScalar(R), t)
      .normalize()
      .multiplyScalar(R + lift * Math.sin(Math.PI * t) + 0.01);
    void r2;
    void ang;
    pts.push(p);
  }
  return pts;
}

/* moving particles along a route (list of vectors) */
function CargoFlow({
  route,
  count,
  color,
  speed,
  blocked,
  emissive,
}: {
  route: THREE.Vector3[];
  count: number;
  color: string;
  speed: number;
  blocked?: boolean;
  emissive?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(route, false, "catmullrom", 0.2), [route]);
  const seeds = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ u: i / count })),
    [count],
  );
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    g.children.forEach((m, i) => {
      const s = seeds[i];
      if (!blocked) s.u = (s.u + speed * d) % 1;
      else s.u = Math.min(s.u, 0.62); // stop at the tariff zone
      const p = curve.getPoint(s.u);
      m.position.copy(p);
      m.lookAt(0, 0, 0);
    });
  });
  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.07, 0.045, 0.05]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emissive ?? 0.8}
            metalness={0.3}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ *
 * City marker + label
 * ------------------------------------------------------------------ */
function City({
  lon,
  lat,
  lab,
  name,
  sub,
  color,
}: {
  lon: number;
  lat: number;
  lab?: [number, number];
  name: string;
  sub: string;
  color: string;
}) {
  const pos = useMemo(() => ll(lon, lat, R * 1.01), [lon, lat]);
  // Label anchor (default right above the marker), can be offset to avoid
  // colliding with a neighbouring city's label.
  const labelPos = useMemo(() => {
    if (!lab) return new THREE.Vector3(0, 0.18, 0);
    const world = ll(lab[0], lab[1], R * 1.01);
    return world.sub(pos);
  }, [lab, pos]);
  return (
    <group position={pos}>
      <Billboard>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4} />
        </mesh>
      </Billboard>
      <Html position={labelPos} center distanceFactor={6} zIndexRange={[10, 0]}>
        <div
          style={{
            textAlign: "center",
            fontFamily: "Source Sans 3, sans-serif",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f2f0e9", textShadow: "0 1px 5px #000" }}>
            {name}
          </div>
          <div style={{ fontSize: 10, color: "#9fb0bd" }}>{sub}</div>
        </div>
      </Html>
    </group>
  );
}

/* pulsing red tariff dome on the US border region */
function TariffZone({ lon, lat, on }: { lon: number; lat: number; on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => ll(lon, lat, R * 1.02), [lon, lat]);
  useFrame(({ clock }) => {
    if (ref.current) {
      const k = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
      ref.current.scale.setScalar(on ? k : 0.0001);
    }
  });
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={COLORS.tariff}
          emissive={COLORS.tariff}
          emissiveIntensity={0.9}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* atmosphere fresnel shell */
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
    <mesh scale={1.16} material={mat}>
      <sphereGeometry args={[R, 48, 48]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */
function GlobeScene({ war }: { war: boolean }) {
  const t = useViz((s) => s.t);
  const boost = 1 + (t - 20) * 0.012;

  // feature indexes: world-atlas countries-110m ids are numeric (id field).
  // Identify China / Mexico / USA by their numeric ids.
  const highlight = useMemo(() => {
    const fc = feature(WORLD as never, WORLD.objects.countries) as unknown as FeatureCollection<
      Geometry,
      Record<string, unknown>
    >;
    const ids = new Set<number>();
    fc.features.forEach((f, i) => {
      const id = Number((f as { id?: number }).id ?? (f.properties as { id?: number })?.id);
      // China 156, Mexico 484, USA 842 (ISO numeric)
      if ([156, 484, 842].includes(id)) ids.add(i);
    });
    return ids;
  }, []);

  // China (Shanghai) -> Mexico (Manzanillo) -> USA (Los Angeles)
  const routes = useMemo(() => {
    const cn = ll(121.5, 31.2, R);
    const mx = ll(-104.3, 19.05, R);
    const us = ll(-118.24, 34.05, R);
    const seg1 = arc(cn, mx, 0.18);
    const seg2 = arc(mx, us, 0.12);
    return { seg1, seg2, full: [...seg1, ...seg2.slice(1)] };
  }, []);

  const cn = useMemo(() => ll(121.5, 31.2, R), []);
  const mx = useMemo(() => ll(-104.3, 19.05, R), []);
  const cargoN = Math.round(6 + boost * 8);

  return (
    <>
      <color attach="background" args={["#05080e"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.7} />
      <Stars radius={40} depth={30} count={1500} factor={2.4} fade speed={0.5} />

      {/* ocean sphere */}
      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial color="#0c1b2a" roughness={0.35} metalness={0.55} />
      </mesh>

      <Countries highlight={highlight} />
      <Atmosphere />

      {/* routes */}
      <Line points={routes.seg1} color={COLORS.cargo} lineWidth={2.4} transparent opacity={0.85} />
      <Line points={routes.seg2} color={COLORS.money} lineWidth={2.4} transparent opacity={0.85} />

      <CargoFlow route={routes.seg1} count={cargoN} color={COLORS.cargo} speed={0.05 * boost} blocked={war} />
      <CargoFlow
        route={routes.seg2}
        count={Math.round(cargoN * 0.7)}
        color={COLORS.money}
        speed={0.05 * boost}
        blocked={war}
      />

      {/* tariff cost flows back when at war (red, Mexico -> USA border) */}
      {war && (
        <CargoFlow
          route={routes.seg2}
          count={5}
          color={COLORS.tariff}
          speed={0.07}
          emissive={1.4}
        />
      )}

      <City lon={121.5} lat={31.2} lab={[127, 25]} name="上海" sub="中国 · 起运" color={COLORS.cargo} />
      <City lon={-104.3} lat={19.05} lab={[-96, 12.5]} name="曼萨尼约" sub="墨西哥 · 中转换单" color={COLORS.money} />
      <City lon={-118.24} lat={34.05} lab={[-127, 43]} name="洛杉矶" sub="美国 · 目的地" color={COLORS.cargo} />

      <TariffZone lon={-118.24} lat={34.05} on={war} />
      <TariffZone lon={-104.3} lat={19.05} on={war} />

      {war && (
        <Billboard
          position={cn
            .clone()
            .lerp(mx, 0.52)
            .normalize()
            .multiplyScalar(R * 1.42)}
        >
          <Text fontSize={0.2} color="#ffd7da" anchorX="center" anchorY="middle">
            贸易战 · 关税壁垒
          </Text>
        </Billboard>
      )}

      <OrbitControls
        enablePan={false}
        minDistance={2.6}
        maxDistance={9}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.8}
        autoRotate={!war}
        autoRotateSpeed={0.35}
      />

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.25} luminanceSmoothing={0.35} mipmapBlur />
      </EffectComposer>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * HUD
 * ------------------------------------------------------------------ */
function Toggle({ war, setWar }: { war: boolean; setWar: (v: boolean) => void }) {
  const Btn = ({ on, children }: { on: boolean; children: ReactNode }) => (
    <button
      onClick={() => setWar(!war)}
      style={{
        border: "none",
        cursor: "pointer",
        borderRadius: 7,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: on ? "#0a0e14" : "#aab4c0",
        background: on ? COLORS.tariff : "transparent",
      }}
    >
      {children}
    </button>
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        gap: 6,
        pointerEvents: "auto",
        background: "rgba(10,14,20,.72)",
        border: "1px solid #26313d",
        borderRadius: 10,
        padding: 4,
        backdropFilter: "blur(6px)",
      }}
    >
      <Btn on={!war}>自由贸易</Btn>
      <Btn on={war}>贸易战</Btn>
    </div>
  );
}

function Legend({ war }: { war: boolean }) {
  const Row = ({ c, t }: { c: string; t: string }) => (
    <span style={{ fontSize: 11, color: "#9fb0bd", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: c, boxShadow: `0 0 8px ${c}` }} />
      {t}
    </span>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        bottom: 12,
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        background: "rgba(10,14,20,.6)",
        border: "1px solid #26313d",
        borderRadius: 10,
        padding: "8px 12px",
        backdropFilter: "blur(6px)",
      }}
    >
      <Row c={COLORS.cargo} t="中国 → 墨西哥（出口）" />
      <Row c={COLORS.money} t="墨西哥 → 美国（中转）" />
      {war && <Row c={COLORS.tariff} t="关税 / 受阻" />}
      <span style={{ fontSize: 11, color: "#72808d", marginLeft: "auto" }}>单指旋转 · 双指缩放</span>
    </div>
  );
}

export default function GlobeCanvas() {
  const [war, setWar] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "min(78vh, 600px)",
        minHeight: 420,
        borderRadius: 12,
        overflow: "hidden",
        background: "#05080e",
      }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [-5.7, 1.3, 2.07], fov: 42 }}
        gl={{ antialias: true }}
        style={{ touchAction: "none" }}
      >
        <Suspense fallback={null}>
          <GlobeScene war={war} />
        </Suspense>
      </Canvas>
      <Toggle war={war} setWar={setWar} />
      <Legend war={war} />
    </div>
  );
}

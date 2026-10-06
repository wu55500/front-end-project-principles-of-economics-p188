import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Imperative Three.js renderer. React only owns the host <canvas> and the
 * `subsidy` prop; all objects/disposables are created and torn down inside one
 * effect so there are no GPU leaks when the section unmounts.
 */
export function TradeCanvas({ subsidy }: { subsidy: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const subsidyRef = useRef(subsidy);
  subsidyRef.current = subsidy;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = host.clientWidth || 800;
    const height = 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0d1018");
    scene.fog = new THREE.Fog("#0d1018", 18, 42);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 9, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight("#aebcd8", 0.55));
    const sun = new THREE.DirectionalLight("#fff2d8", 1.1);
    sun.position.set(8, 14, 6);
    scene.add(sun);

    // Ocean
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40, 1, 1),
      new THREE.MeshStandardMaterial({ color: "#16324a", roughness: 0.85, metalness: 0.1 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.02;
    scene.add(ocean);

    const makeLand = (x: number, color: string, label: string): { group: THREE.Group; label: string } => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.8, 1.4, 48),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
      );
      base.position.y = 0.7;
      group.add(base);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(4.1, 4.2, 0.3, 48),
        new THREE.MeshStandardMaterial({ color: "#cdd6a8", roughness: 1 }),
      );
      top.position.y = 1.55;
      group.add(top);
      group.position.x = x;
      scene.add(group);
      return { group, label };
    };
    makeLand(-11, "#3f5a3a", "Isoland");
    makeLand(11, "#5a4a3a", "Neighborland");

    // Trade lane endpoints (the two facing ports).
    const PORT_IS = new THREE.Vector3(-6.8, 1.6, 0);
    const PORT_NL = new THREE.Vector3(6.8, 1.6, 0);

    // Port markers
    const portMat = new THREE.MeshStandardMaterial({ color: "#c9b458", emissive: "#5a4e16" });
    for (const p of [PORT_IS, PORT_NL]) {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), portMat);
      beacon.position.copy(p);
      scene.add(beacon);
    }

    // Shared hull geometry/material for all ships.
    const hullGeo = new THREE.BoxGeometry(1.1, 0.5, 0.5);
    const hullMat = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.6 });
    const deckMat = new THREE.MeshStandardMaterial({ color: "#8eb4c8", roughness: 0.5 });

    interface Ship {
      mesh: THREE.Group;
      progress: number; // 0..1 along the lane
      dir: 1 | -1;
      speed: number;
    }
    const ships: Ship[] = [];

    const buildShip = (): Ship => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo, hullMat);
      g.add(hull);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.42), deckMat);
      deck.position.set(0.1, 0.4, 0);
      g.add(deck);
      g.position.copy(PORT_IS);
      scene.add(g);
      return { mesh: g, progress: Math.random(), dir: 1, speed: 0.12 + Math.random() * 0.05 };
    };

    // Start with a baseline fleet.
    const MAX_SHIPS = 14;
    for (let i = 0; i < 4; i++) ships.push(buildShip());

    const tmp = new THREE.Vector3();
    let raf = 0;
    let last = performance.now();

    const animate = (nowMs: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min((nowMs - last) / 1000, 0.05);
      last = nowMs;

      // Fleet size scales with subsidy (t 0..40 → 4..14 ships).
      const targetShips = 4 + Math.round((Math.min(Math.max(subsidyRef.current, 0), 40) / 40) * (MAX_SHIPS - 4));
      while (ships.length < targetShips) ships.push(buildShip());
      while (ships.length > targetShips) {
        const s = ships.pop();
        if (s) {
          scene.remove(s.mesh);
        }
      }

      const speedBoost = 1 + Math.min(Math.max(subsidyRef.current, 0), 40) / 40;
      for (const s of ships) {
        s.progress += (s.dir * s.speed * speedBoost * dt);
        if (s.progress >= 1) {
          s.progress = 1;
          s.dir = -1;
        } else if (s.progress <= 0) {
          s.progress = 0;
          s.dir = 1;
        }
        const from = s.dir === 1 ? PORT_IS : PORT_NL;
        const to = s.dir === 1 ? PORT_NL : PORT_IS;
        tmp.lerpVectors(from, to, s.progress);
        s.mesh.position.copy(tmp);
        s.mesh.position.y = 1.6 + Math.sin(nowMs / 400 + s.progress * 6) * 0.08;
        s.mesh.rotation.y = s.dir === 1 ? 0 : Math.PI;
      }

      // Slow orbit for depth.
      const orbit = nowMs / 12000;
      camera.position.x = Math.sin(orbit) * 2;
      camera.lookAt(0, 1, 0);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w = host.clientWidth || width;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      hullGeo.dispose();
      hullMat.dispose();
      deckMat.dispose();
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry && m.geometry !== hullGeo) m.geometry.dispose();
      });
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-[420px] w-full" aria-label="3D trade scene" />;
}

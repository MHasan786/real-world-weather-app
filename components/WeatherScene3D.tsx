'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';
import type { CurrentWeatherData, WeatherTheme } from '@/lib/weather-utils';

interface WeatherScene3DProps {
  weather: CurrentWeatherData;
  theme: WeatherTheme;
  isLightTheme: boolean;
}

type CameraPreset = 'overview' | 'station' | 'sky';

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [7.6, 5.2, 8.8], target: [0, 1.4, 0] },
  station: { pos: [3.2, 2.35, 3.8], target: [0, 1.35, 0] },
  sky: { pos: [6.4, 2.9, 6.2], target: [0, 3.3, 0] },
};

const THEME_SCENE_PALETTE: Record<
  WeatherTheme,
  {
    skyHex: number;
    fogDensity: number;
    keyHex: number;
    keyIntensity: number;
    hemiSkyHex: number;
    hemiGroundHex: number;
    terrainHex: number;
    cloudHex: number;
    particleHex: number;
  }
> = {
  default: {
    skyHex: 0x0d213a,
    fogDensity: 0.032,
    keyHex: 0xffe4b5,
    keyIntensity: 2.2,
    hemiSkyHex: 0x7dd3fc,
    hemiGroundHex: 0x1e293b,
    terrainHex: 0x3f5e4d,
    cloudHex: 0xdbeafe,
    particleHex: 0xe0f2fe,
  },
  clear: {
    skyHex: 0x1c5c96,
    fogDensity: 0.022,
    keyHex: 0xfff1c9,
    keyIntensity: 2.8,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x5c4732,
    terrainHex: 0x4d7c4f,
    cloudHex: 0xffffff,
    particleHex: 0xfef08a,
  },
  clouds: {
    skyHex: 0x334457,
    fogDensity: 0.038,
    keyHex: 0xe2e8f0,
    keyIntensity: 1.8,
    hemiSkyHex: 0x94a3b8,
    hemiGroundHex: 0x1f2937,
    terrainHex: 0x475e54,
    cloudHex: 0xcbd5e1,
    particleHex: 0xe2e8f0,
  },
  rain: {
    skyHex: 0x10213d,
    fogDensity: 0.044,
    keyHex: 0xbfdbfe,
    keyIntensity: 1.5,
    hemiSkyHex: 0x60a5fa,
    hemiGroundHex: 0x0f172a,
    terrainHex: 0x2f4b44,
    cloudHex: 0x64748b,
    particleHex: 0x93c5fd,
  },
  snow: {
    skyHex: 0xaad4f5,
    fogDensity: 0.028,
    keyHex: 0xffffff,
    keyIntensity: 2.3,
    hemiSkyHex: 0xe0f2fe,
    hemiGroundHex: 0x64748b,
    terrainHex: 0xdbeafe,
    cloudHex: 0xf8fafc,
    particleHex: 0xffffff,
  },
  thunderstorm: {
    skyHex: 0x160f2e,
    fogDensity: 0.048,
    keyHex: 0xc4b5fd,
    keyIntensity: 1.35,
    hemiSkyHex: 0x818cf8,
    hemiGroundHex: 0x090517,
    terrainHex: 0x293b39,
    cloudHex: 0x334155,
    particleHex: 0xbae6fd,
  },
  night: {
    skyHex: 0x090f26,
    fogDensity: 0.035,
    keyHex: 0xc7d2fe,
    keyIntensity: 1.5,
    hemiSkyHex: 0x6366f1,
    hemiGroundHex: 0x020617,
    terrainHex: 0x253b3a,
    cloudHex: 0x475569,
    particleHex: 0xf8fafc,
  },
};

// Module-scoped scratch objects for zero-GC animation ticks
const _dummy = new THREE.Object3D();
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createProceduralTerrainTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    12,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, '#8ba88e');
  grad.addColorStop(0.58, '#66826c');
  grad.addColorStop(1, '#3e4f47');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Contour elevation rings + subtle tactile grain
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  for (let r = 24; r < size / 2; r += 22) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 650; i++) {
    const angle = (i * 137.5 * Math.PI) / 180;
    const radius = ((i * 29) % 118) + 4;
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    ctx.fillRect(x, y, 2.5, 2.5);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let r = 20; r < size / 2; r += 18) {
    bCtx.strokeStyle = 'rgba(220,220,220,0.22)';
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.58)');
  grad.addColorStop(0.6, 'rgba(2, 6, 23, 0.22)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildConiferTree(
  trunkMat: THREE.Material,
  foliageMat: THREE.Material,
  scaleFactor: number
): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.1, 0.45, 8),
    trunkMat
  );
  trunk.position.y = 0.225;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const tiers = [
    { r: 0.42, h: 0.65, y: 0.68 },
    { r: 0.33, h: 0.55, y: 1.05 },
    { r: 0.22, h: 0.45, y: 1.38 },
  ];
  for (const tier of tiers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(tier.r, tier.h, 8),
      foliageMat
    );
    cone.position.y = tier.y;
    cone.castShadow = true;
    cone.receiveShadow = true;
    tree.add(cone);
  }

  tree.scale.setScalar(scaleFactor);
  return tree;
}

function buildObservatoryStation(isSoftwareGl: boolean): {
  group: THREE.Group;
  anemometerRotor: THREE.Group;
  windVane: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xd6dce5,
    roughness: 0.82,
    metalness: 0.05,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.24,
    metalness: 0.88,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.42,
    metalness: 0.72,
  });
  const solarMat = new THREE.MeshPhysicalMaterial({
    color: 0x172554,
    roughness: 0.16,
    metalness: 0.65,
    clearcoat: 0.9,
  });
  const glassDomeMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.72,
    ior: 1.52,
    thickness: 0.5,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 0.92,
    depthWrite: false,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.1,
  });

  // 1. Concrete foundation pad (pivoted flush at y = 0)
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.18, 1.32, 0.22, 24),
    concreteMat
  );
  pad.position.y = 0.11;
  pad.castShadow = true;
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Flared architectural observatory tower via LatheGeometry
  const lathePoints = [
    new THREE.Vector2(0.82, 0.22),
    new THREE.Vector2(0.76, 0.45),
    new THREE.Vector2(0.58, 1.38),
    new THREE.Vector2(0.72, 1.56),
    new THREE.Vector2(0.72, 1.72),
    new THREE.Vector2(0.62, 1.76),
  ];
  const tower = new THREE.Mesh(
    new THREE.LatheGeometry(lathePoints, 24),
    concreteMat
  );
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // 3. Brushed steel deck collar
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 12, 32),
    steelMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.68;
  collar.castShadow = true;
  group.add(collar);

  // 4. Translucent glass radome enclosing internal radar core
  const radarCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 1),
    beaconMat
  );
  radarCore.position.y = 2.02;
  group.add(radarCore);

  const radome = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
    glassDomeMat
  );
  radome.position.y = 1.72;
  radome.renderOrder = 2;
  group.add(radome);

  // 5. Stevenson louvered instrument shelter mounted on side terrace
  const shelterStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.52, 10),
    darkMetalMat
  );
  shelterStand.position.set(1.02, 0.46, 0.28);
  group.add(shelterStand);

  const shelterBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.42, 0.46),
    concreteMat
  );
  shelterBody.position.set(1.02, 0.86, 0.28);
  shelterBody.castShadow = true;
  group.add(shelterBody);

  const shelterRoof = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.06, 0.56),
    darkMetalMat
  );
  shelterRoof.position.set(1.02, 1.1, 0.28);
  shelterRoof.castShadow = true;
  group.add(shelterRoof);

  // 6. Tilted photovoltaic solar array
  const solarStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.55, 10),
    darkMetalMat
  );
  solarStrut.position.set(-0.98, 0.46, 0.32);
  group.add(solarStrut);

  const solarPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.05, 0.52),
    solarMat
  );
  solarPanel.position.set(-0.98, 0.78, 0.32);
  solarPanel.rotation.x = 0.45;
  solarPanel.rotation.z = -0.12;
  solarPanel.castShadow = true;
  group.add(solarPanel);

  // 7. Brushed metallic anemometer & wind vane mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 1.15, 12),
    steelMat
  );
  mast.position.set(-0.46, 2.28, -0.35);
  mast.castShadow = true;
  group.add(mast);

  // 8. Rotating 3-cup anemometer assembly
  const anemometerRotor = new THREE.Group();
  anemometerRotor.position.set(-0.46, 2.86, -0.35);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8),
      steelMat
    );
    arm.rotation.z = Math.PI / 2;
    arm.position.set(Math.cos(angle) * 0.16, 0, Math.sin(angle) * 0.16);
    arm.rotation.y = -angle;
    anemometerRotor.add(arm);

    const cup = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 10, 0, Math.PI),
      darkMetalMat
    );
    cup.position.set(Math.cos(angle) * 0.32, 0, Math.sin(angle) * 0.32);
    cup.rotation.y = -angle + Math.PI / 2;
    anemometerRotor.add(cup);
  }
  group.add(anemometerRotor);

  // 9. Directional wind vane aligned to real wind degree
  const windVane = new THREE.Group();
  windVane.position.set(-0.46, 2.52, -0.35);
  const vaneRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.56, 8),
    steelMat
  );
  vaneRod.rotation.x = Math.PI / 2;
  windVane.add(vaneRod);

  const vaneTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.16, 8),
    beaconMat
  );
  vaneTip.rotation.x = Math.PI / 2;
  vaneTip.position.z = 0.28;
  windVane.add(vaneTip);

  const vaneFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.14, 0.16),
    darkMetalMat
  );
  vaneFin.position.z = -0.24;
  windVane.add(vaneFin);
  group.add(windVane);

  return { group, anemometerRotor, windVane, beaconMat };
}

export default function WeatherScene3D({
  weather,
  theme,
  isLightTheme,
}: WeatherScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>('overview');

  // Mutable refs read inside the stable WebGL loop (no scene teardown on React updates!)
  const liveStateRef = useRef({
    theme,
    windSpeed: weather.wind.speed,
    windDeg: weather.wind.deg ?? 45,
    autoOrbit,
    preset: activePreset as CameraPreset | null,
  });

  useEffect(() => {
    liveStateRef.current.theme = theme;
    liveStateRef.current.windSpeed = weather.wind.speed;
    liveStateRef.current.windDeg = weather.wind.deg ?? 45;
  }, [theme, weather.wind.speed, weather.wind.deg]);

  useEffect(() => {
    liveStateRef.current.autoOrbit = autoOrbit;
  }, [autoOrbit]);

  const applyCameraPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    liveStateRef.current.preset = preset;
  };

  // Keyboard shortcut 'H' to toggle HUD dock in fullscreen mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h' && isFullscreen) {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebglUnavailable(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(container.clientWidth, 320);
    const initH = Math.max(container.clientHeight, 260);
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialPalette = THEME_SCENE_PALETTE[liveStateRef.current.theme];
    scene.background = new THREE.Color(initialPalette.skyHex);
    scene.fog = new THREE.FogExp2(
      initialPalette.skyHex,
      initialPalette.fogDensity
    );

    // Mandatory studio RoomEnvironment reflection on every device
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 120);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.8;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.update();

    // Cancel any scripted camera transition immediately when user interacts
    const onControlStart = () => {
      liveStateRef.current.preset = null;
    };
    controls.addEventListener('start', onControlStart);

    // 3-Point Studio Lighting Rig (warm key + cool hemisphere fill + rim + storm flash light)
    const keyLight = new THREE.DirectionalLight(
      initialPalette.keyHex,
      initialPalette.keyIntensity
    );
    keyLight.position.set(7.5, 11, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(
      initialPalette.hemiSkyHex,
      initialPalette.hemiGroundHex,
      0.85
    );
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rimLight.position.set(-7, 6, -6);
    scene.add(rimLight);

    const lightningLight = new THREE.PointLight(0xe0e7ff, 0, 24);
    lightningLight.position.set(0, 4.4, 0.5);
    scene.add(lightningLight);

    // Sculpted circular terrain island + soft radial contact shadow
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { map: terrainMap, bumpMap: terrainBump } =
      createProceduralTerrainTextures(maxAniso);
    const contactShadowTex = createContactShadowTexture();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: initialPalette.terrainHex,
      map: terrainMap,
      bumpMap: terrainBump,
      bumpScale: 0.08,
      roughness: 0.88,
      metalness: 0.04,
    });
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.92,
      metalness: 0.08,
    });

    const islandGroup = new THREE.Group();
    const terrainTop = new THREE.Mesh(
      new THREE.CylinderGeometry(3.85, 4.15, 0.42, 48),
      terrainMat
    );
    terrainTop.position.y = -0.21;
    terrainTop.receiveShadow = true;
    islandGroup.add(terrainTop);

    const terrainRim = new THREE.Mesh(
      new THREE.CylinderGeometry(4.15, 3.3, 0.55, 32),
      cliffMat
    );
    terrainRim.position.y = -0.69;
    islandGroup.add(terrainRim);

    // Soft radial contact shadow right under the station (y = 0.02 avoids Z-fighting)
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.6),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.02;
    islandGroup.add(contactShadow);

    // Composite pine trees & rocks around island perimeter (bottom-center flush with ground)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      metalness: 0.02,
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2f5a44,
      roughness: 0.78,
      metalness: 0.04,
    });
    const treePlacements = [
      { x: -2.4, z: -1.4, s: 1.05 },
      { x: -2.85, z: -0.4, s: 0.82 },
      { x: 2.35, z: -1.65, s: 0.95 },
      { x: 2.7, z: -0.75, s: 0.76 },
      { x: 1.8, z: 2.15, s: 0.88 },
      { x: -1.9, z: 2.05, s: 0.78 },
    ];
    for (const p of treePlacements) {
      const tree = buildConiferTree(trunkMat, foliageMat, p.s);
      tree.position.set(p.x, 0, p.z);
      islandGroup.add(tree);
    }

    // Rock outcrops along terrain rim
    const rockGeo = new THREE.DodecahedronGeometry(0.32, 0);
    const rockCoords = [
      [-2.1, 0.14, 1.35, 1.1],
      [2.4, 0.12, 1.15, 0.9],
      [-1.4, 0.12, -2.55, 1.2],
      [1.2, 0.11, -2.65, 0.85],
    ];
    for (const [x, y, z, s] of rockCoords) {
      const rock = new THREE.Mesh(rockGeo, cliffMat);
      rock.position.set(x, y, z);
      rock.scale.set(s * 1.2, s * 0.7, s);
      rock.castShadow = true;
      rock.receiveShadow = true;
      islandGroup.add(rock);
    }

    scene.add(islandGroup);

    // Composite 9-part Meteorological Observatory Station grounded at (0, 0, 0)
    const { group: stationGroup, anemometerRotor, windVane, beaconMat } =
      buildObservatoryStation(isSoftwareGl);
    scene.add(stationGroup);

    // Overhead Dynamic 3D Weather Formation (Cloud cluster + Sun + Moon)
    const skyGroup = new THREE.Group();
    skyGroup.position.set(0, 4.15, 0);

    const cloudMat = new THREE.MeshStandardMaterial({
      color: initialPalette.cloudHex,
      roughness: 0.86,
      metalness: 0.02,
    });
    const cloudCluster = new THREE.Group();
    const cloudLobes = [
      [0, 0.1, 0, 0.85],
      [-0.75, -0.05, 0.18, 0.62],
      [0.78, -0.04, -0.15, 0.66],
      [0.24, 0.35, -0.25, 0.56],
      [-0.36, 0.28, -0.28, 0.5],
      [0.4, -0.12, 0.42, 0.48],
    ];
    for (const [cx, cy, cz, r] of cloudLobes) {
      const lobe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 2),
        cloudMat
      );
      lobe.position.set(cx, cy, cz);
      lobe.castShadow = true;
      cloudCluster.add(lobe);
    }
    skyGroup.add(cloudCluster);

    // Composite Solar Orb + Equatorial Halo Ring (shown on clear/default)
    const sunGroup = new THREE.Group();
    sunGroup.position.set(2.15, 0.55, -1.6);
    const sunCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 2),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.25,
        metalness: 0.1,
      })
    );
    sunGroup.add(sunCore);

    const sunRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.04, 10, 32),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.6,
      })
    );
    sunRing.rotation.x = Math.PI * 0.36;
    sunGroup.add(sunRing);
    skyGroup.add(sunGroup);

    // Sculpted Moon Orb (shown on night)
    const moonMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.54, 2),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        emissive: 0x818cf8,
        emissiveIntensity: 0.55,
        roughness: 0.65,
        metalness: 0.08,
      })
    );
    moonMesh.position.set(-2.1, 0.65, -1.7);
    skyGroup.add(moonMesh);

    scene.add(skyGroup);

    // InstancedMesh weather particles (96 instances, zero GC updates in tick)
    const PARTICLE_COUNT = 96;
    const particleGeo = new THREE.OctahedronGeometry(0.055, 0);
    const particleMat = new THREE.MeshStandardMaterial({
      color: initialPalette.particleHex,
      emissive: initialPalette.particleHex,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.1,
    });
    const particles = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      PARTICLE_COUNT
    );
    particles.frustumCulled = false;

    const particleSeeds = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const golden = i * 2.399963;
      const radius = 0.4 + ((i * 37) % 340) / 100;
      return {
        x: Math.cos(golden) * radius,
        z: Math.sin(golden) * radius,
        yOffset: ((i * 53) % 420) / 100,
        speed: 0.8 + ((i * 19) % 100) / 100,
      };
    });
    scene.add(particles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Handle context loss safely
    let contextLost = false;
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      onContextRestored
    );

    // ResizeObserver deferred via rAF + updateStyle=false prevents ResizeObserver loop errors
    let lastW = initW;
    let lastH = initH;
    let resizeRafId = 0;
    const handleResize = () => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = 0;
        if (!container || disposed) return;
        const w = Math.max(Math.round(container.clientWidth), 280);
        const h = Math.max(Math.round(container.clientHeight), 240);
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (isSoftwareGl && !contextLost) {
          renderer.render(scene, camera);
        }
      });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let frameId = 0;
    let disposed = false;
    let isVisible = true;
    let hasRenderedInitial = false;

    const visibilityObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const nowVisible = entries[0]?.isIntersecting ?? true;
              const wasHidden = !isVisible;
              isVisible = nowVisible;
              if (isSoftwareGl && wasHidden && nowVisible && !disposed) {
                clearTimeout(frameId);
                lastTimeMs = performance.now();
                tick();
              }
            },
            { threshold: 0.05 }
          )
        : null;
    visibilityObserver?.observe(container);

    const onControlChange = () => {
      if (isSoftwareGl && !disposed && isVisible) {
        renderer.render(scene, camera);
      }
    };
    controls.addEventListener('change', onControlChange);

    function afterDraw(cb: () => void) {
      if (!isVisible && hasRenderedInitial) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 8);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 180);
        }
      };
      frameId = window.setTimeout(poll, 8);
    }

    const scratchSkyColor = new THREE.Color();
    const scratchCloudColor = new THREE.Color();
    const scratchTerrainColor = new THREE.Color();
    const scratchParticleColor = new THREE.Color();

    function tick() {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(Math.max((nowMs - lastTimeMs) / 1000, 0.001), 0.1);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;
      const { theme: activeTheme, windSpeed, windDeg, autoOrbit: orbitOn, preset } =
        liveStateRef.current;
      const pal = THEME_SCENE_PALETTE[activeTheme];

      // Smoothly transition atmosphere colors and lighting
      scratchSkyColor.setHex(pal.skyHex);
      (scene.background as THREE.Color).lerp(scratchSkyColor, Math.min(1, dt * 3));
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(scene.background as THREE.Color);
        scene.fog.density = THREE.MathUtils.damp(
          scene.fog.density,
          pal.fogDensity,
          3,
          dt
        );
      }

      keyLight.color.lerp(scratchTerrainColor.setHex(pal.keyHex), Math.min(1, dt * 3));
      keyLight.intensity = THREE.MathUtils.damp(
        keyLight.intensity,
        pal.keyIntensity,
        3,
        dt
      );
      hemiLight.color.setHex(pal.hemiSkyHex);
      hemiLight.groundColor.setHex(pal.hemiGroundHex);

      scratchCloudColor.setHex(pal.cloudHex);
      cloudMat.color.lerp(scratchCloudColor, Math.min(1, dt * 3));
      terrainMat.color.lerp(
        scratchTerrainColor.setHex(pal.terrainHex),
        Math.min(1, dt * 3)
      );
      particleMat.color.lerp(
        scratchParticleColor.setHex(pal.particleHex),
        Math.min(1, dt * 3)
      );
      particleMat.emissive.copy(particleMat.color);

      // Show/hide weather sky formations
      const showClouds = activeTheme !== 'clear' && activeTheme !== 'night';
      cloudCluster.visible = showClouds;
      sunGroup.visible = activeTheme === 'clear' || activeTheme === 'default';
      moonMesh.visible = activeTheme === 'night';

      // Animate observatory instruments from real telemetry
      const rotorRate = Math.max(0.8, windSpeed * 0.95);
      anemometerRotor.rotation.y += dt * rotorRate;
      const targetVaneRad = THREE.MathUtils.degToRad(windDeg);
      windVane.rotation.y = THREE.MathUtils.damp(
        windVane.rotation.y,
        targetVaneRad,
        4,
        dt
      );
      beaconMat.emissiveIntensity = 0.65 + Math.sin(elapsed * 2.4) * 0.25;

      // Animate sky formations
      cloudCluster.position.y = Math.sin(elapsed * 0.7) * 0.14;
      cloudCluster.rotation.y = Math.sin(elapsed * 0.25) * 0.12;
      sunRing.rotation.z += dt * 0.45;
      sunCore.rotation.y += dt * 0.25;
      moonMesh.rotation.y += dt * 0.18;

      // Thunderstorm lightning pulse
      if (activeTheme === 'thunderstorm') {
        const phase = elapsed % 6.5;
        lightningLight.intensity =
          phase > 5.8 && phase < 5.96 ? 12 : phase > 6.02 && phase < 6.12 ? 7 : 0;
      } else {
        lightningLight.intensity = 0;
      }

      // Animate InstancedMesh weather particles without allocating memory
      const isRain = activeTheme === 'rain' || activeTheme === 'thunderstorm';
      const isSnow = activeTheme === 'snow';
      const isNight = activeTheme === 'night' || activeTheme === 'default';

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const seed = particleSeeds[i];
        if (isRain) {
          const dropY = 4.4 - ((elapsed * 4.8 * seed.speed + seed.yOffset) % 4.4);
          _dummy.position.set(
            seed.x - (4.4 - dropY) * 0.12,
            dropY,
            seed.z
          );
          _dummy.rotation.set(0, 0, 0.14);
          _dummy.scale.set(0.32, 3.8, 0.32);
        } else if (isSnow) {
          const flakeY = 4.4 - ((elapsed * 0.85 * seed.speed + seed.yOffset) % 4.4);
          _dummy.position.set(
            seed.x + Math.sin(elapsed * 1.4 + i) * 0.22,
            flakeY,
            seed.z + Math.cos(elapsed * 1.1 + i) * 0.16
          );
          _dummy.rotation.set(elapsed + i, elapsed * 0.7, 0);
          _dummy.scale.setScalar(0.85);
        } else if (isNight) {
          const starY = 3.2 + (seed.yOffset % 2.4);
          const twinkle = 0.45 + Math.sin(elapsed * 2.2 + i) * 0.35;
          _dummy.position.set(seed.x * 1.8, starY, seed.z * 1.8);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(twinkle * 0.75);
        } else {
          // Gentle warm sunlit motes or drifting mist
          const moteY = 0.6 + ((elapsed * 0.35 * seed.speed + seed.yOffset) % 3.6);
          _dummy.position.set(
            seed.x + Math.sin(elapsed * 0.8 + i) * 0.18,
            moteY,
            seed.z
          );
          _dummy.rotation.set(elapsed * 0.4, elapsed * 0.4, 0);
          _dummy.scale.setScalar(0.55);
        }
        _dummy.updateMatrix();
        particles.setMatrixAt(i, _dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;

      // Damped camera preset transitions or subtle auto-orbit
      if (preset) {
        const cfg = CAMERA_PRESETS[preset];
        _targetPos.set(...cfg.pos);
        _targetLook.set(...cfg.target);
        const factor = 1 - Math.exp(-4.5 * dt);
        camera.position.lerp(_targetPos, factor);
        controls.target.lerp(_targetLook, factor);
        if (camera.position.distanceTo(_targetPos) < 0.04) {
          liveStateRef.current.preset = null;
        }
      } else if (orbitOn && !isSoftwareGl) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.85;
      } else {
        controls.autoRotate = false;
      }

      controls.update();

      if (!contextLost) {
        renderer.render(scene, camera);
        hasRenderedInitial = true;
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      clearTimeout(frameId);
      visibilityObserver?.disconnect();
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onContextRestored
      );

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      terrainMap.dispose();
      terrainBump.dispose();
      contactShadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const titleText = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedText = isLightTheme ? 'text-slate-600' : 'text-white/70';

  return (
    <section
      aria-label="3D Weather Observatory Diorama"
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950 flex flex-col'
          : 'glass-panel rounded-3xl p-5 sm:p-6 flex flex-col gap-4 h-full'
      }
    >
      {!isFullscreen && (
        <div className="flex items-start justify-between gap-3 min-h-[56px]">
          <div className="flex items-start gap-2.5 min-w-0">
            <Box className={`w-5 h-5 mt-0.5 shrink-0 ${titleText}`} aria-hidden="true" />
            <div className="min-w-0">
              <h2
                className={`font-display text-lg sm:text-xl font-bold tracking-tight ${titleText}`}
              >
                3D Atmospheric Observatory
              </h2>
              <p className={`text-xs leading-snug ${mutedText}`}>
                Three.js diorama synced to {weather.name} wind (
                {weather.wind.speed.toFixed(1)} m/s) &amp; sky
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className={`h-8 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isLightTheme
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Full 3D</span>
          </button>
        </div>
      )}

      {/* Isolated WebGL Viewport + Solid Floating Control Dock (No backdrop-filter over WebGL) */}
      <div
        className={
          isFullscreen
            ? 'relative flex-1 w-full h-full overflow-hidden'
            : 'relative flex-1 w-full min-h-[380px] sm:min-h-[420px] rounded-2xl overflow-hidden border border-white/15 bg-slate-950'
        }
      >
        {webglUnavailable ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white gap-2">
            <Box className="w-8 h-8 text-sky-300" aria-hidden="true" />
            <p className="font-display text-sm font-semibold">
              3D WebGL view unavailable in this browser
            </p>
            <p className="text-xs text-slate-300 max-w-md">
              Enable hardware acceleration or WebGL2 to interact with the live 3D
              meteorological observatory scene.
            </p>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        {/* Minimal Top-Left Spec Label (Fullscreen only) */}
        {isFullscreen && (
          <div className="pointer-events-none absolute top-4 left-4 z-10 rounded-xl bg-slate-950/85 border border-white/15 px-4 py-2.5 text-white">
            <p className="font-display text-sm font-bold">{weather.name}</p>
            <p className="font-mono text-xs text-slate-300 tabular-nums">
              {weather.weather[0]?.main || 'Weather'} · Wind{' '}
              {weather.wind.speed.toFixed(1)} m/s
            </p>
          </div>
        )}

        {/* Compact Collapsible Bottom Control Dock (solid rgba, single-row) */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[96%]">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            aria-expanded={!dockCollapsed}
            className="mb-1 px-2.5 py-0.5 rounded-md bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-[11px] font-medium text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
                <span>Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
                <span>Hide</span>
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div className="rounded-xl bg-slate-950/92 border border-white/15 px-2 py-1.5 flex items-center justify-center gap-1 shadow-xl flex-nowrap overflow-x-auto max-w-full">
              {(['overview', 'station', 'sky'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyCameraPreset(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activePreset === preset
                      ? 'bg-white text-slate-950'
                      : 'text-slate-200 hover:bg-white/12'
                  }`}
                >
                  {preset}
                </button>
              ))}

              <span
                className="h-3.5 w-px bg-white/15 mx-0.5 shrink-0"
                aria-hidden="true"
              />

              <button
                type="button"
                onClick={() => setAutoOrbit((prev) => !prev)}
                aria-pressed={autoOrbit}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  autoOrbit
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-200 hover:bg-white/12'
                }`}
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                <span>Orbit</span>
              </button>

              {isFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/12 hover:bg-white/22 text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Minimize2 className="w-3 h-3" aria-hidden="true" />
                  <span>Exit</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

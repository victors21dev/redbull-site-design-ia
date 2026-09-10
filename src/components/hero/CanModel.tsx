import {
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MutableRefObject,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
	Center,
	ContactShadows,
	Environment,
	Lightformer,
	useGLTF,
	useTexture,
} from '@react-three/drei';
import {
	ACESFilmicToneMapping,
	CanvasTexture,
	MeshPhysicalMaterial,
	NoColorSpace,
	RepeatWrapping,
	SRGBColorSpace,
	type Group,
	type Mesh,
	type Texture,
} from 'three';
import canModelUrl from '../../assets/3D/can.glb?url';
import aluminiumUrl from '../../assets/texturas/aluminium.avif?url';
import blueberryUrl from '../../assets/texturas/blueberry.jpg?url';

useGLTF.preload(canModelUrl);

const CAN_SCALE = 0.6;
const BASE_SPIN_SPEED = 0;
const BOOST_SPIN_MULTIPLIER = 5;
/** Exactly 1 full 360° turn */
const BOOST_EXTRA_TURNS = 1.0;
/** Burst ~0.2s */
const BOOST_BURST_SPEED = Math.PI * 2 * BOOST_EXTRA_TURNS * 5.0;
/** Mantém 5x só no instante do burst */
const BOOST_HOLD_MS = 140;

type SpinState = {
	y: number;
	dragging: boolean;
	multiplier: number;
	boostUntil: number;
	burstRemaining: number;
};

type CanModelProps = {
	labelUrl?: string;
	labelUrls?: string[];
	spinBoostKey?: number;
	/** 0 = framing do hero, 1 = encaixado no dock da segunda dobra (ref evita re-render no scroll) */
	dockProgressRef?: MutableRefObject<number>;
	/** Spotlight pinned: giros extras em radianos (1 volta por sabor) */
	carouselSpinRef?: MutableRefObject<number>;
	/** Spotlight pinned ativo — trava idle spin e dirige o Y pelo scroll */
	carouselActiveRef?: MutableRefObject<boolean>;
};

function prepareTexture(
	source: Texture,
	{ srgb, flipY = false }: { srgb: boolean; flipY?: boolean },
): Texture {
	const texture = source.clone();
	texture.flipY = flipY;
	texture.wrapS = RepeatWrapping;
	texture.wrapT = RepeatWrapping;
	texture.anisotropy = 8;
	texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
	texture.needsUpdate = true;
	return texture;
}

function findShellMesh(root: Group): Mesh | null {
	let shell: Mesh | null = null;
	root.traverse((child) => {
		const mesh = child as Mesh;
		if (mesh.isMesh && mesh.name === 'Shell') shell = mesh;
	});
	return shell;
}

function applyCanMaterials(
	root: Group,
	aluminiumColor: Texture,
	aluminiumData: Texture,
	label: Texture,
) {
	root.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh) return;

		const previous = mesh.material;

		if (mesh.name === 'Shell') {
			mesh.material = new MeshPhysicalMaterial({
				map: label,
				metalnessMap: aluminiumData,
				bumpMap: aluminiumData,
				bumpScale: 0.012,
				metalness: 0.82,
				roughness: 0.13,
				envMapIntensity: 1.5,
				clearcoat: 1,
				clearcoatRoughness: 0.05,
				reflectivity: 1,
			});
		} else if (mesh.name === 'Top' || mesh.name === 'Bottom') {
			mesh.material = new MeshPhysicalMaterial({
				map: aluminiumColor,
				bumpMap: aluminiumData,
				bumpScale: 0.018,
				metalness: 0.98,
				roughness: 0.1,
				envMapIntensity: 1.85,
				clearcoat: 0.65,
				clearcoatRoughness: 0.1,
				reflectivity: 1,
			});
		}

		if (previous && previous !== mesh.material) {
			if (Array.isArray(previous)) previous.forEach((m) => m.dispose());
			else previous.dispose();
		}
	});
}

function StudioLights() {
	return (
		<>
			<ambientLight intensity={0.55} color="#f4f7ff" />
			<directionalLight position={[3.6, 5.2, 4.2]} intensity={2.8} color="#fff4e8" />
			<directionalLight position={[-4.2, 2.4, 2.8]} intensity={1.45} color="#dce8ff" />
			<directionalLight position={[-1.8, 3.6, -4.5]} intensity={1.55} color="#e8f0ff" />
			<directionalLight position={[0.4, -2.8, 1.6]} intensity={0.55} color="#f0ffe0" />
			<spotLight
				position={[1.8, 5.5, 2.4]}
				intensity={2.8}
				angle={0.32}
				penumbra={0.75}
				distance={16}
				decay={1.4}
				color="#ffffff"
				castShadow={false}
			/>
		</>
	);
}

function createFadedStripMap() {
	const size = 256;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const image = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / (size - 1);
			const v = y / (size - 1);
			const hx = Math.sin(u * Math.PI);
			const vy = Math.sin(v * Math.PI);
			const alpha = Math.pow(hx, 2.4) * Math.pow(vy, 1.35);
			const i = (y * size + x) * 4;
			const c = Math.round(255 * alpha);
			image.data[i] = c;
			image.data[i + 1] = c;
			image.data[i + 2] = c;
			image.data[i + 3] = 255;
		}
	}
	ctx.putImageData(image, 0, 0);

	const texture = new CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

function StudioEnvironment() {
	const fadedStripMap = useMemo(() => createFadedStripMap(), []);

	return (
		<Environment resolution={512} environmentIntensity={1.35}>
			<Lightformer
				form="rect"
				intensity={6.5}
				color="#ffffff"
				scale={[8, 1.4, 1]}
				position={[2.5, 3.8, 5]}
				target={[0, 0.2, 0]}
			/>
			<Lightformer
				form="rect"
				intensity={0.55}
				color="#eef3ff"
				scale={[1.35, 6.5, 1]}
				position={[-4.2, 1.2, 2.6]}
				target={[0, 0.15, 0]}
				map={fadedStripMap ?? undefined}
			/>
			<Lightformer
				form="rect"
				intensity={2.6}
				color="#ffe8c8"
				scale={[4.5, 0.55, 1]}
				position={[3.2, 1.8, -3.8]}
				target={[0, 0.2, 0]}
			/>
			<Lightformer
				form="rect"
				intensity={4.2}
				color="#ffffff"
				scale={[6, 0.22, 1]}
				position={[0.2, 2.2, 4.4]}
				target={[0, 0.1, 0]}
			/>
			<Lightformer
				form="circle"
				intensity={1.6}
				color="#f7f9ff"
				scale={5.5}
				position={[0, 6, 0.5]}
				target={[0, 0, 0]}
			/>
			<Lightformer
				form="rect"
				intensity={1.2}
				color="#f2ffe8"
				scale={[8, 4, 1]}
				position={[0, -3.2, 2]}
				target={[0, 0, 0]}
			/>
			<Lightformer
				form="ring"
				intensity={1.1}
				color="#e4ecff"
				scale={7}
				position={[0, 0.4, -5]}
				target={[0, 0.2, 0]}
			/>
		</Environment>
	);
}

const FRONT_Y = -Math.PI * 0.37;

function CanMesh({
	spin,
	onHeight,
	labelUrl,
	labelUrls,
	spinBoostKey,
	dockProgressRef,
	carouselSpinRef,
	carouselActiveRef,
}: {
	spin: MutableRefObject<SpinState>;
	onHeight: (height: number) => void;
	labelUrl: string;
	labelUrls: string[];
	spinBoostKey: number;
	dockProgressRef: MutableRefObject<number>;
	carouselSpinRef: MutableRefObject<number>;
	carouselActiveRef: MutableRefObject<boolean>;
}) {
	const groupRef = useRef<Group>(null);
	const modelRef = useRef<Group | null>(null);
	const preparedLabelsRef = useRef<Texture[]>([]);
	const lastBoostKey = useRef(spinBoostKey);
	const lastLabelUrl = useRef(labelUrl);
	const { scene } = useGLTF(canModelUrl);
	const aluminium = useTexture(aluminiumUrl);
	const labelTextures = useTexture(labelUrls);

	const model = useMemo(() => {
		const aluminiumColor = prepareTexture(aluminium, { srgb: true });
		const aluminiumData = prepareTexture(aluminium, { srgb: false });

		const sources = Array.isArray(labelTextures) ? labelTextures : [labelTextures];
		preparedLabelsRef.current = sources.map((source) =>
			prepareTexture(source, { srgb: true, flipY: true }),
		);

		const initialIndex = Math.max(0, labelUrls.indexOf(labelUrl));
		const initialLabel =
			preparedLabelsRef.current[initialIndex] ?? preparedLabelsRef.current[0];

		const cloned = scene.clone(true);
		applyCanMaterials(cloned, aluminiumColor, aluminiumData, initialLabel);
		modelRef.current = cloned;
		return cloned;
		// labelUrl só define o rótulo inicial; trocas posteriores vão no useFrame
		// eslint-disable-next-line react-hooks/exhaustive-deps -- model base estável
	}, [scene, aluminium, labelTextures, labelUrls]);

	useFrame((_, delta) => {
		if (!groupRef.current) return;

		// Troca de rótulo + boost no mesmo frame do clique (sem depender de useEffect)
		if (spinBoostKey !== lastBoostKey.current) {
			lastBoostKey.current = spinBoostKey;
			if (spinBoostKey > 0) {
				spin.current.multiplier = BOOST_SPIN_MULTIPLIER;
				spin.current.boostUntil = performance.now() + BOOST_HOLD_MS;
				spin.current.burstRemaining = Math.PI * 2 * BOOST_EXTRA_TURNS;
			}
		}

		if (labelUrl !== lastLabelUrl.current) {
			lastLabelUrl.current = labelUrl;
			const index = Math.max(0, labelUrls.indexOf(labelUrl));
			const nextLabel = preparedLabelsRef.current[index];
			const shell = modelRef.current ? findShellMesh(modelRef.current) : null;
			if (shell && nextLabel) {
				const material = shell.material as MeshPhysicalMaterial;
				material.map = nextLabel;
				material.needsUpdate = true;
			}
		}

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const dock = Math.min(1, Math.max(0, dockProgressRef.current));
		const carouselActive = carouselActiveRef.current;

		if (carouselActive && !spin.current.dragging) {
			// Pin do sabor: 1 volta por step, dirigido 1:1 pelo scroll
			spin.current.y = FRONT_Y + carouselSpinRef.current;
			spin.current.burstRemaining = 0;
		} else {
			// Desacelera e trava a frente conforme a lata encaixa no dock
			const spinFactor = Math.max(0, 1 - dock * 1.15);

			if (!spin.current.dragging && !reducedMotion) {
				const boosting =
					spin.current.burstRemaining > 0 ||
					performance.now() < spin.current.boostUntil;

				spin.current.multiplier = boosting ? BOOST_SPIN_MULTIPLIER : 1;

				if (spin.current.burstRemaining > 0 && spinFactor > 0.05) {
					const step = Math.min(
						spin.current.burstRemaining,
						delta * BOOST_BURST_SPEED * spinFactor,
					);
					spin.current.y += step;
					spin.current.burstRemaining -= step;
				}

				if (spinFactor > 0.02) {
					spin.current.y +=
						delta * BASE_SPIN_SPEED * spin.current.multiplier * spinFactor;
				}
			}

			if (!spin.current.dragging && spin.current.burstRemaining <= 0) {
				const twoPi = Math.PI * 2;
				const turns = Math.round((spin.current.y - FRONT_Y) / twoPi);
				const target = FRONT_Y + turns * twoPi;
				const easeFactor = dock > 0.35 ? Math.min(1, dock * 0.18) : 0.15;
				spin.current.y += (target - spin.current.y) * easeFactor;
			}
		}

		// Spotlight: inclina na diagonal (hero = reto → dock = tipado)
		const tiltX = -0.22 * dock; // ~-12.5°
		const tiltZ = 0.32 * dock; // ~18°

		groupRef.current.rotation.x = tiltX;
		groupRef.current.rotation.y = spin.current.y;
		groupRef.current.rotation.z = tiltZ;
		groupRef.current.position.set(0, 0, 0);
		groupRef.current.scale.setScalar(1);
	});

	return (
		<group ref={groupRef}>
			<Center
				onCentered={({ height }) => {
					onHeight(height);
				}}
			>
				<primitive object={model} scale={CAN_SCALE} />
			</Center>
		</group>
	);
}

export default function CanModel({
	labelUrl = blueberryUrl,
	labelUrls = [blueberryUrl],
	spinBoostKey = 0,
	dockProgressRef,
	carouselSpinRef,
	carouselActiveRef,
}: CanModelProps) {
	const canvasRef = useRef<HTMLDivElement>(null);
	const localDockProgress = useRef(0);
	const localCarouselSpin = useRef(0);
	const localCarouselActive = useRef(false);
	const dockRef = dockProgressRef ?? localDockProgress;
	const spinRef = carouselSpinRef ?? localCarouselSpin;
	const activeRef = carouselActiveRef ?? localCarouselActive;
	const spin = useRef<SpinState>({
		y: FRONT_Y,
		dragging: false,
		multiplier: 1,
		boostUntil: 0,
		burstRemaining: 0,
	});
	const lastX = useRef(0);
	const [floorY, setFloorY] = useState(-1.45);

	useEffect(() => {
		const el = canvasRef.current;
		if (!el) return;

		const onPointerDown = (event: PointerEvent) => {
			spin.current.dragging = true;
			lastX.current = event.clientX;
			el.setPointerCapture(event.pointerId);
		};

		const onPointerMove = (event: PointerEvent) => {
			if (!spin.current.dragging) return;
			const deltaX = event.clientX - lastX.current;
			lastX.current = event.clientX;
			spin.current.y += deltaX * 0.01;
		};

		const onPointerUp = (event: PointerEvent) => {
			spin.current.dragging = false;
			if (el.hasPointerCapture(event.pointerId)) {
				el.releasePointerCapture(event.pointerId);
			}
		};

		el.addEventListener('pointerdown', onPointerDown);
		el.addEventListener('pointermove', onPointerMove);
		el.addEventListener('pointerup', onPointerUp);
		el.addEventListener('pointercancel', onPointerUp);

		return () => {
			el.removeEventListener('pointerdown', onPointerDown);
			el.removeEventListener('pointermove', onPointerMove);
			el.removeEventListener('pointerup', onPointerUp);
			el.removeEventListener('pointercancel', onPointerUp);
		};
	}, []);

	return (
		<div ref={canvasRef} className="hero__can-canvas" aria-hidden="true">
			<Canvas
				camera={{ position: [0, 0.2, 7.6], fov: 30, near: 0.1, far: 50 }}
				dpr={[1, 1.75]}
				gl={{
					alpha: true,
					antialias: true,
					powerPreference: 'high-performance',
					toneMapping: ACESFilmicToneMapping,
					toneMappingExposure: 1.28,
				}}
				style={{ width: '100%', height: '100%', background: 'transparent' }}
			>
				<StudioLights />
				<Suspense fallback={null}>
					<group>
						<CanMesh
							spin={spin}
							labelUrl={labelUrl}
							labelUrls={labelUrls}
							spinBoostKey={spinBoostKey}
							dockProgressRef={dockRef}
							carouselSpinRef={spinRef}
							carouselActiveRef={activeRef}
							onHeight={(height) => {
								setFloorY(-height / 2);
							}}
						/>
						<DockShadows floorY={floorY} dockProgressRef={dockRef} />
					</group>
					<StudioEnvironment />
				</Suspense>
			</Canvas>
		</div>
	);
}

function DockShadows({
	floorY,
	dockProgressRef,
}: {
	floorY: number;
	dockProgressRef: MutableRefObject<number>;
}) {
	const groupRef = useRef<Group>(null);

	useFrame(() => {
		if (!groupRef.current) return;
		const opacity = Math.max(0, 1 - dockProgressRef.current * 1.05);
		groupRef.current.visible = opacity > 0.02;
		groupRef.current.traverse((child) => {
			const mesh = child as Mesh;
			if (!mesh.isMesh) return;
			const material = mesh.material as { opacity?: number; transparent?: boolean };
			if (material && typeof material.opacity === 'number') {
				material.transparent = true;
				material.opacity = 0.38 * opacity;
			}
		});
	});

	return (
		<group ref={groupRef}>
			<ContactShadows
				position={[0, floorY, 0]}
				opacity={0.38}
				scale={9}
				blur={2.8}
				far={3.2}
				resolution={1024}
				color="#2a3510"
			/>
		</group>
	);
}

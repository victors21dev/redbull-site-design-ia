import { Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Center, Environment, useGLTF, useTexture } from '@react-three/drei';
import {
	ACESFilmicToneMapping,
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
import { DEFAULT_PRODUCTS, type ProductSlide } from '../hero/MonsterProductHero';

useGLTF.preload(canModelUrl);

const CAN_SCALE = 0.95;
const CAN_BASE_Y = -1.15;
const FRONT_Y = -Math.PI * 0.37;
const EDGE_PAD = 0.055;

function prepareTexture(
	source: Texture,
	{ srgb, flipY = false }: { srgb: boolean; flipY?: boolean },
): Texture {
	const texture = source.clone();
	texture.flipY = flipY;
	texture.wrapS = RepeatWrapping;
	texture.wrapT = RepeatWrapping;
	texture.anisotropy = 4;
	texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
	texture.needsUpdate = true;
	return texture;
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
				bumpScale: 0.01,
				metalness: 0.82,
				roughness: 0.14,
				envMapIntensity: 1.35,
				clearcoat: 1,
				clearcoatRoughness: 0.06,
				reflectivity: 1,
			});
		} else if (mesh.name === 'Top' || mesh.name === 'Bottom') {
			mesh.material = new MeshPhysicalMaterial({
				map: aluminiumColor,
				bumpMap: aluminiumData,
				bumpScale: 0.016,
				metalness: 0.98,
				roughness: 0.12,
				envMapIntensity: 1.6,
				clearcoat: 0.55,
				clearcoatRoughness: 0.12,
				reflectivity: 1,
			});
		}

		if (previous && previous !== mesh.material) {
			if (Array.isArray(previous)) previous.forEach((m) => m.dispose());
			else previous.dispose();
		}
	});
}

function LineupCan({ labelUrl, x }: { labelUrl: string; x: number }) {
	const { scene } = useGLTF(canModelUrl);
	const aluminium = useTexture(aluminiumUrl);
	const labelSource = useTexture(labelUrl);

	const model = useMemo(() => {
		const aluminiumColor = prepareTexture(aluminium, { srgb: true });
		const aluminiumData = prepareTexture(aluminium, { srgb: false });
		const label = prepareTexture(labelSource, { srgb: true, flipY: true });
		const cloned = scene.clone(true);
		applyCanMaterials(cloned, aluminiumColor, aluminiumData, label);
		return cloned;
	}, [scene, aluminium, labelSource]);

	return (
		<group position={[x, CAN_BASE_Y, 0]} rotation={[0, FRONT_Y, 0]}>
			<Center>
				<primitive object={model} scale={CAN_SCALE} />
			</Center>
		</group>
	);
}

function LineupScene({ products }: { products: ProductSlide[] }) {
	const { viewport } = useThree();
	const count = products.length;

	const positions = useMemo(() => {
		if (count <= 1) return [0];
		const pad = viewport.width * EDGE_PAD;
		const usable = Math.max(viewport.width - pad * 2, 0.1);
		const start = -usable / 2;
		const step = usable / (count - 1);
		return Array.from({ length: count }, (_, i) => start + i * step);
	}, [count, viewport.width]);

	return (
		<>
			<ambientLight intensity={0.65} color="#f4f7ff" />
			<directionalLight position={[2.8, 4.2, 3.5]} intensity={2.2} color="#fff4e8" />
			<directionalLight position={[-3.2, 1.8, 2]} intensity={1.1} color="#dce8ff" />
			<Environment preset="city" environmentIntensity={0.85} />
			{products.map((product, index) => (
				<LineupCan
					key={product.id}
					labelUrl={product.labelUrl}
					x={positions[index] ?? 0}
				/>
			))}
		</>
	);
}

type FlavorCanLineupProps = {
	products?: ProductSlide[];
};

export default function FlavorCanLineup({
	products = DEFAULT_PRODUCTS,
}: FlavorCanLineupProps) {
	return (
		<div className="finale-lineup" aria-label="Sabores Red Bull">
			<div className="finale-lineup__stage" aria-hidden="true">
				<Canvas
					orthographic
					camera={{ position: [0, 0, 10], zoom: 95, near: 0.1, far: 40 }}
					dpr={[1, 1.5]}
					gl={{
						alpha: true,
						antialias: true,
						powerPreference: 'high-performance',
						toneMapping: ACESFilmicToneMapping,
						toneMappingExposure: 1.2,
					}}
					style={{ width: '100%', height: '100%', background: 'transparent' }}
				>
					<Suspense fallback={null}>
						<LineupScene products={products} />
					</Suspense>
				</Canvas>
			</div>
		</div>
	);
}

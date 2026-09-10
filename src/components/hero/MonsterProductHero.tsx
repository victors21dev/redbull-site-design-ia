import { useMemo, useState, type CSSProperties } from 'react';
import {
	ChevronLeft,
	ChevronRight,
	CircleUserRound,
	Menu,
	ShoppingBag,
} from 'lucide-react';
import CanModel from './CanModel';
import blueberryUrl from '../../assets/texturas/blueberry.jpg?url';
import originalUrl from '../../assets/texturas/original.jpg?url';
import purpleUrl from '../../assets/texturas/purple.jpg?url';
import summerUrl from '../../assets/texturas/summer.jpg?url';
import summer2Url from '../../assets/texturas/summer2.jpg?url';
import watermelonUrl from '../../assets/texturas/watermelon.avif?url';
import winterUrl from '../../assets/texturas/winter.jpg?url';
import blueberrySceneUrl from '../../assets/backgrounds/blueberry.avif?url';
import originalSceneUrl from '../../assets/backgrounds/original.avif?url';
import purpleSceneUrl from '../../assets/backgrounds/purple.avif?url';
import summerSceneUrl from '../../assets/backgrounds/summer.avif?url';
import summer2SceneUrl from '../../assets/backgrounds/summer2.avif?url';
import watermelonSceneUrl from '../../assets/backgrounds/watermelon.avif?url';
import winterSceneUrl from '../../assets/backgrounds/winter.avif?url';
import './MonsterProductHero.css';

export type ProductSlide = {
	id: string;
	brand: string;
	flavorTitle: string;
	description: string;
	background: string;
	/** Cor sólida do card da segunda dobra (alinhada ao sabor) */
	accent: string;
	/** Imagem de cena da dobra do sabor */
	sceneUrl: string;
	labelUrl: string;
	sizesMl: number[];
	defaultSizeMl: number;
	detailsHref: string;
};

function parseHex(hex: string): [number, number, number] | null {
	const raw = hex.replace('#', '').trim();
	const full =
		raw.length === 3
			? raw
					.split('')
					.map((c) => c + c)
					.join('')
			: raw;
	if (full.length !== 6) return null;
	const n = Number.parseInt(full, 16);
	if (Number.isNaN(n)) return null;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
	return `#${[clamp(r), clamp(g), clamp(b)]
		.map((v) => v.toString(16).padStart(2, '0'))
		.join('')}`;
}

/** Mistura accent → preto/branco pra montar o gradiente do REDBULL. */
function mixHex(hex: string, target: '#000000' | '#ffffff', amount: number): string {
	const rgb = parseHex(hex);
	const other = parseHex(target);
	if (!rgb || !other) return hex;
	const t = Math.min(1, Math.max(0, amount));
	return toHex(
		rgb[0] + (other[0] - rgb[0]) * t,
		rgb[1] + (other[1] - rgb[1]) * t,
		rgb[2] + (other[2] - rgb[2]) * t,
	);
}

function wordGradientFromAccent(accent: string): {
	word0: string;
	word1: string;
	word2: string;
	word3: string;
	word4: string;
} {
	return {
		word0: mixHex(accent, '#000000', 0.88),
		word1: mixHex(accent, '#000000', 0.55),
		word2: accent,
		word3: mixHex(accent, '#ffffff', 0.55),
		word4: '#ffffff',
	};
}

type MonsterProductHeroProps = {
	products?: ProductSlide[];
	initialProductIndex?: number;
	initialVolumeMl?: number;
	cartCount?: number;
	/** Índice controlado pelo parent (ex.: RedBullExperience) */
	activeIndex?: number;
	spinBoostKey?: number;
	onProductIndexChange?: (index: number) => void;
	/** Quando true, a lata 3D fica no CanFlight (slot vazio no hero) */
	externalCan?: boolean;
};

export const DEFAULT_PRODUCTS: ProductSlide[] = [
	{
		id: 'redbull-blueberry',
		brand: 'Red Bull',
		flavorTitle: 'Edição de Verão',
		description:
			'O sabor de mirtilo. Energia gelada com sabor intenso — asas para dias longos e noites que pedem mais.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #5B5FA8 0%, #3D4180 46%, #2A2E66 100%)',
		accent: '#3D4180',
		sceneUrl: blueberrySceneUrl,
		labelUrl: blueberryUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-original',
		brand: 'Red Bull',
		flavorTitle: 'Original',
		description:
			'O clássico que dá asas. Sabor inconfundível, energia limpa e o impulso que acompanha quem não para.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #3A5FBF 0%, #1E3A8A 46%, #0F2557 100%)',
		accent: '#1E3A8A',
		sceneUrl: originalSceneUrl,
		labelUrl: originalUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 355,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-purple',
		brand: 'Red Bull',
		flavorTitle: 'Edição Roxa',
		description:
			'Sabor de frutas vermelhas do bosque. Uma edição vibrante para quem quer energia com personalidade.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #A855C8 0%, #7B2D9B 46%, #5A1A78 100%)',
		accent: '#7B2D9B',
		sceneUrl: purpleSceneUrl,
		labelUrl: purpleUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-summer',
		brand: 'Red Bull',
		flavorTitle: 'Juneberry',
		description:
			'Edição de verão com sabor Juneberry. Frescor azul intenso para manter o ritmo no calor.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #3B82F6 0%, #1D4ED8 46%, #1E3A8A 100%)',
		accent: '#1D4ED8',
		sceneUrl: summerSceneUrl,
		labelUrl: summerUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-beach-breeze',
		brand: 'Red Bull',
		flavorTitle: 'Beach Breeze',
		description:
			'Edição de verão Beach Breeze. Toque tropical e refrescante — energia de verão o ano todo.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #5EEAD4 0%, #14B8A6 46%, #0F766E 100%)',
		accent: '#14B8A6',
		sceneUrl: summer2SceneUrl,
		labelUrl: summer2Url,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-watermelon',
		brand: 'Red Bull',
		flavorTitle: 'Edição Vermelha',
		description:
			'Melancia com atitude. Doce, refrescante e pronta para entregar asas quando o ritmo sobe.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #F472B6 0%, #E11D48 46%, #9F1239 100%)',
		accent: '#E11D48',
		sceneUrl: watermelonSceneUrl,
		labelUrl: watermelonUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
	{
		id: 'redbull-winter',
		brand: 'Red Bull',
		flavorTitle: 'Edição de Inverno',
		description:
			'Figo e maçã para aquecer o foco. A edição de inverno com sabor marcante e a mesma energia Red Bull.',
		background:
			'radial-gradient(ellipse 58% 80% at 50% 53%, #2DD4BF 0%, #0F766E 46%, #134E4A 100%)',
		accent: '#0F766E',
		sceneUrl: winterSceneUrl,
		labelUrl: winterUrl,
		sizesMl: [250, 355, 500],
		defaultSizeMl: 250,
		detailsHref: '#product-details',
	},
];

const NAV_ITEMS = [
	{ label: 'Sabores', href: '#sabores' },
	{ label: 'Bebidas', href: '#bebidas' },
	{ label: 'Frutas', href: '#frutas' },
	{ label: 'Sobre', href: '#sobre' },
	{ label: 'Contato', href: '#contato' },
] as const;

export default function MonsterProductHero({
	products = DEFAULT_PRODUCTS,
	initialProductIndex = 0,
	initialVolumeMl,
	cartCount = 2,
	activeIndex: controlledIndex,
	spinBoostKey: controlledSpinKey,
	onProductIndexChange,
	externalCan = false,
}: MonsterProductHeroProps) {
	const safeProducts = products.length > 0 ? products : DEFAULT_PRODUCTS;
	const [internalIndex, setInternalIndex] = useState(
		Math.min(Math.max(initialProductIndex, 0), safeProducts.length - 1),
	);
	const [internalSpinKey, setInternalSpinKey] = useState(0);

	const activeIndex = controlledIndex ?? internalIndex;
	const spinBoostKey = controlledSpinKey ?? internalSpinKey;
	const product = safeProducts[activeIndex];
	const [volumeMl, setVolumeMl] = useState(
		initialVolumeMl ?? product.defaultSizeMl,
	);

	const sizes = useMemo(() => product.sizesMl, [product.sizesMl]);
	const labelUrls = useMemo(
		() => safeProducts.map((item) => item.labelUrl),
		[safeProducts],
	);
	const wordStops = useMemo(
		() => wordGradientFromAccent(product.accent),
		[product.accent],
	);

	const goToProduct = (direction: -1 | 1) => {
		const next = (activeIndex + direction + safeProducts.length) % safeProducts.length;
		setVolumeMl(safeProducts[next].defaultSizeMl);
		if (onProductIndexChange) {
			onProductIndexChange(next);
		} else {
			setInternalIndex(next);
			setInternalSpinKey((key) => key + 1);
		}
	};

	const heroStyle = {
		background: product.background,
		'--hero-accent': product.accent,
		'--hero-word-0': wordStops.word0,
		'--hero-word-1': wordStops.word1,
		'--hero-word-2': wordStops.word2,
		'--hero-word-3': wordStops.word3,
		'--hero-word-4': wordStops.word4,
	} as CSSProperties;

	return (
		<main id="redbull-product-hero" className="hero" style={heroStyle}>
			<header className="hero__header">
				<a className="hero__brand" href="/">
					{product.brand}
				</a>

				<nav className="hero__nav" aria-label="Navegação principal">
					{NAV_ITEMS.map((item) => (
						<a key={item.href} className="hero__nav-link" href={item.href}>
							{item.label}
						</a>
					))}
				</nav>

				<div className="hero__actions">
					<button
						type="button"
						className="hero__menu-btn"
						aria-label="Abrir menu"
					>
						<Menu size={26} strokeWidth={2.25} aria-hidden="true" />
					</button>
					<button type="button" className="hero__icon-btn" aria-label="Abrir conta">
						<CircleUserRound size={31} strokeWidth={2.25} aria-hidden="true" />
					</button>
					<button
						type="button"
						className="hero__icon-btn"
						aria-label={`Abrir sacola, ${cartCount} itens`}
					>
						<ShoppingBag size={30} strokeWidth={2.25} aria-hidden="true" />
						<span className="hero__badge" aria-hidden="true">
							{cartCount}
						</span>
					</button>
				</div>
			</header>

			<div className="hero__word" aria-hidden="true">
				REDBULL
			</div>

			<section className="hero__copy" aria-labelledby="flavor-heading">
				<h1 id="flavor-heading" className="hero__title">
					{product.flavorTitle}
				</h1>
				<p className="hero__description">{product.description}</p>
				<a className="hero__cta" href={product.detailsHref} role="button">
					Ver mais
				</a>
			</section>

			<figure
				className="hero__product"
				data-can-slot="hero"
				aria-label={`Lata 3D Red Bull ${product.flavorTitle}`}
			>
				{externalCan ? null : (
					<CanModel
						labelUrl={product.labelUrl}
						labelUrls={labelUrls}
						spinBoostKey={spinBoostKey}
					/>
				)}
			</figure>

			<div
				className="hero__sizes"
				role="radiogroup"
				aria-label="Selecionar volume da lata"
				onKeyDown={(event) => {
					const current = sizes.indexOf(volumeMl);
					if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
						event.preventDefault();
						setVolumeMl(sizes[(current + 1) % sizes.length]);
					}
					if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
						event.preventDefault();
						setVolumeMl(sizes[(current - 1 + sizes.length) % sizes.length]);
					}
				}}
			>
				{sizes.map((size) => {
					const selected = size === volumeMl;
					return (
						<button
							key={size}
							type="button"
							role="radio"
							aria-checked={selected}
							aria-label={`${size} mililitros`}
							tabIndex={selected ? 0 : -1}
							className={`hero__size${selected ? ' is-active' : ''}`}
							onClick={() => setVolumeMl(size)}
						>
							<span>{size}</span>
							<span>ML</span>
						</button>
					);
				})}
			</div>

			<div className="hero__carousel">
				<button
					type="button"
					className="hero__carousel-btn"
					aria-label="Sabor anterior"
					onClick={() => goToProduct(-1)}
				>
					<ChevronLeft size={28} strokeWidth={2} aria-hidden="true" />
				</button>
				<button
					type="button"
					className="hero__carousel-btn"
					aria-label="Próximo sabor"
					onClick={() => goToProduct(1)}
				>
					<ChevronRight size={28} strokeWidth={2} aria-hidden="true" />
				</button>
			</div>

			<a className="hero__scroll" href="#product-details">
				Role
				<br />
				para baixo
			</a>
		</main>
	);
}

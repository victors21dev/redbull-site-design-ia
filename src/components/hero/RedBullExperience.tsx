import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MonsterProductHero, {
	DEFAULT_PRODUCTS,
	type ProductSlide,
} from './MonsterProductHero';
import CanFlight from './CanFlight';
import FlavorSpotlight from './FlavorSpotlight';

type RedBullExperienceProps = {
	products?: ProductSlide[];
	initialProductIndex?: number;
};

function hexToRgbChannels(hex: string): string {
	const raw = hex.replace('#', '').trim();
	const full =
		raw.length === 3
			? raw
					.split('')
					.map((c) => c + c)
					.join('')
			: raw;
	const n = Number.parseInt(full, 16);
	if (Number.isNaN(n) || full.length !== 6) return '0 15 30';
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return `${r} ${g} ${b}`;
}

function syncStageAccent(accent: string) {
	const stage = document.querySelector<HTMLElement>('.product-stage');
	if (!stage) return;
	stage.style.setProperty('--square-background', accent);
	stage.style.setProperty('--scheme-background', accent);
	stage.style.setProperty('--scheme-can-shadow-rgb', hexToRgbChannels(accent));
	stage.dataset.accent = accent;
}

export default function RedBullExperience({
	products = DEFAULT_PRODUCTS,
	initialProductIndex = 0,
}: RedBullExperienceProps) {
	const safeProducts = products.length > 0 ? products : DEFAULT_PRODUCTS;
	const [activeIndex, setActiveIndex] = useState(
		Math.min(Math.max(initialProductIndex, 0), safeProducts.length - 1),
	);
	const [spinBoostKey, setSpinBoostKey] = useState(0);
	const carouselSpinRef = useRef(0);
	const carouselActiveRef = useRef(false);

	const product = safeProducts[activeIndex];
	const labelUrls = useMemo(
		() => safeProducts.map((item) => item.labelUrl),
		[safeProducts],
	);

	const handleSpotlightIndex = useCallback((index: number) => {
		setActiveIndex(index);
	}, []);

	useEffect(() => {
		syncStageAccent(product.accent);
		const id = window.setTimeout(() => syncStageAccent(product.accent), 0);
		return () => window.clearTimeout(id);
	}, [product.accent]);

	/*
	 * A dobra do sabor mora depois do Benefits/Ingredients no DOM (slot do
	 * Astro), mas depende do sabor ativo daqui — portal resolve os dois.
	 */
	const [spotlightHost, setSpotlightHost] = useState<HTMLElement | null>(null);
	useEffect(() => {
		const find = () => document.getElementById('flavor-spotlight-slot');
		const host = find();
		if (host) {
			setSpotlightHost(host);
			return;
		}
		const id = window.setTimeout(() => setSpotlightHost(find()), 0);
		return () => window.clearTimeout(id);
	}, []);

	return (
		<>
			<MonsterProductHero
				products={safeProducts}
				activeIndex={activeIndex}
				spinBoostKey={spinBoostKey}
				onProductIndexChange={(next) => {
					setActiveIndex(next);
					setSpinBoostKey((key) => key + 1);
				}}
				externalCan
			/>
			{spotlightHost
				? createPortal(
						<FlavorSpotlight
							products={safeProducts}
							activeIndex={activeIndex}
							onIndexChange={handleSpotlightIndex}
							carouselSpinRef={carouselSpinRef}
							carouselActiveRef={carouselActiveRef}
						/>,
						spotlightHost,
					)
				: null}
			<CanFlight
				labelUrl={product.labelUrl}
				labelUrls={labelUrls}
				spinBoostKey={spinBoostKey}
				carouselSpinRef={carouselSpinRef}
				carouselActiveRef={carouselActiveRef}
			/>
		</>
	);
}

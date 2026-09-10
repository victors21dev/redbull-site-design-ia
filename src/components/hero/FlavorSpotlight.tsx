import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ProductSlide } from './MonsterProductHero';
import './FlavorSpotlight.css';

gsap.registerPlugin(ScrollTrigger);

export type FlavorSpotlightProps = {
	products: ProductSlide[];
	activeIndex: number;
	onIndexChange: (index: number) => void;
	carouselSpinRef: MutableRefObject<number>;
	carouselActiveRef: MutableRefObject<boolean>;
};

function clamp(v: number, min: number, max: number) {
	return Math.min(max, Math.max(min, v));
}

export default function FlavorSpotlight({
	products,
	activeIndex,
	onIndexChange,
	carouselSpinRef,
	carouselActiveRef,
}: FlavorSpotlightProps) {
	const sectionRef = useRef<HTMLElement>(null);
	const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
	const displaceRef = useRef<SVGFEDisplacementMapElement>(null);
	const activeIndexRef = useRef(activeIndex);
	const lastEmittedIndex = useRef(activeIndex);
	const startIndexRef = useRef(activeIndex);
	const reactId = useId();
	const filterId = `spotlight-distort-${reactId.replace(/:/g, '')}`;

	activeIndexRef.current = activeIndex;

	const activeProduct = products[activeIndex] ?? products[0];
	const style = {
		'--spotlight-accent': activeProduct?.accent ?? '#3D4180',
		'--spotlight-distort': `url(#${filterId})`,
	} as CSSProperties;

	// Fora do pin: hero manda no sabor visível
	useEffect(() => {
		const section = sectionRef.current;
		if (!section || carouselActiveRef.current) return;

		section.style.setProperty(
			'--spotlight-accent',
			products[activeIndex]?.accent ?? '#3D4180',
		);
		section.querySelectorAll<HTMLElement>('[data-spotlight-scene]').forEach((node, i) => {
			node.style.opacity = i === activeIndex ? '1' : '0';
		});
		section.querySelectorAll<HTMLElement>('[data-spotlight-title]').forEach((node, i) => {
			node.style.opacity = i === activeIndex ? '1' : '0';
		});
	}, [activeIndex, products, carouselActiveRef]);

	useEffect(() => {
		const section = sectionRef.current;
		if (!section || products.length === 0) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reducedMotion) {
			section.classList.add('is-reduced-motion');
		}

		const scenes = section.querySelectorAll<HTMLElement>('[data-spotlight-scene]');
		const titles = section.querySelectorAll<HTMLElement>('[data-spotlight-title]');
		const steps = Math.max(1, products.length - 1);

		const applyVisual = (productIndex: number, floatStep: number) => {
			const product = products[productIndex];
			if (!product) return;

			section.style.setProperty('--spotlight-accent', product.accent);
			section.setAttribute('aria-label', `Red Bull ${product.flavorTitle}`);

			scenes.forEach((node, i) => {
				node.style.opacity = i === productIndex ? '1' : '0';
			});
			titles.forEach((node, i) => {
				node.style.opacity = i === productIndex ? '1' : '0';
			});

			carouselSpinRef.current = floatStep * Math.PI * 2;

			if (productIndex !== lastEmittedIndex.current) {
				lastEmittedIndex.current = productIndex;
				onIndexChange(productIndex);
			}
		};

		const ctx = gsap.context(() => {
			if (!reducedMotion) {
				const turbulence = turbulenceRef.current;
				const displace = displaceRef.current;
				if (turbulence && displace) {
					const wave = { fx: 0.012, fy: 0.016, scale: 42 };
					const syncFilter = () => {
						turbulence.setAttribute('baseFrequency', `${wave.fx} ${wave.fy}`);
						displace.setAttribute('scale', String(wave.scale));
					};
					syncFilter();

					gsap.to(wave, {
						fx: 0.022,
						fy: 0.03,
						duration: 6,
						repeat: -1,
						yoyo: true,
						ease: 'sine.inOut',
						onUpdate: syncFilter,
					});

					gsap.to(wave, {
						scale: 72,
						duration: 4.5,
						repeat: -1,
						yoyo: true,
						ease: 'sine.inOut',
						onUpdate: syncFilter,
					});
				}
			}

			const setCarouselActive = (active: boolean) => {
				carouselActiveRef.current = active;
				section.dataset.pinned = active ? 'true' : 'false';
			};

			ScrollTrigger.create({
				trigger: section,
				pin: true,
				scrub: true,
				anticipatePin: 1,
				start: 'top top',
				end: () => `+=${steps * window.innerHeight}`,
				invalidateOnRefresh: true,
				onEnter: () => {
					startIndexRef.current = activeIndexRef.current;
					setCarouselActive(true);
				},
				onEnterBack: () => {
					setCarouselActive(true);
				},
				onLeave: () => {
					setCarouselActive(false);
				},
				onLeaveBack: () => {
					setCarouselActive(false);
					carouselSpinRef.current = 0;
				},
				onUpdate: (self) => {
					const floatStep = self.progress * steps;
					const offset = Math.round(floatStep);
					const productIndex =
						(startIndexRef.current + clamp(offset, 0, steps)) % products.length;
					applyVisual(productIndex, floatStep);
				},
				onRefresh: (self) => {
					if (self.isActive) setCarouselActive(true);
					const floatStep = self.progress * steps;
					const offset = Math.round(floatStep);
					const productIndex =
						(startIndexRef.current + clamp(offset, 0, steps)) % products.length;
					applyVisual(productIndex, self.isActive ? floatStep : 0);
				},
			});

			// Estado inicial (antes do pin)
			applyVisual(activeIndexRef.current, 0);
		}, section);

		return () => {
			carouselActiveRef.current = false;
			ctx.revert();
		};
		// products/onIndexChange estáveis o bastante; refs evitam re-bind no scroll
		// eslint-disable-next-line react-hooks/exhaustive-deps -- pin uma vez por lista
	}, [products, carouselSpinRef, carouselActiveRef, onIndexChange]);

	return (
		<section
			ref={sectionRef}
			id="flavour"
			className="flavor-spotlight"
			style={style}
			aria-label={`Red Bull ${activeProduct?.flavorTitle ?? 'Sabor'}`}
		>
			<svg className="flavor-spotlight__svg" aria-hidden="true" focusable="false">
				<defs>
					<filter
						id={filterId}
						x="-8%"
						y="-8%"
						width="116%"
						height="116%"
						colorInterpolationFilters="sRGB"
					>
						<feTurbulence
							ref={turbulenceRef}
							type="fractalNoise"
							baseFrequency="0.012 0.016"
							numOctaves="3"
							seed="2"
							result="noise"
						/>
						<feDisplacementMap
							ref={displaceRef}
							in="SourceGraphic"
							in2="noise"
							scale="42"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>
				</defs>
			</svg>

			<div className="flavor-spotlight__pin" data-flavor-spotlight-inner>
				<div className="flavor-spotlight__scenes" aria-hidden="true">
					{products.map((product, index) => (
						<div
							key={product.id}
							className="flavor-spotlight__scene"
							data-spotlight-scene
							style={
								{
									'--spotlight-scene': `url(${product.sceneUrl})`,
									'--spotlight-accent': product.accent,
									opacity: index === activeIndex ? 1 : 0,
								} as CSSProperties
							}
						/>
					))}
				</div>

				<h2 className="flavor-spotlight__title">
					{products.map((product, index) => (
						<span
							key={product.id}
							className="flavor-spotlight__title-text"
							data-spotlight-title
							style={{ opacity: index === activeIndex ? 1 : 0 }}
						>
							{product.flavorTitle}
						</span>
					))}
				</h2>

				<div
					className="flavor-spotlight__dock"
					data-can-slot="spotlight"
					aria-hidden="true"
				/>
			</div>
		</section>
	);
}

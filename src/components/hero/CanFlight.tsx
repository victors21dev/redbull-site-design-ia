import { useEffect, useRef, type MutableRefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CanModel from './CanModel';
import blueberryUrl from '../../assets/texturas/blueberry.jpg?url';
import './CanFlight.css';

gsap.registerPlugin(ScrollTrigger);

/** Zoom da câmera ortográfica do lineup final — mantenha igual a FlavorCanLineup.tsx */
const FINALE_ZOOM = 95;
/** Y (mundo) da lata no lineup final — mantenha igual a CAN_BASE_Y em FlavorCanLineup.tsx */
const FINALE_CAN_WORLD_Y = -1.15;
/** Escala da lata ao encaixar no lineup final (ajustada visualmente) */
const FINALE_TARGET_SCALE = 0.34;

export type CanFlightProps = {
	labelUrl?: string;
	labelUrls?: string[];
	spinBoostKey?: number;
	carouselSpinRef?: MutableRefObject<number>;
	carouselActiveRef?: MutableRefObject<boolean>;
};

type Rect = { left: number; top: number; width: number; height: number; cx: number; cy: number };

function readRect(el: Element | null): Rect | null {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return null;
	return {
		left: r.left,
		top: r.top,
		width: r.width,
		height: r.height,
		cx: r.left + r.width / 2,
		cy: r.top + r.height / 2,
	};
}

/**
 * Posição alvo da lata do meio no lineup final (mesma matemática da câmera
 * ortográfica: 1 unidade de mundo = FINALE_ZOOM px, centro do stage = x/y 0).
 */
function readFinaleTarget(): Rect | null {
	const stage = document.querySelector('.finale-lineup');
	if (!stage) return null;
	const style = getComputedStyle(stage);
	if (style.display === 'none' || style.visibility === 'hidden') return null;
	const r = stage.getBoundingClientRect();
	if (r.width < 2 || r.height < 2) return null;
	return {
		left: r.left,
		top: r.top,
		width: r.width,
		height: r.height,
		cx: r.left + r.width / 2,
		cy: r.top + r.height / 2 - FINALE_CAN_WORLD_Y * FINALE_ZOOM,
	};
}

function visibleSlot(selector: string): Element | null {
	const nodes = document.querySelectorAll(selector);
	for (const node of nodes) {
		const style = getComputedStyle(node);
		if (style.display === 'none' || style.visibility === 'hidden') continue;
		const parent = node.closest(
			'.can-container, .can-mobile, .hero__product, .flavor-spotlight',
		);
		if (parent) {
			const ps = getComputedStyle(parent);
			if (ps.display === 'none' || ps.visibility === 'hidden') continue;
		}
		const r = node.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		return node;
	}
	return null;
}

function clamp(v: number, min = 0, max = 1) {
	return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

/** Ease profissional no caminho (não atrasa o scroll — só remapeia o progresso) */
function easeInOutCubic(t: number) {
	const x = clamp(t);
	return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export default function CanFlight({
	labelUrl = blueberryUrl,
	labelUrls = [blueberryUrl],
	spinBoostKey = 0,
	carouselSpinRef,
	carouselActiveRef,
}: CanFlightProps) {
	const layerRef = useRef<HTMLDivElement>(null);
	const dockProgressRef = useRef(0);
	const baseSize = useRef({ w: 0, h: 0 });
	/** Posição do card laranja congelada no início da perna B */
	const spotFromRef = useRef<Rect | null>(null);
	/** Posição do spotlight congelada no início da perna C (spotlight → lineup final) */
	const finaleFromRef = useRef<Rect | null>(null);

	useEffect(() => {
		const layer = layerRef.current;
		if (!layer) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let stDock: ScrollTrigger | null = null;
		let stSpot: ScrollTrigger | null = null;
		let stFinale: ScrollTrigger | null = null;
		let scrollTicking = false;
		let running = true;

		const measureBase = () => {
			const hero = readRect(visibleSlot('[data-can-slot="hero"]'));
			if (!hero) return;
			// Mantém o tamanho do canvas estável (evita resize WebGL = teleporte/jank)
			if (baseSize.current.w < 2 || Math.abs(baseSize.current.w - hero.width) > 120) {
				baseSize.current = { w: hero.width, h: hero.height };
			}
		};

		const apply = (rawDock: number, rawSpot: number, rawFinale: number) => {
			measureBase();
			const hero = readRect(visibleSlot('[data-can-slot="hero"]'));
			const dock = readRect(visibleSlot('[data-can-slot="dock"]'));
			const spotlight = readRect(visibleSlot('[data-can-slot="spotlight"]'));
			const finale = readFinaleTarget();
			const base = baseSize.current;

			if (!hero && !dock && !spotlight) {
				layer.style.opacity = '0';
				return;
			}

			if (base.w < 2 || base.h < 2) {
				if (hero) baseSize.current = { w: hero.width, h: hero.height };
				else return;
			}

			const ease = (p: number) =>
				reducedMotion ? (p >= 0.5 ? 1 : 0) : easeInOutCubic(p);

			/*
			 * Três pernas encadeadas:
			 *   A) hero      → card laranja (Benefits/Ingredients)
			 *   B) card      → spotlight do sabor (lata cresce e centraliza)
			 *   C) spotlight → lata do meio no lineup final (Wiiings)
			 * Cada perna só assume quando começa de fato, então a lata fica
			 * encaixada na anterior durante toda a dobra do meio.
			 */
			const onFinaleLeg = rawFinale > 0 && !!finale;
			const onSpotLeg = !onFinaleLeg && rawSpot > 0 && !!spotlight;

			/*
			 * O card laranja desgruda e sobe embora enquanto o spotlight entra.
			 * Se a perna B interpolasse a partir do rect vivo dele, a lata
			 * balançaria (sobe, desce, volta). Então congelamos a posição do
			 * card no instante em que a perna B começa: a lata segura o ponto na
			 * tela e desliza limpo até o centro do spotlight.
			 */
			if (onSpotLeg) {
				if (!spotFromRef.current && dock) spotFromRef.current = dock;
			} else {
				spotFromRef.current = null;
			}

			/*
			 * Mesma lógica da perna B: o spotlight desgruda (unpin) assim que a
			 * perna C começa, então congelamos o ponto onde ele parou (centro da
			 * viewport, onde o pin segurou a lata) pra ela deslizar limpo dali
			 * até a lata do meio no lineup final.
			 */
			if (onFinaleLeg) {
				if (!finaleFromRef.current && spotlight) {
					finaleFromRef.current = { ...spotlight, cy: window.innerHeight / 2 };
				}
			} else {
				finaleFromRef.current = null;
			}

			const from = onFinaleLeg
				? (finaleFromRef.current ?? spotlight ?? dock ?? hero!)
				: onSpotLeg
					? (spotFromRef.current ?? dock ?? hero!)
					: (hero ?? dock ?? spotlight!);
			/*
			 * Antes do spotlight grudar no topo, o centro dele ainda está abaixo
			 * da tela — mirar nele faria a lata descer para só depois voltar.
			 * Como a dobra existe justamente para centralizar a lata, o alvo
			 * vertical é direto o meio da viewport (onde o sticky vai pará-la).
			 */
			const to = onFinaleLeg
				? finale!
				: onSpotLeg
					? { ...spotlight!, cy: window.innerHeight / 2 }
					: (dock ?? hero!);
			/*
			 * Perna C fica linear (sem easeInOutCubic): a seção final tem
			 * exatamente 1 viewport de scroll, então o cubic comprimiria a
			 * chegada num trecho curto do fim, sumindo a lata cedo demais.
			 */
			const t = onFinaleLeg ? rawFinale : ease(onSpotLeg ? rawSpot : rawDock);

			// Trava a lata de frente assim que ela encaixa no card e mantém assim
			dockProgressRef.current = onFinaleLeg || onSpotLeg ? 1 : t;

			const scaleTo = onFinaleLeg
				? FINALE_TARGET_SCALE
				: Math.min(to.width / base.w, to.height / base.h);
			const scaleFrom =
				onFinaleLeg || onSpotLeg
					? Math.min(from.width / base.w, from.height / base.h)
					: 1;
			const scale = lerp(scaleFrom, scaleTo, t);
			const cx = lerp(from.cx, to.cx, t);
			const cy = lerp(from.cy, to.cy, t);

			const x = cx - base.w / 2;
			const y = cy - base.h / 2;

			/*
			 * Assim que a lata encaixa no lineup, some suavemente — a lata "real"
			 * do lineup (mesma posição/textura) já está lá por baixo pra assumir.
			 */
			const finaleFade = onFinaleLeg
				? clamp(1 - Math.max(0, t - 0.88) / 0.12)
				: 1;
			layer.style.opacity = String(finaleFade);
			layer.style.width = `${base.w}px`;
			layer.style.height = `${base.h}px`;
			// left/top fixos em 0 — movimento 100% via transform (GPU, 1:1 com o scroll)
			layer.style.left = '0';
			layer.style.top = '0';
			layer.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

			/*
			 * No card laranja a lata fica SOB a máscara (z6) que corta a parte de
			 * baixo; já no spotlight ela precisa ficar SOBRE o título do sabor.
			 * No hero: abaixo das setas/UI (z45+) pra não roubar o clique do carrossel.
			 * No lineup final: acima do Hyperspeed e da lata 3D real por baixo.
			 */
			const docked = !onSpotLeg && !onFinaleLeg && t > 0.88;
			layer.style.zIndex = onFinaleLeg
				? '4'
				: onSpotLeg && t > 0.12
					? '6'
					: docked
						? '5'
						: '28';
			layer.dataset.docked = docked ? 'true' : 'false';
			layer.style.pointerEvents =
				!onSpotLeg && !onFinaleLeg && t < 0.12 ? 'auto' : 'none';
		};

		const syncFrame = () => {
			scrollTicking = false;
			if (!running) return;
			// Progresso 1:1 com o scroll — sem damping/lag
			apply(stDock?.progress ?? 0, stSpot?.progress ?? 0, stFinale?.progress ?? 0);
		};

		const kick = () => {
			if (scrollTicking) return;
			scrollTicking = true;
			requestAnimationFrame(syncFrame);
		};

		const setupTrigger = () => {
			stDock?.kill();
			stSpot?.kill();
			stFinale?.kill();
			stDock = null;
			stSpot = null;
			stFinale = null;

			const hero = document.querySelector('.hero');
			const stage = document.querySelector('.product-stage');
			const benefitsInner = document.querySelector('[data-benefits-inner]');
			const spotlight = document.querySelector('.flavor-spotlight');
			const spotlightInner = document.querySelector('[data-flavor-spotlight-inner]');
			const finale = document.getElementById('wiiings');

			if (!hero && !stage && !spotlight) {
				apply(0, 0, 0);
				return;
			}

			// Perna A: hero → card laranja da dobra de Benefits/Ingredients
			if (hero || stage) {
				stDock = ScrollTrigger.create({
					trigger: hero ?? stage!,
					start: hero ? 'bottom 55%' : 'top 95%',
					endTrigger: benefitsInner ?? stage ?? hero!,
					end: benefitsInner ? 'center center' : '+=70%',
					scrub: true,
					invalidateOnRefresh: true,
					onUpdate: kick,
					onRefresh: kick,
				});
			}

			/*
			 * Perna B: card → spotlight. Termina quando a seção gruda no topo
			 * (início do pin / carrossel de sabores).
			 */
			if (spotlight) {
				stSpot = ScrollTrigger.create({
					trigger: spotlight,
					start: 'top bottom',
					endTrigger: spotlightInner ?? spotlight,
					end: 'top top',
					scrub: true,
					invalidateOnRefresh: true,
					onUpdate: kick,
					onRefresh: kick,
				});
			}

			/*
			 * Perna C: spotlight → lata do meio no lineup final. #wiiings tem
			 * exatamente 1 viewport de altura, então 'top top' é o instante em
			 * que a seção cobre a tela inteira — o mesmo instante em que o
			 * lineup (ancorado no rodapé dela) chega na posição final.
			 */
			if (finale) {
				stFinale = ScrollTrigger.create({
					trigger: finale,
					start: 'top bottom',
					end: 'top top',
					scrub: true,
					invalidateOnRefresh: true,
					onUpdate: kick,
					onRefresh: kick,
				});
			}

			kick();
		};

		const onResize = () => {
			baseSize.current = { w: 0, h: 0 };
			measureBase();
			ScrollTrigger.refresh();
			kick();
		};

		setupTrigger();
		measureBase();
		kick();

		// Re-setup depois do layout Astro/React assentar
		const readyId = window.setTimeout(() => {
			setupTrigger();
			ScrollTrigger.refresh();
			kick();
		}, 120);

		window.addEventListener('scroll', kick, { passive: true });
		window.addEventListener('resize', onResize);

		return () => {
			running = false;
			window.clearTimeout(readyId);
			window.removeEventListener('scroll', kick);
			window.removeEventListener('resize', onResize);
			stDock?.kill();
			stSpot?.kill();
			stFinale?.kill();
		};
	}, []);

	return (
		<div ref={layerRef} className="can-flight" aria-hidden="true">
			<CanModel
				labelUrl={labelUrl}
				labelUrls={labelUrls}
				spinBoostKey={spinBoostKey}
				dockProgressRef={dockProgressRef}
				carouselSpinRef={carouselSpinRef}
				carouselActiveRef={carouselActiveRef}
			/>
		</div>
	);
}

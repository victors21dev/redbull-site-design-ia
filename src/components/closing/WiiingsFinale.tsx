import { useEffect, useRef, useState } from 'react';
import Hyperspeed from '../hyperspeed/Hyperspeed';
import { akiraPreset } from '../hyperspeed/HyperSpeedPresets';
import { DEFAULT_PRODUCTS } from '../hero/MonsterProductHero';
import FlavorCanLineup from './FlavorCanLineup';
import './WiiingsFinale.css';

/** Preset Akira (React Bits) — constante estável pra não recriar a cena WebGL. */
const HYPERSPEED_OPTIONS = akiraPreset;

export default function WiiingsFinale() {
	const sectionRef = useRef<HTMLElement>(null);
	const [active, setActive] = useState(false);

	useEffect(() => {
		const section = sectionRef.current;
		if (!section) return;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				setActive(true);
				observer.disconnect();
			},
			{ rootMargin: '15% 0px', threshold: 0.02 },
		);

		observer.observe(section);
		return () => observer.disconnect();
	}, []);

	return (
		<section
			ref={sectionRef}
			id="wiiings"
			className="wiiings-finale"
			aria-label="Red Bull te dá asas"
		>
			<div className="wiiings-finale__stage">
				{active ? <Hyperspeed effectOptions={HYPERSPEED_OPTIONS} /> : null}
			</div>

			<div className="wiiings-finale__shell">
				<div className="wiiings-finale__content">
					<p className="wiiings-finale__brand">Red Bull</p>
					<h2 className="wiiings-finale__headline">Te dá asas</h2>
					<p className="wiiings-finale__copy">
						Acelera o foco. Segura o ritmo. A energia que acompanha quem não freia.
					</p>
				</div>

				{active ? (
					<>
						<p className="wiiings-finale__hint">Segure para acelerar</p>
						<FlavorCanLineup products={DEFAULT_PRODUCTS} />
					</>
				) : (
					<div className="finale-lineup finale-lineup--placeholder" aria-hidden="true" />
				)}
			</div>
		</section>
	);
}

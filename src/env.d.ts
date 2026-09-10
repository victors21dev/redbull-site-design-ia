/// <reference types="astro/client" />

declare module '*.glb' {
	const src: string;
	export default src;
}

declare module '*.glb?url' {
	const src: string;
	export default src;
}

declare module '*?url' {
	const src: string;
	export default src;
}

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Disposable = () => void;

const selectAll = <T extends Element>(selector: string) =>
	Array.from(document.querySelectorAll<T>(selector));

async function initAtmosphere(canvas: HTMLCanvasElement, hero: HTMLElement): Promise<Disposable> {
	let three: typeof import('three');

	try {
		three = await import('three');
	} catch {
		canvas.hidden = true;
		return () => undefined;
	}

	const {
		BufferAttribute,
		BufferGeometry,
		DoubleSide,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		Points,
		PointsMaterial,
		RingGeometry,
		Scene,
		WebGLRenderer,
	} = three;
	let renderer: import('three').WebGLRenderer;

	try {
		renderer = new WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'low-power',
		});
	} catch {
		canvas.hidden = true;
		return () => undefined;
	}

	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
	renderer.setClearColor(0x000000, 0);

	const scene = new Scene();
	const camera = new PerspectiveCamera(45, 1, 0.1, 100);
	camera.position.z = 8;

	const pointCount = 76;
	const pointPositions = new Float32Array(pointCount * 3);
	const pointOrigins = new Float32Array(pointCount * 3);

	for (let i = 0; i < pointCount; i++) {
		const radius = 1.5 + ((i * 29) % 43) / 10;
		const angle = i * 2.399963;
		const index = i * 3;
		pointPositions[index] = Math.cos(angle) * radius;
		pointPositions[index + 1] = Math.sin(angle) * radius * 0.66;
		pointPositions[index + 2] = -2 + ((i * 17) % 40) / 10;
		pointOrigins[index] = pointPositions[index];
		pointOrigins[index + 1] = pointPositions[index + 1];
		pointOrigins[index + 2] = pointPositions[index + 2];
	}

	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(pointPositions, 3));

	const material = new PointsMaterial({
		color: 0xa43f2e,
		size: 0.032,
		transparent: true,
		opacity: 0.34,
		sizeAttenuation: true,
		depthWrite: false,
	});
	const points = new Points(geometry, material);
	scene.add(points);

	const ringGeometry = new RingGeometry(2.55, 2.56, 180);
	const ringMaterial = new MeshBasicMaterial({
		color: 0xa43f2e,
		transparent: true,
		opacity: 0.08,
		side: DoubleSide,
	});
	const ring = new Mesh(ringGeometry, ringMaterial);
	ring.position.set(2.1, 0.3, -1.7);
	scene.add(ring);

	let targetX = 0;
	let targetY = 0;
	let frame = 0;
	let visible = true;
	let running = true;

	const resize = () => {
		const rect = hero.getBoundingClientRect();
		const width = Math.max(1, rect.width);
		const height = Math.max(1, rect.height);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	};

	const onPointerMove = (event: PointerEvent) => {
		const rect = hero.getBoundingClientRect();
		targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.22;
		targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.16;
	};

	const observer = new IntersectionObserver(
		(entries) => {
			visible = entries[0]?.isIntersecting ?? false;
		},
		{ threshold: 0.01 },
	);

	observer.observe(hero);
	hero.addEventListener('pointermove', onPointerMove, { passive: true });
	window.addEventListener('resize', resize, { passive: true });
	resize();

	const render = (time: number) => {
		if (!running) return;

		if (visible && !document.hidden) {
			const positions = geometry.attributes.position as import('three').BufferAttribute;
			for (let i = 0; i < pointCount; i++) {
				const index = i * 3;
				positions.setY(i, pointOrigins[index + 1] + Math.sin(time * 0.00024 + i * 0.47) * 0.06);
			}
			positions.needsUpdate = true;
			points.rotation.y += (targetX - points.rotation.y) * 0.025;
			points.rotation.x += (-targetY - points.rotation.x) * 0.025;
			ring.rotation.z = time * 0.000025;
			renderer.render(scene, camera);
		}

		frame = requestAnimationFrame(render);
	};

	frame = requestAnimationFrame(render);

	return () => {
		running = false;
		cancelAnimationFrame(frame);
		observer.disconnect();
		hero.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('resize', resize);
		geometry.dispose();
		material.dispose();
		ringGeometry.dispose();
		ringMaterial.dispose();
		renderer.dispose();
	};
}

function initTilt(): Disposable {
	if (!window.matchMedia('(pointer: fine)').matches) return () => undefined;

	const cleanups: Disposable[] = [];

	selectAll<HTMLElement>('[data-tilt]').forEach((element) => {
		const rotateX = gsap.quickTo(element, 'rotationX', { duration: 0.5, ease: 'power3.out' });
		const rotateY = gsap.quickTo(element, 'rotationY', { duration: 0.5, ease: 'power3.out' });
		const scale = gsap.quickTo(element, 'scale', { duration: 0.5, ease: 'power3.out' });

		const onMove = (event: PointerEvent) => {
			const rect = element.getBoundingClientRect();
			const x = (event.clientX - rect.left) / rect.width - 0.5;
			const y = (event.clientY - rect.top) / rect.height - 0.5;
			rotateX(y * -4);
			rotateY(x * 4);
			scale(1.012);
		};

		const reset = () => {
			rotateX(0);
			rotateY(0);
			scale(1);
		};

		element.addEventListener('pointermove', onMove, { passive: true });
		element.addEventListener('pointerleave', reset);
		element.closest('a')?.addEventListener('blur', reset);

		cleanups.push(() => {
			element.removeEventListener('pointermove', onMove);
			element.removeEventListener('pointerleave', reset);
			element.closest('a')?.removeEventListener('blur', reset);
		});
	});

	return () => cleanups.forEach((cleanup) => cleanup());
}

function initHeaderMenu(): Disposable {
	const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
	const panel = document.querySelector<HTMLElement>('[data-menu-panel]');
	if (!toggle || !panel) return () => undefined;

	const setOpen = (open: boolean) => {
		toggle.setAttribute('aria-expanded', String(open));
		panel.hidden = !open;
	};

	const onToggle = () => setOpen(toggle.getAttribute('aria-expanded') !== 'true');

	const onKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape' || panel.hidden) return;
		setOpen(false);
		toggle.focus();
	};

	// An in-page anchor does not navigate, so close the panel behind it.
	const onPanelClick = (event: Event) => {
		if ((event.target as HTMLElement).closest('[data-menu-link]')) setOpen(false);
	};

	// The panel only exists below the inline-nav breakpoint; reset it on the way back up.
	const wideNav = window.matchMedia('(min-width: 1421px)');
	const onBreakpoint = () => {
		if (wideNav.matches) setOpen(false);
	};

	toggle.addEventListener('click', onToggle);
	panel.addEventListener('click', onPanelClick);
	document.addEventListener('keydown', onKeydown);
	wideNav.addEventListener('change', onBreakpoint);

	return () => {
		toggle.removeEventListener('click', onToggle);
		panel.removeEventListener('click', onPanelClick);
		document.removeEventListener('keydown', onKeydown);
		wideNav.removeEventListener('change', onBreakpoint);
	};
}

function initScrollCue(hero: HTMLElement): Disposable {
	const cue = document.querySelector<HTMLElement>('[data-scroll-cue]');
	if (!cue) return () => undefined;

	let frame = 0;

	const update = () => {
		frame = 0;
		const dismissed = window.scrollY > Math.min(hero.offsetHeight * 0.28, window.innerHeight);
		cue.toggleAttribute('data-cue-dismissed', dismissed);
	};

	const request = () => {
		if (frame) return;
		frame = requestAnimationFrame(update);
	};

	window.addEventListener('scroll', request, { passive: true });
	window.addEventListener('resize', request, { passive: true });
	update();

	return () => {
		if (frame) cancelAnimationFrame(frame);
		window.removeEventListener('scroll', request);
		window.removeEventListener('resize', request);
	};
}

function initMobileReveals(selector: string): Disposable {
	const cards = selectAll<HTMLElement>(selector);
	if (!cards.length) return () => undefined;

	const revealed = new Set<HTMLElement>();
	let frame = 0;

	gsap.set(cards, { autoAlpha: 0 });

	const revealEligibleCards = () => {
		frame = 0;
		const threshold = window.innerHeight * 0.92;

		cards.forEach((card, index) => {
			if (revealed.has(card) || card.getBoundingClientRect().top > threshold) return;

			revealed.add(card);
			const direction = index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : 0;
			// The hero prints carry a deliberate CSS tilt; animate around it rather
			// than to zero, or the reveal would leave every print flat.
			const baseRotation = Number(gsap.getProperty(card, 'rotation')) || 0;
			gsap.fromTo(
				card,
				{
					x: direction * 18,
					y: 30 + (index % 3) * 8,
					rotation: baseRotation + direction * 0.8,
					scale: 0.985,
					autoAlpha: 0,
				},
				{
					x: 0,
					y: 0,
					rotation: baseRotation,
					scale: 1,
					autoAlpha: 1,
					duration: 0.68,
					ease: 'power3.out',
				},
			);
		});
	};

	const requestRevealCheck = () => {
		if (frame) return;
		frame = requestAnimationFrame(revealEligibleCards);
	};

	window.addEventListener('scroll', requestRevealCheck, { passive: true });
	window.addEventListener('resize', requestRevealCheck, { passive: true });
	requestRevealCheck();

	return () => {
		if (frame) cancelAnimationFrame(frame);
		window.removeEventListener('scroll', requestRevealCheck);
		window.removeEventListener('resize', requestRevealCheck);
		gsap.killTweensOf(cards);
		gsap.set(cards, { clearProps: 'opacity,visibility,transform' });
	};
}

export function initKineticEditorial() {
	const hero = document.querySelector<HTMLElement>('[data-hero]');
	if (!hero) return;

	gsap.registerPlugin(ScrollTrigger);

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const mobileLayout = window.matchMedia('(max-width: 820px)').matches;
	const cleanup: Disposable[] = [];

	const onHeroPointer = (event: PointerEvent) => {
		const rect = hero.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		hero.style.setProperty('--pointer-x', `${x}%`);
		hero.style.setProperty('--pointer-y', `${y}%`);
	};

	hero.addEventListener('pointermove', onHeroPointer, { passive: true });
	cleanup.push(() => hero.removeEventListener('pointermove', onHeroPointer));

	cleanup.push(initHeaderMenu());
	if (mobileLayout) cleanup.push(initScrollCue(hero));

	const progress = document.querySelector<HTMLElement>('.reading-progress span');
	if (progress) {
		const updateProgress = () => {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
			// Written as a custom property so the rail can run vertically on desktop
			// and horizontally along the top edge on phones.
			progress.style.setProperty('--reading-progress', String(value));
		};
		updateProgress();
		window.addEventListener('scroll', updateProgress, { passive: true });
		window.addEventListener('resize', updateProgress, { passive: true });
		cleanup.push(() => {
			window.removeEventListener('scroll', updateProgress);
			window.removeEventListener('resize', updateProgress);
		});
	}

	if (!reducedMotion) {
		const context = gsap.context(() => {
			const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
			intro
				.from('.site-header', { y: -30, autoAlpha: 0, duration: 0.75 })
				.from(
					'.title-line > span',
					{ yPercent: 112, rotate: 2.5, duration: 1.15, stagger: 0.08 },
					0.12,
				)
				.from('[data-reveal]', { y: 22, autoAlpha: 0, duration: 0.7, stagger: 0.09 }, 0.38);

			// On phones the prints are stacked well below the fold, so they reveal on
			// scroll instead of flying in during a load animation nobody is watching.
			if (!mobileLayout) {
				intro.from(
					'[data-hero-photo]',
					{
						x: (index) => (index % 2 ? 180 : -150),
						y: (index) => (index < 3 ? -120 : 150),
						rotation: (index) => (index % 2 ? 13 : -15),
						scale: 0.82,
						autoAlpha: 0,
						duration: 1.35,
						stagger: 0.07,
					},
					0.22,
				);

				// Per-print parallax would break the alignment of the stacked mobile collage.
				selectAll<HTMLElement>('[data-hero-photo]').forEach((photo) => {
					const depth = Number(photo.dataset.depth ?? 0.1);
					gsap.to(photo, {
						yPercent: depth * -42,
						ease: 'none',
						scrollTrigger: {
							trigger: hero,
							start: 'top top',
							end: 'bottom top',
							scrub: 0.7,
						},
					});
				});
			}

			if (!mobileLayout) {
				const wallCards = selectAll<HTMLElement>('[data-wall-card]');
				wallCards.forEach((card, index) => {
					const direction = index % 3 === 0 ? -1 : index % 3 === 1 ? 1 : 0;
					gsap.from(card, {
						x: direction * (54 + (index % 5) * 9),
						y: 80 + (index % 4) * 24,
						rotation: direction * (2 + (index % 3)),
						scale: 0.94,
						autoAlpha: 0,
						duration: 1,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: card,
							start: 'top 92%',
							end: 'top 60%',
							toggleActions: 'play none none none',
							once: true,
						},
					});
				});
			}

			gsap.from('.closing-panel h2', {
				y: 90,
				autoAlpha: 0,
				duration: 1.1,
				ease: 'power4.out',
				scrollTrigger: {
					trigger: '.closing-panel',
					start: 'top 72%',
					once: true,
				},
			});
		});

		cleanup.push(() => context.revert());
		if (mobileLayout) {
			cleanup.push(initMobileReveals('[data-hero-photo]'));
			cleanup.push(initMobileReveals('[data-wall-card]'));
		}

		const canvas = document.querySelector<HTMLCanvasElement>('[data-atmosphere]');
		if (canvas && !mobileLayout) {
			let atmosphereDisposed = false;
			let disposeAtmosphere: Disposable = () => undefined;

			void initAtmosphere(canvas, hero).then((dispose) => {
				if (atmosphereDisposed) {
					dispose();
					return;
				}
				disposeAtmosphere = dispose;
			});

			cleanup.push(() => {
				atmosphereDisposed = true;
				disposeAtmosphere();
			});
		}
		cleanup.push(initTilt());
	}

	const dispose = () => cleanup.splice(0).forEach((callback) => callback());
	window.addEventListener('pagehide', dispose, { once: true });
}

type NetworkInformation = {
	saveData?: boolean;
};

type ConnectionNavigator = Navigator & {
	connection?: NetworkInformation;
	mozConnection?: NetworkInformation;
	webkitConnection?: NetworkInformation;
};

type PlaneConfig = {
	x: number;
	y: number;
	z: number;
	width: number;
	rotationX: number;
	rotationY: number;
	rotationZ: number;
	float: number;
};

type SpatialGroup = import('three').Group & {
	userData: {
		baseX: number;
		baseY: number;
		baseZ: number;
		baseRotationX: number;
		baseRotationY: number;
		float: number;
		phase: number;
	};
};

const planeConfigs: PlaneConfig[] = [
	{
		x: 4.15,
		y: 2.15,
		z: -0.8,
		width: 2.15,
		rotationX: -0.05,
		rotationY: -0.18,
		rotationZ: 0.04,
		float: 0.16,
	},
	{
		x: 1.65,
		y: 2.65,
		z: -3.2,
		width: 1.7,
		rotationX: 0.03,
		rotationY: 0.12,
		rotationZ: -0.06,
		float: 0.1,
	},
	{
		x: 4.35,
		y: -1.75,
		z: 0.1,
		width: 2.75,
		rotationX: 0.08,
		rotationY: -0.2,
		rotationZ: -0.035,
		float: 0.12,
	},
	{
		x: -4.85,
		y: 2.3,
		z: -2.8,
		width: 1.55,
		rotationX: -0.04,
		rotationY: 0.21,
		rotationZ: -0.05,
		float: 0.1,
	},
	{
		x: -4.65,
		y: -2.25,
		z: -1.35,
		width: 2.05,
		rotationX: 0.04,
		rotationY: 0.16,
		rotationZ: 0.07,
		float: 0.15,
	},
	{
		x: 1.4,
		y: -2.7,
		z: -2.15,
		width: 1.7,
		rotationX: -0.07,
		rotationY: -0.12,
		rotationZ: 0.055,
		float: 0.11,
	},
	{
		x: 5.55,
		y: 0.25,
		z: -4.5,
		width: 1.45,
		rotationX: 0.02,
		rotationY: -0.24,
		rotationZ: 0.08,
		float: 0.09,
	},
	{
		x: -1.05,
		y: 3.25,
		z: -4.75,
		width: 1.5,
		rotationX: -0.06,
		rotationY: 0.1,
		rotationZ: 0.04,
		float: 0.08,
	},
];

const page = document.querySelector<HTMLElement>('.spatial-page');
const stage = document.querySelector<HTMLElement>('[data-spatial-stage]');
const canvasHost = document.querySelector<HTMLElement>('[data-spatial-canvas]');
const sourceImages = Array.from(
	document.querySelectorAll<HTMLImageElement>('[data-spatial-src]'),
).slice(0, planeConfigs.length);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const compactViewport = window.matchMedia('(max-width: 900px)');
const connectionNavigator = navigator as ConnectionNavigator;
const connection =
	connectionNavigator.connection ??
	connectionNavigator.mozConnection ??
	connectionNavigator.webkitConnection;

let renderer: import('three').WebGLRenderer | null = null;
let scene: import('three').Scene | null = null;
let camera: import('three').PerspectiveCamera | null = null;
let animationFrame = 0;
let disposed = false;
let initialized = false;
let groups: SpatialGroup[] = [];
let textures: import('three').Texture[] = [];
let geometries: import('three').BufferGeometry[] = [];
let materials: import('three').Material[] = [];
let Three: typeof import('three') | null = null;

const pointer = { x: 0, y: 0 };
const pointerTarget = { x: 0, y: 0 };
let scrollTarget = 0;
let scrollCurrent = 0;

function supportsWebGL() {
	try {
		const canvas = document.createElement('canvas');
		const context =
			canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ??
			canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
		if (!context) return false;
		const loseContext = context.getExtension('WEBGL_lose_context');
		loseContext?.loseContext();
		return true;
	} catch {
		return false;
	}
}

function shouldUseStaticFallback() {
	return (
		reducedMotion.matches ||
		compactViewport.matches ||
		connection?.saveData === true ||
		sourceImages.length < 4 ||
		!supportsWebGL()
	);
}

function onPointerMove(event: PointerEvent) {
	pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
	pointerTarget.y = -((event.clientY / window.innerHeight) * 2 - 1);
}

function onScroll() {
	scrollTarget = Math.min(1.5, Math.max(0, window.scrollY / Math.max(window.innerHeight, 1)));
}

function onResize() {
	if (!renderer || !camera || !stage) return;
	const width = stage.clientWidth;
	const height = stage.clientHeight;
	camera.aspect = width / Math.max(height, 1);
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.setSize(width, height, false);
}

function createPhotoPlane(texture: import('three').Texture, config: PlaneConfig, index: number) {
	if (!renderer || !Three) return null;

	texture.colorSpace = Three.SRGBColorSpace;
	texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

	const source = texture.image as { naturalWidth?: number; naturalHeight?: number };
	const aspect = (source.naturalWidth ?? 3) / Math.max(source.naturalHeight ?? 4, 1);
	const height = config.width / aspect;
	const photoGeometry = new Three.PlaneGeometry(config.width, height);
	const photoMaterial = new Three.MeshBasicMaterial({
		map: texture,
		side: Three.DoubleSide,
		toneMapped: false,
	});
	const photoMesh = new Three.Mesh(photoGeometry, photoMaterial);

	const matGeometry = new Three.PlaneGeometry(config.width + 0.12, height + 0.12);
	const matMaterial = new Three.MeshBasicMaterial({
		color: 0xfffdf8,
		side: Three.DoubleSide,
		toneMapped: false,
	});
	const matMesh = new Three.Mesh(matGeometry, matMaterial);
	matMesh.position.z = -0.015;

	const group = new Three.Group() as SpatialGroup;
	group.add(matMesh, photoMesh);
	group.position.set(config.x, config.y, config.z);
	group.rotation.set(config.rotationX, config.rotationY, config.rotationZ);
	group.userData = {
		baseX: config.x,
		baseY: config.y,
		baseZ: config.z,
		baseRotationX: config.rotationX,
		baseRotationY: config.rotationY,
		float: config.float,
		phase: index * 0.73,
	};

	geometries.push(photoGeometry, matGeometry);
	materials.push(photoMaterial, matMaterial);

	return group;
}

function render(time: number) {
	if (disposed || !renderer || !scene || !camera) return;

	const elapsed = time * 0.001;
	pointer.x += (pointerTarget.x - pointer.x) * 0.035;
	pointer.y += (pointerTarget.y - pointer.y) * 0.035;
	scrollCurrent += (scrollTarget - scrollCurrent) * 0.045;

	camera.position.x = pointer.x * 0.22;
	camera.position.y = pointer.y * 0.13 - scrollCurrent * 0.08;
	camera.position.z = 9 - scrollCurrent * 0.55;
	camera.lookAt(0, 0, -1.7);

	groups.forEach((group, index) => {
		const depth = 1 + Math.abs(group.userData.baseZ) * 0.08;
		group.position.x = group.userData.baseX + pointer.x * 0.16 * depth;
		group.position.y =
			group.userData.baseY +
			Math.sin(elapsed * 0.42 + group.userData.phase) * group.userData.float +
			pointer.y * 0.11 * depth -
			scrollCurrent * (0.18 + index * 0.018);
		group.position.z = group.userData.baseZ + scrollCurrent * (0.16 + index * 0.055);
		group.rotation.x = group.userData.baseRotationX - pointer.y * 0.025;
		group.rotation.y = group.userData.baseRotationY + pointer.x * 0.045;
	});

	renderer.render(scene, camera);
	animationFrame = window.requestAnimationFrame(render);
}

async function initSpatialGallery() {
	if (initialized || disposed || shouldUseStaticFallback() || !stage || !canvasHost || !page) {
		return;
	}

	initialized = true;
	Three = await import('three');
	if (disposed) return;

	scene = new Three.Scene();
	scene.fog = new Three.Fog(0xf5f0e7, 10.5, 18);
	camera = new Three.PerspectiveCamera(42, 1, 0.1, 40);
	camera.position.set(0, 0, 9);

	try {
		renderer = new Three.WebGLRenderer({
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance',
		});
		renderer.outputColorSpace = Three.SRGBColorSpace;
		renderer.setClearColor(0xf5f0e7, 0);
		renderer.domElement.setAttribute('aria-hidden', 'true');
		canvasHost.append(renderer.domElement);
		onResize();

		const loader = new Three.TextureLoader();
		loader.setCrossOrigin('anonymous');
		const textureResults = await Promise.allSettled(
			sourceImages.map((image) => loader.loadAsync(image.dataset.spatialSrc ?? image.currentSrc)),
		);

		if (disposed) {
			textureResults.forEach((result) => {
				if (result.status === 'fulfilled') result.value.dispose();
			});
			return;
		}

		textures = textureResults.flatMap((result) =>
			result.status === 'fulfilled' ? [result.value] : [],
		);

		if (textures.length < 4) {
			disposeSpatialGallery();
			return;
		}

		textures.forEach((texture, index) => {
			const group = createPhotoPlane(texture, planeConfigs[index], index);
			if (group && scene) {
				groups.push(group);
				scene.add(group);
			}
		});

		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onResize, { passive: true });
		onScroll();
		renderer.render(scene, camera);
		page.classList.add('spatial-ready');
		animationFrame = window.requestAnimationFrame(render);
	} catch {
		disposeSpatialGallery();
	}
}

async function runMicroAnimations() {
	if (reducedMotion.matches || connection?.saveData === true) return;
	const { gsap } = await import('gsap');

	const heroItems = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-reveal]'));
	gsap.from(heroItems, {
		y: 24,
		opacity: 0,
		duration: 0.9,
		stagger: 0.1,
		ease: 'power3.out',
		clearProps: 'transform,opacity',
	});

	const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery-card]'));
	if (!('IntersectionObserver' in window)) return;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				observer.unobserve(entry.target);
				gsap.fromTo(
					entry.target,
					{ y: 34, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 0.78,
						ease: 'power3.out',
						clearProps: 'transform,opacity',
					},
				);
			});
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
	);

	cards.forEach((card) => observer.observe(card));
}

function disposeSpatialGallery() {
	disposed = true;
	initialized = false;
	window.cancelAnimationFrame(animationFrame);
	window.removeEventListener('pointermove', onPointerMove);
	window.removeEventListener('scroll', onScroll);
	window.removeEventListener('resize', onResize);

	groups.forEach((group) => group.removeFromParent());
	geometries.forEach((geometry) => geometry.dispose());
	materials.forEach((material) => material.dispose());
	textures.forEach((texture) => texture.dispose());

	groups = [];
	geometries = [];
	materials = [];
	textures = [];

	if (renderer) {
		renderer.dispose();
		renderer.forceContextLoss();
		renderer.domElement.remove();
	}

	renderer = null;
	camera = null;
	scene = null;
	page?.classList.remove('spatial-ready');
}

void runMicroAnimations();
void initSpatialGallery();

window.addEventListener('pagehide', disposeSpatialGallery, { once: true });

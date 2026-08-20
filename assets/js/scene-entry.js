/**
 * Separate entry point for the 3D environment.
 *
 * Hugo's js.Build does not honour esbuild code splitting, so a static
 * `import('./three/scene.js')` would pull the whole Three.js runtime into the
 * first-paint bundle. Building this as its own entry and importing it at
 * runtime by URL keeps that cost off the critical path.
 */
export { createEnvironment } from './three/scene.js';

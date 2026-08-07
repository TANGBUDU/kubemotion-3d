import type * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export type PostProcessingAntialiasing = 'smaa' | 'fxaa';

export interface PostProcessingPipelineOptions {
  /** SMAA is the quality default; FXAA remains an explicit low-cost fallback. */
  readonly antialiasing?: PostProcessingAntialiasing;
}

export interface PostProcessingDiagnostics {
  readonly renderTargets: number;
  readonly passes: number;
  readonly antialiasing: PostProcessingAntialiasing;
}

const isWebGLRenderTarget = (value: unknown): value is THREE.WebGLRenderTarget =>
  typeof value === 'object' &&
  value !== null &&
  'isWebGLRenderTarget' in value &&
  value.isWebGLRenderTarget === true;

const renderTargetsOwnedBy = (owner: object): readonly THREE.WebGLRenderTarget[] =>
  Object.values(owner as Record<string, unknown>).filter(isWebGLRenderTarget);

/**
 * Small color-correct post-processing chain. It intentionally contains no global bloom or
 * full-scene outline: scene hierarchy continues to come from lighting, materials, and route style.
 */
export class PostProcessingPipeline {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly antialiasingPass: SMAAPass | FXAAPass;
  private readonly outputPass: OutputPass;
  private readonly ownedRenderTargets = new Set<THREE.WebGLRenderTarget>();
  private readonly antialiasing: PostProcessingAntialiasing;
  private readonly previousInfoAutoReset: boolean;
  private pixelRatio: number;
  private disposed = false;

  public constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: PostProcessingPipelineOptions = {},
  ) {
    this.antialiasing = options.antialiasing ?? 'smaa';
    this.pixelRatio = renderer.getPixelRatio();
    this.previousInfoAutoReset = renderer.info.autoReset;
    // One teaching frame includes the scene plus all full-screen passes; reset once for the chain.
    renderer.info.autoReset = false;
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.antialiasingPass = this.antialiasing === 'smaa' ? new SMAAPass() : new FXAAPass();
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    if (this.antialiasing === 'smaa') {
      // SMAA operates in linear-sRGB and therefore belongs before color-space conversion.
      this.composer.addPass(this.antialiasingPass);
      this.composer.addPass(this.outputPass);
    } else {
      // FXAA expects display-referred sRGB input and therefore follows OutputPass.
      this.composer.addPass(this.outputPass);
      this.composer.addPass(this.antialiasingPass);
    }

    this.captureOwnedRenderTargets(this.composer);
    this.captureOwnedRenderTargets(this.antialiasingPass);
  }

  private captureOwnedRenderTargets(owner: object): void {
    for (const renderTarget of renderTargetsOwnedBy(owner)) {
      this.ownedRenderTargets.add(renderTarget);
    }
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Post-processing pipeline has been disposed.');
  }

  public setSize(width: number, height: number, pixelRatio: number): void {
    this.assertUsable();
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(pixelRatio) ||
      width <= 0 ||
      height <= 0 ||
      pixelRatio <= 0
    ) {
      throw new Error('Post-processing dimensions and pixel ratio must be positive finite values.');
    }
    if (pixelRatio !== this.pixelRatio) {
      this.pixelRatio = pixelRatio;
      this.composer.setPixelRatio(pixelRatio);
    }
    this.composer.setSize(width, height);
  }

  public render(deltaSeconds?: number): void {
    this.assertUsable();
    this.renderer.info.reset();
    this.composer.render(deltaSeconds);
  }

  public get diagnostics(): PostProcessingDiagnostics {
    return {
      renderTargets: this.disposed ? 0 : this.ownedRenderTargets.size,
      passes: this.disposed ? 0 : this.composer.passes.filter((pass) => pass.enabled).length,
      antialiasing: this.antialiasing,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // EffectComposer owns its two buffers and copy pass; effect passes own their own resources.
    this.antialiasingPass.dispose();
    this.outputPass.dispose();
    this.renderPass.dispose();
    this.composer.dispose();
    this.renderer.info.autoReset = this.previousInfoAutoReset;
    this.ownedRenderTargets.clear();
  }
}

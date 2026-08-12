import * as THREE from 'three';
import { palette } from '../design/palette';

const channel = (color: number, shift: number): number => (color >> shift) & 0xff;

const createGradientTexture = (): THREE.DataTexture => {
  const height = 128;
  const width = 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const progress = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (const [channelOffset, shift] of [
        [0, 16],
        [1, 8],
        [2, 0],
      ] as const) {
        const top = channel(palette.backgroundTop, shift);
        const bottom = channel(palette.backgroundBottom, shift);
        data[offset + channelOffset] = Math.round(THREE.MathUtils.lerp(bottom, top, progress));
      }
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

export class SceneEnvironment {
  private readonly root = new THREE.Group();
  private readonly background = createGradientTexture();
  private readonly previousBackground: THREE.Texture | THREE.Color | null;
  private readonly previousFog: THREE.Fog | THREE.FogExp2 | null;

  public constructor(
    private readonly scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    parent: THREE.Object3D = scene,
  ) {
    this.root.name = 'lesson-environment';
    this.previousBackground = scene.background;
    this.previousFog = scene.fog;
    scene.background = this.background;
    scene.fog = new THREE.FogExp2(palette.backgroundBottom, 0.012);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const hemisphere = new THREE.HemisphereLight(0xc4ddf0, 0x07111f, 1.15);
    hemisphere.name = 'lesson-fill-light';
    this.root.add(hemisphere);

    const key = new THREE.DirectionalLight(0xf2f7fb, 2.2);
    key.name = 'lesson-key-light';
    key.position.set(-7, 15, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.025;
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 45;
    this.root.add(key);

    const fill = new THREE.DirectionalLight(0x709bc0, 0.42);
    fill.name = 'lesson-rim-light';
    fill.position.set(9, 7, -10);
    this.root.add(fill);
    parent.add(this.root);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    if (this.scene.background === this.background) this.scene.background = this.previousBackground;
    this.scene.fog = this.previousFog;
    this.background.dispose();
  }
}

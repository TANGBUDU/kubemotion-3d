import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { LocalizedText, WorldEntity } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { ContainerVisualHandle } from '../visuals/ContainerVisual';
import { NodeVisualHandle } from '../visuals/NodeVisual';
import { PodVisualHandle } from '../visuals/PodVisual';

const localized = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });
const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };
const focused: EntityViewState = {
  visible: true,
  emphasis: 'focused',
  labelMode: 'full',
  inspectorMode: 'expanded',
};

const nodeEntity: WorldEntity = {
  id: 'baseline:Node:worker-a',
  category: 'infrastructure',
  kind: 'Node',
  name: 'worker-a',
  status: 'ready',
  data: { rackOrder: 1, podSlotCount: 4 },
  title: localized('worker-a'),
  summary: localized('Worker Node baseline'),
  sourceIds: [],
  visual: { archetype: 'node', size: 'xl' },
};

const podEntity: WorldEntity = {
  id: 'baseline:Pod:api-a',
  category: 'api-object',
  kind: 'Pod',
  name: 'api-7f8d9-a',
  namespace: 'shop',
  status: 'running',
  data: {
    uid: 'baseline-pod-uid',
    nodeName: 'worker-a',
    phase: 'Running',
    restartPolicy: 'Always',
  },
  title: localized('api-7f8d9-a'),
  summary: localized('Focused Pod baseline'),
  sourceIds: [],
  visual: { archetype: 'pod', size: 'md' },
};

const containerEntity: WorldEntity = {
  id: 'baseline:Container:api',
  category: 'runtime-instance',
  kind: 'Container',
  name: 'api',
  namespace: 'shop',
  status: 'running',
  data: {
    podId: podEntity.id,
    restartCount: 0,
    instanceGeneration: 1,
    image: 'example.invalid/api:v1',
  },
  title: localized('api container'),
  summary: localized('Container inside the focused Pod'),
  sourceIds: [],
  visual: { archetype: 'container', size: 'sm' },
};

export interface VisualHierarchyBaseline {
  readonly root: THREE.Group;
  readonly node: NodeVisualHandle;
  readonly pod: PodVisualHandle;
  readonly container: ContainerVisualHandle;
  dispose(): void;
}

export const createVisualHierarchyBaseline = (): VisualHierarchyBaseline => {
  const root = new THREE.Group();
  root.name = 'visual-hierarchy-baseline';
  root.userData.description = 'Static Node > Pod > Container teaching hierarchy';
  const node = new NodeVisualHandle(nodeEntity, normal);
  const pod = new PodVisualHandle(podEntity, focused);
  const container = new ContainerVisualHandle(containerEntity, focused);
  pod.attachContainer(container);
  const [slotX, slotZ] = dimensions.node.slotOffsets[0] ?? [-1.22, -0.82];
  pod.root.position.set(slotX, 0.53, slotZ);
  root.add(node.root, pod.root);
  return {
    root,
    node,
    pod,
    container,
    dispose: () => {
      container.dispose();
      pod.dispose();
      node.dispose();
      root.clear();
      root.removeFromParent();
    },
  };
};

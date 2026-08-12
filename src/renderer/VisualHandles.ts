/**
 * Compatibility barrel for renderer consumers. Specialized implementations live in
 * `renderer/visuals` so no teaching entity falls back to a generic labeled primitive.
 */
export {
  ANCHOR_KINDS,
  BaseVisualHandle,
  type AnchorKind,
  type EntityVisualHandle,
  type VisualContext,
} from './visuals/BaseVisualHandle';
export {
  API_SERVER_CONTROL_PORTS,
  ApiServerVisualHandle,
  type ApiServerControlPort,
} from './visuals/ApiServerVisual';
export { ContainerVisualHandle } from './visuals/ContainerVisual';
export { ContainerRuntimeVisualHandle } from './visuals/ContainerRuntimeVisual';
export { ClientVisualHandle } from './visuals/ClientVisual';
export { ClusterFoundationVisualHandle } from './visuals/ClusterFoundationVisual';
export { ControllerManagerVisualHandle } from './visuals/ControllerManagerVisual';
export { DeploymentVisualHandle } from './visuals/DeploymentVisual';
export { DeveloperVisualHandle } from './visuals/DeveloperVisual';
export { EndpointSliceVisualHandle } from './visuals/EndpointSliceVisual';
export { EtcdVisualHandle } from './visuals/EtcdVisual';
export { ExternalClientVisualHandle } from './visuals/ExternalClientVisual';
export { GenericUnsupportedVisual as GenericVisualHandle } from './visuals/GenericUnsupportedVisual';
export { KubeletVisualHandle } from './visuals/KubeletVisual';
export { KubectlVisualHandle } from './visuals/KubectlVisual';
export { NamespaceVisualHandle } from './visuals/NamespaceVisual';
export { NodeVisualHandle } from './visuals/NodeVisual';
export { PodVisualHandle } from './visuals/PodVisual';
export { ReplicaSetVisualHandle } from './visuals/ReplicaSetVisual';
export { SchedulerVisualHandle } from './visuals/SchedulerVisual';
export { ServiceVisualHandle } from './visuals/ServiceVisual';

import * as THREE from 'three';
import type { Locale } from '../app/types';
import type { EntityViewState, ViewProjection } from '../course/types';
import type { EntityId } from '../world/types';
import { samplePolyline } from './relations/polyline';
import type { RelationLayer } from './relations/RelationLayer';
import type { SceneRegistry } from './SceneRegistry';
import type { EntityVisualHandle } from './visuals/BaseVisualHandle';

export interface LabelSafeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface LabelRecord {
  readonly key: string;
  readonly element: HTMLDivElement;
  source: 'entity' | 'layout' | 'route';
  priority: number;
  entityId: EntityId | undefined;
  worldPosition: THREE.Vector3 | undefined;
}

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface ProjectedLabel {
  readonly record: LabelRecord;
  readonly preferred: ScreenPoint;
  readonly width: number;
  readonly height: number;
  readonly distance: number;
}

const VIEWPORT_PADDING = 4;
const HORIZONTAL_GAP = 8;
const VERTICAL_GAP = 5;
const MOBILE_BREAKPOINT = 720;
const ZONE_HEADING_PRIORITY = 120;
const ACTIVE_PENDING_TRAY_PRIORITY = 115;
const FOCUSED_ENTITY_PRIORITY = 110;
const ACTIVE_ROUTE_PRIORITY = 105;
const SELECTED_ENTITY_PRIORITY = 100;
const CRITICAL_PRIORITY = SELECTED_ENTITY_PRIORITY;
const DESKTOP_LABEL_LIMIT = 7;
const MOBILE_LABEL_LIMIT = 3;
const DESKTOP_ROUTE_LABEL_LIMIT = 3;
const MOBILE_ROUTE_LABEL_LIMIT = 1;
// Browser font metrics can resolve a fraction wider than offsetWidth after a locale/text update.
// Reserve a few CSS pixels so a label accepted at the safe-rect edge remains inside it when
// getBoundingClientRect() observes the final rendered glyphs.
const LABEL_MEASUREMENT_SAFETY_PX = 4;

const labelPriority = (kind: string, emphasis: string, selected: boolean): number => {
  // These authored classes deliberately outrank every kind-specific context score.
  // Their ordering follows the directive: zone > focus > active route > selection > context.
  if (emphasis === 'focused') return FOCUSED_ENTITY_PRIORITY;
  if (selected) return SELECTED_ENTITY_PRIORITY;
  if (emphasis === 'dimmed') return 8;
  if (kind === 'Cluster') return 82;
  if (kind === 'KubeAPIServer' || kind === 'ApiServer' || kind === 'APIServer') return 72;
  if (kind === 'Etcd') return 70;
  if (kind === 'ControllerManager' || kind === 'KubeControllerManager') return 68;
  if (kind === 'Scheduler') return 65;
  if (kind === 'Namespace') return 64;
  if (kind === 'Service') return 64;
  if (kind === 'Node') return 62;
  if (kind === 'EndpointSlice') return 60;
  if (kind === 'Deployment') return 58;
  // The SPEC/OBSERVED/READY counters are a core teaching fact, so keep the ReplicaSet label
  // ahead of interchangeable worker labels when the desktop density cap applies.
  if (kind === 'ReplicaSet') return 66;
  if (kind === 'Pod') return 54;
  if (kind === 'Kubelet') return 48;
  if (kind === 'Kubectl' || kind === 'Developer' || kind === 'Browser') return 61;
  return 30;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const normalizeSafeRect = (
  viewportWidth: number,
  viewportHeight: number,
  requested?: LabelSafeRect,
): LayoutRect | undefined => {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= VIEWPORT_PADDING * 2 ||
    viewportHeight <= VIEWPORT_PADDING * 2
  ) {
    return undefined;
  }
  const viewportLeft = VIEWPORT_PADDING;
  const viewportTop = VIEWPORT_PADDING;
  const viewportRight = viewportWidth - VIEWPORT_PADDING;
  const viewportBottom = viewportHeight - VIEWPORT_PADDING;
  const requestedLeft = requested && Number.isFinite(requested.x) ? requested.x : viewportLeft;
  const requestedTop = requested && Number.isFinite(requested.y) ? requested.y : viewportTop;
  const requestedWidth =
    requested && Number.isFinite(requested.width) ? Math.max(0, requested.width) : viewportWidth;
  const requestedHeight =
    requested && Number.isFinite(requested.height) ? Math.max(0, requested.height) : viewportHeight;
  const left = clamp(requestedLeft, viewportLeft, viewportRight);
  const top = clamp(requestedTop, viewportTop, viewportBottom);
  const right = clamp(requestedLeft + requestedWidth, left, viewportRight);
  const bottom = clamp(requestedTop + requestedHeight, top, viewportBottom);
  if (right - left < 1 || bottom - top < 1) return undefined;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    right,
    top,
    bottom,
  };
};

const rectFromCenter = (center: ScreenPoint, width: number, height: number): LayoutRect => ({
  x: center.x - width / 2,
  y: center.y - height / 2,
  width,
  height,
  left: center.x - width / 2,
  right: center.x + width / 2,
  top: center.y - height / 2,
  bottom: center.y + height / 2,
});

const rectInside = (candidate: LayoutRect, safe: LayoutRect): boolean =>
  candidate.left >= safe.left &&
  candidate.right <= safe.right &&
  candidate.top >= safe.top &&
  candidate.bottom <= safe.bottom;

const rectsOverlap = (left: LayoutRect, right: LayoutRect): boolean =>
  left.left < right.right + HORIZONTAL_GAP &&
  left.right > right.left - HORIZONTAL_GAP &&
  left.top < right.bottom + VERTICAL_GAP &&
  left.bottom > right.top - VERTICAL_GAP;

const rectContainsPoint = (rect: LayoutRect, point: ScreenPoint, padding = 5): boolean =>
  point.x >= rect.left - padding &&
  point.x <= rect.right + padding &&
  point.y >= rect.top - padding &&
  point.y <= rect.bottom + padding;

const projectPoint = (
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): ScreenPoint & { readonly visible: boolean } => {
  const point = worldPoint.clone().project(camera);
  return {
    x: (point.x * 0.5 + 0.5) * width,
    y: (-point.y * 0.5 + 0.5) * height,
    visible:
      point.z >= -1 &&
      point.z <= 1 &&
      point.x >= -1 &&
      point.x <= 1 &&
      point.y >= -1 &&
      point.y <= 1,
  };
};

const basePlacementCenters = (
  preferred: ScreenPoint,
  width: number,
  height: number,
): readonly ScreenPoint[] => {
  const horizontal = width / 2 + 14;
  const vertical = height + 9;
  return [
    preferred,
    { x: preferred.x, y: preferred.y - vertical },
    { x: preferred.x + horizontal, y: preferred.y },
    { x: preferred.x - horizontal, y: preferred.y },
    { x: preferred.x, y: preferred.y + vertical },
    { x: preferred.x + horizontal, y: preferred.y - vertical },
    { x: preferred.x - horizontal, y: preferred.y - vertical },
    { x: preferred.x + horizontal, y: preferred.y + vertical },
    { x: preferred.x - horizontal, y: preferred.y + vertical },
  ];
};

const exhaustivePlacementCenters = (
  preferred: ScreenPoint,
  width: number,
  height: number,
  safe: LayoutRect,
): readonly ScreenPoint[] => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const stepX = Math.max(18, width / 2 + HORIZONTAL_GAP);
  const stepY = Math.max(16, height + VERTICAL_GAP);
  const candidates: ScreenPoint[] = [];
  for (let y = safe.top + halfHeight; y <= safe.bottom - halfHeight + 0.001; y += stepY) {
    for (let x = safe.left + halfWidth; x <= safe.right - halfWidth + 0.001; x += stepX) {
      candidates.push({ x, y });
    }
  }
  return candidates.sort((left, right) => {
    const leftDistance = (left.x - preferred.x) ** 2 + (left.y - preferred.y) ** 2;
    const rightDistance = (right.x - preferred.x) ** 2 + (right.y - preferred.y) ** 2;
    return leftDistance - rightDistance || left.y - right.y || left.x - right.x;
  });
};

const uniqueCenters = (centers: readonly ScreenPoint[]): readonly ScreenPoint[] => {
  const seen = new Set<string>();
  return centers.filter((center) => {
    const key = `${center.x.toFixed(3)}:${center.y.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hideRecord = (record: LabelRecord, reason: string): void => {
  record.element.hidden = true;
  record.element.dataset.hiddenReason = reason;
  delete record.element.dataset.screenX;
  delete record.element.dataset.screenY;
  delete record.element.dataset.screenWidth;
  delete record.element.dataset.screenHeight;
};

const entityLabelText = (handle: EntityVisualHandle, state: EntityViewState): string => {
  const entity = handle.entity;
  const domLabel = handle.root.userData.domLabel;
  const semanticShortName =
    domLabel &&
    typeof domLabel === 'object' &&
    'text' in domLabel &&
    typeof domLabel.text === 'string'
      ? domLabel.text
      : entity.name;
  const counters = handle.root.userData.counters;
  const replicaCounterSuffix =
    entity.kind === 'ReplicaSet' &&
    counters &&
    typeof counters === 'object' &&
    'spec' in counters &&
    'observed' in counters &&
    'ready' in counters &&
    typeof counters.spec === 'number' &&
    typeof counters.observed === 'number' &&
    typeof counters.ready === 'number'
      ? state.labelMode === 'full'
        ? ` · SPEC ${counters.spec} OBSERVED ${counters.observed} READY ${counters.ready}`
        : ` · S${counters.spec} O${counters.observed} R${counters.ready}`
      : '';
  return `${semanticShortName}${replicaCounterSuffix}`;
};

/** Owns deterministic collision-aware DOM labels. Visual-handle badges retain separate ownership. */
export class LabelManager {
  private readonly labels = new Map<string, LabelRecord>();
  private view: ViewProjection | undefined;

  public constructor(private readonly container: HTMLElement) {}

  public sync(
    registry: SceneRegistry,
    view: ViewProjection,
    locale: Locale,
    routeLayer?: RelationLayer,
  ): void {
    this.view = view;
    const active = new Set<EntityId>();
    for (const handle of registry.values()) {
      const state = view.entityStates[handle.entityId];
      if (!state || !state.visible || state.emphasis === 'hidden' || state.labelMode === 'none') {
        continue;
      }
      if (
        handle.entity.kind === 'ContainerRuntime' &&
        state.emphasis !== 'focused' &&
        handle.root.userData.selected !== true
      ) {
        continue;
      }
      active.add(handle.entityId);
      let record = this.labels.get(handle.entityId);
      if (!record) {
        const element = document.createElement('div');
        element.className = 'scene-label';
        element.dataset.entityId = handle.entityId;
        element.setAttribute('aria-hidden', 'true');
        this.container.append(element);
        record = {
          key: handle.entityId,
          element,
          source: 'entity',
          priority: 0,
          entityId: handle.entityId,
          worldPosition: undefined,
        };
        this.labels.set(handle.entityId, record);
      }
      record.source = 'entity';
      record.entityId = handle.entityId;
      record.worldPosition = undefined;
      const entity = handle.entity;
      record.element.lang = locale;
      // Scene labels stay glanceable. Kind, status, UID, and counters belong to
      // Evidence/Inspector, not a metadata slab floating over the teaching object.
      record.element.textContent = entityLabelText(handle, state);
      record.element.dataset.mode = state.labelMode;
      record.element.dataset.emphasis = state.emphasis;
      record.priority = labelPriority(
        entity.kind,
        state.emphasis,
        handle.root.userData.selected === true,
      );
      record.element.dataset.priority = String(record.priority);
      record.element.hidden = false;
      delete record.element.dataset.hiddenReason;
    }
    const hasVisiblePendingPod = [...registry.values()].some((handle) => {
      const state = view.entityStates[handle.entityId];
      return (
        state?.visible === true &&
        state.emphasis !== 'hidden' &&
        handle.entity.kind === 'Pod' &&
        (handle.entity.status === 'pending' || handle.entity.data.phase === 'Pending')
      );
    });
    const layoutLabels = typeof registry.layoutLabels === 'function' ? registry.layoutLabels() : [];
    for (const anchor of layoutLabels) {
      active.add(anchor.id);
      let record = this.labels.get(anchor.id);
      if (!record) {
        const element = document.createElement('div');
        element.className = 'scene-label scene-layout-label';
        element.dataset.layoutLabelId = anchor.id;
        element.setAttribute('aria-hidden', 'true');
        this.container.append(element);
        record = {
          key: anchor.id,
          element,
          source: 'layout',
          priority: 0,
          entityId: undefined,
          worldPosition: new THREE.Vector3(),
        };
        this.labels.set(anchor.id, record);
      }
      record.source = 'layout';
      record.entityId = undefined;
      record.worldPosition ??= new THREE.Vector3();
      record.worldPosition.set(...anchor.worldPosition);
      record.priority =
        anchor.kind === 'zone-title'
          ? ZONE_HEADING_PRIORITY
          : anchor.kind === 'tray-title' && hasVisiblePendingPod
            ? view.activeRoutes.length > 0
              ? ACTIVE_ROUTE_PRIORITY - 10
              : ACTIVE_PENDING_TRAY_PRIORITY
            : 64;
      record.element.className = `scene-label scene-layout-label scene-${anchor.kind}`;
      record.element.lang = locale;
      record.element.textContent = anchor.text;
      record.element.dataset.mode = 'short';
      record.element.dataset.emphasis = 'normal';
      record.element.dataset.layoutKind = anchor.kind;
      record.element.dataset.priority = String(record.priority);
      record.element.hidden = false;
      delete record.element.dataset.hiddenReason;
    }
    let routeLabelCount = 0;
    for (const route of view.activeRoutes) {
      const handle = routeLayer?.getRoute(route.id);
      if (!handle) continue;
      for (const hop of handle.plan.hops) {
        if (routeLabelCount >= DESKTOP_ROUTE_LABEL_LIMIT) break;
        const label = hop.hop.label?.[locale] ?? route.label?.[locale] ?? route.semantic;
        if (label.trim().length === 0) continue;
        const key = `route-label:${route.id}:${hop.index}`;
        active.add(key);
        let record = this.labels.get(key);
        if (!record) {
          const element = document.createElement('div');
          element.className = 'scene-label scene-route-label';
          element.dataset.routeLabelId = key;
          element.setAttribute('aria-hidden', 'true');
          this.container.append(element);
          record = {
            key,
            element,
            source: 'route',
            priority: ACTIVE_ROUTE_PRIORITY,
            entityId: undefined,
            worldPosition: new THREE.Vector3(),
          };
          this.labels.set(key, record);
        }
        record.source = 'route';
        record.entityId = undefined;
        record.worldPosition ??= new THREE.Vector3();
        record.worldPosition.copy(
          handle.plan.markers[hop.index]?.position ?? samplePolyline(hop.points, 0.5),
        );
        record.priority = Math.max(SELECTED_ENTITY_PRIORITY + 1, ACTIVE_ROUTE_PRIORITY - hop.index);
        record.element.className = 'scene-label scene-route-label';
        record.element.lang = locale;
        record.element.textContent = label;
        record.element.dataset.mode = 'short';
        record.element.dataset.emphasis = 'active';
        record.element.dataset.routeId = route.id;
        record.element.dataset.hopIndex = String(hop.index);
        record.element.dataset.priority = String(record.priority);
        record.element.hidden = false;
        delete record.element.dataset.hiddenReason;
        routeLabelCount += 1;
      }
      if (routeLabelCount >= DESKTOP_ROUTE_LABEL_LIMIT) break;
    }
    for (const [id, record] of this.labels) {
      if (active.has(id)) continue;
      record.element.remove();
      this.labels.delete(id);
    }
  }

  public update(
    registry: SceneRegistry,
    camera: THREE.Camera,
    width: number,
    height: number,
    requestedSafeRect?: LabelSafeRect,
    avoidanceRects: readonly LabelSafeRect[] = [],
  ): void {
    if (!this.view) return;
    const safe = normalizeSafeRect(width, height, requestedSafeRect);
    if (!safe) {
      for (const record of this.labels.values()) hideRecord(record, 'invalid-viewport');
      return;
    }

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    const projected: ProjectedLabel[] = [];
    const protectedCenters: ScreenPoint[] = [];

    for (const handle of registry.values()) {
      const state = this.view.entityStates[handle.entityId];
      const selected = handle.root.userData.selected === true;
      if (
        !state ||
        !handle.root.visible ||
        handle.isDisposed ||
        (!selected && state.emphasis !== 'focused')
      ) {
        continue;
      }
      const center = projectPoint(handle.getAnchor('center'), camera, width, height);
      if (center.visible) protectedCenters.push({ x: center.x, y: center.y });
    }

    for (const record of this.labels.values()) {
      const handle = record.entityId ? registry.get(record.entityId) : undefined;
      const state = record.entityId ? this.view.entityStates[record.entityId] : undefined;
      if (
        record.source === 'entity' &&
        (!handle || !state || !handle.root.visible || handle.isDisposed)
      ) {
        hideRecord(record, 'inactive');
        continue;
      }
      if (record.source === 'entity' && handle && state) {
        // Counter cues update the visual handle after the projection sync. Refresh the DOM label
        // every frame so a settled screenshot cannot retain the cue's previous counter values.
        record.element.textContent = entityLabelText(handle, state);
      }
      const worldPoint =
        record.source === 'entity' ? handle?.getAnchor('label') : record.worldPosition;
      if (!worldPoint) {
        hideRecord(record, 'missing-anchor');
        continue;
      }
      const screenPoint = projectPoint(worldPoint, camera, width, height);
      const distance = cameraPosition.distanceTo(worldPoint);
      if (!screenPoint.visible) {
        hideRecord(record, 'outside-camera');
        continue;
      }
      if (record.source === 'entity' && distance > 27 && record.priority < 60) {
        hideRecord(record, 'distance');
        continue;
      }
      const measuredWidth =
        record.element.offsetWidth || (record.element.textContent?.length ?? 8) * 6.5;
      const measuredHeight = record.element.offsetHeight || 24;
      const labelWidth = Math.min(
        Math.max(1, measuredWidth + LABEL_MEASUREMENT_SAFETY_PX),
        safe.width,
      );
      const labelHeight = Math.min(Math.max(1, measuredHeight), safe.height);
      record.element.style.maxWidth = `${Math.max(1, safe.width)}px`;
      record.element.style.boxSizing = 'border-box';
      record.element.style.overflow = 'hidden';
      record.element.style.textOverflow = 'ellipsis';
      projected.push({
        record,
        preferred: { x: screenPoint.x, y: screenPoint.y },
        width: labelWidth,
        height: labelHeight,
        distance,
      });
    }

    const accepted: Array<{ readonly label: ProjectedLabel; readonly rect: LayoutRect }> = [];
    const avoidance = avoidanceRects.flatMap((rect): LayoutRect[] => {
      if (
        !Number.isFinite(rect.x) ||
        !Number.isFinite(rect.y) ||
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return [];
      }
      return [
        {
          ...rect,
          left: rect.x,
          right: rect.x + rect.width,
          top: rect.y,
          bottom: rect.y + rect.height,
        },
      ];
    });
    const isMobile = width <= MOBILE_BREAKPOINT;
    const mobileLabelLimit = Math.max(0, MOBILE_LABEL_LIMIT - avoidance.length);
    const maximumVisibleEntities = isMobile ? MOBILE_LABEL_LIMIT : DESKTOP_LABEL_LIMIT;
    const maximumVisibleRoutes = isMobile ? MOBILE_ROUTE_LABEL_LIMIT : DESKTOP_ROUTE_LABEL_LIMIT;
    projected
      .sort(
        (left, right) =>
          right.record.priority - left.record.priority ||
          left.distance - right.distance ||
          left.record.key.localeCompare(right.record.key),
      )
      .forEach((candidate) => {
        const critical = candidate.record.priority >= CRITICAL_PRIORITY;
        const acceptedZoneHeadingCount = accepted.filter(
          (current) =>
            current.label.record.source === 'layout' &&
            current.label.record.element.dataset.layoutKind === 'zone-title',
        ).length;
        // The mobile ceiling is shared by entity, layout, and route labels. Separate
        // per-source ceilings let layout labels escape the density budget. One zone heading is
        // enough to orient a narrow teaching view; the remaining slots preserve object identity
        // and the active route instead of repeating three region titles.
        if (isMobile && accepted.length >= mobileLabelLimit) {
          hideRecord(candidate.record, 'density');
          return;
        }
        if (
          isMobile &&
          candidate.record.source === 'layout' &&
          candidate.record.element.dataset.layoutKind === 'zone-title' &&
          acceptedZoneHeadingCount >= 1
        ) {
          hideRecord(candidate.record, 'density');
          return;
        }
        const acceptedEntityCount = accepted.filter(
          (current) => current.label.record.source === 'entity',
        ).length;
        const acceptedRouteCount = accepted.filter(
          (current) => current.label.record.source === 'route',
        ).length;
        if (candidate.record.source === 'entity' && acceptedEntityCount >= maximumVisibleEntities) {
          hideRecord(candidate.record, 'density');
          return;
        }
        if (candidate.record.source === 'route' && acceptedRouteCount >= maximumVisibleRoutes) {
          hideRecord(candidate.record, 'density');
          return;
        }
        const base = basePlacementCenters(candidate.preferred, candidate.width, candidate.height);
        const centers = critical
          ? uniqueCenters([
              ...base,
              ...exhaustivePlacementCenters(
                candidate.preferred,
                candidate.width,
                candidate.height,
                safe,
              ),
            ])
          : base;
        const placement = centers
          .map((center) => rectFromCenter(center, candidate.width, candidate.height))
          .find(
            (rect) =>
              rectInside(rect, safe) &&
              !avoidance.some((obstacle) => rectsOverlap(obstacle, rect)) &&
              !accepted.some((current) => rectsOverlap(current.rect, rect)) &&
              !protectedCenters.some((center) => rectContainsPoint(rect, center)),
          );
        if (!placement) {
          hideRecord(candidate.record, critical ? 'no-safe-critical-placement' : 'collision');
          return;
        }
        accepted.push({ label: candidate, rect: placement });
        const element = candidate.record.element;
        element.hidden = false;
        delete element.dataset.hiddenReason;
        element.dataset.screenX = String(placement.x);
        element.dataset.screenY = String(placement.y);
        element.dataset.screenWidth = String(placement.width);
        element.dataset.screenHeight = String(placement.height);
        element.style.transform = `translate(${placement.x}px, ${placement.y}px)`;
      });
  }

  public clear(): void {
    for (const record of this.labels.values()) record.element.remove();
    this.labels.clear();
    this.view = undefined;
  }

  public get size(): number {
    return this.labels.size;
  }
}

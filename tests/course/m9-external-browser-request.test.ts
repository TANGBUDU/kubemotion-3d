/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { EntityViewState } from '../../src/course/types';
import { findRawLessonRouteContractIssues } from '../../src/content/rawRouteContract';
import { lessonV2Schema, scenarioV2AuthorSchema } from '../../src/content/schemas';
import { GatewayConfigurationVisualHandle } from '../../src/renderer/visuals/GatewayConfigurationVisual';
import { GatewayDataPlaneVisualHandle } from '../../src/renderer/visuals/GatewayDataPlaneVisual';
import { PublicDNSVisualHandle } from '../../src/renderer/visuals/PublicDNSVisual';
import type { LocalizedText, WorldEntity } from '../../src/world/types';

const SCENARIO_PATH = resolve(
  import.meta.dirname,
  '../../content/scenarios/external-browser-request.yaml',
);
const LESSON_PATH = resolve(
  import.meta.dirname,
  '../../content/courses/kubernetes-foundations/lessons/full-external-request.yaml',
);

const BROWSER = 'external:internet:global:Browser:shopper';
const PUBLIC_DNS = 'external:internet:global:PublicDNS:shop-example';
const GATEWAY = 'api-object:namespaced:shop:Gateway:public-gateway';
const HTTP_ROUTE = 'api-object:namespaced:shop:HTTPRoute:shop-route';
const GATEWAY_DATA_PLANE = 'infrastructure:cluster:global:GatewayDataPlane:edge-gateway';
const SERVICE = 'api-object:namespaced:shop:Service:web';
const ENDPOINT_SLICE = 'api-object:namespaced:shop:EndpointSlice:web-slice';
const SELECTED_POD = 'api-object:namespaced:shop:Pod:web-a';

const rawScenario: unknown = parse(readFileSync(SCENARIO_PATH, 'utf8'), { merge: true });
const rawLesson: unknown = parse(readFileSync(LESSON_PATH, 'utf8'), { merge: true });
const scenario = scenarioV2AuthorSchema.parse(rawScenario);
const lesson = lessonV2Schema.parse(rawLesson);

const entityById = new Map(scenario.entities.map((entity) => [entity.id, entity]));

const step = (id: string) => {
  const value = lesson.steps.find((candidate) => candidate.id === id);
  if (!value) throw new Error(`Missing raw lesson step ${id}`);
  return value;
};

const localizedFields = (value: LocalizedText): readonly string[] =>
  [value.en, value.ja, value['zh-CN']].map((text) => text.trim());

const visibleRuleIncludes = (stepId: string, entityId: string): boolean =>
  step(stepId).viewPatch.entityRules?.some(
    (rule) =>
      'byIds' in rule.selector &&
      rule.selector.byIds.includes(entityId) &&
      rule.visible === true &&
      rule.emphasis !== 'hidden',
  ) ?? false;

const visualView: EntityViewState = Object.freeze({
  visible: true,
  emphasis: 'normal',
  labelMode: 'full',
  inspectorMode: 'expanded',
});

const roles = (entity: {
  readonly root: { traverse(callback: (object: { userData: object }) => void): void };
}) => {
  const values: string[] = [];
  entity.root.traverse((object) => {
    const role = (object.userData as { readonly role?: unknown }).role;
    if (typeof role === 'string') values.push(role);
  });
  return values;
};

describe('M9 Story 7 external browser request raw contract', () => {
  it('parses as isolated schema-v2 content with six complete trilingual steps', () => {
    expect(scenario.scenarioId).toBe('external-browser-request');
    expect(lesson).toMatchObject({
      id: 'full-external-request',
      scenarioId: scenario.scenarioId,
      chapterId: 'external-traffic',
      prerequisites: ['probes-and-rolling-update'],
    });
    expect(lesson.steps.map((candidate) => candidate.id)).toEqual([
      'browser-opens-public-name',
      'public-dns-query-and-response',
      'gateway-and-httproute-configure-entry',
      'ready-endpoint-is-selected',
      'browser-request-reaches-selected-pod',
      'application-response-returns',
    ]);
    expect(findRawLessonRouteContractIssues(rawLesson, LESSON_PATH)).toEqual([]);

    for (const lessonStep of lesson.steps) {
      for (const value of [
        lessonStep.title,
        lessonStep.learningOutcome,
        lessonStep.narration,
        lessonStep.teaching.whatChanged,
        lessonStep.teaching.whyItHappened,
        lessonStep.teaching.takeaway,
      ]) {
        expect(
          localizedFields(value).every((text) => text.length > 0),
          lessonStep.id,
        ).toBe(true);
      }
      expect(lessonStep.evidence.mode, lessonStep.id).not.toBe('none');
      expect(lessonStep.evidence.entityIds.length, lessonStep.id).toBeGreaterThan(0);
      expect(lessonStep.sourceIds.length, lessonStep.id).toBeGreaterThan(0);
    }
  });

  it('uses semantic IDs, reserved teaching names and addresses, and valid relation endpoints', () => {
    expect(new Set(scenario.entities.map((entity) => entity.id)).size).toBe(
      scenario.entities.length,
    );
    expect(entityById.get(BROWSER)?.data).toMatchObject({
      host: 'shop.example',
      clientAddress: '192.0.2.10',
      syntheticAddress: true,
      trafficRole: 'client',
    });
    expect(entityById.get(PUBLIC_DNS)?.data).toMatchObject({
      queryName: 'shop.example',
      answer: '203.0.113.80',
      syntheticAddress: true,
    });
    expect(entityById.get(GATEWAY_DATA_PLANE)?.data).toMatchObject({
      listenerAddress: '203.0.113.80',
      syntheticAddress: true,
      trafficRole: 'ingress',
    });
    expect(entityById.get(SERVICE)?.data).toMatchObject({
      clusterIP: '198.51.100.80',
      syntheticAddress: true,
      trafficRole: 'stable-entry',
    });

    const endpointAddresses = entityById.get(ENDPOINT_SLICE)?.data.endpoints;
    expect(endpointAddresses).toEqual([
      expect.objectContaining({ address: '192.0.2.81', targetRef: SELECTED_POD }),
      expect.objectContaining({ address: '192.0.2.82' }),
    ]);
    for (const entity of scenario.entities) {
      expect(entity.id.split(':').length, entity.id).toBeGreaterThanOrEqual(5);
      if (entity.kind === 'Pod') {
        expect(entity.data.uid, entity.id).toMatch(/^synthetic-uid-/);
      }
    }
    for (const relation of scenario.relations) {
      expect(entityById.has(relation.from), `${relation.id}.from`).toBe(true);
      expect(entityById.has(relation.to), `${relation.id}.to`).toBe(true);
    }
  });

  it('keeps DNS request/response separate from the later application request', () => {
    const dns = step('public-dns-query-and-response');
    const dnsRoute = dns.viewPatch.activeRoutes?.find(
      (route) => route.id === 'external-browser-public-dns',
    );
    expect(dnsRoute).toMatchObject({
      semantic: 'dns',
      persistAfterAnimation: true,
      hops: [{ fromEntityId: BROWSER, toEntityId: PUBLIC_DNS }],
    });
    expect(dns.transition?.cues).toEqual([
      expect.objectContaining({
        type: 'dns-query',
        routeId: dnsRoute?.id,
        flowPhase: 'request',
        direction: 'forward',
      }),
      expect.objectContaining({
        type: 'dns-query',
        routeId: dnsRoute?.id,
        flowPhase: 'response',
        direction: 'reverse',
      }),
    ]);

    const application = step('browser-request-reaches-selected-pod');
    const applicationRoute = application.viewPatch.activeRoutes?.find(
      (route) => route.id === 'external-browser-to-web-a',
    );
    expect(applicationRoute).toMatchObject({
      semantic: 'data-flow',
      requestId: 'external-shop-https',
      flowPhase: 'request',
      persistAfterAnimation: true,
      support: {
        endpointSliceId: ENDPOINT_SLICE,
        serviceId: SERVICE,
        selectedEndpointTargetId: SELECTED_POD,
      },
    });
    expect(applicationRoute?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [BROWSER, GATEWAY_DATA_PLANE],
      [GATEWAY_DATA_PLANE, SERVICE],
      [SERVICE, SELECTED_POD],
    ]);
    expect(applicationRoute?.id).not.toBe(dnsRoute?.id);
    expect(applicationRoute?.requestId).not.toBe(dnsRoute?.requestId);
    expect(application.transition?.cues).toEqual([
      expect.objectContaining({
        type: 'data-packet',
        routeId: applicationRoute?.id,
        flowPhase: 'request',
        direction: 'forward',
      }),
    ]);

    const response = step('application-response-returns');
    expect(response.viewPatch.activeRoutes?.[0]?.hops).toEqual(applicationRoute?.hops);
    expect(response.transition?.cues).toEqual([
      expect.objectContaining({
        type: 'data-packet',
        routeId: applicationRoute?.id,
        flowPhase: 'request',
        direction: 'forward',
      }),
      expect.objectContaining({
        type: 'data-packet',
        routeId: applicationRoute?.id,
        flowPhase: 'response',
        direction: 'reverse',
      }),
    ]);
  });

  it('keeps Gateway, HTTPRoute, EndpointSlice, and PublicDNS out of application hops', () => {
    const forbiddenApplicationHops = new Set([GATEWAY, HTTP_ROUTE, ENDPOINT_SLICE, PUBLIC_DNS]);
    for (const stepId of ['browser-request-reaches-selected-pod', 'application-response-returns']) {
      const lessonStep = step(stepId);
      const hopEntityIds =
        lessonStep.viewPatch.activeRoutes?.flatMap((route) =>
          route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]),
        ) ?? [];
      expect(hopEntityIds.filter((entityId) => forbiddenApplicationHops.has(entityId))).toEqual([]);
      for (const supportId of [GATEWAY, HTTP_ROUTE, ENDPOINT_SLICE]) {
        expect(visibleRuleIncludes(stepId, supportId), `${stepId}/${supportId}`).toBe(true);
      }
    }

    expect(entityById.get(GATEWAY)).toMatchObject({
      kind: 'Gateway',
      visual: { archetype: 'config' },
    });
    expect(entityById.get(HTTP_ROUTE)).toMatchObject({
      kind: 'HTTPRoute',
      visual: { archetype: 'config' },
    });
    expect(entityById.get(GATEWAY_DATA_PLANE)).toMatchObject({
      kind: 'GatewayDataPlane',
      visual: { archetype: 'gateway' },
    });
  });

  it('provides specialized visuals with an explicit configuration/data-plane boundary', () => {
    const publicDns = new PublicDNSVisualHandle(
      entityById.get(PUBLIC_DNS) as WorldEntity,
      visualView,
    );
    const dataPlane = new GatewayDataPlaneVisualHandle(
      entityById.get(GATEWAY_DATA_PLANE) as WorldEntity,
      visualView,
    );
    const gatewayConfig = new GatewayConfigurationVisualHandle(
      entityById.get(GATEWAY) as WorldEntity,
      visualView,
    );
    const httpRouteConfig = new GatewayConfigurationVisualHandle(
      entityById.get(HTTP_ROUTE) as WorldEntity,
      visualView,
    );

    expect(publicDns.root.userData).toMatchObject({
      visualKind: 'public-dns-resolver',
      dnsDataPlane: true,
      applicationPacketHop: false,
      queryName: 'shop.example',
      answer: '203.0.113.80',
    });
    expect(roles(publicDns)).toContain('public-dns-resolution-orbit');

    expect(dataPlane.root.userData).toMatchObject({
      visualKind: 'gateway-data-plane',
      dataPlane: true,
      configurationObject: false,
      applicationPacketHop: true,
    });
    expect(roles(dataPlane)).toEqual(
      expect.arrayContaining(['gateway-data-plane-ingress', 'gateway-data-plane-egress']),
    );

    expect(gatewayConfig.root.userData).toMatchObject({
      visualKind: 'gateway-configuration-card',
      configurationOnly: true,
      dataPlane: false,
      applicationPacketHop: false,
    });
    expect(httpRouteConfig.root.userData).toMatchObject({
      visualKind: 'http-route-configuration-card',
      configurationOnly: true,
      dataPlane: false,
      applicationPacketHop: false,
      parentGatewayRef: GATEWAY,
      backendServiceRef: SERVICE,
    });
    expect(roles(gatewayConfig)).toContain('gateway-configuration-glyph');
    expect(roles(httpRouteConfig)).toContain('http-route-configuration-glyph');

    publicDns.dispose();
    dataPlane.dispose();
    gatewayConfig.dispose();
    httpRouteConfig.dispose();
    expect(publicDns.isDisposed).toBe(true);
    expect(dataPlane.isDisposed).toBe(true);
    expect(gatewayConfig.isDisposed).toBe(true);
    expect(httpRouteConfig.isDisposed).toBe(true);
  });
});

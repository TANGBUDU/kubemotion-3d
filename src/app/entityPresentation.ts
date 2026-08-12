import type { Locale } from './types';
import type { ViewMode } from '../course/types';
import type { WorldEntity } from '../world/types';

export interface ViewPresentation {
  readonly title: string;
  readonly question: string;
  readonly steps: readonly string[];
  readonly note?: string;
}

export interface ComponentExplanation {
  readonly heading: string;
  readonly responsibility: string;
  readonly mechanism: string;
  readonly notResponsible?: string;
}

const viewCopy: Readonly<Record<Locale, Readonly<Record<ViewMode, ViewPresentation>>>> = {
  en: {
    overview: {
      title: 'Cluster overview',
      question: 'Which parts decide, and which parts run the application?',
      steps: ['Control plane · keeps cluster state and makes decisions', 'Worker Nodes · run Pods'],
      note: 'This is a teaching arrangement, not a literal rack layout.',
    },
    logical: {
      title: 'Workload ownership',
      question: 'Which object manages which replaceable copy?',
      steps: [
        'Deployment · rollout intent',
        'ReplicaSet · keeps the replica count',
        'Pod · one replaceable copy',
      ],
      note: 'This is a logical relationship, not network traffic.',
    },
    placement: {
      title: 'Runtime hierarchy',
      question: 'Where does the application actually run?',
      steps: [
        'Worker Node · a machine',
        'Pod · the scheduled runtime unit',
        'Container · the application process',
      ],
    },
    'control-flow': {
      title: 'Control flow',
      question: 'Who decides, and who performs the work?',
      steps: [
        'API Server · shared control entry',
        'Controller or Scheduler · decides',
        'kubelet and runtime · execute on a Node',
      ],
      note: 'Control commands are not application traffic.',
    },
    traffic: {
      title: 'Request path',
      question: 'Where does one application request go?',
      steps: [
        'Client · sends the request',
        'Service or Gateway · stable entry',
        'Ready Pod · receives the request',
      ],
      note: 'EndpointSlice is the backend list, not a packet-processing hop.',
    },
    storage: {
      title: 'Storage path',
      question: 'Where does persistent data live?',
      steps: [
        'Pod · requests a volume',
        'PVC · storage request',
        'PV / storage backend · keeps the data',
      ],
    },
  },
  ja: {
    overview: {
      title: 'クラスター全体',
      question: 'どこが判断し、どこがアプリを実行する？',
      steps: ['Control Plane · 状態を保持して判断する', 'Worker Node · Pod を実行する'],
      note: '理解のための配置であり、実際のラック構成を示すものではありません。',
    },
    logical: {
      title: 'ワークロードの管理関係',
      question: 'どのオブジェクトが、どの交換可能なコピーを管理する？',
      steps: ['Deployment · 更新方針', 'ReplicaSet · レプリカ数を維持', 'Pod · 交換可能な1コピー'],
      note: 'これは管理関係であり、ネットワーク通信ではありません。',
    },
    placement: {
      title: '実行階層',
      question: 'アプリは実際にどこで動く？',
      steps: [
        'Worker Node · 1台のマシン',
        'Pod · 配置される実行単位',
        'Container · アプリのプロセス',
      ],
    },
    'control-flow': {
      title: '制御の流れ',
      question: '誰が判断し、誰が実行する？',
      steps: [
        'API Server · 共通の制御入口',
        'Controller / Scheduler · 判断する',
        'kubelet / runtime · Node 上で実行する',
      ],
      note: '制御命令はアプリケーション通信ではありません。',
    },
    traffic: {
      title: 'リクエスト経路',
      question: '1つのアプリ通信はどこを通る？',
      steps: [
        'Client · リクエストを送る',
        'Service / Gateway · 安定した入口',
        'Ready Pod · リクエストを受け取る',
      ],
      note: 'EndpointSlice は backend 一覧であり、packet の中継点ではありません。',
    },
    storage: {
      title: 'ストレージ経路',
      question: '永続データはどこに残る？',
      steps: ['Pod · volume を要求', 'PVC · ストレージ要求', 'PV / storage backend · データを保持'],
    },
  },
  'zh-CN': {
    overview: {
      title: '集群全景',
      question: '哪些组件负责决策，哪些机器真正运行应用？',
      steps: ['控制面 · 保存集群状态并做决定', '工作节点 · 实际运行 Pod'],
      note: '这是为了教学而整理的布局，不代表真实机房的物理摆放。',
    },
    logical: {
      title: '工作负载管理层级',
      question: '谁负责管理谁，哪一层是可替换副本？',
      steps: [
        'Deployment · 定义更新目标',
        'ReplicaSet · 维持副本数量',
        'Pod · 一份可替换的应用副本',
      ],
      note: '这里展示的是管理关系，不是网络流量。',
    },
    placement: {
      title: '应用运行层级',
      question: '应用究竟运行在哪里？',
      steps: ['工作节点 Node · 一台机器', 'Pod · 被调度的运行单元', 'Container · 真正的应用进程'],
    },
    'control-flow': {
      title: '控制流程',
      question: '谁负责决定，谁负责真正执行？',
      steps: [
        'API Server · 所有控制组件共享的入口',
        'Controller / Scheduler · 做决定',
        'kubelet / runtime · 在 Node 上执行',
      ],
      note: '控制命令不是用户请求流量。',
    },
    traffic: {
      title: '请求路径',
      question: '一条应用请求到底经过哪里？',
      steps: ['客户端 · 发出请求', 'Service / Gateway · 提供稳定入口', 'Ready Pod · 真正接收请求'],
      note: 'EndpointSlice 是后端名单，不是数据包中转站。',
    },
    storage: {
      title: '存储路径',
      question: '持久数据最后保存在哪里？',
      steps: ['Pod · 请求挂载存储', 'PVC · 提出存储需求', 'PV / 存储后端 · 真正保存数据'],
    },
  },
};

const chapterCopy: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  en: {
    foundations: 'Foundations',
    'workloads-self-healing': 'Workloads and self-healing',
    'networking-resilience': 'Networking and resilience',
    'resources-scaling': 'Health, rollout, and scaling',
    'external-traffic': 'External traffic',
  },
  ja: {
    foundations: '基礎編',
    'workloads-self-healing': 'ワークロードと自己修復',
    'networking-resilience': 'ネットワークと耐障害性',
    'resources-scaling': 'ヘルスチェック・更新・スケーリング',
    'external-traffic': '外部トラフィック',
  },
  'zh-CN': {
    foundations: '基础篇',
    'workloads-self-healing': '工作负载与自愈',
    'networking-resilience': '网络与韧性',
    'resources-scaling': '健康检查、更新与扩缩容',
    'external-traffic': '外部流量',
  },
};

const generatedSuffix = /-([a-z])(?:-(?:old|new|replacement))?$/i;
const generatedHash = /-[a-z0-9]{5,12}(?=-[a-z](?:-|$))/i;

function applicationName(entity: WorldEntity): string {
  const label =
    entity.labels?.['app.kubernetes.io/name'] ?? entity.labels?.app ?? entity.labels?.component;
  if (label) return label;
  return (
    entity.name
      .replace(generatedHash, '')
      .replace(/-(?:rs|deployment|service|slice|endpoints?)$/i, '')
      .split('-')[0] ?? entity.name
  );
}

function instanceLetter(entity: WorldEntity): string | undefined {
  const match =
    generatedSuffix.exec(entity.name) ?? generatedSuffix.exec(entity.id.split(':').at(-1) ?? '');
  return match?.[1]?.toUpperCase();
}

export function friendlyEntityName(entity: WorldEntity, locale: Locale): string {
  const app = applicationName(entity);
  const letter = instanceLetter(entity);
  const podName = `${app} Pod${letter ? ` ${letter}` : ''}`;

  if (locale === 'zh-CN') {
    switch (entity.kind) {
      case 'Cluster':
        return 'Kubernetes 集群';
      case 'Node':
        return `工作节点 ${instanceLetter(entity) ?? entity.name.at(-1)?.toUpperCase() ?? ''}（${entity.name}）`;
      case 'Pod':
        return entity.status === 'pending' ? `新建的 ${podName}` : podName;
      case 'Container':
        return `${entity.name} 容器`;
      case 'Deployment':
        return `${app} Deployment · 更新目标`;
      case 'ReplicaSet':
        return `${app} ReplicaSet · 副本控制器`;
      case 'Service':
        return `${app} Service · 稳定入口`;
      case 'EndpointSlice':
        return `${app} 后端名单`;
      case 'Namespace':
        return `${entity.name} Namespace · 逻辑范围`;
      case 'KubeAPIServer':
      case 'ApiServer':
      case 'APIServer':
        return 'API Server · 集群控制入口';
      case 'Etcd':
        return 'etcd · 集群状态库';
      case 'ControllerManager':
      case 'KubeControllerManager':
        return 'Controller Manager · 自动纠偏';
      case 'Scheduler':
        return 'Scheduler · 选择 Node';
      case 'Kubelet':
        return 'kubelet · Node 管理代理';
      case 'ContainerRuntime':
        return '容器运行时 · 启动 Container';
      case 'Browser':
        return '浏览器客户端';
      case 'Developer':
      case 'Kubectl':
        return '开发者 / kubectl';
      case 'CoreDNS':
        return 'CoreDNS · 名称解析';
      case 'GatewayDataPlane':
        return 'Gateway 数据面';
      case 'Gateway':
        return 'Gateway · 入口配置';
      case 'HTTPRoute':
        return 'HTTPRoute · 路由规则';
      case 'HorizontalPodAutoscaler':
        return 'HPA · 自动调整副本数';
      case 'MetricSource':
        return '指标来源';
      default:
        return entity.title[locale] || entity.name;
    }
  }

  if (locale === 'ja') {
    switch (entity.kind) {
      case 'Cluster':
        return 'Kubernetes クラスター';
      case 'Node':
        return `Worker Node ${instanceLetter(entity) ?? entity.name.at(-1)?.toUpperCase() ?? ''}（${entity.name}）`;
      case 'Pod':
        return entity.status === 'pending' ? `新しい ${podName}` : podName;
      case 'Container':
        return `${entity.name} Container`;
      case 'Deployment':
        return `${app} Deployment · 更新目標`;
      case 'ReplicaSet':
        return `${app} ReplicaSet · レプリカ管理`;
      case 'Service':
        return `${app} Service · 安定した入口`;
      case 'EndpointSlice':
        return `${app} backend 一覧`;
      case 'Namespace':
        return `${entity.name} Namespace · 論理スコープ`;
      case 'KubeAPIServer':
      case 'ApiServer':
      case 'APIServer':
        return 'API Server · 制御入口';
      case 'Etcd':
        return 'etcd · クラスター状態';
      case 'ControllerManager':
      case 'KubeControllerManager':
        return 'Controller Manager · 自動修正';
      case 'Scheduler':
        return 'Scheduler · Node を選択';
      case 'Kubelet':
        return 'kubelet · Node 管理エージェント';
      case 'ContainerRuntime':
        return 'Container Runtime · Container 起動';
      case 'Browser':
        return 'ブラウザー Client';
      case 'Developer':
      case 'Kubectl':
        return '開発者 / kubectl';
      case 'CoreDNS':
        return 'CoreDNS · 名前解決';
      case 'GatewayDataPlane':
        return 'Gateway Data Plane';
      case 'Gateway':
        return 'Gateway · 入口設定';
      case 'HTTPRoute':
        return 'HTTPRoute · ルーティング規則';
      case 'HorizontalPodAutoscaler':
        return 'HPA · レプリカ数を調整';
      case 'MetricSource':
        return 'メトリクス入力';
      default:
        return entity.title[locale] || entity.name;
    }
  }

  switch (entity.kind) {
    case 'Cluster':
      return 'Kubernetes cluster';
    case 'Node':
      return `Worker Node ${instanceLetter(entity) ?? entity.name.at(-1)?.toUpperCase() ?? ''} (${entity.name})`;
    case 'Pod':
      return entity.status === 'pending' ? `new ${podName}` : podName;
    case 'Container':
      return `${entity.name} container`;
    case 'Deployment':
      return `${app} Deployment · rollout intent`;
    case 'ReplicaSet':
      return `${app} ReplicaSet · replica controller`;
    case 'Service':
      return `${app} Service · stable entry`;
    case 'EndpointSlice':
      return `${app} backend list`;
    case 'Namespace':
      return `${entity.name} Namespace · logical scope`;
    case 'KubeAPIServer':
    case 'ApiServer':
    case 'APIServer':
      return 'API Server · control entry';
    case 'Etcd':
      return 'etcd · cluster state store';
    case 'ControllerManager':
    case 'KubeControllerManager':
      return 'Controller Manager · reconciliation';
    case 'Scheduler':
      return 'Scheduler · chooses a Node';
    case 'Kubelet':
      return 'kubelet · Node agent';
    case 'ContainerRuntime':
      return 'Container runtime · starts containers';
    case 'Browser':
      return 'Browser client';
    case 'Developer':
    case 'Kubectl':
      return 'Developer / kubectl';
    case 'CoreDNS':
      return 'CoreDNS · name lookup';
    case 'GatewayDataPlane':
      return 'Gateway data plane';
    case 'Gateway':
      return 'Gateway · entry configuration';
    case 'HTTPRoute':
      return 'HTTPRoute · routing rule';
    case 'HorizontalPodAutoscaler':
      return 'HPA · adjusts replica target';
    case 'MetricSource':
      return 'Metric input';
    default:
      return entity.title[locale] || entity.name;
  }
}

const componentCopy: Readonly<
  Record<Locale, Readonly<Record<string, Omit<ComponentExplanation, 'heading'>>>>
> = {
  en: {
    ControllerManager: {
      responsibility:
        'Continuously compares desired state with current state and starts corrective work when they differ.',
      mechanism:
        'Controllers read objects through the API Server. If desired replicas are 3 and only 2 exist, a controller creates a replacement Pod object.',
      notResponsible:
        'It does not choose the Node and does not start the container. Scheduler chooses the Node; kubelet and the runtime execute there.',
    },
    KubeAPIServer: {
      responsibility:
        'Provides the shared Kubernetes API used by users and control-plane components.',
      mechanism:
        'It validates requests, exposes stored object state, and is the hub through which controllers, Scheduler, and kubelets coordinate.',
      notResponsible:
        'It does not run application containers and is not an application traffic proxy.',
    },
    Scheduler: {
      responsibility: 'Chooses a suitable Node for a Pending Pod that has not been bound yet.',
      mechanism:
        'It evaluates available Nodes and records the chosen binding through the API Server.',
      notResponsible:
        'It does not start containers. The chosen Node’s kubelet and container runtime do that later.',
    },
    Kubelet: {
      responsibility: 'Makes the Pods assigned to one Node actually run and reports their status.',
      mechanism:
        'It watches assigned Pod specifications, asks the container runtime to start or restart containers, and reports status back through the API.',
      notResponsible: 'It does not decide the cluster-wide replica count or choose the Node.',
    },
    ContainerRuntime: {
      responsibility: 'Creates and runs container processes on one Node.',
      mechanism:
        'It pulls images, creates container instances, and starts or stops them when kubelet requests it.',
      notResponsible: 'It does not schedule Pods or maintain desired replica counts.',
    },
    Deployment: {
      responsibility: 'Stores the rollout intent for a stateless application.',
      mechanism: 'It manages ReplicaSets so a new version can be introduced gradually.',
      notResponsible: 'Application requests do not pass through a Deployment object.',
    },
    ReplicaSet: {
      responsibility: 'Keeps the requested number of matching Pod copies present.',
      mechanism: 'Its controller notices a replica deficit and creates replacement Pod objects.',
      notResponsible: 'It does not choose Nodes and is not a network load balancer.',
    },
    Node: {
      responsibility: 'Provides the machine resources where Pods and containers run.',
      mechanism:
        'kubelet and a container runtime on the Node turn assigned Pod specifications into running processes.',
      notResponsible: 'A Node is physical placement, not a Namespace or workload controller.',
    },
    Pod: {
      responsibility: 'Represents one scheduled, replaceable application instance.',
      mechanism:
        'It groups one or more containers that share a network identity and selected storage.',
      notResponsible: 'A Pod is not a permanent server. Controllers replace it when needed.',
    },
    Container: {
      responsibility: 'Runs the actual application process and image.',
      mechanism: 'The container runtime starts it inside a Pod on one Node.',
      notResponsible:
        'A container by itself does not provide scheduling, replica recovery, or a stable Service address.',
    },
    Service: {
      responsibility: 'Provides a stable logical address for a changing set of backend Pods.',
      mechanism:
        'Its selector and EndpointSlice state identify eligible backends; the cluster data plane sends traffic to one Ready endpoint.',
      notResponsible:
        'A Service object is not the application process and EndpointSlice is not a packet hop.',
    },
    EndpointSlice: {
      responsibility:
        'Records the network endpoints backing a Service and their readiness conditions.',
      mechanism:
        'Controllers update endpoint rows as Pods become Ready, NotReady, or are replaced.',
      notResponsible:
        'Packets do not travel through the EndpointSlice object; it is selection evidence.',
    },
    Etcd: {
      responsibility: 'Stores Kubernetes API object state for the control plane.',
      mechanism:
        'The API Server reads and writes cluster object data in this consistent datastore.',
      notResponsible: 'It is not the database for your application business data.',
    },
    Namespace: {
      responsibility: 'Provides a logical scope for namespaced Kubernetes objects.',
      mechanism: 'Names and access rules can be separated without changing which Node runs a Pod.',
      notResponsible: 'A Namespace is not a machine and does not contain Nodes.',
    },
    GatewayDataPlane: {
      responsibility:
        'Receives external application traffic and applies the configured routing result.',
      mechanism:
        'It terminates or forwards the connection, then sends the request toward a Service backend.',
      notResponsible:
        'Gateway and HTTPRoute API cards describe configuration; packets do not travel through those cards.',
    },
    Gateway: {
      responsibility: 'Declares listeners and the traffic-handling infrastructure to configure.',
      mechanism:
        'A Gateway controller translates this API object into a real data-plane configuration.',
      notResponsible: 'The Gateway API object is not itself the running proxy process.',
    },
    HTTPRoute: {
      responsibility: 'Declares which HTTP hosts and paths should reach which backend Service.',
      mechanism: 'A controller attaches the rule to a Gateway and configures the data plane.',
      notResponsible: 'A request does not enter the HTTPRoute card as a runtime hop.',
    },
    HorizontalPodAutoscaler: {
      responsibility:
        'Adjusts the desired replica count of a scalable workload from observed metrics.',
      mechanism:
        'It calculates a new desired count and updates the workload target; ordinary controllers create the Pods.',
      notResponsible: 'HPA does not directly create containers, schedule Pods, or route traffic.',
    },
  },
  ja: {
    ControllerManager: {
      responsibility: '望ましい状態と現在状態を繰り返し比較し、差があれば修正処理を始めます。',
      mechanism:
        'Controller は API Server から状態を読みます。期待3・現在2なら、新しい置換 Pod オブジェクトを作ります。',
      notResponsible:
        'Node の選択や Container の起動は担当しません。Scheduler と kubelet/runtime の仕事です。',
    },
    KubeAPIServer: {
      responsibility: '利用者と各制御コンポーネントが共有する Kubernetes API の入口です。',
      mechanism:
        '要求を検証し、保存されたオブジェクト状態を公開し、Controller・Scheduler・kubelet の調整点になります。',
      notResponsible: 'アプリ Container を実行せず、アプリ通信の proxy でもありません。',
    },
    Scheduler: {
      responsibility: 'まだ Node に割り当てられていない Pending Pod の配置先を選びます。',
      mechanism: '利用可能な Node を評価し、選んだ binding を API Server 経由で記録します。',
      notResponsible:
        'Container は起動しません。選択先 Node の kubelet と runtime が後で起動します。',
    },
    Kubelet: {
      responsibility: '自分の Node に割り当てられた Pod を実際に動かし、状態を報告します。',
      mechanism:
        'Pod 定義を監視し、runtime に Container の起動・再起動を依頼して、結果を API に報告します。',
      notResponsible: 'クラスター全体のレプリカ数や Node 選択は決めません。',
    },
    ContainerRuntime: {
      responsibility: '1つの Node 上で Container プロセスを作成・実行します。',
      mechanism: 'image を取得し、kubelet の要求で Container を起動・停止します。',
      notResponsible: 'Pod の scheduling やレプリカ数の維持は行いません。',
    },
    Deployment: {
      responsibility: 'ステートレスアプリの更新目標を保持します。',
      mechanism: 'ReplicaSet を管理し、新しい version を段階的に導入します。',
      notResponsible: 'アプリ通信は Deployment オブジェクトを通りません。',
    },
    ReplicaSet: {
      responsibility: '指定された数の一致する Pod コピーを維持します。',
      mechanism: '不足を検出すると置換 Pod オブジェクトを作ります。',
      notResponsible: 'Node は選ばず、network load balancer でもありません。',
    },
    Node: {
      responsibility: 'Pod と Container が動くマシン資源を提供します。',
      mechanism: 'Node 上の kubelet と runtime が Pod 定義を実行中プロセスへ変換します。',
      notResponsible: 'Namespace や workload controller ではありません。',
    },
    Pod: {
      responsibility: '配置される交換可能なアプリケーション1インスタンスを表します。',
      mechanism: 'network identity と一部 storage を共有する1つ以上の Container をまとめます。',
      notResponsible: '永続的な server ではなく、必要なら Controller が置き換えます。',
    },
    Container: {
      responsibility: '実際のアプリケーションプロセスと image を実行します。',
      mechanism: '1つの Node 上の Pod 内で runtime が起動します。',
      notResponsible:
        '単体では scheduling、レプリカ復旧、安定した Service address を提供しません。',
    },
    Service: {
      responsibility: '変化する backend Pod 集合へ安定した論理アドレスを提供します。',
      mechanism:
        'selector と EndpointSlice が利用可能な backend を示し、data plane が Ready endpoint へ送ります。',
      notResponsible:
        'Service オブジェクト自体はアプリ process ではなく、EndpointSlice も packet hop ではありません。',
    },
    EndpointSlice: {
      responsibility: 'Service の backend endpoint と readiness 条件を記録します。',
      mechanism: 'Pod の Ready/NotReady/置換に合わせて controller が endpoint 行を更新します。',
      notResponsible: 'packet は EndpointSlice オブジェクトを通りません。選択の根拠です。',
    },
    Etcd: {
      responsibility: 'Control Plane が扱う Kubernetes API object state を保存します。',
      mechanism: 'API Server が一貫した datastore として読み書きします。',
      notResponsible: 'アプリの業務 database ではありません。',
    },
    Namespace: {
      responsibility: 'namespaced object に論理スコープを与えます。',
      mechanism: 'Pod の物理配置とは別に、名前やアクセス境界を整理します。',
      notResponsible: 'Namespace はマシンではなく、Node を内包しません。',
    },
    GatewayDataPlane: {
      responsibility: '外部アプリ通信を受け、設定済み routing を実行します。',
      mechanism: '接続を処理し、Service backend へ request を送ります。',
      notResponsible: 'Gateway / HTTPRoute の API card 自体は packet hop ではありません。',
    },
    Gateway: {
      responsibility: 'listener と traffic infrastructure の設定意図を宣言します。',
      mechanism: 'Gateway controller が実際の data plane 設定へ変換します。',
      notResponsible: 'Gateway API object 自体が実行中 proxy ではありません。',
    },
    HTTPRoute: {
      responsibility: 'host/path と backend Service の対応ルールを宣言します。',
      mechanism: 'Controller が Gateway に attach し、data plane を設定します。',
      notResponsible: 'request が HTTPRoute card を runtime hop として通るわけではありません。',
    },
    HorizontalPodAutoscaler: {
      responsibility: 'metric に基づいて workload の desired replica 数を調整します。',
      mechanism: '新しい desired 数を計算し、通常の controller が Pod を作成します。',
      notResponsible: 'Container 起動、Pod scheduling、traffic routing は直接行いません。',
    },
  },
  'zh-CN': {
    ControllerManager: {
      responsibility: '持续比较“你期望的状态”和“现在真实的状态”，发现不一致就启动纠偏。',
      mechanism:
        '控制器通过 API Server 读取对象。若期望副本是 3、当前只有 2，就创建一个新的替换 Pod 对象。',
      notResponsible:
        '它不选择 Pod 放在哪台 Node，也不直接启动容器。前者是 Scheduler，后者是 kubelet 与容器运行时。',
    },
    KubeAPIServer: {
      responsibility: '提供用户和所有控制组件共享的 Kubernetes API 入口。',
      mechanism:
        '它校验请求、暴露已保存的对象状态，并让 Controller、Scheduler、kubelet 通过同一个入口协作。',
      notResponsible: '它不运行应用容器，也不是用户请求流量的代理。',
    },
    Scheduler: {
      responsibility: '为尚未绑定 Node 的 Pending Pod 选择合适的工作节点。',
      mechanism: '它评估可用 Node，并通过 API Server 记录最终绑定结果。',
      notResponsible: '它不启动容器。目标 Node 上的 kubelet 和容器运行时随后才真正执行。',
    },
    Kubelet: {
      responsibility: '让分配到本 Node 的 Pod 真正运行起来，并持续上报状态。',
      mechanism: '它观察 Pod 定义，要求容器运行时启动或重启 Container，再把结果通过 API 报回去。',
      notResponsible: '它不决定全局副本数，也不负责选择 Node。',
    },
    ContainerRuntime: {
      responsibility: '在一台 Node 上创建并运行真正的容器进程。',
      mechanism: '它拉取镜像，并按 kubelet 的要求创建、启动或停止 Container。',
      notResponsible: '它不调度 Pod，也不维持期望副本数。',
    },
    Deployment: {
      responsibility: '保存无状态应用的更新目标和发布意图。',
      mechanism: '它管理 ReplicaSet，使新版本能够逐步替换旧版本。',
      notResponsible: '用户请求不会经过 Deployment 对象。',
    },
    ReplicaSet: {
      responsibility: '持续维持指定数量的匹配 Pod 副本。',
      mechanism: '控制器发现副本不足时，会创建新的替换 Pod 对象。',
      notResponsible: '它不选择 Node，也不是网络负载均衡器。',
    },
    Node: {
      responsibility: '提供 Pod 与 Container 真正运行所需的机器资源。',
      mechanism: 'Node 上的 kubelet 与容器运行时把已分配的 Pod 定义变成实际进程。',
      notResponsible: 'Node 是物理放置位置，不是 Namespace，也不是工作负载控制器。',
    },
    Pod: {
      responsibility: '代表一份被调度、可以被替换的应用实例。',
      mechanism: '它把一个或多个共享网络身份和部分存储的 Container 组合在一起。',
      notResponsible: 'Pod 不是永久服务器；需要时控制器会创建新的 Pod 替换它。',
    },
    Container: {
      responsibility: '运行真正的应用进程和镜像内容。',
      mechanism: '容器运行时在某个 Node 上的 Pod 内启动它。',
      notResponsible: '单个 Container 不负责调度、副本自动恢复或稳定 Service 地址。',
    },
    Service: {
      responsibility: '为会变化的一组后端 Pod 提供稳定的逻辑访问入口。',
      mechanism:
        'Selector 与 EndpointSlice 描述可用后端，集群数据面把请求送到某个 Ready Endpoint。',
      notResponsible: 'Service 对象本身不是应用进程，EndpointSlice 也不是数据包经过的中转站。',
    },
    EndpointSlice: {
      responsibility: '记录 Service 背后的网络 Endpoint 以及它们的就绪条件。',
      mechanism: 'Pod Ready、NotReady 或被替换时，控制器会更新后端名单。',
      notResponsible: '数据包不会经过 EndpointSlice 对象；它只是选择后端的事实依据。',
    },
    Etcd: {
      responsibility: '保存控制面使用的 Kubernetes API 对象状态。',
      mechanism: 'API Server 把它当作一致的集群状态数据库进行读写。',
      notResponsible: '它不是你的应用业务数据库。',
    },
    Namespace: {
      responsibility: '为有命名空间的 Kubernetes 对象提供逻辑范围。',
      mechanism: '它用于区分名称和访问边界，与 Pod 最终运行在哪台 Node 是两回事。',
      notResponsible: 'Namespace 不是机器，也不会把 Node 包在里面。',
    },
    GatewayDataPlane: {
      responsibility: '真正接收外部应用流量，并执行已经配置好的路由结果。',
      mechanism: '它处理连接，再把请求转发到相应 Service 后端。',
      notResponsible: 'Gateway 和 HTTPRoute 配置卡不是数据包经过的运行时节点。',
    },
    Gateway: {
      responsibility: '声明监听端口以及需要配置的流量入口基础设施。',
      mechanism: 'Gateway Controller 把这个 API 对象转换成真实数据面的配置。',
      notResponsible: 'Gateway API 对象本身不是正在运行的代理进程。',
    },
    HTTPRoute: {
      responsibility: '声明哪些域名和路径应该到达哪个后端 Service。',
      mechanism: '控制器把规则挂到 Gateway，并配置真实数据面。',
      notResponsible: '请求不会把 HTTPRoute 卡片当作一个运行时中转节点。',
    },
    HorizontalPodAutoscaler: {
      responsibility: '根据观测到的指标调整可扩缩工作负载的期望副本数。',
      mechanism: '它计算新的期望数量并更新目标，普通控制器随后负责创建 Pod。',
      notResponsible: 'HPA 不直接创建容器、不调度 Pod，也不转发请求。',
    },
  },
};

const explanationAliases: Readonly<Record<string, string>> = {
  ApiServer: 'KubeAPIServer',
  APIServer: 'KubeAPIServer',
  KubeControllerManager: 'ControllerManager',
};

export function componentExplanation(
  entity: WorldEntity | undefined,
  locale: Locale,
): ComponentExplanation | undefined {
  if (!entity) return undefined;
  const key = explanationAliases[entity.kind] ?? entity.kind;
  const body = componentCopy[locale][key];
  if (!body) return undefined;
  return {
    heading: friendlyEntityName(entity, locale),
    ...body,
  };
}

export function viewPresentation(view: ViewMode, locale: Locale): ViewPresentation {
  return viewCopy[locale][view];
}

export function chapterPresentation(chapterId: string, locale: Locale): string {
  return chapterCopy[locale][chapterId] ?? chapterId.replaceAll('-', ' ');
}

const layoutLabelCopy: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  en: {
    'CONTROL PLANE': 'Control plane',
    'CONTROL PLANE ISLAND': 'Control plane',
    'WORKLOAD STATE': 'Workload state',
    'WORKER NODES': 'Worker Nodes',
    'WORKER NODES ISLAND': 'Worker Nodes',
    'UNSCHEDULED PODS': 'Unscheduled Pods',
    'UNSCHEDULED / TRANSIT': 'Unscheduled Pods',
    'ASSIGNED POD CONTEXT': 'Assigned Pod context',
    'EXTERNAL API INPUT': 'External API input',
    CLIENT: 'Client',
    SERVICE: 'Stable Service entry',
    BACKENDS: 'Backend Pods',
    'ENDPOINT STATE': 'Backend readiness',
    'DNS ENDPOINT STATE': 'DNS backend readiness',
    'GATEWAY DATA PLANE': 'Gateway data plane',
    'ROUTING CONFIGURATION': 'Configuration (not traffic)',
    'WORKLOAD SUPPORT': 'Controllers (supporting context)',
    'PLACEMENT CONTEXT': 'Node placement (supporting context)',
  },
  ja: {
    'CONTROL PLANE': 'Control Plane',
    'CONTROL PLANE ISLAND': 'Control Plane',
    'WORKLOAD STATE': 'ワークロード状態',
    'WORKER NODES': 'Worker Node',
    'WORKER NODES ISLAND': 'Worker Node',
    'UNSCHEDULED PODS': '未配置の Pod',
    'UNSCHEDULED / TRANSIT': '未配置の Pod',
    'ASSIGNED POD CONTEXT': '配置済み Pod',
    'EXTERNAL API INPUT': '外部 API 入力',
    CLIENT: 'Client',
    SERVICE: '安定した Service 入口',
    BACKENDS: 'Backend Pod',
    'ENDPOINT STATE': 'Backend の Ready 状態',
    'DNS ENDPOINT STATE': 'DNS backend 状態',
    'GATEWAY DATA PLANE': 'Gateway Data Plane',
    'ROUTING CONFIGURATION': '設定（通信経路ではない）',
    'WORKLOAD SUPPORT': 'Controller（補助情報）',
    'PLACEMENT CONTEXT': 'Node 配置（補助情報）',
  },
  'zh-CN': {
    'CONTROL PLANE': '控制面',
    'CONTROL PLANE ISLAND': '控制面',
    'WORKLOAD STATE': '工作负载状态',
    'WORKER NODES': '工作节点',
    'WORKER NODES ISLAND': '工作节点',
    'UNSCHEDULED PODS': '尚未调度的 Pod',
    'UNSCHEDULED / TRANSIT': '尚未调度的 Pod',
    'ASSIGNED POD CONTEXT': '已分配的 Pod',
    'EXTERNAL API INPUT': '外部 API 输入',
    CLIENT: '客户端',
    SERVICE: 'Service 稳定入口',
    BACKENDS: '后端 Pod',
    'ENDPOINT STATE': '后端就绪状态',
    'DNS ENDPOINT STATE': 'DNS 后端状态',
    'GATEWAY DATA PLANE': 'Gateway 数据面',
    'ROUTING CONFIGURATION': '配置规则（不是流量）',
    'WORKLOAD SUPPORT': '控制器（辅助信息）',
    'PLACEMENT CONTEXT': 'Node 放置位置（辅助信息）',
  },
};

export function friendlyLayoutLabel(label: string, locale: Locale): string {
  const direct = layoutLabelCopy[locale][label];
  if (direct) return direct;
  if (locale === 'en') {
    return label.toLowerCase().replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
  }
  return label;
}

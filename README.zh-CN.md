# KubeMotion

**通过观察事实状态变化来学习 Kubernetes。**

KubeMotion 是一个开源、静态优先的交互式 3D 教学系统。重构后的核心边界是：`WorldSnapshot` 保存教学世界中真实成立的事实，`ViewProjection` 只负责镜头、强调、标签和讲解动画。因此，容器原地重启不会再被误画成 Pod 替换。

![KubeMotion 展示新 Pending Pod 的世界状态课程](docs/assets/kubemotion-world-state.png)

## 在线演示

[GitHub Pages 官方入口](https://tangbudu.github.io/kubemotion-3d/)

## 当前已验证范围

- 1 节完整验证课程：`container-restart-vs-pod-replacement`
- 7 个确定性的事实步骤
- 21 节规划中课程，仅作为路线图展示
- Explore 为 Beta，筛选时保留一跳所有权和放置上下文
- 全部数据均为合成数据，不连接真实集群，不接收凭据，不读取遥测，也不修改资源

金牌课程展示 Node 机架与 Pod 槽位、包含子 Container 的 Pod 外壳、Pod UID 与 Node 放置、Container 重启次数与实例代次、ReplicaSet 的 desired/current/ready 计数、类型化关系和锚定提示。

## 本地运行与验证

需要 Node.js 24 和 pnpm 11.16。

```sh
pnpm install --frozen-lockfile
pnpm dev

pnpm format:check
pnpm lint
pnpm typecheck
pnpm content:validate
pnpm test:unit -- --run
pnpm build
pnpm test:e2e
```

端到端测试覆盖桌面端、移动端、全部 7 步截图、语言持久化，以及 20 轮导航／重播／选择／镜头重置后的渲染资源稳定性。许可证为 MIT。

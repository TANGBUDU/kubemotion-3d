# KubeMotion

**看着 Kubernetes 动起来。**

KubeMotion 是一个开源、静态优先的交互式 3D 教学系统。Release 0.1 包含五节完整课程：集群架构、Namespace 与 Node、从清单到运行中的 Pod、Service 与 EndpointSlice，以及容器重启和 Pod 替换的区别。

## 边界与安全

本版本不连接真实集群，不接收集群配置或凭据，不读取指标、日志或追踪，不提供终端，也不修改 Kubernetes 资源。全部示例均为虚构数据；动画用于解释概念和职责，不是数据包捕获或真实时间线。

## 开始使用

使用 Node.js 24 和 pnpm：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm content:validate` 与完整测试套件会验证内容、引用、投影和构建。Docker 镜像以非 root 运行，Helm Chart 不创建 ServiceAccount 或 RBAC。许可证为 MIT。

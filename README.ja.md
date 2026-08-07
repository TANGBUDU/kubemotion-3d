# KubeMotion

**動きを見て Kubernetes を学ぶ。**

KubeMotion はオープンソースで静的配信を優先する 3D 学習システムです。Release 0.1 にはクラスター構成、Namespace と Node、マニフェストから Pod 実行まで、Service と EndpointSlice、コンテナ再起動と Pod 置換の違いを扱う五つの完全なレッスンがあります。

## 境界と安全性

実クラスターへ接続せず、クラスタープロフィールや認証情報を受け取らず、metrics・logs・traces を読みません。terminal や Kubernetes リソース変更機能もありません。すべてのデータは合成で、アニメーションは概念説明であり packet capture ではありません。

## 開始

Node.js 24 と pnpm を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm content:validate` とテスト一式で内容、参照、投影、build を検証します。Docker image は非 root、Helm chart は ServiceAccount と RBAC を作りません。ライセンスは MIT です。

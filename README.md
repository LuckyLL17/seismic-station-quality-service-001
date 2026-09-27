# 地震台站数据质量检测服务

纯后端 Node.js + TypeScript + Fastify 服务，面向地震台站观测数据接入与质量检测。

## 能力

- 台站档案管理
- 观测摘要批量接入
- 采样完整性、波形削顶、时间同步检测
- 质量评分与问题标签
- 按台站/分数查询观测记录
- 生成时间窗口质量报告
- 台站心跳接入与失联判定、恢复识别、状态变更审计

## 心跳与失联判定

- `POST /api/heartbeats`：上报心跳，Body 为 `{ stationId, sentAt? }`（`sentAt` 缺省为接收时间）。响应含 `applied`（是否推进了台站状态）与 `recovered`（是否触发恢复）。
- `GET /api/stations/connectivity?status=offline`：值守视图，含每台站 `lastSeenAt`（最近有效上报）、`lostAt`/`lostForMs`（失联起始与时长）、`lastRecoveredAt` 与 `recovered`（曾失联且已恢复）。
- `GET /api/stations/events?stationId=`：状态变更流水（online/offline 切换、原因、发生时间）。

判定规则：

- 心跳与观测都视为有效上报，`lastSeenAt` 只前进不后退；超过 `HEARTBEAT_TIMEOUT_MS`（默认 60s）未上报的在线台站由后台巡检（`SWEEP_INTERVAL_MS`，默认 15s）判定为失联。
- 迟到/重复事件（事件时间不晚于 `lastSeenAt`）不改变状态；事件时间晚于 `lastSeenAt` 但已超过超时窗口的，只更新 `lastSeenAt`，不会误恢复；未来时间按接收时间截断。
- 维护态（maintenance）台站由人工管理，不参与自动失联/恢复。

## 启动

```bash
npm install
npm run dev
```

默认端口：`4301`。当前使用内存存储，后续可替换 PostgreSQL/时序数据库，并接入 Kafka、SeedLink 或对象存储。

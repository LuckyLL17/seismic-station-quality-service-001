# 地震台站数据质量检测服务

纯后端 Node.js + TypeScript + Fastify 服务，面向地震台站观测数据接入与质量检测。

## 能力

- 台站档案管理
- 观测摘要批量接入
- 采样完整性、波形削顶、时间同步检测
- 质量评分与问题标签
- 按台站/分数查询观测记录
- 生成时间窗口质量报告
- 台站心跳接入与失联自动判定
- 失联/恢复状态变更日志，迟到与重复事件防护

## 心跳与失联判定

- `POST /api/stations/:stationId/heartbeat`：上报心跳，Body 为 `{ sentAt?, beatId? }`。`sentAt` 缺省为服务端当前时间；`beatId` 用于客户端重试去重，重复提交返回首次记录（HTTP 200，`duplicate: true`）。
- 失联判定：后台定时扫描（也可 `POST /api/connectivity/sweep` 手动触发），`online` 台站超过 `STATION_OFFLINE_TIMEOUT_MS` 未上报即置为 `offline`；维护中（`maintenance`）台站不参与自动判定。
- 恢复识别：`offline` 台站收到事件时间更新的心跳或观测后自动恢复 `online`。
- 事件有序应用：心跳与观测按事件时间（`sentAt`/`observedAt`）应用到台站状态机。迟到或重复的事件（事件时间不晚于最近已应用事件）不会把台站状态改回错误结果，仅补全 `lastSeenAt`；超出允许时钟偏差（`STATION_MAX_CLOCK_SKEW_MS`）的未来心跳会被拒绝。
- 值守查询：`GET /api/stations?status=offline` 查看当前失联台站；`GET /api/connectivity/events?stationId=&limit=` 查看状态变更时间线（何时失联、何时恢复）。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4301` | 服务端口 |
| `STATION_OFFLINE_TIMEOUT_MS` | `60000` | 心跳超时判定阈值 |
| `STATION_SWEEP_INTERVAL_MS` | `15000` | 失联扫描间隔 |
| `STATION_MAX_CLOCK_SKEW_MS` | `300000` | 心跳时间允许的最大时钟偏差 |

## 启动

```bash
npm install
npm run dev
```

默认端口：`4301`。当前使用内存存储，后续可替换 PostgreSQL/时序数据库，并接入 Kafka、SeedLink 或对象存储。

-- P188 经济学互动学习 · 业务表
-- 兼容 PGLite(预览/WASM) 与 Neon(生产 Postgres)；幂等可重复执行。
-- 认证默认关闭，故用 visitor_id 匿名标识，不强外键到用户表。

-- 1) 学习会话：一次访问/一局
create table if not exists learning_sessions (
  id          bigserial primary key,
  visitor_id  text not null,
  nickname    text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  final_t     integer,
  final_mode  text,
  is_done     boolean not null default false
);

-- 2) 测验作答
create table if not exists quiz_attempts (
  id           bigserial primary key,
  session_id   bigint references learning_sessions(id) on delete cascade,
  question_no  integer not null,
  selected     integer not null,
  correct      boolean not null,
  created_at   timestamptz not null default now()
);

-- 3) 决策记录：在某补贴 t 下选择的应对情景与净福利
create table if not exists decision_logs (
  id              bigserial primary key,
  session_id      bigint references learning_sessions(id) on delete cascade,
  t               integer not null,
  chosen_scenario text not null check (chosen_scenario in ('accept','tariff','ban')),
  net             numeric(12,2),
  created_at      timestamptz not null default now()
);

-- 4) 可调模型参数（默认即曼昆题设；允许改截距/斜率/世界价做参数化）
create table if not exists model_params (
  id               bigserial primary key,
  session_id       bigint references learning_sessions(id) on delete cascade,
  demand_intercept numeric(10,2) not null default 120,
  demand_slope     numeric(10,2) not null default 1,
  supply_intercept numeric(10,2) not null default 20,
  supply_slope     numeric(10,2) not null default 1,
  world_price      numeric(10,2) not null default 60,
  created_at       timestamptz not null default now()
);

-- 5) 蒙特卡洛模拟结果（净福利分布）
create table if not exists monte_carlo_runs (
  id           bigserial primary key,
  session_id   bigint references learning_sessions(id) on delete cascade,
  t            numeric(10,2) not null,
  n_sims       integer not null,
  mean_net     numeric(12,3),
  p05          numeric(12,3),
  p95          numeric(12,3),
  p_negative   numeric(8,4),
  histogram    jsonb,
  created_at   timestamptz not null default now()
);

-- 6) 博弈对局结果（两国策略与支付）
create table if not exists game_outcomes (
  id            bigserial primary key,
  session_id    bigint references learning_sessions(id) on delete cascade,
  is_strategy   text not null,
  nl_strategy   text not null,
  payoff_is     numeric(12,2),
  payoff_nl     numeric(12,2),
  is_nash       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 7) P2P 房间（WebRTC 信令）
create table if not exists rtc_rooms (
  id              bigserial primary key,
  room_code       text not null unique,
  created_by      text,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now()
);

-- 8) P2P 信令消息（offer/answer/ice，轮询投递，消费后标记）
create table if not exists rtc_signals (
  id           bigserial primary key,
  room_code    text not null,
  from_peer    text not null,
  target_peer  text not null,
  kind         text not null check (kind in ('offer','answer','ice')),
  payload      jsonb not null,
  consumed     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_quiz_session     on quiz_attempts(session_id);
create index if not exists idx_decision_session on decision_logs(session_id);
create index if not exists idx_mc_session       on monte_carlo_runs(session_id);
create index if not exists idx_game_session     on game_outcomes(session_id);
create index if not exists idx_signals_room     on rtc_signals(room_code, target_peer, consumed);

-- Cached real-world economic indicators, fetched from public APIs (World Bank
-- default; FRED when a key is configured). The app reads the cache and only
-- refetches when stale, so preview/serverless stay within rate limits.
create table if not exists econ_indicators (
  id bigserial primary key,
  source text not null check (source in ('worldbank','fred')),
  indicator text not null,
  country text not null default 'WLD',
  label text not null default '',
  unit text not null default '',
  year integer,
  value numeric(18,4),
  fetched_at timestamptz not null default now(),
  unique (source, indicator, country, year)
);

create index if not exists idx_econ_lookup
  on econ_indicators (source, indicator, country, year);

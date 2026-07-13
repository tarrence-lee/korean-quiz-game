-- QuizGame Supabase 스키마
-- Supabase 대시보드 → SQL Editor에서 그대로 실행하세요.
-- 실행 순서: 이 파일 전체를 한 번에 실행 (테이블 생성 → RLS 활성화 → 정책 생성)

create extension if not exists pgcrypto;

-- ── 카테고리 ──────────────────────────────────────────────
create table if not exists categories (
  id text primary key,          -- 'general' | 'geography' | 'history' | 'iq' | 'science'
  name text not null,           -- '일반상식' 등 표시용 한글명
  sort_order int not null default 0
);

insert into categories (id, name, sort_order) values
  ('general',   '일반상식', 1),
  ('geography', '지리',     2),
  ('history',   '한국사',   3),
  ('iq',        '인지능력', 4),
  ('science',   '과학',     5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ── 문제 ──────────────────────────────────────────────
create table if not exists questions (
  id text primary key,                              -- 'GN-001' 등 기존 데이터의 id 그대로 사용
  category_id text not null references categories(id) on delete cascade,
  level text not null,                               -- '중학교' | '고등학교'
  question text not null,
  options jsonb not null,                            -- ["장미","튤립","무궁화","국화"]
  answer text not null,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists questions_category_id_idx on questions(category_id);
create index if not exists questions_level_idx on questions(level);

-- ── 랭킹(리더보드) ──────────────────────────────────────
create table if not exists rankings (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  score int not null,
  total int not null,
  category text,                                     -- 카테고리명 또는 '전체혼합' (문자열, 프론트 표기와 동일하게)
  played_at timestamptz not null default now()
);

create index if not exists rankings_score_idx on rankings(score desc, played_at asc);

-- 문제 수가 가변이므로 원점수가 아닌 정답률(rate)로 순위를 매긴다 (앱의 기존 로컬 정렬 로직과 동일 기준).
alter table rankings add column if not exists rate numeric generated always as (
  case when total > 0 then round(score::numeric / total, 4) else 0 end
) stored;

create index if not exists rankings_rate_idx on rankings(rate desc, score desc, played_at asc);

-- ── RLS ──────────────────────────────────────────────
alter table categories enable row level security;
alter table questions enable row level security;
alter table rankings enable row level security;

-- 문제/카테고리: 누구나 읽기만 가능 (쓰기는 service_role만, 즉 마이그레이션 스크립트 전용)
-- (CREATE POLICY는 IF NOT EXISTS를 지원하지 않으므로 DROP 후 재생성해 재실행 가능하게 함)
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read questions" on questions;
create policy "public read questions" on questions for select using (true);

-- 랭킹: 누구나 읽기 가능.
drop policy if exists "public read rankings" on rankings;
create policy "public read rankings" on rankings for select using (true);

-- 점수 등록: 익명 사용자가 자기 점수를 넣을 수 있도록 허용하되, 최소한의 유효성 검사로 방어한다.
-- update/delete 정책은 만들지 않음(기본 거부) — 등록된 점수는 아무도 고치거나 지울 수 없다.
drop policy if exists "anon insert rankings" on rankings;
create policy "anon insert rankings" on rankings for insert
  with check (
    nickname is not null and char_length(nickname) between 1 and 20
    and total > 0 and score >= 0 and score <= total
    and (category is null or category in ('한국사','과학','지리','일반상식','인지능력','전체혼합'))
  );

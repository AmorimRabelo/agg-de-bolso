-- ============================================================
-- AGG DE BOLSO — 008: NOTIFICAÇÕES PUSH
-- Guarda o "endereço de entrega" de cada celular que autorizou
-- receber notificações (Web Push).
-- ============================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_select on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy push_insert on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy push_update on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_delete on public.push_subscriptions
  for delete using (auth.uid() = user_id);

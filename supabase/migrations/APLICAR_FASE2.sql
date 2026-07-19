-- ============================================================
-- AGG DE BOLSO — 006: ASSINATURAS (v2.0 · Fase 2 — parte 1)
-- Teste grátis 14 dias · bloqueio automático · painel admin
-- ============================================================
-- ⚠️ ANTES DE RODAR: na linha marcada com >>> lá no final,
--    troque o e-mail pelo e-mail da SUA conta no aplicativo.
-- ============================================================

-- 1) ADMINISTRADORES (os sócios) -------------------------------
-- Gerenciada apenas pelo painel do Supabase (sem escrita pelo app)
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy admins_select_self on public.admins
  for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- 2) ASSINATURAS ------------------------------------------------
create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  plan           text not null default 'essencial'
                 check (plan in ('essencial','profissional')),
  status         text not null default 'trial'
                 check (status in ('trial','ativa','inadimplente','bloqueada','cancelada')),
  trial_ends_at  timestamptz not null default now() + interval '14 days',
  paid_until     date,
  mp_subscription_id text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger trg_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
-- usuário vê a própria; admin vê e edita todas (ativar/bloquear)
create policy subscriptions_select on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());
create policy subscriptions_admin_update on public.subscriptions
  for update using (public.is_admin()) with check (public.is_admin());

-- 3) ACESSO LIBERADO? -------------------------------------------
-- true = assinatura ativa OU teste grátis dentro do prazo OU admin
create or replace function public.has_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.subscriptions
    where user_id = auth.uid()
      and (status = 'ativa'
           or (status = 'trial' and trial_ends_at > now()))
  )
$$;

-- 4) NOVO USUÁRIO GANHA O TESTE GRÁTIS --------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, full_name, email)
  values (new.id, new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end $$;

-- Usuários já existentes: ganham o teste de 14 dias a partir de hoje
insert into public.subscriptions (user_id)
select id from auth.users
where id not in (select user_id from public.subscriptions);

-- 5) BLOQUEIO REAL NO BANCO -------------------------------------
-- Sem acesso (teste vencido/bloqueado): não cria nada novo.
-- Continua LENDO e gerenciando o que já existe (bloqueio suave).
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (auth.uid() = user_id and public.has_access());

drop policy if exists loans_insert on public.loans;
create policy loans_insert on public.loans
  for insert with check (auth.uid() = user_id and public.has_access());

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert with check (auth.uid() = user_id and public.has_access());

-- 6) VISÃO DO PAINEL ADMIN --------------------------------------
-- profiles: admin pode listar (para ver e-mail/nome dos assinantes)
create policy profiles_admin_select on public.profiles
  for select using (public.is_admin());

create view public.admin_subscriptions with (security_invoker = on) as
select
  s.id,
  s.user_id,
  p.email,
  p.full_name,
  s.plan,
  s.status,
  s.trial_ends_at,
  s.paid_until,
  s.notes,
  s.created_at,
  case
    when s.status = 'ativa' then 'ativa'
    when s.status = 'trial' and s.trial_ends_at > now() then 'trial'
    when s.status = 'trial' then 'trial_vencido'
    else s.status
  end as effective_status,
  greatest(0, ceil(extract(epoch from (s.trial_ends_at - now())) / 86400))::int as trial_days_left
from public.subscriptions s
join public.profiles p on p.id = s.user_id;

-- 7) SÓCIOS = ADMINS (acesso vitalício, sem cobrança) -----------
-- Sócios administradores:
insert into public.admins (user_id)
select id from auth.users where email in (
  'marcusrabelow9@gmail.com',
  'gildeonhot@gmail.com',
  'alexdoouglas@gmail.com'
)
on conflict do nothing;
-- ============================================================
-- AGG DE BOLSO — 007: PAINEL DOS SÓCIOS (métricas agregadas)
-- Só admin acessa. Retorna TOTAIS (nunca dados de clientes).
-- ============================================================

create or replace function public.admin_metrics()
returns json language sql stable security definer set search_path = public as $$
  select case when not public.is_admin() then null else json_build_object(
    -- assinaturas
    'total_accounts',  (select count(*) from public.subscriptions),
    'trial_active',    (select count(*) from public.subscriptions where status = 'trial' and trial_ends_at > now()),
    'trial_expired',   (select count(*) from public.subscriptions where status = 'trial' and trial_ends_at <= now()),
    'active',          (select count(*) from public.subscriptions where status = 'ativa'),
    'blocked',         (select count(*) from public.subscriptions where status in ('bloqueada','inadimplente','cancelada')),
    'pro_plan',        (select count(*) from public.subscriptions where status = 'ativa' and plan = 'profissional'),
    -- receita
    'mrr',             (select coalesce(sum(case when plan = 'profissional' then 19.90 else 10 end), 0)
                          from public.subscriptions where status = 'ativa'),
    -- crescimento
    'signups_7d',      (select count(*) from public.subscriptions where created_at > now() - interval '7 days'),
    'signups_30d',     (select count(*) from public.subscriptions where created_at > now() - interval '30 days'),
    -- utilização (usuários que fizeram QUALQUER ação no período)
    'active_users_7d', (select count(distinct user_id) from public.audit_logs where created_at > now() - interval '7 days'),
    'active_users_30d',(select count(distinct user_id) from public.audit_logs where created_at > now() - interval '30 days'),
    -- volume gerido na plataforma (indicador de tração — agregado)
    'total_clients',   (select count(*) from public.clients),
    'total_loans',     (select count(*) from public.loans where status <> 'cancelado'),
    'total_payments',  (select count(*) from public.payments where status = 'ativo'),
    'volume_lent',     (select coalesce(sum(principal), 0) from public.loans where status <> 'cancelado'),
    'volume_received', (select coalesce(sum(total_amount), 0) from public.payments where status = 'ativo'),
    'generated_at',    now()
  ) end
$$;

-- Série de cadastros por dia (últimos 30 dias) para o mini-gráfico
create or replace function public.admin_signups_series()
returns table(dia date, novos bigint)
language sql stable security definer set search_path = public as $$
  select d::date as dia,
         (select count(*) from public.subscriptions s
           where s.created_at::date = d::date) as novos
  from generate_series(current_date - 29, current_date, interval '1 day') d
  where public.is_admin()
$$;

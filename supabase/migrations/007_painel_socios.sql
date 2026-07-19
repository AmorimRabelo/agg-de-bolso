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

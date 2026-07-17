-- ============================================================
-- AGG DE BOLSO — 003: VIEWS (cálculos centralizados no banco)
-- security_invoker = on → as views respeitam o RLS do usuário
-- ============================================================

-- ESTATÍSTICAS POR EMPRÉSTIMO ----------------------------------
create view public.loan_stats with (security_invoker = on) as
select
  l.id,
  l.user_id,
  l.client_id,
  c.name  as client_name,
  c.cpf_cnpj as client_cpf_cnpj,
  l.loan_number,
  l.principal,
  l.loan_date,
  l.due_date,
  l.interest_rate,
  l.interest_amount,
  l.total_expected,
  l.notes,
  l.status,
  l.canceled_at,
  l.cancel_reason,
  l.created_at,
  l.updated_at,
  coalesce(p.paid_principal, 0)                                  as paid_principal,
  coalesce(p.paid_interest, 0)                                   as paid_interest,
  coalesce(p.paid_total, 0)                                      as paid_total,
  greatest(l.principal - coalesce(p.paid_principal, 0), 0)       as pending_principal,
  greatest(l.interest_amount - coalesce(p.paid_interest, 0), 0)  as pending_interest,
  greatest(l.total_expected - coalesce(p.paid_total, 0), 0)      as pending_total,
  (current_date - l.loan_date)                                   as days_elapsed,
  case when l.status in ('pago','cancelado') then 0
       else greatest(current_date - l.due_date, 0) end           as days_late,
  -- Situação efetiva: "atrasado" derivado da data, sempre atual
  case
    when l.status = 'cancelado' then 'cancelado'
    when l.status = 'pago' then 'pago'
    when current_date > l.due_date then 'atrasado'
    else l.status
  end                                                            as effective_status,
  -- Semáforo: verde (em dia) / amarelo (vence hoje) / laranja (atrasado) / vermelho (muito atrasado)
  case
    when l.status in ('pago','cancelado') then 'neutro'
    when current_date > l.due_date + 30 then 'vermelho'
    when current_date > l.due_date then 'laranja'
    when current_date = l.due_date then 'amarelo'
    else 'verde'
  end                                                            as traffic_light,
  round(l.interest_amount / l.principal * 100, 2)                as expected_return_pct,
  round(coalesce(p.paid_interest, 0) / l.principal * 100, 2)     as realized_return_pct,
  -- Rentabilidade média mensal equivalente
  case when current_date > l.loan_date
       then round(coalesce(p.paid_interest, 0) / l.principal * 100
            / ((current_date - l.loan_date)::numeric / 30), 2)
       else 0 end                                                as monthly_return_pct,
  p.last_payment_date,
  case when p.last_payment_date is not null
       then (p.last_payment_date - l.loan_date) end              as return_days
from public.loans l
join public.clients c on c.id = l.client_id
left join (
  select loan_id,
         sum(principal_amount) as paid_principal,
         sum(interest_amount)  as paid_interest,
         sum(total_amount)     as paid_total,
         max(payment_date)     as last_payment_date
  from public.payments
  where status = 'ativo'
  group by loan_id
) p on p.loan_id = l.id;

-- ESTATÍSTICAS POR CLIENTE -------------------------------------
create view public.client_stats with (security_invoker = on) as
select
  c.id,
  c.user_id,
  c.name,
  c.cpf_cnpj,
  c.phone,
  c.whatsapp,
  c.notes,
  c.status,
  c.created_at,
  c.updated_at,
  count(l.id)             filter (where l.status <> 'cancelado')      as loan_count,
  coalesce(sum(l.principal)       filter (where l.status <> 'cancelado'), 0) as total_lent,
  coalesce(sum(l.paid_total)      filter (where l.status <> 'cancelado'), 0) as total_received,
  coalesce(sum(l.paid_principal)  filter (where l.status <> 'cancelado'), 0) as paid_principal,
  coalesce(sum(l.paid_interest)   filter (where l.status <> 'cancelado'), 0) as paid_interest,
  coalesce(sum(l.pending_total)   filter (where l.status <> 'cancelado'), 0) as pending_total,
  case when coalesce(sum(l.principal) filter (where l.status <> 'cancelado'), 0) > 0
       then round(coalesce(sum(l.paid_interest) filter (where l.status <> 'cancelado'), 0)
            / sum(l.principal) filter (where l.status <> 'cancelado') * 100, 2)
       else 0 end                                                     as return_pct
from public.clients c
left join public.loan_stats l on l.client_id = c.id
group by c.id;

-- DASHBOARD DA CARTEIRA (uma linha por usuário) ----------------
create view public.dashboard_stats with (security_invoker = on) as
with ls as (
  select * from public.loan_stats where status <> 'cancelado'
),
mon as (
  select user_id,
         coalesce(sum(total_amount), 0) as received_this_month
  from public.payments
  where status = 'ativo'
    and payment_date >= date_trunc('month', current_date)::date
    and payment_date <  (date_trunc('month', current_date) + interval '1 month')::date
  group by user_id
)
select
  ls.user_id,
  count(*)                                   as loan_count,
  coalesce(sum(ls.principal), 0)             as total_lent,
  coalesce(sum(ls.paid_total), 0)            as total_received,
  coalesce(sum(ls.paid_principal), 0)        as paid_principal,
  coalesce(sum(ls.paid_interest), 0)         as paid_interest,
  coalesce(sum(ls.pending_principal), 0)     as pending_principal,
  coalesce(sum(ls.pending_interest), 0)      as pending_interest,
  coalesce(sum(ls.pending_total), 0)         as pending_total,
  case when sum(ls.principal) > 0
       then round(sum(ls.paid_interest) / sum(ls.principal) * 100, 2)
       else 0 end                            as portfolio_return_pct,
  count(*) filter (where ls.effective_status in ('em_aberto','parcial','atrasado')) as active_count,
  count(*) filter (where ls.effective_status = 'pago')      as paid_count,
  count(*) filter (where ls.effective_status = 'atrasado')  as late_count,
  coalesce(sum(ls.pending_total) filter (
    where ls.effective_status <> 'pago'
      and ls.due_date >= date_trunc('month', current_date)::date
      and ls.due_date <  (date_trunc('month', current_date) + interval '1 month')::date), 0)
                                             as expected_this_month,
  coalesce(max(mon.received_this_month), 0)  as received_this_month
from ls
left join mon on mon.user_id = ls.user_id
group by ls.user_id;

-- ============================================================
-- AGG DE BOLSO — 005: EMPRÉSTIMOS PARCELADOS (v2.0 · Fase 1)
-- Parcelas com Price ou juros simples, multa/mora e views.
-- ============================================================

-- 1) NOVOS CAMPOS ---------------------------------------------
alter table public.loans
  add column if not exists loan_type text not null default 'unico'
    check (loan_type in ('unico','parcelado')),
  add column if not exists num_installments integer
    check (num_installments is null or (num_installments between 2 and 120)),
  add column if not exists periodicity text
    check (periodicity is null or periodicity in ('semanal','quinzenal','mensal')),
  add column if not exists calc_mode text
    check (calc_mode is null or calc_mode in ('price','juros_simples'));

alter table public.user_settings
  add column if not exists late_fine_pct numeric(8,4) not null default 2,
  add column if not exists late_interest_month_pct numeric(8,4) not null default 1;

-- 2) TABELA DE PARCELAS ---------------------------------------
create table public.installments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  loan_id          uuid not null references public.loans(id) on delete restrict,
  number           integer not null,
  due_date         date not null,
  principal_amount numeric(14,2) not null check (principal_amount >= 0),
  interest_amount  numeric(14,2) not null check (interest_amount >= 0),
  total_amount     numeric(14,2) generated always as (principal_amount + interest_amount) stored,
  status           text not null default 'aberta'
                   check (status in ('aberta','parcial','paga','cancelada')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (loan_id, number)
);
create index installments_user_idx on public.installments (user_id);
create index installments_loan_idx on public.installments (loan_id);
create index installments_due_idx  on public.installments (user_id, due_date);

create trigger trg_updated_at before update on public.installments
  for each row execute function public.set_updated_at();

-- Pagamento pode apontar para uma parcela
alter table public.payments
  add column if not exists installment_id uuid references public.installments(id) on delete restrict;
create index payments_installment_idx on public.payments (installment_id);

-- 3) GERAÇÃO AUTOMÁTICA DAS PARCELAS --------------------------
-- Price: taxa por período; parcela fixa A = P*i/(1-(1+i)^-n)
-- Juros simples: principal e juros divididos igualmente (última parcela absorve arredondamento)
create or replace function public.generate_installments()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_n int; v_rate numeric; v_step interval; v_due date;
  v_A numeric; v_saldo numeric; v_j numeric; v_p numeric;
  v_juros_total numeric; v_pj numeric; v_jj numeric; k int;
begin
  if new.loan_type <> 'parcelado' then return new; end if;
  if new.num_installments is null or new.periodicity is null or new.calc_mode is null then
    raise exception 'Empréstimo parcelado exige nº de parcelas, periodicidade e modo de cálculo';
  end if;
  v_n := new.num_installments;
  v_step := case new.periodicity
              when 'semanal' then interval '7 days'
              when 'quinzenal' then interval '14 days'
              else interval '1 month' end;

  if new.calc_mode = 'price' then
    if new.interest_rate is null or new.interest_rate <= 0 then
      raise exception 'Tabela Price exige taxa de juros por período maior que zero';
    end if;
    v_rate := new.interest_rate / 100;
    v_A := round(new.principal * v_rate / (1 - power(1 + v_rate, -v_n)::numeric), 2);
    v_saldo := new.principal;
    v_juros_total := 0;
    v_due := new.due_date;
    for k in 1..v_n loop
      v_j := round(v_saldo * v_rate, 2);
      if k < v_n then v_p := v_A - v_j; else v_p := v_saldo; end if;
      v_saldo := v_saldo - v_p;
      v_juros_total := v_juros_total + v_j;
      insert into public.installments (user_id, loan_id, number, due_date, principal_amount, interest_amount)
      values (new.user_id, new.id, k, v_due, v_p, v_j);
      v_due := (v_due + v_step)::date;
    end loop;
    update public.loans
       set interest_amount = v_juros_total,
           due_date = (new.due_date + v_step * (v_n - 1))::date
     where id = new.id;
  else
    v_juros_total := coalesce(new.interest_amount, 0);
    v_pj := trunc(new.principal / v_n, 2);
    v_jj := trunc(v_juros_total / v_n, 2);
    v_due := new.due_date;
    for k in 1..v_n loop
      if k = v_n then
        v_p := new.principal - v_pj * (v_n - 1);
        v_j := v_juros_total - v_jj * (v_n - 1);
      else
        v_p := v_pj; v_j := v_jj;
      end if;
      insert into public.installments (user_id, loan_id, number, due_date, principal_amount, interest_amount)
      values (new.user_id, new.id, k, v_due, v_p, v_j);
      v_due := (v_due + v_step)::date;
    end loop;
    update public.loans
       set due_date = (new.due_date + v_step * (v_n - 1))::date
     where id = new.id;
  end if;
  return new;
end $$;

create trigger trg_generate_installments after insert on public.loans
  for each row execute function public.generate_installments();

-- 4) VALIDAÇÃO DE PAGAMENTO (substitui a versão anterior) -----
create or replace function public.validate_payment()
returns trigger language plpgsql as $$
declare
  v_loan public.loans%rowtype;
  v_inst public.installments%rowtype;
  v_paid_principal numeric;
  v_paid_inst numeric;
begin
  select * into v_loan from public.loans where id = new.loan_id;
  if v_loan.id is null then
    raise exception 'Empréstimo não encontrado';
  end if;
  if v_loan.user_id <> new.user_id then
    raise exception 'Empréstimo pertence a outro usuário';
  end if;
  if v_loan.status = 'cancelado' then
    raise exception 'Empréstimo cancelado não aceita pagamentos';
  end if;
  if v_loan.status = 'pago' then
    raise exception 'Empréstimo já está quitado';
  end if;

  -- Parcelado: pagamento sempre vinculado a uma parcela
  if v_loan.loan_type = 'parcelado' and new.installment_id is null then
    raise exception 'Informe a parcela deste pagamento';
  end if;

  if new.installment_id is not null then
    select * into v_inst from public.installments where id = new.installment_id;
    if v_inst.id is null or v_inst.loan_id <> new.loan_id then
      raise exception 'Parcela inválida para este empréstimo';
    end if;
    if v_inst.status in ('paga','cancelada') then
      raise exception 'Esta parcela não aceita pagamentos';
    end if;
    select coalesce(sum(principal_amount), 0) into v_paid_inst
      from public.payments
     where installment_id = new.installment_id and status = 'ativo';
    if v_paid_inst + new.principal_amount > v_inst.principal_amount then
      raise exception 'Principal informado excede o principal pendente da parcela';
    end if;
  end if;

  select coalesce(sum(principal_amount), 0) into v_paid_principal
    from public.payments
   where loan_id = new.loan_id and status = 'ativo';
  if v_paid_principal + new.principal_amount > v_loan.principal then
    raise exception 'Principal informado excede o principal pendente (R$ %)',
      to_char(v_loan.principal - v_paid_principal, 'FM999G999G990D00');
  end if;
  return new;
end $$;

-- 5) SITUAÇÃO AUTOMÁTICA DA PARCELA ---------------------------
-- (nome 'trg_refresh_inst_status' roda ANTES de 'trg_refresh_loan_status' — ordem alfabética)
create or replace function public.refresh_installment_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_inst_id uuid := coalesce(new.installment_id, old.installment_id);
  v_status text;
  v_paid_p numeric; v_paid_i numeric;
begin
  if v_inst_id is null then return null; end if;
  select status into v_status from public.installments where id = v_inst_id;
  if v_status is null or v_status = 'cancelada' then return null; end if;

  select coalesce(sum(principal_amount), 0), coalesce(sum(interest_amount), 0)
    into v_paid_p, v_paid_i
    from public.payments
   where installment_id = v_inst_id and status = 'ativo';

  update public.installments set status =
    case
      when v_paid_p >= principal_amount and v_paid_i >= interest_amount then 'paga'
      when v_paid_p + v_paid_i > 0 then 'parcial'
      else 'aberta'
    end
  where id = v_inst_id;
  return null;
end $$;

create trigger trg_refresh_inst_status after insert or update on public.payments
  for each row execute function public.refresh_installment_status();

-- 6) CANCELAMENTO DO EMPRÉSTIMO CANCELA PARCELAS ABERTAS ------
create or replace function public.cancel_installments_on_loan_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.installments
     set status = 'cancelada'
   where loan_id = new.id and status in ('aberta','parcial');
  return null;
end $$;

create trigger trg_cancel_installments after update on public.loans
  for each row
  when (new.status = 'cancelado' and old.status is distinct from 'cancelado')
  execute function public.cancel_installments_on_loan_cancel();

-- 7) PROTEÇÃO: parcelado não altera valores após criado -------
create or replace function public.guard_loan_update()
returns trigger language plpgsql as $$
declare
  v_paid_principal numeric;
begin
  if old.status = 'cancelado' then
    raise exception 'Empréstimo cancelado não pode ser alterado';
  end if;
  -- pg_trigger_depth() = 1: alteração direta do usuário
  -- (> 1 = ajuste interno do trigger de geração de parcelas)
  if old.loan_type = 'parcelado' and pg_trigger_depth() = 1
     and (new.principal <> old.principal or new.interest_amount <> old.interest_amount) then
    raise exception 'Empréstimo parcelado não pode ter valores alterados — cancele e crie novamente';
  end if;
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    if new.cancel_reason is null or btrim(new.cancel_reason) = '' then
      raise exception 'Informe o motivo do cancelamento';
    end if;
    if exists (select 1 from public.payments
               where loan_id = new.id and status = 'ativo') then
      raise exception 'Cancele os pagamentos antes de cancelar o empréstimo';
    end if;
    new.canceled_at := now();
  end if;
  if new.principal <> old.principal then
    select coalesce(sum(principal_amount), 0) into v_paid_principal
    from public.payments where loan_id = new.id and status = 'ativo';
    if new.principal < v_paid_principal then
      raise exception 'Principal não pode ser menor que o valor já recebido';
    end if;
  end if;
  return new;
end $$;

-- 8) VIEWS (recriadas com suporte a parcelas) -----------------
drop view if exists public.dashboard_stats;
drop view if exists public.client_stats;
drop view if exists public.loan_stats;

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
  case
    when l.status in ('pago','cancelado') then 0
    when l.loan_type = 'parcelado' then coalesce(inst.max_late, 0)
    else greatest(current_date - l.due_date, 0)
  end                                                            as days_late,
  case
    when l.status = 'cancelado' then 'cancelado'
    when l.status = 'pago' then 'pago'
    when l.loan_type = 'parcelado' and coalesce(inst.overdue_count, 0) > 0 then 'atrasado'
    when l.loan_type = 'unico' and current_date > l.due_date then 'atrasado'
    else l.status
  end                                                            as effective_status,
  case
    when l.status in ('pago','cancelado') then 'neutro'
    when current_date > coalesce(inst.next_due, l.due_date) + 30 then 'vermelho'
    when current_date > coalesce(inst.next_due, l.due_date) then 'laranja'
    when current_date = coalesce(inst.next_due, l.due_date) then 'amarelo'
    else 'verde'
  end                                                            as traffic_light,
  round(l.interest_amount / l.principal * 100, 2)                as expected_return_pct,
  round(coalesce(p.paid_interest, 0) / l.principal * 100, 2)     as realized_return_pct,
  case when current_date > l.loan_date
       then round(coalesce(p.paid_interest, 0) / l.principal * 100
            / ((current_date - l.loan_date)::numeric / 30), 2)
       else 0 end                                                as monthly_return_pct,
  p.last_payment_date,
  case when p.last_payment_date is not null
       then (p.last_payment_date - l.loan_date) end              as return_days,
  l.loan_type,
  l.num_installments,
  l.periodicity,
  l.calc_mode,
  inst.next_due,
  coalesce(inst.open_count, 0)                                   as open_installments
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
) p on p.loan_id = l.id
left join (
  select loan_id,
         min(due_date) filter (where status in ('aberta','parcial'))                                as next_due,
         count(*)      filter (where status in ('aberta','parcial'))                                as open_count,
         count(*)      filter (where status in ('aberta','parcial') and due_date < current_date)    as overdue_count,
         max(greatest(current_date - due_date, 0)) filter (where status in ('aberta','parcial'))    as max_late
  from public.installments
  group by loan_id
) inst on inst.loan_id = l.id;

-- ESTATÍSTICAS POR PARCELA ------------------------------------
create view public.installment_stats with (security_invoker = on) as
select
  i.id,
  i.user_id,
  i.loan_id,
  i.number,
  i.due_date,
  i.principal_amount,
  i.interest_amount,
  i.total_amount,
  i.status,
  i.created_at,
  i.updated_at,
  l.loan_number,
  l.client_id,
  c.name as client_name,
  coalesce(p.paid_principal, 0)                                   as paid_principal,
  coalesce(p.paid_interest, 0)                                    as paid_interest,
  coalesce(p.paid_total, 0)                                       as paid_total,
  greatest(i.principal_amount - coalesce(p.paid_principal, 0), 0) as pending_principal,
  greatest(i.interest_amount - coalesce(p.paid_interest, 0), 0)   as pending_interest,
  greatest(i.total_amount - coalesce(p.paid_total, 0), 0)         as pending_total,
  case when i.status in ('paga','cancelada') then 0
       else greatest(current_date - i.due_date, 0) end            as days_late,
  case
    when i.status = 'cancelada' then 'cancelada'
    when i.status = 'paga' then 'paga'
    when current_date > i.due_date then 'atrasada'
    else i.status
  end                                                             as effective_status,
  case
    when i.status in ('paga','cancelada') then 'neutro'
    when current_date > i.due_date + 30 then 'vermelho'
    when current_date > i.due_date then 'laranja'
    when current_date = i.due_date then 'amarelo'
    else 'verde'
  end                                                             as traffic_light,
  coalesce(s.late_fine_pct, 2)                                    as late_fine_pct,
  coalesce(s.late_interest_month_pct, 1)                          as late_interest_month_pct,
  -- Multa + mora sugeridas sobre o pendente (informativo; entram como juros extras se cobradas)
  case when i.status not in ('paga','cancelada') and current_date > i.due_date then
    round(
      greatest(i.total_amount - coalesce(p.paid_total, 0), 0) * coalesce(s.late_fine_pct, 2) / 100
      + greatest(i.total_amount - coalesce(p.paid_total, 0), 0) * coalesce(s.late_interest_month_pct, 1) / 100
        * (current_date - i.due_date) / 30.0
    , 2)
  else 0 end                                                      as suggested_late_charge
from public.installments i
join public.loans l on l.id = i.loan_id
join public.clients c on c.id = l.client_id
left join (
  select installment_id,
         sum(principal_amount) as paid_principal,
         sum(interest_amount)  as paid_interest,
         sum(total_amount)     as paid_total
  from public.payments
  where status = 'ativo' and installment_id is not null
  group by installment_id
) p on p.installment_id = i.id
left join public.user_settings s on s.user_id = i.user_id;

-- ESTATÍSTICAS POR CLIENTE (igual à anterior) ------------------
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

-- A RECEBER (empréstimos únicos + parcelas, unificados) --------
create view public.receivables with (security_invoker = on) as
select
  'unico'        as kind,
  ls.id          as loan_id,
  null::uuid     as installment_id,
  null::integer  as installment_number,
  ls.user_id,
  ls.client_id,
  ls.client_name,
  ls.loan_number,
  ls.due_date,
  ls.pending_total as amount,
  ls.effective_status as status,
  ls.days_late,
  ls.traffic_light
from public.loan_stats ls
where ls.loan_type = 'unico'
  and ls.effective_status in ('em_aberto','parcial','atrasado')
union all
select
  'parcela',
  s.loan_id,
  s.id,
  s.number,
  s.user_id,
  s.client_id,
  s.client_name,
  s.loan_number,
  s.due_date,
  s.pending_total,
  s.effective_status,
  s.days_late,
  s.traffic_light
from public.installment_stats s
where s.effective_status in ('aberta','parcial','atrasada');

-- DASHBOARD DA CARTEIRA ----------------------------------------
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
),
exp_mon as (
  select user_id,
         coalesce(sum(amount), 0) as expected_this_month
  from public.receivables
  where due_date >= date_trunc('month', current_date)::date
    and due_date <  (date_trunc('month', current_date) + interval '1 month')::date
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
  coalesce(max(exp_mon.expected_this_month), 0) as expected_this_month,
  coalesce(max(mon.received_this_month), 0)  as received_this_month
from ls
left join mon on mon.user_id = ls.user_id
left join exp_mon on exp_mon.user_id = ls.user_id
group by ls.user_id;

-- 9) SEGURANÇA --------------------------------------------------
alter table public.installments enable row level security;
create policy installments_select on public.installments
  for select using (auth.uid() = user_id);
-- (sem insert/update/delete: parcelas são criadas e atualizadas apenas pelos
--  triggers do banco — impossível manipular direto pelo app)

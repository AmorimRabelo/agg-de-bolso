-- ============================================================
-- AGG DE BOLSO — 001: TABELAS
-- Controle de empréstimos · Supabase/PostgreSQL
-- ============================================================

-- PERFIS (criado automaticamente no cadastro — ver 002) -------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CLIENTES ----------------------------------------------------
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  cpf_cnpj   text,
  phone      text,
  whatsapp   text,
  notes      text,
  status     text not null default 'ativo'
             check (status in ('ativo','bloqueado','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cpf_cnpj)   -- CPF/CNPJ único por usuário
);
create index clients_user_idx on public.clients (user_id);

-- EMPRÉSTIMOS -------------------------------------------------
create table public.loans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete restrict,
  loan_number     integer not null,                 -- automático (ver 002)
  principal       numeric(14,2) not null check (principal > 0),
  loan_date       date not null default current_date,
  due_date        date not null,
  interest_rate   numeric(8,4) check (interest_rate is null or interest_rate >= 0),
  interest_amount numeric(14,2) not null default 0 check (interest_amount >= 0),
  total_expected  numeric(14,2) generated always as (principal + interest_amount) stored,
  notes           text,
  status          text not null default 'em_aberto'
                  check (status in ('em_aberto','parcial','pago','cancelado')),
  canceled_at     timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, loan_number)
);
create index loans_user_idx   on public.loans (user_id);
create index loans_client_idx on public.loans (client_id);

-- PAGAMENTOS --------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  loan_id          uuid not null references public.loans(id) on delete restrict,
  payment_date     date not null default current_date,
  total_amount     numeric(14,2) not null check (total_amount > 0),
  principal_amount numeric(14,2) not null check (principal_amount >= 0),
  interest_amount  numeric(14,2) not null check (interest_amount >= 0),
  method           text not null default 'pix'
                   check (method in ('pix','dinheiro','transferencia','boleto','outro')),
  notes            text,
  status           text not null default 'ativo'
                   check (status in ('ativo','cancelado')),
  canceled_at      timestamptz,
  cancel_reason    text,
  canceled_by      uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Regra de ouro: principal + juros = total
  check (principal_amount + interest_amount = total_amount)
);
create index payments_user_idx on public.payments (user_id);
create index payments_loan_idx on public.payments (loan_id);

-- AUDITORIA (imutável — preenchida por triggers) ---------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,      -- 'clients' | 'loans' | 'payments'
  entity_id   uuid not null,
  action      text not null,      -- 'created' | 'updated' | 'canceled'
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_user_idx on public.audit_logs (user_id, created_at desc);
create index audit_entity_idx on public.audit_logs (entity_id);

-- CONFIGURAÇÕES (criada automaticamente no cadastro) ----------
create table public.user_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  company_name          text,
  default_interest_rate numeric(8,4) not null default 20,
  theme                 text not null default 'claro',
  currency              text not null default 'BRL',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- ============================================================
-- AGG DE BOLSO — 002: REGRAS DE NEGÓCIO (funções e triggers)
-- ============================================================

-- updated_at automático ---------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.loans
  for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger trg_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Novo usuário → cria perfil e configurações ------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, full_name, email)
  values (new.id, new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Número automático do empréstimo (1, 2, 3... por usuário) ----
create or replace function public.set_loan_number()
returns trigger language plpgsql as $$
begin
  if new.loan_number is null then
    select coalesce(max(loan_number), 0) + 1 into new.loan_number
    from public.loans where user_id = new.user_id;
  end if;
  return new;
end $$;

create trigger trg_loan_number before insert on public.loans
  for each row execute function public.set_loan_number();

-- Validação de pagamento --------------------------------------
-- Bloqueia: empréstimo cancelado/quitado, principal acima do pendente.
-- Juros acima do previsto SÃO permitidos (juros extras por atraso).
create or replace function public.validate_payment()
returns trigger language plpgsql as $$
declare
  v_loan public.loans%rowtype;
  v_paid_principal numeric;
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

  select coalesce(sum(principal_amount), 0) into v_paid_principal
  from public.payments
  where loan_id = new.loan_id and status = 'ativo';

  if v_paid_principal + new.principal_amount > v_loan.principal then
    raise exception 'Principal informado excede o principal pendente (R$ %)',
      to_char(v_loan.principal - v_paid_principal, 'FM999G999G990D00');
  end if;
  return new;
end $$;

create trigger trg_validate_payment before insert on public.payments
  for each row execute function public.validate_payment();

-- Pagamento: nunca excluir, só cancelar (com motivo) -----------
create or replace function public.guard_payment_update()
returns trigger language plpgsql as $$
begin
  if old.status = 'cancelado' then
    raise exception 'Pagamento cancelado não pode ser alterado';
  end if;
  if new.total_amount     <> old.total_amount
     or new.principal_amount <> old.principal_amount
     or new.interest_amount  <> old.interest_amount
     or new.loan_id           <> old.loan_id
     or new.payment_date      <> old.payment_date then
    raise exception 'Valores de um pagamento não podem ser alterados. Cancele e lance novamente.';
  end if;
  if new.status = 'cancelado' then
    if new.cancel_reason is null or btrim(new.cancel_reason) = '' then
      raise exception 'Informe o motivo do cancelamento';
    end if;
    new.canceled_at := now();
    new.canceled_by := auth.uid();
  end if;
  return new;
end $$;

create trigger trg_guard_payment_update before update on public.payments
  for each row execute function public.guard_payment_update();

-- Empréstimo: cancelamento exige motivo e sem pagamentos ativos
create or replace function public.guard_loan_update()
returns trigger language plpgsql as $$
declare
  v_paid_principal numeric;
begin
  if old.status = 'cancelado' then
    raise exception 'Empréstimo cancelado não pode ser alterado';
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

create trigger trg_guard_loan_update before update on public.loans
  for each row execute function public.guard_loan_update();

-- Situação automática do empréstimo ----------------------------
-- em_aberto → parcial → pago, recalculada a cada pagamento.
-- ("atrasado" é derivado pela data na view loan_stats)
create or replace function public.refresh_loan_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_loan_id uuid := coalesce(new.loan_id, old.loan_id);
  v_status text;
  v_paid_principal numeric;
  v_paid_interest numeric;
begin
  select status into v_status from public.loans where id = v_loan_id;
  if v_status is null or v_status = 'cancelado' then
    return null;
  end if;

  select coalesce(sum(principal_amount), 0), coalesce(sum(interest_amount), 0)
    into v_paid_principal, v_paid_interest
  from public.payments
  where loan_id = v_loan_id and status = 'ativo';

  update public.loans set status =
    case
      when v_paid_principal >= principal and v_paid_interest >= interest_amount then 'pago'
      when v_paid_principal + v_paid_interest > 0 then 'parcial'
      else 'em_aberto'
    end
  where id = v_loan_id;
  return null;
end $$;

create trigger trg_refresh_loan_status after insert or update on public.payments
  for each row execute function public.refresh_loan_status();

-- Auditoria automática (JSONB old/new) --------------------------
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  else
    v_action := case
      when new.status = 'cancelado' and old.status is distinct from 'cancelado'
      then 'canceled' else 'updated' end;
  end if;
  insert into public.audit_logs (user_id, entity_type, entity_id, action, old_data, new_data)
  values (new.user_id, tg_table_name, new.id, v_action,
          case when tg_op = 'UPDATE' then to_jsonb(old) end,
          to_jsonb(new));
  return null;
end $$;

create trigger trg_audit after insert or update on public.clients
  for each row execute function public.audit_row();
create trigger trg_audit after insert or update on public.loans
  for each row execute function public.audit_row();
create trigger trg_audit after insert or update on public.payments
  for each row execute function public.audit_row();
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
-- ============================================================
-- AGG DE BOLSO — 004: SEGURANÇA (RLS + Storage)
-- Cada usuário só enxerga e mexe nos próprios dados.
-- Sem política de DELETE = exclusão impossível (loans/payments/audit).
-- ============================================================

alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.loans         enable row level security;
alter table public.payments      enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.user_settings enable row level security;

-- PROFILES (criado por trigger; usuário só lê/edita o seu) -----
create policy profiles_select on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- CLIENTS (delete permitido; FK RESTRICT impede excluir cliente com empréstimo)
create policy clients_select on public.clients
  for select using (auth.uid() = user_id);
create policy clients_insert on public.clients
  for insert with check (auth.uid() = user_id);
create policy clients_update on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy clients_delete on public.clients
  for delete using (auth.uid() = user_id);

-- LOANS (sem DELETE — apenas cancelamento via update) ----------
create policy loans_select on public.loans
  for select using (auth.uid() = user_id);
create policy loans_insert on public.loans
  for insert with check (auth.uid() = user_id);
create policy loans_update on public.loans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- PAYMENTS (sem DELETE — apenas cancelamento via update) -------
create policy payments_select on public.payments
  for select using (auth.uid() = user_id);
create policy payments_insert on public.payments
  for insert with check (auth.uid() = user_id);
create policy payments_update on public.payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AUDIT_LOGS (somente leitura; escrita apenas via triggers) ----
create policy audit_select on public.audit_logs
  for select using (auth.uid() = user_id);

-- USER_SETTINGS (criado por trigger; usuário só lê/edita o seu)
create policy settings_select on public.user_settings
  for select using (auth.uid() = user_id);
create policy settings_update on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE: bucket privado "documentos"
-- Estrutura de pastas: {user_id}/arquivo.ext
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy docs_select on storage.objects
  for select using (
    bucket_id = 'documentos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy docs_insert on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy docs_update on storage.objects
  for update using (
    bucket_id = 'documentos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy docs_delete on storage.objects
  for delete using (
    bucket_id = 'documentos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

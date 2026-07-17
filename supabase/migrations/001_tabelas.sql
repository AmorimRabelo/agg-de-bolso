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

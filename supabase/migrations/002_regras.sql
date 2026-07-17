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

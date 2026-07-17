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

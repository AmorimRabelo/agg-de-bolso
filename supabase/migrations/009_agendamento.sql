-- ============================================================
-- AGG DE BOLSO — 009: DESPERTADOR DIÁRIO DO PUSH
-- Todo dia às 08:00 (horário de Brasília) o banco chama o robô
-- send-overdue-push, que avisa quem tem cliente em atraso.
-- ============================================================
-- (o valor real de COLE_AQUI_O_CRON_SECRET vem do SEGREDOS-PUSH.txt;
--  este arquivo do repositório guarda só o modelo, sem o segredo)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'push-cobrancas-diario',
  '0 11 * * *',   -- 11:00 UTC = 08:00 em Brasília
  $$
  select net.http_post(
    url     := 'https://pndcwchwndybmojbywpx.supabase.co/functions/v1/send-overdue-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "COLE_AQUI_O_CRON_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  )
  $$
);

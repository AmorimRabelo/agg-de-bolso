# Agg de Bolso — Planejamento Completo

**App de controle de empréstimos a clientes**
Data: 16/07/2026 · Versão do plano: 1.0
Decisão aprovada: primeira versão como **PWA** (web app instalável em Android e iPhone), backend 100% Supabase. Migração futura para Flutter é possível reaproveitando todo o banco.

---

## 1. Arquitetura

```
┌─────────────────────────────────────────────┐
│  CELULAR (Android / iPhone)                 │
│  PWA instalado pela tela inicial            │
│  React 18 + TypeScript + Vite               │
│  - UI (componentes)                         │
│  - Estado de servidor: TanStack Query       │
│  - Rotas: React Router (HashRouter)         │
│  - Validação: Zod                           │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (apenas ANON KEY)
┌──────────────────▼──────────────────────────┐
│  SUPABASE (projeto pndcwchwndybmojbywpx)    │
│  - Auth (e-mail/senha, recuperação, sessão) │
│  - PostgreSQL + NUMERIC + Views + Triggers  │
│  - RLS em todas as tabelas                  │
│  - Storage (bucket privado "documentos")    │
└─────────────────────────────────────────────┘
```

**Princípios (equivalentes ao pedido no prompt original):**

| Pedido no prompt (Flutter)         | Equivalente no PWA                          |
|------------------------------------|---------------------------------------------|
| Clean Architecture                 | Camadas: UI → hooks → services → Supabase    |
| Riverpod                           | TanStack Query (cache/estado de servidor)   |
| GoRouter                           | React Router                                 |
| Freezed / Json Serializable        | TypeScript types + Zod (validação)          |
| Repository Pattern                 | `services/` por feature (um repositório por entidade) |
| Material Design 3                  | Design system próprio estilo app bancário (tokens de cor, cards, bottom nav) |

**Regra de ouro:** toda regra financeira crítica (validações de valores, atualização de situação, auditoria) vive no **banco (triggers e constraints)**, não só na interface. O app pode ter bugs; o banco nunca aceita dado inválido.

---

## 2. Estrutura de pastas

```
app/
├── public/                      # ícones do PWA, manifest
├── src/
│   ├── core/
│   │   ├── supabase.ts          # cliente Supabase (ANON KEY)
│   │   ├── money.ts             # dinheiro em CENTAVOS (inteiros) — nunca float
│   │   ├── format.ts            # R$, datas, CPF/CNPJ, telefone
│   │   └── constants.ts         # enums de status, formas de pagamento
│   ├── features/
│   │   ├── auth/                # login, cadastro, recuperação, sessão
│   │   ├── dashboard/
│   │   ├── clients/
│   │   ├── loans/
│   │   ├── payments/
│   │   ├── reports/             # relatórios + fluxo de caixa
│   │   └── settings/
│   │   │   (cada feature: components/ hooks/ services/ types.ts)
│   ├── shared/
│   │   └── components/          # Button, Card, Input, BottomNav, BottomSheet,
│   │                            # Snackbar, Skeleton, StatusBadge, EmptyState...
│   ├── routes/                  # definição de rotas + guarda de autenticação
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── migrations/              # scripts SQL versionados (001, 002...)
├── index.html
├── vite.config.ts               # inclui vite-plugin-pwa
└── package.json
```

---

## 3. Estrutura do banco (Supabase / PostgreSQL)

6 tabelas, todas com `id UUID`, `user_id`, `created_at`, `updated_at`:

| Tabela          | Papel                                                        |
|-----------------|--------------------------------------------------------------|
| `profiles`      | Dados do usuário (criado automaticamente no cadastro)        |
| `clients`       | Clientes (nome, CPF/CNPJ único por usuário, status)          |
| `loans`         | Empréstimos (número automático, principal, juros, vencimento)|
| `payments`      | Pagamentos (principal + juros = total; nunca excluídos)      |
| `audit_logs`    | Auditoria (JSONB old_data/new_data, gerada por triggers)     |
| `user_settings` | Configurações (empresa, taxa padrão, tema, moeda)            |

**Views (cálculos sempre no banco, nunca duplicados no app):**

- `loan_stats` — por empréstimo: principal/juros recebidos, saldo pendente, dias decorridos, dias em atraso, situação efetiva (inclui "atrasado" calculado pela data), rentabilidade prevista/realizada, tempo de retorno.
- `client_stats` — por cliente: total emprestado, recebido, saldo, rentabilidade, qtd. de empréstimos.
- `dashboard_stats` — carteira consolidada: todos os indicadores da tela inicial.

**Situação do empréstimo:** o banco armazena `em_aberto | parcial | pago | cancelado` (atualizada por trigger a cada pagamento). "**Atrasado**" é derivado na view (`vencimento < hoje e saldo > 0`) — assim nunca fica desatualizado.

---

## 4. Scripts SQL do Supabase

Serão entregues como migrações versionadas em `supabase/migrations/`:

### 001_schema.sql (resumo do conteúdo real)

```sql
-- TABELAS ---------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  full_name  text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  name       text not null,
  cpf_cnpj   text,
  phone      text,
  whatsapp   text,
  notes      text,
  status     text not null default 'ativo'
             check (status in ('ativo','bloqueado','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cpf_cnpj)          -- CPF único por usuário
);

create table public.loans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  client_id       uuid not null references public.clients(id) on delete restrict,
  loan_number     integer not null,                    -- automático por trigger
  principal       numeric(14,2) not null check (principal > 0),
  loan_date       date not null default current_date,
  due_date        date not null,
  interest_rate   numeric(8,4) check (interest_rate >= 0),
  interest_amount numeric(14,2) not null check (interest_amount >= 0),
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

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id),
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
  check (principal_amount + interest_amount = total_amount)  -- regra de ouro
);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  entity_type text not null,      -- 'client' | 'loan' | 'payment'
  entity_id   uuid not null,
  action      text not null,      -- 'created' | 'updated' | 'canceled'
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create table public.user_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id),
  company_name          text,
  default_interest_rate numeric(8,4) default 20,
  theme                 text not null default 'claro',
  currency              text not null default 'BRL',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
```

### 002_triggers.sql (regras de negócio no banco)

1. **`handle_new_user`** — ao cadastrar no Auth, cria `profiles` + `user_settings` automaticamente.
2. **`set_loan_number`** — numeração automática sequencial por usuário (1, 2, 3...).
3. **`validate_payment`** — antes de inserir pagamento: bloqueia se principal pago > principal pendente, se juros pagos > juros pendentes com folga indevida, se empréstimo cancelado/pago.
4. **`refresh_loan_status`** — após inserir/cancelar pagamento: recalcula situação (`em_aberto` → `parcial` → `pago`).
5. **`audit_*`** — grava em `audit_logs` toda criação/alteração/cancelamento de cliente, empréstimo e pagamento (com `old_data`/`new_data` em JSONB).
6. **`block_delete`** — proíbe `DELETE` físico em `loans` e `payments` (só cancelamento). Cliente com empréstimo não pode ser excluído (FK `on delete restrict`).
7. **`set_updated_at`** — atualiza `updated_at` em todo update.

### 003_views.sql — `loan_stats`, `client_stats`, `dashboard_stats` (com `security_invoker = on` para respeitar RLS)

### 004_rls.sql — políticas (detalhadas no item 6)

### 005_storage.sql — bucket privado (detalhado abaixo)

---

## 5. Relacionamentos

```
auth.users 1──1 profiles
auth.users 1──1 user_settings
auth.users 1──N clients ── 1──N loans ── 1──N payments
auth.users 1──N audit_logs (aponta para qualquer entidade via entity_type/entity_id)
```

- `clients → loans`: **RESTRICT** (cliente com empréstimo não pode ser excluído)
- `loans → payments`: **RESTRICT** (nada é excluído; apenas cancelado)

---

## 6. Políticas RLS

RLS **habilitado em todas as tabelas**. Padrão para cada tabela:

```sql
alter table public.clients enable row level security;

create policy "select próprio" on public.clients
  for select using (auth.uid() = user_id);
create policy "insert próprio" on public.clients
  for insert with check (auth.uid() = user_id);
create policy "update próprio" on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Diferenças importantes:**

| Tabela        | SELECT | INSERT | UPDATE | DELETE |
|---------------|--------|--------|--------|--------|
| profiles      | próprio| via trigger | próprio | ❌ |
| clients       | próprio| próprio| próprio| ✅ só sem empréstimos (FK restrict) |
| loans         | próprio| próprio| próprio (cancelar/editar) | ❌ **sem política = impossível** |
| payments      | próprio| próprio| próprio (só cancelar) | ❌ **sem política = impossível** |
| audit_logs    | próprio| via trigger | ❌ | ❌ (auditoria imutável) |
| user_settings | próprio| via trigger | próprio | ❌ |

- O app usa **somente a ANON KEY**. A service_role nunca sai do painel do Supabase.
- Sem política de DELETE = o PostgreSQL nega a operação para qualquer cliente, mesmo que o app tente.

---

## 7. Fluxo das telas

```
[Login] ─→ [Cadastro]  [Recuperar senha]
   │ (sessão persistente: entra direto se já logado)
   ▼
┌────────────────────────────────────────────────┐
│ BOTTOM NAV:  Início · Clientes · Empréstimos · │
│              Relatórios · Config               │
└────────────────────────────────────────────────┘
 Início (Dashboard)
   ├─ cards de indicadores (carteira)
   ├─ últimos pagamentos ─→ Detalhe do empréstimo
   ├─ próximos vencimentos ─→ Detalhe do empréstimo
   └─ atrasados ─→ Detalhe do empréstimo
 Clientes
   ├─ busca + filtro status → [+ Novo cliente]
   └─ Detalhe do cliente (indicadores + linha do tempo)
        └─ [+ Novo empréstimo para este cliente]
 Empréstimos
   ├─ filtros (situação, cliente, data) + busca (nome, CPF, nº)
   ├─ [+ Novo empréstimo]
   └─ Detalhe do empréstimo
        ├─ indicadores + rentabilidade + semáforo 🟢🟡🟠🔴
        ├─ lista de pagamentos → cancelar (com motivo)
        └─ [+ Registrar pagamento] (bottom sheet)
 Relatórios
   ├─ filtros (período, cliente)
   ├─ totais + rentabilidade + tempo médio de retorno
   └─ fluxo de caixa (entradas, saídas, resultado)
 Configurações
   └─ empresa, taxa padrão, tema, moeda, logout
```

**Semáforo de vencimento:** 🟢 em dia · 🟡 vence hoje · 🟠 atrasado (1–30 dias) · 🔴 muito atrasado (>30 dias).

---

## 8. Plano de desenvolvimento (etapas com aprovação)

| Etapa | Entrega | Como você testa |
|-------|---------|-----------------|
| **1** | Banco completo no Supabase (migrações 001–005 aplicadas) | Vemos as tabelas no painel do Supabase |
| **2** | Projeto base + Auth (login, cadastro, recuperação, sessão, logout) | Cria sua conta e entra pelo navegador |
| **3** | Clientes (lista, busca, cadastro, detalhe, status) | Cadastra clientes reais |
| **4** | Empréstimos (cadastro com cálculo de juros, lista com filtros, detalhe) | Lança um empréstimo de verdade |
| **5** | Pagamentos (registrar, validar, cancelar com motivo, situação automática) | Registra um recebimento |
| **6** | Dashboard completo (todos os indicadores + listas) | Confere os números da carteira |
| **7** | Relatórios + fluxo de caixa + linha do tempo do cliente | Filtra por período/cliente |
| **8** | Configurações + PWA final (ícone, instalação) + publicação no GitHub Pages | **Instala no seu celular** 📱 |

Ao final de cada etapa: explico o que foi feito, listo os arquivos criados, digo como testar e **aguardo sua aprovação**.

---

## 9. Dependências

**Produção:** `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `zod`, `dayjs`
**Dev:** `vite`, `typescript`, `vite-plugin-pwa`, `tailwindcss`
Todas gratuitas e open source. Sem Firebase. Sem serviços pagos.

**Hospedagem:** GitHub Pages (grátis, com deploy automático via GitHub Actions a cada atualização).

---

## 10. Estratégia de autenticação

- Supabase Auth com e-mail/senha (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `signOut`).
- **Sessão persistente**: o supabase-js guarda a sessão no dispositivo e renova o token automaticamente — você loga uma vez e o app abre direto.
- Guarda de rotas: qualquer tela (exceto login/cadastro/recuperação) redireciona para o login se não houver sessão.
- Cadastro cria automaticamente `profiles` e `user_settings` via trigger no banco.

---

## 11. Estratégia financeira

- **Nunca float.** No app, todo valor circula como **centavos inteiros** (R$ 1.500,00 = `150000`). Divisões/percentuais arredondam com regra fixa (half-up) só na exibição.
- No PostgreSQL, tudo é **NUMERIC(14,2)** — precisão exata.
- Cálculos agregados (totais, rentabilidade, saldos) são feitos **no banco (views)**, garantindo um único ponto de verdade.
- Fórmulas:
  - Juros (por taxa): `principal × taxa ÷ 100`
  - Valor previsto: `principal + juros`
  - Rentabilidade prevista: `juros previstos ÷ principal × 100`
  - Rentabilidade realizada: `juros recebidos ÷ principal × 100`
  - Tempo de retorno: `data do último pagamento − data do empréstimo` (dias)
  - Rentabilidade média mensal equivalente: `realizada ÷ (dias decorridos ÷ 30)`
  - Resultado da carteira: `= juros recebidos` (principal devolvido **nunca** é lucro)
- Bloqueios (no banco): valores negativos, pagamento maior que o saldo, `principal + juros ≠ total`.

---

## 12. Estratégia de segurança

1. RLS em 100% das tabelas — cada usuário só enxerga o que é dele (`auth.uid() = user_id`).
2. Só a **ANON KEY** no app (ela é pública por design; a segurança real é o RLS).
3. Exclusão física **impossível** para empréstimos, pagamentos e auditoria (sem política DELETE + trigger de bloqueio).
4. Cancelamentos sempre com motivo, data e usuário → gravados na auditoria.
5. Auditoria imutável (JSONB `old_data`/`new_data`).
6. Storage: bucket **privado** `documentos`, arquivos em pasta por usuário (`{user_id}/...`), política de acesso só ao dono. Estrutura pronta para comprovantes/documentos/fotos no futuro.
7. Validação dupla: Zod no app (feedback rápido) + constraints/triggers no banco (garantia final).

---

## 13. Melhorias sugeridas (para depois da v1)

1. **Botão "Cobrar no WhatsApp"** — abre conversa com o cliente com mensagem pronta (valor, vencimento). Custo zero, uso imediato.
2. **Exportar CSV/Excel** dos relatórios.
3. **Empréstimos parcelados** (parcelas com vencimentos múltiplos).
4. **Tema escuro** completo.
5. **Anexar comprovante** ao pagamento (Storage já estará pronto).
6. **Juros compostos / renovação de contrato** ("rolagem" do empréstimo).
7. **Gráficos de evolução** da carteira mês a mês.
8. Migração futura para **Flutter nativo** reaproveitando 100% do banco, se quiser publicar nas lojas.

---

## Custo total: R$ 0,00

| Recurso | Plano | Limite gratuito |
|---------|-------|-----------------|
| Supabase | Free | 500 MB de banco, 50 mil usuários — de sobra |
| GitHub + Pages | Free | Hospedagem ilimitada para o app |
| PWA | — | Sem taxa de loja (Google/Apple) |

---

**➡️ Aguardando sua aprovação para iniciar a Etapa 1 (criação do banco no Supabase).**

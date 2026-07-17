# Agg de Bolso 💚

App mobile (PWA) para controle de empréstimos a clientes — quanto foi emprestado,
recebido, juros, rentabilidade e vencimentos.

## Stack (100% gratuita)

- **App**: React + TypeScript + Vite + Tailwind (PWA instalável em Android e iPhone)
- **Backend**: Supabase (PostgreSQL + Auth + Storage) com Row Level Security
- **Hospedagem**: GitHub Pages (deploy automático via GitHub Actions)

## Estrutura

- `app/` — código do aplicativo
- `supabase/migrations/` — scripts SQL do banco (tabelas, regras, views, RLS)
- `PLANEJAMENTO.md` — planejamento completo do projeto

## Rodar localmente

```bash
cd app
npm install
npm run dev
```

> A chave no `.env` é a chave **pública** (publishable) do Supabase — a segurança
> dos dados é garantida pelo RLS no banco. A `service_role` nunca é usada no app.

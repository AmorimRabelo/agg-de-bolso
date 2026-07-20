import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-5 pb-10 pt-8">
      <button onClick={() => navigate(-1)} className="mb-2 text-sm font-medium text-brand-700">
        ‹ Voltar
      </button>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <div className="prose-legal mt-4 flex flex-col gap-3 text-sm leading-relaxed text-ink/80">
        {children}
      </div>
      <p className="mt-8 text-center text-xs text-ink/30">
        EmprestaJá · última atualização: julho de 2026
      </p>
    </div>
  )
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 font-bold text-ink">{children}</h2>
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <H>1. O que é o EmprestaJá</H>
      <p>
        O EmprestaJá é um aplicativo de <strong>gestão e organização</strong> de
        carteiras de crédito: registro de clientes, empréstimos, parcelas,
        recebimentos e relatórios. O EmprestaJá <strong>não é instituição
        financeira</strong>, não empresta dinheiro, não intermedeia operações de
        crédito e não participa das transações entre o usuário e os clientes dele.
      </p>

      <H>2. Conta de acesso</H>
      <p>
        O cadastro exige nome, e-mail e senha verdadeiros. A conta é pessoal e
        intransferível; o usuário é responsável por manter sua senha em sigilo e
        por toda atividade realizada com seu login.
      </p>

      <H>3. Teste grátis e assinatura</H>
      <p>
        Toda conta nova recebe <strong>14 dias de teste grátis</strong> com todos os
        recursos. Após o período, o uso pleno depende de assinatura ativa (plano
        Essencial, R$ 10/mês). Sem assinatura, a conta entra em <strong>modo
        leitura</strong>: nenhum dado é apagado, mas novos registros ficam
        bloqueados até a ativação. A assinatura pode ser cancelada a qualquer
        momento, valendo até o fim do período já pago.
      </p>

      <H>4. Responsabilidades do usuário</H>
      <p>
        O usuário declara que sua atividade de crédito é conduzida por sua conta e
        risco, em conformidade com a legislação aplicável — incluindo limites
        legais de juros e regras de cobrança. Os dados de terceiros inseridos no
        aplicativo (clientes do usuário) são de responsabilidade do usuário, que
        declara possuir base legal para tratá-los. É proibido usar o aplicativo
        para atividade ilícita, e a violação destes termos autoriza a suspensão da
        conta.
      </p>

      <H>5. Disponibilidade e limitações</H>
      <p>
        O serviço é fornecido "no estado em que se encontra", com esforço contínuo
        de disponibilidade e cópias de segurança, sem garantia de funcionamento
        ininterrupto. O EmprestaJá não se responsabiliza por decisões de crédito
        do usuário nem por perdas decorrentes das operações que ele registra —
        o aplicativo é ferramenta de organização, não de aconselhamento.
      </p>

      <H>6. Propriedade intelectual</H>
      <p>
        O aplicativo, a marca e o código pertencem aos criadores do EmprestaJá.
        Os <strong>dados inseridos pertencem ao usuário</strong>, que pode
        solicitá-los ou excluí-los conforme a Política de Privacidade.
      </p>

      <H>7. Encerramento</H>
      <p>
        O usuário pode encerrar a conta a qualquer momento pelos canais de
        atendimento, com exclusão definitiva dos seus dados em até 30 dias.
      </p>

      <H>8. Alterações e foro</H>
      <p>
        Estes termos podem ser atualizados, com aviso no aplicativo. Aplica-se a
        lei brasileira, e fica eleito o foro do domicílio do usuário para
        controvérsias de consumo.
      </p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <H>1. Quais dados coletamos</H>
      <p>
        <strong>Dados da sua conta:</strong> nome, e-mail e senha (criptografada).{' '}
        <strong>Dados que você insere:</strong> informações dos seus clientes e das
        suas operações (nomes, CPF/CNPJ, telefones, valores, datas).{' '}
        <strong>Dados técnicos:</strong> registros de acesso e, se você autorizar,
        o endereço de entrega de notificações do seu aparelho.
      </p>

      <H>2. Para que usamos</H>
      <p>
        Exclusivamente para operar o aplicativo: autenticar seu acesso, guardar e
        exibir sua carteira, calcular indicadores, enviar notificações que você
        ativou e processar sua assinatura. <strong>Não vendemos nem compartilhamos
        seus dados para publicidade.</strong>
      </p>

      <H>3. Papéis na LGPD</H>
      <p>
        Para os dados da sua conta, o EmprestaJá é <strong>controlador</strong>.
        Para os dados dos seus clientes que você insere, <strong>você é o
        controlador</strong> e o EmprestaJá atua como <strong>operador</strong>,
        tratando-os apenas sob suas instruções (guardar, exibir e calcular).
      </p>

      <H>4. Segurança e isolamento</H>
      <p>
        Os dados trafegam criptografados (HTTPS) e ficam em banco de dados com{' '}
        <strong>isolamento por usuário</strong>: cada conta acessa somente os
        próprios registros, garantido pela camada de segurança do banco. Alterações
        sensíveis geram trilha de auditoria. A infraestrutura é fornecida pela
        Supabase, com servidores gerenciados e cópias de segurança.
      </p>

      <H>5. Seus direitos (LGPD)</H>
      <p>
        Você pode solicitar a qualquer momento: acesso aos seus dados, correção,
        portabilidade (exportação) e <strong>exclusão definitiva</strong> da conta
        e de todo o conteúdo, atendida em até 30 dias. Basta contatar o canal de
        atendimento informado no aplicativo.
      </p>

      <H>6. Retenção</H>
      <p>
        Os dados permanecem enquanto a conta existir — inclusive com a assinatura
        pausada (modo leitura). Após o pedido de exclusão, são removidos
        definitivamente, ressalvadas obrigações legais de guarda.
      </p>

      <H>7. Notificações</H>
      <p>
        As notificações no celular são <strong>opcionais</strong>: só são enviadas
        se você as ativar nos Ajustes, e podem ser desativadas a qualquer momento
        no próprio aparelho.
      </p>
    </LegalLayout>
  )
}

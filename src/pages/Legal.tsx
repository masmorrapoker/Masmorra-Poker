import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Termos de uso e Política de privacidade (texto base).
 * Revisar com advogado e completar razão social/CNPJ antes de vender em escala.
 */

const UPDATED = '20/10/2026';
const CONTACT = 'https://wa.me/5551998811587';

function Termos() {
  return (
    <>
      <h1 className="mb-1">Termos de uso</h1>
      <p className="text-xs text-muted mb-8">Atualizado em {UPDATED}</p>

      <h2>1. O serviço</h2>
      <p>
        O Masmorra Manager é um sistema on-line de gestão para clubes de poker: mesas de cash game, lançamentos de
        buy-in, cash-out e consumo, controle de fiado, fechamento de caixa, cadastro de jogadores e relatórios.
        O acesso é contratado pelo clube, que convida as pessoas da própria equipe.
      </p>

      <h2>2. Contas e equipe</h2>
      <p>
        Cada pessoa usa o próprio e-mail e senha e é responsável por mantê-los em segredo. O dono do clube define quem
        tem acesso e com qual papel (dono, gerente ou caixa) e pode remover acessos a qualquer momento. Tudo o que é
        lançado fica registrado com data e hora.
      </p>

      <h2>3. Uso permitido</h2>
      <p>
        O sistema serve para organizar a operação do clube. O clube é responsável pelas atividades que realiza, pelo
        cumprimento da legislação aplicável à sua atividade e pela veracidade dos dados que lança. É proibido usar o
        sistema para fins ilícitos, tentar acessar dados de outros clubes ou interferir no funcionamento do serviço.
      </p>

      <h2>4. Assinatura</h2>
      <p>
        O acesso é mensal, pelo valor e forma de pagamento combinados na contratação. O clube recebe aviso antes do
        vencimento. Se o pagamento não for confirmado em até 3 dias após o vencimento, o acesso é suspenso; os dados
        ficam guardados e o acesso volta assim que o pagamento é regularizado.
      </p>

      <h2>5. Dados do clube</h2>
      <p>
        Os dados lançados pertencem ao clube. Cada clube só enxerga os próprios dados. O tratamento de dados pessoais
        segue a <Link to="/privacidade" className="text-primary">Política de privacidade</Link>.
      </p>

      <h2>6. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para manter o sistema disponível e os dados íntegros, mas o serviço pode ter interrupções
        pontuais, por exemplo em manutenções ou falhas de fornecedores de internet e hospedagem. Os relatórios são
        ferramentas de apoio: a conferência final do dinheiro é responsabilidade do clube.
      </p>

      <h2>7. Cancelamento</h2>
      <p>
        O clube pode cancelar a qualquer momento. Mediante pedido, entregamos uma cópia dos dados do clube em planilha
        e, depois, apagamos os dados, exceto o que a lei exigir que seja guardado.
      </p>

      <h2>8. Contato</h2>
      <p>
        Dúvidas sobre estes termos: <a href={CONTACT} target="_blank" rel="noreferrer" className="text-primary">WhatsApp do suporte</a>.
      </p>
    </>
  );
}

function Privacidade() {
  return (
    <>
      <h1 className="mb-1">Política de privacidade</h1>
      <p className="text-xs text-muted mb-8">Atualizado em {UPDATED}</p>

      <h2>1. Quem é quem</h2>
      <p>
        Cada clube decide quais dados de jogadores cadastra e para quê: o clube é o controlador desses dados, nos termos
        da Lei Geral de Proteção de Dados (Lei 13.709/2018). O Masmorra Manager guarda e processa esses dados em nome do
        clube, como operador, apenas para prestar o serviço.
      </p>

      <h2>2. Dados que o sistema guarda</h2>
      <ul>
        <li><strong>Equipe do clube:</strong> nome, e-mail e papel de cada pessoa com acesso.</li>
        <li><strong>Jogadores:</strong> nome ou apelido e, se o clube preencher, telefone, data de nascimento e observações.</li>
        <li><strong>Movimentação:</strong> mesas, buy-ins, cash-outs, consumo, fiado, pagamentos e fechamentos de caixa, com data, hora e quem lançou.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <p>
        Só para fazer o sistema funcionar para o clube: registrar a operação, calcular resultados, gerar relatórios e
        permitir que o clube entre em contato com seus jogadores (por exemplo, pelo WhatsApp). Não vendemos dados e
        não usamos os dados dos jogadores para publicidade própria.
      </p>

      <h2>4. Onde ficam e quem acessa</h2>
      <p>
        Os dados ficam em servidores de hospedagem em nuvem (Supabase e Vercel), com conexão criptografada. Cada clube só
        acessa os próprios dados, por regras aplicadas no banco de dados. Nossa equipe só acessa dados de um clube quando
        necessário para suporte ou manutenção.
      </p>

      <h2>5. Por quanto tempo</h2>
      <p>
        Enquanto o clube usar o serviço. Depois do cancelamento, os dados são apagados mediante pedido do clube, exceto o
        que a lei exigir que seja guardado.
      </p>

      <h2>6. Direitos dos titulares</h2>
      <p>
        Jogadores podem pedir ao clube acesso, correção ou exclusão dos próprios dados. Se o pedido chegar a nós,
        encaminhamos ao clube e ajudamos a atendê-lo.
      </p>

      <h2>7. Responsabilidade do clube</h2>
      <p>
        Ao cadastrar um jogador, o clube deve ter base legal para isso, informar o jogador sobre o uso dos dados e evitar
        cadastrar dados além do necessário. Antes de divulgar resultados ou rankings com nomes em redes sociais, o clube
        deve ter o consentimento dos jogadores.
      </p>

      <h2>8. Contato</h2>
      <p>
        Dúvidas ou pedidos sobre dados pessoais: <a href={CONTACT} target="_blank" rel="noreferrer" className="text-primary">WhatsApp do suporte</a>.
      </p>
    </>
  );
}

export default function Legal({ kind }: { kind: 'termos' | 'privacidade' }) {
  return (
    <div className="min-h-screen" style={{ background: '#090d16' }}>
      <article className="max-w-2xl mx-auto px-4 py-10 text-left legal-text">
        <Link to="/" className="text-xs text-muted font-bold inline-flex items-center gap-1.5 py-2 mb-6 no-underline">
          <ArrowLeft size={14} /> Masmorra Manager
        </Link>
        {kind === 'termos' ? <Termos /> : <Privacidade />}
      </article>
    </div>
  );
}

import {ArrowLeft} from 'lucide-react';
import {Fragment} from 'react';
import {Link} from 'react-router-dom';
import rawTerms from '../../../termos-de-uso.md?raw';
import rawPrivacy from '../../../politica-de-privacidade.md?raw';
import {EnapVidaLogo, NewsTicker} from '../../components/ui/BrandAssets';

const terms = rawTerms
  .replace(/pré-ingresso/gi, 'Pré-Embarque')
  .replace(
    'o canal de suporte institucional a Coordenaçãode Gestão Estratágica e Modernização – CGOM/CGGP/DGC',
    'o canal de suporte institucional da Coordenação de Gestão Estratégica e Modernização – COGEM/CGGP/DGC',
  );

const privacy = rawPrivacy
  .replace(/pré-ingresso/gi, 'Pré-Embarque')
  .replace(/^Identificação institucional para publicação: .*?(A atribuição de administração operacional[^\n]+)$/m, '$1')
  .replace('restar suporte', 'prestar suporte')
  .replace('quando necessários. Não inserir e-mails ou nomes particulares sem confirmação institucional.', 'quando necessário.');

const documents = {terms, privacy};
const officialContactUrl = 'https://enap.gov.br/acesso-a-informacao/tratamento-de-dados-pessoais-enap/';

function renderParagraph(text: string) {
  const parts = text.split(officialContactUrl);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <a href={officialContactUrl} className="font-semibold text-[#186F80] underline break-words">Tratamento de dados pessoais na Enap</a>}
      {part}
    </Fragment>
  ));
}

export function LegalDocumentPage({kind}: {kind: keyof typeof documents}) {
  const [title, subtitle, ...lines] = documents[kind].trim().split(/\r?\n/);

  return (
    <div className="min-h-screen bg-[#FFFCF8] text-[#173640]">
      <NewsTicker />
      <header className="border-b border-[#E2DDD5] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link to="/" aria-label="Enap e-Vida, página inicial"><EnapVidaLogo /></Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold hover:underline">
            <ArrowLeft className="size-4" aria-hidden="true" /> Voltar ao início
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-8 sm:py-12">
        <article className="space-y-4 rounded-2xl border border-[#E2DDD5] bg-white p-5 sm:p-8">
          <header className="space-y-2 border-b border-[#E2DDD5] pb-5">
            <h1 className="text-3xl font-extrabold">{title}</h1>
            <p className="text-sm text-[#5F666A]">{subtitle}</p>
          </header>
          <p className="rounded-lg bg-[#FFF2DE] px-4 py-3 text-sm">
            Versão para consulta no piloto. A vigência para uso institucional depende de aprovação da Enap.
          </p>
          {lines.map((rawLine, index) => {
            const line = rawLine.trim();
            if (!line) return null;
            if (/^\d{2}\.\s/.test(line)) {
              return <h2 key={index} className="pt-4 text-lg font-bold">{line}</h2>;
            }
            return <p key={index} className="text-sm leading-relaxed text-[#4A4F52]">{renderParagraph(line)}</p>;
          })}
          <nav aria-label="Documentos relacionados" className="border-t border-[#E2DDD5] pt-4 text-sm">
            {kind === 'terms' ? (
              <Link to="/politica-de-privacidade" className="font-semibold text-[#186F80] underline">Política de Privacidade</Link>
            ) : (
              <Link to="/termos-de-uso" className="font-semibold text-[#186F80] underline">Termos de Uso</Link>
            )}
          </nav>
        </article>
      </main>
    </div>
  );
}

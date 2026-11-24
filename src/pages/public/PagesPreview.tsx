import {EnapVidaLogo, PWAInstallButton, RgiGeometricStrip} from '../../components/ui/BrandAssets';
import hero from '../../assets/images/hero_enap_evida_1795080544506.jpg';

export function PagesPreview() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#173640]">
      <RgiGeometricStrip className="h-2.5 w-full" />
      <header className="border-b border-[#E2DDD5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <EnapVidaLogo className="max-w-36 sm:max-w-56" />
          <PWAInstallButton />
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-2 md:py-20">
        <div className="space-y-5">
          <p className="text-sm font-semibold">Escola Nacional de Administração Pública</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Conexões que acolhem. Experiências que transformam.
          </h1>
          <p className="text-lg">
            O Enap e-Vida reúne acolhimento, Jornada de Ambientação, qualidade de vida no trabalho,
            participação, diversidade, equidade e inclusão.
          </p>
          <p className="rounded-xl border border-[#E2DDD5] bg-white p-4 text-sm">
            Esta é a apresentação pública do app. Acesso à conta, Pré-Embarque e demais recursos
            interativos estão disponíveis na versão executada com o servidor Enap e-Vida.
          </p>
          <a className="font-semibold underline" href="https://github.com/dmenezes007/enap-e-vida#como-executar">
            Consultar instruções de execução
          </a>
        </div>
        <img src={hero} alt="" className="w-full rounded-2xl object-cover shadow-sm" />
      </main>
    </div>
  );
}

import Link from 'next/link';
import { ArrowRight, Sparkles, Zap, ShieldCheck, Layers } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">
            FlowMind <span className="text-indigo-600">AI</span>
          </span>
        </div>

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            Acessar Plataforma
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center my-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wider mb-6">
          <Zap className="w-3.5 h-3.5" />
          <span>SaaS B2B de Automação Empresarial com IA</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight mb-6">
          Crie automações complexas em{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            linguagem natural
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10 leading-relaxed">
          Transforme processos manuais em workflows inteligentes. Quando um cliente envia um formulário,
          a IA resume o texto, analisa a intenção sem pontuação comercial, persiste os dados com isolamento e responde de forma personalizada.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition space-x-2"
          >
            <span>Iniciar Automação</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Diferenciais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">IA com Revisão Humana</h3>
            <p className="text-sm text-slate-600">
              A inteligência artificial propõe os nós e fluxos, permitindo que você revise e simule antes de ativar.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">Segurança Multi-tenant</h3>
            <p className="text-sm text-slate-600">
              Isolamento estrito entre organizações com gestão B2B nativa via Clerk e permissões por papel.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 text-base mb-2">Simulação Segura</h3>
            <p className="text-sm text-slate-600">
              Teste seus workflows com dados sintéticos sem disparar e-mails reais ou chamadas externas indesejadas.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        © 2026 FlowMind AI. Todos os direitos reservados.
      </footer>
    </div>
  );
}

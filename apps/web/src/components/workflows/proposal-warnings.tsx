interface ProposalWarningsProps {
  warnings?: string[];
}

export function ProposalWarnings({ warnings }: ProposalWarningsProps) {
  if (!warnings?.length) return null;

  return (
    <section aria-label="Avisos da proposta" className="min-w-0 pt-2 text-xs text-amber-200">
      <h4 className="font-semibold">Avisos e campos pendentes</h4>
      <ul
        aria-label="Lista de avisos da proposta"
        tabIndex={0}
        className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded pr-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {warnings.map((warning, index) => (
          <li key={index} className="break-words [overflow-wrap:anywhere]">
            {warning}
          </li>
        ))}
      </ul>
    </section>
  );
}

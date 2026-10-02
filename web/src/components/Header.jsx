export default function Header({ meta }) {
  return (
    <header className="border-b border-slate-800 bg-surface-800/80 backdrop-blur sticky top-0 z-40">
      <div className="container mx-auto max-w-screen-2xl px-4 py-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl select-none">🧬</span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-100">
                EV-D68 VP1 Divergence Explorer
              </h1>
              <p className="text-xs text-slate-500">
                Enterovirus D68 · Viral Protein 1 (major capsid / surface protein)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href="https://www.ncbi.nlm.nih.gov/labs/virus/vssi/#/virus?SeqType_s=Nucleotide&VirusLineage_ss=Enterovirus%20D68,taxid:42789"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300
                       hover:border-emerald-600 hover:text-emerald-400 transition-colors"
          >
            NCBI Virus ↗
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300
                       hover:border-slate-500 hover:text-slate-100 transition-colors"
          >
            GitHub ↗
          </a>
        </div>
      </div>

      {meta?.description && (
        <div className="container mx-auto max-w-screen-2xl px-4 pb-2">
          <p className="text-xs text-slate-500 max-w-3xl">{meta.description}</p>
        </div>
      )}
    </header>
  );
}

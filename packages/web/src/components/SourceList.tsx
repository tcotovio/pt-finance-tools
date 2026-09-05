// "Onde é que isto foi buscar os números" — every source behind the result.
//
// Collapsed by default, at the foot of the panel: most people want the answer
// and not its bibliography, and open it is a complete list with links so
// anyone who wants to check can.
//
// It used to carry an aggregate badge — "Dados verificados" / "Dados por
// verificar" — up beside the headline number, on the argument that a caveat
// belongs with the figure it qualifies. Both halves of that were wrong.
//
// It was not a caveat. Every dataset here is transcribed from the official
// despacho or ofício-circulado either way; "por verificar" meant only that a
// second, independent implementation had not yet been found to check the
// transcription against. That is a state of our own quality assurance, not a
// risk the reader carries, and nothing they can act on.
//
// And it over-claimed: the flag was `every()` over the checkable sources, so
// one unconfirmed source of seven painted the whole result amber. On the loan
// panel the Banco de Portugal limits and the IMT tables are both confirmed —
// it went amber over the half of the imposto do selo that no public simulator
// computes separately.
//
// What is left is what a reader can use: the list of instruments the answer
// rests on. Where an individual source has not been cross-checked it still
// says so, in the list, next to the source it applies to.

import type { SourceEntry } from "../lib/sources.js";

interface SourceListProps {
  entries: SourceEntry[];
}

export function SourceList({ entries }: SourceListProps) {
  if (entries.length === 0) return null;

  return (
    <details className="sources">
      <summary>
        <span className="sources-title">Fontes</span>
        <span className="sources-count">
          {entries.length === 1 ? "1 fonte" : `${entries.length} fontes`}
        </span>
      </summary>

      <ul className="sources-list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <p className="sources-label">
              {entry.label}
              {entry.verified === false ? (
                <span className="sources-flag">por verificar</span>
              ) : null}
            </p>
            <p className="sources-used-for">{entry.usedFor}</p>
            <p className="sources-citation">
              {entry.url ? (
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.citation}
                </a>
              ) : (
                entry.citation
              )}
            </p>
          </li>
        ))}
      </ul>

      <p className="sources-note">
        &quot;Verificado&quot; significa que os números foram transcritos da
        fonte oficial <em>e</em> confrontados com uma fonte independente. Onde
        isso não foi possível, fica dito.
      </p>
    </details>
  );
}

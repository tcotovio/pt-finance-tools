// "Onde é que isto foi buscar os números" — every source behind the result.
//
// Collapsed by default, because most people want the answer and not its
// bibliography; open, it is a complete list with links, so anyone who wants to
// check can. The verified badge stays visible on the summary either way — it
// is a caveat, and a caveat behind a disclosure is not a caveat.
//
// The same argument decides where this sits: directly under the headline
// number rather than at the foot of the panel. Whether the dataset behind a
// figure has been independently cross-checked qualifies the figure, so it has
// to be readable in the same glance — six sections further down, past the
// charts, it was a footnote about the number instead of a caveat on it.
//
// The summary names the headline dataset and counts the rest. Every builder in
// lib/sources.ts puts the dataset the answer mostly rests on first, so the one
// source most readers would ask about is the one they get without opening
// anything.

import type { SourceEntry } from "../lib/sources.js";

interface SourceListProps {
  entries: SourceEntry[];
}

export function SourceList({ entries }: SourceListProps) {
  if (entries.length === 0) return null;

  // Only sources where the notion applies count towards the badge: a market
  // statistic is quoted, not cross-checked, so it neither passes nor fails.
  const checkable = entries.filter((e) => e.verified !== undefined);
  const allVerified = checkable.every((e) => e.verified);

  return (
    <details className="sources">
      <summary>
        <span
          className={`badge${allVerified ? " is-verified" : " is-unverified"}`}
        >
          {allVerified ? "Dados verificados" : "Dados por verificar"}
        </span>
        <span className="sources-primary">{entries[0].label}</span>
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

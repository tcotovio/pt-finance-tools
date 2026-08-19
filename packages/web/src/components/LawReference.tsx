// An inline citation that can explain itself.
//
// Built on the native popover API: light dismiss, Escape, and top-layer
// stacking come from the platform, so there is no open/close state, no
// outside-click listener and nothing to get wrong on touch — where a hover
// tooltip would simply never appear.

import { useId } from "react";
import { lawReference, type LawReferenceId } from "../lib/law.js";

interface LawReferenceProps {
  id: LawReferenceId;
  /** Overrides the citation text, when the sentence needs its own wording. */
  children?: string;
}

export function LawReference({ id, children }: LawReferenceProps) {
  const reference = lawReference(id);
  const popoverId = useId();

  return (
    <>
      <button
        type="button"
        className="law-ref"
        popoverTarget={popoverId}
        aria-label={`${children ?? reference.label} — o que diz`}
      >
        {children ?? reference.label}
      </button>
      <div className="law-popover" id={popoverId} popover="auto">
        <p className="law-popover-title">{reference.title}</p>
        <p className="law-popover-label">{reference.label}</p>
        <p>{reference.summary}</p>
        {reference.url ? (
          <a href={reference.url} target="_blank" rel="noreferrer">
            Ver o documento oficial
          </a>
        ) : (
          <p className="law-popover-note">
            Texto integral no Código do IRS, publicado no Diário da República.
          </p>
        )}
      </div>
    </>
  );
}

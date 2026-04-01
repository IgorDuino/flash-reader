import React, { useMemo } from 'react';
import { calculateORP, type ScriptType } from '../lib/orp';

interface WordDisplayProps {
  words: string[];
  script: ScriptType;
  direction: 'ltr' | 'rtl';
  showCrosshair: boolean;
  fontFamily: string;
  fontSize: number;
}

interface WordSegment {
  before: string;
  orp: string;
  after: string;
}

function splitAtORP(word: string, script: ScriptType): WordSegment {
  if (word.length === 0) {
    return { before: '', orp: '', after: '' };
  }
  const orpIndex = calculateORP(word, script);
  return {
    before: word.slice(0, orpIndex),
    orp: word[orpIndex] ?? '',
    after: word.slice(orpIndex + 1),
  };
}

const WordDisplay: React.FC<WordDisplayProps> = ({
  words,
  script,
  direction,
  showCrosshair,
  fontFamily,
  fontSize,
}) => {
  const segments = useMemo(
    () => words.map((w) => splitAtORP(w, script)),
    [words, script],
  );

  const isRtl = direction === 'rtl';

  return (
    <div
      className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
      style={{ direction: isRtl ? 'rtl' : 'ltr', backgroundColor: 'var(--color-reader-bg)' }}
    >
      {/* Crosshair guides */}
      {showCrosshair && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ backgroundColor: 'var(--color-crosshair)' }} />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ backgroundColor: 'var(--color-crosshair)' }} />
        </>
      )}

      {/* Word rendering area */}
      <div
        className="relative flex items-center whitespace-nowrap"
        style={{
          fontFamily,
          fontSize: `${fontSize}px`,
          lineHeight: 1.2,
        }}
      >
        {segments.length === 1 ? (
          <SingleWord segment={segments[0]} isRtl={isRtl} />
        ) : (
          <ChunkDisplay segments={segments} isRtl={isRtl} fontSize={fontSize} />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Single-word display with ORP locked to container center             */
/* ------------------------------------------------------------------ */

interface SingleWordProps {
  segment: WordSegment;
  isRtl: boolean;
}

const SingleWord: React.FC<SingleWordProps> = React.memo(({ segment, isRtl }) => {
  const { before, orp, after } = segment;

  // For RTL, the visual order is: after | orp | before (logically reversed)
  // but CSS `direction: rtl` on the parent already handles reordering,
  // so we keep the logical order and let the bidi algorithm work.

  return (
    <div className="flex items-baseline" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Before-ORP: right-aligned, occupies a fixed conceptual half */}
      <span
        className="inline-block text-right"
        style={{
          color: 'var(--color-text)',
          minWidth: '3ch',
        }}
      >
        {before}
      </span>
      {/* ORP character: the anchor point */}
      <span
        style={{
          color: 'var(--color-orp)',
          fontWeight: 700,
        }}
      >
        {orp}
      </span>
      {/* After-ORP: left-aligned */}
      <span
        className="inline-block text-left"
        style={{
          color: 'var(--color-text)',
          minWidth: '3ch',
        }}
      >
        {after}
      </span>
    </div>
  );
});

SingleWord.displayName = 'SingleWord';

/* ------------------------------------------------------------------ */
/* Multi-word chunk display (2-3 words)                                */
/* ------------------------------------------------------------------ */

interface ChunkDisplayProps {
  segments: WordSegment[];
  isRtl: boolean;
  fontSize: number;
}

const ChunkDisplay: React.FC<ChunkDisplayProps> = React.memo(({ segments, isRtl, fontSize }) => {
  const gap = fontSize * 0.5;

  return (
    <div
      className="flex items-baseline"
      style={{
        direction: isRtl ? 'rtl' : 'ltr',
        gap: `${gap}px`,
      }}
    >
      {segments.map((seg, i) => (
        <span key={i} className="inline-flex items-baseline">
          <span style={{ color: 'var(--color-text)' }}>{seg.before}</span>
          <span style={{ color: 'var(--color-orp)', fontWeight: 700 }}>{seg.orp}</span>
          <span style={{ color: 'var(--color-text)' }}>{seg.after}</span>
        </span>
      ))}
    </div>
  );
});

ChunkDisplay.displayName = 'ChunkDisplay';

export default React.memo(WordDisplay);

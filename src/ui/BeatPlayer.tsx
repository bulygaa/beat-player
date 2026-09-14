"use client";

import { reveal, segmentFill } from "@/playhead/frame";
import { usePlayhead } from "@/playhead/usePlayhead";
import type { ValidFilm } from "@/playhead/validate";
import frameStyles from "./Frame.module.css";
import styles from "./BeatPlayer.module.css";

/**
 * One stage fed by a frame derived from the clock. It knows nothing about any particular beat: adding a beat to
 * the array adds one track segment and one more stretch of time through this same markup.
 */
export function BeatPlayer({ film }: { film: ValidFilm }) {
  const { frame, replay } = usePlayhead(film);
  const count = film.beats.length;
  const fills = segmentFill(film.beats, frame?.elapsedMs ?? 0);

  // Until the start time is known (the server render and hydration), the frame asserts no position: no beat,
  // counter, timecode or track. A zeroed timecode would read as a restart. Every element still holds its space,
  // so nothing shifts when the real frame lands.
  return (
    <section
      className={frameStyles.frame}
      aria-label="A 30-second film, playing automatically"
      aria-busy={frame === null}
    >
      <div className={styles.meta}>
        <span aria-hidden="true">{frame && `${pad(frame.index + 1)} / ${pad(count)}`}</span>
        {frame?.status === "ended" ? (
          <button type="button" className={styles.replay} onClick={replay}>
            Replay
          </button>
        ) : (
          <span aria-hidden="true">{frame && `${timecode(frame.elapsedMs)} / ${timecode(film.totalMs)}`}</span>
        )}
      </div>

      <div
        className={`${frameStyles.body} ${styles.stage}`}
        style={{ "--reveal": frame ? reveal(frame, count) : 0 } as React.CSSProperties}
        aria-live="polite"
        aria-atomic="true"
      >
        <h2 className={styles.title}>{frame?.beat.title}</h2>
        <p className={styles.text}>{frame?.beat.text}</p>
        <noscript>
          <p className={styles.text}>This film needs JavaScript.</p>
        </noscript>
      </div>

      <div className={styles.track} aria-hidden="true">
        {film.beats.map((beat, index) => (
          <span key={index} className={styles.segment} style={{ flexGrow: beat.durationMs }}>
            <span className={styles.fill} style={{ transform: `scaleX(${fills[index]})` }} />
          </span>
        ))}
      </div>
    </section>
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function timecode(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

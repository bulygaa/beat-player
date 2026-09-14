import frameStyles from "./Frame.module.css";
import styles from "./FilmError.module.css";

/**
 * The refusal. It renders in place of the player, inside the same frame, so it reads as the widget declining to
 * play. No player is mounted: no clock is read and nothing is written to storage.
 */
export function FilmError({ message }: { message: string }) {
  return (
    <section className={frameStyles.frame} role="alert" aria-label="Film not played">
      <div className={styles.meta}>Refused</div>
      <div className={frameStyles.body}>
        <h2 className={styles.title}>Not playing.</h2>
        <p className={styles.message}>{message}</p>
      </div>
    </section>
  );
}

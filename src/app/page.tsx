import { pickBeats } from "@/film/variants";
import { describeFilmError, validateFilm } from "@/playhead/validate";
import { BeatPlayer } from "@/ui/BeatPlayer";
import { FilmError } from "@/ui/FilmError";

/**
 * The page is the widget. Validation runs here, on the server, before any client code exists: an invalid film
 * never mounts a player. `?beats=` only chooses which array goes in; nothing below this line knows it exists.
 */
export default async function Page({ searchParams }: PageProps<"/">) {
  const result = validateFilm(pickBeats((await searchParams).beats));

  return (
    <main>
      {result.ok ? <BeatPlayer film={result.film} /> : <FilmError message={describeFilmError(result.error)} />}
    </main>
  );
}

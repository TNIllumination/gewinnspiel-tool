"use client";

/// Greift, wenn schon das Grundgerüst nicht geladen werden konnte. Deshalb
/// bringt diese Seite html und body selbst mit und kommt ohne Stylesheet aus.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: "0 auto",
          padding: "4rem 1.25rem",
          maxWidth: "34rem",
          font: '17px/1.7 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: "#1e293b",
        }}
      >
        <h1 style={{ fontSize: "1.6rem" }}>Da ist etwas schiefgegangen</h1>
        <p>
          Deine Gewinnspiele und Teilnehmer sind unversehrt. Die genaue Meldung steht
          im schwarzen Fenster, in dem das Tool läuft.
        </p>
        <p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: ".5rem 1rem",
              borderRadius: 8,
              border: 0,
              background: "#0f172a",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Nochmal versuchen
          </button>
        </p>
        {error.digest ? (
          <p style={{ fontSize: ".8rem", color: "#64748b" }}>
            Kennung: <code>{error.digest}</code>
          </p>
        ) : null}
      </body>
    </html>
  );
}

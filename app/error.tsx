"use client";

/* 全站错误兜底：products 表不可达等场景。品牌化、可重试。 */
export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "4rem 1.5rem",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      <div>
        <p
          style={{
            letterSpacing: ".14em",
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: ".8rem",
            color: "#d4702a",
          }}
        >
          A small tangle
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display, sans-serif)",
            color: "#12275e",
            margin: ".4em 0",
          }}
        >
          The shop slipped off the shelf.
        </h1>
        <p style={{ color: "#5c5a55", maxWidth: "34rem", margin: "0 auto" }}>
          Something on our side needs a moment. Give it another try, it
          usually rights itself.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.4rem",
            padding: ".8rem 1.6rem",
            borderRadius: "999px",
            border: 0,
            background: "#e8863c",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            font: "inherit",
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sessionToken } from "@/lib/auth";

/* 口令 = 生产 ADMIN_SECRET（根 .env.local）。httpOnly cookie，30 天。 */
async function login(formData: FormData) {
  "use server";
  const input = String(formData.get("secret") ?? "");
  if (!process.env.ADMIN_SECRET || input !== process.env.ADMIN_SECRET) {
    redirect("/login?bad=1");
  }
  (await cookies()).set("admin_auth", await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const { bad } = await searchParams;
  return (
    <form
      action={login}
      style={{
        maxWidth: 360,
        margin: "24vh auto 0",
        display: "grid",
        gap: 12,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-soft)",
        padding: "30px 28px 26px",
      }}
    >
      <div className="brand" style={{ padding: 0 }}>
        Roomie<span className="brandTag">admin</span>
      </div>
      <p className="hint" style={{ margin: "0 0 4px" }}>
        The back room. Keys, ledgers, parcel tape.
      </p>
      <input
        type="password"
        name="secret"
        placeholder="ADMIN_SECRET"
        autoFocus
        required
        aria-label="Admin secret"
      />
      {bad && <p className="warn" style={{ margin: 0 }}>Wrong secret.</p>}
      <button type="submit">Enter</button>
    </form>
  );
}

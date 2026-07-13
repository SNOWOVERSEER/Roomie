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
      style={{ maxWidth: 380, margin: "18vh auto 0", display: "grid", gap: 12 }}
    >
      <h1>Roomie Admin</h1>
      <input
        type="password"
        name="secret"
        placeholder="ADMIN_SECRET"
        autoFocus
        required
      />
      {bad && <p className="warn">Wrong secret.</p>}
      <button type="submit">Enter</button>
    </form>
  );
}

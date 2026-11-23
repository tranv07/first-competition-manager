import Link from "next/link";
import SignInForm from "@/components/SignInForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "inactive" ? "This account is inactive. Contact an event admin." : "";

  return (
    <main className="auth-page">
      <section className="auth-panel panel">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-name">
            <strong>FIRST</strong>
            <small>Competition Manager</small>
          </span>
        </Link>
        <p className="eyebrow">STAFF ACCESS</p>
        <h1>Sign in</h1>
        <p className="subheading">
          Accounts are created by competition administrators. Public sign-up is
          disabled.
        </p>
        <SignInForm initialError={initialError} />
        <Link className="text-link" href="/">
          Return to public events
        </Link>
      </section>
    </main>
  );
}

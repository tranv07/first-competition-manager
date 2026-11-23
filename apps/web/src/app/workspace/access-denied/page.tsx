import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <section className="panel not-found-panel">
      <p className="eyebrow">ACCESS DENIED</p>
      <h1>You do not have access to this competition.</h1>
      <p>Ask an event admin to assign you a competition role.</p>
      <Link className="button button--primary" href="/">
        Return to public events
      </Link>
    </section>
  );
}

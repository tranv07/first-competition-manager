import { signOut } from "@/app/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="sign-out-button" type="submit">
        Sign out
      </button>
    </form>
  );
}

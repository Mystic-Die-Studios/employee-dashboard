import {
  Link,
  useOutletContext,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useEffect } from "react";
import { apiUrl } from "../api/config";

const ERROR_MESSAGES = {
  not_org_member:
    "Your GitHub account is not a member of the Mystic Die Studios organization.",
  org_check_failed:
    "We couldn't confirm your organization membership with GitHub. If you are a member, an org owner may need to approve this OAuth app.",
  github_denied: "You cancelled the GitHub sign-in.",
  invalid_state: "Your sign-in session expired. Please try again.",
  no_verified_email:
    "Your GitHub account has no verified email address. Verify one on GitHub and try again.",
  token_exchange_failed:
    "We couldn't complete the handshake with GitHub. Please try again.",
  github_profile_failed:
    "We couldn't read your GitHub profile. Please try again.",
  no_code: "GitHub did not return an authorization code. Please try again.",
};

export default function AuthPage() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleLogin = () => {
    // The server owns the client ID, scopes and CSRF state, so the browser
    // only needs to know where the dance starts.
    window.location.href = apiUrl("/api/v1/user/github/login/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5fa] px-6 font-sans text-[#28243b]">
      <section className="w-full max-w-md rounded-3xl border border-[#e7e3ee] bg-white p-10 text-center shadow-sm">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ede6fc] text-3xl text-[#7455b8]"
          aria-hidden="true"
        >
          ✦
        </div>
        <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-[#7455b8]">
          MYSTIC DIE STUDIOS
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A little magic.
          <br />A lot of making.
        </h1>
        <p className="my-6 text-sm leading-6 text-[#797386]">
          Welcome to your studio workspace. Sign in with your organization’s
          GitHub account to get started.
        </p>
        {error && (
          <p
            data-testid="auth-error"
            className="text-red-600 max-w-md text-center"
          >
            {ERROR_MESSAGES[error] || "Login failed. Please try again."}
          </p>
        )}
        <button
          data-testid="github-login-btn"
          className="w-full rounded-xl bg-[#7455b8] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#62449f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7455b8]"
          onClick={handleLogin}
        >
          Login with GitHub
        </button>
        <Link
          to="/preview"
          className="mt-5 inline-block text-sm font-medium text-[#7455b8] hover:underline"
        >
          Explore the frontend preview →
        </Link>
        <p className="mt-8 text-xs text-[#9993a4]">
          Projects, people, and possibilities. Together.
        </p>
      </section>
    </div>
  );
}

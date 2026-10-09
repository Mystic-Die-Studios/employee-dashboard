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
    <div className="studio-auth flex min-h-screen items-center justify-center px-6 font-sans">
      <section className="studio-auth-card w-full max-w-md rounded-3xl border p-10 text-center">
        <img
          src="/studio-die.svg"
          className="studio-auth-mark mx-auto mb-3"
          alt=""
        />
        <p className="studio-wordmark studio-auth-wordmark">
          MYSTIC DIE<small>STUDIOS</small>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          A little magic.
          <br />A lot of making.
        </h1>
        <p className="studio-auth-description my-6 text-sm leading-6">
          Welcome to your studio workspace. Sign in with your organization’s
          GitHub account to get started.
        </p>
        {error && (
          <p
            data-testid="auth-error"
            className="studio-auth-error max-w-md text-center"
          >
            {ERROR_MESSAGES[error] || "Login failed. Please try again."}
          </p>
        )}
        <button
          data-testid="github-login-btn"
          className="studio-auth-button w-full rounded-xl px-5 py-3 text-sm font-medium transition-colors"
          onClick={handleLogin}
        >
          Login with GitHub
        </button>
        <Link
          to="/preview"
          className="studio-auth-link mt-5 inline-block text-sm font-medium hover:underline"
        >
          Explore the frontend preview →
        </Link>
        <p className="studio-auth-footer mt-8 text-xs">
          Projects, people, and possibilities. Together.
        </p>
      </section>
    </div>
  );
}

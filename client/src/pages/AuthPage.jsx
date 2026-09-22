import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { apiUrl } from '../api/config';

const ERROR_MESSAGES = {
    not_org_member:
        'Your GitHub account is not a member of the Mystic Die Studios organization.',
    org_check_failed:
        "We couldn't confirm your organization membership with GitHub. If you are a member, an org owner may need to approve this OAuth app.",
    github_denied: 'You cancelled the GitHub sign-in.',
    invalid_state: 'Your sign-in session expired. Please try again.',
    no_verified_email:
        'Your GitHub account has no verified email address. Verify one on GitHub and try again.',
    token_exchange_failed: "We couldn't complete the handshake with GitHub. Please try again.",
    github_profile_failed: "We couldn't read your GitHub profile. Please try again.",
    no_code: 'GitHub did not return an authorization code. Please try again.',
};

export default function AuthPage() {
    const { user } = useOutletContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const error = searchParams.get('error');

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const handleLogin = () => {
        // The server owns the client ID, scopes and CSRF state, so the browser
        // only needs to know where the dance starts.
        window.location.href = apiUrl('/api/v1/user/github/login/');
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 gap-4">
            <h1 className="text-2xl font-semibold">Mystic Die Studios Employee Dashboard</h1>
            <p className="text-gray-600">Sign in with the GitHub account that belongs to the org.</p>
            {error && (
                <p data-testid="auth-error" className="text-red-600 max-w-md text-center">
                    {ERROR_MESSAGES[error] || 'Login failed. Please try again.'}
                </p>
            )}
            <button
                data-testid="github-login-btn"
                className="bg-blue-500 text-white p-2 rounded-md"
                onClick={handleLogin}
            >
                Login with GitHub
            </button>
        </div>
    );
}

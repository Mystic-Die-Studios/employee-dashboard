import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';

const ERROR_MESSAGES = {
    not_org_member: 'Your GitHub account is not a member of the Mystic Die Studios organization.',
};

export default function AuthPage() {
    const { user } = useOutletContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const error = searchParams.get('error');

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user]);

    const handleLogin = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const redirectUri = `${import.meta.env.VITE_API_BASE_URL}/api/v1/user/github/callback/`;
        window.location.href =
            `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('user:email read:org')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1>Please login to GitHub to continue</h1>
            {error && (
                <p data-testid="auth-error" className="text-red-600">
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
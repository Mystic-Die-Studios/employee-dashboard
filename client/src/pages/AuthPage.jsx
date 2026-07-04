import { useOutletContext, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function AuthPage() {
    const { user } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user]);

    const handleLogin = () => {
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        const redirectUri = `${import.meta.env.VITE_API_BASE_URL}/api/v1/user/github/callback/`;
        window.location.href =
            `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <h1>Please login to GitHub to continue</h1>
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
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function DashboardPage() {
    const { user, logout } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) navigate('/', { replace: true });
    }, [user, navigate]);

    const handleLogout = async () => {
        await logout();
        // Re-run the root loader so the app forgets the signed-out user.
        navigate('/', { replace: true });
        window.location.reload();
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-100 p-8" data-testid="dashboard-header">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold">Mystic Die Studios Employee Dashboard</h1>
                    <h2 className="text-gray-600">
                        Welcome, {user.github_username || user.email}
                        <span className="ml-2 text-xs uppercase tracking-wide bg-gray-200 rounded px-2 py-1">
                            {user.role}
                        </span>
                    </h2>
                </div>
                <button
                    data-testid="logout-btn"
                    className="bg-gray-800 text-white px-3 py-2 rounded-md"
                    onClick={handleLogout}
                >
                    Logout
                </button>
            </header>

            <section className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-medium mb-2">You&apos;re signed in.</h3>
                <p className="text-gray-600">
                    GitHub authorization and organization membership both checked out. This is a
                    placeholder landing page &mdash; dashboard content goes here.
                </p>
            </section>
        </div>
    );
}

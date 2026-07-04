import { useOutletContext, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function DashboardPage() {
    const { user, adminLogout } = useOutletContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) navigate('/', { replace: true });
    }, [user]);

    const handleLogout = async () => {
        await adminLogout();
        navigate('/', { replace: true });
    };

    if (!user) return null;

    return (
        <div data-testid="dashboard-header">
            <h1>Mystic Die Studios Employee Dashboard</h1>
            <h2>Welcome, {user.github_username}</h2>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}
import { Outlet, useLoaderData } from 'react-router-dom';
import { logout } from './helpers/authHelpers';

export default function App() {
    const user = useLoaderData();
    return (
        <div>
            <main>
                <Outlet context={{ user, logout }} />
            </main>
        </div>
    );
}

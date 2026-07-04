import { Outlet, useLoaderData } from 'react-router-dom';
import { adminLogout } from './helpers/authHelpers';

export default function App() {
    const user = useLoaderData();
    return (
        <div>
            <main>
                <Outlet context={{ 
                  user, 
                  adminLogout 
                  }} />
            </main>
        </div>
    );
}
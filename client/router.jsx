import { createBrowserRouter } from 'react-router-dom';
import App from './src/App';
import AuthPage from './src/pages/AuthPage';

const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        children: [
            {
                index: true,
                element: <AuthPage />,
            },
        ],
    },
]);

export default router;
import { createBrowserRouter } from 'react-router-dom';
import App from './src/App';
import AuthPage from './src/pages/AuthPage';
import userVerify from './src/helpers/authHelpers';

const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
        loader: userVerify,
        children: [
            {
                index: true,
                element: <AuthPage />,
            },
        ],
    },
]);

export default router;
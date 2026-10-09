import api from '../api/axios';

export default async function userVerify() {
    try {
        const res = await api.get('/api/v1/user/info/');
        return res.data;
    } catch {
        return null;
    }
}

export async function logout() {
    // HttpOnly cookies can only be cleared by the server. Do not pretend that
    // sign-out succeeded if its request failed and the session is still active.
    await api.post('/api/v1/user/logout/');
}

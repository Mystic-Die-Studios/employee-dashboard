import api from '../api/axios';

export default async function userVerify() {
    try {
        const res = await api.get('/api/v1/user/info/');
        return res.data;
    } catch {
        return null;
    }
}

export async function adminLogout() {
    await api.post('/api/v1/user/admin/logout/');
}
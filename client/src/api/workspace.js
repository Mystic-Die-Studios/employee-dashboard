import api from "./axios";

const workspacePath = "/api/v1/workspace/";
const data = (request) => request.then((response) => response.data);

export const loadWorkspace = (options) => data(api.get(workspacePath, options));
export const createDocument = (document) =>
  data(api.post(`${workspacePath}documents/`, document));
export const saveDocument = (id, document) =>
  data(api.patch(`${workspacePath}documents/${id}/`, document));
export const deleteDocument = (id) =>
  data(api.delete(`${workspacePath}documents/${id}/`));
export const createTask = (task) => data(api.post(`${workspacePath}tasks/`, task));
export const saveTask = (id, changes) =>
  data(api.patch(`${workspacePath}tasks/${id}/`, changes));
export const createReview = (form) =>
  data(api.post(`${workspacePath}reviews/`, form));
export const loadReview = (id, options) =>
  data(api.get(`${workspacePath}reviews/${id}/`, options));
export const addFeedback = (id, feedback) =>
  data(api.post(`${workspacePath}reviews/${id}/feedback/`, feedback));
export const syncReview = (id) =>
  data(api.post(`${workspacePath}reviews/${id}/github/`));

export async function downloadReviewFile(id, fileName) {
  const response = await api.get(`${workspacePath}reviews/${id}/file/`, {
    responseType: "blob",
  });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser begin reading the file before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function workspaceError(error, fallback = "Something went wrong. Try again.") {
  if (error.response?.status === 403)
    return "You do not have permission to make this change.";
  if (error.response?.status === 401)
    return "Your session has expired. Sign in again to continue.";
  const payload = error.response?.data;
  if (typeof payload?.detail === "string") return payload.detail;
  if (typeof payload?.error === "string") return payload.error;
  if (payload && typeof payload === "object" && !(payload instanceof Blob)) {
    const fieldError = Object.entries(payload).find(([, value]) =>
      Array.isArray(value) && typeof value[0] === "string",
    );
    if (fieldError) return `${fieldError[0]}: ${fieldError[1][0]}`;
  }
  return fallback;
}

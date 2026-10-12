// The message to show for a failed API call: the backend's { error: { message } }
// envelope when there is one, else the network error's message, else the fallback.
export const errorMessage = (err, fallback) => err?.response?.data?.error?.message ?? err?.message ?? fallback;

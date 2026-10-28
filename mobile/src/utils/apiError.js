// The message to show for a failed API call: the backend's { error: { message } }
// envelope when there is one, else the network error's message, else the fallback.
export const errorMessage = (err, fallback) => err?.response?.data?.error?.message ?? err?.message ?? fallback;

// The backend's per-field messages ({ error: { fields } }, CLINIC-024), to show each under its
// field; {} when there are none. The server writes them ready to show.
export const fieldErrorsOf = (err) => {
  const fields = err?.response?.data?.error?.fields;
  return fields && typeof fields === 'object' ? fields : {};
};

// Shown above a form when the server refused some of its fields.
export const CHECK_FIELDS_MESSAGE = 'Please check the values marked in red.';

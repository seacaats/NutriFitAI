import { useCallback } from "react";

/**
 * Lets Enter in any field of a form act as its submit button.
 *
 * `validate` is the form's own check: it returns an error message, or "" when
 * every required field is valid. It only drives `canSubmit` (handy for
 * enabling a button). Enter always calls `submit`, even when the form is
 * invalid, because submit shows that same first error -- a silent no-op would
 * look like a broken form.
 *
 * Does nothing while `loading`, so a held or repeated Enter can't submit twice.
 */
export function useEnterToSubmit({ submit, validate, loading }) {
  const canSubmit = !loading && !validate();

  const onSubmitEditing = useCallback(() => {
    if (loading) return;
    submit();
  }, [submit, loading]);

  return { canSubmit, onSubmitEditing };
}
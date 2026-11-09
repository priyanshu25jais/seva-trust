import { useCallback, useEffect, useRef, useState } from "react";

// Loads data and exposes { data, loading, error, reload }. Ignores stale responses.
export function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const counter = useRef(0);

  const run = useCallback(() => {
    const id = ++counter.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => {
        if (id === counter.current) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (id === counter.current) setState({ data: null, loading: false, error });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => {
      counter.current += 1;
    };
  }, [run]);

  return { ...state, reload: run };
}

// React is available as a global
const React = window.React;
const { useState, useEffect } = React;

export function Router({ children }) {
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname
  );

  useEffect(() => {
    const onLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  return children({
    currentPath,
    navigate: (path) => {
      window.history.pushState({}, "", path);
      setCurrentPath(path);
    },
  });
}


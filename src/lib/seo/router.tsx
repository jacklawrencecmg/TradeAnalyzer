import { createContext, useContext, ReactNode } from 'react';

interface RouterContextValue {
  params: Record<string, string>;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterContextValue>({
  params: {},
  navigate: () => {}
});

export function useParams<T = Record<string, string>>(): T {
  const { params } = useContext(RouterContext);
  return params as T;
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { navigate } = useContext(RouterContext);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export function RouterProvider({ params, children }: { params: Record<string, string>; children: ReactNode }) {
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    window.location.href = path;
  };

  return (
    <RouterContext.Provider value={{ params, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

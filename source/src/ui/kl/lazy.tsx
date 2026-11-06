import { Suspense, lazy, type ComponentProps, type ComponentType } from 'react';

/** Le mode Koh Lanta (et sa 3D) n'est chargé que lorsqu'on y joue. */
function withSuspense<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const Lazy = lazy(loader);
  return (props: ComponentProps<T>) => (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-lg text-amber-200"><span className="animate-pulse">🔥 Chargement de l'île…</span></div>}>
      <Lazy {...props} />
    </Suspense>
  );
}

export const KLBoard = withSuspense(() => import('./KLBoard'));
export const KLChallenge = withSuspense(() => import('./KLChallenge'));
export const ClientChallenge = withSuspense(() => import('./ClientChallenge'));
export const KLLocalGame = withSuspense(() => import('./KLLocalGame'));

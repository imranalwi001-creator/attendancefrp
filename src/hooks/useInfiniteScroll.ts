import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to trigger on initial render */
  triggerOnMount?: boolean;
}

interface UseInfiniteScrollReturn {
  /** Ref to attach to the trigger element */
  triggerRef: React.RefObject<HTMLDivElement>;
  /** Whether the trigger element is in view */
  isInView: boolean;
  /** Reset the in view state */
  resetInView: () => void;
}

/**
 * Custom hook for infinite scroll using IntersectionObserver
 * Reusable across different list components
 */
export function useInfiniteScroll(
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollReturn {
  const { threshold = 0.1, rootMargin = '100px', triggerOnMount = false } = options;
  const triggerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(triggerOnMount);

  const resetInView = useCallback(() => {
    setIsInView(false);
  }, []);

  useEffect(() => {
    const element = triggerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsInView(entry.isIntersecting);
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return {
    triggerRef,
    isInView,
    resetInView,
  };
}

/**
 * Hook to auto-fetch next page when trigger is in view
 */
export function useAutoFetchNextPage(
  isInView: boolean,
  hasNextPage: boolean | undefined,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void
) {
  useEffect(() => {
    if (isInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isInView, hasNextPage, isFetchingNextPage, fetchNextPage]);
}

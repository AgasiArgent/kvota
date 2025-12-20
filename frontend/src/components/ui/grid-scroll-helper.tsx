'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GridScrollHelperProps {
  /** Reference to the grid container element */
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Children (the grid itself) */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * GridScrollHelper - Provides scroll arrow buttons for ag-Grid horizontal scrolling
 *
 * Features:
 * - Left/Right arrow buttons appear when scrollable content exists
 * - Click to scroll, hover to auto-scroll continuously
 * - Buttons are fixed positioned for visibility regardless of page scroll
 */
export function GridScrollHelper({ gridContainerRef, children, className }: GridScrollHelperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
  });
  const [isHoveringLeft, setIsHoveringLeft] = useState(false);
  const [isHoveringRight, setIsHoveringRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Get the scrollable viewport element from ag-Grid
  const getScrollableElement = useCallback(() => {
    if (!gridContainerRef.current) return null;
    return gridContainerRef.current.querySelector(
      '.ag-body-horizontal-scroll-viewport'
    ) as HTMLElement | null;
  }, [gridContainerRef]);

  // Update scroll state from the grid
  const updateScrollState = useCallback(() => {
    const scrollable = getScrollableElement();
    if (!scrollable) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollable;
    setScrollState({ scrollLeft, scrollWidth, clientWidth });
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  }, [getScrollableElement]);

  // Scroll the grid horizontally
  const scrollGrid = useCallback(
    (direction: 'left' | 'right', speed: number = 5) => {
      const scrollable = getScrollableElement();
      if (!scrollable) return;

      const delta = direction === 'left' ? -speed : speed;
      scrollable.scrollLeft += delta;
      updateScrollState();
    },
    [getScrollableElement, updateScrollState]
  );

  // Handle hover-to-scroll animation
  // Uses ref-based flag to ensure animation stops properly
  useEffect(() => {
    // Only start if hovering
    if (!isHoveringLeft && !isHoveringRight) {
      isAnimatingRef.current = false;
      return;
    }

    isAnimatingRef.current = true;

    const animate = () => {
      // Check the ref flag to stop if needed
      if (!isAnimatingRef.current) {
        return;
      }

      const scrollable = getScrollableElement();
      if (!scrollable) {
        if (isAnimatingRef.current) {
          scrollAnimationRef.current = requestAnimationFrame(animate);
        }
        return;
      }

      const { scrollLeft, scrollWidth, clientWidth } = scrollable;
      const canGoLeft = scrollLeft > 0;
      const canGoRight = scrollLeft < scrollWidth - clientWidth - 1;

      if (isHoveringLeft && canGoLeft) {
        scrollable.scrollLeft -= 8;
        updateScrollState();
      } else if (isHoveringRight && canGoRight) {
        scrollable.scrollLeft += 8;
        updateScrollState();
      }

      // Continue animation only if still animating
      if (isAnimatingRef.current) {
        scrollAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    scrollAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      isAnimatingRef.current = false;
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
    };
  }, [isHoveringLeft, isHoveringRight, getScrollableElement, updateScrollState]);

  // Reset hover state when button disappears (element removed from DOM won't fire onMouseLeave)
  useEffect(() => {
    if (!canScrollLeft && isHoveringLeft) {
      setIsHoveringLeft(false);
    }
    if (!canScrollRight && isHoveringRight) {
      setIsHoveringRight(false);
    }
  }, [canScrollLeft, canScrollRight, isHoveringLeft, isHoveringRight]);

  // Set up scroll and resize listeners
  useEffect(() => {
    const scrollable = getScrollableElement();

    const handleScroll = () => {
      updateScrollState();
    };

    const handleResize = () => {
      updateScrollState();
    };

    if (scrollable) {
      scrollable.addEventListener('scroll', handleScroll);
    }

    window.addEventListener('resize', handleResize);

    // Initial update
    const timer = setTimeout(() => {
      updateScrollState();
    }, 100);

    return () => {
      if (scrollable) {
        scrollable.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [getScrollableElement, updateScrollState]);

  // Observe grid changes (data load, etc.)
  useEffect(() => {
    if (!gridContainerRef.current) return;

    const observer = new MutationObserver(() => {
      setTimeout(() => {
        updateScrollState();
      }, 50);
    });

    observer.observe(gridContainerRef.current, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [gridContainerRef, updateScrollState]);

  const hasHorizontalScroll = scrollState.scrollWidth > scrollState.clientWidth;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Left scroll button - fixed position, vertically centered */}
      {hasHorizontalScroll && canScrollLeft && (
        <div
          className="fixed left-[280px] top-1/2 -translate-y-1/2 z-50 cursor-pointer group"
          onMouseEnter={() => setIsHoveringLeft(true)}
          onMouseLeave={() => setIsHoveringLeft(false)}
          onClick={() => scrollGrid('left', 150)}
        >
          <div
            className={cn(
              'bg-amber-500 hover:bg-amber-400 rounded-full p-2 shadow-lg transition-all duration-200',
              isHoveringLeft ? 'scale-125 bg-amber-400' : ''
            )}
          >
            <ChevronLeft className="h-5 w-5 text-black" />
          </div>
        </div>
      )}

      {/* Right scroll button - fixed position, vertically centered */}
      {hasHorizontalScroll && canScrollRight && (
        <div
          className="fixed right-8 top-1/2 -translate-y-1/2 z-50 cursor-pointer group"
          onMouseEnter={() => setIsHoveringRight(true)}
          onMouseLeave={() => setIsHoveringRight(false)}
          onClick={() => scrollGrid('right', 150)}
        >
          <div
            className={cn(
              'bg-amber-500 hover:bg-amber-400 rounded-full p-2 shadow-lg transition-all duration-200',
              isHoveringRight ? 'scale-125 bg-amber-400' : ''
            )}
          >
            <ChevronRight className="h-5 w-5 text-black" />
          </div>
        </div>
      )}

      {/* Grid content */}
      {children}
    </div>
  );
}

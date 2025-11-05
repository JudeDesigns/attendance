import { useRef, useEffect } from 'react';

const useSwipeGesture = ({
  onSwipeLeft = null,
  onSwipeRight = null,
  onSwipeUp = null,
  onSwipeDown = null,
  threshold = 50, // Minimum distance for a swipe
  restraint = 100, // Maximum distance perpendicular to swipe direction
  allowedTime = 300, // Maximum time allowed for swipe
  element = null // Element to attach listeners to (defaults to ref element)
}) => {
  const ref = useRef(null);
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  useEffect(() => {
    const targetElement = element || ref.current;
    if (!targetElement) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const handleTouchMove = (e) => {
      // Prevent default scrolling behavior if we're handling swipes
      if (onSwipeLeft || onSwipeRight || onSwipeUp || onSwipeDown) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };

      const distX = touchEndRef.current.x - touchStartRef.current.x;
      const distY = touchEndRef.current.y - touchStartRef.current.y;
      const elapsedTime = touchEndRef.current.time - touchStartRef.current.time;

      // Check if swipe meets time requirement
      if (elapsedTime > allowedTime) {
        return;
      }

      // Check if swipe meets distance requirement
      const absDistX = Math.abs(distX);
      const absDistY = Math.abs(distY);

      if (absDistX >= threshold && absDistY <= restraint) {
        // Horizontal swipe
        if (distX > 0 && onSwipeRight) {
          onSwipeRight({
            distance: absDistX,
            duration: elapsedTime,
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touchEndRef.current.x,
            endY: touchEndRef.current.y
          });
        } else if (distX < 0 && onSwipeLeft) {
          onSwipeLeft({
            distance: absDistX,
            duration: elapsedTime,
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touchEndRef.current.x,
            endY: touchEndRef.current.y
          });
        }
      } else if (absDistY >= threshold && absDistX <= restraint) {
        // Vertical swipe
        if (distY > 0 && onSwipeDown) {
          onSwipeDown({
            distance: absDistY,
            duration: elapsedTime,
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touchEndRef.current.x,
            endY: touchEndRef.current.y
          });
        } else if (distY < 0 && onSwipeUp) {
          onSwipeUp({
            distance: absDistY,
            duration: elapsedTime,
            startX: touchStartRef.current.x,
            startY: touchStartRef.current.y,
            endX: touchEndRef.current.x,
            endY: touchEndRef.current.y
          });
        }
      }

      // Reset
      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    // Add event listeners
    targetElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    targetElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    targetElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    targetElement.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Cleanup
    return () => {
      targetElement.removeEventListener('touchstart', handleTouchStart);
      targetElement.removeEventListener('touchmove', handleTouchMove);
      targetElement.removeEventListener('touchend', handleTouchEnd);
      targetElement.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold,
    restraint,
    allowedTime,
    element
  ]);

  return ref;
};

// Hook for swipeable cards/items
export const useSwipeableCard = ({
  onSwipeLeft = null,
  onSwipeRight = null,
  threshold = 100,
  snapBackThreshold = 50
}) => {
  const ref = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e) => {
      isDraggingRef.current = true;
      startXRef.current = e.touches[0].clientX;
      currentXRef.current = 0;
      element.style.transition = 'none';
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current) return;

      const currentX = e.touches[0].clientX;
      const deltaX = currentX - startXRef.current;
      currentXRef.current = deltaX;

      // Apply transform
      element.style.transform = `translateX(${deltaX}px)`;
      
      // Apply opacity based on swipe distance
      const opacity = Math.max(0.3, 1 - Math.abs(deltaX) / 200);
      element.style.opacity = opacity;
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

      const deltaX = currentXRef.current;

      if (Math.abs(deltaX) > threshold) {
        // Swipe threshold met
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
        
        // Animate out
        element.style.transform = `translateX(${deltaX > 0 ? '100%' : '-100%'})`;
        element.style.opacity = '0';
      } else {
        // Snap back
        element.style.transform = 'translateX(0)';
        element.style.opacity = '1';
      }

      currentXRef.current = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, snapBackThreshold]);

  return ref;
};

// Hook for pull-to-refresh functionality
export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  resistance = 2.5
}) => {
  const ref = useRef(null);
  const isRefreshingRef = useRef(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e) => {
      if (element.scrollTop === 0) {
        startYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (element.scrollTop > 0 || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      if (deltaY > 0) {
        e.preventDefault();
        currentYRef.current = deltaY / resistance;
        
        // Visual feedback
        element.style.transform = `translateY(${currentYRef.current}px)`;
        
        if (currentYRef.current > threshold) {
          element.style.backgroundColor = '#f0f9ff'; // Light blue
        } else {
          element.style.backgroundColor = '';
        }
      }
    };

    const handleTouchEnd = () => {
      if (currentYRef.current > threshold && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        
        // Trigger refresh
        if (onRefresh) {
          onRefresh().finally(() => {
            isRefreshingRef.current = false;
            element.style.transform = '';
            element.style.backgroundColor = '';
          });
        }
      } else {
        element.style.transform = '';
        element.style.backgroundColor = '';
      }

      currentYRef.current = 0;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, resistance]);

  return ref;
};

export default useSwipeGesture;

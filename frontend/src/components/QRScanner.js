import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';

const QRScanner = ({ onScan, onError, isActive = false }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    // Add a small delay to prevent rapid toggling issues
    const timeoutId = setTimeout(() => {
      if (isActive) {
        startScanning();
      } else {
        stopScanning();
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const startScanning = async () => {
    // Prevent multiple simultaneous initialization attempts
    if (isInitializing || stream) {
      return;
    }

    setIsInitializing(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = mediaStream;

        // Wait for video to be ready before attempting to play
        const handleCanPlay = async () => {
          try {
            // Remove event listener to prevent multiple calls
            video.removeEventListener('canplay', handleCanPlay);

            await video.play();
            setScanning(true);
            scanQRCode();
          } catch (playError) {
            console.error('Error playing video:', playError);
            // If play fails due to user interaction requirement, still try to scan
            if (playError.name === 'NotAllowedError') {
              console.log('User interaction required for video play');
              setScanning(true);
              scanQRCode();
            } else if (playError.name !== 'AbortError') {
              setScanning(true);
              scanQRCode();
            }
          }
        };

        // Add event listener for when video can play
        video.addEventListener('canplay', handleCanPlay);

        // Fallback: try to play immediately if video is already ready
        if (video.readyState >= 3) { // HAVE_FUTURE_DATA
          handleCanPlay();
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      onError?.(error.message || 'Failed to access camera');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopScanning = () => {
    setScanning(false);
    setIsInitializing(false);

    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }

    // Clear video source and remove event listeners to prevent play() errors
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.srcObject = null;

      // Remove any event listeners that might have been added
      video.removeEventListener('canplay', () => {});
      video.removeEventListener('loadedmetadata', () => {});
    }
  };

  const scanQRCode = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        onScan?.(code.data);
        return;
      }
    }

    // Continue scanning
    if (scanning) {
      requestAnimationFrame(scanQRCode);
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="qr-scanner-container">
      <div className="relative">
        <video
          ref={videoRef}
          className="w-full h-auto rounded-lg"
          playsInline
          muted
          autoPlay
          controls={false}
          onLoadedMetadata={() => {
            // Ensure video dimensions are set when metadata loads
            if (videoRef.current && canvasRef.current) {
              const video = videoRef.current;
              canvasRef.current.width = video.videoWidth;
              canvasRef.current.height = video.videoHeight;
            }
          }}
          onError={(e) => {
            console.error('Video error:', e);
            onError?.('Video playback error occurred');
          }}
        />
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Scanner overlay */}
        <div className="qr-scanner-overlay">
          <div className="qr-scanner-corner top-left"></div>
          <div className="qr-scanner-corner top-right"></div>
          <div className="qr-scanner-corner bottom-left"></div>
          <div className="qr-scanner-corner bottom-right"></div>
        </div>
        
        {/* Instructions */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-white bg-black bg-opacity-50 px-4 py-2 rounded-lg inline-block">
            Point camera at QR code
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;

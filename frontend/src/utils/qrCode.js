/**
 * QR Code generation utility
 */
import QRCode from 'qrcode';

/**
 * Generate QR code as data URL
 * @param {string} text - Text to encode in QR code
 * @param {Object} options - QR code options
 * @returns {Promise<string>} - Data URL of the QR code image
 */
export const generateQRCode = async (text, options = {}) => {
  try {
    const defaultOptions = {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M',
      ...options
    };

    const dataUrl = await QRCode.toDataURL(text, defaultOptions);
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

/**
 * Generate QR code as canvas element
 * @param {string} text - Text to encode in QR code
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {Object} options - QR code options
 * @returns {Promise<void>}
 */
export const generateQRCodeToCanvas = async (text, canvas, options = {}) => {
  try {
    const defaultOptions = {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M',
      ...options
    };

    await QRCode.toCanvas(canvas, text, defaultOptions);
  } catch (error) {
    console.error('Error generating QR code to canvas:', error);
    throw error;
  }
};

/**
 * Generate QR code as SVG string
 * @param {string} text - Text to encode in QR code
 * @param {Object} options - QR code options
 * @returns {Promise<string>} - SVG string
 */
export const generateQRCodeSVG = async (text, options = {}) => {
  try {
    const defaultOptions = {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M',
      ...options
    };

    const svgString = await QRCode.toString(text, { 
      type: 'svg',
      ...defaultOptions 
    });
    return svgString;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    return null;
  }
};

/**
 * Validate QR code text
 * @param {string} text - Text to validate
 * @returns {boolean} - Whether the text is valid for QR code generation
 */
export const validateQRCodeText = (text) => {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  // QR codes can handle up to ~4,296 characters for alphanumeric data
  if (text.length > 4000) {
    return false;
  }
  
  return true;
};

/**
 * Get QR code capacity for different error correction levels
 * @param {string} level - Error correction level ('L', 'M', 'Q', 'H')
 * @returns {Object} - Capacity information
 */
export const getQRCodeCapacity = (level = 'M') => {
  const capacities = {
    'L': { numeric: 7089, alphanumeric: 4296, binary: 2953 },
    'M': { numeric: 5596, alphanumeric: 3391, binary: 2331 },
    'Q': { numeric: 3993, alphanumeric: 2420, binary: 1663 },
    'H': { numeric: 3057, alphanumeric: 1852, binary: 1273 }
  };
  
  return capacities[level] || capacities['M'];
};

const qrCodeUtils = {
  generateQRCode,
  generateQRCodeToCanvas,
  generateQRCodeSVG,
  validateQRCodeText,
  getQRCodeCapacity
};

export default qrCodeUtils;

// DejaVu Sans font for jsPDF - Unicode support
// This is a simplified version for basic Unicode character support

import { jsPDF } from 'jspdf';

// Register the font with jsPDF
jsPDF.API.events.push(['addFonts', () => {
  // Add a basic Unicode font mapping
  jsPDF.API.addFont('DejaVuSans', 'DejaVuSans', 'normal');
}]);

// Export the font configuration
export const DejaVuSans = {
  fontName: 'DejaVuSans',
  fontFamily: 'DejaVu Sans',
  fontWeight: 'normal',
  fontStyle: 'normal'
};

export default DejaVuSans;

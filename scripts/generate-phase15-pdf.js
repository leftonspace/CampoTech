const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create PDF document
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title: 'Fase 15: Marketplace para Consumidores',
    Author: 'CampoTech',
    Subject: 'Buscador de Servicios Gratuito - Explicación Completa',
  },
});

// Output path
const outputPath = path.join(__dirname, '..', 'docs', 'PHASE-15-CONSUMER-MARKETPLACE-EXPLICACION.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Colors
const colors = {
  primary: '#1a365d',
  secondary: '#2c5282',
  accent: '#3182ce',
  text: '#333333',
  lightText: '#718096',
  success: '#48bb78',
  warning: '#ed8936',
  bgLight: '#f7fafc',
  border: '#e2e8f0',
};

// Helper functions
function addTitle(text) {
  doc
    .fontSize(24)
    .fillColor(colors.primary)
    .text(text, { align: 'left' });
  doc.moveDown(0.3);
  doc
    .strokeColor(colors.accent)
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function addSubtitle(text) {
  doc
    .fontSize(12)
    .fillColor(colors.lightText)
    .text(text);
  doc.moveDown(1);
}

function addHeading2(text) {
  doc.moveDown(0.5);
  // Draw left border
  const y = doc.y;
  doc
    .strokeColor(colors.accent)
    .lineWidth(3)
    .moveTo(50, y)
    .lineTo(50, y + 20)
    .stroke();
  doc
    .fontSize(18)
    .fillColor(colors.secondary)
    .text(text, 60, y);
  doc.moveDown(0.8);
}

function addHeading3(text) {
  doc.moveDown(0.3);
  doc
    .fontSize(14)
    .fillColor(colors.text)
    .font('Helvetica-Bold')
    .text(text);
  doc.font('Helvetica');
  doc.moveDown(0.3);
}

function addParagraph(text) {
  doc
    .fontSize(11)
    .fillColor(colors.text)
    .text(text, { align: 'justify' });
  doc.moveDown(0.5);
}

function addBulletList(items) {
  items.forEach((item) => {
    doc
      .fontSize(11)
      .fillColor(colors.text)
      .text(`• ${item}`, { indent: 15 });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.3);
}

function addHighlightBox(text, bgColor = '#ebf8ff', borderColor = '#90cdf4') {
  const startY = doc.y;
  const boxWidth = 495;
  const textWidth = boxWidth - 30;

  // Calculate text height
  const textHeight = doc.heightOfString(text, { width: textWidth });
  const boxHeight = textHeight + 30;

  // Draw background
  doc
    .rect(50, startY, boxWidth, boxHeight)
    .fillColor(bgColor)
    .fill();

  // Draw border
  doc
    .rect(50, startY, boxWidth, boxHeight)
    .strokeColor(borderColor)
    .lineWidth(1)
    .stroke();

  // Add text
  doc
    .fontSize(11)
    .fillColor(colors.text)
    .text(text, 65, startY + 15, { width: textWidth });

  doc.y = startY + boxHeight + 15;
}

function addTable(headers, rows) {
  const startX = 50;
  const colWidth = 247;
  const rowHeight = 30;
  let currentY = doc.y;

  // Header
  doc
    .rect(startX, currentY, colWidth * 2, rowHeight)
    .fillColor(colors.secondary)
    .fill();

  headers.forEach((header, i) => {
    doc
      .fontSize(10)
      .fillColor('white')
      .font('Helvetica-Bold')
      .text(header, startX + i * colWidth + 10, currentY + 10, { width: colWidth - 20 });
  });

  currentY += rowHeight;

  // Rows
  rows.forEach((row, rowIndex) => {
    const bgColor = rowIndex % 2 === 0 ? 'white' : colors.bgLight;
    doc
      .rect(startX, currentY, colWidth * 2, rowHeight)
      .fillColor(bgColor)
      .fill();

    doc
      .rect(startX, currentY, colWidth * 2, rowHeight)
      .strokeColor(colors.border)
      .lineWidth(0.5)
      .stroke();

    row.forEach((cell, i) => {
      doc
        .fontSize(10)
        .fillColor(colors.text)
        .font('Helvetica')
        .text(cell, startX + i * colWidth + 10, currentY + 10, { width: colWidth - 20 });
    });

    currentY += rowHeight;
  });

  doc.y = currentY + 15;
}

function addSeparator() {
  doc.moveDown(0.5);
  doc
    .strokeColor(colors.border)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(1);
}

function checkPageBreak(minHeight = 100) {
  if (doc.y > 750 - minHeight) {
    doc.addPage();
  }
}

// === START DOCUMENT CONTENT ===

// Title
addTitle('Fase 15: Marketplace para Consumidores');
addSubtitle('Buscador de Servicios Gratuito - Explicación Completa');

// Section: La Gran Idea
addHeading2('La Gran Idea');

addHighlightBox(
  'La Fase 15 transforma CampoTech de una herramienta B2B en un marketplace de dos lados - pensalo como "Uber para servicios del hogar" pero 100% GRATIS para consumidores.',
  '#ebf8ff',
  '#90cdf4'
);

addSeparator();

// Section: Como Consumidor
addHeading2('Como Consumidor, Esto Es Lo Que Obtenés');

addHeading3('1. App Gratuita para Encontrar Proveedores de Servicios');
addParagraph('Descargás la app de CampoTech Consumer y podés:');
addBulletList([
  'Buscar por categoría: Plomero, Electricista, Aire Acondicionado, Cerrajero, Pintor, etc.',
  'Ver negocios cercanos: Quién trabaja en tu barrio (Palermo, Belgrano, etc.)',
  'Ver perfiles detallados: Fotos, calificaciones, reseñas, años en el negocio, tiempos de respuesta',
]);

addHeading3('2. Pedí Presupuestos Fácilmente');
addParagraph('El flujo es simple:');
addBulletList([
  'Tu Problema → Describilo (texto, fotos, nota de voz)',
  'El sistema te conecta con 5-10 negocios cercanos',
  'Los negocios te envían presupuestos con precios',
  'Comparás y elegís el mejor',
]);

addParagraph('Especificás:');
addBulletList([
  'Qué necesitás: "Mi aire acondicionado no enfría"',
  'Urgencia: Emergencia / Hoy / Esta semana / Flexible',
  'Rango de presupuesto: Menos de $5K / $5K-15K / $15K-50K / Más de $50K',
  'Horario preferido: Mañana / Tarde / Noche',
  'Fotos/Notas de voz: Mostrá el problema',
]);

checkPageBreak(200);

addHeading3('3. Compará Negocios Como un Profesional');

addTable(
  ['Lo Que Ves', 'Por Qué Importa'],
  [
    ['⭐ 4.8 (234 reseñas)', 'Calidad y reputación'],
    ['"Responde en menos de 1 hora"', 'Están activos y son responsivos'],
    ['✅ Negocio Verificado', 'CUIT validado, empresa legítima'],
    ['🎓 Matriculado', 'Certificación profesional'],
    ['🛡️ Asegurado', 'Protección si algo sale mal'],
    ['📍 A 2.3km de distancia', 'Ubicación conveniente'],
  ]
);

checkPageBreak(150);

addHeading3('4. Reseñas Verificadas en las que Podés Confiar');
addBulletList([
  'Las reseñas están vinculadas a trabajos completados reales',
  'Ves fotos del trabajo realizado',
  'Reseñas verificadas marcadas diferente de las no verificadas',
  'Los negocios pueden responder a las reseñas',
]);

addHeading3('5. Seguí Tu Servicio');
addParagraph('Una vez que aceptás un presupuesto:');
addBulletList([
  'Ves cuando el técnico está en camino',
  'Lo seguís en el mapa (como Uber)',
  'Recibís notificaciones por WhatsApp con actualizaciones',
  'Dejás una reseña después de que termine',
]);

addSeparator();
checkPageBreak(250);

// Section: Por Qué Es GRATIS
addHeading2('Por Qué Es GRATIS Para Vos');

addHighlightBox(
  'El Secreto: CampoTech gana dinero de los negocios, no de vos.',
  '#f0fff4',
  '#48bb78'
);

addTable(
  ['Apps de la Competencia', 'CampoTech'],
  [
    ['Te cobran 10-15% de comisión', '$0 de comisión para siempre'],
    ['Los negocios pagan por cada lead', 'Los negocios pagan suscripción mensual'],
    ['Información limitada de proveedores', 'Transparencia total'],
  ]
);

addHeading3('Por qué funciona esto para CampoTech:');
addBulletList([
  'Cada búsqueda de consumidor = lead potencial para negocios que pagan',
  'Más consumidores → los negocios quieren pagar por CampoTech → más opciones de servicios para vos',
  'La app genera reconocimiento de marca y participación de mercado',
]);

addSeparator();
checkPageBreak(200);

// Section: Modo Perfil Dual
addHeading2('Modo Perfil Dual');

addHighlightBox(
  'Dato interesante: Podés ser TANTO consumidor COMO dueño de negocio.',
  '#ebf8ff',
  '#90cdf4'
);

addParagraph(
  'Ejemplo: Sos plomero y usás CampoTech para gestionar tu negocio de plomería. Pero también necesitás un electricista para tu casa → simplemente cambiás a "Modo Consumidor" y buscás como cualquier persona común.'
);

addSeparator();
checkPageBreak(200);

// Section: Confianza y Seguridad
addHeading2('Funciones de Confianza y Seguridad');

addTable(
  ['Función', 'Qué Hace'],
  [
    ['Verificación de Negocio', 'Validación de CUIT confirma que es una empresa real'],
    ['Verificación de Matrícula', 'Revisión manual de certificaciones profesionales'],
    ['Verificación de Seguro', 'Prueba de que tienen cobertura de responsabilidad'],
    ['Moderación de Reseñas', 'Sistema de detección de reseñas falsas'],
    ['Sistema de Reportes', 'Podés reportar malos actores o problemas'],
  ]
);

addSeparator();
checkPageBreak(300);

// Section: Resumen
addHeading2('Resumen para Consumidores');

addHighlightBox(
  'La Fase 15 te da:\n\n' +
    '1. Una app gratuita para encontrar proveedores de servicios confiables\n' +
    '2. Solicitudes de presupuesto fáciles - describí tu problema, recibí múltiples presupuestos\n' +
    '3. Calificaciones transparentes - ves reseñas verificadas y señales de confianza\n' +
    '4. Sin comisiones ocultas - los negocios compiten por tu trabajo, vos no pagás nada\n' +
    '5. Seguimiento en vivo - sabés cuándo llega tu técnico\n' +
    '6. Tranquilidad - negocios verificados, reseñas moderadas, sistema de reportes',
  '#f0fff4',
  '#48bb78'
);

doc.moveDown(1);
doc
  .fontSize(13)
  .fillColor(colors.secondary)
  .font('Helvetica-Bold')
  .text(
    'Es esencialmente un marketplace gratuito donde los negocios compiten para atenderte, y vos elegís el mejor basándote en precio, calificaciones y reseñas.',
    { align: 'center' }
  );

// Footer
doc.moveDown(2);
doc
  .strokeColor(colors.border)
  .lineWidth(1)
  .moveTo(50, doc.y)
  .lineTo(545, doc.y)
  .stroke();
doc.moveDown(0.5);
doc
  .fontSize(9)
  .fillColor(colors.lightText)
  .font('Helvetica')
  .text('Documento generado por CampoTech', { align: 'center' })
  .text('Fase 15: Consumer Marketplace (Free Service Finder)', { align: 'center' })
  .text(
    'Para más información, consultá la documentación completa en architecture/FULL-IMPLEMENTATION-PLAN.md',
    { align: 'center' }
  );

// Finalize PDF
doc.end();

stream.on('finish', () => {
  console.log(`✅ PDF generado exitosamente: ${outputPath}`);
});

stream.on('error', (err) => {
  console.error('Error generando PDF:', err);
});

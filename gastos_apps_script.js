// ESTE CÓDIGO DEBE IR EN GOOGLE APPS SCRIPT
// 1. Ve a extensions > Apps Script en tu Planilla de Google.
// 2. Pega este código reemplazando todo.
// 3. Cambia los valores de FOLDER_ID y SHEET_NAME por los tuyos.
// 4. Ve a "Implementar" > "Nueva implementación" > "Aplicación web".
//    - Ejecutar como: Tú.
//    - Quién tiene acceso: Cualquier persona.
// 5. Copia la URL que te da y pégala en gastos_app.js

const SCRIPT_CONFIG = {
  // ID de la carpeta de Google Drive donde se guardarán los comprobantes
  FOLDER_ID: '1Xurq2gvhBaw3TE9e3tm7fxGVng4HXH0y',
  // Nombre de la pestaña de la planilla donde se guardan los gastos
  SHEET_NAME: 'Resgistro de Gastos'
};

function doPost(e) {
  try {
    // 1. Parsear los datos recibidos desde la página web
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCRIPT_CONFIG.SHEET_NAME);

    if (!sheet) {
      throw new Error("No se encontró la hoja con el nombre: " + SCRIPT_CONFIG.SHEET_NAME);
    }

    var imageUrl = "";

    // 2. Si viene una imagen adjunta, la procesamos y guardamos en Drive
    if (data.imageBase64 && data.imageBase64 !== "") {
      var folder = DriveApp.getFolderById(SCRIPT_CONFIG.FOLDER_ID);

      // Decodificar Base64
      var decodedImage = Utilities.base64Decode(data.imageBase64);

      // Crear blob
      var blob = Utilities.newBlob(decodedImage, data.mimeType, "Comprobante_" + data.fecha + "_" + data.monto + ".jpg");

      // Crear archivo en Drive
      var file = folder.createFile(blob);

      // Obtener la URL del archivo
      imageUrl = file.getUrl();
    }

    // Formatear el monto para que se vea bien como número/moneda si lo prefieres
    // o simplemente insertarlo como viene (el Sheets lo suele interpretar si la columna tiene formato de moneda)
    var monto = data.monto;

    // Reordenar la fecha para que esté en formato local (opcional, dependiendo de cómo manejes el Sheets)
    // En el frontend enviamos YYYY-MM-DD
    var fechaPartes = data.fecha.split("-");
    var fechaFormateada = fechaPartes[2] + "/" + fechaPartes[1] + "/" + fechaPartes[0]; // DD/MM/YYYY

    // 3. Preparar la fila para insertar
    // Las columnas detectadas en tu CSV: Fecha, Descripción, Monto, Categoría, Medio de Pago, [Comprobante]
    var rowData = [
      fechaFormateada,
      data.descripcion,
      parseFloat(monto), // Inserta el valor como número real, Google Sheets le dará el formato
      data.categoria,
      data.medioPago,
      imageUrl
    ];

    // 4. Insertar en la última fila disponible
    sheet.appendRow(rowData);

    // 5. Devolver respuesta de éxito al frontend
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Gasto guardado correctamente',
      imageUrl: imageUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Si hay error, devolvemos el error al frontend
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Función para manejar peticiones GET (obtener categorías)
function doGet(e) {
  try {
    if (e.parameter.action === 'getCategorias') {
      var doc = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = doc.getSheetByName("Categorias");
      
      if (!sheet) {
        throw new Error("No se encontró la pestaña 'Categorias'");
      }
      
      // Asumimos que A1 es 'categorias' y los datos empiezan en A2
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          categorias: []
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var categorias = [];
      for (var i = 0; i < data.length; i++) {
        if (data[i][0] !== "") {
          categorias.push(data[i][0]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        categorias: categorias
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput("Ruta GET no soportada").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Función requerida a veces para que Google Apps Script responda a peticiones OPTIONS en CORS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

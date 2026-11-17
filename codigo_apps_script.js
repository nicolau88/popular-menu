function doPost(e) {
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var sheetVentas = doc.getSheetByName("Ventas");
  var sheetProductos = doc.getSheetByName("Productos");
  
  var data = JSON.parse(e.postData.contents);
  var orderId = "#" + new Date().getTime().toString().slice(-6); 
  
  // 1. Guarda el ticket general en la pestaña "Ventas"
  sheetVentas.appendRow([
    data.fecha,
    data.hora,
    data.cliente,
    data.telefono,
    data.tipoEntrega,
    data.direccion,
    data.pago,
    data.total,
    data.envio,
    data.detalleResumen,
    orderId
  ]);
  
  // 2. Desglosa los productos en la pestaña "Productos"
  var items = data.carrito;
  for(var i=0; i < items.length; i++) {
    var item = items[i];
    var nombreLimpio = item.name.replace(/[🔥⭐★🌿❄️]/g, '').trim();
    var varianteLimpia = item.variant ? item.variant.replace(/[🔥⭐★🌿❄️]/g, '').trim() : "";
    
    // PRIORIDAD 1: Categorías explícitas enviadas desde el nuevo frontend
    if (item.categoria === "Extra") {
       sheetProductos.appendRow([data.fecha, "Extra", nombreLimpio, item.quantity, orderId]);
    }
    else if (item.categoria === "Pizza (De Promo)") {
       sheetProductos.appendRow([data.fecha, "Pizza (De Promo)", nombreLimpio + " (" + varianteLimpia + ")", item.quantity, orderId]);
    }
    else if (item.categoria === "Promo") {
       sheetProductos.appendRow([data.fecha, "Promo", nombreLimpio, item.quantity, orderId]);
    }
    else if (item.categoria === "Bebida") {
       sheetProductos.appendRow([data.fecha, "Bebida", nombreLimpio, item.quantity, orderId]);
    }
    // PRIORIDAD 2: Reglas heredadas
    // A. Es una docena de empanadas (Desglosa gustos)
    else if(item.isDocena && varianteLimpia !== "") {
       var sabores = varianteLimpia.split('|');
       for(var j=0; j < sabores.length; j++) {
           var parts = sabores[j].trim().split('x '); 
           var qty = (parseInt(parts[0]) || 1) * item.quantity;
           var sabor = parts[1] || sabores[j];
           sabor = sabor.replace(/[🔥⭐★🌿❄️]/g, '').trim();
           
           sheetProductos.appendRow([data.fecha, "Empanada (De Promo)", sabor, qty, orderId]);
       }
    } 
    // B. Es una Docena de Fatay (sin variante de gustos)
    else if (item.isDocena && varianteLimpia === "") {
       sheetProductos.appendRow([data.fecha, "Promo Fatay", nombreLimpio, item.quantity, orderId]);
    }
    // C. Es una Pizza (Tiene variante Para Hornear o Horneada)
    else if (varianteLimpia !== "") {
       sheetProductos.appendRow([data.fecha, "Pizza", nombreLimpio + " (" + varianteLimpia + ")", item.quantity, orderId]);
    } 
    // D. Son Empanadas sueltas, Bebidas o Productos sin variante
    else {
       var tipoProducto = "Empanada Suelta";
       var nombreUpper = nombreLimpio.toUpperCase();
       
       // Pequeña inteligencia para detectar bebidas o fatays sueltos
       if(nombreUpper.indexOf("PROMO") > -1) tipoProducto = "Promo";
       else if(nombreUpper.indexOf("FATAY") > -1) tipoProducto = "Fatay";
       else if(
         nombreUpper.indexOf("COCA") > -1 ||
         nombreUpper.indexOf("SPRITE") > -1 ||
         nombreUpper.indexOf("PEPSI") > -1 ||
         nombreUpper.indexOf("7UP") > -1 ||
         nombreUpper.indexOf("7 UP") > -1 ||
         nombreUpper.indexOf("MIRINDA") > -1 ||
         nombreUpper.indexOf("FANTA") > -1 ||
         nombreUpper.indexOf("POMELO") > -1 ||
         nombreUpper.indexOf("PASO DE LOS TOROS") > -1 ||
         nombreUpper.indexOf("AGUA") > -1 ||
         nombreUpper.indexOf("CERVEZA") > -1 ||
         nombreUpper.indexOf("BRAHMA") > -1 ||
         nombreUpper.indexOf("QUILMES") > -1 ||
         nombreUpper.indexOf("SCHNEIDER") > -1 ||
         nombreUpper.indexOf("BUDWEISER") > -1 ||
         nombreUpper.indexOf("ANDES") > -1 ||
         nombreUpper.indexOf("LITRO") > -1 ||
         nombreUpper.indexOf("1.5L") > -1 ||
         nombreUpper.indexOf("2.25L") > -1 ||
         nombreUpper.indexOf("500ML") > -1 ||
         nombreUpper.indexOf("500CC") > -1 ||
         nombreUpper.indexOf("PINTA") > -1 ||
         nombreUpper.indexOf("LATA") > -1
       ) tipoProducto = "Bebida";
       
       sheetProductos.appendRow([data.fecha, tipoProducto, nombreLimpio, item.quantity, orderId]);
    }
  }
  
  // --- 3. ACTUALIZACIÓN DE STOCK EN EL MASTER ---
  try {
    // ID real del Google Sheet "MASTER DE PRECIOS"
    var MASTER_SHEET_ID = "1aAhJCI5lZ93S5EKB32PEsbePvGJTAhoddvAEVwdrfp0"; 
    
    // ---> ATENCIÓN: CAMBIAR ESTO SEGÚN LA SUCURSAL <---
    // En el script de la Sucursal 1 debe decir "STOCK SUCURSAL 1"
    // En el script de la Sucursal 2 debe decir "STOCK SUCURSAL 2"
    var COLUMNA_STOCK = "STOCK SUCURSAL 1"; 
    
    var masterDoc = SpreadsheetApp.openById(MASTER_SHEET_ID);
    var masterSheet = masterDoc.getSheets()[0]; // Asume que la tabla está en la primera pestaña
    var dataMaster = masterSheet.getDataRange().getValues();
    var headers = dataMaster[0];
    
    var nombreIdx = headers.indexOf("NOMBRE");
    var stockIdx = headers.indexOf(COLUMNA_STOCK);
    
    if (nombreIdx !== -1 && stockIdx !== -1) {
      for (var k = 0; k < items.length; k++) {
        var itemCart = items[k];
        var nombreItem = itemCart.name.replace(/[🔥⭐★🌿❄️]/g, '').trim();
        var nomUp = nombreItem.toUpperCase();
        
        // Detectar si es bebida por categoría explícita o por nombre
        var isBebida = (itemCart.categoria === "Bebida");
        if(
          nomUp.indexOf("COCA") > -1 ||
          nomUp.indexOf("SPRITE") > -1 ||
          nomUp.indexOf("PEPSI") > -1 ||
          nomUp.indexOf("7UP") > -1 ||
          nomUp.indexOf("7 UP") > -1 ||
          nomUp.indexOf("MIRINDA") > -1 ||
          nomUp.indexOf("FANTA") > -1 ||
          nomUp.indexOf("POMELO") > -1 ||
          nomUp.indexOf("PASO DE LOS TOROS") > -1 ||
          nomUp.indexOf("AGUA") > -1 ||
          nomUp.indexOf("CERVEZA") > -1 ||
          nomUp.indexOf("BRAHMA") > -1 ||
          nomUp.indexOf("QUILMES") > -1 ||
          nomUp.indexOf("SCHNEIDER") > -1 ||
          nomUp.indexOf("BUDWEISER") > -1 ||
          nomUp.indexOf("ANDES") > -1 ||
          nomUp.indexOf("LITRO") > -1 ||
          nomUp.indexOf("1.5L") > -1 ||
          nomUp.indexOf("2.25L") > -1 ||
          nomUp.indexOf("500ML") > -1 ||
          nomUp.indexOf("500CC") > -1 ||
          nomUp.indexOf("PINTA") > -1 ||
          nomUp.indexOf("LATA") > -1
        ) {
          isBebida = true;
        }
        
        if (isBebida) {
          // Buscar en el master y restar
          for (var row = 1; row < dataMaster.length; row++) {
            var cellName = dataMaster[row][nombreIdx] ? dataMaster[row][nombreIdx].toString().trim() : "";
            if (cellName === itemCart.name) {
              var stockActual = parseInt(dataMaster[row][stockIdx]);
              if (!isNaN(stockActual)) {
                var nuevoStock = stockActual - itemCart.quantity;
                if (nuevoStock < 0) nuevoStock = 0;
                masterSheet.getRange(row + 1, stockIdx + 1).setValue(nuevoStock);
                dataMaster[row][stockIdx] = nuevoStock; // Actualizar en array en memoria
              }
              break;
            }
          }
        }
      }
    }
  } catch(err) {
    // Ignoramos errores de permisos o de ID incorrecto para no trabar la venta principal
    console.log("Error actualizando stock: " + err);
  }

  return ContentService.createTextOutput("Exito");
}

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
       else if(nombreUpper.indexOf("COCA") > -1 || nombreUpper.indexOf("SPRITE") > -1 || nombreUpper.indexOf("AGUA") > -1 || nombreUpper.indexOf("CERVEZA") > -1 || nombreUpper.indexOf("LITRO") > -1 || nombreUpper.indexOf("PINTA") > -1 || nombreUpper.indexOf("LATA") > -1) tipoProducto = "Bebida";
       
       sheetProductos.appendRow([data.fecha, tipoProducto, nombreLimpio, item.quantity, orderId]);
    }
  }
  
  return ContentService.createTextOutput("Exito");
}

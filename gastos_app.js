document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURACIÓN ---
    // AQUI SE DEBE PEGAR LA URL DE LA APLICACIÓN WEB DE GOOGLE APPS SCRIPT
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgnUNXEoBDhJkAPM-OosjOTixZ6Hc7jM199ZVOqq4R9cIyTPX3SirCRXghKywhBZ8n/exec';
    // ---------------------

    const form = document.getElementById('form-gastos');
    const inputFecha = document.getElementById('fecha');
    const fileInput = document.getElementById('comprobante');
    const fileNameDisplay = document.getElementById('file-name');
    const imagePreview = document.getElementById('image-preview');
    const loadingOverlay = document.getElementById('loading-overlay');

    // 1. Establecer la fecha actual por defecto
    const hoy = new Date();
    // Ajustar por zona horaria local
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    inputFecha.value = hoy.toISOString().split('T')[0];

    // 2. Manejar la selección de imagen (Vista previa)
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else {
            fileNameDisplay.textContent = 'Ningún archivo seleccionado';
            imagePreview.style.display = 'none';
            imagePreview.src = '';
        }
    });

    // 3. Función para comprimir la imagen usando Canvas
    async function comprimirImagen(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200; // Ancho máximo
                    const MAX_HEIGHT = 1200; // Alto máximo
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Comprimir como JPEG al 70% de calidad
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    // Extraer solo la parte base64 sin el prefijo "data:image/jpeg;base64,"
                    const base64Data = dataUrl.split(',')[1];
                    resolve({
                        base64: base64Data,
                        mimetype: 'image/jpeg',
                        filename: file.name
                    });
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    }

    // 4. Manejar el envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validar si pegaron la URL
        if (SCRIPT_URL === 'AQUI_PEGAREMOS_LA_URL_DEL_SCRIPT' || SCRIPT_URL === '') {
            Swal.fire({
                icon: 'error',
                title: 'Falta configurar',
                text: 'Falta colocar la URL del Google Apps Script en el código de gastos_app.js'
            });
            return;
        }

        const fecha = document.getElementById('fecha').value;
        const descripcion = document.getElementById('descripcion').value;
        const monto = document.getElementById('monto').value;
        const categoria = document.getElementById('categoria').value;
        const medioPago = document.getElementById('medioPago').value;
        const file = fileInput.files[0];

        // Validaciones extra
        if (!file) {
            const result = await Swal.fire({
                title: '¿Guardar sin comprobante?',
                text: "No has adjuntado una foto del gasto. ¿Quieres continuar igual?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, guardar',
                cancelButtonText: 'Cancelar'
            });
            if (!result.isConfirmed) return;
        }

        try {
            loadingOverlay.style.display = 'flex';

            let imageData = null;
            if (file) {
                // Comprimir la imagen antes de enviar
                imageData = await comprimirImagen(file);
            }

            // Preparar payload (objeto de datos a enviar)
            const payload = {
                fecha: fecha,
                descripcion: descripcion,
                monto: monto,
                categoria: categoria,
                medioPago: medioPago,
                imageName: imageData ? imageData.filename : null,
                mimeType: imageData ? imageData.mimetype : null,
                imageBase64: imageData ? imageData.base64 : null
            };

            // Enviar a Google Apps Script usando no-cors (es estándar para Apps Script desde web apps locales)
            // Sin embargo, para recibir respuesta JSON, necesitamos enviar como texto plano y que el script devuelva JSONP o usar Content-Type text/plain
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                // Usamos text/plain para evitar el preflight request de CORS que suele fallar en GAS
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            loadingOverlay.style.display = 'none';

            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Gasto guardado',
                    text: 'El gasto se ha registrado correctamente.',
                    confirmButtonColor: '#d32f2f'
                }).then(() => {
                    // Limpiar formulario pero mantener fecha
                    form.reset();
                    inputFecha.value = hoy.toISOString().split('T')[0];
                    fileNameDisplay.textContent = 'Ningún archivo seleccionado';
                    imagePreview.style.display = 'none';
                    imagePreview.src = '';
                });
            } else {
                throw new Error(result.message || 'Error desconocido');
            }

        } catch (error) {
            loadingOverlay.style.display = 'none';
            console.error('Error al enviar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al guardar el gasto: ' + error.message
            });
        }
    });

});

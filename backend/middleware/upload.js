const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ruta donde se guardarán los archivos
const uploadPath = path.join(__dirname, '../documents');

// Crear carpeta si no existe
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // extensión (.xlsx, .pdf, etc.)
        const baseName = path.basename(file.originalname, ext);

        // Nombre temporal único (luego se renombra con id_proyecto y usuario_id en el controller)
        cb(null, `${baseName}_${Date.now()}${ext}`);
    }
});

// Validar tipos de archivo permitidos
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/pdf',
        'image/png',
        'image/jpeg'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo Excel, PDF o imágenes.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

module.exports = upload;

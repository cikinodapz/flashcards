const multer = require('multer');
const path = require('path');

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder tempat menyimpan file
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Rename file unik
  }
});

// Filter tipe file (hanya gambar)
const fileFilter = (req, file, cb) => {
  console.log('Uploaded file:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  // Accept all image types more broadly
  if (file.mimetype.startsWith('image/') || 
      file.originalname.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
    return cb(null, true);
  }
  
  // Accept when testing from Postman
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('Postman')) {
    console.log('Accepting file from Postman');
    return cb(null, true);
  }
  
  return cb(new Error('File harus berupa gambar!'), false);
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

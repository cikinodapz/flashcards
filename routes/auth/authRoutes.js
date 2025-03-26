const express = require('express');
const { login, logout, register } = require('../../controllers/authController/auth'); 

const router = express.Router();

// Rute login
router.post('/login', login);
router.post('/logout', logout);
router.post('/register', register);

module.exports = router;


const express = require('express');
const { createDeck,getDecks,updateDeck,deleteDeck, getProfile } = require('../controllers/deckController/deck');
const authMiddleware = require('../middlewares/auth.middleware'); // Middleware untuk verifikasi token

const router = express.Router();

router.get('/profile', authMiddleware, getProfile);
router.post('/createDeck', authMiddleware, createDeck); // Hanya pengguna yang login yang bisa membuat deck
router.get('/getAllDeck', authMiddleware, getDecks); // Hanya pengguna yang login yang bisa membuat deck
router.put('/editDeck/:id', authMiddleware, updateDeck); // Hanya pengguna yang login yang bisa membuat deck
router.delete('/hapusDeck/:id', authMiddleware, deleteDeck);



module.exports = router;

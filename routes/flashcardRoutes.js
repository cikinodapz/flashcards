const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const authMiddleware = require('../middlewares/auth.middleware'); // Middleware untuk verifikasi token
const { getFlashcardsByDeck,createFlashcard, updateFlashcard, deleteFlashcard, startQuiz, answerFlashcard, copyFlashcardsToDeck, moveFlashcardsToDeck, startQuizLocal, startQuizDua } = require('../controllers/flashcardController/flashcard');

router.post('/addCard/:deckId',authMiddleware, upload.single('image'), createFlashcard);
router.get('/listCard/:deckId',authMiddleware, getFlashcardsByDeck);
router.put('/editCard/:flashcardId',authMiddleware,upload.single('image'),  updateFlashcard);
router.delete('/deleteCard/:flashcardId',authMiddleware,deleteFlashcard);

//extended
router.post('/decks/:targetDeckId/copy-flashcards', authMiddleware, copyFlashcardsToDeck); //fitur copy
router.post('/flashcards/move', authMiddleware, moveFlashcardsToDeck);//fitur cut

//quiz mode
router.get("/quiz/:deckId",authMiddleware, startQuiz); // Mulai kuis
router.post("/quiz/:flashcardId",authMiddleware, answerFlashcard); // Simpan jawaban user

//baru sampai kuis kocak
//done kuis

module.exports = router;

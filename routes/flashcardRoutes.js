const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { getFlashcardsByDeck,createFlashcard, updateFlashcard, deleteFlashcard, startQuiz, answerFlashcard } = require('../controllers/flashcardController/flashcard');

router.post('/addCard/:deckId', upload.single('image'), createFlashcard);
router.get('/listCard/:deckId', getFlashcardsByDeck);
router.put('/editCard/:flashcardId',upload.single('image'),  updateFlashcard);
router.delete('/deleteCard/:flashcardId',deleteFlashcard);


//quiz mode
router.get("/quiz/:deckId", startQuiz); // Mulai kuis
router.post("/quiz/:flashcardId", answerFlashcard); // Simpan jawaban user

//baru sampai kuis kocak

module.exports = router;

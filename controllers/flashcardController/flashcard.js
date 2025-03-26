const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getFlashcardsByDeck = async (req, res) => {
    try {
      const { deckId } = req.params;
  
      // Pastikan deckId ada di database
      const deckExists = await prisma.deck.findUnique({ where: { id: deckId } });
      if (!deckExists) {
        return res.status(404).json({ message: 'Deck tidak ditemukan!' });
      }
  
      // Ambil semua flashcard dalam deck
      const flashcards = await prisma.flashcard.findMany({ where: { deckId } });
  
      res.status(200).json({ flashcards });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  };
  

const createFlashcard = async (req, res) => {
  try {
    const { question, answer } = req.body;
    const { deckId } = req.params; // Jangan parseInt karena deckId berupa String
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Pastikan deckId ada di database
    const deckExists = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deckExists) {
      return res.status(404).json({ message: 'Deck tidak ditemukan!' });
    }

    // Buat flashcard baru dalam deck yang sesuai
    const newFlashcard = await prisma.flashcard.create({
      data: { question, answer, deckId, imageUrl }
    });

    res.status(201).json({ message: 'Flashcard berhasil dibuat!', flashcard: newFlashcard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

const updateFlashcard = async (req, res) => {
    try {
      const { flashcardId } = req.params;
      const { question, answer } = req.body;
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
      // Pastikan flashcard ada
      const flashcardExists = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
      if (!flashcardExists) {
        return res.status(404).json({ message: 'Flashcard tidak ditemukan!' });
      }
  
      // Update flashcard
      const updatedFlashcard = await prisma.flashcard.update({
        where: { id: flashcardId },
        data: { question, answer, imageUrl }
      });
  
      res.status(200).json({ message: 'Flashcard berhasil diperbarui!', flashcard: updatedFlashcard });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  };


  const deleteFlashcard = async (req, res) => {
    try {
      const { flashcardId } = req.params;
  
      // Pastikan flashcard ada
      const flashcardExists = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
      if (!flashcardExists) {
        return res.status(404).json({ message: 'Flashcard tidak ditemukan!' });
      }
  
      // Hapus flashcard
      await prisma.flashcard.delete({ where: { id: flashcardId } });
  
      res.status(200).json({ message: 'Flashcard berhasil dihapus!' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  };


// Mulai Kuis - Ambil Flashcards dari Deck
const startQuiz = async (req, res) => {
    try {
      const { deckId } = req.params;
  
      const flashcards = await prisma.flashcard.findMany({
        where: { deckId },
        select: {
          id: true,
          question: true,
          answer: false, // Jawaban awalnya disembunyikan
        },
      });
  
      if (flashcards.length === 0) {
        return res.status(404).json({ message: "Tidak ada flashcard di deck ini" });
      }
  
      res.json({ flashcards });
    } catch (error) {
      res.status(500).json({ message: "Gagal memulai kuis", error });
    }
  };
  
  const answerFlashcard = async (req, res) => {
    try {
      const { flashcardId } = req.params;
      const { userId, status } = req.body;
  
      if (!["tahu", "tidak tahu"].includes(status)) {
        return res.status(400).json({ message: "Status harus 'tahu' atau 'tidak tahu'" });
      }
  
      // Cek apakah userId ada
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }
  
      // Cek apakah flashcardId ada
      const flashcardExists = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
      if (!flashcardExists) {
        return res.status(404).json({ message: "Flashcard tidak ditemukan" });
      }
  
      // Cek apakah progres sudah ada
      const existingProgress = await prisma.progress.findFirst({
        where: { userId, flashcardId },
      });
  
      let progress;
      if (existingProgress) {
        progress = await prisma.progress.update({
          where: { id: existingProgress.id },
          data: { status },
        });
      } else {
        progress = await prisma.progress.create({
          data: { userId, flashcardId, status },
        });
      }
  
      res.json({ message: "Progres berhasil disimpan!", progress });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Gagal menyimpan progres", error });
    }
  };



module.exports = { getFlashcardsByDeck,createFlashcard,updateFlashcard ,deleteFlashcard, startQuiz,answerFlashcard};

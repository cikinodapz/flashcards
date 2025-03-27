const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getFlashcardsByDeck = async (req, res) => {
  try {
    const { deckId } = req.params;

    // Pastikan deckId ada di database
    const deckExists = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deckExists) {
      return res.status(404).json({ message: "Deck tidak ditemukan!" });
    }

    // Ambil semua flashcard dalam deck
    const flashcards = await prisma.flashcard.findMany({ where: { deckId } });

    res.status(200).json({ flashcards });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
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
      return res.status(404).json({ message: "Deck tidak ditemukan!" });
    }

    // Buat flashcard baru dalam deck yang sesuai
    const newFlashcard = await prisma.flashcard.create({
      data: { question, answer, deckId, imageUrl },
    });

    res
      .status(201)
      .json({ message: "Flashcard berhasil dibuat!", flashcard: newFlashcard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const updateFlashcard = async (req, res) => {
  try {
    const { flashcardId } = req.params;
    const { question, answer } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Pastikan flashcard ada
    const flashcardExists = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcardExists) {
      return res.status(404).json({ message: "Flashcard tidak ditemukan!" });
    }

    // Update flashcard
    const updatedFlashcard = await prisma.flashcard.update({
      where: { id: flashcardId },
      data: { question, answer, imageUrl },
    });

    res
      .status(200)
      .json({
        message: "Flashcard berhasil diperbarui!",
        flashcard: updatedFlashcard,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const deleteFlashcard = async (req, res) => {
  try {
    const { flashcardId } = req.params;

    // Pastikan flashcard ada
    const flashcardExists = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
    });
    if (!flashcardExists) {
      return res.status(404).json({ message: "Flashcard tidak ditemukan!" });
    }

    // Hapus flashcard
    await prisma.flashcard.delete({ where: { id: flashcardId } });

    res.status(200).json({ message: "Flashcard berhasil dihapus!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HF_TOKEN);

const startQuiz = async (req, res) => {
  try {
    const { deckId } = req.params;

    // Verifikasi deck exists
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { flashcards: true }
    });

    if (!deck) {
      return res.status(404).json({ message: 'Deck tidak ditemukan!' });
    }

    if (deck.flashcards.length === 0) {
      return res.status(400).json({ message: 'Deck kosong, tambahkan flashcard terlebih dahulu!' });
    }

    // Fungsi untuk menghasilkan distractors dengan Hugging Face
    const generateDistractors = async (question, correctAnswer) => {
      try {
        const prompt = `
          Given the question: "${question}"
          and the correct answer: "${correctAnswer}"
          Generate 3 plausible but incorrect distractors for a multiple-choice quiz.
          Format the output as a list, one distractor per line, without numbers, quotes, brackets, or any symbols like *.
        `;

        const response = await hf.textGeneration({
          model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
          inputs: prompt,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            return_full_text: false
          }
        });

        // Parsing teks yang dihasilkan
        let distractors = response.generated_text
          .trim()
          .split('\n')
          .map(line => line.trim())
          .map(line => line.replace(/["\[\],*]|\d+\.\s*/g, '')) // Hapus tanda kutip, kurung, koma, bintang, dan prefiks angka
          .filter(line => line && line !== correctAnswer && !line.includes('Given') && !line.includes('Generate'))
          .slice(0, 3);

        // Jika kurang dari 3 distractors, tambahkan fallback
        while (distractors.length < 3) {
          distractors.push(`Varian ${distractors.length + 1}`);
        }

        return distractors;
      } catch (error) {
        console.error('Error generating distractors:', error);
        return ["Option 1", "Option 2", "Option 3"];
      }
    };

    // Format data kuis untuk setiap flashcard
    const quizData = await Promise.all(deck.flashcards.map(async (card) => {
      // Generate distractors menggunakan Hugging Face
      const distractors = await generateDistractors(card.question, card.answer);

      // Gabungkan jawaban benar dengan distractors dan acak
      const options = [...distractors, card.answer]
        .sort(() => 0.5 - Math.random());

      return {
        flashcardId: card.id,
        question: card.question,
        options: options,
        correctAnswer: card.answer,
        imageUrl: card.imageUrl
      };
    }));

    res.status(200).json({
      message: 'Kuis dimulai!',
      deckId: deckId,
      quiz: quizData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

const answerFlashcard = async (req, res) => {
  // Fungsi untuk menghitung progress deck
  const calculateDeckProgress = async (deckId, userId) => {
    // Hitung total flashcards dalam deck
    const totalFlashcards = await prisma.flashcard.count({
      where: { deckId }
    });

    // Hitung flashcards yang sudah dikuasai (MASTERED) oleh user
    const masteredFlashcards = await prisma.progress.count({
      where: {
        userId,
        flashcard: { deckId },
        status: 'MASTERED'
      }
    });

    // Hitung persentase kemajuan
    const percentage = totalFlashcards > 0 
      ? Math.round((masteredFlashcards / totalFlashcards) * 100) 
      : 0;

    return {
      total: totalFlashcards,
      mastered: masteredFlashcards,
      percentage
    };
  };

  try {
    const { flashcardId } = req.params;
    const { userAnswer } = req.body;


    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }

    const userId = req.user.userId;

    // Validate input
    if (!flashcardId || !userAnswer) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Find the flashcard
    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
      include: { deck: true }
    });

    if (!flashcard) {
      return res.status(404).json({ message: 'Flashcard tidak ditemukan!' });
    }

    // Determine answer correctness
    const isCorrect = userAnswer.trim().toLowerCase() === flashcard.answer.trim().toLowerCase();
    const status = isCorrect ? 'MASTERED' : 'NEEDS_REVIEW';

    // Find existing progress record
    const existingProgress = await prisma.progress.findFirst({
      where: {
        userId,
        flashcardId
      }
    });

    let progress;
    if (existingProgress) {
      progress = await prisma.progress.update({
        where: { id: existingProgress.id },
        data: { status, updatedAt: new Date() }
      });
    } else {
      progress = await prisma.progress.create({
        data: {
          userId,
          flashcardId,
          status
        }
      });
    }

    // Calculate progress
    const deckProgress = await calculateDeckProgress(flashcard.deckId, userId);

    res.status(200).json({
      message: isCorrect ? 'Jawaban benar!' : 'Jawaban salah.',
      isCorrect,
      correctAnswer: flashcard.answer,
      progress: {
        currentCardStatus: status,
        deckCompletionPercentage: deckProgress.percentage,
        totalFlashcards: deckProgress.total,
        mastered: deckProgress.mastered
      }
    });

  } catch (error) {
    console.error('Error processing flashcard answer:', error);
    res.status(500).json({
      message: 'Terjadi kesalahan server',
      error: error.message
    });
  }
};



module.exports = {
  getFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  startQuiz,
  answerFlashcard,
};

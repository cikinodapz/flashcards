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

    // Tambahkan base URL menggunakan SERVER_HOST
    const flashcardsWithFullUrl = flashcards.map((card) => ({
      ...card,
      imageUrl: card.imageUrl, // Tidak menambahkan host, hanya path
    }));

    res.status(200).json({ flashcards: flashcardsWithFullUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const createFlashcard = async (req, res) => {
  try {
    const { question, answer } = req.body;
    const { deckId } = req.params;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const deckExists = await prisma.deck.findUnique({ where: { id: deckId } });
    if (!deckExists) {
      return res.status(404).json({ message: "Deck tidak ditemukan!" });
    }

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

    res.status(200).json({
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

    // Pertama, hapus semua progress yang terkait dengan flashcard ini
    await prisma.progress.deleteMany({
      where: { flashcardId: flashcardId },
    });

    // Kemudian hapus flashcard
    await prisma.flashcard.delete({
      where: { id: flashcardId },
    });

    res.status(200).json({ message: "Flashcard berhasil dihapus!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Terjadi kesalahan server",
      error: error.message, // Tambahkan pesan error untuk debugging
    });
  }
};

const copyFlashcardsToDeck = async (req, res) => {
  try {
    const { targetDeckId } = req.params;
    const { flashcardIds } = req.body; // Ekspektasi: array dari string ID flashcard

    // 1. Validasi input
    if (!targetDeckId) {
      return res
        .status(400)
        .json({ message: "ID Deck tujuan tidak boleh kosong." });
    }
    if (
      !flashcardIds ||
      !Array.isArray(flashcardIds) ||
      flashcardIds.length === 0
    ) {
      return res
        .status(400)
        .json({
          message: "ID Flashcard harus berupa array dan tidak boleh kosong.",
        });
    }

    // 2. Cek apakah deck tujuan ada
    const targetDeck = await prisma.deck.findUnique({
      where: { id: targetDeckId },
    });

    if (!targetDeck) {
      return res.status(404).json({ message: "Deck tujuan tidak ditemukan!" });
    }

    // 3. Ambil data flashcard asli yang akan disalin
    const originalFlashcards = await prisma.flashcard.findMany({
      where: {
        id: { in: flashcardIds },
      },
    });

    // 4. Pastikan semua flashcard yang diminta ditemukan
    if (originalFlashcards.length !== flashcardIds.length) {
      const foundIds = originalFlashcards.map((fc) => fc.id);
      const notFoundIds = flashcardIds.filter((id) => !foundIds.includes(id));
      return res.status(404).json({
        message: `Beberapa flashcard tidak ditemukan: ${notFoundIds.join(
          ", "
        )}. Tidak ada flashcard yang disalin.`,
      });
    }

    // 5. Siapkan data untuk flashcard baru (salinan)
    const newFlashcardsData = originalFlashcards.map((card) => ({
      question: card.question,
      answer: card.answer,
      imageUrl: card.imageUrl, // Salin path gambar apa adanya
      deckId: targetDeckId, // Kaitkan dengan deck tujuan
      // createdAt dan updatedAt akan di-handle otomatis oleh Prisma
    }));

    // 6. Buat flashcard baru (salinan) di deck tujuan
    // Menggunakan createMany untuk efisiensi jika menyalin banyak flashcard sekaligus
    const result = await prisma.flashcard.createMany({
      data: newFlashcardsData,
    });

    res.status(201).json({
      message: `${result.count} flashcard berhasil disalin ke deck '${targetDeck.name}'.`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error saat menyalin flashcard:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan server saat menyalin flashcard." });
  }
};

const moveFlashcardsToDeck = async (req, res) => {
  try {
    const { flashcardIds, targetDeckId } = req.body;

    // 1. Validasi input dasar
    if (!targetDeckId) {
      return res
        .status(400)
        .json({ message: "ID Deck tujuan tidak boleh kosong." });
    }
    if (
      !flashcardIds ||
      !Array.isArray(flashcardIds) ||
      flashcardIds.length === 0
    ) {
      return res
        .status(400)
        .json({
          message: "ID Flashcard harus berupa array dan tidak boleh kosong.",
        });
    }

    // 2. Cek apakah deck tujuan ada
    const targetDeck = await prisma.deck.findUnique({
      where: { id: targetDeckId },
    });

    if (!targetDeck) {
      return res.status(404).json({ message: "Deck tujuan tidak ditemukan!" });
    }

    // 3. Verifikasi semua flashcard yang dipilih ada
    const existingFlashcards = await prisma.flashcard.findMany({
      where: {
        id: { in: flashcardIds },
      },
      select: { id: true, deckId: true }, // Ambil ID dan deckId saat ini
    });

    if (existingFlashcards.length !== flashcardIds.length) {
      const foundDbIds = existingFlashcards.map((fc) => fc.id);
      const notFoundRequestIds = flashcardIds.filter(
        (id) => !foundDbIds.includes(id)
      );
      return res.status(404).json({
        message: `Beberapa flashcard tidak ditemukan di database: ${notFoundRequestIds.join(
          ", "
        )}. Tidak ada flashcard yang dipindahkan.`,
      });
    }

    // 4. Identifikasi flashcard yang benar-benar perlu dipindahkan (yang belum ada di deck tujuan)
    const flashcardsToActuallyMoveIds = existingFlashcards
      .filter((fc) => fc.deckId !== targetDeckId) // Hanya pindahkan jika beda deck
      .map((fc) => fc.id);

    let movedCount = 0;
    if (flashcardsToActuallyMoveIds.length > 0) {
      const updateResult = await prisma.flashcard.updateMany({
        where: {
          id: { in: flashcardsToActuallyMoveIds },
        },
        data: {
          deckId: targetDeckId,
          // updatedAt akan di-handle otomatis oleh Prisma jika ada @updatedAt
        },
      });
      movedCount = updateResult.count;
    }

    // 5. Buat pesan respons yang informatif
    let message;
    const totalSelected = flashcardIds.length;
    const alreadyInTargetDeckCount =
      totalSelected - flashcardsToActuallyMoveIds.length;

    if (movedCount > 0) {
      message = `${movedCount} flashcard berhasil dipindahkan ke deck '${targetDeck.name}'.`;
      if (alreadyInTargetDeckCount > 0) {
        message += ` ${alreadyInTargetDeckCount} flashcard lainnya sudah berada di deck tujuan.`;
      }
    } else if (
      alreadyInTargetDeckCount > 0 &&
      totalSelected === alreadyInTargetDeckCount
    ) {
      message = `Semua ${totalSelected} flashcard yang dipilih sudah berada di deck '${targetDeck.name}'. Tidak ada yang dipindahkan.`;
    } else if (totalSelected > 0) {
      // Tidak ada yang dipindahkan dan tidak ada yang sudah di deck tujuan (kemungkinan karena semua ID tidak valid, sudah ditangani di atas)
      message = `Tidak ada flashcard yang memenuhi syarat untuk dipindahkan ke deck '${targetDeck.name}'.`;
    } else {
      // flashcardIds kosong, sudah divalidasi di awal.
      message = "Tidak ada flashcard yang dipilih untuk dipindahkan.";
    }

    res.status(200).json({
      message: message,
      movedCount: movedCount, // Jumlah flashcard yang deckId-nya benar-benar diubah
      alreadyInTargetDeckCount: alreadyInTargetDeckCount,
    });
  } catch (error) {
    console.error("Error saat memindahkan flashcard:", error);
    res
      .status(500)
      .json({
        message: "Terjadi kesalahan server saat memindahkan flashcard.",
      });
  }
};

require("dotenv").config();
const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

const startQuiz = async (req, res) => {
  try {
    const { deckId } = req.params;

    // Verifikasi deck exists
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { flashcards: true },
    });

    if (!deck) {
      return res.status(404).json({ message: "Deck tidak ditemukan!" });
    }

    if (deck.flashcards.length === 0) {
      return res
        .status(400)
        .json({ message: "Deck kosong, tambahkan flashcard terlebih dahulu!" });
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
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
          inputs: prompt,
          parameters: {
            max_new_tokens: 100,
            temperature: 0.7,
            return_full_text: false,
          },
        });

        // Parsing teks yang dihasilkan
        let distractors = response.generated_text
          .trim()
          .split("\n")
          .map((line) => line.trim())
          .map((line) => line.replace(/["\[\],*]|\d+\.\s*/g, "")) // Hapus tanda kutip, kurung, koma, bintang, dan prefiks angka
          .filter(
            (line) =>
              line &&
              line !== correctAnswer &&
              !line.includes("Given") &&
              !line.includes("Generate")
          )
          .slice(0, 3);

        // Jika kurang dari 3 distractors, tambahkan fallback
        while (distractors.length < 3) {
          distractors.push(`Varian ${distractors.length + 1}`);
        }

        return distractors;
      } catch (error) {
        console.error("Error generating distractors:", error);
        return ["Option 1", "Option 2", "Option 3"];
      }
    };

    // Format data kuis untuk setiap flashcard
    const quizData = await Promise.all(
      deck.flashcards.map(async (card) => {
        // Generate distractors menggunakan Hugging Face
        const distractors = await generateDistractors(
          card.question,
          card.answer
        );

        // Gabungkan jawaban benar dengan distractors dan acak
        const options = [...distractors, card.answer].sort(
          () => 0.5 - Math.random()
        );

        return {
          flashcardId: card.id,
          question: card.question,
          options: options,
          correctAnswer: card.answer,
          imageUrl: card.imageUrl,
        };
      })
    );

    res.status(200).json({
      message: "Kuis dimulai!",
      deckId: deckId,
      quiz: quizData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const answerFlashcard = async (req, res) => {
  // Fungsi untuk menghitung progress deck
  const calculateDeckProgress = async (deckId, userId) => {
    // Hitung total flashcards dalam deck
    const totalFlashcards = await prisma.flashcard.count({
      where: { deckId },
    });

    // Hitung flashcards yang sudah dikuasai (MASTERED) oleh user
    const masteredFlashcards = await prisma.progress.count({
      where: {
        userId,
        flashcard: { deckId },
        status: "MASTERED",
      },
    });

    // Hitung persentase kemajuan
    const percentage =
      totalFlashcards > 0
        ? Math.round((masteredFlashcards / totalFlashcards) * 100)
        : 0;

    return {
      total: totalFlashcards,
      mastered: masteredFlashcards,
      percentage,
    };
  };

  try {
    const { flashcardId } = req.params;
    const { userAnswer } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    const userId = req.user.userId;

    // Validate input
    if (!flashcardId || !userAnswer) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find the flashcard
    const flashcard = await prisma.flashcard.findUnique({
      where: { id: flashcardId },
      include: { deck: true },
    });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard tidak ditemukan!" });
    }

    // Determine answer correctness
    const isCorrect =
      userAnswer.trim().toLowerCase() === flashcard.answer.trim().toLowerCase();
    const status = isCorrect ? "MASTERED" : "NEEDS_REVIEW";

    // Find existing progress record
    const existingProgress = await prisma.progress.findFirst({
      where: {
        userId,
        flashcardId,
      },
    });

    let progress;
    if (existingProgress) {
      progress = await prisma.progress.update({
        where: { id: existingProgress.id },
        data: { status, updatedAt: new Date() },
      });
    } else {
      progress = await prisma.progress.create({
        data: {
          userId,
          flashcardId,
          status,
        },
      });
    }

    // Calculate progress
    const deckProgress = await calculateDeckProgress(flashcard.deckId, userId);

    res.status(200).json({
      message: isCorrect ? "Jawaban benar!" : "Jawaban salah.",
      isCorrect,
      correctAnswer: flashcard.answer,
      progress: {
        currentCardStatus: status,
        deckCompletionPercentage: deckProgress.percentage,
        totalFlashcards: deckProgress.total,
        mastered: deckProgress.mastered,
      },
    });
  } catch (error) {
    console.error("Error processing flashcard answer:", error);
    res.status(500).json({
      message: "Terjadi kesalahan server",
      error: error.message,
    });
  }
};

module.exports = {
  getFlashcardsByDeck,
  createFlashcard,
  updateFlashcard,
  deleteFlashcard,
  copyFlashcardsToDeck,
  moveFlashcardsToDeck,
  startQuiz,
  answerFlashcard,
};

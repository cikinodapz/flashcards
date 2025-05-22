const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


const getDecks = async (req, res) => {
  try {
    const userId = req.user.userId; // Ambil user ID dari token

    // Ambil semua deck milik user
    const decks = await prisma.deck.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        category: true,
        createdAt: true,
        flashcards: {
          select: {
            id: true,
            progress: {
              where: { userId, status: 'MASTERED' }, // Hanya ambil progress MASTERED
              select: { id: true }, // Minimal data untuk efisiensi
            },
          },
        },
      },
    });

    // Transformasi data untuk menyertakan progress
    const decksWithProgress = decks.map((deck) => {
      const totalFlashcards = deck.flashcards.length;
      const masteredFlashcards = deck.flashcards.filter((flashcard) =>
        flashcard.progress.length > 0 // Hitung flashcard dengan status MASTERED
      ).length;
      const percentage = totalFlashcards > 0
        ? Math.round((masteredFlashcards / totalFlashcards) * 100)
        : 0;

      return {
        id: deck.id,
        name: deck.name,
        category: deck.category,
        createdAt: deck.createdAt,
        flashcardCount: totalFlashcards,
        mastered: masteredFlashcards,
        percentage, // Persentase penyelesaian
      };
    });

    res.status(200).json({ message: "Daftar deck", decks: decksWithProgress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};


const createDeck = async (req, res) => {
  try {
    const { name, category } = req.body;
    const userId = req.user.userId; // Ambil userId dari token JWT

    // Validasi input
    if (!name || !category) {
      return res.status(400).json({ message: 'Nama deck dan kategori wajib diisi' });
    }

    // Simpan ke database
    const newDeck = await prisma.deck.create({
      data: {
        name,
        category,
        userId,
      },
    });

    res.status(201).json({ message: 'Deck berhasil dibuat', deck: newDeck });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};


const updateDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;
    const userId = req.user.userId;

    // Cek apakah deck milik user
    const deck = await prisma.deck.findUnique({
      where: { id },
    });

    if (!deck || deck.userId !== userId) {
      return res.status(404).json({ message: "Deck tidak ditemukan atau bukan milik Anda" });
    }

    // Update deck
    const updatedDeck = await prisma.deck.update({
      where: { id },
      data: { name, category, updatedAt: new Date() },
    });

    res.status(200).json({ message: "Deck berhasil diperbarui", deck: updatedDeck });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Cek apakah deck milik user
    const deck = await prisma.deck.findUnique({
      where: { id },
    });

    if (!deck || deck.userId !== userId) {
      return res.status(404).json({ message: "Deck tidak ditemukan atau bukan milik Anda" });
    }

    // Gunakan transaksi untuk menghapus Progress, Flashcard, dan Deck
    await prisma.$transaction([
      // Hapus semua Progress yang terkait dengan Flashcard di Deck ini
      prisma.progress.deleteMany({
        where: {
          flashcard: {
            deckId: id,
          },
        },
      }),
      // Hapus semua Flashcard yang terkait dengan Deck
      prisma.flashcard.deleteMany({
        where: { deckId: id },
      }),
      // Hapus Deck
      prisma.deck.delete({
        where: { id },
      }),
    ]);

    res.status(200).json({ message: "Deck berhasil dihapus" });
  } catch (error) {
    console.error('Delete deck error:', error);
    res.status(500).json({ message: "Terjadi kesalahan server", error: error.message });
  }
};





module.exports = {getDecks, createDeck,updateDeck,deleteDeck };

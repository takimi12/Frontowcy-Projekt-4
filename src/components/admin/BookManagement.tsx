import React, { useState, useEffect } from 'react'
import { Typography, Box } from '@mui/material'
import { useAuth } from '../../context/AuthContext'
import { Book, NewBook, User, Borrowing } from '../../types/types'
import { AddBookForm } from './components/AddBookForm'
import { BookCard } from './components/BookCard'
import { DeleteBookDialog } from './components/DeleteBookDialog'

const API_URL = 'http://localhost:3001'

export const BookManagement: React.FC = () => {
	const { user } = useAuth()
	const [books, setBooks] = useState<Book[]>([])
	const [users, setUsers] = useState<User[]>([])
	const [borrowings, setBorrowings] = useState<Borrowing[]>([])
	const [editingBook, setEditingBook] = useState<Book | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false)
	const [bookToDelete, setBookToDelete] = useState<Book | null>(null)
	const [newBook, setNewBook] = useState<NewBook>({
		title: '',
		author: '',
		description: '',
		year: '',
		copies: '',
	})

	useEffect(() => {
		fetchBooks()
		fetchBorrowings()
		fetchUsers()
	}, [])

	const fetchBooks = async (): Promise<void> => {
		try {
			const response = await fetch(`${API_URL}/books`)
			const data = await response.json()
			setBooks(data)
		} catch (error) {
			console.error('Error fetching books:', error)
		}
	}

	const fetchBorrowings = async (): Promise<void> => {
		try {
			const response = await fetch(`${API_URL}/borrowings`)
			const data = await response.json()
			setBorrowings(data)
		} catch (error) {
			console.error('Error fetching borrowings:', error)
		}
	}

	const fetchUsers = async (): Promise<void> => {
		try {
			const response = await fetch(`${API_URL}/users`)
			const data = await response.json()
			setUsers(data)
		} catch (error) {
			console.error('Error fetching users:', error)
		}
	}

	const handleAddBook = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault()
		try {
			const bookData = {
				...newBook,
				year: parseInt(newBook.year),
				copies: parseInt(newBook.copies),
				borrowedBy: [],
			}

			const response = await fetch(`${API_URL}/books`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(bookData),
			})

			if (!response.ok) {
				throw new Error('Failed to add book')
			}

			setNewBook({
				title: '',
				author: '',
				description: '',
				year: '',
				copies: '',
			})

			await fetchBooks()
		} catch (error) {
			console.error('Error adding book:', error)
		}
	}

	const handleUpdateBook = async (e: React.FormEvent): Promise<void> => {
		e.preventDefault()
		if (!editingBook) return

		try {
			const response = await fetch(`${API_URL}/books/${editingBook.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editingBook),
			})

			if (!response.ok) {
				throw new Error('Failed to update book')
			}

			setEditingBook(null)
			await fetchBooks()
		} catch (error) {
			console.error('Error updating book:', error)
		}
	}

	const handleDeleteBook = async (book: Book): Promise<void> => {
		if (book.borrowedBy && book.borrowedBy.length > 0) {
			alert('Nie można usunąć książki, która jest aktualnie wypożyczona.')
			return
		}

		try {
			const response = await fetch(`${API_URL}/books/${book.id}`, {
				method: 'DELETE',
			})

			if (!response.ok) {
				throw new Error('Failed to delete book')
			}

			setDeleteDialogOpen(false)
			setBookToDelete(null)
			await fetchBooks()
		} catch (error) {
			console.error('Error deleting book:', error)
		}
	}

	const handleForceReturn = async (borrowingId: string): Promise<void> => {
		try {
			// Pobierz aktualne wypożyczenie
			const borrowingResponse = await fetch(
				`${API_URL}/borrowings/${borrowingId}`,
			)
			const borrowing = await borrowingResponse.json()

			// Zaktualizuj wypożyczenie, dodając returnDate
			const updatedBorrowing = {
				...borrowing,
				returnDate: new Date().toISOString(),
			}

			const response = await fetch(`${API_URL}/borrowings/${borrowingId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updatedBorrowing),
			})

			if (!response.ok) {
				throw new Error('Failed to force return')
			}

			// Zaloguj wymuszenie zwrotu
			const user = users.find((u) => u.id === borrowing.userId)
			const book = books.find((b) => b.id === borrowing.bookId)

			if (user && book) {
				await fetch(`${API_URL}/logs`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						date: new Date().toISOString(),
						userId: user.id,
						action: 'Wymuszony zwrot książki',
						details: `Administrator wymusił zwrot książki: ${book.title} od użytkownika ${user.email}`,
					}),
				})
			}

			await fetchBorrowings() // Odśwież listę wypożyczeń
		} catch (error) {
			console.error('Error forcing return:', error)
		}
	}

	if (user?.role !== 'Admin') {
		return (
			<Typography variant="h6" align="center" sx={{ p: 4 }}>
				Brak dostępu do panelu administratora
			</Typography>
		)
	}

	return (
		<Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
			<Typography variant="h4" gutterBottom>
				Zarządzanie książkami
			</Typography>

			<AddBookForm
				newBook={newBook}
				onNewBookChange={setNewBook}
				onSubmit={handleAddBook}
			/>

			<Box sx={{ display: 'grid', gap: 2 }}>
				{books.map((book) => (
					<BookCard
						key={book.id}
						book={book}
						editingBook={editingBook}
						onEditStart={() => setEditingBook(book)}
						onEditCancel={() => setEditingBook(null)}
						onEditSubmit={handleUpdateBook}
						onEditChange={setEditingBook}
						onDeleteStart={() => {
							setBookToDelete(book)
							setDeleteDialogOpen(true)
						}}
						borrowings={borrowings}
						users={users}
						onForceReturn={handleForceReturn}
					/>
				))}
			</Box>

			<DeleteBookDialog
				book={bookToDelete}
				open={deleteDialogOpen}
				onClose={() => {
					setDeleteDialogOpen(false)
					setBookToDelete(null)
				}}
				onConfirm={handleDeleteBook}
			/>
		</Box>
	)
}

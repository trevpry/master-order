import { useState } from 'react';

export const useCustomOrderForms = () => {
  // Form visibility states
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [showMovieForm, setShowMovieForm] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showComicForm, setShowComicForm] = useState(false);
  const [showShortStoryForm, setShowShortStoryForm] = useState(false);
  const [showWebVideoForm, setShowWebVideoForm] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showCmroBulkImportModal, setShowCmroBulkImportModal] = useState(false);

  // Form data states
  const [episodeFormData, setEpisodeFormData] = useState({
    series: '',
    season: '',
    episode: ''
  });

  const [movieFormData, setMovieFormData] = useState({
    title: '',
    year: ''
  });

  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    year: '',
    isbn: '',
    pageCount: ''
  });

  const [comicFormData, setComicFormData] = useState({
    series: '',
    year: '',
    issue: '',
    title: ''
  });

  const [shortStoryFormData, setShortStoryFormData] = useState({
    title: '',
    author: '',
    year: '',
    url: '',
    containedInBookId: '',
    coverUrl: ''
  });

  const [webVideoFormData, setWebVideoFormData] = useState({
    title: '',
    url: '',
    description: ''
  });

  const [bulkImportData, setBulkImportData] = useState('');
  const [cmroBulkImportData, setCmroBulkImportData] = useState('');

  // Loading states
  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);
  const [movieSearchLoading, setMovieSearchLoading] = useState(false);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [comicSearchLoading, setComicSearchLoading] = useState(false);
  const [shortStorySearchLoading, setShortStorySearchLoading] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [cmroBulkImportLoading, setCmroBulkImportLoading] = useState(false);

  // Search results
  const [movieSearchResults, setMovieSearchResults] = useState([]);
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [comicSearchResults, setComicSearchResults] = useState([]);
  const [shortStorySearchResults, setShortStorySearchResults] = useState([]);

  // Helper functions to reset forms
  const resetEpisodeForm = () => {
    setEpisodeFormData({ series: '', season: '', episode: '' });
    setShowEpisodeForm(false);
  };

  const resetMovieForm = () => {
    setMovieFormData({ title: '', year: '' });
    setMovieSearchResults([]);
    setShowMovieForm(false);
  };

  const resetBookForm = () => {
    setBookFormData({ title: '', author: '', year: '', isbn: '', pageCount: '' });
    setBookSearchResults([]);
    setShowBookForm(false);
  };

  const resetComicForm = () => {
    setComicFormData({ series: '', year: '', issue: '', title: '' });
    setComicSearchResults([]);
    setShowComicForm(false);
  };

  const resetShortStoryForm = () => {
    setShortStoryFormData({ title: '', author: '', year: '', url: '', containedInBookId: '', coverUrl: '' });
    setShortStorySearchResults([]);
    setShowShortStoryForm(false);
  };

  const resetWebVideoForm = () => {
    setWebVideoFormData({ title: '', url: '', description: '' });
    setShowWebVideoForm(false);
  };

  const resetBulkImportModal = () => {
    setBulkImportData('');
    setShowBulkImportModal(false);
  };

  const resetCmroBulkImportModal = () => {
    setCmroBulkImportData('');
    setShowCmroBulkImportModal(false);
  };

  return {
    // Form visibility states
    showEpisodeForm,
    setShowEpisodeForm,
    showMovieForm,
    setShowMovieForm,
    showBookForm,
    setShowBookForm,
    showComicForm,
    setShowComicForm,
    showShortStoryForm,
    setShowShortStoryForm,
    showWebVideoForm,
    setShowWebVideoForm,
    showBulkImportModal,
    setShowBulkImportModal,
    showCmroBulkImportModal,
    setShowCmroBulkImportModal,

    // Form data states
    episodeFormData,
    setEpisodeFormData,
    movieFormData,
    setMovieFormData,
    bookFormData,
    setBookFormData,
    comicFormData,
    setComicFormData,
    shortStoryFormData,
    setShortStoryFormData,
    webVideoFormData,
    setWebVideoFormData,
    bulkImportData,
    setBulkImportData,
    cmroBulkImportData,
    setCmroBulkImportData,

    // Loading states
    episodeSearchLoading,
    setEpisodeSearchLoading,
    movieSearchLoading,
    setMovieSearchLoading,
    bookSearchLoading,
    setBookSearchLoading,
    comicSearchLoading,
    setComicSearchLoading,
    shortStorySearchLoading,
    setShortStorySearchLoading,
    bulkImportLoading,
    setBulkImportLoading,
    cmroBulkImportLoading,
    setCmroBulkImportLoading,

    // Search results
    movieSearchResults,
    setMovieSearchResults,
    bookSearchResults,
    setBookSearchResults,
    comicSearchResults,
    setComicSearchResults,
    shortStorySearchResults,
    setShortStorySearchResults,

    // Reset functions
    resetEpisodeForm,
    resetMovieForm,
    resetBookForm,
    resetComicForm,
    resetShortStoryForm,
    resetWebVideoForm,
    resetBulkImportModal,
    resetCmroBulkImportModal,
  };
};
